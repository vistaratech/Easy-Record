// src/pages/AdminDashboard.tsx
import { useEffect, useState } from 'react';
import { Users, LayoutDashboard, ChevronRight, Check } from 'lucide-react';

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

interface RegisterPermission {
  registerId: string;
  registerName: string;
  businessName: string;
  canView: boolean;
}

type View = 'overview' | 'users' | 'user-detail';

export default function AdminDashboard() {
  const [view, setView] = useState<View>('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [permissions, setPermissions] = useState<RegisterPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [sData, uData] = await Promise.all([
        fetch('/api/admin/stats').then(r => r.json()),
        fetch('/api/admin/users').then(r => r.json())
      ]);
      setStats(sData);
      setUsers(uData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUserClick(user: UserRecord) {
    setSelectedUser(user);
    setView('user-detail');
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/permissions`);
      const data = await res.json();
      setPermissions(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function togglePermission(regId: string, currentVal: boolean) {
    if (!selectedUser) return;
    
    // Optimistic update
    const newPerms = permissions.map(p => 
      p.registerId === regId ? { ...p, canView: !currentVal } : p
    );
    setPermissions(newPerms);

    try {
      setSaving(true);
      await fetch('/api/admin/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser.id,
          permissions: [{ registerId: regId, canView: !currentVal }]
        })
      });
    } catch (err: any) {
      // Rollback on error
      setPermissions(permissions);
      alert('Failed to update permission: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  if (error) return <div style={s.centered}><p style={{ color: '#ef4444' }}>Error: {error}</p></div>;

  return (
    <div style={s.container}>
      {/* Sidebar */}
      <aside style={s.sidebar}>
        <div style={s.sidebarHeader}>
          <h2 style={s.sidebarBrand}>Easy Record</h2>
          <span style={s.sidebarTag}>Admin Panel</span>
        </div>
        <nav style={s.nav}>
          <button 
            style={{ ...s.navItem, ...(view === 'overview' ? s.navItemActive : {}) }}
            onClick={() => setView('overview')}
          >
            <LayoutDashboard size={20} />
            <span>Overview</span>
          </button>
          <button 
            style={{ ...s.navItem, ...(view === 'users' || view === 'user-detail' ? s.navItemActive : {}) }}
            onClick={() => setView('users')}
          >
            <Users size={20} />
            <span>Users</span>
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main style={s.main}>
        {loading && view !== 'user-detail' ? (
          <div style={s.centered}><p>Loading...</p></div>
        ) : (
          <>
            {view === 'overview' && (
              <div style={s.overviewContainer}>
                <h1 style={s.viewTitle}>Dashboard Overview</h1>
                <div style={s.statsCard}>
                  <span style={s.statsLabel}>System Active Users</span>
                  <span style={s.statsValue}>{stats?.userCount ?? 0}</span>
                </div>
              </div>
            )}

            {view === 'users' && (
              <div style={s.viewContainer}>
                <h1 style={s.viewTitle}>User Management</h1>
                <div style={s.card}>
                  <table style={s.table}>
                    <thead>
                      <tr>
                        <th style={s.th}>Name</th>
                        <th style={s.th}>Email</th>
                        <th style={s.th}>Joined</th>
                        <th style={s.th}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(u => (
                        <tr key={u.id} style={s.tr} onClick={() => handleUserClick(u)}>
                          <td style={s.td}>
                            <div style={s.userName}>{u.name}</div>
                            {u.isAdmin && <span style={s.adminBadge}>Admin</span>}
                          </td>
                          <td style={s.td}>{u.email}</td>
                          <td style={s.td}>{new Date(u.createdAt).toLocaleDateString()}</td>
                          <td style={s.td}>
                            <ChevronRight size={18} color="#94a3b8" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {view === 'user-detail' && selectedUser && (
              <div style={s.viewContainer}>
                <div style={s.breadcrumb}>
                  <span onClick={() => setView('users')} style={s.breadcrumbLink}>Users</span>
                  <ChevronRight size={14} />
                  <span>{selectedUser.name} Permissions</span>
                </div>
                
                <div style={s.headerRow}>
                  <div>
                    <h1 style={s.viewTitle}>{selectedUser.name}</h1>
                    <p style={s.subtitle}>{selectedUser.email}</p>
                  </div>
                </div>

                <div style={s.card}>
                  <div style={s.cardHeader}>
                    <h3 style={s.cardTitle}>Register Access Control</h3>
                    <p style={s.cardSubtitle}>Enable checkboxes to grant view access to specific registers.</p>
                  </div>
                  
                  {loading ? (
                    <div style={{ padding: '2rem', textAlign: 'center' }}>Loading registers...</div>
                  ) : (
                    <div style={s.permissionsList}>
                      {permissions.map(p => (
                        <div key={p.registerId} style={s.permissionItem}>
                          <div style={s.permissionInfo}>
                            <div style={s.regName}>{p.registerName}</div>
                            <div style={s.bizName}>{p.businessName}</div>
                          </div>
                          <label style={s.checkboxContainer}>
                            <input 
                              type="checkbox" 
                              checked={p.canView} 
                              onChange={() => togglePermission(p.registerId, p.canView)}
                              style={s.hiddenCheckbox}
                            />
                            <div style={{ 
                              ...s.customCheckbox, 
                              ...(p.canView ? s.checkboxChecked : {}) 
                            }}>
                              {p.canView && <Check size={14} strokeWidth={3} color="#fff" />}
                            </div>
                          </label>
                        </div>
                      ))}
                      {permissions.length === 0 && (
                        <p style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                          No registers available in the system.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>
      
      {saving && (
        <div style={s.savingToast}>
          Saving changes...
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    minHeight: '100vh',
    background: '#f8fafc',
    color: '#0f172a',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  sidebar: {
    width: 260,
    background: '#002D5D',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    padding: '1.5rem 0',
  },
  sidebarHeader: {
    padding: '0 1.5rem 2rem',
  },
  sidebarBrand: {
    fontSize: '1.25rem',
    fontWeight: 700,
    margin: 0,
    letterSpacing: '-0.02em',
  },
  sidebarTag: {
    fontSize: '0.75rem',
    opacity: 0.6,
    textTransform: 'uppercase',
    fontWeight: 600,
    letterSpacing: '0.05em',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '0 0.75rem',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '0.75rem 1rem',
    borderRadius: 8,
    border: 'none',
    background: 'transparent',
    color: 'rgba(255,255,255,0.7)',
    cursor: 'pointer',
    textAlign: 'left',
    fontSize: 14,
    fontWeight: 500,
    transition: 'all 0.2s',
  },
  navItemActive: {
    background: 'rgba(255,255,255,0.1)',
    color: '#fff',
  },
  main: {
    flex: 1,
    padding: '2.5rem',
    overflowY: 'auto',
  },
  overviewContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    paddingBottom: '5rem',
  },
  viewTitle: {
    fontSize: '1.875rem',
    fontWeight: 700,
    margin: '0 0 1.5rem',
    color: '#002D5D',
  },
  statsCard: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 24,
    padding: '3rem 5rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)',
  },
  statsLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  statsValue: {
    fontSize: '6rem',
    fontWeight: 800,
    color: '#002D5D',
    lineHeight: 1,
  },
  viewContainer: {
    maxWidth: 1000,
    margin: '0 auto',
  },
  card: {
    background: '#fff',
    borderRadius: 12,
    border: '1px solid #e2e8f0',
    overflow: 'hidden',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: '1rem 1.5rem',
    background: '#f8fafc',
    fontSize: 12,
    fontWeight: 600,
    color: '#64748b',
    textTransform: 'uppercase',
    borderBottom: '1px solid #e2e8f0',
  },
  tr: {
    borderBottom: '1px solid #f1f5f9',
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  td: {
    padding: '1rem 1.5rem',
    fontSize: 14,
  },
  userName: {
    fontWeight: 600,
    color: '#0f172a',
  },
  adminBadge: {
    fontSize: 10,
    background: '#e0f2fe',
    color: '#0369a1',
    padding: '2px 6px',
    borderRadius: 4,
    fontWeight: 700,
    marginLeft: 8,
  },
  breadcrumb: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    color: '#64748b',
    marginBottom: '1.5rem',
  },
  breadcrumbLink: {
    cursor: 'pointer',
    color: '#002D5D',
    fontWeight: 600,
  },
  headerRow: {
    marginBottom: '2rem',
  },
  subtitle: {
    color: '#64748b',
    margin: 0,
  },
  cardHeader: {
    padding: '1.5rem',
    borderBottom: '1px solid #f1f5f9',
  },
  cardTitle: {
    margin: 0,
    fontSize: '1.125rem',
    fontWeight: 600,
  },
  cardSubtitle: {
    margin: '4px 0 0',
    fontSize: 13,
    color: '#64748b',
  },
  permissionsList: {
    display: 'flex',
    flexDirection: 'column',
  },
  permissionItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1.25rem 1.5rem',
    borderBottom: '1px solid #f1f5f9',
  },
  permissionInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  regName: {
    fontWeight: 600,
    fontSize: 15,
  },
  bizName: {
    fontSize: 12,
    color: '#94a3b8',
  },
  checkboxContainer: {
    cursor: 'pointer',
  },
  hiddenCheckbox: {
    display: 'none',
  },
  customCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    border: '2px solid #cbd5e1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
  },
  checkboxChecked: {
    background: '#002D5D',
    borderColor: '#002D5D',
  },
  centered: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '60vh',
  },
  savingToast: {
    position: 'fixed',
    bottom: 24,
    right: 24,
    background: '#1e293b',
    color: '#fff',
    padding: '12px 24px',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
    zIndex: 1000,
  }
};
