// src/pages/AdminDashboard.tsx
import { useEffect, useState, useMemo } from 'react';
import { 
  Users, LayoutDashboard, ChevronRight, Check, Eye, Pencil, Download, 
  Search, Shield, User as UserIcon, Plus, FileText, Settings, 
  Database, Info, AlertCircle
} from 'lucide-react';
import { 
  listAllUsers, getAdminStats, getUserPermissions, updateUserPermissions,
  type User, type UserPermission, type AdminStats 
} from '../lib/api';

type Tab = 'overview' | 'user-detail';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [permLoading, setPermLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedUser = useMemo(() => users.find(u => u.id === selectedUserId), [users, selectedUserId]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  async function fetchInitialData() {
    setLoading(true);
    try {
      const [sData, uData] = await Promise.all([
        getAdminStats(),
        listAllUsers()
      ]);
      setStats(sData);
      setUsers(uData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUserSelect(user: User) {
    setSelectedUserId(user.id);
    setActiveTab('user-detail');
    setPermLoading(true);
    try {
      const perms = await getUserPermissions(user.id);
      setPermissions(perms);
    } catch (err: any) {
      console.error('Failed to load permissions:', err);
    } finally {
      setPermLoading(false);
    }
  }

  const filteredUsers = useMemo(() => {
    if (!searchQuery) return users;
    const q = searchQuery.toLowerCase();
    return users.filter(u => 
      u.name?.toLowerCase().includes(q) || 
      u.email.toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

  async function toggleRegisterPermission(regId: number, field: 'canView' | 'canEdit' | 'canDownload') {
    if (!selectedUserId) return;

    const current = permissions.find(p => p.registerId === regId);
    if (!current) return;

    const updated = { ...current };
    updated[field] = !updated[field];

    // Hierarchy logic
    if (field === 'canView' && !updated.canView) {
      updated.canEdit = false;
      updated.canDownload = false;
    }
    if ((field === 'canEdit' && updated.canEdit) || (field === 'canDownload' && updated.canDownload)) {
      updated.canView = true;
    }

    // Optimistic update
    setPermissions(prev => prev.map(p => p.registerId === regId ? updated : p));

    try {
      setSaving(true);
      await updateUserPermissions(selectedUserId, [updated]);
    } catch (err) {
      // Rollback
      setPermissions(prev => prev.map(p => p.registerId === regId ? current : p));
      alert('Failed to save permission change');
    } finally {
      setSaving(false);
    }
  }

  async function toggleGlobalPermission(field: 'canCreateRegisters' | 'canCreateTemplates') {
    if (!selectedUserId || !selectedUser) return;

    const updatedUser = { ...selectedUser };
    updatedUser[field] = !updatedUser[field];

    // Optimistic update
    setUsers(prev => prev.map(u => u.id === selectedUserId ? updatedUser : u));

    try {
      setSaving(true);
      await updateUserPermissions(selectedUserId, [], {
        canCreateRegisters: updatedUser.canCreateRegisters || false,
        canCreateTemplates: updatedUser.canCreateTemplates || false
      });
    } catch (err) {
      // Rollback
      setUsers(prev => prev.map(u => u.id === selectedUserId ? selectedUser : u));
      alert('Failed to save global permission');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={s.container}>
      {/* ──────── Sidebar ──────── */}
      <aside style={s.sidebar}>
        <div style={s.sidebarHeader}>
          <div style={s.logoWrap}>
            <div style={s.logoIcon}>ER</div>
            <div>
              <div style={s.logoText}>Easy Record</div>
              <div style={s.logoSub}>Admin Panel</div>
            </div>
          </div>
        </div>

        <nav style={s.nav}>
          <button 
            style={{ ...s.navItem, ...(activeTab === 'overview' ? s.navActive : {}) }}
            onClick={() => { setActiveTab('overview'); setSelectedUserId(null); }}
          >
            <LayoutDashboard size={18} />
            <span>Overview</span>
          </button>
          
          <div style={s.navDivider} />
          
          <div style={s.navSection}>
            <div style={s.navSectionLabel}>
              <Users size={14} /> <span>Users</span>
              {stats && <span style={s.countBadge}>{stats.userCount}</span>}
            </div>
            
            <div style={s.searchWrap}>
              <Search size={14} style={s.searchIcon} />
              <input 
                type="text" 
                placeholder="Search users..." 
                style={s.searchInput}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div style={s.userList}>
              {loading ? (
                <div style={s.emptyState}>Loading users...</div>
              ) : filteredUsers.length === 0 ? (
                <div style={s.emptyState}>No users found</div>
              ) : (
                filteredUsers.map(user => (
                  <button 
                    key={user.id} 
                    style={{ ...s.userItem, ...(selectedUserId === user.id ? s.userItemActive : {}) }}
                    onClick={() => handleUserSelect(user)}
                  >
                    <div style={{ ...s.avatarMini, background: user.isAdmin ? '#ef4444' : '#64748b' }}>
                      {user.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div style={s.userItemInfo}>
                      <div style={s.userItemName}>{user.name || 'Unnamed User'}</div>
                      <div style={s.userItemEmail}>{user.email}</div>
                    </div>
                    {selectedUserId === user.id && <ChevronRight size={14} color="#fff" />}
                  </button>
                ))
              )}
            </div>
          </div>
        </nav>
      </aside>

      {/* ──────── Main Content ──────── */}
      <main style={s.main}>
        {activeTab === 'overview' && (
          <div style={s.contentInner}>
            <h1 style={s.pageTitle}>Dashboard Overview</h1>
            <p style={s.pageSubtitle}>System-wide statistics and management</p>

            <div style={s.statsGrid}>
              <div style={s.statCard}>
                <div style={s.statIconWrap}>
                  <Users size={24} color="#fff" />
                </div>
                <div>
                  <div style={s.statLabel}>Total Users</div>
                  <div style={s.statValue}>{stats?.userCount || 0}</div>
                </div>
              </div>
              
              <div style={s.statCard}>
                <div style={{ ...s.statIconWrap, background: '#0891b2' }}>
                  <Database size={24} color="#fff" />
                </div>
                <div>
                  <div style={s.statLabel}>System Status</div>
                  <div style={{ ...s.statValue, fontSize: 16, color: '#059669' }}>Operational</div>
                </div>
              </div>
            </div>

            <div style={s.infoBox}>
              <Info size={20} color="#002D5D" />
              <div style={s.infoText}>
                Select a user from the sidebar to manage their granular permissions and access controls.
              </div>
            </div>
          </div>
        )}

        {activeTab === 'user-detail' && selectedUser && (
          <div style={s.contentInner}>
            {/* Header / Profile */}
            <div style={s.profileHeader}>
              <div style={s.avatarLarge}>
                {selectedUser.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div style={s.profileMeta}>
                <div style={s.profileNameRow}>
                  <h1 style={s.profileName}>{selectedUser.name || 'Unnamed User'}</h1>
                  <span style={{ 
                    ...s.roleBadge, 
                    background: selectedUser.isAdmin ? '#fee2e2' : '#f1f5f9',
                    color: selectedUser.isAdmin ? '#dc2626' : '#64748b'
                  }}>
                    {selectedUser.isAdmin ? 'Administrator' : 'Standard User'}
                  </span>
                </div>
                <div style={s.profileEmail}>{selectedUser.email}</div>
                <div style={s.profileDate}>Joined on {new Date(selectedUser.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
              </div>
            </div>

            {/* Global Permissions Section */}
            <div style={s.section}>
              <div style={s.sectionHeader}>
                <Shield size={18} color="#002D5D" />
                <h3 style={s.sectionTitle}>Global Access Controls</h3>
              </div>
              <div style={s.globalGrid}>
                <div style={s.globalCard}>
                  <div style={s.globalInfo}>
                    <div style={s.globalLabel}>Create Registers</div>
                    <div style={s.globalDesc}>Allows user to create new register files from scratch.</div>
                  </div>
                  <label style={s.switch}>
                    <input 
                      type="checkbox" 
                      checked={selectedUser.canCreateRegisters} 
                      onChange={() => toggleGlobalPermission('canCreateRegisters')}
                    />
                    <span style={s.slider}></span>
                  </label>
                </div>

                <div style={s.globalCard}>
                  <div style={s.globalInfo}>
                    <div style={s.globalLabel}>Create Templates</div>
                    <div style={s.globalDesc}>Allows user to create new registers from pre-defined templates.</div>
                  </div>
                  <label style={s.switch}>
                    <input 
                      type="checkbox" 
                      checked={selectedUser.canCreateTemplates} 
                      onChange={() => toggleGlobalPermission('canCreateTemplates')}
                    />
                    <span style={s.slider}></span>
                  </label>
                </div>
              </div>
            </div>

            {/* Register Access Section */}
            <div style={s.section}>
              <div style={s.sectionHeader}>
                <FileText size={18} color="#002D5D" />
                <h3 style={s.sectionTitle}>Register-Specific Permissions</h3>
              </div>
              
              <div style={s.card}>
                {permLoading ? (
                  <div style={s.loadingContainer}>
                    <div style={s.spinner} />
                    <span>Loading permissions...</span>
                  </div>
                ) : permissions.length === 0 ? (
                  <div style={s.emptyRegisters}>
                    <AlertCircle size={40} color="#cbd5e1" />
                    <p>No registers assigned to this user.</p>
                  </div>
                ) : (
                  <table style={s.table}>
                    <thead>
                      <tr>
                        <th style={s.th}>Register Name</th>
                        <th style={{ ...s.th, textAlign: 'center' }}><Eye size={14} /> View</th>
                        <th style={{ ...s.th, textAlign: 'center' }}><Pencil size={14} /> Edit</th>
                        <th style={{ ...s.th, textAlign: 'center' }}><Download size={14} /> Download</th>
                      </tr>
                    </thead>
                    <tbody>
                      {permissions.map(p => (
                        <tr key={p.registerId} style={s.tr}>
                          <td style={s.td}>
                            <div style={s.regName}>{p.registerName}</div>
                            <div style={s.regBiz}>{p.businessName || 'General'}</div>
                          </td>
                          <td style={s.tdCenter}>
                            <label style={s.checkLabel}>
                              <input 
                                type="checkbox" 
                                checked={p.canView} 
                                onChange={() => toggleRegisterPermission(p.registerId, 'canView')}
                                style={s.hiddenCheck}
                              />
                              <div style={{ ...s.customCheck, ...(p.canView ? s.checkActiveView : {}) }}>
                                {p.canView && <Check size={14} color="#fff" strokeWidth={3} />}
                              </div>
                            </label>
                          </td>
                          <td style={s.tdCenter}>
                            <label style={s.checkLabel}>
                              <input 
                                type="checkbox" 
                                checked={p.canEdit} 
                                onChange={() => toggleRegisterPermission(p.registerId, 'canEdit')}
                                style={s.hiddenCheck}
                              />
                              <div style={{ ...s.customCheck, ...(p.canEdit ? s.checkActiveEdit : {}) }}>
                                {p.canEdit && <Check size={14} color="#fff" strokeWidth={3} />}
                              </div>
                            </label>
                          </td>
                          <td style={s.tdCenter}>
                            <label style={s.checkLabel}>
                              <input 
                                type="checkbox" 
                                checked={p.canDownload} 
                                onChange={() => toggleRegisterPermission(p.registerId, 'canDownload')}
                                style={s.hiddenCheck}
                              />
                              <div style={{ ...s.customCheck, ...(p.canDownload ? s.checkActiveDown : {}) }}>
                                {p.canDownload && <Check size={14} color="#fff" strokeWidth={3} />}
                              </div>
                            </label>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Saving Indicator */}
      {saving && (
        <div style={s.savingToast}>
          <div style={s.spinnerSmall} />
          <span>Syncing permissions...</span>
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    height: '100vh',
    background: '#f1f5f9',
    fontFamily: '"Inter", system-ui, sans-serif',
    color: '#1e293b'
  },

  /* Sidebar */
  sidebar: {
    width: 320,
    background: '#002D5D',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '4px 0 20px rgba(0,0,0,0.1)',
    zIndex: 10
  },
  sidebarHeader: {
    padding: '1.5rem',
    borderBottom: '1px solid rgba(255,255,255,0.1)'
  },
  logoWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 12
  },
  logoIcon: {
    width: 40,
    height: 40,
    background: '#fff',
    color: '#002D5D',
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: 18
  },
  logoText: {
    fontSize: 18,
    fontWeight: 700,
    lineHeight: 1.2
  },
  logoSub: {
    fontSize: 11,
    opacity: 0.6,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontWeight: 600
  },
  nav: {
    flex: 1,
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    overflowY: 'auto'
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
    fontSize: 14,
    fontWeight: 500,
    textAlign: 'left',
    transition: 'all 0.2s'
  },
  navActive: {
    background: 'rgba(255,255,255,0.15)',
    color: '#fff'
  },
  navDivider: {
    height: 1,
    background: 'rgba(255,255,255,0.1)',
    margin: '0.5rem 0'
  },
  navSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12
  },
  navSectionLabel: {
    padding: '0 1rem',
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'rgba(255,255,255,0.4)',
    display: 'flex',
    alignItems: 'center',
    gap: 8
  },
  countBadge: {
    marginLeft: 'auto',
    background: 'rgba(255,255,255,0.1)',
    padding: '2px 8px',
    borderRadius: 12,
    fontSize: 10
  },
  searchWrap: {
    position: 'relative',
    margin: '0 0.5rem'
  },
  searchIcon: {
    position: 'absolute',
    left: 10,
    top: '50%',
    transform: 'translateY(-50%)',
    opacity: 0.5
  },
  searchInput: {
    width: '100%',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 6,
    padding: '0.5rem 0.5rem 0.5rem 2rem',
    color: '#fff',
    fontSize: 13,
    outline: 'none'
  },
  userList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4
  },
  userItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '0.75rem',
    borderRadius: 8,
    border: 'none',
    background: 'transparent',
    color: 'rgba(255,255,255,0.7)',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.2s'
  },
  userItemActive: {
    background: 'rgba(255,255,255,0.1)',
    color: '#fff'
  },
  avatarMini: {
    width: 32,
    height: 32,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    fontWeight: 700,
    color: '#fff',
    flexShrink: 0
  },
  userItemInfo: {
    flex: 1,
    overflow: 'hidden'
  },
  userItemName: {
    fontSize: 14,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  userItemEmail: {
    fontSize: 11,
    opacity: 0.5,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  emptyState: {
    padding: '2rem 1rem',
    textAlign: 'center',
    fontSize: 13,
    color: 'rgba(255,255,255,0.3)',
    fontStyle: 'italic'
  },

  /* Main */
  main: {
    flex: 1,
    overflowY: 'auto',
    padding: '2.5rem'
  },
  contentInner: {
    maxWidth: 900,
    margin: '0 auto'
  },
  pageTitle: {
    fontSize: '2rem',
    fontWeight: 800,
    margin: 0,
    color: '#002D5D'
  },
  pageSubtitle: {
    fontSize: '1rem',
    color: '#64748b',
    marginTop: '0.25rem',
    marginBottom: '2rem'
  },

  /* Stats */
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '1.5rem',
    marginBottom: '2rem'
  },
  statCard: {
    background: '#fff',
    padding: '1.5rem',
    borderRadius: 16,
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
    border: '1px solid #e2e8f0'
  },
  statIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    background: '#002D5D',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  statLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
  },
  statValue: {
    fontSize: 24,
    fontWeight: 800,
    color: '#002D5D'
  },

  /* Info Box */
  infoBox: {
    background: '#e0f2fe',
    border: '1px solid #bae6fd',
    padding: '1.25rem',
    borderRadius: 12,
    display: 'flex',
    gap: 12,
    alignItems: 'center'
  },
  infoText: {
    fontSize: 14,
    color: '#0369a1',
    lineHeight: 1.5
  },

  /* Profile */
  profileHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 24,
    marginBottom: '2.5rem',
    background: '#fff',
    padding: '2rem',
    borderRadius: 20,
    boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
    border: '1px solid #e2e8f0'
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 20,
    background: '#002D5D',
    color: '#fff',
    fontSize: 32,
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  profileMeta: {
    flex: 1
  },
  profileNameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4
  },
  profileName: {
    fontSize: '1.5rem',
    fontWeight: 800,
    margin: 0,
    color: '#002D5D'
  },
  roleBadge: {
    fontSize: 11,
    fontWeight: 700,
    padding: '4px 10px',
    borderRadius: 20,
    textTransform: 'uppercase',
    letterSpacing: '0.04em'
  },
  profileEmail: {
    fontSize: 15,
    color: '#64748b'
  },
  profileDate: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 8
  },

  /* Sections */
  section: {
    marginBottom: '2.5rem'
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: '1rem'
  },
  sectionTitle: {
    fontSize: '1.1rem',
    fontWeight: 700,
    margin: 0,
    color: '#002D5D'
  },

  /* Global Permissions */
  globalGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
    gap: '1.25rem'
  },
  globalCard: {
    background: '#fff',
    padding: '1.25rem',
    borderRadius: 14,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    border: '1px solid #e2e8f0',
    boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
  },
  globalInfo: {
    flex: 1,
    paddingRight: '1rem'
  },
  globalLabel: {
    fontSize: 15,
    fontWeight: 700,
    color: '#0f172a',
    marginBottom: 2
  },
  globalDesc: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 1.4
  },

  /* Table */
  card: {
    background: '#fff',
    borderRadius: 16,
    border: '1px solid #e2e8f0',
    overflow: 'hidden',
    boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  th: {
    padding: '1rem 1.5rem',
    background: '#f8fafc',
    fontSize: 11,
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid #e2e8f0'
  },
  tr: {
    borderBottom: '1px solid #f1f5f9',
    transition: 'background 0.2s'
  },
  td: {
    padding: '1.25rem 1.5rem'
  },
  tdCenter: {
    padding: '1.25rem 1.5rem',
    textAlign: 'center'
  },
  regName: {
    fontSize: 14,
    fontWeight: 600,
    color: '#0f172a'
  },
  regBiz: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2
  },

  /* Switch UI */
  switch: {
    position: 'relative',
    display: 'inline-block',
    width: 44,
    height: 24,
    flexShrink: 0
  },
  slider: {
    position: 'absolute',
    cursor: 'pointer',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#cbd5e1',
    transition: '.3s',
    borderRadius: 24
  },
  // slider before: handled in CSS/Inline usually requires complex styling or a library
  // I will use a simple styled input for now

  /* Custom Checkbox */
  checkLabel: {
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  hiddenCheck: {
    display: 'none'
  },
  customCheck: {
    width: 24,
    height: 24,
    borderRadius: 6,
    border: '2px solid #cbd5e1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s'
  },
  checkActiveView: { background: '#002D5D', borderColor: '#002D5D' },
  checkActiveEdit: { background: '#0891b2', borderColor: '#0891b2' },
  checkActiveDown: { background: '#059669', borderColor: '#059669' },

  /* Loading/Empty */
  loadingContainer: {
    padding: '4rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    color: '#94a3b8',
    fontSize: 14
  },
  emptyRegisters: {
    padding: '4rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    textAlign: 'center',
    color: '#94a3b8'
  },

  /* Saving Toast */
  savingToast: {
    position: 'fixed',
    bottom: 24,
    right: 24,
    background: '#1e293b',
    color: '#fff',
    padding: '12px 20px',
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    fontSize: 14,
    fontWeight: 500,
    boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
    zIndex: 1000
  },

  /* Animations / Spinners */
  spinner: {
    width: 24,
    height: 24,
    border: '3px solid #e2e8f0',
    borderTop: '3px solid #002D5D',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  spinnerSmall: {
    width: 16,
    height: 16,
    border: '2px solid rgba(255,255,255,0.2)',
    borderTop: '2px solid #fff',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  }
};

// Add global styles for the switch and spinner
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    
    .switch input { opacity: 0; width: 0; height: 0; }
    .switch input:checked + span { background-color: #002D5D; }
    .switch input:focus + span { box-shadow: 0 0 1px #002D5D; }
    .switch span:before {
      position: absolute; content: ""; height: 18px; width: 18px;
      left: 3px; bottom: 3px; background-color: white;
      transition: .3s; border-radius: 50%;
    }
    .switch input:checked + span:before { transform: translateX(20px); }
  `;
  document.head.appendChild(style);
}
