/**
 * Subscription Action Screen
 *
 * The veto surface for a single subscription. The system has already decided
 * what should happen (cancel the idle/unused service before it renews) and
 * pre-drafted it. The human's only job is to let it proceed or stop it —
 * Constitution Principle 1 (human as exception handler) and Principle 4
 * (automation is action, not a reminder).
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types';
import { MOCK_SUBSCRIPTIONS } from '../../data/subscriptions';
import {
  assessUsage,
  toMonthlyAmount,
  toYearlyAmount,
  daysUntil,
  daysSince,
  formatMoney,
  CATEGORY_LABELS,
} from '../../services/subscriptions';

type Props = NativeStackScreenProps<RootStackParamList, 'SubscriptionAction'>;

type Decision = 'pending' | 'kept' | 'cancelled';

export default function SubscriptionActionScreen({ route, navigation }: Props) {
  const { subscriptionId } = route.params;
  const [decision, setDecision] = useState<Decision>('pending');

  const sub = useMemo(
    () => MOCK_SUBSCRIPTIONS.find((s) => s.id === subscriptionId),
    [subscriptionId]
  );

  if (!sub) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>找不到這個訂閱</Text>
        </View>
      </SafeAreaView>
    );
  }

  const assessment = assessUsage(sub);
  const monthly = toMonthlyAmount(sub);
  const yearly = toYearlyAmount(sub);
  const untilRenewal = daysUntil(sub.nextRenewalDate);
  const idleDays = daysSince(sub.lastUsedDate);
  const isWaste = assessment.status === 'unused' || assessment.status === 'idle';

  const renderDecisionResult = () => {
    if (decision === 'cancelled') {
      return (
        <View style={[styles.resultBox, styles.resultCancelled]}>
          <Text style={styles.resultIcon}>✅</Text>
          <Text style={styles.resultTitle}>已排定取消 {sub.name}</Text>
          <Text style={styles.resultText}>
            系統會在 {untilRenewal <= 0 ? '今天' : `${untilRenewal} 天後續訂前`}停止扣款，
            一年為你省下 {formatMoney(yearly)}。行動已記錄在「行動紀錄」。
          </Text>
        </View>
      );
    }
    return (
      <View style={[styles.resultBox, styles.resultKept]}>
        <Text style={styles.resultIcon}>👍</Text>
        <Text style={styles.resultTitle}>已保留 {sub.name}</Text>
        <Text style={styles.resultText}>
          了解，系統不會取消它。之後若持續閒置，會再提醒你一次。
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.icon}>{sub.icon}</Text>
          <Text style={styles.name}>{sub.name}</Text>
          <Text style={styles.category}>{CATEGORY_LABELS[sub.category]}</Text>
        </View>

        {/* System verdict */}
        {isWaste && (
          <View style={styles.verdictBox}>
            <Text style={styles.verdictLabel}>系統判斷</Text>
            <Text style={styles.verdictTitle}>
              {assessment.status === 'unused' ? '這是閒置浪費' : '使用率偏低'}
            </Text>
            <Text style={styles.verdictReason}>{assessment.reason}</Text>
          </View>
        )}

        {/* Facts grid */}
        <View style={styles.factsGrid}>
          <View style={styles.factCell}>
            <Text style={styles.factValue}>{formatMoney(monthly)}</Text>
            <Text style={styles.factLabel}>每月費用</Text>
          </View>
          <View style={styles.factCell}>
            <Text style={styles.factValue}>{formatMoney(yearly)}</Text>
            <Text style={styles.factLabel}>年度費用</Text>
          </View>
          <View style={styles.factCell}>
            <Text style={styles.factValue}>
              {idleDays === null ? '從未' : `${idleDays} 天`}
            </Text>
            <Text style={styles.factLabel}>上次使用</Text>
          </View>
          <View style={styles.factCell}>
            <Text style={styles.factValue}>
              {untilRenewal <= 0 ? '今天' : `${untilRenewal} 天`}
            </Text>
            <Text style={styles.factLabel}>距離續訂</Text>
          </View>
          <View style={styles.factCell}>
            <Text style={styles.factValue}>{sub.usagePerMonth} 次</Text>
            <Text style={styles.factLabel}>每月使用</Text>
          </View>
          <View style={styles.factCell}>
            <Text style={styles.factValue}>{sub.sharedWith?.length ?? 1} 人</Text>
            <Text style={styles.factLabel}>共用人數</Text>
          </View>
        </View>

        {/* Consequence */}
        {isWaste && (
          <View style={styles.consequenceBox}>
            <Text style={styles.consequenceLabel}>如果不處理：</Text>
            <Text style={styles.consequenceText}>
              {untilRenewal <= 0 ? '今天' : `${untilRenewal} 天後`}會再自動扣款{' '}
              {formatMoney(monthly)}，一年累積浪費 {formatMoney(yearly)}。
            </Text>
          </View>
        )}

        {decision !== 'pending' && renderDecisionResult()}
      </ScrollView>

      {/* Veto bar — system's default action is cancel; user can stop it. */}
      {decision === 'pending' && (
        <View style={styles.actionBar}>
          {isWaste ? (
            <>
              <TouchableOpacity
                style={styles.primaryButton}
                activeOpacity={0.8}
                onPress={() => setDecision('cancelled')}
              >
                <Text style={styles.primaryButtonText}>
                  取消訂閱，省 {formatMoney(yearly)}/年
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                activeOpacity={0.8}
                onPress={() => setDecision('kept')}
              >
                <Text style={styles.secondaryButtonText}>我還要用，保留</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={styles.secondaryButton}
              activeOpacity={0.8}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.secondaryButtonText}>這個訂閱很值得，返回</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {decision !== 'pending' && (
        <View style={styles.actionBar}>
          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.8}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.primaryButtonText}>完成</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 20,
    paddingBottom: 24,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#6b7280',
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  icon: {
    fontSize: 56,
    marginBottom: 8,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  category: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 4,
  },
  verdictBox: {
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  verdictLabel: {
    fontSize: 12,
    color: '#991b1b',
    marginBottom: 4,
  },
  verdictTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#dc2626',
    marginBottom: 4,
  },
  verdictReason: {
    fontSize: 14,
    color: '#7f1d1d',
    lineHeight: 20,
  },
  factsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
    marginBottom: 16,
  },
  factCell: {
    width: '33.333%',
    padding: 14,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#f3f4f6',
  },
  factValue: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  factLabel: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 4,
  },
  consequenceBox: {
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  consequenceLabel: {
    fontSize: 12,
    color: '#92400e',
    marginBottom: 4,
  },
  consequenceText: {
    fontSize: 14,
    color: '#78350f',
    lineHeight: 20,
  },
  resultBox: {
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginTop: 16,
  },
  resultCancelled: {
    backgroundColor: '#f0fdf4',
  },
  resultKept: {
    backgroundColor: '#f9fafb',
  },
  resultIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 6,
    textAlign: 'center',
  },
  resultText: {
    fontSize: 14,
    color: '#4b5563',
    textAlign: 'center',
    lineHeight: 20,
  },
  actionBar: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 10,
  },
  primaryButton: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#f3f4f6',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#4b5563',
    fontSize: 15,
    fontWeight: '600',
  },
});
