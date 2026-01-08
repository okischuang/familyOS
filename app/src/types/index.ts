import { Timestamp } from 'firebase/firestore';

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: 'primary' | 'secondary';
  familyId: string;
  settings: {
    defaultPickupPerson: 'me' | 'partner' | 'grandparent';
    notificationPreferences: {
      pushEnabled: boolean;
      quietHoursStart: string;
      quietHoursEnd: string;
    };
  };
  calendarConnections: {
    google?: {
      accessToken: string;
      refreshToken: string;
      calendarId: string;
    };
    apple?: {
      syncEnabled: boolean;
    };
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Event {
  id: string;
  userId: string;
  familyId: string;
  source: 'google' | 'apple' | 'manual';
  externalId?: string;
  title: string;
  description?: string;
  startTime: Timestamp;
  endTime: Timestamp;
  location?: string;
  category: 'work' | 'pickup' | 'school' | 'personal' | 'other';
  assignedTo?: string;
  isRecurring: boolean;
  recurrenceRule?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface InventoryItem {
  id: string;
  familyId: string;
  name: string;
  category: 'baby' | 'household' | 'food' | 'personal';
  unit: string;
  currentQuantity: number;
  averageConsumptionPerDay: number;
  estimatedDaysRemaining: number;
  lastPurchaseDate: Timestamp;
  lastPurchaseQuantity: number;
  lowStockThreshold: number;
  isDefault: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Alert {
  id: string;
  familyId: string;
  type: 'schedule_conflict' | 'inventory_low' | 'combined';
  severity: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'resolved' | 'dismissed';
  title: string;
  description: string;
  triggerTime: Timestamp;
  expiryTime: Timestamp;
  relatedEventIds?: string[];
  relatedInventoryIds?: string[];
  suggestedSolutions: Solution[];
  selectedSolutionId?: string;
  resolvedAt?: Timestamp;
  resolvedBy?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Solution {
  id: string;
  label: string;
  description: string;
  isRecommended: boolean;
  impacts: string[];
  actions: SolutionAction[];
  generatedMessage?: string;
}

export interface SolutionAction {
  type: 'update_event' | 'add_shopping_item' | 'send_notification';
  payload: Record<string, unknown>;
}
