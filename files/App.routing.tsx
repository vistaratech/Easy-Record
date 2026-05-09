// src/App.tsx  (routing section — merge into your existing App.tsx)
// Shows how AdminRoute slots into React Router v6.

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import AdminRoute from './components/AdminRoute';
import AdminDashboard from './pages/AdminDashboard';

// Your existing page components
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
// ... other imports

export default function App() {
  return (
    /**
     * AuthProvider MUST wrap BrowserRouter (or at minimum the Routes).
     * This ensures the auth listener runs before any route evaluation.
     */
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />

          {/* Standard authenticated routes */}
          <Route path="/dashboard" element={<Dashboard />} />

          {/* ── Admin route — RBAC enforced ── */}
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            }
          />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
