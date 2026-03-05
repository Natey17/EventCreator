import AsyncStorage from '@react-native-async-storage/async-storage';

export type GoogleUser = {
  email: string;
  name: string;
  picture: string | null;
};

export type AuthState = {
  isSignedIn: boolean;
  accessToken: string | null;
  expiresAt: number | null; // Unix timestamp ms — null means "no expiry info"
  user: GoogleUser | null;
};

export const DEFAULT_AUTH_STATE: AuthState = {
  isSignedIn: false,
  accessToken: null,
  expiresAt: null,
  user: null,
};

const AUTH_STORAGE_KEY = '@event_importer_auth';

/**
 * Load auth state from AsyncStorage.
 * Automatically clears and returns the signed-out state if the token has expired.
 */
export async function loadAuth(): Promise<AuthState> {
  try {
    const raw = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return DEFAULT_AUTH_STATE;

    const parsed = JSON.parse(raw) as AuthState;

    // Treat token as expired if expiresAt is set and in the past
    if (parsed.expiresAt !== null && parsed.expiresAt < Date.now()) {
      await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
      return DEFAULT_AUTH_STATE;
    }

    return parsed;
  } catch {
    return DEFAULT_AUTH_STATE;
  }
}

/** Persist auth state to AsyncStorage. */
export async function saveAuth(state: AuthState): Promise<void> {
  await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state));
}

/** Remove auth state from AsyncStorage. */
export async function clearAuth(): Promise<void> {
  await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
}
