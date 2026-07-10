/**
 * Risk Detection Engine
 * Predicts family failure risks 24-72 hours ahead
 */

import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import type { Risk, RiskType, RiskSeverity, CalendarEvent, FamilyRules } from '../types/index.js';
import { getFamilyEvents } from '../calendar/index.js';

const db = () => getFirestore();

// ============================================
// Risk Detection Configuration
// ============================================

// Default pickup time if not specified (e.g., 5:00 PM)
const DEFAULT_PICKUP_HOUR = 17;
const DEFAULT_PICKUP_MINUTE = 0;

// Time windows for conflict detection
const PICKUP_BUFFER_MINUTES = 30; // Buffer before/after pickup time

// ============================================
// Main Detection Function
// ============================================

export interface DetectionResult {
  risksCreated: number;
  risksUpdated: number;
  familiesProcessed: number;
}

export async function runRiskDetection(): Promise<DetectionResult> {
  const result: DetectionResult = {
    risksCreated: 0,
    risksUpdated: 0,
    familiesProcessed: 0,
  };

  // Get all families with active rules
  const familiesSnapshot = await db().collection('familyRules').get();

  for (const doc of familiesSnapshot.docs) {
    const rules = doc.data() as FamilyRules;
    const familyId = rules.familyId;

    try {
      const familyResult = await detectRisksForFamily(familyId, rules);
      result.risksCreated += familyResult.created;
      result.risksUpdated += familyResult.updated;
      result.familiesProcessed++;
    } catch (error) {
      console.error(`Error detecting risks for family ${familyId}:`, error);
    }
  }

  return result;
}

// ============================================
// Per-Family Risk Detection
// ============================================

interface FamilyDetectionResult {
  created: number;
  updated: number;
}

async function detectRisksForFamily(
  familyId: string,
  rules: FamilyRules
): Promise<FamilyDetectionResult> {
  const result: FamilyDetectionResult = { created: 0, updated: 0 };

  // Get events for next 72 hours
  const now = new Date();
  const futureDate = new Date(now.getTime() + 72 * 60 * 60 * 1000);

  const events = await getFamilyEvents(familyId, now, futureDate);

  // Detect pickup conflicts (checks if ALL family members are busy)
  const pickupRisks = await detectPickupConflicts(familyId, events, rules);

  // Detect schedule overlaps
  const overlapRisks = detectScheduleOverlaps(familyId, events);

  // Save all detected risks
  const allRisks = [...pickupRisks, ...overlapRisks];

  for (const risk of allRisks) {
    const saveResult = await saveRisk(risk);
    if (saveResult === 'created') {
      result.created++;
    } else if (saveResult === 'updated') {
      result.updated++;
    }
  }

  return result;
}

// ============================================
// Pickup Conflict Detection
// ============================================

