import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, ThemeMode } from '../src/theme/ThemeContext';
import { useAuth } from '../src/auth/AuthContext';
import { spacing, borderRadius } from '../src/theme/spacing';
import { typography } from '../src/theme/typography';
import { AppBar } from '../src/components/AppBar';
import { Card } from '../src/components/Card';

// ─── Section header ──────────────────────────────────────────────────────────

function SectionHeader({ title, colors }: { title: string; colors: ReturnType<typeof useTheme>['colors'] }) {
  return (
    <Text style={[typography.sectionHeader, styles.sectionHeader, { color: colors.textSecondary }]}>
      {title}
    </Text>
  );
}

// ─── Theme option row ─────────────────────────────────────────────────────────

const THEME_OPTIONS: Array<{
  value: ThemeMode;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}> = [
  { value: 'system', label: 'System', icon: 'phone-portrait-outline' },
  { value: 'light', label: 'Light', icon: 'sunny-outline' },
  { value: 'dark', label: 'Dark', icon: 'moon-outline' },
];

function ThemeRow({
  option,
  selected,
  onPress,
  colors,
}: {
  option: (typeof THEME_OPTIONS)[0];
  selected: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: colors.divider }]}
      onPress={onPress}
      activeOpacity={0.6}
    >
      <Ionicons name={option.icon} size={20} color={colors.textSecondary} style={styles.rowIcon} />
      <Text style={[typography.body1, { color: colors.text, flex: 1 }]}>{option.label}</Text>
      {selected && <Ionicons name="checkmark" size={20} color={colors.primary} />}
    </TouchableOpacity>
  );
}

// ─── Google Account section ───────────────────────────────────────────────────

function GoogleAccountSection({
  colors,
}: {
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  const { auth, signOut } = useAuth();

  const handleSignOut = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Sign out of Google?')) signOut();
    } else {
      Alert.alert('Sign Out', 'Sign out of Google Calendar?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: signOut },
      ]);
    }
  };

  if (auth.isSignedIn && auth.user) {
    // ── Signed-in state ──────────────────────────────────────────────────────
    return (
      <Card style={styles.card}>
        {/* Profile row */}
        <View style={[styles.row, { borderBottomColor: colors.divider }]}>
          {auth.user.picture ? (
            <Image
              source={{ uri: auth.user.picture }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primaryLight }]}>
              <Text style={[typography.h3, { color: colors.primary }]}>
                {auth.user.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={[typography.body1, { color: colors.text, fontWeight: '500' }]} numberOfLines={1}>
              {auth.user.name}
            </Text>
            <Text style={[typography.body2, { color: colors.textSecondary, marginTop: 2 }]} numberOfLines={1}>
              {auth.user.email}
            </Text>
          </View>
          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
        </View>

        {/* Sign out row */}
        <TouchableOpacity
          style={[styles.row, { borderBottomWidth: 0 }]}
          onPress={handleSignOut}
          activeOpacity={0.6}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.error} style={styles.rowIcon} />
          <Text style={[typography.body1, { color: colors.error, flex: 1 }]}>Sign Out</Text>
        </TouchableOpacity>
      </Card>
    );
  }

  // ── Signed-out state ──────────────────────────────────────────────────────
  return (
    <Card style={styles.card}>
      <TouchableOpacity
        style={[styles.row, { borderBottomWidth: 0 }]}
        onPress={() => router.push('/sign-in')}
        activeOpacity={0.6}
      >
        <Ionicons name="logo-google" size={20} color={colors.primary} style={styles.rowIcon} />
        <Text style={[typography.body1, { color: colors.primary, flex: 1 }]}>
          Connect Google Calendar
        </Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textDisabled} />
      </TouchableOpacity>
    </Card>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { colors, themeMode, setThemeMode } = useTheme();
  const insets = useSafeAreaInsets();

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppBar title="Settings" showBack onBack={() => router.back()} />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Appearance */}
        <SectionHeader title="Appearance" colors={colors} />
        <Card style={styles.card}>
          {THEME_OPTIONS.map((opt) => (
            <ThemeRow
              key={opt.value}
              option={opt}
              selected={themeMode === opt.value}
              onPress={() => setThemeMode(opt.value)}
              colors={colors}
            />
          ))}
        </Card>

        {/* Google Account */}
        <SectionHeader title="Google Account" colors={colors} />
        <GoogleAccountSection colors={colors} />

        {/* About */}
        <SectionHeader title="About" colors={colors} />
        <Card style={styles.card}>
          <View style={[styles.row, { borderBottomColor: colors.divider }]}>
            <Ionicons
              name="information-circle-outline"
              size={20}
              color={colors.textSecondary}
              style={styles.rowIcon}
            />
            <Text style={[typography.body1, { color: colors.text, flex: 1 }]}>Version</Text>
            <Text style={[typography.body2, { color: colors.textSecondary }]}>{appVersion}</Text>
          </View>
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <Ionicons
              name="code-slash-outline"
              size={20}
              color={colors.textSecondary}
              style={styles.rowIcon}
            />
            <Text style={[typography.body1, { color: colors.text }]}>Event Importer</Text>
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    padding: spacing.md,
  },
  sectionHeader: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  card: {
    overflow: 'hidden',
    padding: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 52,
  },
  rowIcon: {
    marginRight: spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: spacing.md,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
