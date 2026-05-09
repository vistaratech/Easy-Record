import { evaluateFormula, type Entry, type Column } from '../../lib/api';
import { Calendar, ChevronDown, Image as ImageIcon, Mail, Phone, Globe, ListOrdered, IndianRupee, Maximize2 } from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';

// ── Highlight matching text ──
const HighlightedText = React.memo(function HighlightedText({ text, searchTerm }: { text: string; searchTerm?: string }) {
  if (!searchTerm || !text) return <>{text}</>;
  const lower = text.toLowerCase();
  const sLower = searchTerm.toLowerCase();
  const idx = lower.indexOf(sLower);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="search-highlight">{text.slice(idx, idx + searchTerm.length)}</mark>
      {text.slice(idx + searchTerm.length)}
    </>
  );
});

// Format number with Indian currency style: ₹1,23,456.00
function formatCurrency(val: string): string {
  const n = parseFloat(val);
  if (isNaN(n)) return val || '';
  const [intPart, decPart] = Math.abs(n).toFixed(2).split('.');
  // Indian grouping: last 3 digits, then every 2 digits
  let formatted = '';
  if (intPart.length <= 3) {
    formatted = intPart;
  } else {
    formatted = intPart.slice(-3);
    let remaining = intPart.slice(0, -3);
    while (remaining.length > 2) {
      formatted = remaining.slice(-2) + ',' + formatted;
      remaining = remaining.slice(0, -2);
    }
    if (remaining) formatted = remaining + ',' + formatted;
  }
  return `${n < 0 ? '-' : ''}₹${formatted}.${decPart}`;
}

// Isolated memo component so formula evaluation only runs when its inputs change
const FormulaCell = React.memo(({ idx, col, entry, registerColumns, onKeyDown }: {
  idx: number; col: Column; entry: Entry; registerColumns: Column[]; onKeyDown?: (e: React.KeyboardEvent) => void;
}) => {
  const result = evaluateFormula(col.formula || '', entry, registerColumns);
  return (
    <div
      data-cell={`cell-${idx}-${col.id}`}
      tabIndex={0}
      className="cell-formula"
      onKeyDown={onKeyDown}
    >
      {result || '–'}
    </div>
  );
});

interface SpreadsheetTextInputProps {
  idx: number;
  col: Column;
  entry: Entry;
  visibleColumns: Column[];
  colIdx: number;
  totalRows: number;
  handleCellChange: (entryId: number, columnId: string, value: string) => void;
  type?: string;
  placeholder?: string;
  searchTerm?: string;
}

// Currency cell: shows ₹ formatted display, edits as raw number
const CurrencyCell = React.memo(({ idx, col, entry, colIdx, totalRows, visibleColumns, handleCellChange, onKeyDown, readOnly }: SpreadsheetTextInputProps & { onKeyDown?: (e: React.KeyboardEvent) => void, readOnly?: boolean }) => {
  const rawValue = entry.cells?.[col.id.toString()] || '';
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(rawValue);

  useEffect(() => { setVal(rawValue); }, [rawValue]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape' || e.key === 'Enter') { 
      setEditing(false); 
      e.currentTarget.blur(); 
      return;
    }

    const focusNext = (rowI: number, cId: number | string) => {
      const el = document.getElementById(`cell-${rowI}-${cId}`) || document.querySelector(`[data-cell="cell-${rowI}-${cId}"]`) as HTMLElement;
      if (el) el.focus();
    };

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setEditing(false);
      const prevCol = visibleColumns[colIdx - 1];
      if (prevCol) {
        focusNext(idx, prevCol.id);
      } else if (idx > 0) {
        const lastCol = visibleColumns[visibleColumns.length - 1];
        if (lastCol) focusNext(idx - 1, lastCol.id);
      }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setEditing(false);
      const nextCol = visibleColumns[colIdx + 1];
      if (nextCol) {
        focusNext(idx, nextCol.id);
      } else if (idx < totalRows - 1) {
        const firstCol = visibleColumns[0];
        if (firstCol) focusNext(idx + 1, firstCol.id);
      }
    } else if (e.key === 'ArrowUp') {
      if (idx > 0) {
        e.preventDefault();
        setEditing(false);
        focusNext(idx - 1, col.id);
      }
    } else if (e.key === 'ArrowDown') {
      if (idx < totalRows - 1) {
        e.preventDefault();
        setEditing(false);
        focusNext(idx + 1, col.id);
      }
    }
  }, [idx, col.id, visibleColumns, colIdx, totalRows]);

  if (editing) {
    return (
      <input
        id={`cell-${idx}-${col.id}`}
        className="cell-input currency-editing"
        type="text"
        inputMode="decimal"
        value={val}
        autoFocus
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (val !== rawValue) {
            handleCellChange(entry.id, col.id.toString(), val);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === 'Tab') {
            if (val !== rawValue) {
              handleCellChange(entry.id, col.id.toString(), val);
            }
          }
          handleKeyDown(e);
        }}
        placeholder="0.00"
      />
    );
  }

  return (
    <div
      data-cell={`cell-${idx}-${col.id}`}
      tabIndex={readOnly ? -1 : 0}
      className={`cell-currency ${readOnly ? 'readonly' : ''}`}
      onClick={() => !readOnly && setEditing(true)}
      onFocus={() => !readOnly && setEditing(true)}
      onKeyDown={onKeyDown}
      title={readOnly ? undefined : "Click to edit"}
    >
      {rawValue ? formatCurrency(rawValue) : <span className="cell-placeholder"><IndianRupee size={11} /> {readOnly ? '–' : 'Amount'}</span>}
    </div>
  );
});

