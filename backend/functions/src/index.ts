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
import { arbitrate, markSuperseded } from './risk-arbiter/index.js';
import {
  fetchCalendarEvents,
  syncEventsToFirestore,
  getAuthorizationUrl,
  exchangeCodeForTokens,
  disconnectCalendar,
} from './calendar/index.js';
import { registerFcmToken, sendPushToUser } from './notifications/index.js';
import { runSubscriptionDetection } from './subscription-detection/index.js';
import type { Risk, Subscription, User } from './types/index.js';

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

/**
 * Subscription Waste Detection Scheduler
 * Runs daily to detect idle subscriptions about to auto-renew, emitting
 * subscription_waste risks that flow through the same resolution pipeline.
 */
export const scheduledSubscriptionDetection = onSchedule(
  {
    schedule: 'every day 09:00',
    timeZone: 'Asia/Taipei',
    retryCount: 3,
  },
  async () => {
    console.log('Starting scheduled subscription detection...');
    const result = await runSubscriptionDetection();
    console.log(
      `Subscription detection complete: ${result.risksCreated} created, ${result.risksUpdated} updated, ${result.familiesProcessed} families processed`
    );
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

    // Risk Arbiter: converge risks that describe the same underlying situation
    // so the family gets one coordinated response, not several.
    const arbitration = await arbitrate({ ...riskData, id: riskId });
    if (arbitration.action === 'suppress') {
      console.log(`Arbiter suppressed risk ${riskId}: ${arbitration.reason}`);
      await markSuperseded(riskId, arbitration);
      return;
    }

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
// Google Calendar OAuth
// ============================================

/**
 * Get Google Calendar authorization URL
 */
export const getCalendarAuthUrl = onCall(
  {
    enforceAppCheck: false,
    secrets: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
  },
  async (request) => {
    const { userId, redirectUri } = request.data;

    if (!userId) {
      throw new HttpsError('invalid-argument', 'userId is required');
    }

    if (!redirectUri) {
      throw new HttpsError('invalid-argument', 'redirectUri is required');
    }

    try {
      const url = getAuthorizationUrl(userId, redirectUri);
      return { url };
    } catch (error) {
      console.error('Error generating auth URL:', error);
      throw new HttpsError('internal', 'Failed to generate authorization URL');
    }
  }
);

/**
 * Handle Google OAuth callback - exchange code for tokens
 */
export const handleCalendarOAuthCallback = onRequest(
  {
    cors: true,
    secrets: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
  },
  async (req, res) => {
    const { code, state: userId, error: oauthError } = req.query;

    // Handle OAuth errors
    if (oauthError) {
      console.error('OAuth error:', oauthError);
      res.redirect(`laxie://calendar-connected?error=${oauthError}`);
      return;
    }

    if (!code || !userId) {
      res.status(400).json({ error: 'Missing code or state parameter' });
      return;
    }

    // Determine redirect URI (same as what was used to generate auth URL)
    const redirectUri = `https://us-central1-laxie-family-os-f7077.cloudfunctions.net/handleCalendarOAuthCallback`;

    const result = await exchangeCodeForTokens(
      code as string,
      userId as string,
      redirectUri
    );

    if (result.success) {
      // Show success page (works on both web and mobile)
      res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Calendar Connected - Laxie</title>
  <style>
    body { font-family: -apple-system, sans-serif; padding: 40px 20px; text-align: center; background: #f0f9f0; }
    h1 { color: #2e7d32; }
    p { color: #666; }
    .checkmark { font-size: 64px; }
  </style>
</head>
<body>
  <div class="checkmark">✅</div>
  <h1>Google 日曆已連接！</h1>
  <p>User: ${userId}</p>
  <p>您可以關閉此頁面</p>
</body>
</html>
      `);
    } else {
      // Show error page
      res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Error - Laxie</title>
  <style>
    body { font-family: -apple-system, sans-serif; padding: 40px 20px; text-align: center; background: #fff0f0; }
    h1 { color: #c62828; }
    p { color: #666; }
  </style>
</head>
<body>
  <h1>連接失敗</h1>
  <p>${result.error || 'Unknown error'}</p>
</body>
</html>
      `);
    }
  }
);

/**
 * Disconnect Google Calendar
 */
export const disconnectGoogleCalendar = onCall(
  { enforceAppCheck: false },
  async (request) => {
    const { userId } = request.data;

    if (!userId) {
      throw new HttpsError('invalid-argument', 'userId is required');
    }

    try {
      await disconnectCalendar(userId);
      return { success: true };
    } catch (error) {
      console.error('Error disconnecting calendar:', error);
      throw new HttpsError('internal', 'Failed to disconnect calendar');
    }
  }
);

/**
 * Manually sync calendar for a user
 */
export const syncUserCalendar = onCall(
  {
    enforceAppCheck: false,
    secrets: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
  },
  async (request) => {
    const { userId } = request.data;

    if (!userId) {
      throw new HttpsError('invalid-argument', 'userId is required');
    }

    try {
      const userDoc = await db.collection('users').doc(userId).get();
      if (!userDoc.exists) {
        throw new HttpsError('not-found', 'User not found');
      }

      const user = { id: userDoc.id, ...userDoc.data() } as User;

      if (!user.googleCalendar?.refreshToken) {
        throw new HttpsError('failed-precondition', 'Google Calendar not connected');
      }

      const events = await fetchCalendarEvents(user);
      const result = await syncEventsToFirestore(user.id, events);

      return {
        success: true,
        eventsFound: events.length,
        ...result,
      };
    } catch (error) {
      console.error('Error syncing calendar:', error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', 'Failed to sync calendar');
    }
  }
);

// ============================================
// Push Notifications
// ============================================

/**
 * Register FCM token for push notifications
 */
export const registerPushToken = onCall(
  { enforceAppCheck: false },
  async (request) => {
    const { userId, fcmToken } = request.data;

    if (!userId || !fcmToken) {
      throw new HttpsError('invalid-argument', 'userId and fcmToken are required');
    }

    try {
      await registerFcmToken(userId, fcmToken);
      return { success: true };
    } catch (error) {
      console.error('Error registering FCM token:', error);
      throw new HttpsError('internal', 'Failed to register push token');
    }
  }
);

/**
 * Test push notification (for development)
 */
export const testPushNotification = onRequest(
  { cors: true },
  async (req, res) => {
    const { userId, message } = req.query;

    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }

    const result = await sendPushToUser(userId as string, {
      title: 'Laxie 測試通知',
      body: (message as string) || '這是一則測試通知',
      data: {
        type: 'test',
      },
    });

    res.json(result);
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
 * Manual trigger for subscription-waste detection (for testing)
 */
export const triggerSubscriptionDetection = onRequest(
  { cors: true },
  async (req, res) => {
    console.log('Manual subscription detection triggered');
    const result = await runSubscriptionDetection();
    res.json(result);
  }
);

/**
 * Seed Test Subscriptions (for development only)
 * Mirrors the app's mock set: two clearly-wasteful subs about to renew (should
 * each produce a subscription_waste risk) and one active sub (should be skipped).
 */
export const seedTestSubscriptions = onRequest(
  { cors: true },
  async (req, res) => {
    const familyId = 'test-family-001';
    const now = Date.now();
    const daysAgo = (n: number) => Timestamp.fromDate(new Date(now - n * 24 * 60 * 60 * 1000));
    const daysAhead = (n: number) => Timestamp.fromDate(new Date(now + n * 24 * 60 * 60 * 1000));

    const subs: Subscription[] = [
      {
        id: 'sub-disney',
        familyId,
        name: 'Disney+',
        category: 'streaming',
        icon: '🏰',
        amount: 270,
        currency: 'TWD',
        billingCycle: 'monthly',
        nextRenewalDate: daysAhead(6),
        startedDate: daysAgo(210),
        lastUsedDate: daysAgo(74),
        usagePerMonth: 0,
        autoRenew: true,
        detectedFrom: 'app_store',
        status: 'unused',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      },
      {
        id: 'sub-chatgpt',
        familyId,
        name: 'ChatGPT Plus',
        category: 'productivity',
        icon: '🤖',
        amount: 640,
        currency: 'TWD',
        billingCycle: 'monthly',
        nextRenewalDate: daysAhead(1),
        startedDate: daysAgo(60),
        usagePerMonth: 0,
        autoRenew: true,
        detectedFrom: 'bank',
        status: 'unused',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      },
      {
        id: 'sub-netflix',
        familyId,
        name: 'Netflix 高級方案',
        category: 'streaming',
        icon: '🎬',
        amount: 390,
        currency: 'TWD',
        billingCycle: 'monthly',
        nextRenewalDate: daysAhead(4),
        startedDate: daysAgo(430),
        lastUsedDate: daysAgo(1),
        usagePerMonth: 22,
        autoRenew: true,
        detectedFrom: 'bank',
        sharedWith: ['you', 'partner'],
        status: 'active',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      },
    ];

    for (const sub of subs) {
      await db.collection('subscriptions').doc(sub.id).set(sub);
    }

    res.json({
      success: true,
      message: 'Test subscriptions seeded',
      familyId,
      seeded: subs.length,
      expectedRisks: 2, // Disney+ and ChatGPT (Netflix is active -> skipped)
    });
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

/**
 * Manual trigger for resolution execution (for testing)
 * Executes all scheduled resolutions that are past their scheduled time
 */
export const triggerExecution = onRequest(
  { cors: true },
  async (req, res) => {
    console.log('Manual execution triggered');
    const now = Timestamp.now();

    // Find resolutions ready for execution
    const snapshot = await db
      .collection('resolutions')
      .where('status', '==', 'scheduled')
      .where('scheduledAt', '<=', now)
      .get();

    console.log(`Found ${snapshot.size} resolutions ready for execution`);

    const results: { id: string; success: boolean; error?: string }[] = [];

    for (const doc of snapshot.docs) {
      try {
        const success = await executeResolution(doc.id);
        results.push({ id: doc.id, success });
      } catch (error) {
        console.error(`Error executing resolution ${doc.id}:`, error);
        results.push({
          id: doc.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const executed = results.filter((r) => r.success).length;
    res.json({
      found: snapshot.size,
      executed,
      results,
    });
  }
);

/**
 * Debug: List family events and members
 */
export const debugFamily = onRequest(
  { cors: true },
  async (req, res) => {
    const { familyId } = req.query;
    if (!familyId) {
      res.status(400).json({ error: 'familyId required' });
      return;
    }

    // Get family members
    const members = await db.collection('users')
      .where('familyId', '==', familyId)
      .get();

    // Get events
    const events = await db.collection('events')
      .where('familyId', '==', familyId)
      .orderBy('startTime')
      .get();

    // Get risks
    const risks = await db.collection('risks')
      .where('familyId', '==', familyId)
      .get();

    res.json({
      members: members.docs.map(d => ({ id: d.id, ...d.data() })),
      events: events.docs.map(d => {
        const data = d.data();
        return {
          id: data.id,
          userId: data.userId,
          title: data.title,
          startTime: data.startTime?.toDate?.().toISOString(),
          endTime: data.endTime?.toDate?.().toISOString(),
          isBusy: data.isBusy,
        };
      }),
      risks: risks.docs.map(d => ({ id: d.id, ...d.data() })),
    });
  }
);

/**
 * Add a family member (for testing multi-user scenarios)
 */
export const addFamilyMember = onRequest(
  { cors: true },
  async (req, res) => {
    const { userId, familyId, displayName, email } = req.query;

    if (!userId || !familyId) {
      res.status(400).json({ error: 'userId and familyId are required' });
      return;
    }

    await db.collection('users').doc(userId as string).set({
      id: userId,
      email: email || `${userId}@example.com`,
      displayName: displayName || userId,
      familyId,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    res.json({
      success: true,
      message: `User ${userId} added to family ${familyId}`,
      user: {
        id: userId,
        displayName: displayName || userId,
        familyId,
      },
    });
  }
);

/**
 * Get OAuth URL for calendar connection (HTTP endpoint for testing)
 */
export const getCalendarOAuthUrl = onRequest(
  {
    cors: true,
    secrets: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
  },
  async (req, res) => {
    const { userId } = req.query;

    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }

    const redirectUri = `https://us-central1-laxie-family-os-f7077.cloudfunctions.net/handleCalendarOAuthCallback`;
    const url = getAuthorizationUrl(userId as string, redirectUri);

    res.json({
      url,
      instructions: 'Open this URL in browser to connect Google Calendar',
    });
  }
);

/**
 * Simple page to connect Google Calendar (Safari-friendly)
 */
export const connectCalendar = onRequest(
  {
    cors: true,
    secrets: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
  },
  async (req, res) => {
    const { userId } = req.query;

    if (!userId) {
      res.status(400).send('Missing userId parameter. Use: ?userId=your-user-id');
      return;
    }

    const redirectUri = `https://us-central1-laxie-family-os-f7077.cloudfunctions.net/handleCalendarOAuthCallback`;
    const url = getAuthorizationUrl(userId as string, redirectUri);

    // Return HTML page with a button (Safari-friendly)
    res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Connect Google Calendar - Laxie</title>
  <style>
    body { font-family: -apple-system, sans-serif; padding: 40px 20px; text-align: center; background: #f5f5f5; }
    h1 { color: #333; margin-bottom: 20px; }
    p { color: #666; margin-bottom: 30px; }
    .btn { display: inline-block; padding: 16px 32px; background: #4285f4; color: white; text-decoration: none; border-radius: 8px; font-size: 18px; }
    .btn:hover { background: #3367d6; }
    .user { color: #888; font-size: 14px; margin-top: 20px; }
  </style>
</head>
<body>
  <h1>連接 Google 日曆</h1>
  <p>點擊下方按鈕連接您的 Google 日曆</p>
  <a class="btn" href="${url}">連接 Google Calendar</a>
  <p class="user">User: ${userId}</p>
</body>
</html>
    `);
  }
);
