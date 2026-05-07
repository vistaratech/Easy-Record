import { useEffect, useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './lib/auth';
import { ErrorBoundary } from './components/ErrorBoundary';
import { saveToStorage } from './lib/api';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import './index.css';
import { NotificationProvider, useNotifications } from './lib/NotificationContext';

function GlobalSystemErrorListener() {
  const { addNotification } = useNotifications();

  useEffect(() => {
    const handleError = (e: ErrorEvent) => {
      addNotification({
        title: 'System Error',
        message: e.message || 'An unexpected error occurred.',
        type: 'error'
      });
    };

    const handleRejection = (e: PromiseRejectionEvent) => {
      addNotification({
        title: 'Network or Action Failed',
        message: e.reason?.message || 'An asynchronous action failed.',
        type: 'error'
      });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, [addNotification]);

  return null;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,     // 5 min — cached data used on revisit without refetch
      refetchOnWindowFocus: false,   // don't refetch just because user switched tabs
      retry: 1,                      // fail faster (default is 3)
    },
  },
});

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/** Toast notification for save feedback */
function SaveToast({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="save-toast">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
      Data saved successfully
    </div>
  );
}

function AppRoutes() {
  const { token } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={token ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/*" element={<PrivateRoute><HomePage /></PrivateRoute>} />
    </Routes>
  );
}

export default function App() {
  const [showSaveToast, setShowSaveToast] = useState(false);

  const handleSave = useCallback(() => {
    const ok = saveToStorage();
    if (ok) {
      setShowSaveToast(true);
      setTimeout(() => setShowSaveToast(false), 2000);
    }
  }, []);

  // Ctrl+S / Cmd+S global save handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave]);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NotificationProvider>
          <BrowserRouter>
            <ErrorBoundary>
              <GlobalSystemErrorListener />
              <AppRoutes />
              <SaveToast visible={showSaveToast} />
              <Toaster position="top-center" />
            </ErrorBoundary>
          </BrowserRouter>
        </NotificationProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
