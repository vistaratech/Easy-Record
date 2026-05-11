// src/pages/AdminPage.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { 
  Users, ChevronRight, ChevronDown, Check, Search, Shield, 
  BarChart2, Bell, User as UserIcon,
  MoreHorizontal, Loader2, Pencil, Download, FileText, Database
} from 'lucide-react';
import { 
  listAllUsers, getUserPermissions, updateUserPermissions, getRegister,
  type User, type UserPermission, type Column
} from '../lib/api';
import toast from 'react-hot-toast';

type Tab = 'all-registers' | 'approved-registers';
type SidebarItem = 'users' | 'active-report';

export default function AdminPage() {
  const [activeSidebar, setActiveSidebar] = useState<SidebarItem>('users');
  const [usersExpanded, setUsersExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('all-registers');
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [permLoading, setPermLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [registerSearch, setRegisterSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedRegIds, setSelectedRegIds] = useState<Set<number>>(new Set());
  const [expandedRegId, setExpandedRegId] = useState<number | null>(null);
  const [regColumns, setRegColumns] = useState<Column[]>([]);
  const [columnsLoading, setColumnsLoading] = useState(false);

  const selectedUser = useMemo(() => users.find(u => u.id === selectedUserId), [users, selectedUserId]);

  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const uData = await listAllUsers();
      setUsers(uData);
      if (uData.length > 0 && !selectedUserId) {
        handleUserSelect(uData[0]);
      }
    } catch (err: unknown) {
      console.error(err);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [selectedUserId]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  async function handleUserSelect(user: User) {
    setSelectedUserId(user.id);
    setPermLoading(true);
    try {
      const perms = await getUserPermissions(user.id);
      setPermissions(perms);
      // Initialize selected set from approved registers
      const approved = new Set<number>();
      perms.forEach(p => {
        if (p.canView) approved.add(p.registerId);
      });
      setSelectedRegIds(approved);
    } catch (err: unknown) {
      console.error('Failed to load permissions:', err);
      toast.error('Failed to load permissions');
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

  const filteredPermissions = useMemo(() => {
    if (!registerSearch) return permissions;
    const q = registerSearch.toLowerCase();
    return permissions.filter(p => 
      p.registerName.toLowerCase().includes(q) || 
      p.businessName?.toLowerCase().includes(q)
    );
  }, [permissions, registerSearch]);

  const approvedRegisters = useMemo(() => {
    return permissions.filter(p => p.canView);
  }, [permissions]);

  const toggleRegSelection = (regId: number) => {
    const next = new Set(selectedRegIds);
    if (next.has(regId)) next.delete(regId);
    else next.add(regId);
    setSelectedRegIds(next);
  };

  const togglePermission = (regId: number, field: 'canEdit' | 'canDownload') => {
    setPermissions(prev => prev.map(p => {
      if (p.registerId === regId) {
        return { ...p, [field]: !p[field] };
      }
      return p;
    }));
  };

  const handleExpandRegister = async (regId: number) => {
    if (expandedRegId === regId) {
      setExpandedRegId(null);
      return;
    }
    setExpandedRegId(regId);
    setColumnsLoading(true);
    try {
      const reg = await getRegister(regId);
      setRegColumns(reg.columns || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load columns');
    } finally {
      setColumnsLoading(false);
    }
  };

  async function handleApprove() {
    if (!selectedUserId) return;
    setSaving(true);
    try {
      const updates = permissions.map(p => ({
        registerId: p.registerId,
        canView: selectedRegIds.has(p.registerId),
        canEdit: selectedRegIds.has(p.registerId) ? p.canEdit : false,
        canDownload: selectedRegIds.has(p.registerId) ? p.canDownload : false
      }));

      await updateUserPermissions(selectedUserId, updates);
      toast.success('Permissions updated successfully');
      
      // Refresh local permissions
      const perms = await getUserPermissions(selectedUserId);
      setPermissions(perms);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update permissions');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={s.container}>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
      {/* ──────── Sidebar ──────── */}
      <aside style={s.sidebar}>
        <div style={s.sidebarHeader}>
          <div style={s.logoWrap}>
            <div style={s.logoIcon}>
              <Shield size={20} fill="#2563eb" color="#2563eb" />
            </div>
            <span style={s.logoText}>Admin Panel</span>
          </div>
        </div>

        <nav style={s.nav}>
          <div style={s.navSection}>
            <button 
              style={{ ...s.navItem, ...(activeSidebar === 'users' ? s.navActive : {}) }}
              onClick={() => {
                setActiveSidebar('users');
                setUsersExpanded(!usersExpanded);
              }}
            >
              <Users size={18} />
              <span style={{ flex: 1 }}>USERS</span>
              <span style={s.countBadge}>{users.length}</span>
              {usersExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            
            {usersExpanded && (
              <div style={s.userSubList}>
                <div style={s.userSearchWrap}>
                  <Search size={12} style={s.userSearchIcon} />
                  <input 
                    type="text" 
                    placeholder="Search..." 
                    style={s.userSearchInput}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                {filteredUsers.map(user => (
                  <button 
                    key={user.id}
                    style={{ ...s.userSubItem, ...(selectedUserId === user.id ? s.userSubItemActive : {}) }}
                    onClick={() => handleUserSelect(user)}
                  >
                    <div style={s.dot} />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: selectedUserId === user.id ? 600 : 400 }}>{user.name || user.email}</span>
                      <span style={{ fontSize: '10px', opacity: 0.6, textTransform: 'uppercase' }}>{user.isAdmin ? 'Admin' : 'User'}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button 
            style={{ ...s.navItem, ...(activeSidebar === 'active-report' ? s.navActive : {}) }}
            onClick={() => setActiveSidebar('active-report')}
          >
            <BarChart2 size={18} />
            <span>ACTIVE REPORTS</span>
          </button>
        </nav>

        <div style={s.sidebarFooter}>
          <div style={s.adminProfile}>
            <div style={s.adminAvatar}>
              <UserIcon size={20} />
            </div>
            <div style={s.adminInfo}>
              <div style={s.adminName}>Admin</div>
              <div style={s.adminRole}>Super Admin</div>
            </div>
            <ChevronDown size={14} style={{ opacity: 0.5 }} />
          </div>
        </div>
      </aside>

      {/* ──────── Main Content ──────── */}
      <main style={s.main}>
        {loading && (
          <div style={s.globalLoading}>
            <Loader2 size={40} className="animate-spin" color="#2563eb" />
            <span style={{ marginTop: 12, fontWeight: 500, color: '#64748b' }}>Loading Admin Panel...</span>
          </div>
        )}

        {/* Topbar */}
        <header style={s.topbar}>
          <div style={s.breadcrumbs}>
            <MoreHorizontal size={18} style={{ opacity: 0.3 }} />
            <span style={s.breadcrumbItem}>Users</span>
            <ChevronRight size={14} style={{ opacity: 0.3 }} />
            <span style={{ ...s.breadcrumbItem, color: '#2563eb' }}>{selectedUser?.name || 'Loading...'}</span>
          </div>
          <div style={s.topbarActions}>
            <div style={s.notificationBtn}>
              <Bell size={18} />
              <div style={s.badge}>5</div>
            </div>
            <div style={s.userProfileTop}>
              <div style={s.topAvatar}>
                <UserIcon size={18} />
              </div>
              <span>Admin</span>
              <ChevronDown size={14} />
            </div>
          </div>
        </header>

        {activeSidebar === 'users' ? (
          <div style={s.content}>
            {/* User Details Card */}
            {selectedUser && (
              <div style={s.userCard}>
                <div style={s.userCardMain}>
                  <div style={s.avatarLarge}>
                    <UserIcon size={32} />
                  </div>
                  <div style={s.userDetails}>
                    <div style={s.userNameRow}>
                      <h2 style={s.userName}>{selectedUser.name || 'Unnamed User'}</h2>
                      <span style={s.statusBadge}>Active</span>
                    </div>
                    <div style={s.userEmail}>{selectedUser.email}</div>
                  </div>
                </div>
                
                <div style={s.userMetaGrid}>
                  <div style={s.metaItem}>
                    <div style={s.metaLabel}>Role</div>
                    <div style={s.metaValue}>{selectedUser.isAdmin ? 'Admin' : 'User'}</div>
                  </div>
                  <div style={s.metaItem}>
                    <div style={s.metaLabel}>Joined On</div>
                    <div style={s.metaValue}>
                      {new Date(selectedUser.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                  </div>
                  <div style={s.metaItem}>
                    <div style={s.metaLabel}>Last Login</div>
                    <div style={s.metaValue}>20 May 2024 10:30 AM</div>
                  </div>
                </div>
              </div>
            )}

            {/* Tabs */}
            <div style={s.tabBar}>
              <button 
                style={{ ...s.tab, ...(activeTab === 'all-registers' ? s.tabActive : {}) }}
                onClick={() => setActiveTab('all-registers')}
              >
                ALL REGISTERS
              </button>
              <button 
                style={{ ...s.tab, ...(activeTab === 'approved-registers' ? s.tabActive : {}) }}
                onClick={() => setActiveTab('approved-registers')}
              >
                APPROVED REGISTERS
              </button>
            </div>

            {/* Tab Content */}
            <div style={s.tabContent}>
              {activeTab === 'all-registers' ? (
                <div style={s.panel}>
                  <div style={s.panelHeader}>
                    <div>
                      <h3 style={s.panelTitle}>All Registers</h3>
                      <p style={s.panelSub}>Select registers to approve access for this user.</p>
                    </div>
                    <div style={s.searchBox}>
                      <input 
                        type="text" 
                        placeholder="Search registers..." 
                        style={s.searchField}
                        value={registerSearch}
                        onChange={(e) => setRegisterSearch(e.target.value)}
                      />
                      <Search size={14} style={s.searchFieldIcon} />
                    </div>
                  </div>

                  <div style={s.tableWrap}>
                    <table style={s.table}>
                      <thead>
                        <tr>
                          <th style={{ ...s.th, width: 40 }}>
                            <input 
                              type="checkbox" 
                              checked={selectedRegIds.size === permissions.length && permissions.length > 0}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedRegIds(new Set(permissions.map(p => p.registerId)));
                                else setSelectedRegIds(new Set());
                              }}
                              aria-label="Select all registers"
                            />
                          </th>
                          <th style={s.th}>REGISTER NAME</th>
                        </tr>
                      </thead>
                      <tbody>
                        {permLoading ? (
                          <tr>
                            <td colSpan={2} style={s.loadingCell}>
                              <Loader2 size={24} className="animate-spin" />
                              <span>Loading registers...</span>
                            </td>
                          </tr>
                        ) : filteredPermissions.map(p => (
                          <tr key={p.registerId} style={s.tr}>
                            <td style={s.td}>
                              <input 
                                type="checkbox" 
                                checked={selectedRegIds.has(p.registerId)}
                                onChange={() => toggleRegSelection(p.registerId)}
                                aria-label={`Select register ${p.registerName}`}
                              />
                            </td>
                            <td style={s.td}>
                              <div style={s.regRow}>
                                <span style={s.regName}>{p.registerName}</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div style={s.panelFooter}>
                    <div style={s.selectionCount}>
                      {selectedRegIds.size} registers selected
                    </div>
                    <button 
                      style={s.approveBtn}
                      onClick={handleApprove}
                      disabled={saving}
                    >
                      {saving ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Check size={16} />
                      )}
                      <span>Approve ({selectedRegIds.size})</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div style={s.panel}>
                  <div style={s.panelHeader}>
                    <div>
                      <h3 style={s.panelTitle}>Approved Registers</h3>
                      <p style={s.panelSub}>Registers that this user has access to.</p>
                    </div>
                  </div>

                  <div style={s.tableWrap}>
                    <table style={s.table}>
                      <thead>
                        <tr>
                          <th style={{ ...s.th, width: '40px' }}></th>
                          <th style={s.th}>REGISTER NAME</th>
                          <th style={{ ...s.th, width: '120px', textAlign: 'center' }}>EDIT</th>
                          <th style={{ ...s.th, width: '120px', textAlign: 'center' }}>EXPORT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {approvedRegisters.length === 0 ? (
                          <tr>
                            <td colSpan={4} style={s.emptyCell}>No approved registers yet.</td>
                          </tr>
                        ) : approvedRegisters.map(p => (
                          <React.Fragment key={p.registerId}>
                            <tr style={s.tr}>
                              <td style={s.td}>
                                <button 
                                  onClick={() => handleExpandRegister(p.registerId)}
                                  style={s.expandBtn}
                                >
                                  {expandedRegId === p.registerId ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                </button>
                              </td>
                              <td style={s.td}>
                                <div style={{ ...s.regRow, cursor: 'pointer' }} onClick={() => handleExpandRegister(p.registerId)}>
                                  <div style={s.iconCircle}>
                                    <FileText size={14} color="#2563eb" />
                                  </div>
                                  <span style={s.regName}>{p.registerName}</span>
                                </div>
                              </td>
                              <td style={{ ...s.td, textAlign: 'center' }}>
                                <button 
                                  onClick={() => togglePermission(p.registerId, 'canEdit')}
                                  style={{ ...s.permToggle, ...(p.canEdit ? s.permToggleActive : {}) }}
                                  title={p.canEdit ? "Edit permission enabled" : "Edit permission disabled"}
                                >
                                  <Pencil size={14} />
                                </button>
                              </td>
                              <td style={{ ...s.td, textAlign: 'center' }}>
                                <button 
                                  onClick={() => togglePermission(p.registerId, 'canDownload')}
                                  style={{ ...s.permToggle, ...(p.canDownload ? s.permToggleActive : {}) }}
                                  title={p.canDownload ? "Download permission enabled" : "Download permission disabled"}
                                >
                                  <Download size={14} />
                                </button>
                              </td>
                            </tr>
                            {expandedRegId === p.registerId && (
                              <tr style={{ background: '#f1f5f9' }}>
                                <td colSpan={4} style={{ padding: '1rem 3rem' }}>
                                  <div style={s.columnPanel}>
                                    <h4 style={s.columnTitle}>
                                      <Database size={14} style={{ marginRight: 8 }} />
                                      Register Columns
                                    </h4>
                                    {columnsLoading ? (
                                      <div style={s.columnLoading}>
                                        <Loader2 size={16} className="animate-spin" />
                                        <span>Fetching column structure...</span>
                                      </div>
                                    ) : (
                                      <div style={s.columnGrid}>
                                        {regColumns.length === 0 ? (
                                          <div style={s.noColumns}>No columns defined for this register.</div>
                                        ) : regColumns.map(col => (
                                          <div key={col.id} style={s.columnBadge}>
                                            <span style={s.columnName}>{col.name}</span>
                                            <span style={s.columnType}>{col.type}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  <div style={s.panelFooter}>
                    <p style={{ fontSize: '13px', color: '#64748b' }}>
                      Tip: Use the toggles above to grant/revoke specific Edit and Export privileges.
                    </p>
                    <button 
                      style={s.approveBtn}
                      onClick={handleApprove}
                      disabled={saving}
                    >
                      {saving ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Check size={16} />
                      )}
                      <span>Save Changes</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={s.placeholderContent}>
            <div style={s.reportEmptyState}>
              <BarChart2 size={64} color="#94a3b8" strokeWidth={1} />
              <h2 style={s.emptyTitle}>System Reports</h2>
              <p style={s.emptyDesc}>
                Real-time usage analytics and register activity reports will be available here soon.
              </p>
              <button style={s.secondaryBtn}>Generate Summary</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    height: '100vh',
    background: '#f8fafc',
    fontFamily: '"Inter", sans-serif',
    color: '#1e293b'
  },
  sidebar: {
    width: 260,
    background: '#1e293b',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
  },
  sidebarHeader: {
    padding: '1.5rem',
    borderBottom: '1px solid rgba(255,255,255,0.05)'
  },
  logoWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 12
  },
  logoIcon: {
    width: 32,
    height: 32,
    background: '#fff',
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  logoText: {
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: '-0.02em'
  },
  nav: {
    flex: 1,
    padding: '1.5rem 0',
    display: 'flex',
    flexDirection: 'column',
    gap: 4
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '0.75rem 1.5rem',
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.6)',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    textAlign: 'left',
    transition: 'all 0.2s',
    width: '100%'
  },
  navActive: {
    background: '#2563eb',
    color: '#fff'
  },
  countBadge: {
    background: 'rgba(255,255,255,0.1)',
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 6px',
    borderRadius: 10,
    marginRight: 8
  },
  userSubList: {
    display: 'flex',
    flexDirection: 'column',
    padding: '0.5rem 0'
  },
  userSearchWrap: {
    position: 'relative',
    margin: '0.5rem 1.5rem 1rem',
  },
  userSearchInput: {
    width: '100%',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 6,
    padding: '0.4rem 0.5rem 0.4rem 2rem',
    color: '#fff',
    fontSize: 12,
    outline: 'none'
  },
  userSearchIcon: {
    position: 'absolute',
    left: 8,
    top: '50%',
    transform: 'translateY(-50%)',
    opacity: 0.4
  },
  userSubItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '0.6rem 1.5rem 0.6rem 3rem',
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.4)',
    cursor: 'pointer',
    fontSize: 13,
    textAlign: 'left',
    transition: 'all 0.2s',
    position: 'relative'
  },
  userSubItemActive: {
    color: '#fff',
    background: 'rgba(255,255,255,0.05)'
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: '50%',
    background: 'currentColor',
    opacity: 0.5
  },
  sidebarFooter: {
    padding: '1.5rem',
    borderTop: '1px solid rgba(255,255,255,0.05)'
  },
  adminProfile: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    cursor: 'pointer'
  },
  adminAvatar: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  adminInfo: {
    flex: 1
  },
  adminName: {
    fontSize: 13,
    fontWeight: 600
  },
  adminRole: {
    fontSize: 11,
    opacity: 0.5
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  },
  topbar: {
    height: 64,
    background: '#fff',
    borderBottom: '1px solid #e2e8f0',
    padding: '0 1.5rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  breadcrumbs: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 14
  },
  breadcrumbItem: {
    fontWeight: 500,
    color: '#64748b'
  },
  topbarActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 20
  },
  notificationBtn: {
    position: 'relative',
    color: '#64748b',
    cursor: 'pointer'
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    background: '#ef4444',
    color: '#fff',
    fontSize: 9,
    fontWeight: 700,
    width: 14,
    height: 14,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid #fff'
  },
  userProfileTop: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    fontWeight: 500,
    color: '#334155',
    cursor: 'pointer'
  },
  topAvatar: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: '#f1f5f9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '1.5rem'
  },
  userCard: {
    background: '#fff',
    borderRadius: 12,
    border: '1px solid #e2e8f0',
    padding: '1.5rem',
    marginBottom: '1.5rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  userCardMain: {
    display: 'flex',
    alignItems: 'center',
    gap: 16
  },
  avatarLarge: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    background: '#f1f5f9',
    color: '#64748b',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  userDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4
  },
  userNameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12
  },
  userName: {
    fontSize: 20,
    fontWeight: 700,
    margin: 0
  },
  statusBadge: {
    background: '#dcfce7',
    color: '#16a34a',
    fontSize: 11,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 12,
    textTransform: 'uppercase'
  },
  userEmail: {
    fontSize: 14,
    color: '#64748b'
  },
  userMetaGrid: {
    display: 'flex',
    gap: 40
  },
  metaItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4
  },
  metaLabel: {
    fontSize: 12,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontWeight: 600
  },
  metaValue: {
    fontSize: 14,
    fontWeight: 600,
    color: '#334155'
  },
  tabBar: {
    display: 'flex',
    gap: 32,
    borderBottom: '1px solid #e2e8f0',
    marginBottom: '1.5rem',
    padding: '0 0.5rem'
  },
  tab: {
    padding: '0.75rem 0',
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: '#64748b',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  tabActive: {
    color: '#2563eb',
    borderBottomColor: '#2563eb'
  },
  tabContent: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
    gap: '1.5rem'
  },
  panel: {
    background: '#fff',
    borderRadius: 12,
    border: '1px solid #e2e8f0',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 400
  },
  panelHeader: {
    padding: '1.25rem',
    borderBottom: '1px solid #e2e8f0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: 700,
    margin: '0 0 4px 0'
  },
  panelSub: {
    fontSize: 13,
    color: '#64748b',
    margin: 0
  },
  searchBox: {
    position: 'relative'
  },
  searchField: {
    padding: '0.5rem 1rem 0.5rem 2.5rem',
    borderRadius: 8,
    border: '1px solid #e2e8f0',
    background: '#f8fafc',
    fontSize: 13,
    width: 200,
    outline: 'none'
  },
  searchFieldIcon: {
    position: 'absolute',
    left: 12,
    top: '50%',
    transform: 'translateY(-50%)',
    opacity: 0.3
  },
  tableWrap: {
    flex: 1,
    overflowY: 'auto'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  th: {
    textAlign: 'left',
    padding: '0.75rem 1.25rem',
    fontSize: 11,
    fontWeight: 600,
    color: '#94a3b8',
    background: '#f8fafc',
    borderBottom: '1px solid #e2e8f0'
  },
  td: {
    padding: '0.875rem 1.25rem',
    borderBottom: '1px solid #f1f5f9'
  },
  tr: {
    transition: 'background 0.2s'
  },
  regRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12
  },
  regName: {
    fontSize: 14,
    fontWeight: 500,
    color: '#334155'
  },
  loadingCell: {
    padding: '4rem',
    textAlign: 'center',
    color: '#94a3b8',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12
  },
  emptyCell: {
    padding: '3rem',
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 14
  },
  panelFooter: {
    padding: '1.25rem',
    borderTop: '1px solid #e2e8f0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: '#f8fafc',
    borderRadius: '0 0 12px 12px'
  },
  selectionCount: {
    fontSize: 13,
    fontWeight: 600,
    color: '#64748b'
  },
  approveBtn: {
    padding: '0.625rem 1.25rem',
    background: '#2563eb',
    color: '#fff',
    borderRadius: 8,
    border: 'none',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    transition: 'all 0.2s'
  },
  placeholderContent: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem'
  },
  reportEmptyState: {
    textAlign: 'center',
    maxWidth: 400
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 800,
    margin: '1.5rem 0 0.5rem 0'
  },
  emptyDesc: {
    fontSize: 15,
    color: '#64748b',
    margin: '0 0 2rem 0',
    lineHeight: 1.5
  },
  secondaryBtn: {
    padding: '0.75rem 1.5rem',
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  permToggle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    border: '1px solid #e2e8f0',
    background: '#fff',
    color: '#94a3b8',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
    margin: '0 4px'
  },
  permToggleActive: {
    background: '#dcfce7',
    color: '#10b981',
    borderColor: '#10b981'
  },
  expandBtn: {
    width: 24,
    height: 24,
    borderRadius: 4,
    border: 'none',
    background: 'transparent',
    color: '#94a3b8',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  columnPanel: {
    background: '#fff',
    borderRadius: 8,
    border: '1px solid #e2e8f0',
    padding: '1rem',
    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
  },
  columnTitle: {
    fontSize: 13,
    fontWeight: 700,
    margin: '0 0 1rem 0',
    display: 'flex',
    alignItems: 'center',
    color: '#1e293b'
  },
  columnLoading: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    color: '#64748b',
    padding: '1rem 0'
  },
  columnGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8
  },
  columnBadge: {
    padding: '4px 10px',
    background: '#f1f5f9',
    borderRadius: 6,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 80,
    border: '1px solid #e2e8f0'
  },
  columnName: {
    fontSize: 12,
    fontWeight: 600,
    color: '#334155'
  },
  columnType: {
    fontSize: 10,
    color: '#94a3b8',
    textTransform: 'uppercase'
  },
  noColumns: {
    fontSize: 13,
    color: '#94a3b8',
    fontStyle: 'italic'
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 6,
    background: '#eff6ff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  globalLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(255,255,255,0.8)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    backdropFilter: 'blur(4px)'
  }
};
