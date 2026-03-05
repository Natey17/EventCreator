import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Linking,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/ThemeContext';
import { spacing, borderRadius } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { AppBar } from '../../src/components/AppBar';
import { getEvents } from '../../src/storage/events';
import { ImportedEvent } from '../../src/types';

// ─── Detail row ───────────────────────────────────────────────────────────────

interface DetailRowProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  colors: ReturnType<typeof useTheme>['colors'];
  last?: boolean;
}

function DetailRow({ icon, label, value, colors, last }: DetailRowProps) {
  if (!value) return null;
  return (
    <View style={[rowStyles.row, !last && { borderBottomColor: colors.divider, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <View style={[rowStyles.iconWrap, { backgroundColor: colors.primaryLight }]}>
        <Ionicons name={icon} size={16} color={colors.primary} />
      </View>
      <View style={rowStyles.textBlock}>
        <Text style={[rowStyles.label, { color: colors.textSecondary }]}>{label}</Text>
        <Text style={[typography.body1, { color: colors.text, marginTop: 2 }]}>{value}</Text>
      </View>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.md,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    marginTop: 2,
    flexShrink: 0,
  },
  textBlock: {
    flex: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
});

// ─── Formatter ─────────────────────────────────────────────────────────────────

function formatDisplayDate(date: string, startTime: string, endTime: string): string {
  if (!date) return '';
  try {
    const d = new Date(`${date}T${startTime || '00:00'}`);
    const dateStr = d.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const timeStr = startTime
      ? endTime
        ? `${startTime} – ${endTime}`
        : startTime
      : '';
    return timeStr ? `${dateStr}\n${timeStr}` : dateStr;
  } catch {
    return date;
  }
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function EventDetailScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [event, setEvent] = useState<ImportedEvent | null>(null);

  useEffect(() => {
    if (!id) return;
    getEvents().then((events) => {
      const found = events.find((e) => e.id === id);
      setEvent(found ?? null);
    });
  }, [id]);

  const openCalendar = () => {
    if (!event?.googleHtmlLink) return;
    if (Platform.OS === 'web') {
      window.open(event.googleHtmlLink, '_blank');
    } else {
      Linking.openURL(event.googleHtmlLink);
    }
  };

  if (!event) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <AppBar title="Event Details" showBack onBack={() => router.back()} />
        <View style={styles.centered}>
          <Text style={[typography.body1, { color: colors.textSecondary }]}>Event not found.</Text>
        </View>
      </View>
    );
  }

  const dateTimeStr = formatDisplayDate(event.date, event.startTime, event.endTime);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppBar title="Event Details" showBack onBack={() => router.back()} />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Image */}
        {event.imageUri ? (
          <Image
            source={{ uri: event.imageUri }}
            style={styles.imagePreview}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.imagePlaceholder, { backgroundColor: colors.surfaceVariant }]}>
            <Ionicons name="image-outline" size={40} color={colors.textDisabled} />
          </View>
        )}

        {/* Title */}
        <Text style={[typography.h2, styles.eventTitle, { color: colors.text }]}>
          {event.title || 'Untitled Event'}
        </Text>

        {/* GCal badge */}
        {event.googleHtmlLink ? (
          <View style={[styles.gcalBadge, { backgroundColor: colors.primaryLight }]}>
            <Ionicons name="calendar" size={13} color={colors.primary} />
            <Text style={[typography.caption, { color: colors.primary, marginLeft: 5, fontWeight: '600' }]}>
              In Google Calendar
            </Text>
          </View>
        ) : null}

        {/* Details card */}
        <View style={[styles.detailsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <DetailRow icon="calendar-outline" label="Date & Time" value={dateTimeStr} colors={colors} />
          <DetailRow icon="location-outline" label="Location" value={event.location} colors={colors} />
          {event.notes ? (
            <DetailRow icon="document-text-outline" label="Notes" value={event.notes} colors={colors} />
          ) : null}
          {event.imageName ? (
            <DetailRow icon="image-outline" label="Source file" value={event.imageName} colors={colors} last />
          ) : null}
        </View>

        {/* Open button */}
        {event.googleHtmlLink ? (
          <TouchableOpacity
            style={[styles.openBtn, { backgroundColor: colors.primary }]}
            onPress={openCalendar}
            activeOpacity={0.8}
          >
            <Ionicons name="open-outline" size={16} color="#FFFFFF" />
            <Text style={[typography.button, { color: '#FFFFFF', marginLeft: spacing.sm }]}>
              Open in Google Calendar
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* Timestamp */}
        <Text style={[typography.caption, styles.timestamp, { color: colors.textDisabled }]}>
          {event.importedAt
            ? `Imported to Google Calendar · ${new Date(event.importedAt).toLocaleString()}`
            : `Saved · ${new Date(event.createdAt).toLocaleString()}`}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  imagePreview: {
    width: '100%',
    maxWidth: 480,
    height: 220,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.lg,
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
    height: 220,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventTitle: {
    width: '100%',
    maxWidth: 480,
    marginBottom: spacing.sm,
  },
  gcalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    marginBottom: spacing.md,
    maxWidth: 480,
  },
  detailsCard: {
    width: '100%',
    maxWidth: 480,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: { elevation: 1 },
      web: { boxShadow: '0 1px 6px rgba(0,0,0,0.05)' },
    }),
  },
  openBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 480,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    marginBottom: spacing.md,
  },
  timestamp: {
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});
