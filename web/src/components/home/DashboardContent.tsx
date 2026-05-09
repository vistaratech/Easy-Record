import { Plus, Upload, FileText, FolderOpen } from 'lucide-react';
import { startTransition } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import type { RegisterSummary } from '../../lib/api';

interface DashboardContentProps {
  filtered?: RegisterSummary[];
  excelMutation: any; // Type accurately if possible, or use any
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onInputFolder?: () => void;
}

export function DashboardContent({ filtered, excelMutation, handleFileUpload, onInputFolder }: DashboardContentProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canCreate = user?.isAdmin || user?.canCreateRegisters;

  if (!filtered || filtered.length === 0) {
    return (
      <div className="content-area">
        <div className="empty-state">
          <img src="/logo.jpg" alt="Easy Record" className="empty-logo" />
          <h2 className="empty-title">Welcome to Easy Record</h2>
          <p className="empty-sub">
            {canCreate 
              ? 'Excel Register Book — Create your first register by selecting a template, starting from scratch, or uploading Excel data.'
              : 'You do not have permission to create registers. Please contact your administrator.'}
          </p>
          {canCreate && (
            <div className="empty-actions">
              <button className="empty-btn" onClick={() => navigate('/templates')}>
                <Plus size={16} />Add New Register
              </button>
              <label htmlFor="excel-upload-empty" className="empty-btn empty-btn-secondary" style={{ marginLeft: 8 }}>
                <Upload size={16} />{excelMutation.isPending ? 'Importing...' : 'Import Excel'}
              </label>
              <input id="excel-upload-empty" type="file" accept=".xlsx, .xls, .csv" className="hidden-input" title="Upload Excel File" aria-label="Upload Excel File" onChange={handleFileUpload} />
              <div className="empty-btn empty-btn-secondary" style={{ marginLeft: 8, cursor: 'pointer' }} onClick={onInputFolder}>
                <FolderOpen size={16} />Import Folder
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="content-area">
      <div className="registers-content">
        <h2 className="registers-heading">Your Registers</h2>
        <p className="registers-subheading">
          {filtered.length} register{filtered.length !== 1 ? 's' : ''} &bull; Click to open
        </p>
        <div className="categories-grid categories-grid--no-pad">
          {filtered.map((reg) => (
            <div key={reg.id} className="category-card" onClick={() => startTransition(() => navigate(`/register/${reg.id}`))}>
              <div className="category-icon" {...{ style: { '--dyn-bg': reg.iconColor || 'var(--navy)' } as React.CSSProperties }}>
                <FileText size={24} />
              </div>
              <div className="category-name">{reg.name}</div>
              <div className="category-count">{reg.entryCount} entries &bull; {new Date(reg.updatedAt).toLocaleDateString()}{reg.lastActivity ? ` | ${reg.lastActivity}` : ''}</div>
            </div>
          ))}
          {canCreate && (
            <div className="category-card category-card--dashed" onClick={() => navigate('/templates')}>
              <div className="category-icon category-icon--muted">
                <Plus size={24} />
              </div>
              <div className="category-name">Add New</div>
              <div className="category-count">Create from template</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
