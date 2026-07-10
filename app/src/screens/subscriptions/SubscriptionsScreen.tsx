/**
 * Subscriptions Screen — 訂閱管家
 *
 * The family's money-leak dashboard. It answers the three pains directly:
 *   1. 忘記有什麼服務  -> one list, one monthly total
 *   2. 是否有浪費      -> waste banner + per-item status
 *   3. 優化預算        -> ranked saving actions the user only has to approve
 *
 * Per the Constitution this is not a passive ledger to "check". The system has
 * already found the leaks and priced the fix; each waste item taps through to a
 * pre-drafted cancellation the human can veto.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList, Subscription } from '../../types';
import { MOCK_SUBSCRIPTIONS } from '../../data/subscriptions';
import {
  assessUsage,
  summarize,
  getOptimizations,
  toMonthlyAmount,
  daysUntil,
  formatMoney,
  CATEGORY_LABELS,
} from '../../services/subscriptions';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const STATUS_META: Record<
  Subscription['status'],
  { label: string; bg: string; text: string }
> = {
  active: { label: '使用中', bg: '#dcfce7', text: '#16a34a' },
  idle: { label: '使用率低', bg: '#fef3c7', text: '#d97706' },
  unused: { label: '閒置浪費', bg: '#fee2e2', text: '#dc2626' },
  cancelled: { label: '已取消', bg: '#f3f4f6', text: '#6b7280' },
};

export default function SubscriptionsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>(MOCK_SUBSCRIPTIONS);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // In production this re-syncs from bank / email / app-store detectors.
    await new Promise((resolve) => setTimeout(resolve, 500));
    setSubscriptions(MOCK_SUBSCRIPTIONS);
    setRefreshing(false);
  }, []);

  const summary = useMemo(() => summarize(subscriptions), [subscriptions]);
  const optimizations = useMemo(() => getOptimizations(subscriptions), [subscriptions]);

  // Sort the list so the money leaks sit at the top.
  const orderedSubs = useMemo(() => {
    const rank: Record<Subscription['status'], number> = {
      unused: 0,
      idle: 1,
      active: 2,
      cancelled: 3,
    };
    return [...subscriptions]
      .filter((s) => s.status !== 'cancelled')
      .map((s) => ({ sub: s, assessment: assessUsage(s) }))
      .sort((a, b) => {
        const ra = rank[a.assessment.status];
        const rb = rank[b.assessment.status];
        if (ra !== rb) return ra - rb;
        return toMonthlyAmount(b.sub) - toMonthlyAmount(a.sub);
      });
  }, [subscriptions]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Monthly spend hero */}
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>本月訂閱總支出</Text>
          <Text style={styles.heroAmount}>{formatMoney(summary.totalMonthly)}</Text>
          <Text style={styles.heroSub}>
            {summary.activeCount} 個服務 · 一年約 {formatMoney(summary.totalYearly)}
          </Text>

          {summary.wastedMonthly > 0 && (
            <View style={styles.wasteBanner}>
              <Text style={styles.wasteBannerTitle}>
                💸 偵測到 {formatMoney(summary.wastedMonthly)}/月 可能被浪費
              </Text>
              <Text style={styles.wasteBannerSub}>
                {summary.wastedCount} 個閒置訂閱 · 一年可省 {formatMoney(summary.wastedYearly)}
              </Text>
            </View>
          )}
        </View>

        {/* Category breakdown */}
        {summary.byCategory.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>支出分佈</Text>
            {summary.byCategory.map((cat) => {
              const pct =
                summary.totalMonthly > 0
                  ? Math.round((cat.monthly / summary.totalMonthly) * 100)
                  : 0;
              return (
                <View key={cat.category} style={styles.catRow}>
                  <View style={styles.catHeader}>
                    <Text style={styles.catLabel}>{cat.label}</Text>
                    <Text style={styles.catAmount}>
                      {formatMoney(cat.monthly)}/月 · {pct}%
                    </Text>
                  </View>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${pct}%` }]} />
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Optimization actions */}
        {optimizations.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>系統建議的省錢行動</Text>
            <Text style={styles.sectionHint}>
              點一下即可檢視，系統已擬好方案，你只需否決或放行。
            </Text>
            {optimizations.slice(0, 5).map((opt) => (
              <TouchableOpacity
                key={opt.id}
                style={styles.optCard}
                activeOpacity={0.7}
                disabled={opt.subscriptionIds.length !== 1}
                onPress={() => {
                  if (opt.subscriptionIds.length === 1) {
                    navigation.navigate('SubscriptionAction', {
                      subscriptionId: opt.subscriptionIds[0],
                    });
                  }
                }}
              >
                <View style={styles.optHeader}>
                  <Text style={styles.optTitle}>{opt.title}</Text>
                  <Text style={styles.optSaving}>省 {formatMoney(opt.yearlySaving)}/年</Text>
                </View>
                <Text style={styles.optDetail}>{opt.detail}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Full subscription inventory */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>所有訂閱</Text>
          {orderedSubs.map(({ sub, assessment }) => {
            const meta = STATUS_META[assessment.status];
            const untilRenewal = daysUntil(sub.nextRenewalDate);
            const cancelable = assessment.status === 'unused' || assessment.status === 'idle';
            return (
              <TouchableOpacity
                key={sub.id}
                style={styles.subCard}
                activeOpacity={0.7}
                onPress={() =>
                  navigation.navigate('SubscriptionAction', { subscriptionId: sub.id })
                }
              >
                <View style={styles.subLeft}>
                  <Text style={styles.subIcon}>{sub.icon}</Text>
                </View>
                <View style={styles.subMiddle}>
                  <Text style={styles.subName}>{sub.name}</Text>
                  <Text style={styles.subMeta}>
                    {CATEGORY_LABELS[sub.category]} · {untilRenewal <= 0 ? '今日續訂' : `${untilRenewal} 天後續訂`}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
                    <Text style={[styles.statusText, { color: meta.text }]}>{meta.label}</Text>
                  </View>
                </View>
                <View style={styles.subRight}>
                  <Text style={styles.subPrice}>{formatMoney(toMonthlyAmount(sub))}</Text>
                  <Text style={styles.subPriceUnit}>/月</Text>
                  {cancelable && <Text style={styles.subChevron}>檢視 ›</Text>}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.footerNote}>
          訂閱由帳單、電子郵件與 App Store 自動偵測，無需手動輸入。
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  hero: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  heroLabel: {
    color: '#9ca3af',
    fontSize: 13,
    marginBottom: 6,
  },
  heroAmount: {
    color: '#fff',
    fontSize: 38,
    fontWeight: '700',
  },
  heroSub: {
    color: '#d1d5db',
    fontSize: 13,
    marginTop: 4,
  },
  wasteBanner: {
    backgroundColor: 'rgba(220,38,38,0.15)',
    borderRadius: 10,
    padding: 12,
    marginTop: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#ef4444',
  },
  wasteBannerTitle: {
    color: '#fca5a5',
    fontWeight: '700',
    fontSize: 15,
  },
  wasteBannerSub: {
    color: '#fca5a5',
    fontSize: 12,
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  sectionHint: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 12,
  },
  catRow: {
    marginBottom: 12,
  },
  catHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  catLabel: {
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  catAmount: {
    fontSize: 13,
    color: '#6b7280',
  },
  barTrack: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: 8,
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
  },
  optCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  optHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  optTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    flex: 1,
    marginRight: 8,
  },
  optSaving: {
    fontSize: 14,
    fontWeight: '700',
    color: '#16a34a',
  },
  optDetail: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
  subCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  subLeft: {
    marginRight: 12,
  },
  subIcon: {
    fontSize: 30,
  },
  subMiddle: {
    flex: 1,
  },
  subName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  subMeta: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
    marginBottom: 6,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  subRight: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  subPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  subPriceUnit: {
    fontSize: 11,
    color: '#9ca3af',
  },
  subChevron: {
    fontSize: 12,
    color: '#dc2626',
    marginTop: 6,
    fontWeight: '600',
  },
  footerNote: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 16,
    lineHeight: 18,
  },
});
