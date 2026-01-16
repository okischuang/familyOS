/**
 * Push Notification Service
 * Sends push notifications via Expo Push API or FCM
 */

import { getMessaging } from 'firebase-admin/messaging';
import { getFirestore } from 'firebase-admin/firestore';
import type { User } from '../types/index.js';

const db = () => getFirestore();
const messaging = () => getMessaging();

// Expo Push API endpoint
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// ============================================
// Send Push Notification
// ============================================

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Check if token is an Expo Push Token
 */
function isExpoPushToken(token: string): boolean {
  return token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[');
}

/**
 * Send push notification via Expo Push API
 */
async function sendViaExpoPush(
  token: string,
  payload: PushNotificationPayload
): Promise<SendResult> {
  try {
    const message = {
      to: token,
      sound: 'default',
      title: payload.title,
      body: payload.body,
      data: payload.data || {},
    };

    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    console.log('Expo Push API response:', JSON.stringify(result));

    if (result.data?.status === 'ok') {
      return { success: true, messageId: result.data.id };
    }

    // Handle errors
    if (result.data?.status === 'error') {
      return { success: false, error: result.data.message || 'Expo push failed' };
    }

    return { success: true, messageId: result.data?.id };
  } catch (error) {
    console.error('Error sending via Expo Push:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send push notification via Firebase Cloud Messaging
 */
async function sendViaFCM(
  token: string,
  payload: PushNotificationPayload
): Promise<SendResult> {
  try {
    const message = {
      token,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data || {},
      // iOS specific
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
      // Android specific
      android: {
        priority: 'high' as const,
        notification: {
          sound: 'default',
          channelId: 'laxie_default',
        },
      },
    };

    const response = await messaging().send(message);
    console.log(`FCM push sent: ${response}`);
    return { success: true, messageId: response };
  } catch (error) {
    console.error('Error sending via FCM:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send push notification to a specific user
 */
export async function sendPushToUser(
  userId: string,
  payload: PushNotificationPayload
): Promise<SendResult> {
  try {
    // Get user's push token
    const userDoc = await db().collection('users').doc(userId).get();

    if (!userDoc.exists) {
      return { success: false, error: `User ${userId} not found` };
    }

    const user = userDoc.data() as User;

    if (!user.fcmToken) {
      console.log(`User ${userId} has no push token registered`);
      return { success: false, error: 'No push token registered' };
    }

    const token = user.fcmToken;

    // Use Expo Push API for Expo tokens, FCM for native tokens
    if (isExpoPushToken(token)) {
      console.log(`Sending via Expo Push API to ${userId}`);
      return await sendViaExpoPush(token, payload);
    } else {
      console.log(`Sending via FCM to ${userId}`);
      return await sendViaFCM(token, payload);
    }
  } catch (error) {
    console.error(`Error sending push to user ${userId}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send push notification to multiple users
 */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushNotificationPayload
): Promise<Map<string, SendResult>> {
  const results = new Map<string, SendResult>();

  for (const userId of userIds) {
    const result = await sendPushToUser(userId, payload);
    results.set(userId, result);
  }

  return results;
}

/**
 * Send push notification to all family members
 */
export async function sendPushToFamily(
  familyId: string,
  payload: PushNotificationPayload,
  excludeUserId?: string
): Promise<Map<string, SendResult>> {
  const membersSnapshot = await db()
    .collection('users')
    .where('familyId', '==', familyId)
    .get();

  const userIds = membersSnapshot.docs
    .map((doc) => doc.id)
    .filter((id) => id !== excludeUserId);

  return sendPushToUsers(userIds, payload);
}

// ============================================
// Push Token Management
// ============================================

/**
 * Register or update push token for a user
 */
export async function registerFcmToken(
  userId: string,
  fcmToken: string
): Promise<void> {
  const userRef = db().collection('users').doc(userId);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    // Create user doc if it doesn't exist
    await userRef.set({
      id: userId,
      fcmToken,
      createdAt: new Date(),
    });
    console.log(`Created user ${userId} with push token`);
  } else {
    await userRef.update({
      fcmToken,
    });
    console.log(`Updated push token for user ${userId}`);
  }
}

/**
 * Unregister push token for a user
 */
export async function unregisterFcmToken(userId: string): Promise<void> {
  await db().collection('users').doc(userId).update({
    fcmToken: null,
  });
  console.log(`Push token unregistered for user ${userId}`);
}
