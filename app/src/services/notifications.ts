/**
 * Push Notification Service
 * Handles FCM registration and notification handling
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../config/firebase';

const functions = getFunctions(app);

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ============================================
// FCM Token Registration
// ============================================

export async function registerForPushNotifications(userId: string): Promise<string | null> {
  // Check if physical device (push doesn't work on simulator)
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  // Check/request permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission not granted');
    return null;
  }

  // Get Expo push token (for Expo Go) or FCM token (for standalone)
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

    if (!projectId) {
      console.log('No project ID found for push notifications');
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    const token = tokenData.data;
    console.log('Push token:', token);

    // Register token with backend
    const registerToken = httpsCallable(functions, 'registerPushToken');
    await registerToken({ userId, fcmToken: token });

    console.log('Push token registered with backend');
    return token;
  } catch (error) {
    console.error('Error getting push token:', error);
    return null;
  }
}

// ============================================
// Notification Listeners
// ============================================

export type NotificationHandler = (notification: Notifications.Notification) => void;
export type NotificationResponseHandler = (response: Notifications.NotificationResponse) => void;

let notificationListener: Notifications.EventSubscription | null = null;
let responseListener: Notifications.EventSubscription | null = null;

export function setupNotificationListeners(
  onNotification?: NotificationHandler,
  onNotificationResponse?: NotificationResponseHandler
): () => void {
  // Listener for notifications received while app is in foreground
  notificationListener = Notifications.addNotificationReceivedListener((notification) => {
    console.log('Notification received:', notification);
    onNotification?.(notification);
  });

  // Listener for when user taps on notification
  responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
    console.log('Notification response:', response);
    onNotificationResponse?.(response);
  });

  // Return cleanup function
  return () => {
    if (notificationListener) {
      notificationListener.remove();
    }
    if (responseListener) {
      responseListener.remove();
    }
  };
}

// ============================================
// Android Notification Channel
// ============================================

export async function setupAndroidNotificationChannel(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('laxie_default', {
      name: 'Laxie Notifications',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4285f4',
    });
  }
}

// ============================================
// Get Last Notification (for cold start)
// ============================================

export async function getLastNotificationResponse(): Promise<Notifications.NotificationResponse | null> {
  return await Notifications.getLastNotificationResponseAsync();
}
