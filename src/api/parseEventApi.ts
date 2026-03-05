/**
 * Frontend API module — calls the local parsing server.
 *
 * Server URL is read from EXPO_PUBLIC_SERVER_URL (set in your .env file).
 * Falls back to http://localhost:3001 for local development.
 */
import { imageUriToBase64 } from '../utils/imageToBase64';

export type ReasoningFlags = {
  missingTime: boolean;
  missingDate: boolean;
  missingLocation: boolean;
};

export type AiEventDraft = {
  title: string;
  date: string;        // YYYY-MM-DD or ""
  startTime: string;   // HH:MM or ""
  endTime: string;     // HH:MM or ""
  location: string;
  notes: string;
  confidence: number;  // 0–1
  reasoningFlags: ReasoningFlags;
  method: 'text' | 'vision';
};

// Expo exposes EXPO_PUBLIC_* vars at bundle time.
const SERVER_URL =
  (typeof process !== 'undefined' && process.env.EXPO_PUBLIC_SERVER_URL) ||
  'http://localhost:3001';

export interface ParseEventOptions {
  /** OCR text extracted from the image. */
  rawText?: string;
  /** Local image URI (blob:, file://, or data:). Converted to base64 and sent to the server. */
  imageUri?: string;
  /** IANA timezone string, e.g. "America/Chicago". Defaults to UTC if omitted. */
  userTimezone?: string;
}

/**
 * Send OCR text and/or an image to the backend and get structured event fields back.
 * The server runs a 2-stage strategy: text first (cheap), vision fallback (if needed).
 * Throws on network error or non-2xx response.
 */
export async function parseEventWithAi(opts: ParseEventOptions): Promise<AiEventDraft> {
  const { rawText, imageUri, userTimezone } = opts;

  // Convert imageUri to a base64 data URI so it can be sent over JSON.
  let imageBase64: string | undefined;
  if (imageUri) {
    try {
      imageBase64 = await imageUriToBase64(imageUri);
    } catch {
      // If conversion fails we proceed without the image — text-only fallback.
      console.warn('[parseEventApi] Could not convert imageUri to base64; proceeding text-only.');
    }
  }

  const body: Record<string, string> = {};
  if (rawText)      body.rawText      = rawText;
  if (imageBase64)  body.imageBase64  = imageBase64;
  if (userTimezone) body.userTimezone = userTimezone;

  const response = await fetch(`${SERVER_URL}/parse-event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let errMsg = `Server returned ${response.status}`;
    try {
      const data = (await response.json()) as { error?: string };
      if (typeof data.error === 'string') errMsg = data.error;
    } catch { /* ignore parse errors */ }
    throw new Error(errMsg);
  }

  return response.json() as Promise<AiEventDraft>;
}
