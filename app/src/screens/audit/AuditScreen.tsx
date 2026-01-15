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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getActionLogs,
  ActionLog,
  timestampToDate,
  formatRelativeTime,
} from '../../services/firebase-functions';

// Test family ID - in production, get from user context
const TEST_FAMILY_ID = 'test-family-001';

export default function AuditScreen() {
  const [logs, setLogs] = useState<ActionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const renderLogItem = ({ item }: { item: ActionLog }) => {
    const timestamp = timestampToDate(item.timestamp);
    const isVetoed = item.wasVetoed;

    return (
      <View style={[styles.logCard, isVetoed && styles.logCardVetoed]}>
        {/* Status Badge */}
        <View style={[styles.badge, isVetoed ? styles.badgeVetoed : styles.badgeExecuted]}>
          <Text style={styles.badgeText}>
            {isVetoed ? '已阻止' : '已執行'}
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
});
