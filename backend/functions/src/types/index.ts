/**
 * Laxie Backend Types
 * Autonomous Family Coordination System
 */

import { Timestamp } from 'firebase-admin/firestore';

// ============================================
// Risk Types
// ============================================

export type RiskType =
  | 'pickup_conflict'
  | 'pickup_handoff'
  | 'deadline_miss'
  | 'schedule_overlap'
  | 'subscription_waste';
export type RiskSeverity = 'high' | 'low';
// 'superseded' = the Risk Arbiter merged this risk into another active
// resolution that already covers the same underlying situation, so it does not
// get its own resolution (avoids double-notifying the family — Principle 4).
export type RiskStatus = 'pending' | 'resolving' | 'resolved' | 'expired' | 'superseded';

export interface Risk {
  id: string;
  familyId: string;
  type: RiskType;
  severity: RiskSeverity;
  detectedAt: Timestamp;          // When system detected
  occurringAt: Timestamp;         // When failure would happen
  context: {
    events: string[];             // Related event IDs
    description: string;          // Human-readable context
  };
  status: RiskStatus;
  createdAt: Timestamp;
}

// ============================================
// Resolution Types
// ============================================

export type ResolutionAction = 'send_message';  // MVP: only message sending
export type AutonomyLevel = 'L2' | 'L3' | 'L4';
export type RecipientChannel = 'push' | 'line' | 'whatsapp';
export type ResolutionStatus = 'scheduled' | 'executed' | 'vetoed' | 'cancelled';

export interface Resolution {
  id: string;
  riskId: string;
  familyId: string;
  action: ResolutionAction;
  autonomyLevel: AutonomyLevel;

  // Message details
  recipient: string;              // Partner ID or name
  recipientChannel: RecipientChannel;
  message: string;                // GPT-generated

  // Timing
  scheduledAt: Timestamp;         // When action will execute
  vetoDeadline: Timestamp;        // Last moment to STOP
  delayMinutes: number;           // 5-15 min

  // Status
  status: ResolutionStatus;
  executedAt?: Timestamp;
  vetoedAt?: Timestamp;
  vetoReason?: string;

  createdAt: Timestamp;
}

// ============================================
// Action Log Types (Audit)
// ============================================

export type ActionOutcome = 'executed' | 'vetoed' | 'failed';

export interface ActionLog {
  id: string;
  familyId: string;
  riskId: string;
  resolutionId: string;

  // What happened
  what: string;                   // "Sent message to partner"
  why: string;                    // "You have a meeting at 5pm, pickup conflict"
  message: string;                // Actual message sent

  // Outcome
  autonomyLevel: AutonomyLevel;
  outcome: ActionOutcome;
  wasVetoed: boolean;

  timestamp: Timestamp;
}

// ============================================
// Trust Metrics Types
// ============================================

// A task category groups risk types that should earn trust together. Trust is
// tracked PER category so one agent's bad week doesn't demote the others
// (Autonomy Governor, migration Step 3).
export type TaskCategory = 'pickup' | 'schedule' | 'subscription' | 'other';

export interface TrustMetrics {
  userId: string;                 // metrics doc id (familyId_taskCategory)
  familyId: string;
  taskCategory?: TaskCategory;    // which category these metrics track

  // Counts
  totalActions: number;
  executedActions: number;        // Not vetoed
  vetoedActions: number;

  // Rates
  successRate: number;            // executed / total
  recentVetoCount: number;        // Last 10 actions

  // Current level
  currentAutonomyLevel: AutonomyLevel;
  l4Eligible: boolean;

  lastUpdated: Timestamp;
}

// ============================================
// Family Rules Types
// ============================================

export type DefaultPerson = 'user' | 'partner';
export type MessageTone = 'warm' | 'neutral';
export type Language = 'zh-TW' | 'en';

export interface FamilyRules {
  familyId: string;

  // One-sentence setup
  defaultPickupPerson: DefaultPerson;
  partnerName: string;

  // Message preferences
  tone: MessageTone;
  language: Language;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================
// Calendar Event Types
// ============================================

export type EventSource = 'google' | 'apple' | 'manual';

export interface CalendarEvent {
  id: string;
  externalId?: string;            // Google/Apple event ID
  familyId: string;
  userId: string;
  source: EventSource;

  title: string;
  description?: string;
  startTime: Timestamp;
  endTime: Timestamp;
  location?: string;

  // For conflict detection
  isBusy: boolean;                // busy/free status

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================
// Subscription Types
//
// Money is a shared family resource. An idle subscription that keeps
// auto-renewing is exactly the high-frequency, predictable, low-creativity
// waste the system exists to remove. The Subscription Sensor Agent reads these
// docs (detected from bank/email/app-store, never typed in) and emits
// `subscription_waste` risks before the next charge.
// ============================================

export type SubscriptionCategory =
  | 'streaming'
  | 'music'
  | 'productivity'
  | 'cloud'
  | 'fitness'
  | 'news'
  | 'gaming'
  | 'education'
  | 'other';

export type BillingCycle = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

// How the subscription is behaving, derived from usage signals.
export type SubscriptionStatus = 'active' | 'idle' | 'unused' | 'cancelled';

export interface Subscription {
  id: string;
  familyId: string;
  name: string;
  category: SubscriptionCategory;
  icon: string;
  amount: number;                 // Charged per billing cycle, in `currency`
  currency: string;
  billingCycle: BillingCycle;
  nextRenewalDate: Timestamp;
  startedDate: Timestamp;
  lastUsedDate?: Timestamp;       // Last time any family member used the service
  usagePerMonth: number;          // Detected uses per month (opens/sessions/plays)
  // Whether we have a real usage signal yet. Discovery (from email/bank) finds
  // that a subscription EXISTS and what it costs, but not how much it's used —
  // such records are usageTracked=false, and the waste Sensor must not flag
  // them as unused until a usage signal arrives.
  usageTracked?: boolean;
  autoRenew: boolean;
  detectedFrom: 'bank' | 'email' | 'app_store' | 'manual';
  sharedWith?: string[];
  status: SubscriptionStatus;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================
// User Types
// ============================================

export interface User {
  id: string;
  email: string;
  displayName: string;
  familyId: string;

  // Calendar connections
  googleCalendar?: {
    accessToken: string;
    refreshToken: string;
    tokenExpiry: Timestamp;
    calendarId: string;
  };

  // FCM token for push notifications
  fcmToken?: string;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================
// L4 Eligibility Check Types
// ============================================

export interface L4CheckResult {
  eligible: boolean;
  reasons: string[];              // Why eligible or not
}

export const L4_CONDITIONS = {
  MIN_SUCCESS_RATE: 0.9,          // 90%
  MAX_RECENT_VETOS: 2,            // Last 10 actions
  ALLOWED_TYPES: ['pickup_conflict', 'pickup_handoff', 'schedule_overlap'] as RiskType[],
  // No third parties (school, grandparents) - checked in context
} as const;
