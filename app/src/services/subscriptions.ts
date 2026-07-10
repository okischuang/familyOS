/**
 * Subscription intelligence engine.
 *
 * Pure, side-effect-free functions that turn a list of detected subscriptions
 * into the three things the user actually asked for:
 *
 *   1. 忘記有什麼服務正在訂閱  -> a single normalized inventory + monthly total
 *   2. 是否有浪費沒在使用      -> waste classification from usage signals
 *   3. 優化每月預算            -> concrete, ranked saving actions
 *
 * Everything here is derived, not stored, so the UI can never drift out of
 * sync with the raw subscription data.
 */

import type {
  Subscription,
  SubscriptionStatus,
  SubscriptionOptimization,
  Alert,
} from '../types';

// --- Tunable thresholds ----------------------------------------------------

// Not opened in this many days -> treated as unused (clear waste).
const UNUSED_DAYS = 45;
// Cost per single use above this (in monthly-normalized TWD) -> underused.
const IDLE_COST_PER_USE = 120;
// Renewal within this window is "imminent" — the system must act before it.
const RENEWAL_SOON_DAYS = 7;
// Roughly how many monthly payments a yearly plan typically saves.
const YEARLY_PLAN_FREE_MONTHS = 2;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// --- Normalization ---------------------------------------------------------

/** Charge normalized to a per-month figure so everything is comparable. */
export function toMonthlyAmount(sub: Subscription): number {
  switch (sub.billingCycle) {
    case 'weekly':
      return (sub.amount * 52) / 12;
    case 'monthly':
      return sub.amount;
    case 'quarterly':
      return sub.amount / 3;
    case 'yearly':
      return sub.amount / 12;
    default:
      return sub.amount;
  }
}

export function toYearlyAmount(sub: Subscription): number {
  return toMonthlyAmount(sub) * 12;
}

/** Whole days from now until the given date (negative if already past). */
export function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / MS_PER_DAY);
}

/** Whole days since the given date, or null if never. */
export function daysSince(date?: Date): number | null {
  if (!date) return null;
  return Math.floor((Date.now() - date.getTime()) / MS_PER_DAY);
}

export function formatMoney(amount: number, currency = 'TWD'): string {
  const rounded = Math.round(amount);
  const symbol = currency === 'TWD' ? 'NT$' : '$';
  return `${symbol}${rounded.toLocaleString('en-US')}`;
}

// --- Waste classification --------------------------------------------------

export interface UsageAssessment {
  status: SubscriptionStatus;
  reason: string;
  // Monthly money considered recoverable if this were cancelled.
  recoverableMonthly: number;
  costPerUse: number | null;
}

/**
 * Decide, from usage signals alone, whether a subscription is pulling its
 * weight. Cancelled subscriptions are passed through untouched.
 */
export function assessUsage(sub: Subscription): UsageAssessment {
  const monthly = toMonthlyAmount(sub);

  if (sub.status === 'cancelled') {
    return { status: 'cancelled', reason: '已取消', recoverableMonthly: 0, costPerUse: null };
  }

  const idleDays = daysSince(sub.lastUsedDate);
  const costPerUse = sub.usagePerMonth > 0 ? monthly / sub.usagePerMonth : null;

  // Unused: never used, or untouched past the threshold. The whole charge is
  // money down the drain.
  if (sub.usagePerMonth <= 0 || (idleDays !== null && idleDays >= UNUSED_DAYS)) {
    const reason =
      idleDays === null
        ? '從未使用過'
        : `已 ${idleDays} 天沒有使用`;
    return { status: 'unused', reason, recoverableMonthly: monthly, costPerUse };
  }

  // Idle: still opened occasionally, but each use costs a lot — a candidate to
  // cancel or downgrade.
  if (costPerUse !== null && costPerUse >= IDLE_COST_PER_USE) {
    return {
      status: 'idle',
      reason: `每月僅使用 ${sub.usagePerMonth} 次，單次成本 ${formatMoney(costPerUse)}`,
      recoverableMonthly: monthly,
      costPerUse,
    };
  }

  return {
    status: 'active',
    reason: `每月使用約 ${sub.usagePerMonth} 次，物有所值`,
    recoverableMonthly: 0,
    costPerUse,
  };
}

/** Convenience: recompute the live status for a subscription. */
export function liveStatus(sub: Subscription): SubscriptionStatus {
  return assessUsage(sub).status;
}

// --- Portfolio summary -----------------------------------------------------

export interface CategoryBreakdown {
  category: Subscription['category'];
  label: string;
  monthly: number;
  count: number;
}

export interface SubscriptionSummary {
  totalMonthly: number;
  totalYearly: number;
  activeCount: number;
  wastedMonthly: number;
  wastedYearly: number;
  wastedCount: number;
  byCategory: CategoryBreakdown[];
}

export const CATEGORY_LABELS: Record<Subscription['category'], string> = {
  streaming: '影音串流',
  music: '音樂',
  productivity: '生產力',
  cloud: '雲端儲存',
  fitness: '健身運動',
  news: '新聞雜誌',
  gaming: '遊戲',
  education: '學習教育',
  other: '其他',
};

export function summarize(subs: Subscription[]): SubscriptionSummary {
  const live = subs.filter((s) => s.status !== 'cancelled');

  let totalMonthly = 0;
  let wastedMonthly = 0;
  let wastedCount = 0;
  const catMap = new Map<Subscription['category'], CategoryBreakdown>();

  for (const sub of live) {
    const monthly = toMonthlyAmount(sub);
    totalMonthly += monthly;

    const assessment = assessUsage(sub);
    if (assessment.recoverableMonthly > 0) {
      wastedMonthly += assessment.recoverableMonthly;
      wastedCount += 1;
    }

    const existing = catMap.get(sub.category);
    if (existing) {
      existing.monthly += monthly;
      existing.count += 1;
    } else {
      catMap.set(sub.category, {
        category: sub.category,
        label: CATEGORY_LABELS[sub.category],
        monthly,
        count: 1,
      });
    }
  }

  const byCategory = Array.from(catMap.values()).sort((a, b) => b.monthly - a.monthly);

  return {
    totalMonthly,
    totalYearly: totalMonthly * 12,
    activeCount: live.length,
    wastedMonthly,
    wastedYearly: wastedMonthly * 12,
    wastedCount,
    byCategory,
  };
}

