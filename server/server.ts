/**
 * Event Importer — parsing server.
 *
 * POST /parse-event
 *   Body:  { rawText?: string, imageBase64?: string, userTimezone?: string }
 *          At least one of rawText or imageBase64 must be present.
 *   Reply: ParsedEvent (JSON) — includes method: "text" | "vision"
 *
 * GET /health
 *   Returns { status: "ok", model, visionModel, keyConfigured }
 *
 * Strategy:
 *   Stage A — text-only parse (if rawText provided).
 *   Stage B — vision parse (if imageBase64 provided AND Stage A confidence < 0.75
 *             OR any reasoningFlag is true). Falls back gracefully.
 *
 * Setup:
 *   1. cp .env.example .env
 *   2. Add your OPENAI_API_KEY to .env
 *   3. npm install
 *   4. npm run dev
 */
import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

// ── Config ────────────────────────────────────────────────────────────────────

const PORT         = Number(process.env.PORT ?? 3001);
const MODEL        = process.env.OPENAI_MODEL        ?? 'gpt-4o-mini';
const VISION_MODEL = process.env.OPENAI_VISION_MODEL ?? 'gpt-4o';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';

// ── Express setup ─────────────────────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ── OpenAI client — lazy so the server starts even without a key ──────────────

function getOpenAiClient(): OpenAI {
  if (!OPENAI_API_KEY) {
    throw new Error(
      'OPENAI_API_KEY is not configured. ' +
      'Copy server/.env.example to server/.env, add your key, and restart.',
    );
  }
  return new OpenAI({ apiKey: OPENAI_API_KEY });
}

// ── Shared extraction rules (used in both prompts) ────────────────────────────

const EXTRACTION_RULES = `\
Extraction rules:
1. title — pick the event name, not the brand/sponsor name. Prefer the largest /
   most prominent wording. Prefer words like "festival", "concert", "party",
   "show", "launch", "gala", "opening". Ignore "presented by X", "sponsored by X".
   Do NOT use venue names or social media handles as the title.
2. date — prefer future dates when the year is ambiguous; format YYYY-MM-DD;
   use empty string "" if absent.
3. startTime / endTime — 24-hour HH:MM format. If an explicit end time is in
   the text, use it. If only start time is present, set endTime = startTime + 1 h.
   Both must be empty string "" if no time information exists.
4. location — combine venue name + street address + city/state/zip into one
   string when multiple parts are present (e.g. "The Paramount, 713 Congress Ave,
   Austin, TX 78701"). Empty string "" if absent.
5. notes — promotional phrases, hashtags, social handles, ticket prices,
   dress codes, age restrictions, website URLs, sponsor names.
6. confidence — 1.0 means all four key fields (title, date, time, location) were
   found with high certainty. Subtract 0.25 for each missing or uncertain key field.
7. reasoningFlags — set missingTime/missingDate/missingLocation to true whenever
   the corresponding field was absent or too ambiguous to extract reliably.`;

const JSON_SCHEMA = `\
Return ONLY a valid JSON object — no markdown fences, no explanation, no extra keys.

Required JSON schema:
{
  "title": "<primary event name>",
  "date": "<YYYY-MM-DD or empty string>",
  "startTime": "<HH:MM 24-hour or empty string>",
  "endTime": "<HH:MM 24-hour or empty string>",
  "location": "<venue + address combined, or empty string>",
  "notes": "<misc text — promos, prices, social media, sponsors — max 500 chars>",
  "confidence": <float 0.0–1.0>,
  "reasoningFlags": {
    "missingTime": <boolean>,
    "missingDate": <boolean>,
    "missingLocation": <boolean>
  }
}`;

// ── Text-only prompt ──────────────────────────────────────────────────────────

const TEXT_SYSTEM_PROMPT = `\
You are a specialized event data extractor. You receive raw OCR text from an event flyer or poster and must extract structured event information.

${JSON_SCHEMA}

${EXTRACTION_RULES}`;

function buildTextUserPrompt(rawText: string, tz: string, today: string): string {
  return `Today: ${today}\nUser timezone: ${tz}\n\nOCR text from event flyer:\n${rawText}`;
}

