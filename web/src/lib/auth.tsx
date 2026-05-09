import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getMe, clearAllCaches, type User } from './api';

const TOKEN_KEY = 'recordbook_token';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  authLoading: boolean; // Alias for isLoading as requested
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Restore token from localStorage so sessions survive page refreshes
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem(TOKEN_KEY);
    // If a token exists, hydrate a minimal user so PrivateRoute lets us through
    return saved ? { id: 1, email: '', name: 'Loading...', createdAt: '', isAdmin: false } : null;
  });
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    async function loadUser() {
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const userData = await getMe();
        setUser(userData);
      } catch (err) {
        console.error('Session validation failed:', err);
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }
    loadUser();
  }, [token]);

  const login = useCallback((newToken: string, newUser: User) => {
    // Clear all caches from the previous session before setting the new user
    queryClient.clear();
    clearAllCaches();
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setUser(newUser);
  }, [queryClient]);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    // Clear all cached data so the next user starts fresh
    queryClient.clear();
    clearAllCaches();
  }, [queryClient]);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, authLoading: isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
