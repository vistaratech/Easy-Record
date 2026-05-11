// src/pages/AdminDashboard.tsx
import { useEffect, useState, useMemo } from 'react';
import { 
  Users, ChevronRight, ChevronDown, Check, Search, Shield, 
  BarChart2, Bell, User as UserIcon, CheckCircle, 
  MoreHorizontal, Loader2
} from 'lucide-react';
import { 
  listAllUsers, getUserPermissions, updateUserPermissions,
  type User, type UserPermission 
} from '../lib/api';
import toast from 'react-hot-toast';

type Tab = 'all-registers' | 'approved-registers';
type SidebarItem = 'users' | 'active-report';

export default function AdminDashboard() {
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

  const selectedUser = useMemo(() => users.find(u => u.id === selectedUserId), [users, selectedUserId]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  async function fetchInitialData() {
    setLoading(true);
    try {
      const uData = await listAllUsers();
      setUsers(uData);
      if (uData.length > 0 && !selectedUserId) {
        handleUserSelect(uData[0]);
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }

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
    } catch (err: any) {
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
                    <span>{user.name || user.email}</span>
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
                          <th style={s.th}>REGISTER NAME</th>
                        </tr>
                      </thead>
                      <tbody>
                        {approvedRegisters.length === 0 ? (
                          <tr>
                            <td style={s.emptyCell}>No approved registers yet.</td>
                          </tr>
                        ) : approvedRegisters.map(p => (
                          <tr key={p.registerId} style={s.tr}>
                            <td style={s.td}>
                              <div style={s.regRow}>
                                <CheckCircle size={18} color="#10b981" />
                                <span style={s.regName}>{p.registerName}</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
    padding: '4rem',
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
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12
  },
  selectionCount: {
    fontSize: 13,
    color: '#64748b'
  },
  approveBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '0.6rem 1.25rem',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  placeholderContent: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f8fafc'
  },
  reportEmptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    maxWidth: 400,
    padding: '2rem'
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 700,
    color: '#334155',
    margin: '1.5rem 0 0.5rem'
  },
  emptyDesc: {
    fontSize: 15,
    color: '#64748b',
    lineHeight: 1.6,
    marginBottom: '2rem'
  },
  secondaryBtn: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    color: '#334155',
    padding: '0.6rem 1.5rem',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer'
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
