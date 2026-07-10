/**
 * Autonomy Governor Agent
 *
 * Migration Step 3 (docs/ARCHITECTURE_MultiAgent.md). The cross-cutting
 * governance layer: it owns the L0-L4 Autonomy Ladder and the trust metrics
 * that gate it. Extracted out of resolution/ so that "decide how much autonomy"
 * is a single responsibility separate from "plan the resolution".
 *
 * Per-agent x per-task trust: trust is tracked PER task category, keyed
 * `${familyId}_${category}`. A bad week for the Subscription Sensor Agent must
 * not demote the Schedule Agent — each category climbs (or falls down) the
 * ladder independently. This directly addresses the "cross-agent trust
 * interference" open question in the architecture doc.
 *
 * Trust formula (from the Autonomy Ladder doc): promotion is a function of
 * accuracy x predictability x reversibility, observed via success rate and veto
 * behavior. This module is the only writer of `trustMetrics`.
 */

import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import type {
  Risk,
  Resolution,
  TrustMetrics,
  AutonomyLevel,
  L4CheckResult,
  RiskType,
  TaskCategory,
} from '../types/index.js';

const db = () => getFirestore();

// ============================================
// Task categories
// ============================================

export function taskCategoryForRisk(type: RiskType): TaskCategory {
  switch (type) {
    case 'pickup_conflict':
    case 'pickup_handoff':
      return 'pickup';
    case 'schedule_overlap':
    case 'deadline_miss':
      return 'schedule';
    case 'subscription_waste':
      return 'subscription';
    default:
      return 'other';
  }
}

// Which categories may ever reach L4 (act autonomously without a veto wait).
// Subscription cancellation stays suggest/approve for now — money decisions
// keep a human in the loop.
const L4_ALLOWED_CATEGORIES: TaskCategory[] = ['pickup', 'schedule'];

function metricsId(familyId: string, category: TaskCategory): string {
  return `${familyId}_${category}`;
}

// ============================================
// Autonomy decision
// ============================================

/**
 * Decide the autonomy level for handling a risk, based on the family's earned
 * trust in that risk's task category.
 */
export async function decideAutonomyLevel(risk: Risk): Promise<AutonomyLevel> {
  const category = taskCategoryForRisk(risk.type);
  const metrics = await getTrustMetrics(risk.familyId, category);

  // No trust history for this category = start cautious at L2.
  if (!metrics) return 'L2';

  if (checkL4Eligibility(category, metrics).eligible) return 'L4';

  // L3 has a lower bar than L4.
  if (metrics.successRate >= 0.7 && metrics.recentVetoCount <= 3) return 'L3';

  return 'L2';
}

export function checkL4Eligibility(
  category: TaskCategory,
  metrics: TrustMetrics
): L4CheckResult {
  const reasons: string[] = [];
  let eligible = true;

  if (metrics.successRate < 0.9) {
    eligible = false;
    reasons.push(`Success rate ${(metrics.successRate * 100).toFixed(0)}% < 90%`);
  }

  if (metrics.recentVetoCount >= 2) {
    eligible = false;
    reasons.push(`Recent vetos ${metrics.recentVetoCount} >= 2`);
  }

  if (!L4_ALLOWED_CATEGORIES.includes(category)) {
    eligible = false;
    reasons.push(`Task category "${category}" not allowed for L4`);
  }

  if (eligible) {
    reasons.push('All L4 conditions met');
  }

  return { eligible, reasons };
}

// ============================================
// Outcome feedback (the only writer of trustMetrics)
// ============================================

/**
 * Record the outcome of a resolution against its category's ladder. Executed
 * without veto raises trust; a veto lowers it — which can demote the next
 * autonomy level for that category only.
 */
export async function recordOutcome(
  resolution: Resolution,
  risk: Risk,
  wasVetoed: boolean
): Promise<void> {
  const category = taskCategoryForRisk(risk.type);
  const docId = metricsId(resolution.familyId, category);
  const metricsRef = db().collection('trustMetrics').doc(docId);
  const doc = await metricsRef.get();

  if (!doc.exists) {
    const newMetrics: TrustMetrics = {
      userId: docId,
      familyId: resolution.familyId,
      taskCategory: category,
      totalActions: 1,
      executedActions: wasVetoed ? 0 : 1,
      vetoedActions: wasVetoed ? 1 : 0,
      successRate: wasVetoed ? 0 : 1,
      recentVetoCount: wasVetoed ? 1 : 0,
      currentAutonomyLevel: 'L2',
      l4Eligible: false,
      lastUpdated: Timestamp.now(),
    };
    await metricsRef.set(newMetrics);
    return;
  }

  const metrics = doc.data() as TrustMetrics;

  metrics.totalActions++;
  if (wasVetoed) {
    metrics.vetoedActions++;
    metrics.recentVetoCount = Math.min(metrics.recentVetoCount + 1, 10);
  } else {
    metrics.executedActions++;
    // Decay recent veto count on success.
    metrics.recentVetoCount = Math.max(0, metrics.recentVetoCount - 0.5);
  }

  metrics.successRate = metrics.executedActions / metrics.totalActions;
  metrics.l4Eligible =
    metrics.successRate >= 0.9 &&
    metrics.recentVetoCount < 2 &&
    L4_ALLOWED_CATEGORIES.includes(category);

  if (metrics.l4Eligible) {
    metrics.currentAutonomyLevel = 'L4';
  } else if (metrics.successRate >= 0.7) {
    metrics.currentAutonomyLevel = 'L3';
  } else {
    metrics.currentAutonomyLevel = 'L2';
  }

  metrics.lastUpdated = Timestamp.now();

  await metricsRef.update({
    totalActions: metrics.totalActions,
    executedActions: metrics.executedActions,
    vetoedActions: metrics.vetoedActions,
    successRate: metrics.successRate,
    recentVetoCount: metrics.recentVetoCount,
    currentAutonomyLevel: metrics.currentAutonomyLevel,
    l4Eligible: metrics.l4Eligible,
    lastUpdated: metrics.lastUpdated,
  });
}

// ============================================
// Helpers
// ============================================

async function getTrustMetrics(
  familyId: string,
  category: TaskCategory
): Promise<TrustMetrics | null> {
  const doc = await db().collection('trustMetrics').doc(metricsId(familyId, category)).get();
  return doc.exists ? (doc.data() as TrustMetrics) : null;
}
