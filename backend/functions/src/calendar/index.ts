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

function getOAuth2Client(redirectUri?: string) {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri || process.env.GOOGLE_REDIRECT_URI
  );
}

// ============================================
// OAuth Flow
// ============================================

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events.readonly',
  // Read-only Gmail access powers the Subscription Discovery Agent (finds
  // subscription receipts). Users must re-consent to grant this scope.
  'https://www.googleapis.com/auth/gmail.readonly',
];

/**
 * Generate authorization URL for Google OAuth
 */
export function getAuthorizationUrl(userId: string, redirectUri: string): string {
  const oauth2Client = getOAuth2Client(redirectUri);

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // Force consent to get refresh token
    state: userId, // Pass userId to callback
  });

  return url;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  code: string,
  userId: string,
  redirectUri: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const oauth2Client = getOAuth2Client(redirectUri);
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      return { success: false, error: 'No refresh token received. Please revoke access and try again.' };
    }

    // Get user's primary calendar ID
    oauth2Client.setCredentials(tokens);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const calendarList = await calendar.calendarList.get({ calendarId: 'primary' });

    // Store tokens in Firestore
    await db().collection('users').doc(userId).update({
      'googleCalendar.accessToken': tokens.access_token,
      'googleCalendar.refreshToken': tokens.refresh_token,
      'googleCalendar.tokenExpiry': Timestamp.fromMillis(tokens.expiry_date || Date.now() + 3600000),
      'googleCalendar.calendarId': calendarList.data.id || 'primary',
      'googleCalendar.connectedAt': Timestamp.now(),
    });

    console.log(`Google Calendar connected for user ${userId}`);
    return { success: true };
  } catch (error) {
    console.error('Error exchanging code for tokens:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Disconnect Google Calendar
 */
export async function disconnectCalendar(userId: string): Promise<void> {
  const userRef = db().collection('users').doc(userId);
  const user = await userRef.get();

  if (user.exists && user.data()?.googleCalendar?.accessToken) {
    // Revoke the token
    try {
      const oauth2Client = getOAuth2Client();
      oauth2Client.setCredentials({
        access_token: user.data()?.googleCalendar.accessToken,
      });
      await oauth2Client.revokeCredentials();
    } catch (error) {
      console.error('Error revoking token:', error);
      // Continue anyway - token might already be invalid
    }
  }

  // Remove calendar data from user
  await userRef.update({
    googleCalendar: null,
  });

  console.log(`Google Calendar disconnected for user ${userId}`);
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

export async function getValidAccessToken(user: User): Promise<string> {
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

  // Build event object, excluding undefined values (Firestore doesn't accept undefined)
  const calendarEvent: CalendarEvent = {
    id: `google_${event.id}`,
    familyId: user.familyId,
    userId: user.id,
    source: 'google',
    title: event.summary || 'Untitled Event',
    startTime: Timestamp.fromDate(new Date(startTime!)),
    endTime: Timestamp.fromDate(new Date(endTime!)),
    isBusy: event.transparency !== 'transparent',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  // Only add optional fields if they have values
  if (event.id) calendarEvent.externalId = event.id;
  if (event.description) calendarEvent.description = event.description;
  if (event.location) calendarEvent.location = event.location;

  return calendarEvent;
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
