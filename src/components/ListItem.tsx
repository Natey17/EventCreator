import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { spacing, borderRadius } from '../theme/spacing';
import { typography } from '../theme/typography';
import { ImportedEvent } from '../types';

interface ListItemProps {
  event: ImportedEvent;
  onPress: () => void;
  style?: ViewStyle;
}

function parseDateParts(date: string): { month: string; day: string } | null {
  if (!date) return null;
  try {
    const d = new Date(`${date}T00:00`);
    return {
      month: d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase(),
      day: d.getDate().toString(),
    };
  } catch {
    return null;
  }
}

function formatTime(startTime: string, endTime: string): string {
  if (!startTime) return '';
  return endTime ? `${startTime} – ${endTime}` : startTime;
}

export function ListItem({ event, onPress, style }: ListItemProps) {
  const { colors } = useTheme();
  const dateParts = parseDateParts(event.date);
  const timeStr = formatTime(event.startTime, event.endTime);

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Left: date block */}
      <View style={[styles.dateBlock, { backgroundColor: colors.primaryLight }]}>
        {dateParts ? (
          <>
            <Text style={[styles.dateMonth, { color: colors.primary }]}>{dateParts.month}</Text>
            <Text style={[styles.dateDay, { color: colors.primary }]}>{dateParts.day}</Text>
          </>
        ) : (
          <Ionicons name="calendar-outline" size={20} color={colors.primary} />
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={[typography.body1, styles.title, { color: colors.text }]} numberOfLines={1}>
          {event.title || 'Untitled Event'}
        </Text>
        {timeStr ? (
          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]} numberOfLines={1}>
            {timeStr}
          </Text>
        ) : null}
        {event.location ? (
          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 1 }]} numberOfLines={1}>
            {event.location}
          </Text>
        ) : null}
      </View>

      {/* Trailing */}
      <View style={styles.trailing}>
        {event.googleHtmlLink ? (
          <View style={[styles.gcalBadge, { backgroundColor: colors.primaryLight }]}>
            <Ionicons name="calendar" size={12} color={colors.primary} />
          </View>
        ) : null}
        <Ionicons name="chevron-forward" size={18} color={colors.textDisabled} style={styles.chevron} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: { elevation: 1 },
      web: { boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
    }),
  },
  dateBlock: {
    width: 56,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  dateMonth: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  dateDay: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 26,
  },
  content: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  title: {
    fontWeight: '600',
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: spacing.sm,
    gap: spacing.xs,
  },
  gcalBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevron: {
    marginLeft: 2,
  },
});