async function detectPickupConflicts(
  familyId: string,
  events: CalendarEvent[],
  rules: FamilyRules
): Promise<Risk[]> {
  const risks: Risk[] = [];

  // Get all family members
  const familyMembers = await db()
    .collection('users')
    .where('familyId', '==', familyId)
    .get();

  const memberIds = familyMembers.docs.map((doc) => doc.id);

  // Get unique dates from events
  const eventDates = getUniqueDates(events);

  for (const date of eventDates) {
    // Create pickup time for this date (default 5pm)
    const pickupTime = new Date(date);
    pickupTime.setHours(DEFAULT_PICKUP_HOUR, DEFAULT_PICKUP_MINUTE, 0, 0);

    // Define pickup window
    const pickupStart = new Date(pickupTime.getTime() - PICKUP_BUFFER_MINUTES * 60 * 1000);
    const pickupEnd = new Date(pickupTime.getTime() + PICKUP_BUFFER_MINUTES * 60 * 1000);

    // Check each family member's availability during pickup time
    const memberAvailability: Map<string, { busy: boolean; events: CalendarEvent[] }> = new Map();

    for (const memberId of memberIds) {
      const memberEvents = events.filter((event) => {
        const eventStart = event.startTime.toDate();
        const eventEnd = event.endTime.toDate();

        // Event belongs to this member, is on the same day, and overlaps with pickup window
        return (
          event.userId === memberId &&
          isSameDay(eventStart, date) &&
          event.isBusy &&
          eventStart < pickupEnd &&
          eventEnd > pickupStart
        );
      });

      memberAvailability.set(memberId, {
        busy: memberEvents.length > 0,
        events: memberEvents,
      });
    }

    // Count how many members are busy vs available
    const busyMembers = Array.from(memberAvailability.entries()).filter(([, data]) => data.busy);
    const availableMembers = Array.from(memberAvailability.entries()).filter(([, data]) => !data.busy);

    // Only create risk if ALL family members are busy (no one can pick up)
    if (memberIds.length > 0 && busyMembers.length === memberIds.length) {
      const allConflictingEvents = busyMembers.flatMap(([, data]) => data.events);
      const severity = determineSeverity(allConflictingEvents, pickupTime);

      const risk: Risk = {
        id: generateRiskId(familyId, 'pickup_conflict', pickupTime),
        familyId,
        type: 'pickup_conflict',
        severity,
        detectedAt: Timestamp.now(),
        occurringAt: Timestamp.fromDate(pickupTime),
        context: {
          events: allConflictingEvents.map((e) => e.id),
          description: buildMultiUserPickupConflictDescription(busyMembers, rules),
        },
        status: 'pending',
        createdAt: Timestamp.now(),
      };

      risks.push(risk);
    }
    // If some members are busy but others are available, create a HANDOFF risk
    // This notifies the available person that they need to pick up
    else if (busyMembers.length > 0 && availableMembers.length > 0) {
      const busyMemberEvents = busyMembers.flatMap(([, data]) => data.events);
      const busyMemberIds = busyMembers.map(([id]) => id);
      const availableMemberIds = availableMembers.map(([id]) => id);

      const risk: Risk = {
        id: generateRiskId(familyId, 'pickup_handoff', pickupTime),
        familyId,
        type: 'pickup_handoff',
        severity: 'low', // Handoffs are lower severity than conflicts
        detectedAt: Timestamp.now(),
        occurringAt: Timestamp.fromDate(pickupTime),
        context: {
          events: busyMemberEvents.map((e) => e.id),
          description: buildHandoffDescription(busyMembers, availableMemberIds, rules),
          busyMembers: busyMemberIds,
          availableMembers: availableMemberIds,
        } as Risk['context'] & { busyMembers: string[]; availableMembers: string[] },
        status: 'pending',
        createdAt: Timestamp.now(),
      };

      risks.push(risk);
      console.log(`Pickup handoff on ${date.toISOString().split('T')[0]}: notifying available member(s)`);
    }
  }

  return risks;
}

function buildMultiUserPickupConflictDescription(
  busyMembers: [string, { busy: boolean; events: CalendarEvent[] }][],
  rules: FamilyRules
): string {
  const descriptions = busyMembers.map(([memberId, data]) => {
    const eventTitles = data.events.map((e) => e.title).join(', ');
    return `${eventTitles}`;
  });

  return `雙方都有事無法接送：${descriptions.join(' / ')}`;
}

function buildHandoffDescription(
  busyMembers: [string, { busy: boolean; events: CalendarEvent[] }][],
  availableMemberIds: string[],
  rules: FamilyRules
): string {
  const busyEventTitles = busyMembers
    .flatMap(([, data]) => data.events)
    .map((e) => e.title)
    .join(', ');

  return `需要通知接送：有人因「${busyEventTitles}」無法接送，需通知其他家人`;
}

// ============================================
// Schedule Overlap Detection
// ============================================

function detectScheduleOverlaps(
  familyId: string,
  events: CalendarEvent[]
): Risk[] {
  const risks: Risk[] = [];
  const busyEvents = events.filter((e) => e.isBusy);

  // Check each pair of events for overlap
  for (let i = 0; i < busyEvents.length; i++) {
    for (let j = i + 1; j < busyEvents.length; j++) {
      const event1 = busyEvents[i];
      const event2 = busyEvents[j];

      if (eventsOverlap(event1, event2)) {
        const overlapTime = getOverlapStart(event1, event2);

        const risk: Risk = {
          id: generateRiskId(familyId, 'schedule_overlap', overlapTime),
          familyId,
          type: 'schedule_overlap',
          severity: 'low', // Overlaps are usually low severity
          detectedAt: Timestamp.now(),
          occurringAt: Timestamp.fromDate(overlapTime),
          context: {
            events: [event1.id, event2.id],
            description: `Schedule overlap: "${event1.title}" and "${event2.title}"`,
          },
          status: 'pending',
          createdAt: Timestamp.now(),
        };

        risks.push(risk);
      }
    }
  }

  return risks;
}

