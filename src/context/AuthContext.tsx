import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

export type UserRole = 'host' | 'viewer';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  displayName: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: AuthUser) => Promise<void>;
  logout: () => Promise<void>;
}

const TOKEN_KEY = 'nocaps_auth_token';

const AuthContext = createContext<AuthContextValue | null>(null);

/** Decode a JWT payload without verifying the signature (server will verify on each request). */
function decodeToken(token: string): AuthUser | null {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload));
    // Reject if expired
    if (decoded.exp && decoded.exp * 1000 < Date.now()) return null;
    return {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      displayName: decoded.displayName,
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount, restore session from secure storage
  useEffect(() => {
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(TOKEN_KEY);
        if (stored) {
          const decoded = decodeToken(stored);
          if (decoded) {
            setToken(stored);
            setUser(decoded);
          } else {
            // Token expired — clear it
            await SecureStore.deleteItemAsync(TOKEN_KEY);
          }
        }
      } catch {
        // Secure store unavailable (simulator quirk) — continue as logged out
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = async (newToken: string, newUser: AuthUser) => {
    await SecureStore.setItemAsync(TOKEN_KEY, newToken);
    setToken(newToken);
    setUser(newUser);
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
