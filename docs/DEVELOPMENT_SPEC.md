# Laxie MVP - Constitution-Aligned Development Specification
Version: 2.0
Last Updated: 2026-01-08

---

## Product Definition

### What is Laxie?

Laxie 是一個「家庭自主協調系統」(Autonomous Family Coordination System)：
- 預測未來 24–72 小時內的家庭失敗風險
- 在必要時先行處理
- 人類只負責否決 (veto)

### What Laxie is NOT
- ❌ 不是家庭管理 App
- ❌ 不是提醒工具
- ❌ 不是 AI 助理聊天介面

---

## MVP Single Objective

> 在不要求使用者主動查看的情況下，成功完成至少一次「系統先做 → 人類未 veto」的家庭協調行動。

### Success Statement
**「它已經幫我處理好了，而且我沒有阻止它。」**

---

## Interface Architecture (Agent-First)

### Paradigm Shift

```
❌ OLD: App-First
   User opens app → sees alerts → chooses solution → sends message
   App is the center of everything

✅ NEW: Agent-First
   System detects risk → decides action → notifies user → executes if no veto
   App is just Audit + Manual Override (opened 1x/week)
```

### Three-Layer Interface Stack

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: ACTION INTERFACE (Primary - Daily)                │
│  ─────────────────────────────────────────────────────────  │
│  Form: Push Notification / LINE / WhatsApp                  │
│  Content: "I will do X in Y minutes. Reply STOP to cancel"  │
│  This IS the main UI. The message IS the product.           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 2: VETO INTERFACE (Exception - When Needed)          │
│  ─────────────────────────────────────────────────────────  │
│  Form: Reply STOP / Tap notification action                 │
│  Options: STOP | (silence = approve)                        │
│  NOT a control panel. Just a safety valve.                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: AUDIT INTERFACE (Secondary - Weekly)              │
│  ─────────────────────────────────────────────────────────  │
│  Form: Minimal React Native App                             │
│  Content: What did system do? Why? Was it vetoed?           │
│  NOT: Dashboard, Calendar, Todo, Chat                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Engineering Architecture (Agent-First)

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                         BACKEND AGENT (Brain)                         │
│                      Firebase Cloud Functions                         │
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐               │
│  │    RISK     │───▶│ RESOLUTION  │───▶│  EXECUTION  │               │
│  │  DETECTION  │    │   ENGINE    │    │    QUEUE    │               │
│  └─────────────┘    └─────────────┘    └─────────────┘               │
│        │                  │                   │                        │
│        │                  │                   ▼                        │
│        │                  │          ┌─────────────┐                  │
│        │                  │          │   DELAYED   │                  │
│        │                  │          │   SENDER    │                  │
│        │                  │          └─────────────┘                  │
│        │                  │                   │                        │
│        ▼                  ▼                   ▼                        │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐               │
│  │   CALENDAR  │    │  LANGUAGE   │    │    VETO     │               │
│  │    SYNC     │    │  ACTUATOR   │    │   HANDLER   │               │
│  │  (Google)   │    │   (GPT)     │    │             │               │
│  └─────────────┘    └─────────────┘    └─────────────┘               │
│                                                │                        │
│                           ┌────────────────────┘                        │
│                           ▼                                             │
│                    ┌─────────────┐                                     │
│                    │    TRUST    │                                     │
│                    │   MANAGER   │                                     │
│                    └─────────────┘                                     │
│                                                                        │
└──────────────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   GOOGLE    │      │    PUSH     │      │  FIRESTORE  │
│  CALENDAR   │      │   (FCM)     │      │  (State)    │
│    API      │      │             │      │             │
└─────────────┘      └─────────────┘      └─────────────┘
                            │
                            ▼
                   ┌─────────────┐
                   │    USER     │
                   │  (Mobile)   │
                   └─────────────┘
