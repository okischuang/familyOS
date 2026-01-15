/**
 * Firebase Cloud Functions Service
 * Connects app to Laxie backend
 */

import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import app from '../config/firebase';

const functions = getFunctions(app, 'us-central1');

// Uncomment for local development with emulator
// connectFunctionsEmulator(functions, 'localhost', 5001);

// ============================================
// Types
// ============================================

export interface Risk {
  id: string;
  familyId: string;
  type: 'pickup_conflict' | 'deadline_miss' | 'schedule_overlap';
  severity: 'high' | 'low';
  detectedAt: { _seconds: number };
  occurringAt: { _seconds: number };
  context: {
    events: string[];
    description: string;
  };
  status: 'pending' | 'resolving' | 'resolved' | 'expired';
}

export interface Resolution {
  id: string;
  riskId: string;
  familyId: string;
  action: 'send_message';
  autonomyLevel: 'L2' | 'L3' | 'L4';
  recipient: string;
  recipientChannel: 'push' | 'line' | 'whatsapp';
  message: string;
  scheduledAt: { _seconds: number };
  vetoDeadline: { _seconds: number };
  delayMinutes: number;
  status: 'scheduled' | 'executed' | 'vetoed' | 'cancelled';
  executedAt?: { _seconds: number };
  vetoedAt?: { _seconds: number };
  vetoReason?: string;
}

export interface ActionLog {
  id: string;
  familyId: string;
  riskId: string;
  resolutionId: string;
  what: string;
  why: string;
  message: string;
  autonomyLevel: 'L2' | 'L3' | 'L4';
  outcome: 'executed' | 'vetoed' | 'failed';
  wasVetoed: boolean;
  timestamp: { _seconds: number };
}

// ============================================
// Callable Functions
// ============================================

/**
 * Get pending risks for a family
 */
export async function getPendingRisks(familyId: string): Promise<Risk[]> {
  const callable = httpsCallable<{ familyId: string }, { risks: Risk[] }>(
    functions,
    'getFamilyPendingRisks'
  );
  const result = await callable({ familyId });
  return result.data.risks;
}

/**
 * Get scheduled resolutions for a family
 */
export async function getScheduledResolutions(familyId: string): Promise<Resolution[]> {
  const callable = httpsCallable<{ familyId: string }, { resolutions: Resolution[] }>(
    functions,
    'getFamilyScheduledResolutions'
  );
  const result = await callable({ familyId });
  return result.data.resolutions;
}

/**
 * Veto a scheduled resolution (STOP button)
 */
export async function vetoResolution(
  resolutionId: string,
  reason?: string
): Promise<{ success: boolean; message: string }> {
  const callable = httpsCallable<
    { resolutionId: string; reason?: string },
    { success: boolean; message: string }
  >(functions, 'vetoScheduledResolution');
  const result = await callable({ resolutionId, reason });
  return result.data;
}

/**
 * Get action logs for audit
 */
export async function getActionLogs(
  familyId: string,
  limit: number = 50
): Promise<ActionLog[]> {
  const callable = httpsCallable<
    { familyId: string; limit: number },
    { logs: ActionLog[] }
  >(functions, 'getActionLogs');
  const result = await callable({ familyId, limit });
  return result.data.logs;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Convert Firestore timestamp to Date
 */
export function timestampToDate(timestamp: { _seconds: number }): Date {
  return new Date(timestamp._seconds * 1000);
}

/**
 * Format relative time in Chinese
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / 60000);
  const diffHours = Math.round(diffMs / 3600000);
  const diffDays = Math.round(diffMs / 86400000);

  if (diffMins < 0) {
    // Past
    if (diffMins > -60) return `${Math.abs(diffMins)} 分鐘前`;
    if (diffHours > -24) return `${Math.abs(diffHours)} 小時前`;
    return `${Math.abs(diffDays)} 天前`;
  } else {
    // Future
    if (diffMins < 60) return `${diffMins} 分鐘後`;
    if (diffHours < 24) return `${diffHours} 小時後`;
    return `${diffDays} 天後`;
  }
}

/**
 * Format time for display
 */
export function formatTime(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const period = hours < 12 ? '上午' : '下午';
  const displayHour = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  return `${period} ${displayHour}:${minutes}`;
}
