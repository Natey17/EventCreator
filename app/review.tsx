import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Switch,
  Linking,
  Animated,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/theme/ThemeContext';
import { useAuth } from '../src/auth/AuthContext';
import { spacing, borderRadius } from '../src/theme/spacing';
import { typography } from '../src/theme/typography';
import { AppBar } from '../src/components/AppBar';
import { Button } from '../src/components/Button';
import { addEvent } from '../src/storage/events';
import { ImportedEvent } from '../src/types';
import { runOcr, OCR_SUPPORTED, OcrProgress } from '../src/ocr/ocr';
import { parseEvent } from '../src/parse/parseEvent';
import { parseEventWithAi, ReasoningFlags } from '../src/api/parseEventApi';
import { createCalendarEvent } from '../src/api/createCalendarEventApi';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

function friendlyOcrStatus(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes('preprocess')) return 'Preprocessing image…';
  if (s.includes('load') && (s.includes('core') || s.includes('engine'))) return 'Loading OCR engine…';
  if (s.includes('language') || s.includes('traineddata')) return 'Loading language data…';
  if (s.includes('recogniz')) return 'Recognising text…';
  if (s.includes('initializ')) return 'Initialising…';
  if (s === 'done') return 'Done';
  return raw || 'Working…';
}

function openUrl(url: string) {
  if (Platform.OS === 'web') {
    window.open(url, '_blank');
  } else {
    Linking.openURL(url);
  }
}

// ─── State types ──────────────────────────────────────────────────────────────

type OcrState =
  | { phase: 'idle' }
  | { phase: 'running'; progress: number; statusText: string }
  | { phase: 'done'; rawText: string; confidence: number; parseConfidence: number }
  | { phase: 'error'; message: string }
  | { phase: 'unsupported' };

type AiParseState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'done'; confidence: number; reasoningFlags: ReasoningFlags; method: 'text' | 'vision' }
  | { phase: 'error'; message: string };

type ImportState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'success'; eventId: string; calendarId: string; htmlLink: string }
  | { phase: 'error'; message: string; isAuthError: boolean };

// ─── Field component ──────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  colors: ReturnType<typeof useTheme>['colors'];
  missing?: boolean;
}

