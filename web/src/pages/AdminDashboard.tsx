// src/pages/AdminDashboard.tsx
import { useEffect, useState } from 'react';
import { Users, LayoutDashboard, ChevronRight, ChevronLeft, Check, Eye, Pencil, Download } from 'lucide-react';

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
  canEdit: boolean;
  canDownload: boolean;
}

type View = 'overview' | 'users' | 'user-detail';

export default function AdminDashboard() {
  const [view, setView] = useState<View>('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [permissions, setPermissions] = useState<RegisterPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [permLoading, setPermLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [sData, uData] = await Promise.all([
        fetch('/api/admin/stats').then(r => { if (!r.ok) throw new Error('Failed to load stats'); return r.json(); }),
        fetch('/api/admin/users').then(r => { if (!r.ok) throw new Error('Failed to load users'); return r.json(); })
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
    setPermLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/permissions`);
      if (!res.ok) throw new Error('Failed to load permissions');
      const data = await res.json();
      setPermissions(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPermLoading(false);
    }
  }

  async function togglePermission(regId: string, field: 'canView' | 'canEdit' | 'canDownload') {
    if (!selectedUser) return;

    const current = permissions.find(p => p.registerId === regId);
    if (!current) return;

    // Build new permission state with hierarchy logic
    const updated = { ...current };
    updated[field] = !updated[field];

    // Hierarchy: If canView is turned off, disable edit and download too
    if (field === 'canView' && !updated.canView) {
      updated.canEdit = false;
      updated.canDownload = false;
    }
    // Hierarchy: If canEdit or canDownload is turned on, canView must be on
    if ((field === 'canEdit' && updated.canEdit) || (field === 'canDownload' && updated.canDownload)) {
      updated.canView = true;
    }

    // Optimistic update
    setPermissions(prev => prev.map(p => p.registerId === regId ? updated : p));

    try {
      setSaving(true);
      const res = await fetch('/api/admin/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser.id,
          permissions: [{ registerId: regId, canView: updated.canView, canEdit: updated.canEdit, canDownload: updated.canDownload }]
        })
      });
      if (!res.ok) throw new Error('Failed to save');
    } catch (err: any) {
      // Rollback
      setPermissions(prev => prev.map(p => p.registerId === regId ? current : p));
    } finally {
      setSaving(false);
    }
  }

  if (error && !stats) return <div style={s.centered}><p style={{ color: '#ef4444', fontSize: 15 }}>Error: {error}</p></div>;

  return (
    <div style={s.container}>
      {/* ──────── Sidebar ──────── */}
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
            <LayoutDashboard size={18} />
            <span>Overview</span>
          </button>
          <button
            style={{ ...s.navItem, ...(view === 'users' || view === 'user-detail' ? s.navItemActive : {}) }}
            onClick={() => { setView('users'); setSelectedUser(null); }}
          >
            <Users size={18} />
            <span>Users</span>
            {stats && <span style={s.navBadge}>{stats.userCount}</span>}
          </button>
        </nav>
      </aside>

      {/* ──────── Main Content ──────── */}
      <main style={s.main}>
        {loading ? (
          <div style={s.centered}><p style={{ color: '#94a3b8' }}>Loading...</p></div>
        ) : (
          <>
            {/* ── Overview ── */}
            {view === 'overview' && (
              <div style={s.overviewWrap}>
                <h1 style={s.pageTitle}>Dashboard Overview</h1>
                <div style={s.statsGrid}>
                  <div style={s.statCard} onClick={() => setView('users')}>
                    <div style={s.statIconWrap}>
                      <Users size={28} color="#fff" />
                    </div>
                    <div>
                      <div style={s.statValue}>{stats?.userCount ?? 0}</div>
                      <div style={s.statLabel}>Total Users</div>
                    </div>
                    <ChevronRight size={20} color="#94a3b8" style={{ marginLeft: 'auto' }} />
                  </div>
                </div>
              </div>
            )}

            {/* ── Users List ── */}
            {view === 'users' && (
              <div style={s.viewContainer}>
                <h1 style={s.pageTitle}>User Management</h1>
                <p style={s.pageSubtitle}>{users.length} registered user{users.length !== 1 ? 's' : ''}</p>

                <div style={s.card}>
                  <table style={s.table}>
                    <thead>
                      <tr>
                        <th style={s.th}>Name</th>
                        <th style={s.th}>Email</th>
                        <th style={s.th}>Role</th>
                        <th style={s.th}>Joined</th>
                        <th style={{ ...s.th, width: 40 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(u => (
                        <tr
                          key={u.id}
                          style={s.tr}
                          onClick={() => handleUserClick(u)}
                          onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                          onMouseLeave={e => (e.currentTarget.style.background = '')}
                        >
                          <td style={s.td}>
                            <span style={{ fontWeight: 600, color: '#0f172a' }}>{u.name}</span>
                          </td>
                          <td style={s.td}>{u.email}</td>
                          <td style={s.td}>
                            <span style={{
                              fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                              padding: '3px 8px', borderRadius: 4,
                              background: u.isAdmin ? '#002D5D' : '#f1f5f9',
                              color: u.isAdmin ? '#fff' : '#64748b',
                            }}>
                              {u.isAdmin ? 'ADMIN' : 'USER'}
                            </span>
                          </td>
                          <td style={s.td}>{new Date(u.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                          <td style={s.td}><ChevronRight size={16} color="#94a3b8" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── User Detail: Permissions ── */}
            {view === 'user-detail' && selectedUser && (
              <div style={s.viewContainer}>
                {/* Breadcrumb */}
                <div style={s.breadcrumb}>
                  <span style={s.breadcrumbLink} onClick={() => { setView('users'); setSelectedUser(null); }}>
                    <ChevronLeft size={14} /> Users
                  </span>
                  <span style={{ color: '#94a3b8' }}>/</span>
                  <span style={{ color: '#0f172a', fontWeight: 600 }}>{selectedUser.name}</span>
                </div>

                {/* User Info Header */}
                <div style={s.userInfoHeader}>
                  <div style={s.userAvatar}>{selectedUser.name.charAt(0).toUpperCase()}</div>
                  <div>
                    <h1 style={{ ...s.pageTitle, marginBottom: 2 }}>{selectedUser.name}</h1>
                    <p style={s.pageSubtitle}>{selectedUser.email}</p>
                  </div>
                </div>

                {/* Permissions Card */}
                <div style={s.card}>
                  <div style={s.cardHeader}>
                    <div>
                      <h3 style={s.cardTitle}>Register Access Control</h3>
                      <p style={s.cardSubtitle}>
                        Manage what this user can do with each register. Toggle checkboxes to grant or revoke access.
                      </p>
                    </div>
                  </div>

                  {permLoading ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>Loading registers...</div>
                  ) : permissions.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                      This user has no registers.
                    </div>
                  ) : (
                    <>
                      {/* Column Headers */}
                      <div style={s.permHeader}>
                        <div style={{ flex: 1 }}>Register</div>
                        <div style={s.permColHeader}><Eye size={14} /> View</div>
                        <div style={s.permColHeader}><Pencil size={14} /> Edit</div>
                        <div style={s.permColHeader}><Download size={14} /> Download</div>
                      </div>

                      {/* Permission Rows */}
                      {permissions.map(p => (
                        <div key={p.registerId} style={s.permRow}>
                          <div style={s.permInfo}>
                            <div style={s.regName}>{p.registerName}</div>
                            <div style={s.bizName}>{p.businessName}</div>
                          </div>

                          {/* View Checkbox */}
                          <div style={s.permCol}>
                            <label style={s.checkLabel}>
                              <input type="checkbox" checked={p.canView} onChange={() => togglePermission(p.registerId, 'canView')} style={s.hiddenCb} />
                              <div style={{ ...s.customCb, ...(p.canView ? s.cbCheckedView : {}) }}>
                                {p.canView && <Check size={14} strokeWidth={3} color="#fff" />}
                              </div>
                            </label>
                          </div>

                          {/* Edit Checkbox */}
                          <div style={s.permCol}>
                            <label style={s.checkLabel}>
                              <input type="checkbox" checked={p.canEdit} onChange={() => togglePermission(p.registerId, 'canEdit')} style={s.hiddenCb} />
                              <div style={{ ...s.customCb, ...(p.canEdit ? s.cbCheckedEdit : {}) }}>
                                {p.canEdit && <Check size={14} strokeWidth={3} color="#fff" />}
                              </div>
                            </label>
                          </div>

                          {/* Download Checkbox */}
                          <div style={s.permCol}>
                            <label style={s.checkLabel}>
                              <input type="checkbox" checked={p.canDownload} onChange={() => togglePermission(p.registerId, 'canDownload')} style={s.hiddenCb} />
                              <div style={{ ...s.customCb, ...(p.canDownload ? s.cbCheckedDownload : {}) }}>
                                {p.canDownload && <Check size={14} strokeWidth={3} color="#fff" />}
                              </div>
                            </label>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Saving Toast */}
      {saving && <div style={s.savingToast}>Saving...</div>}
    </div>
  );
}

/* ──────── Styles ──────── */
const s: Record<string, React.CSSProperties> = {
  container: { display: 'flex', minHeight: '100vh', background: '#f8fafc', fontFamily: 'Inter, system-ui, sans-serif' },

  /* Sidebar */
  sidebar: { width: 250, background: '#002D5D', color: '#fff', display: 'flex', flexDirection: 'column', padding: '1.5rem 0', flexShrink: 0 },
  sidebarHeader: { padding: '0 1.5rem 2rem' },
  sidebarBrand: { fontSize: '1.2rem', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' },
  sidebarTag: { fontSize: '0.7rem', opacity: 0.5, textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.06em' },
  nav: { display: 'flex', flexDirection: 'column', gap: 2, padding: '0 0.75rem' },
  navItem: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '0.7rem 1rem', borderRadius: 8,
    border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.6)', cursor: 'pointer',
    textAlign: 'left', fontSize: 14, fontWeight: 500, transition: 'all 0.15s',
  },
  navItemActive: { background: 'rgba(255,255,255,0.12)', color: '#fff' },
  navBadge: {
    marginLeft: 'auto', fontSize: 11, fontWeight: 700, background: 'rgba(255,255,255,0.2)',
    padding: '2px 8px', borderRadius: 10, color: '#fff',
  },

  /* Main */
  main: { flex: 1, padding: '2.5rem', overflowY: 'auto' },

  /* Overview */
  overviewWrap: { maxWidth: 700, margin: '0 auto' },
  statsGrid: { display: 'flex', gap: '1rem', marginTop: '0.5rem' },
  statCard: {
    display: 'flex', alignItems: 'center', gap: 20, background: '#fff', borderRadius: 14,
    padding: '1.75rem 2rem', border: '1px solid #e2e8f0', cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(0,0,0,0.04)', transition: 'box-shadow 0.2s', flex: 1,
  },
  statIconWrap: {
    width: 52, height: 52, borderRadius: 14, background: '#002D5D',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  statValue: { fontSize: '2.25rem', fontWeight: 800, color: '#002D5D', lineHeight: 1 },
  statLabel: { fontSize: 13, color: '#64748b', fontWeight: 500, marginTop: 2 },

  /* Views */
  viewContainer: { maxWidth: 960, margin: '0 auto' },
  pageTitle: { fontSize: '1.75rem', fontWeight: 700, margin: '0 0 4px', color: '#002D5D' },
  pageSubtitle: { color: '#64748b', margin: '0 0 1.5rem', fontSize: 14 },

  /* Card */
  card: { background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' },
  cardHeader: { padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9' },
  cardTitle: { margin: 0, fontSize: '1rem', fontWeight: 600, color: '#0f172a' },
  cardSubtitle: { margin: '4px 0 0', fontSize: 13, color: '#64748b' },

  /* Table */
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'left', padding: '0.875rem 1.5rem', background: '#f8fafc', fontSize: 11,
    fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em',
    borderBottom: '1px solid #e2e8f0',
  },
  tr: { borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.15s' },
  td: { padding: '0.875rem 1.5rem', fontSize: 14, color: '#334155' },

  /* Breadcrumb */
  breadcrumb: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#64748b', marginBottom: '1.25rem' },
  breadcrumbLink: { cursor: 'pointer', color: '#002D5D', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 2 },

  /* User Info */
  userInfoHeader: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: '2rem' },
  userAvatar: {
    width: 48, height: 48, borderRadius: 12, background: '#002D5D', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700,
  },

  /* Permission Grid */
  permHeader: {
    display: 'flex', alignItems: 'center', padding: '0.75rem 1.5rem', background: '#f8fafc',
    borderBottom: '1px solid #e2e8f0', fontSize: 11, fontWeight: 600, color: '#64748b',
    textTransform: 'uppercase', letterSpacing: '0.04em',
  },
  permColHeader: { width: 100, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 },
  permRow: {
    display: 'flex', alignItems: 'center', padding: '1rem 1.5rem',
    borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s',
  },
  permInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: 2 },
  regName: { fontWeight: 600, fontSize: 14, color: '#0f172a' },
  bizName: { fontSize: 12, color: '#94a3b8' },
  permCol: { width: 100, display: 'flex', justifyContent: 'center' },

  /* Custom Checkbox */
  checkLabel: { cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  hiddenCb: { display: 'none' },
  customCb: {
    width: 26, height: 26, borderRadius: 6, border: '2px solid #cbd5e1',
    display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
  },
  cbCheckedView: { background: '#002D5D', borderColor: '#002D5D' },
  cbCheckedEdit: { background: '#0891b2', borderColor: '#0891b2' },
  cbCheckedDownload: { background: '#059669', borderColor: '#059669' },

  /* Misc */
  centered: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' },
  savingToast: {
    position: 'fixed', bottom: 24, right: 24, background: '#1e293b', color: '#fff',
    padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 500,
    boxShadow: '0 8px 20px rgba(0,0,0,0.12)', zIndex: 1000,
  },
};
