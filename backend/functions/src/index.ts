/**
 * Laxie Backend Agent
 * Autonomous Family Coordination System
 *
 * Architecture:
 * - Risk Detection runs every 30 minutes (scheduled)
 * - Resolution execution is triggered by Cloud Tasks
 * - App only provides Audit + Veto interface
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';

import { runRiskDetection, getPendingRisks } from './risk-detection/index.js';
import {
  createResolutionForRisk,
  executeResolution,
  vetoResolution,
  getScheduledResolutions,
} from './resolution/index.js';
import { generateAndUpdateResolutionMessage } from './language-actuator/index.js';
import { fetchCalendarEvents, syncEventsToFirestore } from './calendar/index.js';
import type { Risk, User } from './types/index.js';

// Initialize Firebase Admin
initializeApp();

const db = getFirestore();

// ============================================
// Scheduled Functions
// ============================================

/**
 * Risk Detection Scheduler
 * Runs every 30 minutes to detect upcoming risks
 */
export const scheduledRiskDetection = onSchedule(
  {
    schedule: 'every 30 minutes',
    timeZone: 'Asia/Taipei',
    retryCount: 3,
  },
  async () => {
    console.log('Starting scheduled risk detection...');
    const result = await runRiskDetection();
    console.log(
      `Risk detection complete: ${result.risksCreated} created, ${result.risksUpdated} updated, ${result.familiesProcessed} families processed`
    );
  }
);

/**
 * Calendar Sync Scheduler
 * Runs every hour to sync calendar events
 */
export const scheduledCalendarSync = onSchedule(
  {
    schedule: 'every 1 hours',
    timeZone: 'Asia/Taipei',
    retryCount: 3,
  },
  async () => {
    console.log('Starting scheduled calendar sync...');

    // Get all users with connected calendars
    const usersSnapshot = await db
      .collection('users')
      .where('googleCalendar.refreshToken', '!=', null)
      .get();

    let synced = 0;
    for (const doc of usersSnapshot.docs) {
      const user = { id: doc.id, ...doc.data() } as User;
      try {
        const events = await fetchCalendarEvents(user);
        await syncEventsToFirestore(user.id, events);
        synced++;
      } catch (error) {
        console.error(`Error syncing calendar for user ${user.id}:`, error);
      }
    }

    console.log(`Calendar sync complete: ${synced} users synced`);
  }
);

/**
 * Resolution Execution Scheduler
 * Runs every minute to execute scheduled resolutions
 */
export const scheduledResolutionExecution = onSchedule(
  {
    schedule: 'every 1 minutes',
    timeZone: 'Asia/Taipei',
    retryCount: 1,
  },
  async () => {
    const now = Timestamp.now();

    // Find resolutions ready for execution
    const snapshot = await db
      .collection('resolutions')
      .where('status', '==', 'scheduled')
      .where('scheduledAt', '<=', now)
      .get();

    let executed = 0;
    for (const doc of snapshot.docs) {
      try {
        const success = await executeResolution(doc.id);
        if (success) executed++;
      } catch (error) {
        console.error(`Error executing resolution ${doc.id}:`, error);
      }
    }

    if (executed > 0) {
      console.log(`Resolution execution complete: ${executed} executed`);
    }
  }
);

// ============================================
// Firestore Triggers
// ============================================

/**
 * On Risk Created - Create Resolution
 * When a new risk is detected, automatically create a resolution
 */
export const onRiskCreated = onDocumentCreated(
  {
    document: 'risks/{riskId}',
    secrets: ['OPENAI_API_KEY'],
  },
  async (event) => {
    const riskData = event.data?.data() as Risk | undefined;
    if (!riskData) return;

    const riskId = event.params.riskId;
    console.log(`New risk detected: ${riskId}, type: ${riskData.type}`);

    // Get a user from the family to determine autonomy level
    const usersSnapshot = await db
      .collection('users')
      .where('familyId', '==', riskData.familyId)
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      console.error(`No users found for family ${riskData.familyId}`);
      return;
    }

    const userId = usersSnapshot.docs[0].id;

    try {
      // Create resolution
      const { resolution, autonomyLevel } = await createResolutionForRisk(
        { ...riskData, id: riskId },
        userId
      );

      // Generate message using Language Actuator
      await generateAndUpdateResolutionMessage(resolution.id);

      console.log(
        `Resolution created: ${resolution.id}, autonomy level: ${autonomyLevel}`
      );
    } catch (error) {
      console.error(`Error creating resolution for risk ${riskId}:`, error);
    }
  }
);

// ============================================
// Callable Functions (for App)
// ============================================

/**
 * Veto a scheduled resolution
 */
export const vetoScheduledResolution = onCall(
  { enforceAppCheck: false },
  async (request) => {
    const { resolutionId, reason } = request.data;

    if (!resolutionId) {
      throw new HttpsError('invalid-argument', 'resolutionId is required');
    }

    try {
      const success = await vetoResolution(resolutionId, reason);
      return { success, message: success ? 'Resolution vetoed' : 'Could not veto' };
    } catch (error) {
      console.error('Error vetoing resolution:', error);
      throw new HttpsError('internal', 'Failed to veto resolution');
    }
  }
);

