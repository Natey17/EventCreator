/**
 * Frontend API module — creates a Google Calendar event via the local server.
 * The server proxies to Google Calendar so the accessToken never hits CORS.
 */

const SERVER_URL =
  (typeof process !== 'undefined' && process.env.EXPO_PUBLIC_SERVER_URL) ||
  'http://localhost:3001';

export interface CalendarEventPayload {
  title: string;
  date: string;       // YYYY-MM-DD
  startTime: string;  // HH:MM (24h)
  endTime?: string;   // HH:MM (24h) — defaults to startTime + 1 h if absent
  location?: string;
  notes?: string;
  timezone?: string;  // IANA e.g. "America/Chicago"; defaults to "America/Los_Angeles"
}

export interface CreatedCalendarEvent {
  calendarId: string;
  eventId: string;
  htmlLink: string;
  created: string;
  status: string;
}

/** Create a Google Calendar event. Throws on network error or non-2xx response. */
export async function createCalendarEvent(
  accessToken: string,
  calendarId: string,
  event: CalendarEventPayload,
): Promise<CreatedCalendarEvent> {
  const response = await fetch(`${SERVER_URL}/create-event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken, calendarId, event }),
  });

  if (!response.ok) {
    let errMsg = `Server returned ${response.status}`;
    try {
      const data = (await response.json()) as { error?: string };
      if (typeof data.error === 'string') errMsg = data.error;
    } catch { /* ignore */ }
    // Surface the status code so callers can detect auth errors
    throw Object.assign(new Error(errMsg), { status: response.status });
  }

  return response.json() as Promise<CreatedCalendarEvent>;
}

export interface CalendarListItem {
  id: string;
  summary: string;
  primary: boolean;
}

/** List all calendars for the authenticated user. */
export async function listCalendars(accessToken: string): Promise<CalendarListItem[]> {
  const response = await fetch(
    `${SERVER_URL}/calendars?accessToken=${encodeURIComponent(accessToken)}`,
  );

  if (!response.ok) {
    let errMsg = `Server returned ${response.status}`;
    try {
      const data = (await response.json()) as { error?: string };
      if (typeof data.error === 'string') errMsg = data.error;
    } catch { /* ignore */ }
    throw new Error(errMsg);
  }

  return response.json() as Promise<CalendarListItem[]>;
}
