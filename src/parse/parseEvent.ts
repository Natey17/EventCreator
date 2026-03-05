/**
 * Rule-based event field extraction — improved for poster / flyer layouts.
 *
 * Date / time    → chrono-node (handles natural language like "March 15 at 7 PM")
 * Title          → scored heuristic: prefers mixed-case, non-date, non-brand lines
 * Location       → venue-keyword regex + street-address pattern; combines two
 *                  consecutive address lines when appropriate
 * Notes          → everything else, capped at 500 chars
 * parseConfidence → 0–1 score reflecting how many fields were successfully found
 */
import * as chrono from 'chrono-node';

// ─── Types ────────────────────────────────────────────────────────────────────

export type EventDraft = {
  title: string;
  date: string;        // YYYY-MM-DD
  startTime: string;   // HH:MM  (24-hour)
  endTime: string;     // HH:MM  (24-hour; defaults to startTime + 1 h if absent)
  location: string;
  notes: string;
  rawText: string;
  imageUri: string;
  imageName?: string;
  /** 0–1 confidence that all major fields were successfully extracted. */
  parseConfidence: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatTime(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function addOneHour(timeStr: string): string {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date();
  d.setHours(h + 1, m, 0, 0);
  return formatTime(d);
}

// ─── Date / time heuristics ───────────────────────────────────────────────────

/** Returns true when the line is dominated by date/time tokens. */
function isDateDominant(line: string): boolean {
  const stripped = line.replace(/\s/g, '');
  if (stripped.length === 0) return true;

  // More than 45 % of non-space chars are digits or date-punctuation
  const dateLike = (line.match(/[\d:\/\-\.@,]|am\b|pm\b/gi) ?? []).length;
  if (dateLike / stripped.length > 0.45) return true;

  // Starts with a day or month name
  if (/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow)/i.test(line.trim())) {
    return true;
  }

  return false;
}

// ─── Title heuristics ─────────────────────────────────────────────────────────

/**
 * Lines that are almost certainly not event titles — social-media calls to
 * action, URLs, handles, or pure numeric strings.
 */
const UNLIKELY_TITLE_RE =
  /^(follow|like|share|subscribe|visit|rsvp|tickets?|free\s+admission|join\s+us|register|call\s+us|contact|doors?\s+open|presented\s+by|sponsored|brought\s+to\s+you|featuring|ft\.|www\.|http)/i;

/**
 * Score a line as a potential event title.
 * Returns -Infinity for disqualified lines; higher number = better candidate.
 */
function scoreTitleCandidate(line: string): number {
  // Hard disqualifiers
  if (line.length < 4 || line.length > 80) return Number.NEGATIVE_INFINITY;
  if (isDateDominant(line)) return Number.NEGATIVE_INFINITY;
  if (/^https?:\/\//i.test(line)) return Number.NEGATIVE_INFINITY;
  if (/^[@#]/.test(line)) return Number.NEGATIVE_INFINITY;
  if (UNLIKELY_TITLE_RE.test(line)) return Number.NEGATIVE_INFINITY;
  if (/\.(com|org|net|io|co|app)\b/i.test(line)) return Number.NEGATIVE_INFINITY;
  // Looks like a phone number
  if (/^\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}$/.test(line.trim())) return Number.NEGATIVE_INFINITY;

  let score = 0;

  // ── Length sweet-spot ──────────────────────────────────────────────────────
  if (line.length >= 8 && line.length <= 55) score += 2;
  else if (line.length >= 5 && line.length <= 70) score += 1;

  // ── Letter case ───────────────────────────────────────────────────────────
  const letters = line.match(/[a-zA-Z]/g) ?? [];
  const upperLetters = line.match(/[A-Z]/g) ?? [];
  const upperRatio = letters.length > 0 ? upperLetters.length / letters.length : 0;

  // Very short ALL-CAPS lines are usually brand names or section labels
  if (upperRatio > 0.85 && line.length < 22) score -= 3;
  // Longer ALL-CAPS is a possible headline — mild penalty only
  else if (upperRatio > 0.85) score -= 1;
  // Mixed case is the most title-like
  if (upperRatio > 0.05 && upperRatio < 0.65) score += 1;

  // ── Starts with capital ────────────────────────────────────────────────────
  if (/^[A-Z]/.test(line)) score += 0.5;

  // ── Excessive punctuation / symbols suggest decorative text ───────────────
  const symbols = (line.match(/[!@#$%^&*()+=[\]{}<>|\\]/g) ?? []).length;
  if (symbols > 1) score -= symbols * 0.5;

  return score;
}

// ─── Location heuristics ──────────────────────────────────────────────────────

/** Venue / building keyword patterns. */
const VENUE_KEYWORD_RE =
  /\b(room|hall|center|centre|court|complex|building|bldg|floor|suite|ste|plaza|park|arena|auditorium|theater|theatre|amphitheater|gym|gymnasium|library|church|cathedral|stadium|convention|hotel|inn|resort|campus|university|college|school|ballroom|pavilion|lounge|rooftop|gallery|venue|club|bar|pub|cafe|restaurant|warehouse|loft|space)\b/i;

/** Street-address pattern: number + street name + type abbreviation. */
const STREET_ADDRESS_RE =
  /\b\d{1,5}\s+\w[\w\s]{1,30}\s+(st\.?|street|ave\.?|avenue|blvd\.?|boulevard|rd\.?|road|dr\.?|drive|ln\.?|lane|ct\.?|court|pl\.?|place|way|pkwy\.?|parkway|hwy\.?|highway)\b/i;

/** City, State / City, ST ZIP. */
const CITY_STATE_RE =
  /\b[A-Z][a-zA-Z\s]{1,25},\s*[A-Z]{2}(\s+\d{5}(-\d{4})?)?\b/;

function isLocationLine(line: string): boolean {
  return (
    VENUE_KEYWORD_RE.test(line) ||
    STREET_ADDRESS_RE.test(line) ||
    CITY_STATE_RE.test(line)
  );
}

// ─── Main parser ──────────────────────────────────────────────────────────────

export function parseEvent(
  rawText: string,
  imageUri: string,
  imageName?: string,
): EventDraft {
  // Split into non-empty trimmed lines
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // ── 1. Date / time via chrono-node ─────────────────────────────────────────
  const now = new Date();
  // Try forwardDate first (most useful for future event flyers)
  let chronoResults = chrono.parse(rawText, now, { forwardDate: true });
  // Retry without the constraint if nothing was found
  if (chronoResults.length === 0) {
    chronoResults = chrono.parse(rawText, now);
  }

  // Among multiple results, prefer the one that includes a time component
  const bestChronoResult =
    chronoResults.find((r) => r.start.isCertain('hour')) ??
    chronoResults[0] ??
    null;

  let date = '';
  let startTime = '';
  let endTime = '';

  if (bestChronoResult) {
    const startDate = bestChronoResult.start.date();
    date = formatDate(startDate);

    if (bestChronoResult.start.isCertain('hour')) {
      startTime = formatTime(startDate);
    }

    if (bestChronoResult.end) {
      endTime = formatTime(bestChronoResult.end.date());
    } else if (startTime) {
      endTime = addOneHour(startTime);
    }
  }

  // ── 2. Title: highest-scored non-date, non-URL line ────────────────────────
  let title = '';
  let bestTitleScore = Number.NEGATIVE_INFINITY;

  for (const line of lines) {
    const s = scoreTitleCandidate(line);
    if (s > bestTitleScore) {
      bestTitleScore = s;
      title = line;
    }
  }
  // If nothing scored, clear so the user fills it manually
  if (bestTitleScore === Number.NEGATIVE_INFINITY) title = '';

  // ── 3. Location: venue keyword or street address ────────────────────────────
  let location = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === title) continue;
    if (!isLocationLine(line)) continue;

    location = line;

    // Attempt to combine with the following line if it looks like a city/state
    // continuation (e.g. "123 Main St" followed by "Austin, TX 78701")
    const next = lines[i + 1];
    if (
      next &&
      next !== title &&
      next !== line &&
      (CITY_STATE_RE.test(next) || STREET_ADDRESS_RE.test(next)) &&
      !isDateDominant(next)
    ) {
      location = `${line}, ${next}`;
    }

    break;
  }

  // ── 4. Notes: everything not already used ─────────────────────────────────
  const usedLines = new Set([title].filter(Boolean));

  // Mark both parts of a combined two-liner location as used
  if (location) {
    const locationParts = location.split(', ');
    locationParts.forEach((part) => usedLines.add(part));
    usedLines.add(location);
  }

  const noteLines = lines.filter((l) => !usedLines.has(l));
  const notes = noteLines.join('\n').trim().substring(0, 500);

  // ── 5. Parsing confidence score ────────────────────────────────────────────
  let parseConfidence = 0;
  if (title)     parseConfidence += 0.25;
  if (date)      parseConfidence += 0.30;
  if (startTime) parseConfidence += 0.25;
  if (location)  parseConfidence += 0.20;

  return {
    title,
    date,
    startTime,
    endTime,
    location,
    notes,
    rawText,
    imageUri,
    imageName,
    parseConfidence,
  };
}
