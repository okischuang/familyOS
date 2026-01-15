/**
 * Calendar Module
 * Google Calendar integration for Laxie
 */

import { google, calendar_v3 } from 'googleapis';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import type { CalendarEvent, User } from '../types/index.js';

const db = () => getFirestore();

// ============================================
// OAuth Client Setup
// ============================================

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

// ============================================
// Token Management
// ============================================

export async function refreshAccessToken(user: User): Promise<string> {
  if (!user.googleCalendar?.refreshToken) {
    throw new Error('No refresh token available');
  }

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    refresh_token: user.googleCalendar.refreshToken,
  });

  const { credentials } = await oauth2Client.refreshAccessToken();

  // Update user's access token in Firestore
  await db().collection('users').doc(user.id).update({
    'googleCalendar.accessToken': credentials.access_token,
    'googleCalendar.tokenExpiry': Timestamp.fromMillis(credentials.expiry_date || Date.now() + 3600000),
  });

  return credentials.access_token!;
}

async function getValidAccessToken(user: User): Promise<string> {
  if (!user.googleCalendar) {
    throw new Error('Google Calendar not connected');
  }

  const now = Timestamp.now();
  const expiry = user.googleCalendar.tokenExpiry;

  // If token expires in less than 5 minutes, refresh it
  if (expiry.toMillis() - now.toMillis() < 5 * 60 * 1000) {
    return refreshAccessToken(user);
  }

  return user.googleCalendar.accessToken;
}

// ============================================
// Fetch Events (Busy/Free only)
// ============================================

export interface FetchEventsOptions {
  hoursAhead?: number;  // Default: 72 hours
}

export async function fetchCalendarEvents(
  user: User,
  options: FetchEventsOptions = {}
): Promise<CalendarEvent[]> {
  const { hoursAhead = 72 } = options;

  const accessToken = await getValidAccessToken(user);

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const now = new Date();
  const future = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

  const response = await calendar.events.list({
    calendarId: user.googleCalendar?.calendarId || 'primary',
    timeMin: now.toISOString(),
    timeMax: future.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 100,
  });

  const events = response.data.items || [];

  return events.map((event) => transformGoogleEvent(event, user));
}

// ============================================
// Transform Google Event to Internal Format
// ============================================

function transformGoogleEvent(
  event: calendar_v3.Schema$Event,
  user: User
): CalendarEvent {
  const startTime = event.start?.dateTime || event.start?.date;
  const endTime = event.end?.dateTime || event.end?.date;

  return {
    id: `google_${event.id}`,
    externalId: event.id || undefined,
    familyId: user.familyId,
    userId: user.id,
    source: 'google',
    title: event.summary || 'Untitled Event',
    description: event.description || undefined,
    startTime: Timestamp.fromDate(new Date(startTime!)),
    endTime: Timestamp.fromDate(new Date(endTime!)),
    location: event.location || undefined,
    // Busy if not explicitly marked as free
    isBusy: event.transparency !== 'transparent',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
}

// ============================================
// Sync Events to Firestore
// ============================================

export async function syncEventsToFirestore(
  userId: string,
  events: CalendarEvent[]
): Promise<{ added: number; updated: number }> {
  const batch = db().batch();
  let added = 0;
  let updated = 0;

  for (const event of events) {
    const eventRef = db().collection('events').doc(event.id);
    const existing = await eventRef.get();

    if (existing.exists) {
      batch.update(eventRef, {
        ...event,
        updatedAt: Timestamp.now(),
      });
      updated++;
    } else {
      batch.set(eventRef, event);
      added++;
    }
  }

  await batch.commit();

  return { added, updated };
}

// ============================================
// Get Events for Family (for Risk Detection)
// ============================================

export async function getFamilyEvents(
  familyId: string,
  startTime: Date,
  endTime: Date
): Promise<CalendarEvent[]> {
  const snapshot = await db()
    .collection('events')
    .where('familyId', '==', familyId)
    .where('startTime', '>=', Timestamp.fromDate(startTime))
    .where('startTime', '<=', Timestamp.fromDate(endTime))
    .orderBy('startTime')
    .get();

  return snapshot.docs.map((doc) => doc.data() as CalendarEvent);
}
