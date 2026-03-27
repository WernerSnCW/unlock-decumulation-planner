import { useState, useCallback, useRef } from 'react';
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
import { parseFile, type ParseResult } from '../lib/fileParser';

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
  const [parseWarning, setParseWarning] = useState('');
  const [fileFormat, setFileFormat] = useState<string>('');
  const [pdfRawText, setPdfRawText] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);
  const [isParsing, setIsParsing] = useState(false);

  // Map state
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importMode, setImportMode] = useState<'replace' | 'append'>('replace');

  // Validate state
  const [validatedRows, setValidatedRows] = useState<ValidatedRow[]>([]);

  /* ─── Step 1: Upload ─── */

  const handleFile = useCallback(async (file: File) => {
    setParseError('');
    setParseWarning('');
    setPdfRawText('');
    setIsParsing(true);

    const result = await parseFile(file);
    setIsParsing(false);
    setFileFormat(result.format);

    if (!result.success) {
      setParseError(result.error ?? 'Could not parse the file.');
      if (result.rawText) setPdfRawText(result.rawText);
      return;
    }

    if (result.warning) setParseWarning(result.warning);
    if (result.rawText) setPdfRawText(result.rawText);

    setRawHeaders(result.headers);
    setRawRows(result.rows);
    setMapping(autoDetectMapping(result.headers));
    setStep('map');
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

  /* ─── Template download ─── */

  const downloadTemplate = () => {
    const headers = TARGET_FIELDS.map(f => f.key);
    const exampleRow = [
      'NatWest Current Account',  // label
      '50000',                     // current_value
      'cash',                      // asset_class
      'unwrapped',                 // wrapper_type
      '0.045',                     // assumed_growth_rate
      '2250',                      // income_generated
      '50000',                     // acquisition_cost
      '2020-01-15',                // acquisition_date
      '0',                         // mortgage_balance
      '0',                         // reinvested_pct
      'cash-001',                  // asset_id
      'false',                     // is_iht_exempt
      '',                          // pension_type
      '0',                         // tax_relief_claimed
      '',                          // original_subscription_amount
      'none',                      // relief_claimed_type
      '0',                         // estimated_disposal_cost_pct
      'none',                      // disposal_type
      '',                          // transfer_year
    ];
    const csv = [headers.join(','), exampleRow.join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'unlock_asset_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const [showFieldGuide, setShowFieldGuide] = useState(false);

  const FIELD_GUIDE: { key: string; label: string; required: boolean; impact: 'critical' | 'high' | 'medium' | 'low'; description: string; example: string }[] = [
    { key: 'label', label: 'Asset Name', required: true, impact: 'critical', description: 'Identifies the asset throughout the tool', example: 'ISA — Vanguard' },
    { key: 'current_value', label: 'Current Value', required: true, impact: 'critical', description: 'Market value today — drives all projections', example: '250000' },
    { key: 'asset_class', label: 'Asset Class', required: true, impact: 'critical', description: 'Determines tax treatment, drawdown priority, and IHT rules', example: 'isa, pension, cash, vct, eis, property_investment, property_residential, aim_shares' },
    { key: 'wrapper_type', label: 'Wrapper Type', required: false, impact: 'high', description: 'Tax wrapper — affects income tax and CGT treatment. Auto-inferred from asset class if missing', example: 'unwrapped, isa, pension' },
    { key: 'assumed_growth_rate', label: 'Growth Rate', required: false, impact: 'high', description: 'Annual capital growth rate (decimal or %). Template default used if missing', example: '0.06 or 6%' },
    { key: 'income_generated', label: 'Annual Income', required: false, impact: 'high', description: 'Dividends, rent, or interest generated per year — feeds into tax calculations', example: '12000' },
    { key: 'acquisition_cost', label: 'Acquisition Cost', required: false, impact: 'high', description: 'Original purchase price — used to calculate capital gains on disposal', example: '180000' },
    { key: 'is_iht_exempt', label: 'IHT Exempt', required: false, impact: 'high', description: 'Whether the asset qualifies for BPR (Business Property Relief). Critical for EIS, AIM', example: 'true or false' },
    { key: 'pension_type', label: 'Pension Type', required: false, impact: 'medium', description: 'SIPP, DB, or SSAS — controls drawdown rules and tax-free lump sum', example: 'sipp' },
    { key: 'tax_relief_claimed', label: 'Tax Relief Claimed', required: false, impact: 'medium', description: 'Amount of income tax or CGT relief already received (EIS/VCT)', example: '12000' },
    { key: 'original_subscription_amount', label: 'Original Subscription', required: false, impact: 'medium', description: 'Amount originally invested in EIS/VCT — used for relief calculations', example: '40000' },
    { key: 'relief_claimed_type', label: 'Relief Type', required: false, impact: 'medium', description: 'Type of relief claimed: income_tax_relief, cgt_deferral, both, or none', example: 'income_tax_relief' },
    { key: 'estimated_disposal_cost_pct', label: 'Disposal Cost %', required: false, impact: 'medium', description: 'Percentage deducted on sale (e.g. agent fees for property)', example: '0.025' },
    { key: 'acquisition_date', label: 'Acquisition Date', required: false, impact: 'low', description: 'Date purchased — used for BPR qualifying period checks', example: '2020-01-15' },
    { key: 'mortgage_balance', label: 'Mortgage Balance', required: false, impact: 'low', description: 'Outstanding mortgage on property — reduces net estate value', example: '120000' },
    { key: 'reinvested_pct', label: 'Reinvested %', required: false, impact: 'low', description: 'Percentage of income reinvested back into the asset (0-100)', example: '50' },
  ];

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
          <h2>Import Assets</h2>
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
            <>
              <div
                className={`csv-dropzone ${dragActive ? 'active' : ''} ${isParsing ? 'parsing' : ''}`}
                onClick={() => !isParsing && fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={onDrop}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.tsv,.txt,.xlsx,.xls,.xlsm,.pdf"
                  onChange={onFileChange}
                  style={{ display: 'none' }}
                />
                {isParsing ? (
                  <>
                    <div className="csv-dropzone-icon parsing-icon">...</div>
                    <p className="csv-dropzone-title">Processing file...</p>
                    <p className="csv-dropzone-sub">Extracting asset data</p>
                  </>
                ) : (
                  <>
                    <div className="csv-dropzone-icon">
                      <span style={{ fontSize: '14px' }}>CSV / XLSX / PDF</span>
                    </div>
                    <p className="csv-dropzone-title">Drop your file here</p>
                    <p className="csv-dropzone-sub">or click to browse</p>
                    <p className="csv-dropzone-hint">
                      Supports CSV, Excel (.xlsx/.xls), and PDF files. Columns are auto-matched.
                    </p>
                  </>
                )}
                {parseError && (
                  <div className="csv-error-block">
                    <p className="csv-error">{parseError}</p>
                    {pdfRawText && (
                      <details className="csv-raw-text-details">
                        <summary>Show extracted text</summary>
                        <pre className="csv-raw-text">{pdfRawText.slice(0, 2000)}{pdfRawText.length > 2000 ? '\n...(truncated)' : ''}</pre>
                      </details>
                    )}
                  </div>
                )}
                {parseWarning && !parseError && (
                  <p className="csv-warning">{parseWarning}</p>
                )}
              </div>

              <div className="csv-upload-actions">
                <button className="csv-btn secondary" onClick={downloadTemplate}>
                  Download Template CSV
                </button>
                <button
                  className="csv-btn secondary"
                  onClick={() => setShowFieldGuide(!showFieldGuide)}
                >
                  {showFieldGuide ? 'Hide' : 'Show'} Field Guide
                </button>
              </div>

              {showFieldGuide && (
                <div className="csv-field-guide">
                  <p className="csv-section-title">Field Guide — what each column does</p>
                  <p className="csv-field-guide-intro">
                    Only <strong>Asset Name</strong>, <strong>Current Value</strong>, and <strong>Asset Class</strong> are required.
                    The more fields you provide, the more accurate the simulation will be.
                  </p>
                  <table className="csv-field-guide-table">
                    <thead>
                      <tr>
                        <th>Field</th>
                        <th>Impact</th>
                        <th>Description</th>
                        <th>Example</th>
                      </tr>
                    </thead>
                    <tbody>
                      {FIELD_GUIDE.map(f => (
                        <tr key={f.key} className={f.required ? 'csv-field-required' : ''}>
                          <td>
                            <span className="csv-field-name">{f.label}</span>
                            {f.required && <span className="csv-req">*</span>}
                          </td>
                          <td>
                            <span className={`csv-impact csv-impact-${f.impact}`}>
                              {f.impact}
                            </span>
                          </td>
                          <td className="csv-field-desc">{f.description}</td>
                          <td><code>{f.example}</code></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* ── Map ── */}
          {step === 'map' && (
            <>
              {parseWarning && (
                <div className="csv-warning-banner">{parseWarning}</div>
              )}
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
