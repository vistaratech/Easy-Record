// src/context/AuthContext.tsx
// Drop this file into your existing context folder.
// It wraps the JWT / session listener and exposes `authLoading` so any
// route guard can wait for hydration before making a redirect decision.

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────
export type UserRole = 'admin' | 'user' | 'editor'; // extend as needed

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: UserRole;
}

interface AuthContextValue {
  user: AuthUser | null;
  /** True while the initial token validation / session check is in flight.
   *  Route guards MUST check this before redirecting. */
  authLoading: boolean;
  logout: () => void;
}

// ── Context ───────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  // Start as `true` — we don't know the auth state yet.
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    /**
     * onAuthStateChanged equivalent for a JWT / session-cookie setup.
     *
     * This hits your existing `/api/auth/me` endpoint (or equivalent).
     * If you're using Firebase, replace this block with:
     *   const unsubscribe = auth.onAuthStateChanged(firebaseUser => { ... });
     *   return () => unsubscribe();
     */
    let cancelled = false; // prevents state updates on unmounted component

    async function validateSession() {
      try {
        const res = await fetch('/api/auth/me', {
          credentials: 'include', // send session cookie
        });

        if (!cancelled) {
          if (res.ok) {
            const data: AuthUser = await res.json();
            setUser(data);
          } else {
            // 401 / 403 — not authenticated
            setUser(null);
          }
        }
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        // CRITICAL: always clear the loading flag, even on error.
        // Without this, every protected route hangs on a spinner forever.
        if (!cancelled) setAuthLoading(false);
      }
    }

    validateSession();

    return () => {
      cancelled = true;
    };
  }, []);

  function logout() {
    setUser(null);
    // Call your logout endpoint, clear cookies/localStorage as needed.
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(
      () => {}
    );
  }

  return (
    <AuthContext.Provider value={{ user, authLoading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
