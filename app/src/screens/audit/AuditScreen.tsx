/**
 * Audit Screen
 * Shows action history: what/why/vetoed
 * This is Layer 3 of the interface stack (opened 1x/week)
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
  getActionLogs,
  rollbackResolution,
  ActionLog,
  timestampToDate,
  formatRelativeTime,
} from '../../services/firebase-functions';

// Test family ID - in production, get from user context
const TEST_FAMILY_ID = 'test-family-001';

// Rollback window: 30 minutes
const ROLLBACK_WINDOW_MS = 30 * 60 * 1000;

export default function AuditScreen() {
  const [logs, setLogs] = useState<ActionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rollingBackId, setRollingBackId] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      setError(null);
      const data = await getActionLogs(TEST_FAMILY_ID, 50);
      setLogs(data);
    } catch (err) {
      console.error('Error fetching action logs:', err);
      setError('無法載入行動紀錄');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchLogs();
  }, [fetchLogs]);

  const handleRollback = useCallback(async (log: ActionLog) => {
    Alert.alert(
      '確認撤回',
      `確定要撤回這個行動並向對方道歉嗎？\n\n原訊息："${log.message}"`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '撤回並道歉',
          style: 'destructive',
          onPress: async () => {
            setRollingBackId(log.resolutionId);
            try {
              const result = await rollbackResolution(log.resolutionId, '用戶主動撤回');
              if (result.success) {
                Alert.alert(
                  '已撤回',
                  `已發送道歉訊息：\n\n"${result.apologyMessage}"`,
                  [{ text: '好', onPress: () => fetchLogs() }]
                );
              } else {
                Alert.alert('無法撤回', result.message);
              }
            } catch (err) {
              console.error('Error rolling back:', err);
              Alert.alert('錯誤', '無法撤回行動，請重試');
            } finally {
              setRollingBackId(null);
            }
          },
        },
      ]
    );
  }, [fetchLogs]);

  const canRollback = (log: ActionLog): boolean => {
    // Can only rollback executed (not vetoed) actions within the rollback window
    if (log.wasVetoed) return false;
    if (log.outcome !== 'executed') return false;

    const timestamp = timestampToDate(log.timestamp);
    const elapsed = Date.now() - timestamp.getTime();
    return elapsed < ROLLBACK_WINDOW_MS;
  };

  const renderLogItem = ({ item }: { item: ActionLog }) => {
    const timestamp = timestampToDate(item.timestamp);
    const isVetoed = item.wasVetoed;
    const isRolledBack = item.outcome === 'rolled_back';
    const showRollback = canRollback(item);
    const isRollingBack = rollingBackId === item.resolutionId;

    return (
      <View style={[
        styles.logCard,
        isVetoed && styles.logCardVetoed,
        isRolledBack && styles.logCardRolledBack,
      ]}>
        {/* Status Badge */}
        <View style={[
          styles.badge,
          isVetoed ? styles.badgeVetoed :
          isRolledBack ? styles.badgeRolledBack :
          styles.badgeExecuted
        ]}>
          <Text style={styles.badgeText}>
            {isVetoed ? '已阻止' : isRolledBack ? '已撤回' : '已執行'}
          </Text>
        </View>

        {/* What */}
        <Text style={styles.whatText}>{item.what}</Text>

        {/* Why */}
        <View style={styles.whyContainer}>
          <Text style={styles.whyLabel}>原因：</Text>
          <Text style={styles.whyText}>{item.why}</Text>
        </View>

        {/* Message (if executed) */}
        {!isVetoed && item.message && (
          <View style={styles.messageContainer}>
            <Text style={styles.messageLabel}>訊息內容：</Text>
            <Text style={styles.messageText}>"{item.message}"</Text>
          </View>
        )}

        {/* Autonomy Level & Time */}
        <View style={styles.footer}>
          <View style={styles.autonomyBadge}>
            <Text style={styles.autonomyText}>{item.autonomyLevel}</Text>
          </View>
          <Text style={styles.timeText}>{formatRelativeTime(timestamp)}</Text>
        </View>

        {/* Rollback Button (only for executed actions within window) */}
        {showRollback && (
          <TouchableOpacity
            style={[styles.rollbackButton, isRollingBack && styles.rollbackButtonDisabled]}
            onPress={() => handleRollback(item)}
            disabled={isRollingBack}
          >
            {isRollingBack ? (
              <ActivityIndicator size="small" color="#9ca3af" />
            ) : (
              <Text style={styles.rollbackButtonText}>↩️ 撤回並道歉</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyEmoji}>📋</Text>
      <Text style={styles.emptyTitle}>還沒有行動紀錄</Text>
      <Text style={styles.emptySubtitle}>
        系統自動執行的行動會顯示在這裡
      </Text>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>行動紀錄</Text>
      <Text style={styles.headerSubtitle}>
        系統為您做了什麼、為什麼這樣做
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
          <TouchableOpacity style={styles.retryButton} onPress={fetchLogs}>
            <Text style={styles.retryButtonText}>重試</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={logs}
        renderItem={renderLogItem}
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
  logCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  logCardVetoed: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  logCardRolledBack: {
    backgroundColor: '#fefce8',
    borderColor: '#fde047',
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  badgeExecuted: {
    backgroundColor: '#dcfce7',
  },
  badgeVetoed: {
    backgroundColor: '#fee2e2',
  },
  badgeRolledBack: {
    backgroundColor: '#fef08a',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  whatText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  whyContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  whyLabel: {
    fontSize: 14,
    color: '#666',
  },
  whyText: {
    fontSize: 14,
    color: '#1a1a1a',
    flex: 1,
  },
  messageContainer: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  messageLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 14,
    color: '#1a1a1a',
    fontStyle: 'italic',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  autonomyBadge: {
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  autonomyText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4b5563',
  },
  timeText: {
    fontSize: 13,
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
  rollbackButton: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  rollbackButtonDisabled: {
    backgroundColor: '#e5e7eb',
  },
  rollbackButtonText: {
    fontSize: 14,
    color: '#4b5563',
    fontWeight: '500',
  },
});
