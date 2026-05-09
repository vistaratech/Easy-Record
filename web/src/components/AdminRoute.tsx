// src/components/AdminRoute.tsx
// Drop-in protected route wrapper.
// Waits for auth hydration, then enforces user.isAdmin === true.

import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

interface AdminRouteProps {
  children: React.ReactNode;
}

/**
 * AdminRoute
 *
 * Wraps any component that should only be rendered for admin users.
 * Three possible states:
 *   1. Auth is still loading  → show a neutral spinner (prevents crash on direct URL)
 *   2. User is admin          → render children
 *   3. Any other case         → redirect to /dashboard (soft, non-exposing redirect)
 */
export default function AdminRoute({ children }: AdminRouteProps) {
  const { user, authLoading } = useAuth();

  // ── 1. Hydration guard ─────────────────────────────────────────────────────
  // The auth listener hasn't resolved yet (e.g. page refresh on /admin).
  // Returning a spinner prevents the route from rendering — and crashing —
  // before we know who the user is.
  if (authLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
        }}
        aria-label="Verifying session…"
      >
        <LoadingSpinner />
      </div>
    );
  }

  // ── 2. Role-Based Access Control ───────────────────────────────────────────
  // Only proceed if the user object exists AND carries the 'isAdmin' flag.
  if (user && user.isAdmin) {
    return <>{children}</>;
  }

  // ── 3. Redirect non-admin / unauthenticated users ─────────────────────────
  // `replace` removes /admin from the browser history so the back button
  // doesn't loop the user back into a failed access attempt.
  return <Navigate to="/" replace />;
}

// ── Inline spinner (no extra dependency) ──────────────────────────────────────
function LoadingSpinner() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ animation: 'spin 0.8s linear infinite' }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="20" cy="20" r="16" stroke="#e5e7eb" strokeWidth="4" />
      <path
        d="M20 4a16 16 0 0 1 16 16"
        stroke="#002D5D"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}