/**
 * Get pending risks for a family
 */
export const getFamilyPendingRisks = onCall(
  { enforceAppCheck: false },
  async (request) => {
    const { familyId } = request.data;

    if (!familyId) {
      throw new HttpsError('invalid-argument', 'familyId is required');
    }

    try {
      const risks = await getPendingRisks(familyId);
      return { risks };
    } catch (error) {
      console.error('Error getting pending risks:', error);
      throw new HttpsError('internal', 'Failed to get pending risks');
    }
  }
);

/**
 * Get scheduled resolutions for a family
 */
export const getFamilyScheduledResolutions = onCall(
  { enforceAppCheck: false },
  async (request) => {
    const { familyId } = request.data;

    if (!familyId) {
      throw new HttpsError('invalid-argument', 'familyId is required');
    }

    try {
      const resolutions = await getScheduledResolutions(familyId);
      return { resolutions };
    } catch (error) {
      console.error('Error getting scheduled resolutions:', error);
      throw new HttpsError('internal', 'Failed to get scheduled resolutions');
    }
  }
);

/**
 * Get action logs for audit
 */
export const getActionLogs = onCall(
  { enforceAppCheck: false },
  async (request) => {
    const { familyId, limit = 50 } = request.data;

    if (!familyId) {
      throw new HttpsError('invalid-argument', 'familyId is required');
    }

    try {
      const snapshot = await db
        .collection('actionLogs')
        .where('familyId', '==', familyId)
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();

      const logs = snapshot.docs.map((doc) => doc.data());
      return { logs };
    } catch (error) {
      console.error('Error getting action logs:', error);
      throw new HttpsError('internal', 'Failed to get action logs');
    }
  }
);

// ============================================
// Manual Trigger (for testing)
// ============================================

export const triggerRiskDetection = onRequest(
  { cors: true },
  async (req, res) => {
    console.log('Manual risk detection triggered');
    const result = await runRiskDetection();
    res.json(result);
  }
);

/**
 * Seed Test Data (for development only)
 */
export const seedTestData = onRequest(
  { cors: true },
  async (req, res) => {
    console.log('Seeding test data...');

    const now = new Date();
    const familyId = 'test-family-001';
    const userId = 'test-user-001';

    // 1. Create Family Rules
    await db.collection('familyRules').doc(familyId).set({
      familyId,
      defaultPickupPerson: 'user',
      partnerName: '老婆',
      tone: 'warm',
      language: 'zh-TW',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    // 2. Create User
    await db.collection('users').doc(userId).set({
      id: userId,
      email: 'test@example.com',
      displayName: 'Test User',
      familyId,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    // 3. Create Calendar Events with pickup conflicts
    const pickupTime = new Date(now);
    pickupTime.setHours(17, 0, 0, 0);

    const meetingStart = new Date(pickupTime);
    meetingStart.setMinutes(meetingStart.getMinutes() - 30);

    const meetingEnd = new Date(pickupTime);
    meetingEnd.setHours(18, 0, 0, 0);

    // Event 1: Today - conflicts with pickup
    await db.collection('events').doc('event-001').set({
      id: 'event-001',
      externalId: 'google_123',
      familyId,
      userId,
      source: 'google',
      title: '重要客戶會議',
      description: 'Q1 業績檢討會議',
      startTime: Timestamp.fromDate(meetingStart),
      endTime: Timestamp.fromDate(meetingEnd),
      location: '台北辦公室',
      isBusy: true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    // Event 2: Tomorrow - conflicts with pickup
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(16, 30, 0, 0);

    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setHours(18, 30, 0, 0);

    await db.collection('events').doc('event-002').set({
      id: 'event-002',
      externalId: 'google_456',
      familyId,
      userId,
      source: 'google',
      title: '產品發布會',
      description: '新產品上線發布會',
      startTime: Timestamp.fromDate(tomorrow),
      endTime: Timestamp.fromDate(tomorrowEnd),
      location: '公司大廳',
      isBusy: true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    // 4. Create Trust Metrics
    await db.collection('trustMetrics').doc(userId).set({
      userId,
      familyId,
      totalActions: 12,
      executedActions: 11,
      vetoedActions: 1,
      successRate: 0.917,
      recentVetoCount: 1,
      currentAutonomyLevel: 'L3',
      l4Eligible: true,
      lastUpdated: Timestamp.now(),
    });

    res.json({
      success: true,
      message: 'Test data seeded',
      data: {
        familyId,
        userId,
        eventsCreated: 2,
        expectedConflicts: 2,
      },
    });
  }
);

/**
 * Delete risks (for testing)
 */
export const deleteRisks = onRequest(
  { cors: true },
  async (req, res) => {
    const snapshot = await db.collection('risks').get();
    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    const resSnapshot = await db.collection('resolutions').get();
    const resBatch = db.batch();
    resSnapshot.docs.forEach((doc) => resBatch.delete(doc.ref));
    await resBatch.commit();

    res.json({ deleted: snapshot.size, resolutionsDeleted: resSnapshot.size });
  }
);
