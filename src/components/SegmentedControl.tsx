import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { spacing, borderRadius } from '../theme/spacing';
import { typography } from '../theme/typography';

interface Segment {
  label: string;
  value: string;
}

interface SegmentedControlProps {
  segments: Segment[];
  selectedValue: string;
  onValueChange: (value: string) => void;
}

export function SegmentedControl({
  segments,
  selectedValue,
  onValueChange,
}: SegmentedControlProps) {
  const { colors } = useTheme();
  const selectedIndex = segments.findIndex((s) => s.value === selectedValue);
  const animatedIndex = useRef(new Animated.Value(selectedIndex)).current;

  useEffect(() => {
    Animated.spring(animatedIndex, {
      toValue: selectedIndex,
      useNativeDriver: false,
      tension: 68,
      friction: 10,
    }).start();
  }, [selectedIndex]);

  const segmentWidth = 100 / segments.length;

  const translateX = animatedIndex.interpolate({
    inputRange: segments.map((_, i) => i),
    outputRange: segments.map((_, i) => i * segmentWidth + '%' as unknown as number),
  });

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.surfaceVariant },
      ]}
    >
      {/* Sliding indicator */}
      <Animated.View
        style={[
          styles.indicator,
          {
            backgroundColor: colors.surface,
            width: `${segmentWidth}%`,
            left: animatedIndex.interpolate({
              inputRange: segments.map((_, i) => i),
              outputRange: segments.map((_, i) => `${i * segmentWidth}%`),
            }),
          },
        ]}
      />
      {segments.map((seg, i) => {
        const isActive = seg.value === selectedValue;
        return (
          <TouchableOpacity
            key={seg.value}
            style={styles.segment}
            onPress={() => onValueChange(seg.value)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                typography.body2,
                styles.label,
                { color: isActive ? colors.text : colors.textSecondary },
                isActive && styles.labelActive,
              ]}
              numberOfLines={1}
            >
              {seg.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: borderRadius.md,
    padding: 3,
    position: 'relative',
    overflow: 'hidden',
  },
  indicator: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    borderRadius: borderRadius.sm + 1,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.xs + 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  label: {
    fontWeight: '400',
  },
  labelActive: {
    fontWeight: '600',
  },
});
