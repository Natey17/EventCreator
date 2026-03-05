import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AuthState, DEFAULT_AUTH_STATE, loadAuth, saveAuth, clearAuth } from './auth';

interface AuthContextValue {
  auth: AuthState;
  /** True while auth is being loaded from AsyncStorage on startup. */
  isAuthLoading: boolean;
  /** Persist and update in-memory auth state. */
  setAuth: (state: AuthState) => Promise<void>;
  /** Sign out and clear persisted auth state. */
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  auth: DEFAULT_AUTH_STATE,
  isAuthLoading: true,
  setAuth: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuthState] = useState<AuthState>(DEFAULT_AUTH_STATE);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Hydrate from storage on mount
  useEffect(() => {
    loadAuth().then((state) => {
      setAuthState(state);
      setIsAuthLoading(false);
    });
  }, []);

  const setAuth = useCallback(async (state: AuthState) => {
    setAuthState(state);
    await saveAuth(state);
  }, []);

  const signOut = useCallback(async () => {
    const signedOut: AuthState = {
      isSignedIn: false,
      accessToken: null,
      expiresAt: null,
      user: null,
    };
    setAuthState(signedOut);
    await clearAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ auth, isAuthLoading, setAuth, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
