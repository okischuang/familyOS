/**
 * Language Actuator
 * GPT-powered message generation
 *
 * IMPORTANT: GPT is ONLY used for language generation.
 * - NOT for making decisions
 * - NOT for risk evaluation
 * - NOT for choosing solutions
 * - ONLY for turning system decisions into human-readable messages
 */

import OpenAI from 'openai';
import { getFirestore } from 'firebase-admin/firestore';
import type { Risk, Resolution, FamilyRules, MessageTone, Language } from '../types/index.js';

const db = () => getFirestore();

// ============================================
// OpenAI Client
// ============================================

function getOpenAIClient(): OpenAI {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

// ============================================
// Message Generation
// ============================================

export interface MessageGenerationInput {
  risk: Risk;
  resolution: Resolution;
  rules: FamilyRules;
}

export interface GeneratedMessage {
  message: string;
  tone: MessageTone;
  language: Language;
}

export async function generateMessage(
  input: MessageGenerationInput
): Promise<GeneratedMessage> {
  const { risk, resolution, rules } = input;

  const systemPrompt = buildSystemPrompt(rules);
  const userPrompt = buildUserPrompt(risk, resolution, rules);

  const openai = getOpenAIClient();

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 200,
  });

  const message = response.choices[0]?.message?.content || '';

  return {
    message: message.trim(),
    tone: rules.tone,
    language: rules.language,
  };
}

// ============================================
// Prompt Building
// ============================================

function buildSystemPrompt(rules: FamilyRules): string {
  const toneDescription = rules.tone === 'warm'
    ? '親切、關心的語氣'
    : '簡潔、直接的語氣';

  if (rules.language === 'zh-TW') {
    return `你是一個家庭協調系統的訊息生成器。
你的唯一任務是將系統的決策轉換成自然的人類語言。

重要規則：
1. 你不做任何決策，只負責語言表達
2. 使用${toneDescription}
3. 訊息要簡短（1-2句話）
4. 不要加入emoji除非用戶偏好
5. 直接開始訊息內容，不要加入"訊息："等前綴

語言：繁體中文`;
  }

  return `You are a message generator for a family coordination system.
Your only task is to convert system decisions into natural human language.

Important rules:
1. You do NOT make any decisions, only handle language expression
2. Use a ${rules.tone} tone
3. Keep messages short (1-2 sentences)
4. Do not add emojis unless user prefers
5. Start with the message content directly, no prefixes like "Message:"

Language: English`;
}

function buildUserPrompt(
  risk: Risk,
  resolution: Resolution,
  rules: FamilyRules
): string {
  const partnerName = rules.partnerName;
  const isToPartner = resolution.recipient === partnerName;

  if (rules.language === 'zh-TW') {
    return buildChinesePrompt(risk, resolution, rules, isToPartner);
  }

  return buildEnglishPrompt(risk, resolution, rules, isToPartner);
}

function buildChinesePrompt(
  risk: Risk,
  resolution: Resolution,
  rules: FamilyRules,
  isToPartner: boolean
): string {
  const partnerName = rules.partnerName;
  const occurringTime = formatTime(risk.occurringAt.toDate(), 'zh-TW');

  if (risk.type === 'pickup_conflict') {
    if (isToPartner) {
      return `生成一則給${partnerName}的訊息。

情況：
- 系統偵測到今天 ${occurringTime} 有接送衝突
- 原因：${risk.context.description}
- 需要請${partnerName}幫忙接送

請生成一則簡短的協調訊息。`;
    } else {
      return `生成一則給用戶的訊息。

情況：
- 系統偵測到今天 ${occurringTime} 有接送衝突
- 原因：${risk.context.description}
- 需要提醒用戶注意

請生成一則簡短的提醒訊息。`;
    }
  }

  if (risk.type === 'pickup_handoff') {
    // Handoff: one person is busy, notify the available person to pick up
    return `生成一則給${isToPartner ? partnerName : '用戶'}的訊息。

情況：
- 今天 ${occurringTime} 需要接小孩
- 另一半因為「${risk.context.description.replace('需要通知接送：有人因「', '').replace('」無法接送，需通知其他家人', '')}」無法接送
- 需要通知對方今天要負責接送

請生成一則簡短、友善的通知訊息，讓對方知道今天需要由他/她去接小孩。`;
  }

  if (risk.type === 'schedule_overlap') {
    return `生成一則訊息。

情況：
- 系統偵測到 ${occurringTime} 有行程重疊
- 詳情：${risk.context.description}

請生成一則簡短的提醒訊息。`;
  }

  // Generic fallback
  return `生成一則訊息。

情況：
- 風險類型：${risk.type}
- 時間：${occurringTime}
- 詳情：${risk.context.description}

請生成一則簡短的提醒訊息。`;
}

