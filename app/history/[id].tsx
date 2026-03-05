import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme/ThemeContext';
import { spacing, borderRadius } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { AppBar } from '../../src/components/AppBar';
import { Card } from '../../src/components/Card';
import { getEvents } from '../../src/storage/events';
import { ImportedEvent } from '../../src/types';
import { Ionicons } from '@expo/vector-icons';

interface DetailRowProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  colors: ReturnType<typeof useTheme>['colors'];
}

function DetailRow({ icon, label, value, colors }: DetailRowProps) {
  if (!value) return null;
  return (
    <View style={detailStyles.row}>
      <Ionicons name={icon} size={18} color={colors.textSecondary} style={detailStyles.icon} />
      <View style={detailStyles.textBlock}>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>{label}</Text>
        <Text style={[typography.body1, { color: colors.text, marginTop: 2 }]}>{value}</Text>
      </View>
    </View>
  );
}

const detailStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
  },
  icon: {
    marginTop: 14,
    marginRight: spacing.md,
  },
  textBlock: {
    flex: 1,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: spacing.sm,
  },
});

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
        {/* Image preview */}
        {event.imageUri ? (
          <Image
            source={{ uri: event.imageUri }}
            style={styles.imagePreview}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.imagePlaceholder, { backgroundColor: colors.surfaceVariant }]} />
        )}

        {/* Event title */}
        <Text style={[typography.h2, styles.eventTitle, { color: colors.text }]}>
          {event.title || 'Untitled Event'}
        </Text>

        {/* Details card */}
        <Card style={styles.detailsCard} padding="md">
          <DetailRow
            icon="calendar-outline"
            label="Date & Time"
            value={dateTimeStr}
            colors={colors}
          />
          <DetailRow
            icon="location-outline"
            label="Location"
            value={event.location}
            colors={colors}
          />
          {event.notes ? (
            <DetailRow
              icon="document-text-outline"
              label="Notes"
              value={event.notes}
              colors={colors}
            />
          ) : null}
          {event.imageName ? (
            <DetailRow
              icon="image-outline"
              label="Source file"
              value={event.imageName}
              colors={colors}
            />
          ) : null}
        </Card>

        {/* Import timestamp */}
        <Text style={[typography.caption, styles.timestamp, { color: colors.textDisabled }]}>
          Imported {new Date(event.createdAt).toLocaleString()}
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
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
  },
  imagePlaceholder: {
    width: '100%',
    maxWidth: 480,
    height: 220,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
  },
  eventTitle: {
    width: '100%',
    maxWidth: 480,
    marginBottom: spacing.md,
  },
  detailsCard: {
    width: '100%',
    maxWidth: 480,
  },
  timestamp: {
    marginTop: spacing.lg,
  },
});