function Field({ label, value, onChangeText, placeholder, multiline = false, icon, colors, missing }: FieldProps) {
  const [focused, setFocused] = useState(false);
  const borderColor = focused
    ? colors.primary
    : missing && !value.trim()
    ? '#F59E0B'
    : colors.border;
  const iconColor = focused
    ? colors.primary
    : missing && !value.trim()
    ? '#F59E0B'
    : colors.textSecondary;

  return (
    <View
      style={[
        fieldStyles.container,
        { borderColor, backgroundColor: colors.surface },
      ]}
    >
      <Ionicons name={icon} size={18} color={iconColor} style={fieldStyles.icon} />
      <View style={fieldStyles.inner}>
        <Text style={[fieldStyles.label, { color: focused ? colors.primary : colors.textSecondary }]}>
          {label}
        </Text>
        <TextInput
          style={[
            fieldStyles.input,
            { color: colors.text },
            multiline && { minHeight: 64, textAlignVertical: 'top' },
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textDisabled}
          multiline={multiline}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          returnKeyType={multiline ? 'default' : 'next'}
        />
      </View>
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1.5,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm + 2,
    paddingBottom: spacing.sm,
    marginBottom: spacing.sm,
  },
  icon: {
    marginTop: 20,
    marginRight: spacing.sm,
  },
  inner: {
    flex: 1,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  input: {
    fontSize: 16,
    paddingVertical: 4,
    lineHeight: 22,
  },
});

// ─── OCR status card ──────────────────────────────────────────────────────────

interface OcrCardProps {
  ocrState: OcrState;
  onRerun: () => void;
  suppressParseWarning: boolean;
  colors: ReturnType<typeof useTheme>['colors'];
}

function OcrCard({ ocrState, onRerun, suppressParseWarning, colors }: OcrCardProps) {
  const [showRawText, setShowRawText] = useState(false);

  if (ocrState.phase === 'idle') return null;

  if (ocrState.phase === 'unsupported') {
    return (
      <View style={[statusCard.card, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}>
        <View style={statusCard.row}>
          <Ionicons name="phone-portrait-outline" size={16} color={colors.textSecondary} />
          <Text style={[typography.body2, { color: colors.textSecondary, marginLeft: spacing.xs, flex: 1 }]}>
            OCR is not yet available on mobile — fill in the details manually.
          </Text>
        </View>
      </View>
    );
  }

  if (ocrState.phase === 'running') {
    const pct = Math.round(ocrState.progress * 100);
    return (
      <View style={[statusCard.card, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
        <View style={statusCard.row}>
          <Ionicons name="scan-outline" size={16} color={colors.primary} />
          <Text style={[typography.body2, { color: colors.primary, marginLeft: spacing.xs, flex: 1 }]}>
            {ocrState.statusText}
          </Text>
          <Text style={[typography.caption, { color: colors.textDisabled }]}>{pct}%</Text>
        </View>
        <View style={[statusCard.progressTrack, { backgroundColor: colors.surfaceVariant }]}>
          <View
            style={[
              statusCard.progressFill,
              { backgroundColor: colors.primary, width: `${pct}%` as unknown as number },
            ]}
          />
        </View>
      </View>
    );
  }

  if (ocrState.phase === 'error') {
    return (
      <View style={[statusCard.card, { backgroundColor: colors.surface, borderColor: colors.error }]}>
        <View style={statusCard.row}>
          <Ionicons name="warning-outline" size={16} color={colors.error} />
          <Text style={[typography.body2, { color: colors.error, marginLeft: spacing.xs, flex: 1 }]}>
            OCR failed: {ocrState.message}
          </Text>
          <TouchableOpacity onPress={onRerun} style={statusCard.actionBtn} activeOpacity={0.7}>
            <Ionicons name="refresh-outline" size={14} color={colors.primary} />
            <Text style={[typography.caption, { color: colors.primary, marginLeft: 3 }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // phase === 'done'
  const { rawText, confidence, parseConfidence } = ocrState;
  const confLabel = confidence > 0 ? ` · ${Math.round(confidence)}% confidence` : '';
  const lowConfidence = !suppressParseWarning && parseConfidence < 0.5;

  return (
    <View style={[statusCard.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={statusCard.row}>
        <Ionicons name="checkmark-circle-outline" size={16} color={colors.success} />
        <Text style={[typography.body2, { color: colors.success, marginLeft: spacing.xs, flex: 1 }]}>
          Text extracted{confLabel}
        </Text>
        <TouchableOpacity onPress={onRerun} style={statusCard.actionBtn} activeOpacity={0.7}>
          <Ionicons name="refresh-outline" size={14} color={colors.textSecondary} />
          <Text style={[typography.caption, { color: colors.textSecondary, marginLeft: 3 }]}>Re-run</Text>
        </TouchableOpacity>
      </View>

      {lowConfidence && (
        <View style={[statusCard.subRow, { borderTopColor: colors.divider }]}>
          <Ionicons name="alert-circle-outline" size={14} color="#F59E0B" />
          <Text style={[typography.caption, { color: colors.textSecondary, marginLeft: spacing.xs, flex: 1 }]}>
            Some fields may be missing — please review before saving.
          </Text>
        </View>
      )}

      <TouchableOpacity
        onPress={() => setShowRawText((v) => !v)}
        style={[statusCard.subRow, { borderTopColor: colors.divider }]}
        activeOpacity={0.7}
      >
        <Text style={[typography.caption, { color: colors.textSecondary, flex: 1 }]}>Detected text</Text>
        <Ionicons name={showRawText ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textSecondary} />
      </TouchableOpacity>

      {showRawText && (
        <View style={[statusCard.rawBox, { backgroundColor: colors.surfaceVariant }]}>
          <ScrollView nestedScrollEnabled style={{ maxHeight: 160 }}>
            <Text
              style={[
                typography.caption,
                {
                  color: colors.textSecondary,
                  fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                },
              ]}
              selectable
            >
              {rawText.trim() || '(no text detected)'}
            </Text>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const statusCard = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 480,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  progressTrack: { height: 3, borderRadius: 2, marginTop: spacing.sm, overflow: 'hidden' },
  progressFill: { height: 3, borderRadius: 2 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginLeft: spacing.sm,
  },
  rawBox: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
  },
});

// ─── AI parse card ─────────────────────────────────────────────────────────────

interface AiParseCardProps {
  aiParseState: AiParseState;
  useAiParsing: boolean;
  onToggle: (value: boolean) => void;
  onRerun: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
}

function AiParseCard({ aiParseState, useAiParsing, onToggle, onRerun, colors }: AiParseCardProps) {
  const hasContent = aiParseState.phase !== 'idle';

  return (
    <View style={[aiCard.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={aiCard.toggleRow}>
        <View style={aiCard.toggleLabel}>
          <Ionicons name="sparkles-outline" size={15} color={colors.primary} />
          <Text style={[typography.body2, { color: colors.text, marginLeft: spacing.xs, fontWeight: '500' }]}>
            AI parsing
          </Text>
        </View>
        <Switch
          value={useAiParsing}
          onValueChange={onToggle}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor="#ffffff"
        />
      </View>

      {!hasContent && !useAiParsing && (
        <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.sm }]}>
          Rule-based extraction active.
        </Text>
      )}

      {hasContent && (
        <View style={[aiCard.content, { borderTopColor: colors.divider }]}>
          {aiParseState.phase === 'loading' && (
            <View style={aiCard.row}>
              <Ionicons name="sparkles-outline" size={14} color={colors.primary} />
              <Text style={[typography.body2, { color: colors.textSecondary, marginLeft: spacing.xs }]}>
                Analysing with AI…
              </Text>
            </View>
          )}

          {aiParseState.phase === 'done' && (
            <>
              <View style={aiCard.row}>
                <Ionicons name="checkmark-circle-outline" size={15} color={colors.success} />
                <Text style={[typography.body2, { color: colors.success, marginLeft: spacing.xs, flex: 1 }]}>
                  AI extracted · {Math.round(aiParseState.confidence * 100)}% confidence
                </Text>
                <TouchableOpacity onPress={onRerun} style={aiCard.rerunBtn} activeOpacity={0.7}>
                  <Ionicons name="refresh-outline" size={13} color={colors.textSecondary} />
                  <Text style={[typography.caption, { color: colors.textSecondary, marginLeft: 2 }]}>Re-run</Text>
                </TouchableOpacity>
              </View>

              {aiParseState.method === 'vision' && (
                <View style={[aiCard.badge, { backgroundColor: colors.primaryLight, borderColor: colors.border }]}>
                  <Ionicons name="eye-outline" size={12} color={colors.primary} />
                  <Text style={[typography.caption, { color: colors.primary, marginLeft: 4 }]}>Image analysis used</Text>
                </View>
              )}

              {aiParseState.reasoningFlags.missingTime && (
                <View style={aiCard.flagRow}>
                  <Ionicons name="time-outline" size={13} color="#F59E0B" />
                  <Text style={[typography.caption, { color: '#F59E0B', marginLeft: 4 }]}>
                    Time not found — please confirm start time
                  </Text>
                </View>
              )}
              {aiParseState.reasoningFlags.missingDate && (
                <View style={aiCard.flagRow}>
                  <Ionicons name="calendar-outline" size={13} color="#F59E0B" />
                  <Text style={[typography.caption, { color: '#F59E0B', marginLeft: 4 }]}>
                    Date not found — please confirm date
                  </Text>
                </View>
              )}
              {aiParseState.reasoningFlags.missingLocation && (
                <View style={aiCard.flagRow}>
                  <Ionicons name="location-outline" size={13} color="#F59E0B" />
                  <Text style={[typography.caption, { color: '#F59E0B', marginLeft: 4 }]}>
                    Location not found — please add a venue or address
                  </Text>
                </View>
              )}
            </>
          )}

          {aiParseState.phase === 'error' && (
            <>
              <View style={aiCard.row}>
                <Ionicons name="warning-outline" size={15} color={colors.error} />
                <Text style={[typography.body2, { color: colors.error, marginLeft: spacing.xs, flex: 1 }]} numberOfLines={2}>
                  {aiParseState.message}
                </Text>
                <TouchableOpacity onPress={onRerun} style={aiCard.rerunBtn} activeOpacity={0.7}>
                  <Ionicons name="refresh-outline" size={13} color={colors.primary} />
                  <Text style={[typography.caption, { color: colors.primary, marginLeft: 2 }]}>Retry</Text>
                </TouchableOpacity>
              </View>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.xs }]}>
                Rule-based parsing used as fallback.
              </Text>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const aiCard = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 480,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLabel: { flexDirection: 'row', alignItems: 'center' },
  content: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  rerunBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginLeft: spacing.sm,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  flagRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ReviewScreen() {
  const { colors } = useTheme();
  const { auth } = useAuth();
  const insets = useSafeAreaInsets();

  const { imageUri, imageName } = useLocalSearchParams<{
    imageUri: string;
    imageName: string;
  }>();

  // Form fields
  const [title, setTitle]         = useState('');
  const [date, setDate]           = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime]     = useState('');
  const [location, setLocation]   = useState('');
  const [notes, setNotes]         = useState('');

  // State machines
  const [ocrState, setOcrState]         = useState<OcrState>({ phase: 'idle' });
  const [useAiParsing, setUseAiParsing] = useState(true);
  const [aiParseState, setAiParseState] = useState<AiParseState>({ phase: 'idle' });
  const [importState, setImportState]   = useState<ImportState>({ phase: 'idle' });

  // Success animation
  const successScale   = useRef(new Animated.Value(0.92)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;

  // Guards
  const hasRunOcr   = useRef(false);
  const isMounted   = useRef(true);
  const lastRawText = useRef('');
  useEffect(() => { return () => { isMounted.current = false; }; }, []);

  const fillFields = useCallback((
    t: string, d: string, st: string, et: string, loc: string, n: string,
  ) => {
    setTitle(t); setDate(d); setStartTime(st); setEndTime(et); setLocation(loc); setNotes(n);
  }, []);

  // ── AI parse ──────────────────────────────────────────────────────────────
  const runAiParse = useCallback(async (rawText: string) => {
    if (!isMounted.current) return;
    setAiParseState({ phase: 'loading' });

    try {
      const tz =
        typeof Intl !== 'undefined'
          ? Intl.DateTimeFormat().resolvedOptions().timeZone
          : 'UTC';
      const result = await parseEventWithAi({ rawText, imageUri: imageUri ?? undefined, userTimezone: tz });
      if (!isMounted.current) return;

      fillFields(result.title, result.date, result.startTime, result.endTime, result.location, result.notes);
      setAiParseState({ phase: 'done', confidence: result.confidence, reasoningFlags: result.reasoningFlags, method: result.method });
    } catch (e: unknown) {
      if (!isMounted.current) return;
      const msg = e instanceof Error ? e.message : 'AI parsing failed.';

      const draft = parseEvent(rawText, imageUri ?? '', imageName);
      fillFields(draft.title, draft.date, draft.startTime, draft.endTime, draft.location, draft.notes);
      setAiParseState({ phase: 'error', message: msg });
    }
  }, [imageUri, imageName, fillFields]);

  // ── OCR + AI ──────────────────────────────────────────────────────────────
  const runOcrAndParse = useCallback(async () => {
    if (!imageUri) return;

    setOcrState({ phase: 'running', progress: 0, statusText: 'Starting…' });
    setAiParseState({ phase: 'idle' });

    try {
      const result = await runOcr(imageUri, (p: OcrProgress) => {
        if (!isMounted.current) return;
        setOcrState({ phase: 'running', progress: p.progress, statusText: friendlyOcrStatus(p.status) });
      });

      if (!isMounted.current) return;
      lastRawText.current = result.rawText;

      if (useAiParsing) {
        setOcrState({ phase: 'done', rawText: result.rawText, confidence: result.confidence, parseConfidence: 0 });
        await runAiParse(result.rawText);
      } else {
        const draft = parseEvent(result.rawText, imageUri, imageName);
        if (!isMounted.current) return;
        fillFields(draft.title, draft.date, draft.startTime, draft.endTime, draft.location, draft.notes);
        setOcrState({ phase: 'done', rawText: result.rawText, confidence: result.confidence, parseConfidence: draft.parseConfidence });
      }
    } catch (e: unknown) {
      if (!isMounted.current) return;
      const msg = e instanceof Error ? e.message : 'Unknown OCR error.';
      setOcrState({ phase: 'error', message: msg });
    }
  }, [imageUri, imageName, useAiParsing, runAiParse, fillFields]);

  // ── Auto-run once ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!imageUri || hasRunOcr.current) return;
    hasRunOcr.current = true;

    if (!OCR_SUPPORTED) {
      setOcrState({ phase: 'unsupported' });
      return;
    }

    runOcrAndParse();
  }, [imageUri, runOcrAndParse]);

  const handleRerunOcr = useCallback(() => {
    if (!OCR_SUPPORTED) return;
    lastRawText.current = '';
    setAiParseState({ phase: 'idle' });
    runOcrAndParse();
  }, [runOcrAndParse]);

  const handleRerunAiParse = useCallback(() => {
    if (lastRawText.current) runAiParse(lastRawText.current);
  }, [runAiParse]);

  const handleToggleAiParsing = useCallback((value: boolean) => {
    setUseAiParsing(value);
    if (!lastRawText.current) return;

    if (value) {
      runAiParse(lastRawText.current);
    } else {
      setAiParseState({ phase: 'idle' });
      const draft = parseEvent(lastRawText.current, imageUri ?? '', imageName);
      fillFields(draft.title, draft.date, draft.startTime, draft.endTime, draft.location, draft.notes);
      setOcrState((s) => s.phase === 'done' ? { ...s, parseConfidence: draft.parseConfidence } : s);
    }
  }, [imageUri, imageName, runAiParse, fillFields]);

  // ── Import ────────────────────────────────────────────────────────────────
  const handleImport = useCallback(async () => {
    if (!auth.isSignedIn) {
      router.push('/sign-in');
      return;
    }

    if (!title.trim()) {
      setImportState({ phase: 'error', message: 'Please enter an event title before importing.', isAuthError: false });
      return;
    }
    if (!date.trim()) {
      setImportState({ phase: 'error', message: 'Please enter a date (YYYY-MM-DD) before importing.', isAuthError: false });
      return;
    }
    if (!startTime.trim()) {
      setImportState({ phase: 'error', message: 'Please enter a start time (HH:MM) before importing.', isAuthError: false });
      return;
    }

    setImportState({ phase: 'loading' });

    try {
      const tz =
        typeof Intl !== 'undefined'
          ? Intl.DateTimeFormat().resolvedOptions().timeZone
          : 'America/Los_Angeles';

      const result = await createCalendarEvent(
        auth.accessToken!,
        'primary',
        {
          title: title.trim(),
          date: date.trim(),
          startTime: startTime.trim(),
          endTime: endTime.trim() || undefined,
          location: location.trim() || undefined,
          notes: notes.trim() || undefined,
          timezone: tz,
        },
      );

      const event: ImportedEvent = {
        id: generateId(),
        createdAt: new Date().toISOString(),
        title: title.trim() || 'Untitled Event',
        date,
        startTime,
        endTime,
        location,
        notes,
        imageUri: imageUri ?? '',
        imageName,
        googleEventId:    result.eventId,
        googleCalendarId: result.calendarId,
        googleHtmlLink:   result.htmlLink,
        importedAt:       new Date().toISOString(),
      };
      await addEvent(event);

      setImportState({ phase: 'success', eventId: result.eventId, calendarId: result.calendarId, htmlLink: result.htmlLink });

      Animated.parallel([
        Animated.spring(successScale, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 8 }),
        Animated.timing(successOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Import failed.';
      const status = (e as { status?: number }).status ?? 0;
      const isAuthError =
        status === 401 || status === 403 ||
        msg.toLowerCase().includes('unauthorized') ||
        msg.toLowerCase().includes('invalid_grant') ||
        msg.toLowerCase().includes('access denied') ||
        msg.toLowerCase().includes('forbidden');
      setImportState({ phase: 'error', message: msg, isAuthError });
    }
  }, [auth, title, date, startTime, endTime, location, notes, imageUri, imageName]);

  const handleReauthenticate = useCallback(() => {
    setImportState({ phase: 'idle' });
    router.push('/sign-in');
  }, []);

  const missingFlags = aiParseState.phase === 'done' ? aiParseState.reasoningFlags : null;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppBar title="Review Event" showBack onBack={() => router.back()} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Image preview */}
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="cover" />
          ) : (
            <View style={[styles.imagePlaceholder, { backgroundColor: colors.surfaceVariant }]} />
          )}

          {/* Processing status */}
          <OcrCard
            ocrState={ocrState}
            onRerun={handleRerunOcr}
            suppressParseWarning={useAiParsing}
            colors={colors}
          />

          {OCR_SUPPORTED && (
            <AiParseCard
              aiParseState={aiParseState}
              useAiParsing={useAiParsing}
              onToggle={handleToggleAiParsing}
              onRerun={handleRerunAiParse}
              colors={colors}
            />
          )}

          {/* Large title input */}
          <View style={[styles.titleSection, { borderBottomColor: colors.divider }]}>
            <TextInput
              style={[typography.h2, styles.titleInput, { color: title ? colors.text : colors.textDisabled }]}
              value={title}
              onChangeText={setTitle}
              placeholder="Event title"
              placeholderTextColor={colors.textDisabled}
              returnKeyType="next"
            />
          </View>

          {/* Detail fields */}
          <View style={styles.fieldsSection}>
            <Text style={[typography.label, styles.sectionLabel, { color: colors.textSecondary }]}>
              Details
            </Text>
            <Field
              label="Date"
              value={date}
              onChangeText={setDate}
              icon="calendar-outline"
              placeholder="YYYY-MM-DD"
              colors={colors}
              missing={missingFlags?.missingDate}
            />
            <Field
              label="Start Time"
              value={startTime}
              onChangeText={setStartTime}
              icon="time-outline"
              placeholder="HH:MM"
              colors={colors}
              missing={missingFlags?.missingTime}
            />
            <Field
              label="End Time"
              value={endTime}
              onChangeText={setEndTime}
              icon="timer-outline"
              placeholder="HH:MM (optional)"
              colors={colors}
            />
            <Field
              label="Location"
              value={location}
              onChangeText={setLocation}
              icon="location-outline"
              placeholder="Where is it?"
              colors={colors}
              missing={missingFlags?.missingLocation}
            />
            <Field
              label="Notes"
              value={notes}
              onChangeText={setNotes}
              icon="document-text-outline"
              placeholder="Any additional details…"
              multiline
              colors={colors}
            />
          </View>

          <View style={{ height: spacing.xxl + 80 }} />
        </ScrollView>

        {/* Sticky bottom */}
        <View
          style={[
            styles.stickyBottom,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
              paddingBottom: insets.bottom + spacing.md,
            },
          ]}
        >
          {importState.phase === 'success' ? (
            <Animated.View
              style={[
                importStyles.successCard,
                {
                  backgroundColor: colors.successLight,
                  borderColor: colors.success,
                  transform: [{ scale: successScale }],
                  opacity: successOpacity,
                },
              ]}
            >
              <View style={importStyles.successHeader}>
                <Ionicons name="checkmark-circle" size={22} color={colors.success} />
                <Text style={[typography.body1, { color: colors.success, marginLeft: spacing.sm, fontWeight: '600' }]}>
                  Added to Google Calendar
                </Text>
              </View>
              <View style={importStyles.actionRow}>
                <TouchableOpacity
                  style={[importStyles.outlineBtn, { borderColor: colors.primary }]}
                  onPress={() => openUrl(importState.htmlLink)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="open-outline" size={15} color={colors.primary} />
                  <Text style={[typography.body2, { color: colors.primary, marginLeft: spacing.xs, fontWeight: '500' }]}>
                    Open in Calendar
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[importStyles.solidBtn, { backgroundColor: colors.primary }]}
                  onPress={() => router.replace('/history')}
                  activeOpacity={0.8}
                >
                  <Text style={[typography.body2, { color: '#FFFFFF', fontWeight: '600' }]}>Done</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          ) : importState.phase === 'error' ? (
            <View style={[importStyles.errorCard, { backgroundColor: colors.surface, borderColor: colors.error }]}>
              <View style={importStyles.errorHeader}>
                <Ionicons name="alert-circle-outline" size={18} color={colors.error} />
                <Text
                  style={[typography.body2, { color: colors.error, marginLeft: spacing.xs, flex: 1 }]}
                  numberOfLines={3}
                >
                  {importState.message}
                </Text>
              </View>
              <View style={importStyles.actionRow}>
                <Button
                  title="Retry"
                  variant="secondary"
                  onPress={handleImport}
                  style={{ flex: 1, marginRight: importState.isAuthError ? spacing.sm : 0 }}
                />
                {importState.isAuthError && (
                  <Button
                    title="Re-authenticate"
                    variant="primary"
                    onPress={handleReauthenticate}
                    style={{ flex: 1 }}
                  />
                )}
              </View>
            </View>
          ) : (
            <>
              {!auth.isSignedIn && (
                <Text style={[typography.caption, { color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.sm }]}>
                  You'll be asked to sign in with Google first.
                </Text>
              )}
              <Button
                title="Import to Google Calendar"
                onPress={handleImport}
                loading={importState.phase === 'loading'}
                fullWidth
              />
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const importStyles = StyleSheet.create({
  successCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.md,
  },
  successHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  errorCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.md,
  },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  outlineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
  },
  solidBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  imagePreview: {
    width: '100%',
    maxWidth: 480,
    height: 200,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.md,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      },
      android: { elevation: 4 },
      web: { boxShadow: '0 4px 16px rgba(0,0,0,0.1)' },
    }),
  },
  imagePlaceholder: {
    width: '100%',
    maxWidth: 480,
    height: 200,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.md,
  },
  titleSection: {
    width: '100%',
    maxWidth: 480,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  titleInput: {
    width: '100%',
    paddingVertical: 0,
    lineHeight: 30,
  },
  fieldsSection: {
    width: '100%',
    maxWidth: 480,
  },
  sectionLabel: {
    marginBottom: spacing.sm,
  },
  stickyBottom: {
    padding: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
