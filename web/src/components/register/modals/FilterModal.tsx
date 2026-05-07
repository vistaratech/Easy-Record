import { useState, useMemo, useEffect, useRef } from 'react';
import { Search, X, Hash, Calendar, ChevronDown, FlaskConical, Type as TypeIcon, ChevronRight, Filter, Plus } from 'lucide-react';
import { type Column } from '../../../lib/api';

export interface FilterRule {
  columnId: number;
  operator: string;
  value: string;
  value2?: string; // For "between" operators
}

interface FilterModalProps {
  filterModal: boolean;
  setFilterModal: (v: boolean) => void;
  filters: FilterRule[];
  setFilters: (v: FilterRule[]) => void;
  setActiveFilters: (v: FilterRule[]) => void;
  columns: Column[];
}

/* ── Operator definitions per column type ── */
const TEXT_OPS = [
  { key: 'contains', label: 'Contains' },
  { key: 'not_contains', label: 'Does Not Contain' },
  { key: 'equals', label: 'Is' },
  { key: 'not_equals', label: 'Is Not' },
  { key: 'starts_with', label: 'Starts With' },
  { key: 'ends_with', label: 'Ends With' },
  { key: 'empty', label: 'Is Empty' },
  { key: 'not_empty', label: 'Is Not Empty' },
];

const NUMBER_OPS = [
  { key: 'eq', label: 'Equals To' },
  { key: 'gt', label: 'Greater Than' },
  { key: 'gte', label: 'Greater Than or Equal To' },
  { key: 'lt', label: 'Less Than' },
  { key: 'lte', label: 'Less Than or Equal To' },
  { key: 'between', label: 'In Between' },
  { key: 'not_between', label: 'Not In Between' },
  { key: 'empty', label: 'Is Empty' },
  { key: 'not_empty', label: 'Is Not Empty' },
];

const DATE_OPS = [
  { key: 'date_between', label: 'In Between Dates' },
  { key: 'date_not_between', label: 'Not Between Dates' },
  { key: 'date_is', label: 'Is' },
  { key: 'date_not', label: 'Is Not' },
  { key: 'date_before', label: 'Is Before' },
  { key: 'date_after', label: 'Is After' },
  { key: 'empty', label: 'Is Empty' },
  { key: 'not_empty', label: 'Is Not Empty' },
];

const DROPDOWN_OPS = [
  { key: 'equals', label: 'Is' },
  { key: 'not_equals', label: 'Is Not' },
  { key: 'empty', label: 'Is Empty' },
  { key: 'not_empty', label: 'Is Not Empty' },
];

function getOpsForType(type: string) {
  switch (type) {
    case 'number': return NUMBER_OPS;
    case 'formula': return NUMBER_OPS;
    case 'date': return DATE_OPS;
    case 'dropdown': return DROPDOWN_OPS;
    default: return TEXT_OPS;
  }
}

function getColumnIcon(type: string) {
  switch (type) {
    case 'number': return Hash;
    case 'date': return Calendar;
    case 'dropdown': return ChevronDown;
    case 'formula': return FlaskConical;
    default: return TypeIcon;
  }
}

const NO_VALUE_OPS = ['empty', 'not_empty'];
const BETWEEN_OPS = ['between', 'not_between', 'date_between', 'date_not_between'];

