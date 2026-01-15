import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, Alert } from '../../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function HomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadAlerts = async () => {
    // TODO: Replace with actual API call
    const mockAlerts: Alert[] = [
      {
        id: 'alert-1',
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
      },
      {
        id: 'alert-2',
        familyId: 'family-1',
        type: 'inventory_low',
        severity: 'medium',
        status: 'pending',
        title: '尿布剩2天，預計週五用完',
        description: '上次購買已10天',
        triggerTime: new Date(),
        expiryTime: new Date(),
        suggestedSolutions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    setAlerts(mockAlerts);
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAlerts();
    setRefreshing(false);
  };

  const getSeverityColor = () => {
    const hasHighSeverity = alerts.some((a) => a.severity === 'high');
    if (hasHighSeverity) return { bg: '#fee2e2', text: '#dc2626', label: '高風險' };
    const hasMediumSeverity = alerts.some((a) => a.severity === 'medium');
    if (hasMediumSeverity) return { bg: '#fef3c7', text: '#d97706', label: '需注意' };
    return { bg: '#dcfce7', text: '#16a34a', label: '一切安好' };
  };

  const statusStyle = getSeverityColor();
  const pendingAlerts = alerts.filter((a) => a.status === 'pending');

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.dateText}>
          Today · {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit' })}
        </Text>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>家庭狀態：</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.statusText, { color: statusStyle.text }]}>
              {statusStyle.label}
            </Text>
          </View>
        </View>
      </View>

      {pendingAlerts.length > 0 ? (
        <>
          <View style={styles.warningBanner}>
            <Text style={styles.warningText}>
              ⚠️ {pendingAlerts.length}件事需要處理
            </Text>
          </View>

          <View style={styles.alertsList}>
            {pendingAlerts.map((alert, index) => (
              <TouchableOpacity
                key={alert.id}
                style={styles.alertCard}
                onPress={() => navigation.navigate('AlertDetail', { alertId: alert.id })}
              >
                <Text style={styles.alertTitle}>
                  {index + 1}. {alert.title}
                </Text>
                <Text style={styles.alertReason}>原因：{alert.description}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={styles.ctaButton}
            onPress={() => {
              if (pendingAlerts.length > 0) {
                navigation.navigate('AlertDetail', { alertId: pendingAlerts[0].id });
              }
            }}
          >
            <Text style={styles.ctaButtonText}>👉 查看建議解法</Text>
          </TouchableOpacity>
        </>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateIcon}>🎉</Text>
          <Text style={styles.emptyStateTitle}>太棒了！</Text>
          <Text style={styles.emptyStateText}>目前沒有需要處理的事項</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    borderStyle: 'dashed',
  },
  dateText: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 18,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontWeight: '600',
    fontSize: 14,
  },
  warningBanner: {
    backgroundColor: '#fef3c7',
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
    padding: 12,
    margin: 16,
    marginBottom: 0,
  },
  warningText: {
    fontWeight: '600',
    color: '#92400e',
  },
  alertsList: {
    padding: 16,
    gap: 12,
  },
  alertCard: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
  },
  alertTitle: {
    fontWeight: '500',
    fontSize: 14,
    marginBottom: 4,
  },
  alertReason: {
    fontSize: 12,
    color: '#6b7280',
  },
  ctaButton: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    margin: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  ctaButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    padding: 48,
    alignItems: 'center',
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6b7280',
  },
});