// ── Vision prompt ─────────────────────────────────────────────────────────────

const VISION_SYSTEM_PROMPT = `\
You are a specialized event data extractor. You receive an image of an event flyer or poster and must extract structured event information. You may also receive supplementary OCR text — treat it as extra context, but trust what you visually read in the image.

${JSON_SCHEMA}

${EXTRACTION_RULES}`;

function buildVisionMessages(
  imageBase64: string,
  tz: string,
  today: string,
  rawText?: string,
): OpenAI.Chat.ChatCompletionMessageParam[] {
  const textContext = rawText?.trim()
    ? `\n\nSupplementary OCR text (use as additional context):\n${rawText.trim()}`
    : '';

  const userText = `Today: ${today}\nUser timezone: ${tz}${textContext}\n\nExtract the event details from this image.`;

  return [
    { role: 'system', content: VISION_SYSTEM_PROMPT },
    {
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: imageBase64, detail: 'auto' } },
        { type: 'text', text: userText },
      ],
    },
  ];
}

// ── Output types & validation ─────────────────────────────────────────────────

interface ParsedEvent {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  notes: string;
  confidence: number;
  reasoningFlags: {
    missingTime: boolean;
    missingDate: boolean;
    missingLocation: boolean;
  };
  method: 'text' | 'vision';
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

function validateAndClean(raw: unknown, method: 'text' | 'vision'): ParsedEvent {
  if (!raw || typeof raw !== 'object') {
    throw new Error('LLM response is not a JSON object');
  }
  const r = raw as Record<string, unknown>;

  const str  = (v: unknown, fallback = '') => (typeof v === 'string' ? v.trim() : fallback);
  const bool = (v: unknown) => Boolean(v);

  const title     = str(r.title);
  const date      = typeof r.date === 'string' && (r.date === '' || DATE_RE.test(r.date))
                    ? r.date : '';
  const startTime = typeof r.startTime === 'string' && (r.startTime === '' || TIME_RE.test(r.startTime))
                    ? r.startTime : '';
  const endTime   = typeof r.endTime === 'string' && (r.endTime === '' || TIME_RE.test(r.endTime))
                    ? r.endTime : '';
  const location  = str(r.location);
  const notes     = str(r.notes).substring(0, 500);
  const confidence = typeof r.confidence === 'number'
                     ? Math.max(0, Math.min(1, r.confidence))
                     : 0.5;

  const flags = r.reasoningFlags && typeof r.reasoningFlags === 'object'
    ? (r.reasoningFlags as Record<string, unknown>)
    : {};

  return {
    title,
    date,
    startTime,
    endTime,
    location,
    notes,
    confidence,
    reasoningFlags: {
      missingTime:     bool(flags.missingTime),
      missingDate:     bool(flags.missingDate),
      missingLocation: bool(flags.missingLocation),
    },
    method,
  };
}

// ── LLM call helpers ──────────────────────────────────────────────────────────

async function callLlmText(
  openai: OpenAI,
  rawText: string,
  tz: string,
  today: string,
): Promise<ParsedEvent> {
  const completion = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.1,
    response_format: { type: 'json_object' },
    max_tokens: 512,
    messages: [
      { role: 'system', content: TEXT_SYSTEM_PROMPT },
      { role: 'user',   content: buildTextUserPrompt(rawText.trim(), tz, today) },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? '';
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch {
    throw new Error('Text LLM returned invalid JSON');
  }
  return validateAndClean(parsed, 'text');
}

async function callLlmVision(
  openai: OpenAI,
  imageBase64: string,
  rawText: string | undefined,
  tz: string,
  today: string,
): Promise<ParsedEvent> {
  const completion = await openai.chat.completions.create({
    model: VISION_MODEL,
    temperature: 0.1,
    response_format: { type: 'json_object' },
    max_tokens: 512,
    messages: buildVisionMessages(imageBase64, tz, today, rawText),
  });

  const raw = completion.choices[0]?.message?.content ?? '';
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch {
    throw new Error('Vision LLM returned invalid JSON');
  }
  return validateAndClean(parsed, 'vision');
}

function needsVisionFallback(result: ParsedEvent): boolean {
  return (
    result.confidence < 0.75 ||
    result.reasoningFlags.missingDate ||
    result.reasoningFlags.missingTime ||
    result.reasoningFlags.missingLocation
  );
}

// ── Routes ────────────────────────────────────────────────────────────────────

app.post('/parse-event', async (req: Request, res: Response): Promise<void> => {
  const { rawText, imageBase64, userTimezone } = req.body as {
    rawText?: unknown;
    imageBase64?: unknown;
    userTimezone?: unknown;
  };

  const hasText  = typeof rawText    === 'string' && rawText.trim().length > 0;
  const hasImage = typeof imageBase64 === 'string' && imageBase64.startsWith('data:image/');

  if (!hasText && !hasImage) {
    res.status(400).json({ error: 'Provide rawText and/or imageBase64 (data URI).' });
    return;
  }
  if (hasText && (rawText as string).length > 20_000) {
    res.status(400).json({ error: 'rawText is too long (max 20 000 characters)' });
    return;
  }
  if (hasImage && (imageBase64 as string).length > 8_000_000) {
    res.status(400).json({ error: 'imageBase64 is too large (max ~6 MB image)' });
    return;
  }

  let openai: OpenAI;
  try {
    openai = getOpenAiClient();
  } catch (err) {
    res.status(503).json({ error: (err as Error).message });
    return;
  }

  const today = new Date().toISOString().split('T')[0]!;
  const tz    = typeof userTimezone === 'string' && userTimezone ? userTimezone : 'UTC';

  try {
    let result: ParsedEvent;

    if (hasText) {
      // Stage A — text parse
      result = await callLlmText(openai, rawText as string, tz, today);
      console.log(`[parse-event] Stage A (text)  confidence=${result.confidence.toFixed(2)}  flags=${JSON.stringify(result.reasoningFlags)}`);

      if (hasImage && needsVisionFallback(result)) {
        // Stage B — vision parse
        console.log(`[parse-event] → Triggering Stage B (vision) model=${VISION_MODEL}`);
        try {
          result = await callLlmVision(openai, imageBase64 as string, rawText as string, tz, today);
          console.log(`[parse-event] Stage B (vision) confidence=${result.confidence.toFixed(2)}`);
        } catch (visionErr) {
          const vMsg = visionErr instanceof Error ? visionErr.message : String(visionErr);
          console.warn(`[parse-event] Vision fallback failed (${vMsg}), using Stage A result`);
          // Keep Stage A result
        }
      }
    } else {
      // No text — go straight to vision
      console.log(`[parse-event] Direct Stage B (vision) model=${VISION_MODEL}`);
      result = await callLlmVision(openai, imageBase64 as string, undefined, tz, today);
      console.log(`[parse-event] Stage B (vision) confidence=${result.confidence.toFixed(2)}`);
    }

    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[parse-event] error:', msg);
    res.status(500).json({ error: `LLM request failed: ${msg}` });
  }
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    model: MODEL,
    visionModel: VISION_MODEL,
    keyConfigured: Boolean(OPENAI_API_KEY),
  });
});

