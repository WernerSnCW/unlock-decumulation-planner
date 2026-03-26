import { useState, useCallback, useRef } from 'react';
import Papa from 'papaparse';
import type { Asset } from '../engine/decumulation';
import {
  autoDetectMapping,
  validateRows,
  buildAssets,
  TARGET_FIELDS,
  VALID_ASSET_CLASSES,
  resolveAssetClass,
  type ValidatedRow,
} from '../lib/csvImportUtils';

interface Props {
  existingAssets: Asset[];
  onImport: (assets: Asset[]) => void;
  onClose: () => void;
}

type Step = 'upload' | 'map' | 'validate' | 'import';

const ASSET_CLASS_LABELS: Record<string, string> = {
  cash: 'Cash', isa: 'ISA', pension: 'Pension',
  property_investment: 'Property (Investment)', property_residential: 'Property (Residential)',
  vct: 'VCT', eis: 'EIS', aim_shares: 'AIM Shares',
};

export default function CsvImportWizard({ existingAssets, onImport, onClose }: Props) {
  const [step, setStep] = useState<Step>('upload');
  const fileRef = useRef<HTMLInputElement>(null);

  // Upload state
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [parseError, setParseError] = useState('');
  const [dragActive, setDragActive] = useState(false);

  // Map state
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importMode, setImportMode] = useState<'replace' | 'append'>('replace');

  // Validate state
  const [validatedRows, setValidatedRows] = useState<ValidatedRow[]>([]);

  /* ─── Step 1: Upload ─── */

  const handleFile = useCallback((file: File) => {
    setParseError('');
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const headers = result.meta.fields ?? [];
        const rows = result.data as Record<string, string>[];

        if (headers.length === 0 || rows.length === 0) {
          setParseError('The file appears to be empty or has no header row.');
          return;
        }

        setRawHeaders(headers);
        setRawRows(rows);
        setMapping(autoDetectMapping(headers));
        setStep('map');
      },
      error: (err) => {
        setParseError(`Parse error: ${err.message}`);
      },
    });
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  /* ─── Step 2: Map ─── */

  const setFieldMapping = (targetField: string, csvHeader: string) => {
    setMapping(prev => {
      const next = { ...prev };
      if (csvHeader === '') {
        delete next[targetField];
      } else {
        next[targetField] = csvHeader;
      }
      return next;
    });
  };

  const requiredMapped = TARGET_FIELDS
    .filter(f => f.required)
    .every(f => mapping[f.key]);

  const handleValidate = () => {
    const rows = validateRows(rawRows, mapping);
    setValidatedRows(rows);
    setStep('validate');
  };

  /* ─── Step 3: Validate ─── */

  const toggleSkip = (idx: number) => {
    setValidatedRows(prev =>
      prev.map((r, i) => i === idx ? { ...r, skip: !r.skip } : r),
    );
  };

  const overrideAssetClass = (idx: number, cls: string) => {
    setValidatedRows(prev =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        return {
          ...r,
          overrideAssetClass: cls,
          parsed: { ...r.parsed, asset_class: cls },
          errors: r.errors.filter(e => e.field !== 'asset_class'),
          skip: r.errors.filter(e => e.field !== 'asset_class').length > 0,
        };
      }),
    );
  };

  const validCount = validatedRows.filter(r => !r.skip).length;
  const errorCount = validatedRows.filter(r => r.errors.length > 0).length;
  const warnCount = validatedRows.filter(r => r.warnings.length > 0 && r.errors.length === 0).length;

  /* ─── Step 4: Import ─── */

  const handleImport = () => {
    const assets = buildAssets(validatedRows, importMode, existingAssets);
    onImport(assets);
    onClose();
  };

  const importedAssets = validatedRows.filter(r => !r.skip);
  const totalValue = importedAssets.reduce((sum, r) => sum + (r.parsed.current_value ?? 0), 0);

  /* ─── Step indicator ─── */

  const steps: { key: Step; label: string }[] = [
    { key: 'upload', label: 'Upload' },
    { key: 'map', label: 'Map Columns' },
    { key: 'validate', label: 'Validate' },
    { key: 'import', label: 'Import' },
  ];

  const stepIndex = steps.findIndex(s => s.key === step);

  /* ─── Render ─── */

  return (
    <div className="csv-overlay" onClick={onClose}>
      <div className="csv-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="csv-header">
          <h2>Import Assets from CSV</h2>
          <button className="csv-close" onClick={onClose}>&times;</button>
        </div>

        {/* Step indicator */}
        <div className="csv-steps">
          {steps.map((s, i) => (
            <div key={s.key} className={`csv-step ${i <= stepIndex ? 'active' : ''} ${i === stepIndex ? 'current' : ''}`}>
              <span className="csv-step-num">{i + 1}</span>
              <span className="csv-step-label">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="csv-body">
          {/* ── Upload ── */}
          {step === 'upload' && (
            <div
              className={`csv-dropzone ${dragActive ? 'active' : ''}`}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={onDrop}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.tsv,.txt"
                onChange={onFileChange}
                style={{ display: 'none' }}
              />
              <div className="csv-dropzone-icon">CSV</div>
              <p className="csv-dropzone-title">Drop your CSV file here</p>
              <p className="csv-dropzone-sub">or click to browse</p>
              <p className="csv-dropzone-hint">Supports .csv, .tsv, .txt files</p>
              {parseError && <p className="csv-error">{parseError}</p>}
            </div>
          )}

          {/* ── Map ── */}
          {step === 'map' && (
            <>
              {/* Preview table */}
              <div className="csv-preview-wrap">
                <p className="csv-section-title">Preview (first {Math.min(5, rawRows.length)} rows of {rawRows.length})</p>
                <div className="csv-preview-scroll">
                  <table className="csv-preview-table">
                    <thead>
                      <tr>
                        {rawHeaders.map(h => <th key={h}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {rawRows.slice(0, 5).map((row, i) => (
                        <tr key={i}>
                          {rawHeaders.map(h => <td key={h}>{row[h] ?? ''}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mapping */}
              <div className="csv-mapping">
                <p className="csv-section-title">Map columns to fields</p>
                <div className="csv-mapping-grid">
                  {TARGET_FIELDS.map(f => (
                    <div key={f.key} className={`csv-mapping-row ${f.required && !mapping[f.key] ? 'unmapped' : ''}`}>
                      <label>
                        {f.label}
                        {f.required && <span className="csv-req">*</span>}
                      </label>
                      <select
                        value={mapping[f.key] ?? ''}
                        onChange={e => setFieldMapping(f.key, e.target.value)}
                      >
                        <option value="">(unmapped)</option>
                        {rawHeaders.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Import mode */}
              <div className="csv-mode">
                <label>
                  <input
                    type="radio"
                    checked={importMode === 'replace'}
                    onChange={() => setImportMode('replace')}
                  />
                  Replace existing assets
                </label>
                <label>
                  <input
                    type="radio"
                    checked={importMode === 'append'}
                    onChange={() => setImportMode('append')}
                  />
                  Append to existing assets ({existingAssets.length})
                </label>
              </div>

              <div className="csv-actions">
                <button className="csv-btn secondary" onClick={() => setStep('upload')}>Back</button>
                <button
                  className="csv-btn primary"
                  disabled={!requiredMapped}
                  onClick={handleValidate}
                >
                  Validate {rawRows.length} rows
                </button>
              </div>
            </>
          )}

          {/* ── Validate ── */}
          {step === 'validate' && (
            <>
              <div className="csv-validate-summary">
                <span className="csv-stat ok">{validCount} valid</span>
                {warnCount > 0 && <span className="csv-stat warn">{warnCount} warnings</span>}
                {errorCount > 0 && <span className="csv-stat err">{errorCount} errors</span>}
              </div>

              <div className="csv-validate-scroll">
                <table className="csv-validate-table">
                  <thead>
                    <tr>
                      <th>Include</th>
                      <th>Row</th>
                      <th>Name</th>
                      <th>Value</th>
                      <th>Asset Class</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validatedRows.map((r, i) => {
                      const hasErr = r.errors.length > 0;
                      const hasWarn = r.warnings.length > 0;
                      return (
                        <tr key={i} className={r.skip ? 'csv-row-skip' : ''}>
                          <td>
                            <input
                              type="checkbox"
                              checked={!r.skip}
                              onChange={() => toggleSkip(i)}
                            />
                          </td>
                          <td>{r.rowIndex + 1}</td>
                          <td>{r.parsed.label ?? '—'}</td>
                          <td>{r.parsed.current_value != null
                            ? '£' + Math.round(r.parsed.current_value).toLocaleString('en-GB')
                            : '—'
                          }</td>
                          <td>
                            {r.errors.some(e => e.field === 'asset_class') ? (
                              <select
                                className="csv-fix-select"
                                value={r.overrideAssetClass ?? ''}
                                onChange={e => overrideAssetClass(i, e.target.value)}
                              >
                                <option value="">— Select —</option>
                                {VALID_ASSET_CLASSES.map(c => (
                                  <option key={c} value={c}>{ASSET_CLASS_LABELS[c] ?? c}</option>
                                ))}
                              </select>
                            ) : (
                              ASSET_CLASS_LABELS[r.parsed.asset_class ?? ''] ?? r.parsed.asset_class ?? '—'
                            )}
                          </td>
                          <td>
                            {hasErr && (
                              <span className="csv-status-err" title={r.errors.map(e => e.message).join('; ')}>
                                {r.errors.map(e => e.message).join('; ')}
                              </span>
                            )}
                            {!hasErr && hasWarn && (
                              <span className="csv-status-warn" title={r.warnings.map(e => e.message).join('; ')}>
                                {r.warnings.map(e => e.message).join('; ')}
                              </span>
                            )}
                            {!hasErr && !hasWarn && (
                              <span className="csv-status-ok">OK</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="csv-actions">
                <button className="csv-btn secondary" onClick={() => setStep('map')}>Back</button>
                <button
                  className="csv-btn primary"
                  disabled={validCount === 0}
                  onClick={() => setStep('import')}
                >
                  Continue with {validCount} assets
                </button>
              </div>
            </>
          )}

          {/* ── Import ── */}
          {step === 'import' && (
            <div className="csv-import-summary">
              <h3>Ready to import</h3>
              <div className="csv-import-stats">
                <div className="csv-import-stat">
                  <span className="csv-import-label">Assets</span>
                  <span className="csv-import-value">{validCount}</span>
                </div>
                <div className="csv-import-stat">
                  <span className="csv-import-label">Total Value</span>
                  <span className="csv-import-value">£{Math.round(totalValue).toLocaleString('en-GB')}</span>
                </div>
                <div className="csv-import-stat">
                  <span className="csv-import-label">Mode</span>
                  <span className="csv-import-value">{importMode === 'replace' ? 'Replace' : `Append to ${existingAssets.length}`}</span>
                </div>
              </div>

              <div className="csv-import-preview">
                {importedAssets.map((r, i) => (
                  <div key={i} className="csv-import-row">
                    <span className="csv-import-name">{r.parsed.label}</span>
                    <span className="csv-import-class">
                      {ASSET_CLASS_LABELS[r.overrideAssetClass ?? r.parsed.asset_class ?? ''] ?? r.parsed.asset_class}
                    </span>
                    <span className="csv-import-val">
                      £{Math.round(r.parsed.current_value ?? 0).toLocaleString('en-GB')}
                    </span>
                  </div>
                ))}
              </div>

              <div className="csv-actions">
                <button className="csv-btn secondary" onClick={() => setStep('validate')}>Back</button>
                <button className="csv-btn primary" onClick={handleImport}>
                  Confirm Import
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