// --- Budget optimizations --------------------------------------------------

/**
 * Produce concrete, ranked money-saving moves. Ordered by yearly saving so the
 * biggest wins surface first. The user vetoes; they never hunt for these.
 */
export function getOptimizations(subs: Subscription[]): SubscriptionOptimization[] {
  const live = subs.filter((s) => s.status !== 'cancelled');
  const opts: SubscriptionOptimization[] = [];

  // 1. Unused & idle subscriptions -> cancel.
  for (const sub of live) {
    const a = assessUsage(sub);
    if (a.status === 'unused') {
      const monthly = a.recoverableMonthly;
      opts.push({
        id: `opt-cancel-${sub.id}`,
        type: 'cancel_unused',
        title: `取消 ${sub.name}`,
        detail: `${a.reason}，但仍持續扣款。取消即可停止浪費。`,
        monthlySaving: monthly,
        yearlySaving: monthly * 12,
        subscriptionIds: [sub.id],
        severity: 'high',
      });
    } else if (a.status === 'idle') {
      const monthly = a.recoverableMonthly;
      opts.push({
        id: `opt-idle-${sub.id}`,
        type: 'cancel_idle',
        title: `檢視 ${sub.name}`,
        detail: `${a.reason}，使用率偏低，建議取消或降級方案。`,
        monthlySaving: monthly,
        yearlySaving: monthly * 12,
        subscriptionIds: [sub.id],
        severity: 'medium',
      });
    }
  }

  // 2. Duplicate categories -> consolidate (only where the user actively uses
  //    more than one service of the same kind).
  const byCat = new Map<Subscription['category'], Subscription[]>();
  for (const sub of live) {
    if (assessUsage(sub).status === 'active') {
      const arr = byCat.get(sub.category) ?? [];
      arr.push(sub);
      byCat.set(sub.category, arr);
    }
  }
  for (const [category, group] of byCat) {
    if (group.length < 2) continue;
    // Saving = drop the cheapest of the overlapping services.
    const sorted = [...group].sort((a, b) => toMonthlyAmount(a) - toMonthlyAmount(b));
    const cheapest = sorted[0];
    const monthly = toMonthlyAmount(cheapest);
    opts.push({
      id: `opt-dup-${category}`,
      type: 'duplicate',
      title: `${CATEGORY_LABELS[category]}有 ${group.length} 個重複訂閱`,
      detail: `${group.map((s) => s.name).join('、')} 功能重疊，整合後可省下最低一項。`,
      monthlySaving: monthly,
      yearlySaving: monthly * 12,
      subscriptionIds: group.map((s) => s.id),
      severity: 'medium',
    });
  }

  // 3. Active monthly plans that would be cheaper billed yearly.
  for (const sub of live) {
    if (sub.billingCycle !== 'monthly') continue;
    if (assessUsage(sub).status !== 'active') continue;
    const yearlySaving = sub.amount * YEARLY_PLAN_FREE_MONTHS;
    opts.push({
      id: `opt-yearly-${sub.id}`,
      type: 'switch_yearly',
      title: `${sub.name} 改為年繳`,
      detail: `你長期在用，改年繳通常省下約 ${YEARLY_PLAN_FREE_MONTHS} 個月費用。`,
      monthlySaving: yearlySaving / 12,
      yearlySaving,
      subscriptionIds: [sub.id],
      severity: 'low',
    });
  }

  const severityRank = { high: 0, medium: 1, low: 2 } as const;
  return opts.sort((a, b) => {
    if (severityRank[a.severity] !== severityRank[b.severity]) {
      return severityRank[a.severity] - severityRank[b.severity];
    }
    return b.yearlySaving - a.yearlySaving;
  });
}

// --- Risk alerts (Home feed) ----------------------------------------------

/**
 * Turn imminent-renewal waste into forward-looking risk Alerts, so an unused
 * subscription surfaces in the family risk feed *before* it charges again —
 * the system knows first and can act, rather than the user finding the charge
 * on next month's statement.
 */
export function generateSubscriptionAlerts(subs: Subscription[]): Alert[] {
  const now = new Date();
  const alerts: Alert[] = [];

  for (const sub of subs) {
    if (sub.status === 'cancelled' || !sub.autoRenew) continue;

    const assessment = assessUsage(sub);
    if (assessment.status !== 'unused') continue;

    const untilRenewal = daysUntil(sub.nextRenewalDate);
    if (untilRenewal < 0 || untilRenewal > RENEWAL_SOON_DAYS) continue;

    const monthly = assessment.recoverableMonthly;
    alerts.push({
      id: `alert-sub-${sub.id}`,
      familyId: sub.familyId,
      type: 'subscription_waste',
      severity: 'medium',
      status: 'pending',
      title: `${sub.icon} ${sub.name} ${untilRenewal} 天後自動續訂`,
      description: `${assessment.reason}，${formatMoney(monthly)}/月將白白扣款`,
      triggerTime: now,
      expiryTime: sub.nextRenewalDate,
      relatedSubscriptionIds: [sub.id],
      suggestedSolutions: [],
      createdAt: now,
      updatedAt: now,
    });
  }

  return alerts;
}
