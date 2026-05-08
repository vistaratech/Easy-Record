import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  listAllUsers, getUserPermissions, updateUserPermissions,
  type User, type UserPermission 
} from '../lib/api';
import { 
  Users, Shield, Eye, Pencil, Download, ChevronRight, Search, 
  Loader2, Check, ArrowLeft, RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../lib/auth';

export default function AdminPage() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  const { data: rawUsers, isLoading: usersLoading, isError: usersError, refetch: refetchUsers } = useQuery({
    queryKey: ['adminUsers'],
    queryFn: listAllUsers
  });

  const users = Array.isArray(rawUsers) ? rawUsers : [];

  const filteredUsers = users.filter(u => 
    (u.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
    (u.email?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  return (
    <div className="admin-layout">
      {/* Sidebar Navigation */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header" onClick={() => navigate('/')}>
          <div className="admin-logo-bg">
            <Shield size={20} color="white" />
          </div>
          <span className="admin-logo-text">Admin Center</span>
        </div>
        
        <nav className="admin-nav">
          <button className="admin-nav-item active">
            <Users size={18} />
            <span>Users</span>
          </button>
        </nav>

        <div className="admin-sidebar-footer">
          <button className="admin-nav-item logout" onClick={() => navigate('/')}>
            <ArrowLeft size={18} />
            <span>Exit Admin</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="admin-main">
        <header className="admin-topbar">
          <div className="topbar-left">
            <h1 className="admin-title">User Management</h1>
          </div>
          <div className="topbar-right">
            <button className="refresh-btn" onClick={() => refetchUsers()} title="Refresh Data">
              <RefreshCw size={16} className={usersLoading ? 'animate-spin' : ''} />
            </button>
            <div className="admin-profile">
              <div className="admin-info">
                <span className="admin-name">{currentUser?.name || currentUser?.email}</span>
                <span className="admin-tag">{currentUser?.isAdmin ? 'Administrator' : 'User'}</span>
              </div>
              <div className="admin-avatar">
                {currentUser?.name?.[0].toUpperCase() || currentUser?.email?.[0].toUpperCase() || 'A'}
              </div>
            </div>
          </div>
        </header>

        <div className="admin-view-content">
          <div className="admin-users-grid">
              {/* User List Panel */}
              <div className="glass-panel user-list-panel">
                <div className="panel-header">
                  <div className="panel-header-top">
                    <h3>Members</h3>
                    <span className="count-badge">{users.length}</span>
                  </div>
                  <div className="search-wrapper">
                    <Search size={16} className="search-icon" />
                    <input 
                      type="text" 
                      placeholder="Search by name or email..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>

                <div className="user-scroll-area">
                  {usersLoading ? (
                    <div className="admin-loader">
                      <Loader2 size={32} className="animate-spin" />
                      <p>Fetching Users...</p>
                    </div>
                  ) : usersError ? (
                    <div className="empty-panel">
                      <Shield size={40} className="text-red-500" />
                      <h4>Connection Failed</h4>
                      <p>Could not fetch user list. Please check your admin permissions or network.</p>
                      <button className="save-btn" onClick={() => refetchUsers()}>Retry</button>
                    </div>
                  ) : filteredUsers && filteredUsers.length > 0 ? (
                    filteredUsers.map(user => (
                      <div 
                        key={user.id} 
                        className={`admin-user-card ${selectedUser?.id === user.id ? 'selected' : ''}`}
                        onClick={() => setSelectedUser(user)}
                      >
                        <div className="user-card-main">
                          <div className="user-icon-bg">
                            {user.name?.[0].toUpperCase() || user.email[0].toUpperCase()}
                          </div>
                          <div className="user-card-info">
                            <p className="user-card-name">{user.name || 'Unknown User'}</p>
                            <p className="user-card-email">{user.email}</p>
                          </div>
                        </div>
                        {user.isAdmin && <Shield size={14} className="admin-icon" />}
                        <ChevronRight size={16} className="card-arrow" />
                      </div>
                    ))
                  ) : (
                    <div className="empty-panel">
                      <Users size={40} />
                      <h4>No Users Found</h4>
                      <p>No members match your current search criteria.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Permissions Details Panel */}
              <div className="glass-panel permissions-panel">
                {selectedUser ? (
                  <PermissionsManager user={selectedUser} />
                ) : (
                  <div className="empty-panel">
                    <div className="empty-icon-ring">
                      <Users size={40} />
                    </div>
                    <h4>No User Selected</h4>
                    <p>Pick a member from the list to view and manage their register permissions.</p>
                  </div>
                )}
              </div>
            </div>
        </div>
      </main>
    </div>
  );
}

function PermissionsManager({ user }: { user: User }) {
  const queryClient = useQueryClient();
  const [localPermissions, setLocalPermissions] = useState<UserPermission[]>([]);
  
  const { data: permissions, isLoading } = useQuery({
    queryKey: ['userPermissions', user.id],
    queryFn: () => getUserPermissions(user.id)
  });

  // Re-sync local state when data changes or user changes
  useEffect(() => {
    if (permissions) setLocalPermissions(permissions);
  }, [permissions, user.id]);

  const updateMutation = useMutation({
    mutationFn: (newPerms: Partial<UserPermission>[]) => updateUserPermissions(user.id, newPerms),
    onSuccess: () => {
      toast.success('Permissions updated');
      queryClient.invalidateQueries({ queryKey: ['userPermissions', user.id] });
    },
    onError: () => toast.error('Update failed')
  });

  const togglePermission = (registerId: number, field: keyof UserPermission) => {
    setLocalPermissions(prev => prev.map(p => {
      if (p.registerId === registerId) {
        return { ...p, [field]: !p[field] };
      }
      return p;
    }));
  };

  const hasChanges = JSON.stringify(permissions) !== JSON.stringify(localPermissions);

  if (isLoading) {
    return (
      <div className="admin-loader">
        <Loader2 size={32} className="animate-spin" />
        <p>Syncing Permissions...</p>
      </div>
    );
  }

  return (
    <div className="permissions-manager">
      <div className="manager-header">
        <div className="manager-user-info">
          <div className="manager-avatar">
            {user.name?.[0].toUpperCase() || user.email[0].toUpperCase()}
          </div>
          <div>
            <h3>{user.name || 'User'}'s Created Registers</h3>
            <p>Managing {localPermissions.length} registers</p>
          </div>
        </div>
        <div className="manager-actions">
          {hasChanges && (
            <button 
              className="save-btn" 
              onClick={() => updateMutation.mutate(localPermissions)}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              <span>Save Access</span>
            </button>
          )}
        </div>
      </div>

      <div className="permissions-list">
        <div className="permissions-table-header">
          <div className="col-reg">Register Name</div>
          <div className="col-perm">Access Levels</div>
        </div>
        
        {localPermissions.length === 0 ? (
          <div className="no-registers">This user has no registers yet.</div>
        ) : localPermissions.map(p => (
          <div key={p.registerId} className="permission-row">
            <div className="reg-info">
              <span className="reg-name">{p.registerName}</span>
              <span className="reg-id">ID: {p.registerId}</span>
            </div>
            <div className="perm-switches">
              <Switch 
                label="View-Only" 
                active={p.canView} 
                onClick={() => togglePermission(p.registerId, 'canView')}
                icon={<Eye size={12} />}
              />
              <Switch 
                label="Edit" 
                active={p.canEdit} 
                onClick={() => togglePermission(p.registerId, 'canEdit')}
                icon={<Pencil size={12} />}
              />
              <Switch 
                label="Download" 
                active={p.canDownload} 
                onClick={() => togglePermission(p.registerId, 'canDownload')}
                icon={<Download size={12} />}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Switch({ label, active, onClick, icon }: { label: string, active: boolean, onClick: () => void, icon: React.ReactNode }) {
  return (
    <div className={`admin-switch-container ${active ? 'active' : ''}`} onClick={onClick}>
      <div className="switch-icon">{icon}</div>
      <span className="switch-label">{label}</span>
      <div className="switch-track">
        <div className="switch-thumb" />
      </div>
    </div>
  );
}
