/**
 * Pending Actions Screen
 * Shows scheduled actions with STOP button (veto interface)
 * This is Layer 2 of the interface stack - exception handling only
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getScheduledResolutions,
  vetoResolution,
  Resolution,
  timestampToDate,
  formatRelativeTime,
  formatTime,
} from '../../services/firebase-functions';

// Test family ID - in production, get from user context
const TEST_FAMILY_ID = 'test-family-001';

export default function PendingActionsScreen() {
  const [resolutions, setResolutions] = useState<Resolution[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [vetoingId, setVetoingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchResolutions = useCallback(async () => {
    try {
      setError(null);
      const data = await getScheduledResolutions(TEST_FAMILY_ID);
      setResolutions(data);
    } catch (err) {
      console.error('Error fetching resolutions:', err);
      setError('無法載入待執行行動');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchResolutions();
  }, [fetchResolutions]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchResolutions();
  }, [fetchResolutions]);

  const handleStop = useCallback(async (resolution: Resolution) => {
    Alert.alert(
      '確認停止',
      `確定要阻止這個行動嗎？\n\n"${resolution.message || '發送訊息給' + resolution.recipient}"`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '停止',
          style: 'destructive',
          onPress: async () => {
            setVetoingId(resolution.id);
            try {
              const result = await vetoResolution(resolution.id, '用戶手動阻止');
              if (result.success) {
                // Remove from list
                setResolutions((prev) =>
                  prev.filter((r) => r.id !== resolution.id)
                );
                Alert.alert('已停止', '行動已被阻止，不會執行');
              } else {
                Alert.alert('無法停止', result.message);
              }
            } catch (err) {
              console.error('Error vetoing resolution:', err);
              Alert.alert('錯誤', '無法停止行動，請重試');
            } finally {
              setVetoingId(null);
            }
          },
        },
      ]
    );
  }, []);

  const renderResolutionItem = ({ item }: { item: Resolution }) => {
    const scheduledAt = timestampToDate(item.scheduledAt);
    const vetoDeadline = timestampToDate(item.vetoDeadline);
    const now = new Date();
    const canVeto = now < vetoDeadline;
    const isVetoing = vetoingId === item.id;

    return (
      <View style={styles.card}>
        {/* Autonomy Level Badge */}
        <View style={[styles.autonomyBadge, getAutonomyStyle(item.autonomyLevel)]}>
          <Text style={styles.autonomyText}>{item.autonomyLevel}</Text>
        </View>

        {/* Action Description */}
        <Text style={styles.actionTitle}>
          發送訊息給 {item.recipient}
        </Text>

        {/* Message Preview */}
        {item.message && (
          <View style={styles.messagePreview}>
            <Text style={styles.messageText}>"{item.message}"</Text>
          </View>
        )}

        {/* Timing Info */}
        <View style={styles.timingContainer}>
          <View style={styles.timingRow}>
            <Text style={styles.timingLabel}>預定執行：</Text>
            <Text style={styles.timingValue}>
              {formatTime(scheduledAt)} ({formatRelativeTime(scheduledAt)})
            </Text>
          </View>
          {canVeto && (
            <View style={styles.timingRow}>
              <Text style={styles.timingLabel}>阻止期限：</Text>
              <Text style={[styles.timingValue, styles.deadlineText]}>
                {formatRelativeTime(vetoDeadline)}
              </Text>
            </View>
          )}
        </View>

        {/* STOP Button */}
        {canVeto ? (
          <TouchableOpacity
            style={[styles.stopButton, isVetoing && styles.stopButtonDisabled]}
            onPress={() => handleStop(item)}
            disabled={isVetoing}
          >
            {isVetoing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.stopButtonText}>STOP</Text>
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.expiredBadge}>
            <Text style={styles.expiredText}>已超過阻止期限</Text>
          </View>
        )}
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyEmoji}>✨</Text>
      <Text style={styles.emptyTitle}>沒有待執行的行動</Text>
      <Text style={styles.emptySubtitle}>
        系統會在偵測到風險時自動安排行動
      </Text>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>待執行行動</Text>
      <Text style={styles.headerSubtitle}>
        如果不同意，按 STOP 阻止
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1a1a1a" />
          <Text style={styles.loadingText}>載入中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchResolutions}>
            <Text style={styles.retryButtonText}>重試</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={resolutions}
        renderItem={renderResolutionItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

function getAutonomyStyle(level: string) {
  switch (level) {
    case 'L4':
      return styles.autonomyL4;
    case 'L3':
      return styles.autonomyL3;
    default:
      return styles.autonomyL2;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  header: {
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#666',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  autonomyBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  autonomyL4: {
    backgroundColor: '#dbeafe',
  },
  autonomyL3: {
    backgroundColor: '#fef3c7',
  },
  autonomyL2: {
    backgroundColor: '#e5e7eb',
  },
  autonomyText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  actionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  messagePreview: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  messageText: {
    fontSize: 14,
    color: '#374151',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  timingContainer: {
    marginBottom: 16,
  },
  timingRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  timingLabel: {
    fontSize: 13,
    color: '#666',
    width: 80,
  },
  timingValue: {
    fontSize: 13,
    color: '#1a1a1a',
    flex: 1,
  },
  deadlineText: {
    color: '#dc2626',
    fontWeight: '600',
  },
  stopButton: {
    backgroundColor: '#dc2626',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  stopButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  stopButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 2,
  },
  expiredBadge: {
    backgroundColor: '#f3f4f6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  expiredText: {
    fontSize: 14,
    color: '#9ca3af',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});
