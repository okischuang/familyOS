/**
 * Subscription Sensor Agent
 *
 * The first standalone Domain Sensor Agent (see docs/ARCHITECTURE_MultiAgent.md,
 * Migration Step 1). It reads the family's detected subscriptions, finds the
 * ones that are idle/unused yet about to auto-renew, and writes
 * `subscription_waste` risks to `risks/` — where the existing `onRiskCreated`
 * pipeline (resolution + language actuator + veto/execution) takes over.
 *
 * Rules-based, no LLM (Constitution: rules-first — this is deterministic,
 * auditable, and free of token cost). Ported from the client-side engine at
 * app/src/services/subscriptions.ts, adapted to Firestore Timestamps.
 *
 * Coordination: choreography, not orchestration — this agent independently
 * emits risks and never talks to the other sensors directly.
 */

import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import type { Risk, RiskSeverity, Subscription } from '../types/index.js';

const db = () => getFirestore();

// ============================================
// Tunable thresholds (mirror the client engine)
// ============================================

// Not opened in this many days -> treated as unused (clear waste).
const UNUSED_DAYS = 45;
// Only surface a risk when the wasteful charge is this close.
const RENEWAL_SOON_DAYS = 7;
// Renewal within this many days -> high severity (imminent charge).
const HIGH_SEVERITY_DAYS = 2;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ============================================
// Main Detection Function
// ============================================

export interface SubscriptionDetectionResult {
  risksCreated: number;
  risksUpdated: number;
  familiesProcessed: number;
}

export async function runSubscriptionDetection(): Promise<SubscriptionDetectionResult> {
  const result: SubscriptionDetectionResult = {
    risksCreated: 0,
    risksUpdated: 0,
    familiesProcessed: 0,
  };

  const familiesSnapshot = await db().collection('familyRules').get();

  for (const doc of familiesSnapshot.docs) {
    const familyId = (doc.data() as { familyId: string }).familyId;

    try {
      const familyResult = await detectWasteForFamily(familyId);
      result.risksCreated += familyResult.created;
      result.risksUpdated += familyResult.updated;
      result.familiesProcessed++;
    } catch (error) {
      console.error(`Error detecting subscription waste for family ${familyId}:`, error);
    }
  }

  return result;
}

// ============================================
// Per-Family Detection
// ============================================

interface FamilyDetectionResult {
  created: number;
  updated: number;
}

async function detectWasteForFamily(familyId: string): Promise<FamilyDetectionResult> {
  const now = new Date();
  const result: FamilyDetectionResult = { created: 0, updated: 0 };

  const snapshot = await db()
    .collection('subscriptions')
    .where('familyId', '==', familyId)
    .get();

  for (const doc of snapshot.docs) {
    const sub = doc.data() as Subscription;

    // Only auto-renewing, non-cancelled subscriptions can leak money.
    if (sub.status === 'cancelled' || !sub.autoRenew) continue;
    if (!isUnused(sub, now)) continue;

    const untilRenewal = daysUntil(sub.nextRenewalDate.toDate(), now);
    // Skip already-past renewals and ones still far away — the system acts only
    // when the charge is imminent (Principle 3: know first, act before it).
    if (untilRenewal < 0 || untilRenewal > RENEWAL_SOON_DAYS) continue;

    const risk = buildWasteRisk(sub, now, untilRenewal);
    const saveResult = await saveRisk(risk);
    if (saveResult === 'created') result.created++;
    else if (saveResult === 'updated') result.updated++;
  }

  return result;
}

// ============================================
// Waste Assessment
// ============================================

/**
 * Unused = never used, or untouched past the threshold. The whole recurring
 * charge is money down the drain.
 */
function isUnused(sub: Subscription, now: Date): boolean {
  const idleDays = daysSince(sub.lastUsedDate?.toDate(), now);
  return sub.usagePerMonth <= 0 || (idleDays !== null && idleDays >= UNUSED_DAYS);
}

/** Charge normalized to a per-month figure so amounts are comparable. */
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

function buildWasteRisk(sub: Subscription, now: Date, untilRenewal: number): Risk {
  const monthly = toMonthlyAmount(sub);
  const idleDays = daysSince(sub.lastUsedDate?.toDate(), now);
  const reason = idleDays === null ? '從未使用過' : `已 ${idleDays} 天沒有使用`;
  const whenText = untilRenewal <= 0 ? '今天' : `${untilRenewal} 天後`;
  const description = `${sub.icon} ${sub.name}：${reason}，${formatMoney(
    monthly,
    sub.currency
  )}/月將於${whenText}自動續訂`;

  // Backend severity is binary (high | low). Treat an imminent charge as high.
  const severity: RiskSeverity = untilRenewal <= HIGH_SEVERITY_DAYS ? 'high' : 'low';

  return {
    id: `${sub.familyId}_subscription_waste_${sub.id}`,
    familyId: sub.familyId,
    type: 'subscription_waste',
    severity,
    detectedAt: Timestamp.now(),
    occurringAt: sub.nextRenewalDate, // "failure" = the wasteful charge
    context: {
      events: [], // no calendar events involved
      description,
      subscriptions: [sub.id],
    } as Risk['context'] & { subscriptions: string[] },
    status: 'pending',
    createdAt: Timestamp.now(),
  };
}

// ============================================
// Risk Persistence (idempotent per subscription)
// ============================================

type SaveResult = 'created' | 'updated' | 'skipped';

async function saveRisk(risk: Risk): Promise<SaveResult> {
  const riskRef = db().collection('risks').doc(risk.id);
  const existing = await riskRef.get();

  if (existing.exists) {
    const existingRisk = existing.data() as Risk;

    // Don't re-open a risk the family already resolved, that expired, or that
    // the arbiter merged into another resolution.
    if (
      existingRisk.status === 'resolved' ||
      existingRisk.status === 'expired' ||
      existingRisk.status === 'superseded'
    ) {
      return 'skipped';
    }

    await riskRef.update({
      detectedAt: risk.detectedAt,
      severity: risk.severity,
      occurringAt: risk.occurringAt,
      context: risk.context,
    });
    return 'updated';
  }

  await riskRef.set(risk);
  return 'created';
}

// ============================================
// Helpers
// ============================================

function daysUntil(date: Date, now: Date): number {
  return Math.ceil((date.getTime() - now.getTime()) / MS_PER_DAY);
}

function daysSince(date: Date | undefined, now: Date): number | null {
  if (!date) return null;
  return Math.floor((now.getTime() - date.getTime()) / MS_PER_DAY);
}

function formatMoney(amount: number, currency = 'TWD'): string {
  const symbol = currency === 'TWD' ? 'NT$' : '$';
  return `${symbol}${Math.round(amount).toLocaleString('en-US')}`;
}
