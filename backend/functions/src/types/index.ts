/**
 * Laxie Backend Types
 * Autonomous Family Coordination System
 */

import { Timestamp } from 'firebase-admin/firestore';

// ============================================
// Risk Types
// ============================================

export type RiskType = 'pickup_conflict' | 'deadline_miss' | 'schedule_overlap';
export type RiskSeverity = 'high' | 'low';
export type RiskStatus = 'pending' | 'resolving' | 'resolved' | 'expired';

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

export interface TrustMetrics {
  userId: string;
  familyId: string;

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
  ALLOWED_TYPES: ['pickup_conflict', 'schedule_overlap'] as RiskType[],
  // No third parties (school, grandparents) - checked in context
} as const;