function buildEnglishPrompt(
  risk: Risk,
  resolution: Resolution,
  rules: FamilyRules,
  isToPartner: boolean
): string {
  const partnerName = rules.partnerName;
  const occurringTime = formatTime(risk.occurringAt.toDate(), 'en');

  if (risk.type === 'pickup_conflict') {
    if (isToPartner) {
      return `Generate a message to ${partnerName}.

Situation:
- System detected a pickup conflict at ${occurringTime}
- Reason: ${risk.context.description}
- Need to ask ${partnerName} to help with pickup

Generate a short coordination message.`;
    } else {
      return `Generate a message to the user.

Situation:
- System detected a pickup conflict at ${occurringTime}
- Reason: ${risk.context.description}
- Need to remind user about this

Generate a short reminder message.`;
    }
  }

  if (risk.type === 'pickup_handoff') {
    // Handoff: one person is busy, notify the available person to pick up
    return `Generate a message to ${isToPartner ? partnerName : 'the user'}.

Situation:
- Child needs to be picked up at ${occurringTime} today
- Partner is busy due to: ${risk.context.description}
- Need to notify the available person to handle pickup

Generate a short, friendly notification message letting them know they need to pick up today.`;
  }

  if (risk.type === 'schedule_overlap') {
    return `Generate a message.

Situation:
- System detected a schedule overlap at ${occurringTime}
- Details: ${risk.context.description}

Generate a short reminder message.`;
  }

  // Generic fallback
  return `Generate a message.

Situation:
- Risk type: ${risk.type}
- Time: ${occurringTime}
- Details: ${risk.context.description}

Generate a short reminder message.`;
}

// ============================================
// Helper Functions
// ============================================

function formatTime(date: Date, language: Language): string {
  if (language === 'zh-TW') {
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const period = hours < 12 ? '上午' : '下午';
    const displayHour = hours > 12 ? hours - 12 : hours;
    return `${period}${displayHour}:${minutes}`;
  }

  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// ============================================
// Resolution Message Update
// ============================================

export async function generateAndUpdateResolutionMessage(
  resolutionId: string
): Promise<string> {
  const resolutionDoc = await db().collection('resolutions').doc(resolutionId).get();
  if (!resolutionDoc.exists) {
    throw new Error(`Resolution ${resolutionId} not found`);
  }

  const resolution = resolutionDoc.data() as Resolution;

  const riskDoc = await db().collection('risks').doc(resolution.riskId).get();
  if (!riskDoc.exists) {
    throw new Error(`Risk ${resolution.riskId} not found`);
  }

  const risk = riskDoc.data() as Risk;

  const rulesDoc = await db().collection('familyRules').doc(resolution.familyId).get();
  if (!rulesDoc.exists) {
    throw new Error(`Family rules for ${resolution.familyId} not found`);
  }

  const rules = rulesDoc.data() as FamilyRules;

  // Generate message
  const generated = await generateMessage({ risk, resolution, rules });

  // Update resolution with generated message
  await db().collection('resolutions').doc(resolutionId).update({
    message: generated.message,
  });

  return generated.message;
}

// ============================================
// Apology Message Generation (for Rollback)
// ============================================

export interface ApologyMessageInput {
  originalMessage: string;
  recipientName: string;
  rules: FamilyRules;
}

export async function generateApologyMessage(
  input: ApologyMessageInput
): Promise<string> {
  const { originalMessage, recipientName, rules } = input;

  const openai = getOpenAIClient();

  const systemPrompt = rules.language === 'zh-TW'
    ? `你是一個家庭協調系統的訊息生成器。
你的任務是生成一則道歉訊息，因為之前的訊息是系統誤判。

重要規則：
1. 語氣要真誠、友善
2. 訊息要簡短（1-2句話）
3. 承認是系統的錯誤，不是收件人的問題
4. 直接開始訊息內容，不要加入前綴

語言：繁體中文`
    : `You are a message generator for a family coordination system.
Your task is to generate an apology message because the previous message was a system error.

Important rules:
1. Be sincere and friendly
2. Keep it short (1-2 sentences)
3. Acknowledge it was the system's mistake, not the recipient's fault
4. Start with message content directly, no prefixes

Language: English`;

  const userPrompt = rules.language === 'zh-TW'
    ? `之前發送的訊息：「${originalMessage}」

這則訊息是誤發的，需要向${recipientName}道歉並說明不用理會之前的訊息。
請生成一則簡短的道歉訊息。`
    : `Previous message sent: "${originalMessage}"

This message was sent by mistake. Need to apologize to ${recipientName} and explain to ignore the previous message.
Generate a short apology message.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 150,
  });

  return response.choices[0]?.message?.content?.trim() ||
    (rules.language === 'zh-TW'
      ? '抱歉，剛才的訊息請忽略，是系統誤發的。'
      : 'Sorry, please ignore the previous message. It was sent by mistake.');
}

// ============================================
// Audit Log Explanation
// ============================================

export interface AuditExplanation {
  what: string;
  why: string;
  outcome: string;
}

export async function generateAuditExplanation(
  risk: Risk,
  resolution: Resolution,
  wasVetoed: boolean,
  language: Language
): Promise<AuditExplanation> {
  if (language === 'zh-TW') {
    return {
      what: wasVetoed
        ? `已取消發送訊息給${resolution.recipient}`
        : `已發送訊息給${resolution.recipient}`,
      why: risk.context.description,
      outcome: wasVetoed ? '已被用戶阻止' : '已自動執行',
    };
  }

  return {
    what: wasVetoed
      ? `Cancelled message to ${resolution.recipient}`
      : `Sent message to ${resolution.recipient}`,
    why: risk.context.description,
    outcome: wasVetoed ? 'Vetoed by user' : 'Executed automatically',
  };
}