const SpreadsheetTextInput = React.memo(({ idx, col, entry, visibleColumns, colIdx, totalRows, handleCellChange, type = 'text', placeholder, searchTerm, readOnly }: SpreadsheetTextInputProps & { readOnly?: boolean }) => {
  let initialValue = entry.cells?.[col.id.toString()] || '';
  if (col.type === 'date' && initialValue.includes('/')) {
    initialValue = initialValue.replace(/\//g, '-');
  }
  const [val, setVal] = useState(initialValue);

  // Sync if the entry is replaced (e.g., after add-row optimistic swap)
  useEffect(() => {
    setVal(initialValue);
  }, [initialValue]);

  const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setVal(e.target.value);
  }, []);

  const onBlur = useCallback(() => {
    if (val !== (entry.cells?.[col.id.toString()] || '')) {
      handleCellChange(entry.id, col.id.toString(), val);
    }
  }, [val, entry, col.id, handleCellChange]);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.currentTarget.blur();
      return;
    }

    const focusNext = (rowI: number, cId: number | string) => {
      const el = document.getElementById(`cell-${rowI}-${cId}`) || document.querySelector(`[data-cell="cell-${rowI}-${cId}"]`) as HTMLElement;
      if (el) el.focus();
    };

    if (e.key === 'Tab' || e.key === 'Enter') {
      e.preventDefault();
      if (val !== (entry.cells?.[col.id.toString()] || '')) {
        handleCellChange(entry.id, col.id.toString(), val);
      }
      if (e.shiftKey) {
        // Shift+Enter/Tab: Move left, wrap to previous row
        const prevCol = visibleColumns[colIdx - 1];
        if (prevCol) {
          focusNext(idx, prevCol.id);
        } else if (idx > 0) {
          const lastCol = visibleColumns[visibleColumns.length - 1];
          if (lastCol) focusNext(idx - 1, lastCol.id);
        }
      } else {
        // Enter/Tab: Move right, wrap to next row
        const nextCol = visibleColumns[colIdx + 1];
        if (nextCol) {
          focusNext(idx, nextCol.id);
        } else {
          const firstCol = visibleColumns[0];
          if (firstCol) focusNext(idx + 1, firstCol.id);
        }
      }
    } else if (e.key === 'ArrowDown') {
      if (idx < totalRows - 1) {
        e.preventDefault();
        focusNext(idx + 1, col.id);
      }
    } else if (e.key === 'ArrowUp') {
      if (idx > 0) {
        e.preventDefault();
        focusNext(idx - 1, col.id);
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prevCol = visibleColumns[colIdx - 1];
      if (prevCol) {
        focusNext(idx, prevCol.id);
      } else if (idx > 0) {
        const lastCol = visibleColumns[visibleColumns.length - 1];
        if (lastCol) focusNext(idx - 1, lastCol.id);
      }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      const nextCol = visibleColumns[colIdx + 1];
      if (nextCol) {
        focusNext(idx, nextCol.id);
      } else if (idx < totalRows - 1) {
        const firstCol = visibleColumns[0];
        if (firstCol) focusNext(idx + 1, firstCol.id);
      }
    }
  }, [idx, col.id, visibleColumns, colIdx, totalRows]);


  const [focused, setFocused] = useState(false);
  const hasHighlight = !!searchTerm && !!val && val.toLowerCase().includes(searchTerm.toLowerCase());

  const handleFocus = useCallback(() => setFocused(true), []);
  const handleBlurWrap = useCallback(() => {
    setFocused(false);
    onBlur();
  }, [onBlur]);

  // Show highlighted overlay when search matches and not focused
  if (hasHighlight && !focused) {
    return (
      <div
        id={`cell-${idx}-${col.id}`}
        data-cell={`cell-${idx}-${col.id}`}
        className={`cell-input cell-input-highlight-wrap ${readOnly ? 'readonly' : ''}`}
        tabIndex={readOnly ? -1 : 0}
        onFocus={readOnly ? undefined : handleFocus}
        onKeyDown={onKeyDown}
        style={{ cursor: readOnly ? 'default' : 'text' }}
      >
        <HighlightedText text={val} searchTerm={searchTerm} />
      </div>
    );
  }

  if (readOnly) {
    return (
      <div
        id={`cell-${idx}-${col.id}`}
        data-cell={`cell-${idx}-${col.id}`}
        className="cell-input readonly"
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <HighlightedText text={val} searchTerm={searchTerm} />
      </div>
    );
  }

  return (
    <input
      id={`cell-${idx}-${col.id}`}
      className="cell-input"
      value={val}
      onChange={onChange}
      onBlur={handleBlurWrap}
      onFocus={handleFocus}
      onKeyDown={onKeyDown}
      type={type}
      placeholder={placeholder}
      inputMode={col.type === 'number' ? 'decimal' : undefined}
      autoComplete="off"
    />
  );
});

