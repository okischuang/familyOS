export interface User {
  id: string;
  email: string;
  displayName: string;
  role: 'primary' | 'secondary';
  familyId: string;
  settings: UserSettings;
  calendarConnections: CalendarConnections;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserSettings {
  defaultPickupPerson: 'me' | 'partner' | 'grandparent';
  notificationPreferences: {
    pushEnabled: boolean;
    quietHoursStart: string;
    quietHoursEnd: string;
  };
}

export interface CalendarConnections {
  google?: {
    accessToken: string;
    refreshToken: string;
    calendarId: string;
  };
  apple?: {
    syncEnabled: boolean;
  };
}

export interface Event {
  id: string;
  userId: string;
  familyId: string;
  source: 'google' | 'apple' | 'manual';
  externalId?: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  category: 'work' | 'pickup' | 'school' | 'personal' | 'other';
  assignedTo?: string;
  isRecurring: boolean;
  recurrenceRule?: string;
  createdAt: Date;
  updatedAt: Date;
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
  lastPurchaseDate: Date;
  lastPurchaseQuantity: number;
  lowStockThreshold: number;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Alert {
  id: string;
  familyId: string;
  type: 'schedule_conflict' | 'inventory_low' | 'combined';
  severity: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'resolved' | 'dismissed';
  title: string;
  description: string;
  triggerTime: Date;
  expiryTime: Date;
  relatedEventIds?: string[];
  relatedInventoryIds?: string[];
  relatedEvents?: Event[];
  suggestedSolutions: Solution[];
  selectedSolutionId?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  createdAt: Date;
  updatedAt: Date;
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

export type RootStackParamList = {
  Home: undefined;
  AlertDetail: { alertId: string };
  Solutions: { alertId: string };
  Confirm: { alertId: string; solutionId: string };
};
