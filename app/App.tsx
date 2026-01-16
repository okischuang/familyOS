import React, { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Alert } from 'react-native';
import RootNavigator from './src/navigation/RootNavigator';
import {
  registerForPushNotifications,
  setupNotificationListeners,
  setupAndroidNotificationChannel,
  getLastNotificationResponse,
} from './src/services/notifications';

// TODO: Replace with actual user ID from auth
const CURRENT_USER_ID = 'test-user-002'; // Wife's user ID for testing

export default function App() {
  const notificationCleanup = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Setup Android notification channel
    setupAndroidNotificationChannel();

    // Register for push notifications
    registerForPushNotifications(CURRENT_USER_ID).then((token) => {
      if (token) {
        console.log('Push notifications enabled');
      }
    });

    // Setup notification listeners
    notificationCleanup.current = setupNotificationListeners(
      // Called when notification received in foreground
      (notification) => {
        const title = notification.request.content.title || 'Laxie';
        const body = notification.request.content.body || '';
        Alert.alert(title, body);
      },
      // Called when user taps notification
      (response) => {
        const data = response.notification.request.content.data;
        console.log('User tapped notification:', data);
        // TODO: Navigate to appropriate screen based on data.type
      }
    );

    // Check if app was opened from notification
    getLastNotificationResponse().then((response) => {
      if (response) {
        console.log('App opened from notification:', response);
      }
    });

    return () => {
      notificationCleanup.current?.();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <RootNavigator />
    </SafeAreaProvider>
  );
}