// ── Google Calendar helpers ────────────────────────────────────────────────────

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_ONLY_RE = /^\d{2}:\d{2}$/;

function addOneHour(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + (m ?? 0) + 60;
  const newH = Math.floor(total / 60) % 24;
  const newM = total % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

// ── POST /create-event ────────────────────────────────────────────────────────

app.post('/create-event', async (req: Request, res: Response): Promise<void> => {
  const { accessToken, calendarId, event } = req.body as {
    accessToken?: unknown;
    calendarId?: unknown;
    event?: unknown;
  };

  // Validate accessToken
  if (typeof accessToken !== 'string' || !accessToken.trim()) {
    res.status(400).json({ error: 'accessToken is required.' });
    return;
  }

  // Validate event object
  if (!event || typeof event !== 'object') {
    res.status(400).json({ error: 'event object is required.' });
    return;
  }

  const e = event as Record<string, unknown>;
  const title     = typeof e.title     === 'string' ? e.title.trim()     : '';
  const date      = typeof e.date      === 'string' ? e.date.trim()      : '';
  const startTime = typeof e.startTime === 'string' ? e.startTime.trim() : '';
  const endTime   = typeof e.endTime   === 'string' ? e.endTime.trim()   : '';
  const location  = typeof e.location  === 'string' ? e.location.trim()  : '';
  const notes     = typeof e.notes     === 'string' ? e.notes.trim()     : '';
  const timezone  = typeof e.timezone  === 'string' && e.timezone.trim() ? e.timezone.trim() : 'America/Los_Angeles';

  if (!title)                        { res.status(400).json({ error: 'event.title is required.' });     return; }
  if (!DATE_ONLY_RE.test(date))      { res.status(400).json({ error: 'event.date must be YYYY-MM-DD.' }); return; }
  if (!TIME_ONLY_RE.test(startTime)) { res.status(400).json({ error: 'event.startTime must be HH:MM.' }); return; }

  const resolvedCalId = typeof calendarId === 'string' && calendarId.trim() ? calendarId.trim() : 'primary';
  const endTimeResolved = TIME_ONLY_RE.test(endTime) ? endTime : addOneHour(startTime);

  const gcalBody = {
    summary: title,
    ...(location && { location }),
    ...(notes    && { description: notes }),
    start: { dateTime: `${date}T${startTime}:00`, timeZone: timezone },
    end:   { dateTime: `${date}T${endTimeResolved}:00`, timeZone: timezone },
  };

  console.log(`[create-event] calendarId=${resolvedCalId} title="${title}" start=${date}T${startTime} tz=${timezone}`);

  try {
    const gcalRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(resolvedCalId)}/events`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(gcalBody),
      }
    );

    if (!gcalRes.ok) {
      const errBody = await gcalRes.json().catch(() => ({})) as { error?: { message?: string } };
      const gcalMsg = errBody?.error?.message ?? `Google Calendar returned ${gcalRes.status}`;
      console.warn(`[create-event] Google Calendar error ${gcalRes.status}: ${gcalMsg}`);
      res.status(gcalRes.status === 401 || gcalRes.status === 403 ? gcalRes.status : 502).json({ error: gcalMsg });
      return;
    }

    const created = await gcalRes.json() as {
      id: string; htmlLink: string; created: string; status: string;
    };

    console.log(`[create-event] Created eventId=${created.id} htmlLink=${created.htmlLink}`);

    res.json({
      calendarId: resolvedCalId,
      eventId:    created.id,
      htmlLink:   created.htmlLink,
      created:    created.created,
      status:     created.status,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[create-event] error:', msg);
    res.status(500).json({ error: `Calendar request failed: ${msg}` });
  }
});

// ── GET /calendars ────────────────────────────────────────────────────────────

app.get('/calendars', async (req: Request, res: Response): Promise<void> => {
  const { accessToken } = req.query as { accessToken?: string };

  if (!accessToken) {
    res.status(400).json({ error: 'accessToken query param is required.' });
    return;
  }

  try {
    const gcalRes = await fetch(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList',
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (!gcalRes.ok) {
      const errBody = await gcalRes.json().catch(() => ({})) as { error?: { message?: string } };
      const gcalMsg = errBody?.error?.message ?? `Google Calendar returned ${gcalRes.status}`;
      res.status(gcalRes.status === 401 || gcalRes.status === 403 ? gcalRes.status : 502).json({ error: gcalMsg });
      return;
    }

    const data = await gcalRes.json() as {
      items: Array<{ id: string; summary: string; primary?: boolean }>;
    };

    res.json(
      (data.items ?? []).map((c) => ({ id: c.id, summary: c.summary, primary: Boolean(c.primary) }))
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `Calendar list failed: ${msg}` });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n✓ Event parser server  →  http://localhost:${PORT}`);
  console.log(`  Text model:   ${MODEL}`);
  console.log(`  Vision model: ${VISION_MODEL}`);
  if (!OPENAI_API_KEY) {
    console.warn('  ⚠  OPENAI_API_KEY is not set — /parse-event will return 503');
    console.warn('     Copy server/.env.example → server/.env and add your key.\n');
  }
});
