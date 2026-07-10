/**
 * Risk Arbiter Agent
 *
 * Migration Step 2 (docs/ARCHITECTURE_MultiAgent.md). The perception-layer
 * sensor agents each write to `risks/` independently (choreography), which
 * means two agents can flag risks describing the same underlying situation.
 * The arbiter sits in front of resolution creation and converges them, so the
 * family gets ONE coordinated response, not several — the mechanical
 * enforcement of Constitution Principle 4 (a barrage of notifications is a
 * failure mode).
 *
 * Scope of THIS step (deliberately conservative):
 *   - Deduplicate: if a new risk shares its subject with a risk that already
 *     has an active (scheduled) resolution, suppress the new one.
 *   - Rank: order pending risks by severity then imminence.
 *
 * Explicitly deferred (see the architecture doc's Open Questions): cross-domain
 * *contention* weighting — e.g. a Savings "cancel the gym" risk vs a future
 * Health "keep the gym" risk. Deciding whose priority wins needs a family-value
 * policy that is not designed yet, so the arbiter does NOT weigh competing
 * claims across domains here; it only converges risks about the *same* subject.
 *
 * Known limitation: suppression is terminal for now. If the covering
 * resolution is later vetoed, the superseded risk is not automatically revived
 * — it would be re-surfaced only by a fresh detection producing a new risk.
 * Reviving superseded risks on veto is future work (tracked with Step 3).
 */

import { getFirestore } from 'firebase-admin/firestore';
import type { Risk } from '../types/index.js';
import { getScheduledResolutions } from '../resolution/index.js';

const db = () => getFirestore();

// ============================================
// Arbitration
// ============================================

export interface ArbitrationDecision {
  action: 'resolve' | 'suppress';
  reason: string;
  supersededByResolution?: string;
  supersededByRisk?: string;
}

/**
 * Decide whether a freshly-created risk should get its own resolution, or be
 * suppressed because an active resolution already covers the same subject.
 */
export async function arbitrate(risk: Risk): Promise<ArbitrationDecision> {
  const activeResolutions = await getScheduledResolutions(risk.familyId);

  for (const resolution of activeResolutions) {
    if (resolution.riskId === risk.id) continue; // don't compare against itself

    const otherRisk = await getRiskById(resolution.riskId);
    if (!otherRisk) continue;

    if (sharesSubject(risk, otherRisk)) {
      return {
        action: 'suppress',
        reason: `Same subject as active resolution ${resolution.id} (risk ${otherRisk.id}, type ${otherRisk.type})`,
        supersededByResolution: resolution.id,
        supersededByRisk: otherRisk.id,
      };
    }
  }

  return { action: 'resolve', reason: 'No active resolution covers this subject' };
}

/**
 * Two risks share a subject when they point at the same underlying thing:
 * the same subscription, or overlapping calendar events. This is intentionally
 * strict — it converges genuine duplicates, not merely same-day risks.
 */
export function sharesSubject(a: Risk, b: Risk): boolean {
  // Subscription risks carry the subscription id(s) in context.subscriptions.
  const aSubs = getSubscriptionIds(a);
  const bSubs = getSubscriptionIds(b);
  if (aSubs.length && bSubs.length && aSubs.some((id) => bSubs.includes(id))) {
    return true;
  }

  // Schedule risks carry related calendar event ids in context.events.
  const aEvents = a.context.events ?? [];
  const bEvents = b.context.events ?? [];
  if (aEvents.length && bEvents.length && aEvents.some((id) => bEvents.includes(id))) {
    return true;
  }

  return false;
}

function getSubscriptionIds(risk: Risk): string[] {
  const context = risk.context as Risk['context'] & { subscriptions?: string[] };
  return context.subscriptions ?? [];
}

/**
 * Mark a risk as merged into another active resolution.
 */
export async function markSuperseded(
  riskId: string,
  decision: ArbitrationDecision
): Promise<void> {
  await db().collection('risks').doc(riskId).update({
    status: 'superseded',
    supersededByResolution: decision.supersededByResolution ?? null,
    supersededByRisk: decision.supersededByRisk ?? null,
  });
}

// ============================================
// Ranking
// ============================================

const SEVERITY_RANK: Record<Risk['severity'], number> = { high: 0, low: 1 };

/**
 * Order risks so the most urgent is handled first: high severity before low,
 * then sooner-occurring before later. Pure — safe to use anywhere a caller
 * needs a prioritized view of pending risks.
 */
export function rankPendingRisks(risks: Risk[]): Risk[] {
  return [...risks].sort((a, b) => {
    if (SEVERITY_RANK[a.severity] !== SEVERITY_RANK[b.severity]) {
      return SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    }
    return a.occurringAt.toMillis() - b.occurringAt.toMillis();
  });
}

// ============================================
// Helpers
// ============================================

async function getRiskById(riskId: string): Promise<Risk | null> {
  const doc = await db().collection('risks').doc(riskId).get();
  return doc.exists ? (doc.data() as Risk) : null;
}
