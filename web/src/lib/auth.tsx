import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { clearAllCaches, type User } from './api';
import { auth, firestore } from './firebase';
import { onAuthStateChanged, signOut as firebaseSignOut, type User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const TOKEN_KEY = 'recordbook_token';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  authLoading: boolean; // Alias for isLoading as requested
  login: (token: string, user: User) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem(TOKEN_KEY);
    // If a token exists, hydrate a minimal user so PrivateRoute lets us through
    return saved ? { id: 1, email: '', name: 'Loading...', createdAt: '', isAdmin: false } : null;
  });
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        const idToken = await firebaseUser.getIdToken();
        setToken(idToken);
        localStorage.setItem(TOKEN_KEY, idToken);

        // Fetch custom user doc from Firestore
        const userDocRef = doc(firestore, 'users', firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        let customUser: User;
        if (userDocSnap.exists()) {
          customUser = { id: firebaseUser.uid, ...userDocSnap.data() } as User;
        } else {
          customUser = {
            id: firebaseUser.uid,
            email: firebaseUser.email || '',
            name: firebaseUser.displayName || 'New User',
            isAdmin: false,
            createdAt: new Date().toISOString()
          };
          // Create the document if it doesn't exist
          await setDoc(userDocRef, customUser);
        }
        setUser(customUser);
      } else {
        setToken(null);
        setUser(null);
        localStorage.removeItem(TOKEN_KEY);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = useCallback((newToken: string, newUser: User) => {
    queryClient.clear();
    clearAllCaches();
    setToken(newToken);
    setUser(newUser);
  }, [queryClient]);

  const logout = useCallback(async () => {
    await firebaseSignOut(auth);
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
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