interface SpreadsheetRowProps {
  entry: Entry;
  idx: number;
  visibleColumns: Column[];
  /** The virtual columns from TanStack Virtual */
  virtualCols?: any[];
  /** Horizontal left padding (px) to represent off-screen columns left of viewport */
  paddingLeft?: number;
  /** Horizontal right padding (px) to represent off-screen columns right of viewport */
  paddingRight?: number;
  /** Fixed row height for virtualized stability */
  rowHeight?: number;
  isSelected: boolean;
  toggleSelectRow: (id: number) => void;
  totalRows: number;
  handleCellChange: (entryId: number, columnId: string, value: string) => void;
  openDatePicker: (entryId: number, colId: number, currentVal: string, rect?: DOMRect) => void;
  openDropdown: (entryId: number, colId: number, options: string[], rect?: DOMRect) => void;
  isMenuOpen: boolean;
  toggleMenu: (id: number) => void;
  registerColumns: Column[];
  onRowDetail?: (entry: Entry) => void;
  onImagePreview?: (data: { url: string; entryId: number; colId: string }) => void;
  frozenColumns?: Set<number>;
  frozenLeftOffsets?: Record<number, number>;
  colWidths?: Record<number, number>;
  defaultColWidth?: number;
  onCellFormatClick?: (entryId: number, colId: string, rect: DOMRect) => void;
  searchTerm?: string;
  permissions?: { canView: boolean; canEdit: boolean; canDownload: boolean };
}

