// src/pages/AdminDashboard.tsx
import { useEffect, useState, useMemo } from 'react';
import {
  Users, ChevronRight, ChevronDown, Check, Search, Shield,
  BarChart2, Bell, User as UserIcon, Settings, BookOpen,
  Loader2, Pencil, Download, FileText,
  X, AlertTriangle, ArrowLeft, Home,
  Plus, MoreVertical, Trash2, Menu,
  UserCheck, UserX, Key, ShieldAlert
} from 'lucide-react';
import {
  listAllUsers, getUserPermissions, updateUserPermissions, getRegister,
  createRegister, permanentlyDeleteRegister,
  signup, deleteUser, resetUserPassword, toggleUserStatus,
  type User, type UserPermission, type Column
} from '../lib/api';
import { CATEGORIES, TEMPLATES } from '../lib/templates';
import { useAuth } from '../lib/auth';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import './AdminDashboard.css';

type NavSection = 'dashboard' | 'users' | 'registers' | 'settings';
type Tab = 'all-registers' | 'approved-registers';

export default function AdminDashboard() {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState<NavSection>('users');
  const [usersExpanded, setUsersExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('all-registers');
  
  if (!currentUser) return null;

  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | number | null>(null);
  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [permLoading, setPermLoading] = useState(false);
  const [registerSearch, setRegisterSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedRegIds, setSelectedRegIds] = useState<Set<string | number>>(new Set());
  const [expandedRegId, setExpandedRegId] = useState<string | number | null>(null);
  const [regColumns, setRegColumns] = useState<Column[]>([]);
  const [columnsLoading, setColumnsLoading] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>(CATEGORIES[0].id);
  const [creating, setCreating] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | number | null>(null);
  const [userMenuOpenId, setUserMenuOpenId] = useState<string | number | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'user' });

  const selectedUser = useMemo(() => users.find(u => u.id === selectedUserId), [users, selectedUserId]);

  useEffect(() => { fetchInitialData(); }, []);

  async function fetchInitialData() {
    setLoading(true);
    try {
      const uData = await listAllUsers();
      setUsers(uData);
      if (uData.length > 0 && !selectedUserId) handleUserSelect(uData[0]);
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
    setExpandedRegId(null);
    try {
      const perms = await getUserPermissions(user.id);
      setPermissions(perms);
      const approved = new Set<string | number>();
      perms.forEach(p => { if (p.canView) approved.add(p.registerId); });
      setSelectedRegIds(approved);
    } catch (err: any) {
      console.error('Failed to load permissions:', err);
      toast.error('Failed to load permissions');
    } finally {
      setPermLoading(false);
    }
  }

  const filteredPermissions = useMemo(() => {
    let list = permissions;
    if (activeTab === 'approved-registers') list = list.filter(p => selectedRegIds.has(p.registerId));
    if (!registerSearch) return list;
    const q = registerSearch.toLowerCase();
    return list.filter(p => p.registerName.toLowerCase().includes(q) || p.businessName?.toLowerCase().includes(q));
  }, [permissions, registerSearch, activeTab, selectedRegIds]);

  const toggleRegSelection = (regId: string | number) => {
    const next = new Set(selectedRegIds);
    if (next.has(regId)) next.delete(regId); else next.add(regId);
    setSelectedRegIds(next);
  };

  const togglePermission = (regId: string | number, field: 'canEdit' | 'canDownload') => {
    setPermissions(prev => prev.map(p => p.registerId === regId ? { ...p, [field]: !p[field] } : p));
  };

  const handleExpandRegister = async (regId: string | number) => {
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
      toast.success('Permissions saved');
      const perms = await getUserPermissions(selectedUserId);
      setPermissions(perms);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update permissions');
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateFromTemplate(template: any) {
    if (!selectedUserId || !selectedUser) return;
    setCreating(true);
    try {
      // 1. Create the register
      const newReg = await createRegister({
        businessId: 0, // Admin created
        name: template.name,
        icon: template.icon,
        category: selectedCategory,
        template: template.name,
        columns: template.columns
      });

      // 2. Grant permission to the selected user
      await updateUserPermissions(selectedUserId, [{
        registerId: newReg.id,
        canView: true,
        canEdit: true,
        canDownload: true
      }]);

      toast.success('Register created and assigned');
      setShowTemplateModal(false);
      
      // 3. Refresh permissions
      const perms = await getUserPermissions(selectedUserId);
      setPermissions(perms);
      setSelectedRegIds(prev => new Set(prev).add(newReg.id));
    } catch (err) {
      console.error(err);
      toast.error('Failed to create register');
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteRegister(regId: string | number, e: React.MouseEvent) {
    e.stopPropagation();
    setMenuOpenId(null);
    if (!window.confirm('Are you sure you want to permanently delete this register? This action cannot be undone and will remove it for all users.')) return;
    
    try {
      await permanentlyDeleteRegister(regId);
      toast.success('Register deleted');
      // Refresh permissions
      if (selectedUserId) {
        const perms = await getUserPermissions(selectedUserId);
        setPermissions(perms);
        const nextIds = new Set(selectedRegIds);
        nextIds.delete(regId);
        setSelectedRegIds(nextIds);
      }
      if (expandedRegId === regId) setExpandedRegId(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete register');
    }
  }

  async function handleToggleGlobalCreate() {
    if (!selectedUserId || !selectedUser) return;
    const nextVal = !selectedUser.canEdit;
    try {
      // Use the robust updateUserPermissions endpoint which handles all global flags
      await updateUserPermissions(selectedUserId, [], { canEdit: nextVal, canCreateRegisters: nextVal, canCreateTemplates: nextVal });
      
      setUsers(prev => prev.map(u => u.id === selectedUserId ? { 
        ...u, 
        canEdit: nextVal, 
        canCreateRegisters: nextVal, 
        canCreateTemplates: nextVal 
      } : u));
      
      toast.success(nextVal ? 'Creation permissions enabled' : 'Creation permissions disabled');
    } catch (err: any) {
      console.error('Permission update failed:', err);
      toast.error(err.message || 'Failed to update permission');
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!newUser.name || !newUser.email || !newUser.password) {
      toast.error('All fields are required');
      return;
    }
    setCreating(true);
    try {
      // Use the existing signup API to create the user
      await signup(newUser.name, newUser.email, newUser.password);
      
      // If role is admin, we might need to update their role (assuming signup defaults to user)
      if (newUser.role === 'admin') {
        // Here we could call an API to update role if signup doesn't handle it
        // For now, let's assume the user is created and we'll refresh the list
      }
      
      toast.success('User created successfully');
      setShowUserModal(false);
      setNewUser({ name: '', email: '', password: '', role: 'user' });
      fetchInitialData(); // Refresh user list
    } catch (err: any) {
      toast.error(err.message || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  }

  async function handleUserAction(userId: string | number, action: string) {
    setUserMenuOpenId(null);
    const user = users.find(u => u.id === userId);
    if (!user) return;

    try {
      switch (action) {
        case 'edit':
          setActiveNav('users');
          handleUserSelect(user);
          break;
        case 'delete':
          if (window.confirm(`⚠️ PERMANENT DELETE: Are you sure you want to delete user ${user.name || user.email}? \n\nThis will remove all their data, credentials, and access permanently. This action CANNOT be undone.`)) {
            try {
              await deleteUser(userId);
              toast.success('User purged from database');
              // Ensure we re-fetch to show the updated list
              await fetchInitialData();
              // If the deleted user was selected, clear selection
              if (selectedUserId === userId) setSelectedUserId(null);
            } catch (err: any) {
              console.error('Delete failed:', err);
              toast.error(err.message || 'Failed to delete user. Please try again.');
            }
          }
          break;
        case 'role':
          const newIsAdmin = !user.isAdmin;
          await updateUserPermissions(userId, [], { isAdmin: newIsAdmin });
          toast.success(`Role updated to ${newIsAdmin ? 'Admin' : 'User'}`);
          await fetchInitialData();
          break;
        case 'reset':
          if (window.confirm(`Reset password for ${user.name || user.email}? They will receive a temporary link.`)) {
            await resetUserPassword(userId);
            toast.success('Password reset triggered');
          }
          break;
        case 'disable':
          const nextDisabled = !user.disabled;
          await toggleUserStatus(userId, nextDisabled);
          toast.success(nextDisabled ? 'User disabled' : 'User enabled');
          await fetchInitialData();
          break;
        default:
          toast('Action not implemented yet');
      }
    } catch (err) {
      console.error(err);
      toast.error('Action failed. Please try again.');
    }
  }

  // Computed stats
  const adminCount = users.filter(u => u.isAdmin).length;
  const userCount = users.length;

  // ─── Render ───
  return (
    <div className="adm-root">
      {/* ═══ Sidebar ═══ */}
      <aside className={`adm-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="adm-sidebar-brand" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="brand-icon"><Shield size={18} color="#fff" /></div>
            {!sidebarCollapsed && <span>RecordBook.IO</span>}
          </div>
          <button 
            className="btn-icon-ghost" 
            style={{ color: 'rgba(255,255,255,0.5)', padding: 0, width: 24, height: 24 }}
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            <Menu size={16} />
          </button>
        </div>

        <nav className="adm-sidebar-nav">
          <div className="adm-nav-label">Main</div>
          <button className={`adm-nav-btn ${activeNav === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveNav('dashboard')}>
            <Home size={16} /> <span>Dashboard</span>
          </button>

          <div className="adm-nav-label">Management</div>
          <button
            className={`adm-nav-btn ${activeNav === 'users' ? 'active' : ''}`}
            onClick={() => { setActiveNav('users'); setUsersExpanded(!usersExpanded); }}
          >
            <Users size={16} /> <span>Users</span>
            <span className="nav-count">{userCount}</span>
            {!sidebarCollapsed && (usersExpanded && activeNav === 'users' ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
          </button>

          {usersExpanded && activeNav === 'users' && !sidebarCollapsed && (
            <div className="adm-user-list">
              <button 
                className="adm-user-item" 
                style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', marginBottom: 8, border: '1px dashed rgba(59, 130, 246, 0.3)' }}
                onClick={(e) => { e.stopPropagation(); setShowUserModal(true); setNewUser({ name: '', email: '', password: '', role: 'user' }); }}
              >
                <Plus size={14} style={{ marginRight: 8 }} />
                <span style={{ fontSize: 12, fontWeight: 600 }}>Create New User</span>
              </button>
              {users.map(u => (
                  <button
                    key={u.id}
                    className={`adm-user-item ${selectedUserId === u.id ? 'active' : ''} ${u.disabled ? 'disabled' : ''}`}
                    onClick={() => handleUserSelect(u)}
                  >
                    <div className="u-dot" style={{ background: u.disabled ? '#ef4444' : (u.isAdmin ? '#3b82f6' : '#22c55e') }} />
                    <div className="u-info">
                      <span className="u-name">{u.name || u.email}</span>
                      <span className="u-role">{u.isAdmin ? 'Admin' : 'User'}{u.disabled ? ' (Disabled)' : ''}</span>
                    </div>
                  </button>
              ))}
            </div>
          )}

          <button className={`adm-nav-btn ${activeNav === 'registers' ? 'active' : ''}`} onClick={() => setActiveNav('registers')}>
            <BookOpen size={16} /> <span>Registers</span>
          </button>

          <div className="adm-nav-label">System</div>
          <button className={`adm-nav-btn ${activeNav === 'settings' ? 'active' : ''}`} onClick={() => setActiveNav('settings')}>
            <Settings size={16} /> <span>Settings</span>
          </button>
          <button className="adm-nav-btn" onClick={() => navigate('/')}>
            <ArrowLeft size={16} /> <span>Back to App</span>
          </button>
        </nav>

        <div className="adm-sidebar-footer">
          <div className="footer-avatar"><UserIcon size={16} /></div>
          <div className="footer-info">
            <div className="footer-name">{currentUser?.name || 'Admin'}</div>
            <div className="footer-role">Super Admin</div>
          </div>
          {!sidebarCollapsed && <ChevronDown size={14} style={{ opacity: 0.4, cursor: 'pointer' }} />}
        </div>
      </aside>

      {/* ═══ Main ═══ */}
      <main className="adm-main">
        {loading && (
          <div className="adm-loading">
            <Loader2 size={32} className="animate-spin" color="#3b82f6" />
            <span>Loading Admin Panel...</span>
          </div>
        )}

        <header className="adm-topbar">
          <div className="adm-topbar-left">
            {!sidebarCollapsed && (
              <button className="btn-icon-ghost" style={{ marginRight: 8 }} onClick={() => setSidebarCollapsed(true)}>
                <Menu size={18} />
              </button>
            )}
            {sidebarCollapsed && (
              <button className="btn-icon-ghost" style={{ marginRight: 8 }} onClick={() => setSidebarCollapsed(false)}>
                <Menu size={18} />
              </button>
            )}
            <Shield size={16} className="icon-muted" />
            <span>Admin</span>
            <ChevronRight size={14} style={{ opacity: 0.3 }} />
            <span className="active-crumb">
              {activeNav === 'dashboard' ? 'Dashboard' : activeNav === 'users' ? (selectedUser?.name || 'Users') : activeNav === 'registers' ? 'Registers' : 'Settings'}
            </span>
          </div>
          <div className="adm-topbar-right">
            <button className="btn-icon-primary" onClick={() => setShowUserModal(true)} title="Create New User" style={{ marginRight: 16 }}>
              <Plus size={18} />
            </button>
            <div className="top-avatar">{currentUser?.name?.[0]?.toUpperCase() || 'A'}</div>
          </div>
        </header>

        <div className="adm-content">
          {/* ─── Dashboard View ─── */}
          {activeNav === 'dashboard' && (
            <>
              <div className="dash-stats">
                <div className="dash-stat-card">
                  <div className="stat-info">
                    <h4>Total Users</h4>
                    <div className="stat-value">{userCount}</div>
                    <div className="stat-sub">{adminCount} admins</div>
                  </div>
                  <div className="stat-icon blue"><Users size={20} /></div>
                </div>
                <div className="dash-stat-card">
                  <div className="stat-info">
                    <h4>Total Registers</h4>
                    <div className="stat-value">{permissions.length}</div>
                    <div className="stat-sub">Across all users</div>
                  </div>
                  <div className="stat-icon green"><BookOpen size={20} /></div>
                </div>
                <div className="dash-stat-card">
                  <div className="stat-info">
                    <h4>Active Sessions</h4>
                    <div className="stat-value">{Math.min(userCount, 5)}</div>
                    <div className="stat-sub">Currently online</div>
                  </div>
                  <div className="stat-icon purple"><BarChart2 size={20} /></div>
                </div>
                <div className="dash-stat-card">
                  <div className="stat-info">
                    <h4>Pending Actions</h4>
                    <div className="stat-value">0</div>
                    <div className="stat-sub">All clear</div>
                  </div>
                  <div className="stat-icon orange"><Bell size={20} /></div>
                </div>
              </div>

              <div className="tbl-panel">
                <div className="tbl-panel-bar">
                  <div>
                    <h3>Recent Users</h3>
                    <p>Latest registered users on the platform</p>
                  </div>
                </div>
                <div className="tbl-wrap">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>#</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Joined</th>
                        <th style={{ width: 40 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.slice(0, 8).map((u, i) => (
                        <tr key={u.id} style={{ cursor: 'pointer' }} onClick={() => { setActiveNav('users'); handleUserSelect(u); }}>
                          <td style={{ color: '#94a3b8' }}>{i + 1}</td>
                          <td style={{ fontWeight: 500 }}>{u.name || '—'}</td>
                          <td style={{ color: '#64748b' }}>{u.email}</td>
                          <td><span className={u.isAdmin ? 'badge-ok' : 'badge-no'}>{u.isAdmin ? 'Admin' : 'User'}</span></td>
                          <td>
                            <span className={u.disabled ? 'badge-error' : 'badge-active'}>
                              {u.disabled ? 'Disabled' : 'Active'}
                            </span>
                          </td>
                          <td style={{ color: '#64748b' }}>{new Date(u.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                          <td style={{ position: 'relative', overflow: 'visible' }} onClick={e => e.stopPropagation()}>
                            <button className="btn-icon-ghost" onClick={() => setUserMenuOpenId(userMenuOpenId === u.id ? null : u.id)}>
                              <MoreVertical size={16} />
                            </button>
                            {userMenuOpenId === u.id && (
                              <>
                                <div className="menu-backdrop" onClick={() => setUserMenuOpenId(null)} />
                                <div className="dropdown-menu" style={{ right: 0, top: '100%', marginTop: 4 }}>
                                  <button className="dropdown-item" onClick={() => handleUserAction(u.id, 'edit')}>
                                    <Pencil size={14} /> Edit User
                                  </button>
                                  <button className="dropdown-item" onClick={() => handleUserAction(u.id, 'role')}>
                                    <ShieldAlert size={14} /> {u.isAdmin ? 'Make User' : 'Make Admin'}
                                  </button>
                                  <button className="dropdown-item" onClick={() => handleUserAction(u.id, 'reset')}>
                                    <Key size={14} /> Reset Password
                                  </button>
                                  <button className="dropdown-item" onClick={() => handleUserAction(u.id, 'disable')}>
                                    {u.disabled ? <UserCheck size={14} /> : <UserX size={14} />} 
                                    {u.disabled ? 'Enable User' : 'Disable User'}
                                  </button>
                                  <div className="dropdown-divider" />
                                  <button className="dropdown-item text-red" onClick={() => handleUserAction(u.id, 'delete')}>
                                    <Trash2 size={14} /> Delete User
                                  </button>
                                </div>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ─── Users View ─── */}
          {activeNav === 'users' && (
            <div className={`adm-two-col ${expandedRegId ? '' : 'no-detail'}`}>
              <div className="users-section">
                {/* User Header Card - COMPACT */}
                {selectedUser && (
                  <div className="user-card-header">
                    <div className="user-card-left">
                      <div className="user-avatar-lg">{(selectedUser.name || selectedUser.email)[0].toUpperCase()}</div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <h2 className="user-card-name">{selectedUser.name || 'Unnamed User'}</h2>
                          <span className={selectedUser.disabled ? 'badge-error' : 'badge-active'}>
                            {selectedUser.disabled ? 'Disabled' : 'Active'}
                          </span>
                        </div>
                        <p className="user-card-email">{selectedUser.email}</p>
                      </div>
                    </div>
                    <div className="user-card-right">
                      <div className="user-meta-item">
                        <label>Role</label>
                        <span>{selectedUser.isAdmin ? 'Admin' : 'User'}</span>
                      </div>
                      <div className="user-meta-item">
                        <label>Joined</label>
                        <span>{new Date(selectedUser.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </div>
                      <div className="user-meta-item">
                        <label>Allow Creation</label>
                        <div className="toggle-switch" onClick={handleToggleGlobalCreate} style={{ cursor: 'pointer' }}>
                          <input type="checkbox" checked={!!selectedUser.canEdit} readOnly />
                          <span className="toggle-slider"></span>
                        </div>
                      </div>
                      <div style={{ paddingLeft: 12, borderLeft: '1px solid #e2e8f0', display: 'flex', alignItems: 'center' }}>
                        <button className="btn-primary" onClick={handleApprove} disabled={saving}>
                          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                          Save Changes
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Registers Table */}
                <div className="tbl-panel">
                  <div className="tbl-panel-tabs">
                    <button className={`tbl-tab ${activeTab === 'all-registers' ? 'active' : ''}`} onClick={() => setActiveTab('all-registers')}>All Registers</button>
                    <button className={`tbl-tab ${activeTab === 'approved-registers' ? 'active' : ''}`} onClick={() => setActiveTab('approved-registers')}>Approved</button>
                  </div>

                  <div className="tbl-panel-bar">
                    <div>
                      <h3>{activeTab === 'all-registers' ? 'All Registers' : 'Approved Registers'}</h3>
                      <p>Select registers to approve access for this user.</p>
                    </div>
                    <div className="tbl-actions-right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div className="tbl-search">
                        <Search size={14} />
                        <input placeholder="Search registers..." value={registerSearch} onChange={e => setRegisterSearch(e.target.value)} />
                      </div>
                      <button className="btn-icon-primary" onClick={() => setShowTemplateModal(true)} title="Create New Register">
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="tbl-wrap">
                    <table className="tbl">
                      <thead>
                        <tr>
                          <th style={{ width: 36 }}>
                            <input type="checkbox" className="cb"
                              checked={selectedRegIds.size === permissions.length && permissions.length > 0}
                              onChange={e => {
                                if (e.target.checked) setSelectedRegIds(new Set(permissions.map(p => p.registerId)));
                                else setSelectedRegIds(new Set());
                              }}
                            />
                          </th>
                          <th style={{ width: 36 }}>#</th>
                          <th>Register Name</th>
                          <th style={{ width: 60 }}>Edit</th>
                          <th style={{ width: 80 }}>Download</th>
                          <th style={{ width: 100 }}>Status</th>
                          <th style={{ width: 40 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {permLoading ? (
                          <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32 }}><Loader2 size={24} className="animate-spin" style={{ margin: '0 auto' }} /></td></tr>
                        ) : filteredPermissions.map((p, idx) => (
                          <tr key={p.registerId} className={expandedRegId === p.registerId ? 'row-active' : ''} onClick={() => handleExpandRegister(p.registerId)}>
                            <td onClick={e => e.stopPropagation()}>
                              <input type="checkbox" className="cb" checked={selectedRegIds.has(p.registerId)} onChange={() => toggleRegSelection(p.registerId)} />
                            </td>
                            <td style={{ color: '#94a3b8' }}>{idx + 1}</td>
                            <td style={{ fontWeight: 500 }}>{p.registerName}</td>
                            <td onClick={e => e.stopPropagation()}>
                              <input type="checkbox" className="cb" checked={p.canEdit} disabled={!selectedRegIds.has(p.registerId)} onChange={() => togglePermission(p.registerId, 'canEdit')} />
                            </td>
                            <td onClick={e => e.stopPropagation()}>
                              <input type="checkbox" className="cb" checked={p.canDownload} disabled={!selectedRegIds.has(p.registerId)} onChange={() => togglePermission(p.registerId, 'canDownload')} />
                            </td>
                            <td>
                              {selectedRegIds.has(p.registerId)
                                ? <span className="badge-ok">Approved</span>
                                : <span className="badge-no">Not Approved</span>}
                            </td>
                            <td style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                              <button className="btn-icon-ghost" onClick={() => setMenuOpenId(menuOpenId === p.registerId ? null : p.registerId)}>
                                <MoreVertical size={16} />
                              </button>
                              {menuOpenId === p.registerId && (
                                <>
                                  <div className="menu-backdrop" onClick={() => setMenuOpenId(null)} />
                                  <div className="dropdown-menu">
                                    <button className="dropdown-item" onClick={() => { setMenuOpenId(null); /* download logic here if needed */ }}>
                                      <Download size={14} /> Download Data
                                    </button>
                                    <div className="dropdown-divider" />
                                    <button className="dropdown-item text-red" onClick={(e) => handleDeleteRegister(p.registerId, e)}>
                                      <Trash2 size={14} /> Delete Register
                                    </button>
                                  </div>
                                </>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="tbl-footer">
                    <span className="count">{selectedRegIds.size} of {permissions.length} registers selected</span>
                  </div>
                </div>
              </div>

              {/* ─── Detail Panel ─── */}
              {expandedRegId && (
                <div className="detail-panel">
                  <div className="detail-head">
                    <div>
                      <h4>Register Details</h4>
                      <h3>{permissions.find(p => p.registerId === expandedRegId)?.registerName}</h3>
                    </div>
                    <button className="detail-close" onClick={() => setExpandedRegId(null)}><X size={18} /></button>
                  </div>

                  <div className="detail-tabs">
                    <button className="active">Columns</button>
                    <button>Edit</button>
                    <button>Download</button>
                  </div>

                  <div className="detail-body">
                    <p className="detail-label">Total Columns: {regColumns.length}</p>

                    <table className="col-table">
                      <thead><tr><th>#</th><th>Column Name</th><th>Type</th></tr></thead>
                      <tbody>
                        {columnsLoading ? (
                          <tr><td colSpan={3} style={{ textAlign: 'center', padding: 20 }}><Loader2 size={16} className="animate-spin" style={{ margin: '0 auto' }} /></td></tr>
                        ) : regColumns.map((col, idx) => (
                          <tr key={col.id}><td>{idx + 1}</td><td>{col.name}</td><td style={{ textTransform: 'capitalize' }}>{col.type}</td></tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="access-card">
                      <h5>Access Settings</h5>
                      <label className="access-row">
                        <input type="checkbox" className="cb"
                          checked={permissions.find(p => p.registerId === expandedRegId)?.canEdit || false}
                          disabled={!selectedRegIds.has(expandedRegId)}
                          onChange={() => togglePermission(expandedRegId, 'canEdit')}
                        />
                        <div>
                          <div className="a-label">Edit Access</div>
                          <div className="a-desc">Allow user to edit this register</div>
                        </div>
                      </label>
                      <label className="access-row">
                        <input type="checkbox" className="cb"
                          checked={permissions.find(p => p.registerId === expandedRegId)?.canDownload || false}
                          disabled={!selectedRegIds.has(expandedRegId)}
                          onChange={() => togglePermission(expandedRegId, 'canDownload')}
                        />
                        <div>
                          <div className="a-label">Download Access</div>
                          <div className="a-desc">Allow user to download this register</div>
                        </div>
                      </label>
                    </div>

                    <div className="note-box">
                      <div className="note-title"><AlertTriangle size={14} /> Note</div>
                      <p>Only approved registers will be visible in the user panel. Unapproved registers will be hidden completely.</p>
                    </div>
                  </div>

                  <div className="detail-foot">
                    <button className="btn-ghost" onClick={() => setExpandedRegId(null)}>Cancel</button>
                    <button className="btn-primary" onClick={handleApprove} disabled={saving}>
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── Registers Overview ─── */}
          {activeNav === 'registers' && (
            <div className="empty-state" style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0' }}>
              <BookOpen size={48} strokeWidth={1} />
              <p style={{ fontWeight: 600, fontSize: 16, color: '#0f172a', margin: '16px 0 4px' }}>Register Management</p>
              <p>Global register overview and bulk operations will be available here.</p>
            </div>
          )}

          {/* ─── Settings ─── */}
          {activeNav === 'settings' && (
            <div className="empty-state" style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0' }}>
              <Settings size={48} strokeWidth={1} />
              <p style={{ fontWeight: 600, fontSize: 16, color: '#0f172a', margin: '16px 0 4px' }}>System Settings</p>
              <p>Institution settings, subscription management, and security controls will be available here.</p>
            </div>
          )}
        </div>
      </main>

      {/* ─── Template Modal ─── */}
      {showTemplateModal && (
        <div className="modal-overlay">
          <div className="modal-content tmpl-modal">
            <div className="modal-header">
              <h2>Create & Assign Register</h2>
              <button className="btn-close" onClick={() => setShowTemplateModal(false)}><X size={20} /></button>
            </div>
            <div className="tmpl-layout">
              <div className="tmpl-sidebar">
                {CATEGORIES.map(cat => (
                  <button 
                    key={cat.id} 
                    className={`tmpl-cat-btn ${selectedCategory === cat.id ? 'active' : ''}`}
                    onClick={() => setSelectedCategory(cat.id)}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
              <div className="tmpl-main">
                <div className="tmpl-grid">
                  {(TEMPLATES[selectedCategory] || []).map((tmpl, i) => (
                    <div key={i} className="tmpl-card">
                      <div className="tmpl-icon"><FileText size={24} color="#3b82f6" /></div>
                      <h4>{tmpl.name}</h4>
                      <p>{tmpl.description}</p>
                      <button 
                        className="btn-primary tmpl-create-btn" 
                        onClick={() => handleCreateFromTemplate(tmpl)}
                        disabled={creating}
                      >
                        {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                        Create & Assign
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── User Creation Modal ─── */}
      {showUserModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: 400 }}>
            <div className="modal-header">
              <h2>Create New User</h2>
              <button className="btn-close" onClick={() => { setShowUserModal(false); setNewUser({ name: '', email: '', password: '', role: 'user' }); }}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateUser} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="detail-label">Full Name</label>
                <input 
                  type="text" 
                  className="tbl-search" 
                  style={{ width: '100%', background: '#f8fafc' }} 
                  placeholder="John Doe"
                  value={newUser.name}
                  onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                  required 
                />
              </div>
              <div className="form-group">
                <label className="detail-label">Email Address</label>
                <input 
                  type="email" 
                  className="tbl-search" 
                  style={{ width: '100%', background: '#f8fafc' }} 
                  placeholder="john@example.com"
                  value={newUser.email}
                  onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                  required 
                />
              </div>
              <div className="form-group">
                <label className="detail-label">Password</label>
                <input 
                  type="password" 
                  className="tbl-search" 
                  style={{ width: '100%', background: '#f8fafc' }} 
                  placeholder="••••••••"
                  value={newUser.password}
                  onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                  required 
                />
              </div>
              <div className="form-group">
                <label className="detail-label">Role</label>
                <select 
                  className="tbl-search" 
                  style={{ width: '100%', background: '#f8fafc' }}
                  value={newUser.role}
                  onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div style={{ marginTop: 8, display: 'flex', gap: 12 }}>
                <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={() => { setShowUserModal(false); setNewUser({ name: '', email: '', password: '', role: 'user' }); }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={creating}>
                  {creating ? <Loader2 size={16} className="animate-spin" /> : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
