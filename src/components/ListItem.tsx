import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { spacing, borderRadius } from '../theme/spacing';
import { typography } from '../theme/typography';
import { ImportedEvent } from '../types';

interface ListItemProps {
  event: ImportedEvent;
  onPress: () => void;
  style?: ViewStyle;
}

function formatDisplayDate(date: string, startTime: string): string {
  if (!date) return '';
  try {
    const d = new Date(`${date}T${startTime || '00:00'}`);
    return d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }) + (startTime ? ` · ${startTime}` : '');
  } catch {
    return date;
  }
}

export function ListItem({ event, onPress, style }: ListItemProps) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      style={[styles.container, { borderBottomColor: colors.divider }, style]}
      onPress={onPress}
      activeOpacity={0.6}
    >
      {/* Thumbnail */}
      <View style={[styles.thumbnailContainer, { backgroundColor: colors.surfaceVariant }]}>
        {event.imageUri ? (
          <Image source={{ uri: event.imageUri }} style={styles.thumbnail} resizeMode="cover" />
        ) : (
          <View style={styles.thumbnailPlaceholder} />
        )}
      </View>

      {/* Text content */}
      <View style={styles.content}>
        <Text
          style={[typography.body1, styles.title, { color: colors.text }]}
          numberOfLines={1}
        >
          {event.title || 'Untitled Event'}
        </Text>
        {(event.date || event.startTime) ? (
          <Text
            style={[typography.body2, { color: colors.textSecondary, marginTop: 2 }]}
            numberOfLines={1}
          >
            {formatDisplayDate(event.date, event.startTime)}
          </Text>
        ) : null}
        {event.location ? (
          <Text
            style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}
            numberOfLines={1}
          >
            {event.location}
          </Text>
        ) : null}
      </View>

      {/* Chevron */}
      <Text style={[styles.chevron, { color: colors.textDisabled }]}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  thumbnailContainer: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    marginRight: spacing.md,
    flexShrink: 0,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    width: '100%',
    height: '100%',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontWeight: '500',
  },
  chevron: {
    fontSize: 22,
    marginLeft: spacing.sm,
    lineHeight: 26,
  },
});
