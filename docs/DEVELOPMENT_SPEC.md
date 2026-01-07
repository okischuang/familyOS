# Laxie MVP - Development Specification
Version: 1.0
Last Updated: 2026-01-08

---

## 📋 Table of Contents
1. [Project Overview](#project-overview)
2. [Technical Architecture](#technical-architecture)
3. [Data Models](#data-models)
4. [API Specifications](#api-specifications)
5. [Epic Breakdown](#epic-breakdown)
6. [Sprint Planning](#sprint-planning)

---

## 🎯 Project Overview

### Product Vision
Family Coordination Agent that proactively detects schedule conflicts and inventory shortages, providing solutions and pre-drafted messages.

### Target Metrics (MVP)
- Day 1 → Day 7 Retention: > 40%
- Weekly App Opens: ≥ 5x
- Mental Load Score Improvement: ≥ 2 points (1-10 scale)
- Incident Reduction: ≥ 30%

### Tech Stack
| Layer | Technology |
|-------|------------|
| Frontend | React Native (Expo) |
| Backend | Firebase (Auth, Firestore, Functions) |
| AI | OpenAI GPT-4o-mini |
| Notifications | Firebase Cloud Messaging |
| Calendar | Google Calendar API / Apple EventKit |

---

## 🏗️ Technical Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React Native App                      │
├─────────────────────────────────────────────────────────┤
│  Screens: Home | AlertDetail | Solutions | Confirm      │
│  Components: StatusCard | AlertList | SolutionPicker    │
│  State: Redux Toolkit / Zustand                         │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                   Firebase Backend                       │
├─────────────────────────────────────────────────────────┤
│  Auth        │ Firestore      │ Cloud Functions         │
│  - Email     │ - users        │ - detectConflicts       │
│  - Google    │ - events       │ - predictInventory      │
│  - Apple     │ - inventory    │ - generateMessage       │
│              │ - alerts       │ - syncCalendar          │
└─────────────────────────────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
┌─────────────────────┐     ┌─────────────────────────────┐
│  Google Calendar    │     │      OpenAI API             │
│  API                │     │  - Conflict Analysis        │
│  - Read Events      │     │  - Message Generation       │
│  - Write Events     │     │  - Solution Ranking         │
└─────────────────────┘     └─────────────────────────────┘
```

---

## 📊 Data Models

### User
```typescript
interface User {
  id: string;                    // Firebase UID
  email: string;
  displayName: string;
  role: 'primary' | 'secondary'; // Family role
  familyId: string;              // Shared family identifier
  settings: {
    defaultPickupPerson: string; // 'me' | 'partner' | 'grandparent'
    notificationPreferences: {
      pushEnabled: boolean;
      quietHoursStart: string;   // "22:00"
      quietHoursEnd: string;     // "07:00"
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
```

### Event (Calendar Sync)
```typescript
interface Event {
  id: string;
  userId: string;
  familyId: string;
  source: 'google' | 'apple' | 'manual';
  externalId?: string;           // Google/Apple event ID
  title: string;
  description?: string;
  startTime: Timestamp;
  endTime: Timestamp;
  location?: string;
  category: 'work' | 'pickup' | 'school' | 'personal' | 'other';
  assignedTo?: string;           // userId
  isRecurring: boolean;
  recurrenceRule?: string;       // RRULE format
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### InventoryItem
```typescript
interface InventoryItem {
  id: string;
  familyId: string;
  name: string;
  category: 'baby' | 'household' | 'food' | 'personal';
  unit: string;                  // "包", "罐", "盒"
  currentQuantity: number;
  averageConsumptionPerDay: number;
  estimatedDaysRemaining: number;
  lastPurchaseDate: Timestamp;
  lastPurchaseQuantity: number;
  lowStockThreshold: number;     // Days before warning
  isDefault: boolean;            // Pre-populated item
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Alert
```typescript
interface Alert {
  id: string;
  familyId: string;
  type: 'schedule_conflict' | 'inventory_low' | 'combined';
  severity: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'resolved' | 'dismissed';
  title: string;
  description: string;
  triggerTime: Timestamp;        // When alert should show
  expiryTime: Timestamp;         // When alert becomes irrelevant
  relatedEventIds?: string[];
  relatedInventoryIds?: string[];
  suggestedSolutions: Solution[];
  selectedSolutionId?: string;
  resolvedAt?: Timestamp;
  resolvedBy?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface Solution {
  id: string;
  label: string;
  description: string;
  isRecommended: boolean;
  impacts: string[];
  actions: SolutionAction[];
  generatedMessage?: string;
}

interface SolutionAction {
  type: 'update_event' | 'add_shopping_item' | 'send_notification';
  payload: Record<string, any>;
}
```

---

## 🔌 API Specifications

### Cloud Functions

#### 1. detectConflicts
```typescript
// Trigger: Scheduled (every 30 mins) + On calendar sync
// Input: familyId
// Output: Alert[]

interface DetectConflictsInput {
  familyId: string;
  lookAheadDays?: number; // Default: 7
}

interface DetectConflictsOutput {
  alerts: Alert[];
  analysisTimestamp: Timestamp;
}

// Logic:
// 1. Fetch all events for family in lookAhead window
// 2. Identify time overlaps (especially pickup events)
// 3. Check if assignee is available
// 4. Generate Alert with AI-powered solutions
```

#### 2. predictInventory
```typescript
// Trigger: Daily at 08:00 + On inventory update
// Input: familyId
// Output: Alert[]

interface PredictInventoryInput {
  familyId: string;
}

interface PredictInventoryOutput {
  alerts: Alert[];
  inventoryHealth: number; // 0-100
}

// Logic:
// 1. For each InventoryItem, calculate estimatedDaysRemaining
// 2. If days < lowStockThreshold, create Alert
// 3. Combine with schedule to suggest optimal purchase time
```

#### 3. generateMessage
```typescript
// Trigger: On-demand when user selects solution
// Input: Alert + Solution context
// Output: Generated message string

interface GenerateMessageInput {
  alertId: string;
  solutionId: string;
  recipientRelation: 'partner' | 'grandparent' | 'other';
  tone: 'warm' | 'neutral' | 'urgent';
}

interface GenerateMessageOutput {
  message: string;
  alternativeMessages: string[]; // 2 variations
}

// GPT Prompt Template:
// "Generate a warm, non-confrontational message in Traditional Chinese
//  to ask {recipient} to help with: {task}.
//  Context: {situation}
//  Keep it under 100 characters."
```

#### 4. syncCalendar
```typescript
// Trigger: On-demand + Periodic (every 2 hours)
// Input: userId, calendarType
// Output: Sync status

interface SyncCalendarInput {
  userId: string;
  calendarType: 'google' | 'apple';
  fullSync?: boolean; // Default: false (incremental)
}

interface SyncCalendarOutput {
  success: boolean;
  eventsAdded: number;
  eventsUpdated: number;
  eventsDeleted: number;
  nextSyncToken?: string;
}
```

---

## 📦 Epic Breakdown

### Epic 1: User Authentication & Onboarding
**Priority: P0 (Must Have)**
**Estimated: 1.5 weeks**

| Story ID | Title | Points | Acceptance Criteria |
|----------|-------|--------|---------------------|
| AUTH-001 | Email/Password Sign Up | 3 | User can create account with email validation |
| AUTH-002 | Google OAuth Integration | 5 | One-tap Google sign in works on iOS/Android |
| AUTH-003 | Apple Sign In | 5 | Apple sign in works on iOS |
| AUTH-004 | Onboarding Flow - Role Selection | 2 | User can select "primary" or "secondary" role |
| AUTH-005 | Onboarding Flow - Quick Setup | 3 | User can set default pickup person, select common inventory items |
| AUTH-006 | Calendar Permission Request | 3 | Clear permission flow with fallback for denied |

**Technical Spec for AUTH-001:**
```typescript
// File: src/screens/auth/SignUpScreen.tsx
// Dependencies: @react-native-firebase/auth, formik, yup

// Validation Schema:
const signUpSchema = yup.object({
  email: yup.string().email().required(),
  password: yup.string().min(8).required(),
  displayName: yup.string().min(2).required(),
});

// Firebase Auth Call:
await auth().createUserWithEmailAndPassword(email, password);
await auth().currentUser?.updateProfile({ displayName });
await firestore().collection('users').doc(uid).set({
  email,
  displayName,
  role: 'primary', // Default
  familyId: generateFamilyId(),
  settings: DEFAULT_SETTINGS,
  createdAt: serverTimestamp(),
});
```

---

### Epic 2: Calendar Integration
**Priority: P0 (Must Have)**
**Estimated: 2 weeks**

| Story ID | Title | Points | Acceptance Criteria |
|----------|-------|--------|---------------------|
| CAL-001 | Google Calendar OAuth Flow | 5 | User can connect Google account |
| CAL-002 | Fetch Events from Google | 5 | Events sync to Firestore correctly |
| CAL-003 | Real-time Calendar Updates | 5 | Webhook/push updates when calendar changes |
| CAL-004 | Event Categorization | 3 | AI categorizes events (work/pickup/school) |
| CAL-005 | Manual Event Creation | 3 | User can add events within app |
| CAL-006 | Apple Calendar Read | 5 | EventKit integration for iOS |

**Technical Spec for CAL-002:**
```typescript
// Cloud Function: syncGoogleCalendar
// File: functions/src/calendar/syncGoogle.ts

import { google } from 'googleapis';

export const syncGoogleCalendar = functions.https.onCall(async (data, context) => {
  const { userId } = data;
  const user = await getUser(userId);

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: user.calendarConnections.google.accessToken,
    refresh_token: user.calendarConnections.google.refreshToken,
  });

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const events = await calendar.events.list({
    calendarId: 'primary',
    timeMin: new Date().toISOString(),
    timeMax: addDays(new Date(), 14).toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });

  // Transform and save to Firestore
  const batch = firestore().batch();
  for (const event of events.data.items) {
    const eventRef = firestore().collection('events').doc();
    batch.set(eventRef, transformGoogleEvent(event, userId));
  }
  await batch.commit();
});
```

---

### Epic 3: Conflict Detection Engine
**Priority: P0 (Must Have)**
**Estimated: 2 weeks**

| Story ID | Title | Points | Acceptance Criteria |
|----------|-------|--------|---------------------|
| CONF-001 | Basic Time Overlap Detection | 3 | Detect when 2+ events overlap |
| CONF-002 | Pickup-Specific Conflict Rules | 5 | Flag when pickup time has no available adult |
| CONF-003 | AI Solution Generation | 8 | GPT generates 2-3 solutions per conflict |
| CONF-004 | Solution Impact Analysis | 5 | Each solution shows consequences |
| CONF-005 | Alert Priority Scoring | 3 | High/Medium/Low based on urgency |
| CONF-006 | Scheduled Conflict Scan | 2 | Cloud Function runs every 30 mins |

**Technical Spec for CONF-003:**
```typescript
// Cloud Function: generateSolutions
// File: functions/src/conflicts/generateSolutions.ts

const SYSTEM_PROMPT = `
You are a family scheduling assistant. Given a scheduling conflict,
generate 2-3 practical solutions. For each solution:
1. Describe what needs to happen
2. List impacts (positive and negative)
3. Rate stability (how likely to succeed)

Respond in JSON format:
{
  "solutions": [
    {
      "id": "a",
      "label": "Solution A (Most Stable)",
      "description": "...",
      "isRecommended": true,
      "impacts": ["..."],
      "stabilityScore": 0.9
    }
  ]
}
`;

export async function generateSolutions(conflict: ConflictContext): Promise<Solution[]> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify(conflict) }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
  });

  return JSON.parse(response.choices[0].message.content).solutions;
}
```

---

### Epic 4: Inventory Tracking
**Priority: P0 (Must Have)**
**Estimated: 1.5 weeks**

| Story ID | Title | Points | Acceptance Criteria |
|----------|-------|--------|---------------------|
| INV-001 | Default Inventory Items Setup | 2 | 10 pre-populated items available |
| INV-002 | Add/Edit/Delete Items | 3 | CRUD operations on inventory |
| INV-003 | Quick Update "Just Bought" | 3 | Voice/tap to log purchase |
| INV-004 | Consumption Prediction | 5 | Calculate days remaining based on history |
| INV-005 | Low Stock Alerts | 3 | Generate alerts when threshold met |
| INV-006 | Shopping List Export | 2 | Export to standard shopping list |

**Technical Spec for INV-004:**
```typescript
// File: functions/src/inventory/predict.ts

export function calculateDaysRemaining(item: InventoryItem): number {
  // If no history, use default consumption rate
  if (!item.purchaseHistory || item.purchaseHistory.length < 2) {
    return item.currentQuantity / DEFAULT_CONSUMPTION_RATES[item.category];
  }

  // Calculate average consumption from purchase history
  const daysBetweenPurchases = item.purchaseHistory.reduce((acc, purchase, i, arr) => {
    if (i === 0) return acc;
    const days = differenceInDays(purchase.date, arr[i-1].date);
    const consumed = arr[i-1].quantity;
    return acc + (consumed / days);
  }, 0) / (item.purchaseHistory.length - 1);

  return Math.floor(item.currentQuantity / daysBetweenPurchases);
}
```

---

### Epic 5: Home Dashboard UI
**Priority: P0 (Must Have)**
**Estimated: 1 week**

| Story ID | Title | Points | Acceptance Criteria |
|----------|-------|--------|---------------------|
| HOME-001 | Family Status Indicator | 2 | Show green/yellow/red status |
| HOME-002 | Alert Cards List | 3 | Display pending alerts |
| HOME-003 | Alert Count Badge | 1 | Show "X件事需要處理" |
| HOME-004 | Pull to Refresh | 2 | Manual sync trigger |
| HOME-005 | Empty State | 1 | Show celebration when no alerts |

---

### Epic 6: Alert Resolution Flow
**Priority: P0 (Must Have)**
**Estimated: 1.5 weeks**

| Story ID | Title | Points | Acceptance Criteria |
|----------|-------|--------|---------------------|
| ALERT-001 | Alert Detail Screen | 3 | Show conflict context clearly |
| ALERT-002 | Solution Selection UI | 3 | Radio-style solution picker |
| ALERT-003 | Impact Visualization | 2 | Show consequences per solution |
| ALERT-004 | Confirm Selection | 2 | Save selected solution |
| ALERT-005 | Message Generation | 3 | AI generates contextual message |
| ALERT-006 | Share to LINE/WhatsApp | 3 | Native share integration |

---

### Epic 7: Notifications
**Priority: P1 (Should Have)**
**Estimated: 1 week**

| Story ID | Title | Points | Acceptance Criteria |
|----------|-------|--------|---------------------|
| NOTIF-001 | FCM Setup | 3 | Push notifications work on iOS/Android |
| NOTIF-002 | Alert Push Notifications | 2 | User notified of new alerts |
| NOTIF-003 | Daily Digest | 3 | Morning summary of today's status |
| NOTIF-004 | Quiet Hours | 2 | Respect user's sleep schedule |

---

## 🗓️ Sprint Planning

### Sprint 1 (Week 1-2): Foundation
- AUTH-001 to AUTH-006
- CAL-001, CAL-002
- Database setup

### Sprint 2 (Week 3-4): Core Engine
- CAL-003 to CAL-006
- CONF-001 to CONF-006
- INV-001 to INV-003

### Sprint 3 (Week 5-6): UI Polish
- HOME-001 to HOME-005
- ALERT-001 to ALERT-006
- INV-004 to INV-006

### Sprint 4 (Week 7-8): Integration & Testing
- NOTIF-001 to NOTIF-004
- End-to-end testing
- Beta deployment

---

## 🤖 AI Agent Instructions

When implementing each story:

1. **Read the story acceptance criteria carefully**
2. **Check the data model for relevant types**
3. **Follow the technical spec if provided**
4. **Write tests alongside implementation**
5. **Use these file naming conventions:**
   - Screens: `src/screens/{Feature}/{ScreenName}Screen.tsx`
   - Components: `src/components/{ComponentName}.tsx`
   - Hooks: `src/hooks/use{HookName}.ts`
   - Services: `src/services/{serviceName}.ts`
   - Cloud Functions: `functions/src/{domain}/{functionName}.ts`

6. **Code style:**
   - Use TypeScript strict mode
   - Prefer functional components with hooks
   - Use Tailwind/NativeWind for styling
   - Comment complex business logic

---

## ✅ Definition of Done

- [ ] Code compiles without errors
- [ ] All acceptance criteria met
- [ ] Unit tests pass (>80% coverage for business logic)
- [ ] No TypeScript errors
- [ ] Tested on iOS and Android simulators
- [ ] Code reviewed (if team > 1)
- [ ] Documentation updated if API changed