export const SpreadsheetRow = React.memo(function SpreadsheetRow(props: SpreadsheetRowProps) {
  const {
    entry,
    idx,
    visibleColumns,
    virtualCols,
    paddingLeft = 0,
    paddingRight = 0,
    rowHeight,
    totalRows,
    handleCellChange,
    openDatePicker,
    openDropdown,
    isMenuOpen,
    toggleMenu,
    registerColumns,
    onRowDetail,
    onImagePreview,
    frozenColumns,
    frozenLeftOffsets,
    colWidths,
    defaultColWidth = 150,
    onCellFormatClick,
    searchTerm,
    permissions,
  } = props;
  const canEdit = permissions?.canEdit ?? true;
  // Columns to actually render — either the virtual items or all visible columns
  const colItems = virtualCols ?? visibleColumns.map((_, i) => ({ index: i }));


  const handleCellKeyDown = useCallback((e: React.KeyboardEvent, colId: number | string, colIdx: number) => {
    if (e.key === 'Escape') {
      if (e.currentTarget instanceof HTMLElement) e.currentTarget.blur();
      return;
    }

    const focusNext = (rowI: number, cId: number | string) => {
      const el = document.getElementById(`cell-${rowI}-${cId}`) || document.querySelector(`[data-cell="cell-${rowI}-${cId}"]`) as HTMLElement;
      if (el) el.focus();
    };

    if (e.key === 'Tab' || e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        const prevCol = visibleColumns[colIdx - 1];
        if (prevCol) {
          focusNext(idx, prevCol.id);
        } else if (idx > 0) {
          const lastCol = visibleColumns[visibleColumns.length - 1];
          if (lastCol) focusNext(idx - 1, lastCol.id);
        }
      } else {
        const nextCol = visibleColumns[colIdx + 1];
        if (nextCol) {
          focusNext(idx, nextCol.id);
        } else {
          const firstCol = visibleColumns[0];
          if (firstCol) focusNext(idx + 1, firstCol.id);
        }
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusNext(idx + 1, colId);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusNext(idx - 1, colId);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prevCol = visibleColumns[colIdx - 1];
      if (prevCol) {
        focusNext(idx, prevCol.id);
      } else if (idx > 0) {
        const lastCol = visibleColumns[visibleColumns.length - 1];
        if (lastCol) focusNext(idx - 1, lastCol.id);
      }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      const nextCol = visibleColumns[colIdx + 1];
      if (nextCol) {
        focusNext(idx, nextCol.id);
      } else if (idx < totalRows - 1) {
        const firstCol = visibleColumns[0];
        if (firstCol) focusNext(idx + 1, firstCol.id);
      }
    }
  }, [idx, visibleColumns, totalRows]);

  const handleSerialClick = useCallback(() => {
    onRowDetail?.(entry);
  }, [entry, onRowDetail]);
  return (
    <tr id={`row-${entry.id}`} data-entry-id={entry.id} style={rowHeight ? { height: rowHeight, maxHeight: rowHeight } : undefined}>
      <td className="serial" style={{ cursor: 'pointer' }} onClick={handleSerialClick} title="Click to view details">{idx + 1}</td>
      {/* Left padding cell for column virtualization */}
      {paddingLeft > 0 && <td key="pad-left" className="spacer" style={{ width: paddingLeft, minWidth: paddingLeft, padding: 0, border: 'none' }} />}
      {colItems.map((vc) => {
        const col = visibleColumns[vc.index];
        if (!col) return null;
        
        const colIdx = vc.index; // Absolute index for navigation
        const isFrozen = frozenColumns?.has(col.id);
        const w = colWidths?.[col.id] || defaultColWidth;
        const cs = entry.cellStyles?.[col.id.toString()];
        let cellStyle: React.CSSProperties = { width: w, minWidth: w, maxWidth: w };
        
        // Apply user-defined cell formatting
        if (cs?.bgColor) cellStyle.background = cs.bgColor;
        if (cs?.textColor) cellStyle.color = cs.textColor;
        if (cs?.textAlign) cellStyle.textAlign = cs.textAlign;
        
        if (isFrozen) {
          const left = frozenLeftOffsets?.[col.id] || 50;
          cellStyle = { ...cellStyle, position: 'sticky', left, zIndex: 5, background: cs?.bgColor || 'var(--table-bg)' };
        }
        
        const handleContextMenu = (e: React.MouseEvent) => {
          e.preventDefault();
          if (onCellFormatClick) {
            onCellFormatClick(entry.id, col.id.toString(), (e.currentTarget as HTMLElement).getBoundingClientRect());
          }
        };
        
        return (
        <td key={col.id} className={isFrozen ? 'frozen-col' : ''} style={cellStyle} onContextMenu={handleContextMenu}>
          <div className="cell-inner-wrapper" style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flex: 1 }}>
          {col.type === 'formula' ? (
            <FormulaCell idx={idx} col={col} entry={entry} registerColumns={registerColumns} onKeyDown={(e) => handleCellKeyDown(e, col.id, colIdx)} />
          ) : col.type === 'date' ? (
            <div className={`cell-url-wrap ${!canEdit ? 'readonly' : ''}`}>
              <SpreadsheetTextInput 
                idx={idx} col={col} entry={entry} visibleColumns={visibleColumns} colIdx={colIdx} totalRows={totalRows} handleCellChange={handleCellChange}
                placeholder="DD-MM-YYYY" searchTerm={searchTerm} readOnly={!canEdit}
              />
              {canEdit && (
                <button 
                  className="cell-url-link" 
                  style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                  onClick={(e) => openDatePicker(entry.id, col.id, entry.cells?.[col.id.toString()] || '', e.currentTarget.getBoundingClientRect())}
                  tabIndex={-1}
                >
                  <Calendar size={12} />
                </button>
              )}
            </div>
          ) : col.type === 'dropdown' ? (
            <div 
              data-cell={`cell-${idx}-${col.id}`} 
              tabIndex={canEdit ? 0 : -1} 
              className={`cell-dropdown ${!canEdit ? 'readonly' : ''}`} 
              onClick={(e) => {
                if (!canEdit) return;
                openDropdown(entry.id, col.id, col.dropdownOptions || ['Option 1', 'Option 2', 'Option 3'], e.currentTarget.getBoundingClientRect());
              }} 
              onKeyDown={(e) => { 
                if (!canEdit) return;
                if (e.key === ' ' || (e.key === 'Enter' && e.ctrlKey)) { 
                  e.preventDefault(); 
                  openDropdown(entry.id, col.id, col.dropdownOptions || ['Option 1', 'Option 2', 'Option 3'], e.currentTarget.getBoundingClientRect()); 
                } else handleCellKeyDown(e, col.id, colIdx); 
              }}
            >
              {entry.cells?.[col.id.toString()] ? <HighlightedText text={entry.cells[col.id.toString()]} searchTerm={searchTerm} /> : <span className="cell-placeholder">{canEdit && <ChevronDown size={12} />} {canEdit ? 'Select' : '–'}</span>}
            </div>
          ) : col.type === 'checkbox' ? (
            <div className="cell-checkbox-wrap">
              <input
                id={`cell-${idx}-${col.id}`}
                type="checkbox"
                className="cell-checkbox"
                checked={entry.cells?.[col.id.toString()] === 'true'}
                disabled={!canEdit}
                onChange={(e) => {
                  if (!canEdit) return;
                  handleCellChange(entry.id, col.id.toString(), e.target.checked ? 'true' : 'false');
                }}
                onKeyDown={(e) => { if (e.key !== ' ') handleCellKeyDown(e, col.id, colIdx); }}
                title={col.name}
              />
            </div>
          ) : col.type === 'rating' ? (
            <div data-cell={`cell-${idx}-${col.id}`} tabIndex={canEdit ? 0 : -1} className={`cell-rating ${!canEdit ? 'readonly' : ''}`} onKeyDown={(e) => { if (canEdit) handleCellKeyDown(e, col.id, colIdx); }}>
              {[1, 2, 3, 4, 5].map(star => (
                <button 
                  key={star} 
                  className={`star-btn ${(parseInt(entry.cells?.[col.id.toString()] || '0') >= star) ? 'active' : ''}`} 
                  onClick={() => canEdit && handleCellChange(entry.id, col.id.toString(), star.toString())} 
                  title={canEdit ? `Rate ${star}` : undefined} 
                  tabIndex={-1}
                  disabled={!canEdit}
                >★</button>
              ))}
            </div>
          ) : col.type === 'image' ? (
            <div 
              data-cell={`cell-${idx}-${col.id}`} 
              tabIndex={0} 
              className={`cell-image-wrap ${!canEdit ? 'readonly' : ''}`} 
              onKeyDown={(e) => handleCellKeyDown(e, col.id, colIdx)}
              onClick={() => {
                const val = entry.cells?.[col.id.toString()];
                if (val) onImagePreview?.({ url: val, entryId: entry.id, colId: col.id.toString() });
              }}
              title={entry.cells?.[col.id.toString()] ? "Click to view full image" : "No image"}
            >
              {entry.cells?.[col.id.toString()] ? (
                <div className="cell-image-inner">
                  <img 
                    src={entry.cells[col.id.toString()]} 
                    alt="img" 
                    className="cell-image-thumb" 
                  />
                  <div className="cell-image-overlay">
                    <Maximize2 size={12} />
                  </div>
                </div>
              ) : (
                canEdit && (
                  <label className="cell-image-upload" title="Upload image" onClick={(e) => e.stopPropagation()}>
                    <ImageIcon size={11} /> Add
                    <input type="file" accept="image/*" className="hidden-file-input" tabIndex={-1} onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = (ev) => handleCellChange(entry.id, col.id.toString(), ev.target?.result as string); r.readAsDataURL(f); }} />
                  </label>
                )
              )}
            </div>
          ) : col.type === 'email' ? (
            <div className={`cell-url-wrap ${!canEdit ? 'readonly' : ''}`}>
              <SpreadsheetTextInput idx={idx} col={col} entry={entry} visibleColumns={visibleColumns} colIdx={colIdx} totalRows={totalRows} handleCellChange={handleCellChange} type="email" placeholder="name@example.com" searchTerm={searchTerm} readOnly={!canEdit} />
              {entry.cells?.[col.id.toString()] && <a href={`mailto:${entry.cells[col.id.toString()]}`} className="cell-url-link" title="Send email" tabIndex={-1}><Mail size={11} /></a>}
            </div>
          ) : col.type === 'phone' ? (
            <div className={`cell-url-wrap ${!canEdit ? 'readonly' : ''}`}>
              <SpreadsheetTextInput idx={idx} col={col} entry={entry} visibleColumns={visibleColumns} colIdx={colIdx} totalRows={totalRows} handleCellChange={handleCellChange} type="tel" placeholder="+91 98765 43210" searchTerm={searchTerm} readOnly={!canEdit} />
              {entry.cells?.[col.id.toString()] && <a href={`tel:${entry.cells[col.id.toString()]}`} className="cell-url-link" title="Call" tabIndex={-1}><Phone size={11} /></a>}
            </div>
          ) : col.type === 'url' ? (
            <div className={`cell-url-wrap ${!canEdit ? 'readonly' : ''}`}>
              <SpreadsheetTextInput idx={idx} col={col} entry={entry} visibleColumns={visibleColumns} colIdx={colIdx} totalRows={totalRows} handleCellChange={handleCellChange} type="url" placeholder="https://..." searchTerm={searchTerm} readOnly={!canEdit} />
              {entry.cells?.[col.id.toString()] && <a href={entry.cells[col.id.toString()]} target="_blank" rel="noreferrer" className="cell-url-link" title="Open" tabIndex={-1}><Globe size={11} /></a>}
            </div>
          ) : col.type === 'auto_increment' ? (
            <div 
              data-cell={`cell-${idx}-${col.id}`} 
              className="cell-auto-increment-readonly" 
              tabIndex={0} 
              title="Auto-generated ID (Read-only)" 
              onKeyDown={(e) => handleCellKeyDown(e, col.id, colIdx)}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px', 
                padding: '0 8px', 
                color: '#64748b', 
                background: 'var(--table-bg)',
                height: '100%',
                fontSize: '12px',
                fontWeight: 500
              }}
            >
              <ListOrdered size={12} style={{ opacity: 0.6 }} />
              <span><HighlightedText text={entry.cells?.[col.id.toString()] || '–'} searchTerm={searchTerm} /></span>
            </div>
          ) : col.type === 'currency' ? (
            <CurrencyCell idx={idx} col={col} entry={entry} colIdx={colIdx} handleCellChange={handleCellChange} visibleColumns={visibleColumns} totalRows={totalRows} readOnly={!canEdit} />
          ) : (
            <SpreadsheetTextInput 
              idx={idx}
              col={col}
              entry={entry}
              visibleColumns={visibleColumns}
              colIdx={colIdx}
              totalRows={totalRows}
              handleCellChange={handleCellChange}
              searchTerm={searchTerm}
              readOnly={!canEdit}
            />
          )}
          {canEdit && col.type !== 'formula' && col.type !== 'auto_increment' && (
            <div 
              className="fill-handle" 
              data-row-idx={idx} 
              data-col-id={col.id} 
              data-entry-id={entry.id} 
            />
          )}
          </div>
        </td>
        );
      })}
      {/* Right padding cell for column virtualization */}
      {paddingRight > 0 && <td key="pad-right" className="spacer" style={{ width: paddingRight, minWidth: paddingRight, padding: 0, border: 'none' }} />}
      <td className="actions" style={{ width: '50px', minWidth: '50px', position: 'sticky', right: 0, zIndex: 1, background: 'var(--table-bg)', borderLeft: '1px solid var(--border-v)' }}>
        <button
          className={`row-menu-btn ${isMenuOpen ? 'menu-open' : ''}`}
          aria-label="Row Options"
          title="Row Options"
          onClick={() => toggleMenu(entry.id)}
        >
          <span style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '-1px', lineHeight: 1 }}>⋮</span>
        </button>
      </td>
    </tr>
  );
});