```

### Data Flow

```
[Every 30 min]
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. RISK DETECTION                                           │
│    - Fetch calendar events (next 72 hours)                  │
│    - Check family rules                                     │
│    - Detect conflicts → RISK = HIGH / LOW                   │
└─────────────────────────────────────────────────────────────┘
     │
     ▼ (if RISK = HIGH)
┌─────────────────────────────────────────────────────────────┐
│ 2. RESOLUTION ENGINE                                        │
│    - Select DEFAULT resolution (rule-based, NOT AI)         │
│    - Based on: history, emotion cost, reversibility         │
│    - Check L4 eligibility                                   │
└─────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. LANGUAGE ACTUATOR (GPT)                                  │
│    - Generate human-friendly message                        │
│    - Control tone (warm / neutral / urgent)                 │
│    - GPT does NOT decide. Only speaks.                      │
└─────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. EXECUTION QUEUE                                          │
│    - Schedule action with delay (5-15 min)                  │
│    - Send push: "I will do X. Reply STOP to cancel"         │
│    - Start veto window                                      │
└─────────────────────────────────────────────────────────────┘
     │
     ├─────────────────────────────────┐
     ▼                                 ▼
┌─────────────┐                 ┌─────────────┐
│ USER: STOP  │                 │ USER: (none)│
└─────────────┘                 └─────────────┘
     │                                 │
     ▼                                 ▼
┌─────────────┐                 ┌─────────────┐
│   CANCEL    │                 │   EXECUTE   │
│   ACTION    │                 │   ACTION    │
└─────────────┘                 └─────────────┘
     │                                 │
     └─────────────────┬───────────────┘
                       ▼
              ┌─────────────┐
              │  LOG TO     │
              │  AUDIT DB   │
              └─────────────┘
                       │
                       ▼
              ┌─────────────┐
              │   UPDATE    │
              │   TRUST     │
              │   METRICS   │
              └─────────────┘
```

---

## Folder Structure (Agent-First)

```
/familyOS
├── /backend                          # THE MAIN PRODUCT
│   └── /functions
│       └── /src
│           ├── /risk-detection       # Scheduled risk scanning
│           │   ├── index.ts          # Cloud Scheduler trigger
│           │   ├── calendar.ts       # Fetch & parse calendar
│           │   └── detector.ts       # Conflict detection logic
│           │
│           ├── /resolution           # Decision logic (RULE-BASED)
│           │   ├── index.ts          # Entry point
│           │   ├── rules.ts          # Default resolution rules
│           │   └── l4-checker.ts     # L4 eligibility check
│           │
│           ├── /execution            # Action queue & delayed send
│           │   ├── index.ts          # Cloud Tasks handler
│           │   ├── queue.ts          # Add to execution queue
│           │   ├── sender.ts         # Execute action (send message)
│           │   └── rollback.ts       # Undo sent messages
│           │
│           ├── /language             # GPT message generation
│           │   ├── index.ts          # Entry point
│           │   ├── templates.ts      # Message templates
│           │   └── actuator.ts       # GPT API call (tone control)
│           │
│           ├── /veto                 # Handle STOP commands
│           │   ├── index.ts          # Veto handler
│           │   └── processor.ts      # Cancel scheduled action
│           │
│           ├── /trust                # Trust metrics & autonomy
│           │   ├── index.ts          # Entry point
│           │   ├── metrics.ts        # Calculate success rate
│           │   └── promoter.ts       # L2 → L3 → L4 promotion
│           │
│           ├── /calendar             # Google Calendar sync
│           │   ├── index.ts          # OAuth & sync
│           │   └── parser.ts         # Event parsing
│           │
│           └── /types                # Shared types
│               └── index.ts
│
├── /app                              # SECONDARY (Audit only)
│   ├── /src
│   │   ├── /screens
│   │   │   ├── /audit                # THE ONLY MAIN SCREEN
│   │   │   │   └── AuditLogScreen.tsx
│   │   │   └── /settings             # Minimal settings
│   │   │       └── SettingsScreen.tsx
│   │   │
│   │   ├── /components
│   │   │   ├── ActionCard.tsx        # Single action display
│   │   │   ├── VetoButton.tsx        # Manual STOP
│   │   │   └── TrustIndicator.tsx    # Current autonomy level
│   │   │
│   │   ├── /services
│   │   │   ├── push.ts               # Handle incoming push
│   │   │   └── veto.ts               # Send STOP command
│   │   │
│   │   └── /types
│   │       └── index.ts
│   │
│   └── App.tsx                       # Minimal entry
│
└── /docs
    ├── DEVELOPMENT_SPEC.md           # This file
    ├── PRODUCT_CONSTITUTION.md
    └── PRODUCT_Autonomy_Ladder.md
