---
name: laxie-test-seed
description: Create test data for Laxie/FamilyOS testing scenarios. Use when needing to seed test data, create test risks, or set up specific test scenarios. Triggers include "seed test data", "create test risk", "create pickup conflict", "setup test scenario".
---

# Laxie Test Data Seeding

## Quick Commands

### Create Basic Test User

```typescript
// In Firestore
users/test-user-001: {
  email: "test@example.com",
  familyId: "test-family-001",
  displayName: "Test User",
  expoPushToken: "ExponentPushToken[xxx]", // or fcmToken
  createdAt: Timestamp.now()
}
```

### Create Family Rules

```typescript
familyRules/test-family-001: {
  familyId: "test-family-001",
  partnerName: "老婆",
  language: "zh-TW",
  tone: "warm",
  autonomyLevels: {
    pickup_conflict: "L3",
    pickup_handoff: "L4",
    schedule_overlap: "L2"
  }
}
```

## Risk Types

### 1. Pickup Conflict (`pickup_conflict`)
Both parents busy during pickup time.

```typescript
risks/{riskId}: {
  familyId: "test-family-001",
  type: "pickup_conflict",
  severity: "high",
  detectedAt: Timestamp.now(),
  occurringAt: Timestamp.fromDate(new Date(Date.now() + 3600000)), // 1 hour from now
  context: {
    events: ["Meeting", "Doctor appointment"],
    description: "雙方都有行程，需要協調接送"
  },
  status: "pending"
}
```

### 2. Pickup Handoff (`pickup_handoff`)
One parent busy, need to notify the other.

```typescript
risks/{riskId}: {
  familyId: "test-family-001",
  type: "pickup_handoff",
  severity: "low",
  detectedAt: Timestamp.now(),
  occurringAt: Timestamp.fromDate(new Date(Date.now() + 3600000)),
  context: {
    events: ["School pickup"],
    description: "需要通知接送：有人因「開會」無法接送，需通知其他家人"
  },
  status: "pending"
}
```

### 3. Schedule Overlap (`schedule_overlap`)
Events overlap detection.

```typescript
risks/{riskId}: {
  familyId: "test-family-001",
  type: "schedule_overlap",
  severity: "low",
  detectedAt: Timestamp.now(),
  occurringAt: Timestamp.fromDate(new Date(Date.now() + 7200000)),
  context: {
    events: ["Parent meeting", "Piano lesson"],
    description: "家長會和鋼琴課時間重疊"
  },
  status: "pending"
}
```

## Resolution States

### Scheduled (waiting for veto window)
```typescript
resolutions/{id}: {
  status: "scheduled",
  vetoDeadline: Timestamp.fromDate(new Date(Date.now() + 300000)) // 5 min
}
```

### Executed (sent successfully)
```typescript
resolutions/{id}: {
  status: "executed",
  executedAt: Timestamp.now()
}
```

### Vetoed (user stopped)
```typescript
resolutions/{id}: {
  status: "vetoed",
  vetoedAt: Timestamp.now(),
  vetoReason: "不需要通知"
}
```

### Rolled Back (apology sent)
```typescript
resolutions/{id}: {
  status: "rolled_back",
  rolledBackAt: Timestamp.now()
}
```

## Autonomy Levels

| Level | Behavior | Veto Window |
|-------|----------|-------------|
| L2 | Ask permission first | N/A (waits for approval) |
| L3 | Notify then act | 5 minutes default |
| L4 | Act then notify | Immediate, 30-min rollback |

## Multi-User Calendar Scenario

```typescript
// User 1 calendar events
calendarEvents/user1-event1: {
  userId: "test-user-001",
  title: "Team Meeting",
  start: Timestamp,
  end: Timestamp,
  source: "google"
}

// User 2 (partner) calendar events
calendarEvents/user2-event1: {
  userId: "test-user-002",
  title: "Doctor Appointment",
  start: Timestamp,
  end: Timestamp,
  source: "google"
}
```

## Firebase Console Quick Links

- Firestore: https://console.firebase.google.com/project/laxie-family-os-f7077/firestore
- Functions Logs: https://console.firebase.google.com/project/laxie-family-os-f7077/functions/logs
