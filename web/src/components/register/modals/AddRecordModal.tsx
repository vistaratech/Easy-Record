import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDateToDDMMYYYY } from '../../../lib/api';

interface Column {
  id: number;
  name: string;
  type: string;
  dropdownOptions?: string[];
}

interface Entry {
  id: number;
  cells?: Record<string, string>;
}

interface AddRecordModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (cells: Record<string, string>) => void;
  columns: Column[];
  isSubmitting?: boolean;
  existingEntries?: Entry[];
}

// Only these types get duplicate-checked (not text/name/date/dropdown/checkbox etc.)
const DUPLICATE_CHECK_TYPES = new Set(['phone', 'email', 'number', 'currency', 'url']);

export function AddRecordModal({
  open, onClose, onSubmit, columns, isSubmitting, existingEntries = []
}: AddRecordModalProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [duplicates, setDuplicates] = useState<Set<string>>(new Set());
  const firstInputRef = useRef<HTMLElement | null>(null);
  // Track which (colId:value) combinations we've already toasted — prevents spam
  const toastedRef = useRef<Set<string>>(new Set());

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      const init: Record<string, string> = {};
      columns.forEach(col => {
        if (col.type !== 'formula') {
          init[col.id.toString()] = '';
        }
      });
      setValues(init);
      setDuplicates(new Set());
      toastedRef.current = new Set();
      setTimeout(() => {
        if (firstInputRef.current) firstInputRef.current.focus();
      }, 50);
    }
  }, [open, columns]);

  // Build fast lookup: colId → Set<lowercase value> from all existing entries
  const existingValueMap = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    existingEntries.forEach(entry => {
      if (!entry.cells) return;
      Object.entries(entry.cells).forEach(([colId, val]) => {
        if (!val || !val.trim()) return;
        if (!map[colId]) map[colId] = new Set();
        map[colId].add(val.trim().toLowerCase());
      });
    });
    return map;
  }, [existingEntries]);

  const handleChange = useCallback(
    (colId: string, val: string, colType: string, colName: string) => {
      setValues(prev => ({ ...prev, [colId]: val }));

      // Only check types that make sense to be unique
      if (!DUPLICATE_CHECK_TYPES.has(colType)) return;

      const trimmed = val.trim().toLowerCase();
      if (!trimmed) {
        setDuplicates(prev => { const n = new Set(prev); n.delete(colId); return n; });
        toastedRef.current.delete(colId);
        return;
      }

      const isDuplicate = existingValueMap[colId]?.has(trimmed) ?? false;

      setDuplicates(prev => {
        const n = new Set(prev);
        if (isDuplicate) n.add(colId); else n.delete(colId);
        return n;
      });

      const toastKey = `${colId}:${trimmed}`;
      if (isDuplicate && !toastedRef.current.has(toastKey)) {
        toastedRef.current.add(toastKey);
        toast.error(
          `Duplicate ${colName}: "${val.trim()}" already exists in another record.`,
          {
            id: `dup-${colId}`,
            duration: 4500,
            position: 'top-right',
            style: {
              background: '#fff7ed',
              color: '#92400e',
              border: '1px solid #f59e0b',
              fontWeight: 600,
              fontSize: '13px',
              maxWidth: '340px',
            },
            icon: '⚠️',
          }
        );
      } else if (!isDuplicate) {
        toastedRef.current.delete(toastKey);
      }
    },
    [existingValueMap]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cells: Record<string, string> = {};
    Object.entries(values).forEach(([k, v]) => {
      const col = columns.find(c => c.id.toString() === k);
      if (col?.type === 'formula') return;
      
      let finalVal = v.trim();
      if (col?.type === 'date' && finalVal !== '') {
        finalVal = formatDateToDDMMYYYY(finalVal);
      }
      
      if (finalVal !== '') {
        cells[k] = finalVal;
      }
    });
    onSubmit(cells);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  if (!open) return null;

  const hasDuplicates = duplicates.size > 0;
  const allCols = columns;

  return createPortal(
    <div className="modal-overlay add-record-overlay" onClick={onClose} onKeyDown={handleKeyDown}>
      <div
        className="modal-content add-record-modal"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Add Record"
      >
        {/* Header */}
        <div className="add-record-header">
          <div className="add-record-title">
            <Plus size={16} style={{ flexShrink: 0 }} />
            <h3>Add Record</h3>
          </div>
          <button className="add-record-close-btn" onClick={onClose} title="Close">
            <X size={16} />
          </button>
        </div>

        {/* Inline duplicate warning banner */}
        {hasDuplicates && (
          <div className="add-record-dup-banner">
            <AlertTriangle size={14} style={{ flexShrink: 0 }} />
            <span>Highlighted fields already exist in another record. You can still save if intended.</span>
          </div>
        )}

        {/* Form */}
        <form className="add-record-form" onSubmit={handleSubmit}>
          <div className="add-record-fields">
            {allCols.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
                No columns found. Add columns first.
              </p>
            ) : (
              allCols.map((col, idx) => {
                const colIdStr = col.id.toString();
                const val = values[colIdStr] ?? '';
                const isFirst = idx === 0;
                const isDup = duplicates.has(colIdStr);
                const isFormula = col.type === 'formula';
                const isAutoIncr = col.type === 'auto_increment';
                const inputCls = `add-record-input${isDup ? ' add-record-input--dup' : ''}${isFormula ? ' add-record-input--readonly' : ''}`;
                
                const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
                  handleChange(colIdStr, e.target.value, col.type, col.name);

                return (
                  <div key={col.id} className={`add-record-field${isDup ? ' add-record-field--dup' : ''}${isFormula ? ' add-record-field--formula' : ''}`}>
                    <label className="add-record-label" htmlFor={`ar-col-${col.id}`}>
                      {col.name}
                      <span className={`add-record-type-badge type-${col.type}`}>
                        {col.type}
                      </span>
                      {isDup && (
                        <span className="add-record-dup-badge">
                          <AlertTriangle size={10} /> Duplicate
                        </span>
                      )}
                      {isFormula && (
                        <span className="add-record-formula-badge">
                          Calculated
                        </span>
                      )}
                    </label>

                    {isFormula ? (
                      <div className="add-record-readonly-box">
                        <span className="formula-icon">ƒₓ</span>
                        <span className="formula-placeholder">Computed automatically</span>
                      </div>
                    ) : isAutoIncr ? (
                      <div className="add-record-autoincrement-wrap">
                        <input
                          type="number"
                          id={`ar-col-${col.id}`}
                          className={inputCls}
                          value={val}
                          onChange={onChange}
                          placeholder="Auto-generated if blank"
                          ref={isFirst ? (el) => { firstInputRef.current = el; } : undefined}
                        />
                        <div className="autoincrement-hint">Override or leave blank for next sequence</div>
                      </div>
                    ) : col.type === 'dropdown' && col.dropdownOptions && col.dropdownOptions.length > 0 ? (
                      <select
                        id={`ar-col-${col.id}`}
                        className={`${inputCls} add-record-select`}
                        value={val}
                        onChange={onChange}
                        ref={isFirst ? (el) => { firstInputRef.current = el; } : undefined}
                      >
                        <option value="">-- Select --</option>
                        {col.dropdownOptions.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : col.type === 'checkbox' ? (
                      <div className="add-record-checkbox-wrap">
                        <input
                          type="checkbox"
                          id={`ar-col-${col.id}`}
                          className="add-record-checkbox"
                          checked={val === 'true'}
                          onChange={e => handleChange(colIdStr, e.target.checked ? 'true' : 'false', col.type, col.name)}
                          ref={isFirst ? (el) => { firstInputRef.current = el; } : undefined}
                        />
                        <label htmlFor={`ar-col-${col.id}`} className="add-record-checkbox-label">
                          {val === 'true' ? 'Checked' : 'Unchecked'}
                        </label>
                      </div>
                    ) : col.type === 'date' ? (
                      <input type="text" id={`ar-col-${col.id}`} className={inputCls}
                        value={val} onChange={onChange} placeholder="DD-MM-YYYY"
                        ref={isFirst ? (el) => { firstInputRef.current = el; } : undefined}
                      />
                    ) : col.type === 'number' || col.type === 'currency' || col.type === 'rating' ? (
                      <input type="number" id={`ar-col-${col.id}`} className={inputCls}
                        value={val} onChange={onChange}
                        placeholder={col.type === 'rating' ? '1–5' : '0'}
                        min={col.type === 'rating' ? 1 : undefined}
                        max={col.type === 'rating' ? 5 : undefined}
                        ref={isFirst ? (el) => { firstInputRef.current = el; } : undefined}
                      />
                    ) : col.type === 'email' ? (
                      <input type="email" id={`ar-col-${col.id}`} className={inputCls}
                        value={val} onChange={onChange} placeholder="email@example.com"
                        ref={isFirst ? (el) => { firstInputRef.current = el; } : undefined}
                      />
                    ) : col.type === 'phone' ? (
                      <input type="tel" id={`ar-col-${col.id}`} className={inputCls}
                        value={val} onChange={onChange} placeholder="+91 XXXXX XXXXX"
                        ref={isFirst ? (el) => { firstInputRef.current = el; } : undefined}
                      />
                    ) : col.type === 'url' ? (
                      <input type="url" id={`ar-col-${col.id}`} className={inputCls}
                        value={val} onChange={onChange} placeholder="https://"
                        ref={isFirst ? (el) => { firstInputRef.current = el; } : undefined}
                      />
                    ) : (
                      <input type="text" id={`ar-col-${col.id}`} className={inputCls}
                        value={val} onChange={onChange} placeholder={`Enter ${col.name}…`}
                        ref={isFirst ? (el) => { firstInputRef.current = el; } : undefined}
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="add-record-footer">
            <button type="button" className="modal-cancel-btn" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className={`modal-confirm-btn${hasDuplicates ? ' add-record-submit--warn' : ''}`}
              disabled={isSubmitting || allCols.length === 0}
            >
              {isSubmitting ? 'Saving…' : hasDuplicates ? 'Save Anyway' : 'Save Record'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
