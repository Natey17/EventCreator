import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { spacing, borderRadius } from '../theme/spacing';
import { typography } from '../theme/typography';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
}: ButtonProps) {
  const { colors } = useTheme();

  const isDisabled = disabled || loading;

  const containerStyles: ViewStyle[] = [styles.base];

  if (variant === 'primary') {
    containerStyles.push({ backgroundColor: isDisabled ? colors.border : colors.primary });
  } else if (variant === 'secondary') {
    containerStyles.push({
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: isDisabled ? colors.border : colors.primary,
    });
  } else if (variant === 'ghost') {
    containerStyles.push({ backgroundColor: 'transparent' });
  } else if (variant === 'danger') {
    containerStyles.push({ backgroundColor: isDisabled ? colors.border : colors.error });
  }

  if (fullWidth) containerStyles.push({ alignSelf: 'stretch' });
  if (style) containerStyles.push(style);

  const textColor =
    variant === 'primary' || variant === 'danger'
      ? isDisabled ? colors.textDisabled : '#FFFFFF'
      : isDisabled ? colors.textDisabled : colors.primary;

  return (
    <TouchableOpacity
      style={containerStyles}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.75}
    >
      {loading && (
        <View style={styles.loadingIcon}>
          <ActivityIndicator
            size="small"
            color={variant === 'primary' || variant === 'danger' ? '#FFFFFF' : colors.primary}
          />
        </View>
      )}
      <Text style={[typography.button, { color: textColor }]}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    minHeight: 52,
  },
  loadingIcon: {
    marginRight: spacing.sm,
  },
});