```

---

## Data Models

### Risk
```typescript
interface Risk {
  id: string;
  familyId: string;
  type: 'pickup_conflict' | 'deadline_miss' | 'schedule_overlap';
  severity: 'high' | 'low';
  detectedAt: Timestamp;          // When system detected
  occurringAt: Timestamp;         // When failure would happen
  context: {
    events: string[];             // Related event IDs
    description: string;          // Human-readable context
  };
  status: 'pending' | 'resolving' | 'resolved' | 'expired';
  createdAt: Timestamp;
}
```

### Resolution
```typescript
interface Resolution {
  id: string;
  riskId: string;
  familyId: string;
  action: 'send_message';         // MVP: only message sending
  autonomyLevel: 'L2' | 'L3' | 'L4';

  // Message details
  recipient: string;              // Partner ID
  recipientChannel: 'push' | 'line' | 'whatsapp';
  message: string;                // GPT-generated

  // Timing
  scheduledAt: Timestamp;         // When action will execute
  vetoDeadline: Timestamp;        // Last moment to STOP
  delayMinutes: number;           // 5-15 min

  // Status
  status: 'scheduled' | 'executed' | 'vetoed' | 'cancelled';
  executedAt?: Timestamp;
  vetoedAt?: Timestamp;
  vetoReason?: string;

  createdAt: Timestamp;
}
```

### ActionLog (Audit)
```typescript
interface ActionLog {
  id: string;
  familyId: string;
  riskId: string;
  resolutionId: string;

  // What happened
  what: string;                   // "Sent message to partner"
  why: string;                    // "You have a meeting at 5pm, pickup conflict"
  message: string;                // Actual message sent

  // Outcome
  autonomyLevel: 'L2' | 'L3' | 'L4';
  outcome: 'executed' | 'vetoed' | 'failed';
  wasVetoed: boolean;

  timestamp: Timestamp;
}
```

### TrustMetrics
```typescript
interface TrustMetrics {
  userId: string;
  familyId: string;

  // Counts
  totalActions: number;
  executedActions: number;        // Not vetoed
  vetoedActions: number;

  // Rates
  successRate: number;            // executed / total
  recentVetoCount: number;        // Last 10 actions

  // Current level
  currentAutonomyLevel: 'L2' | 'L3' | 'L4';
  l4Eligible: boolean;

  lastUpdated: Timestamp;
}
```

### FamilyRules
```typescript
interface FamilyRules {
  familyId: string;

  // One-sentence setup
  defaultPickupPerson: 'user' | 'partner';
  partnerName: string;

