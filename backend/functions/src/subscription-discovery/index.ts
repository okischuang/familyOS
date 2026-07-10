/**
 * Subscription Discovery Agent
 *
 * The upstream perception step the waste Sensor assumed already existed: it
 * *finds* which subscriptions a family has, by reading subscription receipts /
 * renewal emails from Gmail and extracting structured Subscription records into
 * `subscriptions/`. The Subscription Sensor Agent then judges waste.
 *
 * Constitution alignment: rules-first. Recognition uses a deterministic
 * provider registry (known senders + receipt patterns) — no LLM, no token cost,
 * fully auditable. Unknown senders are simply not recognized yet (an LLM
 * fallback for arbitrary receipts is a documented future extension); we never
 * guess. And it requires no manual data entry (a Constitution Hard No) — the
 * family just connects Gmail once.
 *
 * Discovery finds that a subscription EXISTS and what it costs — NOT how much
 * it is used. Records are written with usageTracked=false so the Sensor does
 * not falsely flag them as waste before a usage signal exists.
 */

import { google, gmail_v1 } from 'googleapis';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import type {
  Subscription,
  SubscriptionCategory,
  BillingCycle,
  User,
} from '../types/index.js';
import { getValidAccessToken } from '../calendar/index.js';

const db = () => getFirestore();

// How far back to scan for receipts, and a cap per user.
const LOOKBACK = 'newer_than:1y';
const MAX_MESSAGES = 60;

// ============================================
// Provider registry (rules-first recognition)
// ============================================

interface ProviderRule {
  id: string;                      // stable id -> subscription doc `${familyId}_${id}`
  name: string;
  category: SubscriptionCategory;
  icon: string;
  currency: string;                // default currency if the receipt doesn't say
  billingCycle: BillingCycle;      // default cycle
  fromDomains: string[];           // sender domains that identify this provider
  subjectMatch?: RegExp;           // optional: only treat as a receipt if subject matches
}

const PROVIDERS: ProviderRule[] = [
  {
    id: 'netflix', name: 'Netflix', category: 'streaming', icon: '🎬',
    currency: 'TWD', billingCycle: 'monthly', fromDomains: ['netflix.com'],
    subjectMatch: /(receipt|payment|membership|訂閱|付款|收據)/i,
  },
  {
    id: 'spotify', name: 'Spotify', category: 'music', icon: '🎧',
    currency: 'TWD', billingCycle: 'monthly', fromDomains: ['spotify.com'],
    subjectMatch: /(receipt|payment|premium|訂閱|付款|收據)/i,
  },
  {
    id: 'disney-plus', name: 'Disney+', category: 'streaming', icon: '🏰',
    currency: 'TWD', billingCycle: 'monthly',
    fromDomains: ['disneyplus.com', 'disney.com', 'mail.disneyplus.com'],
  },
  {
    id: 'youtube-premium', name: 'YouTube Premium', category: 'streaming', icon: '📺',
    currency: 'TWD', billingCycle: 'monthly', fromDomains: ['youtube.com', 'google.com'],
    subjectMatch: /youtube premium/i,
  },
  {
    id: 'chatgpt', name: 'ChatGPT Plus', category: 'productivity', icon: '🤖',
    currency: 'USD', billingCycle: 'monthly', fromDomains: ['openai.com'],
    subjectMatch: /(receipt|subscription|payment|invoice)/i,
  },
  {
    id: 'icloud', name: 'iCloud+', category: 'cloud', icon: '☁️',
    currency: 'TWD', billingCycle: 'monthly',
    fromDomains: ['apple.com', 'email.apple.com'],
    subjectMatch: /(icloud|receipt|收據|subscription)/i,
  },
  {
    id: 'notion', name: 'Notion', category: 'productivity', icon: '📝',
    currency: 'USD', billingCycle: 'yearly',
    fromDomains: ['notion.so', 'mail.notion.so', 'notion.com'],
    subjectMatch: /(receipt|invoice|payment|subscription)/i,
  },
  {
    id: 'youtube-music', name: 'YouTube Music', category: 'music', icon: '🎵',
    currency: 'TWD', billingCycle: 'monthly', fromDomains: ['youtube.com', 'google.com'],
    subjectMatch: /youtube music/i,
  },
];

