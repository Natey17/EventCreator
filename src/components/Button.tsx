import React, { useRef } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  ViewStyle,
  Animated,
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
  /** Applied to the outer animated wrapper (use for layout: width, maxWidth, margin) */
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
  const scale = useRef(new Animated.Value(1)).current;

  const isDisabled = disabled || loading;

  const handlePressIn = () => {
    if (isDisabled) return;
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 40,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 8,
    }).start();
  };

  const btnStyles: ViewStyle[] = [styles.base];

  if (variant === 'primary') {
    btnStyles.push({ backgroundColor: isDisabled ? colors.border : colors.primary });
  } else if (variant === 'secondary') {
    btnStyles.push({
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: isDisabled ? colors.border : colors.primary,
    });
  } else if (variant === 'ghost') {
    btnStyles.push({ backgroundColor: 'transparent' });
  } else if (variant === 'danger') {
    btnStyles.push({ backgroundColor: isDisabled ? colors.border : colors.error });
  }

  const textColor =
    variant === 'primary' || variant === 'danger'
      ? isDisabled ? colors.textDisabled : '#FFFFFF'
      : isDisabled ? colors.textDisabled : colors.primary;

  return (
    <Animated.View
      style={[
        { transform: [{ scale }] },
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      <TouchableOpacity
        style={[btnStyles, fullWidth && styles.fullWidth]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        activeOpacity={0.9}
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
    </Animated.View>
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
  fullWidth: {
    alignSelf: 'stretch',
  },
  loadingIcon: {
    marginRight: spacing.sm,
  },
});
