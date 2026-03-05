import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { spacing, borderRadius } from '../theme/spacing';
import { typography } from '../theme/typography';
import { SegmentedControl } from './SegmentedControl';

interface AppBarProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightIcon?: React.ComponentProps<typeof Ionicons>['name'];
  onRightPress?: () => void;
  /** If provided, renders a segmented control below the title row */
  tabs?: Array<{ label: string; value: string }>;
  selectedTab?: string;
  onTabChange?: (value: string) => void;
  style?: ViewStyle;
}

export function AppBar({
  title,
  showBack = false,
  onBack,
  rightIcon,
  onRightPress,
  tabs,
  selectedTab,
  onTabChange,
  style,
}: AppBarProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const hasTabs = tabs && tabs.length > 0;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderBottomColor: colors.border,
          paddingTop: insets.top + spacing.xs,
        },
        style,
      ]}
    >
      {/* Title row */}
      <View style={styles.titleRow}>
        {/* Left: back button or spacer */}
        <View style={styles.sideSlot}>
          {showBack && (
            <TouchableOpacity onPress={onBack} style={styles.iconBtn} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
          )}
        </View>

        {/* Center: title */}
        {title ? (
          <Text
            style={[typography.h3, styles.title, { color: colors.text }]}
            numberOfLines={1}
          >
            {title}
          </Text>
        ) : (
          <View style={{ flex: 1 }} />
        )}

        {/* Right: icon button or spacer */}
        <View style={[styles.sideSlot, styles.sideSlotRight]}>
          {rightIcon && (
            <TouchableOpacity onPress={onRightPress} style={styles.iconBtn} activeOpacity={0.7}>
              <Ionicons name={rightIcon} size={24} color={colors.text} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tabs row */}
      {hasTabs && tabs && selectedTab !== undefined && onTabChange && (
        <View style={styles.tabsRow}>
          <SegmentedControl
            segments={tabs}
            selectedValue={selectedTab}
            onValueChange={onTabChange}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: { elevation: 2 },
      web: { boxShadow: '0 1px 3px rgba(0,0,0,0.06)' } as ViewStyle,
    }),
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
  },
  sideSlot: {
    width: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  sideSlotRight: {
    alignItems: 'flex-end',
  },
  title: {
    flex: 1,
    textAlign: 'center',
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
  },
  tabsRow: {
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
});