// ============================================
// Extraction (pure — unit-testable without Gmail)
// ============================================

export interface EmailInput {
  from: string;      // From header (may be "Name <addr@domain>")
  subject: string;
  text: string;      // plain-text body (or snippet)
  date: Date;        // email date (≈ last charge)
}

export interface DiscoveredSubscription {
  providerId: string;
  name: string;
  category: SubscriptionCategory;
  icon: string;
  amount: number;             // 0 when the receipt price couldn't be read
  currency: string;
  billingCycle: BillingCycle;
  lastChargeDate: Date;
  nextRenewalDate: Date;      // estimated: lastCharge + cycle
}

/**
 * Recognize a subscription from a single email. Returns null when no known
 * provider matches — we never guess.
 */
export function extractSubscription(email: EmailInput): DiscoveredSubscription | null {
  const provider = matchProvider(email);
  if (!provider) return null;

  const parsed = parseAmount(email.text, provider.currency);
  const billingCycle = detectCycle(`${email.subject}\n${email.text}`, provider.billingCycle);

  return {
    providerId: provider.id,
    name: provider.name,
    category: provider.category,
    icon: provider.icon,
    amount: parsed?.amount ?? 0,
    currency: parsed?.currency ?? provider.currency,
    billingCycle,
    lastChargeDate: email.date,
    nextRenewalDate: estimateNextRenewal(email.date, billingCycle),
  };
}

function matchProvider(email: EmailInput): ProviderRule | null {
  const from = email.from.toLowerCase();
  for (const p of PROVIDERS) {
    const senderMatches = p.fromDomains.some((d) => from.includes(`@${d}`) || from.includes(`.${d}`) || from.includes(d));
    if (!senderMatches) continue;
    if (p.subjectMatch && !p.subjectMatch.test(email.subject)) continue;
    return p;
  }
  return null;
}

/**
 * Pull the first plausible price out of receipt text. Tries TWD forms first
 * (NT$, NTD, TWD, 元), then USD ($, US$, USD).
 */
export function parseAmount(
  text: string,
  defaultCurrency: string
): { amount: number; currency: string } | null {
  const twd = text.match(/(?:NT\$|NTD|TWD)\s?([\d,]+(?:\.\d+)?)/i) || text.match(/([\d,]+)\s*元/);
  if (twd) {
    return { amount: toNumber(twd[1]), currency: 'TWD' };
  }
  const usd = text.match(/(?:US\$|USD|\$)\s?([\d,]+(?:\.\d{2})?)/i);
  if (usd) {
    return { amount: toNumber(usd[1]), currency: 'USD' };
  }
  const bare = text.match(/([\d,]+(?:\.\d{2})?)/);
  if (bare) {
    return { amount: toNumber(bare[1]), currency: defaultCurrency };
  }
  return null;
}

function toNumber(s: string): number {
  return Number(s.replace(/,/g, ''));
}

function detectCycle(text: string, fallback: BillingCycle): BillingCycle {
  if (/(annual|yearly|per year|\/\s?year|每年|年繳|年費)/i.test(text)) return 'yearly';
  if (/(quarterly|每季|季繳)/i.test(text)) return 'quarterly';
  if (/(weekly|每週|週繳|\/\s?week)/i.test(text)) return 'weekly';
  if (/(monthly|per month|\/\s?month|每月|月繳|月費)/i.test(text)) return 'monthly';
  return fallback;
}

