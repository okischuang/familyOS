/**
 * Seed Test Data for Laxie
 * Run with: node scripts/seed-test-data.js
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// Initialize with default credentials (uses GOOGLE_APPLICATION_CREDENTIALS or gcloud auth)
initializeApp({
  projectId: 'laxie-family-os-f7077',
});

const db = getFirestore();

async function seedData() {
  console.log('Seeding test data...\n');

  const now = new Date();
  const familyId = 'test-family-001';
  const userId = 'test-user-001';

  // 1. Create Family Rules
  console.log('Creating family rules...');
  await db.collection('familyRules').doc(familyId).set({
    familyId,
    defaultPickupPerson: 'user',
    partnerName: '老婆',
    tone: 'warm',
    language: 'zh-TW',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  console.log('✓ Family rules created\n');

  // 2. Create User
  console.log('Creating user...');
  await db.collection('users').doc(userId).set({
    id: userId,
    email: 'test@example.com',
    displayName: 'Test User',
    familyId,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  console.log('✓ User created\n');

  // 3. Create Calendar Events (with pickup conflict)
  console.log('Creating calendar events...');

  // Event 1: Meeting during pickup time (today at 5pm) - CONFLICT!
  const pickupTime = new Date(now);
  pickupTime.setHours(17, 0, 0, 0); // 5:00 PM

  const meetingStart = new Date(pickupTime);
  meetingStart.setMinutes(-30); // 4:30 PM

  const meetingEnd = new Date(pickupTime);
  meetingEnd.setHours(18, 0, 0, 0); // 6:00 PM

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
  console.log('✓ Event 1: 重要客戶會議 (4:30 PM - 6:00 PM) - conflicts with pickup');

  // Event 2: Tomorrow morning meeting (no conflict)
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);

  const tomorrowEnd = new Date(tomorrow);
  tomorrowEnd.setHours(11, 0, 0, 0);

  await db.collection('events').doc('event-002').set({
    id: 'event-002',
    externalId: 'google_456',
    familyId,
    userId,
    source: 'google',
    title: '團隊週會',
    description: '每週團隊同步會議',
    startTime: Timestamp.fromDate(tomorrow),
    endTime: Timestamp.fromDate(tomorrowEnd),
    location: '線上會議',
    isBusy: true,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  console.log('✓ Event 2: 團隊週會 (tomorrow 10:00 AM - 11:00 AM)');

  // Event 3: Tomorrow pickup conflict
  const tomorrowPickup = new Date(now);
  tomorrowPickup.setDate(tomorrowPickup.getDate() + 1);
  tomorrowPickup.setHours(16, 30, 0, 0);

  const tomorrowPickupEnd = new Date(tomorrowPickup);
  tomorrowPickupEnd.setHours(18, 30, 0, 0);

  await db.collection('events').doc('event-003').set({
    id: 'event-003',
    externalId: 'google_789',
    familyId,
    userId,
    source: 'google',
    title: '產品發布會',
    description: '新產品上線發布會',
    startTime: Timestamp.fromDate(tomorrowPickup),
    endTime: Timestamp.fromDate(tomorrowPickupEnd),
    location: '公司大廳',
    isBusy: true,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  console.log('✓ Event 3: 產品發布會 (tomorrow 4:30 PM - 6:30 PM) - conflicts with pickup\n');

  // 4. Create Trust Metrics (for L3/L4 testing)
  console.log('Creating trust metrics...');
  await db.collection('trustMetrics').doc(userId).set({
    userId,
    familyId,
    totalActions: 12,
    executedActions: 11,
    vetoedActions: 1,
    successRate: 0.917, // > 90%, eligible for L4
    recentVetoCount: 1,
    currentAutonomyLevel: 'L3',
    l4Eligible: true,
    lastUpdated: Timestamp.now(),
  });
  console.log('✓ Trust metrics created (91.7% success rate, L4 eligible)\n');

  console.log('========================================');
  console.log('Test data seeded successfully!');
  console.log('========================================');
  console.log('\nExpected results when running risk detection:');
  console.log('- 2 pickup_conflict risks (today + tomorrow)');
  console.log('- Autonomy level: L4 (high trust)');
  console.log('\nRun: curl https://us-central1-laxie-family-os-f7077.cloudfunctions.net/triggerRiskDetection');
}

seedData()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error seeding data:', err);
    process.exit(1);
  });
