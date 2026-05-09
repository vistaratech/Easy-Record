// src/pages/AdminDashboard.tsx
// Connected admin panel: fetches user count + user list from the backend.
// Render this component only inside <AdminRoute> — it assumes the viewer is admin.

import { useEffect, useState } from 'react';
import styles from './AdminDashboard.module.css'; // optional — inline styles used below

interface UserRecord {
  id: string;
  username: string;
  email: string;
  role: string;
  registrationDate: string; // ISO 8601
}

interface AdminStats {
  totalUsers: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch both resources in parallel for faster paint.
    Promise.all([
      fetch('/api/admin/stats', { credentials: 'include' }).then((r) => {
        if (!r.ok) throw new Error('Failed to load stats');
        return r.json();
      }),
      fetch('/api/admin/users', { credentials: 'include' }).then((r) => {
        if (!r.ok) throw new Error('Failed to load users');
        return r.json();
      }),
    ])
      .then(([statsData, usersData]) => {
        setStats(statsData);
        setUsers(usersData);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={s.centered}>
        <p style={s.muted}>Loading admin data…</p>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div style={s.centered}>
        <p style={{ color: '#ef4444' }}>Error: {error}</p>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={s.page}>
      <header style={s.header}>
        <h1 style={s.title}>Admin Dashboard</h1>
        <p style={s.subtitle}>User management &amp; metrics</p>
      </header>

      {/* ── Metric Card ── */}
      <section style={s.metricsRow}>
        <div style={s.card}>
          <span style={s.cardLabel}>Total Registrations</span>
          <span style={s.cardValue}>{stats?.totalUsers ?? '–'}</span>
        </div>
      </section>

      {/* ── User Table ── */}
      <section style={s.tableSection}>
        <h2 style={s.sectionTitle}>Registered Users</h2>

        {users.length === 0 ? (
          <p style={s.muted}>No users found.</p>
        ) : (
          <div style={s.tableWrapper}>
            <table style={s.table}>
              <thead>
                <tr>
                  {['Username', 'Email', 'Role', 'Registered'].map((h) => (
                    <th key={h} style={s.th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={s.tr}>
                    <td style={s.td}>{u.username}</td>
                    <td style={s.td}>{u.email}</td>
                    <td style={s.td}>
                      <RoleBadge role={u.role} />
                    </td>
                    <td style={s.td}>
                      {new Date(u.registrationDate).toLocaleDateString('en-IN', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

// ── Role badge ─────────────────────────────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    admin: '#6366f1',
    editor: '#f59e0b',
    user: '#6b7280',
  };
  return (
    <span
      style={{
        background: colors[role] ?? '#6b7280',
        color: '#fff',
        borderRadius: 4,
        padding: '2px 8px',
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: '0.03em',
      }}
    >
      {role}
    </span>
  );
}

// ── Inline styles (avoids CSS module dependency) ───────────────────────────────
const s: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 960,
    margin: '0 auto',
    padding: '2rem 1.5rem',
    fontFamily: "'DM Sans', sans-serif",
  },
  header: { marginBottom: '2rem' },
  title: { fontSize: '1.75rem', fontWeight: 700, margin: 0 },
  subtitle: { color: '#6b7280', margin: '0.25rem 0 0' },
  metricsRow: { display: 'flex', gap: '1rem', marginBottom: '2rem' },
  card: {
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: '1.25rem 1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    minWidth: 180,
  },
  cardLabel: { fontSize: 13, color: '#6b7280', fontWeight: 500 },
  cardValue: { fontSize: '2rem', fontWeight: 700, color: '#111827' },
  tableSection: {},
  sectionTitle: { fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' },
  tableWrapper: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  th: {
    textAlign: 'left',
    padding: '10px 14px',
    background: '#f3f4f6',
    fontWeight: 600,
    color: '#374151',
    borderBottom: '1px solid #e5e7eb',
  },
  tr: { borderBottom: '1px solid #f3f4f6' },
  td: { padding: '10px 14px', color: '#1f2937' },
  centered: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
  },
  muted: { color: '#9ca3af' },
};