  // Message preferences
  tone: 'warm' | 'neutral';
  language: 'zh-TW' | 'en';

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

## Cloud Functions Specification

### 1. detectRisks (Scheduled)
```typescript
// Trigger: Cloud Scheduler (every 30 minutes)
// Purpose: Scan for risks in next 72 hours

export const detectRisks = functions.pubsub
  .schedule('every 30 minutes')
  .onRun(async (context) => {
    // 1. Get all families with connected calendars
    // 2. For each family:
    //    - Fetch events (next 72 hours)
    //    - Check against family rules
    //    - Detect conflicts
    //    - Create Risk if severity = HIGH
    // 3. Trigger resolution for new risks
  });
```

### 2. resolveRisk (Firestore Trigger)
```typescript
// Trigger: New Risk document created
// Purpose: Decide default action and queue for execution

export const resolveRisk = functions.firestore
  .document('risks/{riskId}')
  .onCreate(async (snap, context) => {
    // 1. Get risk details
    // 2. Select default resolution (RULE-BASED)
    // 3. Check L4 eligibility
    // 4. Generate message via Language Actuator
    // 5. Create Resolution with scheduled time
    // 6. Queue for delayed execution
  });
```

### 3. executeResolution (Cloud Tasks)
```typescript
// Trigger: Cloud Tasks (after delay expires)
// Purpose: Execute action if not vetoed

export const executeResolution = functions.https
  .onRequest(async (req, res) => {
    // 1. Check if vetoed during delay
    // 2. If not vetoed:
    //    - Send message to recipient
    //    - Update resolution status
    //    - Create ActionLog
    //    - Update TrustMetrics
    // 3. If vetoed: just log
  });
```

### 4. handleVeto (Callable)
```typescript
// Trigger: User sends STOP
// Purpose: Cancel scheduled action

export const handleVeto = functions.https
  .onCall(async (data, context) => {
    // 1. Find pending resolution
    // 2. Cancel Cloud Task
    // 3. Update resolution status
    // 4. Create ActionLog (vetoed)
    // 5. Update TrustMetrics
  });
```

### 5. generateMessage (Internal)
```typescript
// Purpose: GPT Language Actuator
// Called by: resolveRisk

export async function generateMessage(
  risk: Risk,
  resolution: Partial<Resolution>,
  rules: FamilyRules
): Promise<string> {
  // GPT prompt:
  // "Turn this action into a warm, human message in zh-TW.
  //  Action: Ask partner to handle pickup.
  //  Context: {risk.context.description}
  //  Keep under 50 characters."

  // GPT does NOT decide. Only speaks.
}
```

---

## App Screens (Minimal)

### AuditLogScreen (Primary)
```
┌─────────────────────────────────────┐
│  Laxie                    ⚙️        │
├─────────────────────────────────────┤
│                                     │
│  Today                              │
│  ┌─────────────────────────────┐   │
│  │ ✅ 15:30                     │   │
│  │ Sent message to 老公         │   │
│  │ "今天會晚30分鐘，你能接嗎？"  │   │
│  │                              │   │
│  │ Why: 你5點有會議，接送衝突    │   │
│  └─────────────────────────────┘   │
│                                     │
│  Yesterday                          │
│  ┌─────────────────────────────┐   │
│  │ 🛑 10:15 (Vetoed)            │   │
│  │ Would have sent to 老公      │   │
│  │                              │   │
│  │ You stopped this action      │   │
│  └─────────────────────────────┘   │
│                                     │
│  This week: 5 actions, 1 vetoed    │
│  Trust level: L3                    │
│                                     │
└─────────────────────────────────────┘
```

### SettingsScreen (Minimal)
```
┌─────────────────────────────────────┐
│  ← Settings                         │
├─────────────────────────────────────┤
│                                     │
│  Family Rule (one sentence)         │
│  ┌─────────────────────────────┐   │
│  │ 平常老公接小孩               │   │
│  └─────────────────────────────┘   │
│                                     │
│  Partner Name                       │
│  ┌─────────────────────────────┐   │
│  │ 老公                         │   │
│  └─────────────────────────────┘   │
│                                     │
│  Message Tone                       │
│  ○ Warm (溫馨)                      │
│  ● Neutral (中性)                   │
│                                     │
│  Calendar                           │
│  ✅ Google Calendar connected       │
│                                     │
│  Trust Level: L3                    │
│  Next L4 in: 3 successful actions   │
│                                     │
└─────────────────────────────────────┘
```

---

## Push Notification Templates

### L3: Act-with-Approval
```
【Laxie 即將處理】

我將在 10 分鐘後送出訊息給老公：
「今天會晚30分鐘回家，你能先接孩子嗎？」

原因：你5點有會議，接送時間衝突

━━━━━━━━━━━━━━━━━━
[STOP 取消]  [OK 立即送出]
```

### L4: Act Autonomously
```
【Laxie 已處理】

已送出訊息給老公：
「今天會晚30分鐘回家，你能先接孩子嗎？」

原因：你5點有會議，接送時間衝突

━━━━━━━━━━━━━━━━━━
[↩️ 撤回並道歉]
```

### Veto Confirmation
```
【已取消】

訊息未送出。
如果需要，你可以自己處理這件事。
```

---

## 8-Week Roadmap (Agent-First)

### Week 1–2: System Sees First

| Task | Priority | Owner |
|------|----------|-------|
| Google Calendar OAuth | P0 | Backend |
| Calendar sync function | P0 | Backend |
| Basic risk detection | P0 | Backend |
| Manual trigger test | P0 | Backend |

**✅ Done When**: System detects conflict before user knows

### Week 3–4: System Suggests

| Task | Priority | Owner |
|------|----------|-------|
| Resolution engine (rules) | P0 | Backend |
| Language Actuator (GPT) | P0 | Backend |
| Push notification setup | P0 | Backend |
| L2 flow complete | P0 | Backend |

**✅ Done When**: User just says "好"

### Week 5–6: System Acts First

| Task | Priority | Owner |
|------|----------|-------|
| Execution queue (Cloud Tasks) | P0 | Backend |
| Delayed send (5-15 min) | P0 | Backend |
| Veto handler | P0 | Backend |
| Trust metrics | P0 | Backend |
| Audit UI (minimal) | P1 | App |

**✅ Done When**: At least 1 auto-action without veto

### Week 7–8: System Survives Mistakes

| Task | Priority | Owner |
|------|----------|-------|
| Rollback flow | P0 | Backend |
| Apology mode | P0 | Backend |
| Trust recovery rules | P0 | Backend |
| L4 promotion logic | P1 | Backend |
| Settings UI | P2 | App |

**✅ Done When**: User continues after system error

---

## Success Metrics

| Metric | Target | Why |
|--------|--------|-----|
| ✅ Auto-actions without veto | ≥1/user/week | Core value |
| ✅ Non-veto rate | ≥80% | Trust indicator |
| ✅ L4 eligible rate | ≥50% by Week 8 | Autonomy growth |
| ❌ DAU | Don't track | Forces app open |
| ❌ Screen time | Don't track | More = failure |

---

## GPT Role (Critical)

```
┌─────────────────────────────────────────────────────────────┐
│                    GPT = LANGUAGE ACTUATOR                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ✅ DOES:                                                    │
│     • Turn decided action into human message                 │
│     • Control tone (warm / neutral / urgent)                 │
│     • Explain why in user's language                         │
│                                                              │
│  ❌ DOES NOT:                                                │
│     • Decide which action to take                            │
│     • Evaluate risk severity                                 │
│     • Choose between options                                 │
│     • Make autonomous decisions                              │
│                                                              │
│  System decides WHAT. GPT decides HOW TO SAY IT.             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Definition of Done

### For Any Feature
- [ ] Does NOT require user to open app
- [ ] Does NOT require user to input data
- [ ] Does NOT treat notification as success
- [ ] Transfers responsibility TO system
- [ ] Clear autonomy level (L0-L4)

### For MVP
- [ ] ≥1 successful L3+ action without veto
- [ ] User says: 「它已經幫我處理好了，而且我沒有阻止它。」

---

## Guiding Principle

> 在設計上，永遠選擇「讓系統承擔風險」，而不是「讓人類安心」。
>
> 真正的 autonomy 一定會讓人不舒服。但自由，本來就不舒服。
>
> 「如果我們連『幫你把話說完』都不敢自動做，那我們根本不配談 autonomy。」
