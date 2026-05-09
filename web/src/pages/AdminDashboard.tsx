// src/pages/AdminDashboard.tsx
import { useEffect, useState } from 'react';

interface UserRecord {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  createdAt: string;
}

interface AdminStats {
  userCount: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('recordbook_token');
    const headers = {
      'Authorization': `Bearer ${token}`
    };

    Promise.all([
      fetch('/api/admin/stats', { headers }).then((r) => {
        if (!r.ok) throw new Error('Failed to load stats');
        return r.json();
      }),
      fetch('/api/admin/users', { headers }).then((r) => {
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

  if (loading) {
    return (
      <div style={s.centered}>
        <p style={s.muted}>Loading admin data…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={s.centered}>
        <p style={{ color: '#ef4444' }}>Error: {error}</p>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <header style={s.header}>
        <h1 style={s.title}>Admin Dashboard</h1>
        <p style={s.subtitle}>User management & metrics</p>
      </header>

      <section style={s.metricsRow}>
        <div style={s.card}>
          <span style={s.cardLabel}>Total Registrations</span>
          <span style={s.cardValue}>{stats?.userCount ?? '–'}</span>
        </div>
      </section>

      <section style={s.tableSection}>
        <h2 style={s.sectionTitle}>Registered Users</h2>

        {users.length === 0 ? (
          <p style={s.muted}>No users found.</p>
        ) : (
          <div style={s.tableWrapper}>
            <table style={s.table}>
              <thead>
                <tr>
                  {['Name', 'Email', 'Role', 'Registered'].map((h) => (
                    <th key={h} style={s.th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={s.tr}>
                    <td style={s.td}>{u.name}</td>
                    <td style={s.td}>{u.email}</td>
                    <td style={s.td}>
                      <RoleBadge isAdmin={u.isAdmin} />
                    </td>
                    <td style={s.td}>
                      {new Date(u.createdAt).toLocaleDateString('en-IN', {
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

function RoleBadge({ isAdmin }: { isAdmin: boolean }) {
  return (
    <span
      style={{
        background: isAdmin ? '#002D5D' : '#6b7280',
        color: '#fff',
        borderRadius: 4,
        padding: '2px 8px',
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: '0.03em',
      }}
    >
      {isAdmin ? 'ADMIN' : 'USER'}
    </span>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 960,
    margin: '0 auto',
    padding: '2rem 1.5rem',
  },
  header: { marginBottom: '2rem' },
  title: { fontSize: '1.75rem', fontWeight: 700, margin: 0, color: '#002D5D' },
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
  cardValue: { fontSize: '2rem', fontWeight: 700, color: '#002D5D' },
  tableSection: {},
  sectionTitle: { fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem', color: '#002D5D' },
  tableWrapper: { overflowX: 'auto', background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  th: {
    textAlign: 'left',
    padding: '12px 14px',
    background: '#f8fafc',
    fontWeight: 600,
    color: '#475569',
    borderBottom: '1px solid #e5e7eb',
  },
  tr: { borderBottom: '1px solid #f1f5f9' },
  td: { padding: '12px 14px', color: '#1e293b' },
  centered: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
  },
  muted: { color: '#9ca3af' },
};