export function FilterModal({
  filterModal, setFilterModal,
  filters, setFilters, setActiveFilters,
  columns,
}: FilterModalProps) {
  // "add filter" wizard state
  const [addingFilter, setAddingFilter] = useState(false);
  const [colSearch, setColSearch] = useState('');
  const [selectedColId, setSelectedColId] = useState<number | null>(null);
  const [selectedOp, setSelectedOp] = useState<string | null>(null);
  const [val1, setVal1] = useState('');
  const [val2, setVal2] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  const filteredCols = useMemo(() => {
    if (!colSearch) return columns;
    const q = colSearch.toLowerCase();
    return columns.filter(c => c.name.toLowerCase().includes(q));
  }, [columns, colSearch]);

  const selectedCol = columns.find(c => c.id === selectedColId);
  const ops = selectedCol ? getOpsForType(selectedCol.type) : [];

  const resetWizard = () => {
    setAddingFilter(false);
    setColSearch('');
    setSelectedColId(null);
    setSelectedOp(null);
    setVal1('');
    setVal2('');
  };

  // Close panel on outside click
  useEffect(() => {
    if (!filterModal) return;
    const handleClick = (e: MouseEvent) => {
      // Check if click is inside the panel or its parent wrapper
      const wrapper = (panelRef.current?.parentElement);
      if (wrapper && !wrapper.contains(e.target as Node)) {
        setFilterModal(false);
        resetWizard();
      }
    };
    // Use a short delay so the opening click doesn't immediately close it
    const timer = setTimeout(() => document.addEventListener('mousedown', handleClick), 10);
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handleClick); };
  }, [filterModal, setFilterModal]);

  // Close on Escape
  useEffect(() => {
    if (!filterModal) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setFilterModal(false); resetWizard(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [filterModal, setFilterModal]);

  const handleAddFilter = () => {
    if (selectedColId === null || !selectedOp) return;
    
    // Validation
    if (!NO_VALUE_OPS.includes(selectedOp)) {
      if (!val1.trim()) return;
      if (BETWEEN_OPS.includes(selectedOp) && !val2.trim()) return;
    }

    const newFilter: FilterRule = {
      columnId: selectedColId,
      operator: selectedOp,
      value: val1.trim(),
      value2: BETWEEN_OPS.includes(selectedOp) ? val2.trim() : undefined,
    };
    const updated = [...filters, newFilter];
    setFilters(updated);
    resetWizard();
  };

  const handleRemoveFilter = (idx: number) => {
    setFilters(filters.filter((_, i) => i !== idx));
  };

  const handleApply = () => {
    setActiveFilters([...filters]);
    setFilterModal(false);
    resetWizard();
  };

  const handleClearClose = () => {
    setFilters([]);
    setActiveFilters([]);
    setFilterModal(false);
    resetWizard();
  };

  const getOpLabel = (opKey: string, colType: string) => {
    const allOps = getOpsForType(colType);
    return allOps.find(o => o.key === opKey)?.label || opKey;
  };

  const getInputType = (op: string, colType: string) => {
    if (colType === 'date' || op.startsWith('date_')) return 'date';
    if (colType === 'number' || colType === 'formula') return 'number';
    return 'text';
  };

  if (!filterModal) return null;

  return (
    <div className="filter-dropdown-panel" ref={panelRef} onClick={(e) => e.stopPropagation()}>

      {/* ── Header ── */}
      <div className="fdp-header">
        <div className="fdp-title">
          <Filter size={14} />
          <span>Filter Data</span>
        </div>
        <div className="fdp-header-actions">
          {filters.length > 0 && (
            <button className="fdp-clear-btn" onClick={() => setFilters([])}>Clear All</button>
          )}
          <button className="fdp-close-btn" onClick={() => { setFilterModal(false); resetWizard(); }} aria-label="Close">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* ── Active Filters List ── */}
      {filters.length > 0 && (
        <div className="fdp-active-list">
          {filters.map((f, idx) => {
            const col = columns.find(c => c.id === f.columnId);
            const Icon = getColumnIcon(col?.type || 'text');
            return (
              <div key={idx} className="fdp-chip">
                <Icon size={12} />
                <span className="fdp-chip-col">{col?.name || 'Col'}</span>
                <span className="fdp-chip-op">{getOpLabel(f.operator, col?.type || 'text')}</span>
                {!NO_VALUE_OPS.includes(f.operator) && (
                  <span className="fdp-chip-val">"{f.value}"</span>
                )}
                {BETWEEN_OPS.includes(f.operator) && f.value2 && (
                  <span className="fdp-chip-val">to "{f.value2}"</span>
                )}
                <button className="fdp-chip-remove" onClick={() => handleRemoveFilter(idx)} aria-label="Remove filter">
                  <X size={11} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add Filter Wizard ── */}
      {!addingFilter ? (
        <button className="fdp-add-btn" onClick={() => setAddingFilter(true)}>
          <Plus size={13} /> Add Filter
        </button>
      ) : (
        <div className="fdp-wizard">
          <div className="fdp-wizard-header">
            <span>ADD FILTER</span>
            <button className="fdp-close-btn" onClick={resetWizard}><X size={13} /></button>
          </div>

          {/* Step 1: Column list */}
          <div className="fdp-col-search">
            <Search size={13} />
            <input
              placeholder="Search columns..."
              value={colSearch}
              onChange={(e) => setColSearch(e.target.value)}
              autoFocus
            />
          </div>

          <div className="fdp-col-list">
            {filteredCols.map(col => {
              const Icon = getColumnIcon(col.type);
              const isSelected = col.id === selectedColId;
              return (
                <button
                  key={col.id}
                  className={`fdp-col-item ${isSelected ? 'active' : ''}`}
                  onClick={() => { setSelectedColId(col.id); setSelectedOp(null); setVal1(''); setVal2(''); }}
                >
                  <Icon size={13} />
                  <span>{col.name}</span>
                  {isSelected && <ChevronRight size={13} className="fdp-arrow" />}
                </button>
              );
            })}
          </div>

          {/* Step 2: Condition list */}
          {selectedCol && (
            <>
              <div className="fdp-section-label">{selectedCol.name.toUpperCase()}</div>
              <div className="fdp-op-list">
                {ops.map(op => (
                  <button
                    key={op.key}
                    className={`fdp-op-item ${selectedOp === op.key ? 'active' : ''}`}
                    onClick={() => { setSelectedOp(op.key); setVal1(''); setVal2(''); }}
                  >
                    <div className={`fdp-radio ${selectedOp === op.key ? 'checked' : ''}`} />
                    <span>{op.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Step 3: Value input */}
          {selectedOp && !NO_VALUE_OPS.includes(selectedOp) && (
            <div className="fdp-value-area">
              {selectedCol?.type === 'dropdown' ? (
                <select
                  className="fdp-input"
                  value={val1}
                  onChange={(e) => setVal1(e.target.value)}
                >
                  <option value="">Select value...</option>
                  {(selectedCol.dropdownOptions || []).map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : (
                <input
                  className="fdp-input"
                  type={getInputType(selectedOp, selectedCol?.type || 'text')}
                  placeholder={BETWEEN_OPS.includes(selectedOp) ? 'From value...' : 'Enter value...'}
                  value={val1}
                  onChange={(e) => setVal1(e.target.value)}
                  autoFocus
                />
              )}
              {BETWEEN_OPS.includes(selectedOp) && (
                <input
                  className="fdp-input"
                  type={getInputType(selectedOp, selectedCol?.type || 'text')}
                  placeholder="To value..."
                  value={val2}
                  onChange={(e) => setVal2(e.target.value)}
                />
              )}
            </div>
          )}

          {/* Wizard footer */}
          <div className="fdp-wizard-actions">
            <button className="fdp-cancel-btn" onClick={resetWizard}>Cancel</button>
            <button
              className="fdp-confirm-btn"
              disabled={
                selectedColId === null ||
                !selectedOp ||
                (!NO_VALUE_OPS.includes(selectedOp) && !val1) ||
                (BETWEEN_OPS.includes(selectedOp) && !val2)
              }
              onClick={handleAddFilter}
            >
              Add
            </button>
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {filters.length === 0 && !addingFilter && (
        <div className="fdp-empty">
          <Filter size={20} />
          <p>No filters applied</p>
        </div>
      )}

      {/* ── Footer ── */}
      <div className="fdp-footer">
        <button className="fdp-cancel-btn" onClick={handleClearClose}>Clear & Close</button>
        <button className="fdp-apply-btn" onClick={handleApply}>
          Apply {filters.length > 0 && `(${filters.length})`}
        </button>
      </div>
    </div>
  );
}
