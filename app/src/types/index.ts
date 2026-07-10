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
  type: 'schedule_conflict' | 'inventory_low' | 'subscription_waste' | 'combined';
  severity: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'resolved' | 'dismissed';
  title: string;
  description: string;
  triggerTime: Date;
  expiryTime: Date;
  relatedEventIds?: string[];
  relatedInventoryIds?: string[];
  relatedSubscriptionIds?: string[];
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

// ---------------------------------------------------------------------------
// Subscriptions
//
// Money is a shared family resource. An idle subscription that keeps
// auto-renewing is a high-frequency, predictable, low-creativity waste — the
// exact class of risk the system exists to remove. We do not build a passive
// list for the user to audit; we detect leaks and propose the cancellation
// before the next charge, so the human only has to veto.
// ---------------------------------------------------------------------------

export type SubscriptionCategory =
  | 'streaming'
  | 'music'
  | 'productivity'
  | 'cloud'
  | 'fitness'
  | 'news'
  | 'gaming'
  | 'education'
  | 'other';

export type BillingCycle = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

// How the subscription is behaving right now, derived from usage signals.
// - active: used often enough to justify the cost
// - idle: still opened, but rarely relative to what it costs (cancel candidate)
// - unused: not touched in a long time / never (clear waste)
// - cancelled: already stopped, kept for history
export type SubscriptionStatus = 'active' | 'idle' | 'unused' | 'cancelled';

export interface Subscription {
  id: string;
  familyId: string;
  name: string;
  category: SubscriptionCategory;
  icon: string;
  // Amount charged per billing cycle, in `currency`.
  amount: number;
  currency: string;
  billingCycle: BillingCycle;
  nextRenewalDate: Date;
  startedDate: Date;
  // Last time any family member actually used the service.
  lastUsedDate?: Date;
  // Detected number of uses per month (opens / sessions / plays).
  usagePerMonth: number;
  autoRenew: boolean;
  // Where the charge was discovered — the system knows without manual entry.
  detectedFrom: 'bank' | 'email' | 'app_store' | 'manual';
  // Family members who share this subscription, if any.
  sharedWith?: string[];
  status: SubscriptionStatus;
}

// A concrete money-saving move the system proposes. The human vetoes; they
// never have to discover these themselves.
export type OptimizationType =
  | 'cancel_unused'
  | 'cancel_idle'
  | 'switch_yearly'
  | 'duplicate'
  | 'family_share';

export interface SubscriptionOptimization {
  id: string;
  type: OptimizationType;
  title: string;
  detail: string;
  monthlySaving: number;
  yearlySaving: number;
  subscriptionIds: string[];
  severity: 'high' | 'medium' | 'low';
}

export type RootStackParamList = {
  Main: undefined;
  Home: undefined;
  AlertDetail: { alertId: string };
  Solutions: { alertId: string };
  Confirm: { alertId: string; solutionId: string };
  SubscriptionAction: { subscriptionId: string };
};