export function estimateNextRenewal(lastCharge: Date, cycle: BillingCycle): Date {
  const d = new Date(lastCharge.getTime());
  switch (cycle) {
    case 'weekly':
      d.setDate(d.getDate() + 7);
      break;
    case 'monthly':
      d.setMonth(d.getMonth() + 1);
      break;
    case 'quarterly':
      d.setMonth(d.getMonth() + 3);
      break;
    case 'yearly':
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return d;
}

// ============================================
// Gmail I/O + discovery run
// ============================================

export interface DiscoveryResult {
  usersScanned: number;
  messagesScanned: number;
  subscriptionsDiscovered: number;
}

export async function runSubscriptionDiscovery(): Promise<DiscoveryResult> {
  const result: DiscoveryResult = {
    usersScanned: 0,
    messagesScanned: 0,
    subscriptionsDiscovered: 0,
  };

  // Users who have connected Google (the Gmail scope rides on the same grant).
  const usersSnapshot = await db()
    .collection('users')
    .where('googleCalendar.refreshToken', '!=', null)
    .get();

  for (const doc of usersSnapshot.docs) {
    const user = { id: doc.id, ...doc.data() } as User;
    try {
      const userResult = await discoverForUser(user);
      result.messagesScanned += userResult.messagesScanned;
      result.subscriptionsDiscovered += userResult.discovered;
      result.usersScanned++;
    } catch (error) {
      console.error(`Error discovering subscriptions for user ${user.id}:`, error);
    }
  }

  return result;
}

async function discoverForUser(
  user: User
): Promise<{ messagesScanned: number; discovered: number }> {
  const accessToken = await getValidAccessToken(user);
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: 'v1', auth });

  const domains = [...new Set(PROVIDERS.flatMap((p) => p.fromDomains))];
  const query = `${LOOKBACK} from:(${domains.join(' OR ')})`;

  const list = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults: MAX_MESSAGES,
  });

  const messages = list.data.messages ?? [];
  let discovered = 0;
  const seenProviders = new Set<string>(); // newest-first: keep the latest receipt per provider

  for (const msgRef of messages) {
    if (!msgRef.id) continue;

    const full = await gmail.users.messages.get({
      userId: 'me',
      id: msgRef.id,
      format: 'full',
    });

    const email = toEmailInput(full.data);
    if (!email) continue;

    const discoveredSub = extractSubscription(email);
    if (!discoveredSub) continue;
    if (seenProviders.has(discoveredSub.providerId)) continue; // already have a newer one
    seenProviders.add(discoveredSub.providerId);

    await upsertSubscription(user.familyId, discoveredSub);
    discovered++;
  }

  return { messagesScanned: messages.length, discovered };
}

function toEmailInput(message: gmail_v1.Schema$Message): EmailInput | null {
  const payload = message.payload;
  if (!payload) return null;

  const headers = payload.headers ?? [];
  const header = (name: string): string =>
    headers.find((h) => (h.name ?? '').toLowerCase() === name)?.value ?? '';

  const from = header('from');
  const subject = header('subject');
  if (!from) return null;

  const dateMs = message.internalDate ? Number(message.internalDate) : Date.now();
  const text = getPlainText(payload) || message.snippet || '';

  return { from, subject, text, date: new Date(dateMs) };
}

/** Walk MIME parts and concatenate decoded text/plain bodies. */
function getPlainText(part: gmail_v1.Schema$MessagePart): string {
  let out = '';
  if (part.mimeType === 'text/plain' && part.body?.data) {
    out += decodeBase64Url(part.body.data);
  }
  for (const child of part.parts ?? []) {
    out += `\n${getPlainText(child)}`;
  }
  return out;
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data, 'base64url').toString('utf-8');
}

// ============================================
// Persistence (discovery owns cost fields, not usage)
// ============================================

async function upsertSubscription(
  familyId: string,
  found: DiscoveredSubscription
): Promise<void> {
  const id = `${familyId}_${found.providerId}`;
  const ref = db().collection('subscriptions').doc(id);
  const existing = await ref.get();

  // Fields discovery is authoritative for.
  const discoveryFields = {
    name: found.name,
    category: found.category,
    icon: found.icon,
    amount: found.amount,
    currency: found.currency,
    billingCycle: found.billingCycle,
    nextRenewalDate: Timestamp.fromDate(found.nextRenewalDate),
    detectedFrom: 'email' as const,
    updatedAt: Timestamp.now(),
  };

  if (existing.exists) {
    // Don't clobber usage fields — those belong to usage tracking.
    await ref.update(discoveryFields);
    return;
  }

  const sub: Subscription = {
    id,
    familyId,
    ...discoveryFields,
    startedDate: Timestamp.fromDate(found.lastChargeDate),
    usagePerMonth: 0,
    usageTracked: false, // discovery doesn't measure usage
    autoRenew: true,
    status: 'active',
    createdAt: Timestamp.now(),
  };
  await ref.set(sub);
}
