import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Clipboard,
  Alert as RNAlert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, Alert, Solution } from '../../types';
import { generateMessage } from '../../services/openai';

type Props = NativeStackScreenProps<RootStackParamList, 'Confirm'>;

export default function ConfirmScreen({ route, navigation }: Props) {
  const { alertId, solutionId } = route.params;
  const [alert, setAlert] = useState<Alert | null>(null);
  const [solution, setSolution] = useState<Solution | null>(null);
  const [message, setMessage] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // AbortController for cleanup - prevents state updates on unmounted component
    const abortController = new AbortController();
    let isMounted = true;

    async function loadMessage() {
      try {
        // TODO: Replace with actual API call to fetch alert and solution
        const mockAlert: Alert = {
          id: alertId,
          familyId: 'family-1',
          type: 'schedule_conflict',
          severity: 'high',
          status: 'pending',
          title: '17:30–18:30 孩子接送無人負責',
          description: '你會議延後 + 另一半外出',
          triggerTime: new Date(),
          expiryTime: new Date(),
          suggestedSolutions: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const mockSolution: Solution = {
          id: solutionId,
          label: '解法 A（最穩定）',
          description: '請另一半晚30分鐘外出，並順路買尿布',
          isRecommended: true,
          impacts: ['你的會議不變', '孩子準時接送', '尿布補上，不用再跑一次'],
          actions: [],
        };

        if (!isMounted) return;
        setAlert(mockAlert);
        setSolution(mockSolution);

        // Generate message from OpenAI
        const generatedMessage = await generateMessage(
          {
            alert: mockAlert,
            solution: mockSolution,
            recipientRelation: 'partner',
            tone: 'warm',
          },
          abortController.signal
        );

        if (!isMounted) return;
        setMessage(generatedMessage);
      } catch (err) {
        // Don't update state if request was aborted (component unmounted)
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }

        if (!isMounted) return;

        // Use fallback message
        const fallbackMessage = `我看到17:30接送有衝突，
你能晚30分鐘出門嗎？
順便幫忙買一包尿布，
我這邊會議照開，謝謝你～`;
        setMessage(fallbackMessage);
        setError(null);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadMessage();

    // Cleanup function to prevent memory leaks and state updates on unmounted component
    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [alertId, solutionId]);

  const handleCopyText = () => {
    Clipboard.setString(message);
    RNAlert.alert('已複製', '訊息已複製到剪貼簿');
  };

  const handleShareToLINE = async () => {
    try {
      await Share.share({
        message: message,
      });
    } catch (err) {
      RNAlert.alert('分享失敗', '無法開啟分享功能');
    }
  };

  const handleComplete = () => {
    // TODO: Mark alert as resolved in backend
    navigation.popToTop();
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1a1a1a" />
        <Text style={styles.loadingText}>正在生成訊息...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.selectedBox}>
        <Text style={styles.selectedLabel}>✓ 已選：{solution?.label}</Text>
      </View>

      <View style={styles.messageSection}>
        <Text style={styles.messageSectionTitle}>系統建議你這樣說：</Text>
        <View style={styles.messageBox}>
          <Text style={styles.messageText}>{message}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.secondaryButton} onPress={handleCopyText}>
          <Text style={styles.secondaryButtonText}>📋 複製文字</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.primaryButton} onPress={handleShareToLINE}>
          <Text style={styles.primaryButtonText}>💬 分享到 LINE</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.completeLink} onPress={handleComplete}>
        <Text style={styles.completeLinkText}>完成，返回首頁</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#6b7280',
    fontSize: 14,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 16,
  },
  selectedBox: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 8,
    padding: 12,
    margin: 16,
  },
  selectedLabel: {
    color: '#15803d',
    fontWeight: '500',
    fontSize: 14,
  },
  messageSection: {
    padding: 16,
  },
  messageSectionTitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  messageBox: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#d1d5db',
  },
  messageText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#374151',
  },
  actions: {
    padding: 16,
    gap: 12,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  primaryButton: {
    backgroundColor: '#22c55e',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  completeLink: {
    alignItems: 'center',
    padding: 16,
  },
  completeLinkText: {
    color: '#6b7280',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});
