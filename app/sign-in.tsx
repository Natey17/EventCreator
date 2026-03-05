/**
 * Sign-in screen — Google OAuth via expo-auth-session.
 *
 * SETUP REQUIRED:
 * 1. Create a project in Google Cloud Console (console.cloud.google.com).
 * 2. Enable the "Google Calendar API".
 * 3. Create OAuth 2.0 credentials:
 *    - Web client:     Authorized redirect URIs → add your Expo auth proxy URI
 *                      (shown in console when you run the app) + production URL
 *    - iOS client:     Bundle ID → com.eventimporter.app
 *    - Android client: Package + SHA-1 fingerprint
 * 4. Copy client IDs into your .env file (see .env.example).
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../src/auth/AuthContext';
import { useTheme } from '../src/theme/ThemeContext';
import { spacing, borderRadius } from '../src/theme/spacing';
import { typography } from '../src/theme/typography';
import { AppBar } from '../src/components/AppBar';
import { GoogleUser } from '../src/auth/auth';

// Required on web to handle the auth redirect coming back into the app.
WebBrowser.maybeCompleteAuthSession();

// Read client IDs from EXPO_PUBLIC_ env vars (set in .env — never commit secrets).
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;

// expo-auth-session throws an invariant at render-time if webClientId is falsy on web.
// Pass a placeholder so the hook mounts safely; the button stays disabled until
// a real client ID is present (guarded by clientIdsConfigured below).
const SAFE_WEB_CLIENT_ID = WEB_CLIENT_ID ?? 'not-configured';

const SCOPES = [
  'openid',
  'profile',
  'email',
  'https://www.googleapis.com/auth/calendar.events',
];

type SignInStatus = 'idle' | 'waiting' | 'fetching_user' | 'error';

export default function SignInScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { setAuth } = useAuth();

  const [status, setStatus] = useState<SignInStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: SAFE_WEB_CLIENT_ID, // prop renamed in expo-auth-session v6
    iosClientId: IOS_CLIENT_ID,
    androidClientId: ANDROID_CLIENT_ID,
    scopes: SCOPES,
  });

  // Handle auth response whenever it changes
  useEffect(() => {
    if (!response) return;

    if (response.type === 'success') {
      const accessToken = response.authentication?.accessToken;
      const expiresIn = response.authentication?.expiresIn ?? null;

      if (accessToken) {
        fetchUserAndSave(accessToken, expiresIn);
      } else {
        setStatus('error');
        setErrorMsg('No access token received. Please try again.');
      }
    } else if (response.type === 'error') {
      setStatus('error');
      setErrorMsg(response.error?.message ?? 'Authentication failed. Please try again.');
    } else {
      // 'dismiss', 'cancel', 'locked' — user backed out
      setStatus('idle');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  const fetchUserAndSave = useCallback(
    async (accessToken: string, expiresIn: number | null) => {
      setStatus('fetching_user');
      try {
        const res = await fetch('https://www.googleapis.com/userinfo/v2/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!res.ok) {
          throw new Error(`User info request failed (${res.status})`);
        }

        const json = await res.json();

        const user: GoogleUser = {
          email: json.email ?? '',
          name: json.name ?? '',
          picture: json.picture ?? null,
        };

        const expiresAt = expiresIn ? Date.now() + expiresIn * 1000 : null;

        await setAuth({
          isSignedIn: true,
          accessToken,
          expiresAt,
          user,
        });

        // Go back to wherever the user came from (Review, Settings, etc.)
        router.back();
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Failed to fetch user info.';
        setStatus('error');
        setErrorMsg(message);
      }
    },
    [setAuth]
  );

  const handleSignIn = useCallback(() => {
    if (!request) return;
    setStatus('waiting');
    setErrorMsg('');
    promptAsync();
  }, [request, promptAsync]);

  const isLoading = status === 'waiting' || status === 'fetching_user';
  const clientIdsConfigured = Boolean(WEB_CLIENT_ID || IOS_CLIENT_ID || ANDROID_CLIENT_ID);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppBar title="Connect Google" showBack onBack={() => router.back()} />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={[styles.logoCircle, { backgroundColor: colors.primaryLight }]}>
            <Text style={[styles.logoG, { color: colors.primary }]}>G</Text>
          </View>

          <Text
            style={[
              typography.h2,
              { color: colors.text, textAlign: 'center', marginTop: spacing.lg },
            ]}
          >
            Connect Google Calendar
          </Text>

          <Text
            style={[
              typography.body1,
              {
                color: colors.textSecondary,
                textAlign: 'center',
                marginTop: spacing.sm,
                lineHeight: 24,
              },
            ]}
          >
            Sign in with Google so you can import events directly into your calendar.
          </Text>
        </View>

        {/* Permissions card */}
        <View
          style={[
            styles.scopeCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text
            style={[
              typography.label,
              { color: colors.textSecondary, marginBottom: spacing.sm },
            ]}
          >
            Permission requested
          </Text>

          {[
            { icon: '👤', text: 'View your name, email, and profile picture' },
            { icon: '📅', text: 'Create and update events in Google Calendar' },
          ].map((item) => (
            <View key={item.text} style={styles.scopeRow}>
              <Text style={styles.scopeIcon}>{item.icon}</Text>
              <Text style={[typography.body2, { color: colors.text, flex: 1 }]}>
                {item.text}
              </Text>
            </View>
          ))}
        </View>

        {/* Client ID warning (dev-only) */}
        {!clientIdsConfigured && (
          <View
            style={[
              styles.warningBox,
              { backgroundColor: colors.surface, borderColor: colors.error },
            ]}
          >
            <Text style={[typography.label, { color: colors.error, marginBottom: spacing.xs }]}>
              Client IDs not configured
            </Text>
            <Text style={[typography.body2, { color: colors.textSecondary }]}>
              Add your Google OAuth client IDs to{' '}
              <Text style={{ fontWeight: '600' }}>.env</Text> — see{' '}
              <Text style={{ fontWeight: '600' }}>.env.example</Text> for the required keys.
            </Text>
          </View>
        )}

        {/* Error message */}
        {status === 'error' && (
          <View
            style={[
              styles.errorBox,
              { backgroundColor: colors.surface, borderColor: colors.error },
            ]}
          >
            <Text style={[typography.body2, { color: colors.error }]}>{errorMsg}</Text>
          </View>
        )}

        {/* Google sign-in button */}
        <TouchableOpacity
          style={[
            styles.googleButton,
            { borderColor: colors.border, backgroundColor: colors.surface },
            (isLoading || !request || !clientIdsConfigured) && styles.buttonDisabled,
          ]}
          onPress={handleSignIn}
          disabled={isLoading || !request || !clientIdsConfigured}
          activeOpacity={0.75}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: spacing.md }} />
          ) : (
            <Text style={styles.googleG}>G</Text>
          )}
          <Text style={[typography.button, { color: colors.text }]}>
            {status === 'fetching_user' ? 'Loading profile…' : isLoading ? 'Opening Google…' : 'Continue with Google'}
          </Text>
        </TouchableOpacity>

        <Text
          style={[
            typography.caption,
            { color: colors.textDisabled, textAlign: 'center', marginTop: spacing.md },
          ]}
        >
          Your credentials are handled by Google and never sent to our servers.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flexGrow: 1,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    maxWidth: 380,
    width: '100%',
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoG: {
    fontSize: 40,
    fontWeight: '700',
  },
  scopeCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  scopeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  scopeIcon: {
    fontSize: 16,
    lineHeight: 22,
  },
  warningBox: {
    width: '100%',
    maxWidth: 380,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorBox: {
    width: '100%',
    maxWidth: 380,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.xl,
    borderWidth: 1.5,
    width: '100%',
    maxWidth: 380,
    minHeight: 52,
    gap: spacing.md,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  googleG: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A73E8',
  },
});