// ============================================
// Helper Functions
// ============================================

function getUniqueDates(events: CalendarEvent[]): Date[] {
  const dateSet = new Set<string>();
  const dates: Date[] = [];

  for (const event of events) {
    const eventDate = event.startTime.toDate();
    const dateKey = eventDate.toISOString().split('T')[0];

    if (!dateSet.has(dateKey)) {
      dateSet.add(dateKey);
      dates.push(new Date(dateKey));
    }
  }

  return dates;
}

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

function determineSeverity(
  conflictingEvents: CalendarEvent[],
  pickupTime: Date
): RiskSeverity {
  // High severity if:
  // - Event is happening during pickup time (not just overlapping)
  // - Multiple events conflict
  // - Event ends after pickup time

  const now = new Date();
  const hoursUntilPickup = (pickupTime.getTime() - now.getTime()) / (1000 * 60 * 60);

  // High severity if pickup is within 24 hours
  if (hoursUntilPickup <= 24) {
    return 'high';
  }

  // High severity if multiple events conflict
  if (conflictingEvents.length > 1) {
    return 'high';
  }

  return 'low';
}

function eventsOverlap(event1: CalendarEvent, event2: CalendarEvent): boolean {
  const start1 = event1.startTime.toDate();
  const end1 = event1.endTime.toDate();
  const start2 = event2.startTime.toDate();
  const end2 = event2.endTime.toDate();

  return start1 < end2 && end1 > start2;
}

function getOverlapStart(event1: CalendarEvent, event2: CalendarEvent): Date {
  const start1 = event1.startTime.toDate();
  const start2 = event2.startTime.toDate();

  return start1 > start2 ? start1 : start2;
}

function generateRiskId(
  familyId: string,
  type: RiskType,
  occurringAt: Date
): string {
  const dateStr = occurringAt.toISOString().split('T')[0];
  return `${familyId}_${type}_${dateStr}`;
}

// ============================================
// Risk Persistence
// ============================================

type SaveResult = 'created' | 'updated' | 'skipped';

async function saveRisk(risk: Risk): Promise<SaveResult> {
  const riskRef = db().collection('risks').doc(risk.id);
  const existing = await riskRef.get();

  if (existing.exists) {
    const existingRisk = existing.data() as Risk;

    // Don't update if already resolved, expired, or merged by the arbiter
    if (
      existingRisk.status === 'resolved' ||
      existingRisk.status === 'expired' ||
      existingRisk.status === 'superseded'
    ) {
      return 'skipped';
    }

    // Update with latest detection
    await riskRef.update({
      detectedAt: risk.detectedAt,
      severity: risk.severity,
      context: risk.context,
    });
    return 'updated';
  }

  // Create new risk
  await riskRef.set(risk);
  return 'created';
}

// ============================================
// Query Functions
// ============================================

export async function getPendingRisks(familyId: string): Promise<Risk[]> {
  const snapshot = await db()
    .collection('risks')
    .where('familyId', '==', familyId)
    .where('status', '==', 'pending')
    .orderBy('occurringAt')
    .get();

  return snapshot.docs.map((doc) => doc.data() as Risk);
}

export async function getHighSeverityRisks(familyId: string): Promise<Risk[]> {
  const snapshot = await db()
    .collection('risks')
    .where('familyId', '==', familyId)
    .where('status', '==', 'pending')
    .where('severity', '==', 'high')
    .orderBy('occurringAt')
    .get();

  return snapshot.docs.map((doc) => doc.data() as Risk);
}

export async function updateRiskStatus(
  riskId: string,
  status: Risk['status']
): Promise<void> {
  await db().collection('risks').doc(riskId).update({
    status,
    updatedAt: Timestamp.now(),
  });
}
