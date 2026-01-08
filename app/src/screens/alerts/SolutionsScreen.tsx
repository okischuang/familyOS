import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, Alert, Solution } from '../../types';
import { generateSolutions } from '../../services/openai';

type Props = NativeStackScreenProps<RootStackParamList, 'Solutions'>;

export default function SolutionsScreen({ route, navigation }: Props) {
  const { alertId } = route.params;
  const [alert, setAlert] = useState<Alert | null>(null);
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [selectedSolutionId, setSelectedSolutionId] = useState<string | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // AbortController for cleanup - prevents state updates on unmounted component
    const abortController = new AbortController();
    let isMounted = true;

    async function loadSolutions() {
      try {
        // TODO: Replace with actual API call to fetch alert
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

        if (!isMounted) return;
        setAlert(mockAlert);

        // Generate solutions from OpenAI
        const generatedSolutions = await generateSolutions(
          { alert: mockAlert },
          abortController.signal
        );

        if (!isMounted) return;
        setSolutions(generatedSolutions);

        // Pre-select recommended solution
        const recommended = generatedSolutions.find((s) => s.isRecommended);
        if (recommended) {
          setSelectedSolutionId(recommended.id);
        }
      } catch (err) {
        // Don't update state if request was aborted
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }

        if (!isMounted) return;

        // Use mock solutions as fallback
        const mockSolutions: Solution[] = [
          {
            id: 'a',
            label: '解法 A（最穩定）',
            description: '請另一半晚30分鐘外出，並順路買尿布',
            isRecommended: true,
            impacts: ['你的會議不變', '孩子準時接送', '尿布補上，不用再跑一次'],
            actions: [],
          },
          {
            id: 'b',
            label: '解法 B',
            description: '你提前離開會議15分鐘，順路買尿布',
            isRecommended: false,
            impacts: ['會議需說明', '家庭無風險', '但你會比較累'],
            actions: [],
          },
          {
            id: 'c',
            label: '解法 C',
            description: '請阿公接小孩，你晚點買尿布',
            isRecommended: false,
            impacts: ['阿公需配合', '尿布延後一天買'],
            actions: [],
          },
        ];

        setSolutions(mockSolutions);
        setSelectedSolutionId('a');
        setError(null);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadSolutions();

    // Cleanup function to prevent memory leaks and state updates on unmounted component
    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [alertId]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1a1a1a" />
        <Text style={styles.loadingText}>正在分析解決方案...</Text>
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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>建議解法（選一個）</Text>
      </View>

      <View style={styles.solutionsList}>
        {solutions.map((solution) => (
          <TouchableOpacity
            key={solution.id}
            style={[
              styles.solutionCard,
              selectedSolutionId === solution.id && styles.solutionCardSelected,
            ]}
            onPress={() => setSelectedSolutionId(solution.id)}
          >
            <View style={styles.radioRow}>
              <View
                style={[
                  styles.radio,
                  selectedSolutionId === solution.id && styles.radioSelected,
                ]}
              >
                {selectedSolutionId === solution.id && (
                  <View style={styles.radioInner} />
                )}
              </View>
              <View style={styles.labelRow}>
                <Text style={styles.solutionLabel}>{solution.label}</Text>
                {solution.isRecommended && (
                  <View style={styles.recommendedBadge}>
                    <Text style={styles.recommendedText}>推薦</Text>
                  </View>
                )}
              </View>
            </View>

            <Text style={styles.solutionDescription}>{solution.description}</Text>

            <View style={styles.impactsSection}>
              <Text style={styles.impactsLabel}>影響：</Text>
              {solution.impacts.map((impact, index) => (
                <Text key={`${solution.id}-impact-${index}`} style={styles.impactItem}>
                  • {impact}
                </Text>
              ))}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.button, !selectedSolutionId && styles.buttonDisabled]}
        disabled={!selectedSolutionId}
        onPress={() => {
          if (selectedSolutionId && alert) {
            navigation.navigate('Confirm', {
              alertId: alert.id,
              solutionId: selectedSolutionId,
            });
          }
        }}
      >
        <Text
          style={[
            styles.buttonText,
            !selectedSolutionId && styles.buttonTextDisabled,
          ]}
        >
          確認選擇 →
        </Text>
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
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  solutionsList: {
    padding: 16,
  },
  solutionCard: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  solutionCardSelected: {
    borderColor: '#22c55e',
    backgroundColor: '#f0fdf4',
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#9ca3af',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  radioSelected: {
    borderColor: '#22c55e',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22c55e',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  solutionLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  recommendedBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  recommendedText: {
    fontSize: 10,
    color: '#15803d',
    fontWeight: '500',
  },
  solutionDescription: {
    fontSize: 12,
    color: '#4b5563',
    marginLeft: 28,
    marginBottom: 8,
  },
  impactsSection: {
    marginLeft: 28,
  },
  impactsLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 4,
  },
  impactItem: {
    fontSize: 11,
    color: '#4b5563',
    marginBottom: 2,
  },
  button: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    margin: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#e5e7eb',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonTextDisabled: {
    color: '#9ca3af',
  },
});
