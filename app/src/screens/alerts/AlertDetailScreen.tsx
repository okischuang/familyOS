import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, Alert, Event } from '../../types';

type Props = NativeStackScreenProps<RootStackParamList, 'AlertDetail'>;

export default function AlertDetailScreen({ route, navigation }: Props) {
  const { alertId } = route.params;
  const [alert, setAlert] = useState<Alert | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadAlert() {
      try {
        // TODO: Replace with actual API call
        const mockAlert: Alert = {
          id: alertId,
          familyId: 'family-1',
          type: 'schedule_conflict',
          severity: 'high',
          status: 'pending',
          title: '17:30–18:30 孩子接送無人負責',
          description: '你會議延後 + 另一半外出',
          triggerTime: new Date(),
          expiryTime: new Date(),
          relatedEventIds: ['event-1', 'event-2'],
          relatedEvents: [
            {
              id: 'event-1',
              userId: 'user-1',
              familyId: 'family-1',
              source: 'google',
              title: '會議',
              startTime: new Date(),
              endTime: new Date(),
              category: 'work',
              isRecurring: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            {
              id: 'event-2',
              userId: 'user-2',
              familyId: 'family-1',
              source: 'manual',
              title: '外出',
              startTime: new Date(),
              endTime: new Date(),
              category: 'personal',
              isRecurring: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
          suggestedSolutions: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 500));

        if (isMounted) {
          setAlert(mockAlert);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load alert');
          setLoading(false);
        }
      }
    }

    loadAlert();

    return () => {
      isMounted = false;
    };
  }, [alertId]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1a1a1a" />
      </View>
    );
  }

  if (error || !alert) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error || 'Alert not found'}</Text>
      </View>
    );
  }

  const renderEventDetails = (events: Event[]) => {
    return events.map((event) => (
      // Using event.id as key instead of array index to ensure proper
      // component identity during re-renders and avoid React reconciliation issues
      <View key={event.id} style={styles.eventItem}>
        <Text style={styles.eventTitle}>{event.title}</Text>
        <Text style={styles.eventCategory}>{event.category}</Text>
      </View>
    ));
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.alertBanner}>
        <Text style={styles.alertIcon}>
          {alert.type === 'schedule_conflict' ? '⚠️' : '📦'}
        </Text>
        <Text style={styles.alertType}>
          {alert.type === 'schedule_conflict' ? '行程衝突' : '庫存即將用完'}
        </Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>{alert.title}</Text>
        <Text style={styles.description}>{alert.description}</Text>

        {alert.relatedEvents && alert.relatedEvents.length > 0 && (
          <View style={styles.eventsSection}>
            <Text style={styles.sectionTitle}>相關行程</Text>
            {renderEventDetails(alert.relatedEvents)}
          </View>
        )}

        <View style={styles.consequenceBox}>
          <Text style={styles.consequenceLabel}>如果不處理：</Text>
          <Text style={styles.consequenceText}>孩子可能無人接送</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('Solutions', { alertId: alert.id })}
      >
        <Text style={styles.buttonText}>👉 看解決方式</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 16,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
    padding: 12,
    margin: 16,
    borderRadius: 4,
  },
  alertIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  alertType: {
    fontWeight: '600',
    color: '#92400e',
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  eventsSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    color: '#374151',
  },
  eventItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 8,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  eventCategory: {
    fontSize: 12,
    color: '#6b7280',
    textTransform: 'capitalize',
  },
  consequenceBox: {
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 8,
  },
  consequenceLabel: {
    fontSize: 12,
    color: '#991b1b',
    marginBottom: 4,
  },
  consequenceText: {
    fontSize: 14,
    color: '#dc2626',
  },
  button: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    margin: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
