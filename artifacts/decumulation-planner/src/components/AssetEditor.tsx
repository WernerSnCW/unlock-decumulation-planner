import { useState } from 'react';
import type { Asset } from '../engine/decumulation';
import { getFieldGap } from '../lib/completenessChecks';

interface AssetEditorProps {
  assets: Asset[];
  defaults: Asset[];
  onChange: (assets: Asset[]) => void;
  onClose: () => void;
}

const ASSET_CLASS_LABELS: Record<string, string> = {
  cash: 'Cash', isa: 'ISA', pension: 'Pension',
  property_investment: 'Property (Inv)', property_residential: 'Property (Res)',
  vct: 'VCT', eis: 'EIS', aim_shares: 'AIM',
};

const ASSET_CLASSES = ['cash', 'isa', 'pension', 'property_investment', 'property_residential', 'vct', 'eis', 'aim_shares'];

const WRAPPER_TYPES = ['unwrapped', 'isa', 'pension'];

const RELIEF_TYPES = ['none', 'income_tax_relief', 'cgt_deferral', 'both'];

const PENSION_TYPES = ['sipp', 'ssas', 'db'];

interface AssetTemplate {
  asset_class: string;
  wrapper_type: string;
  assumed_growth_rate: number;
  is_iht_exempt: boolean;
  pension_type: string | null;
  relief_claimed_type: string;
  estimated_disposal_cost_pct: number;
}

const TEMPLATES: Record<string, AssetTemplate> = {
  cash:                 { asset_class: 'cash', wrapper_type: 'unwrapped', assumed_growth_rate: 0.045, is_iht_exempt: false, pension_type: null, relief_claimed_type: 'none', estimated_disposal_cost_pct: 0 },
  isa:                  { asset_class: 'isa', wrapper_type: 'isa', assumed_growth_rate: 0.06, is_iht_exempt: false, pension_type: null, relief_claimed_type: 'none', estimated_disposal_cost_pct: 0 },
  pension:              { asset_class: 'pension', wrapper_type: 'pension', assumed_growth_rate: 0.055, is_iht_exempt: false, pension_type: 'sipp', relief_claimed_type: 'none', estimated_disposal_cost_pct: 0 },
  property_investment:  { asset_class: 'property_investment', wrapper_type: 'unwrapped', assumed_growth_rate: 0.03, is_iht_exempt: false, pension_type: null, relief_claimed_type: 'none', estimated_disposal_cost_pct: 0.025 },
  property_residential: { asset_class: 'property_residential', wrapper_type: 'unwrapped', assumed_growth_rate: 0.03, is_iht_exempt: false, pension_type: null, relief_claimed_type: 'none', estimated_disposal_cost_pct: 0.025 },
  vct:                  { asset_class: 'vct', wrapper_type: 'unwrapped', assumed_growth_rate: 0.07, is_iht_exempt: false, pension_type: null, relief_claimed_type: 'income_tax_relief', estimated_disposal_cost_pct: 0 },
  eis:                  { asset_class: 'eis', wrapper_type: 'unwrapped', assumed_growth_rate: 0.12, is_iht_exempt: true, pension_type: null, relief_claimed_type: 'both', estimated_disposal_cost_pct: 0 },
  aim_shares:           { asset_class: 'aim_shares', wrapper_type: 'unwrapped', assumed_growth_rate: 0.065, is_iht_exempt: true, pension_type: null, relief_claimed_type: 'none', estimated_disposal_cost_pct: 0.01 },
};

function createNewAsset(templateKey: string, label: string): Asset {
  const t = TEMPLATES[templateKey];
  return {
    asset_id: `${t.asset_class}-${Date.now()}`,
    wrapper_type: t.wrapper_type,
    asset_class: t.asset_class,
    label: label || `New ${ASSET_CLASS_LABELS[t.asset_class] ?? t.asset_class}`,
    current_value: 0,
    acquisition_date: null,
    acquisition_cost: null,
    original_subscription_amount: null,
    tax_relief_claimed: 0,
    assumed_growth_rate: t.assumed_growth_rate,
    income_generated: 0,
    reinvested_pct: 0,
    is_iht_exempt: t.is_iht_exempt,
    bpr_qualifying_date: null,
    bpr_last_reviewed: null,
    cgt_exempt_date: null,
    mortgage_balance: 0,
    pension_type: t.pension_type,
    tfls_used_amount: 0,
    mpaa_triggered: false,
    in_drawdown: false,
    flexible_isa: false,
    deferred_gain_amount: null,
    relief_claimed_type: t.relief_claimed_type,
    allowable_improvement_costs: 0,
    estimated_disposal_cost_pct: t.estimated_disposal_cost_pct,
    estimated_disposal_cost_amount: null,
    disposal_type: 'none',
    transfer_year: null,
  };
}

/* ─── Column definitions ─── */

interface Column {
  key: string;
  label: string;
  group: string;
  width: number;
  type: 'text' | 'currency' | 'pct' | 'pct_decimal' | 'select' | 'checkbox' | 'date' | 'number';
  options?: { value: string; label: string }[];
  field: keyof Asset;
  showFor?: (a: Asset) => boolean;
  hint?: string;
}

const COLUMNS: Column[] = [
  // Core
  { key: 'label', label: 'Name', group: 'Core', width: 180, type: 'text', field: 'label' },
  { key: 'asset_class', label: 'Class', group: 'Core', width: 120, type: 'select', field: 'asset_class',
    options: ASSET_CLASSES.map(c => ({ value: c, label: ASSET_CLASS_LABELS[c] ?? c })) },
  { key: 'current_value', label: 'Value (£)', group: 'Core', width: 110, type: 'currency', field: 'current_value' },
  { key: 'assumed_growth_rate', label: 'Growth %', group: 'Core', width: 80, type: 'pct_decimal', field: 'assumed_growth_rate' },
  { key: 'income_generated', label: 'Income (£)', group: 'Core', width: 100, type: 'currency', field: 'income_generated' },
  { key: 'wrapper_type', label: 'Wrapper', group: 'Core', width: 100, type: 'select', field: 'wrapper_type',
    options: WRAPPER_TYPES.map(w => ({ value: w, label: w.charAt(0).toUpperCase() + w.slice(1) })) },
  { key: 'reinvested_pct', label: 'Reinvest %', group: 'Core', width: 80, type: 'pct', field: 'reinvested_pct' },

  // Acquisition & CGT
  { key: 'acquisition_cost', label: 'Cost (£)', group: 'CGT', width: 100, type: 'currency', field: 'acquisition_cost', hint: 'Purchase price for CGT' },
  { key: 'acquisition_date', label: 'Acq. Date', group: 'CGT', width: 120, type: 'date', field: 'acquisition_date' },
  { key: 'estimated_disposal_cost_pct', label: 'Disp. Cost %', group: 'CGT', width: 90, type: 'pct_decimal', field: 'estimated_disposal_cost_pct' },

  // IHT
  { key: 'is_iht_exempt', label: 'IHT Exempt', group: 'IHT', width: 80, type: 'checkbox', field: 'is_iht_exempt' },
  { key: 'mortgage_balance', label: 'Mortgage (£)', group: 'IHT', width: 100, type: 'currency', field: 'mortgage_balance',
    showFor: (a) => a.asset_class.startsWith('property') },

  // Pension
  { key: 'pension_type', label: 'Pension Type', group: 'Pension', width: 100, type: 'select', field: 'pension_type',
    options: PENSION_TYPES.map(p => ({ value: p, label: p.toUpperCase() })),
    showFor: (a) => a.asset_class === 'pension' },

  // Relief (EIS/VCT)
  { key: 'original_subscription_amount', label: 'Subscription (£)', group: 'Relief', width: 110, type: 'currency', field: 'original_subscription_amount',
    showFor: (a) => ['eis', 'vct'].includes(a.asset_class) },
  { key: 'tax_relief_claimed', label: 'Relief (£)', group: 'Relief', width: 90, type: 'currency', field: 'tax_relief_claimed',
    showFor: (a) => ['eis', 'vct'].includes(a.asset_class) },
  { key: 'relief_claimed_type', label: 'Relief Type', group: 'Relief', width: 120, type: 'select', field: 'relief_claimed_type',
    options: RELIEF_TYPES.map(r => ({ value: r, label: r.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) })),
    showFor: (a) => ['eis', 'vct'].includes(a.asset_class) },
];

export default function AssetEditor({ assets, defaults, onChange, onClose }: AssetEditorProps) {
  const [local, setLocal] = useState<Asset[]>(() => assets.map(a => ({ ...a })));
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [addType, setAddType] = useState<string>('cash');
  const [addLabel, setAddLabel] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const isDirty = JSON.stringify(local) !== JSON.stringify(assets);

  const updateField = (idx: number, field: keyof Asset, value: any) => {
    setLocal(prev => prev.map((a, i) => {
      if (i !== idx) return a;
      const updated = { ...a, [field]: value };
      // Auto-update wrapper when asset class changes
      if (field === 'asset_class') {
        const tmpl = TEMPLATES[value as string];
        if (tmpl) {
          updated.wrapper_type = tmpl.wrapper_type;
          updated.is_iht_exempt = tmpl.is_iht_exempt;
          updated.pension_type = tmpl.pension_type;
          updated.relief_claimed_type = tmpl.relief_claimed_type;
          updated.estimated_disposal_cost_pct = tmpl.estimated_disposal_cost_pct;
        }
      }
      return updated;
    }));
  };

  const handleAddAsset = () => {
    const label = addLabel.trim() || `New ${ASSET_CLASS_LABELS[addType] ?? addType}`;
    const newAsset = createNewAsset(addType, label);
    setLocal([...local, newAsset]);
    setShowAddPanel(false);
    setAddLabel('');
  };

  const handleDelete = (assetId: string) => {
    if (confirmDeleteId !== assetId) {
      setConfirmDeleteId(assetId);
      return;
    }
    setLocal(prev => prev.filter(a => a.asset_id !== assetId));
    setConfirmDeleteId(null);
  };

  const handleApply = () => {
    onChange(local);
    onClose();
  };

  const handleClose = () => {
    if (isDirty && !window.confirm('You have unsaved changes. Discard them?')) return;
    onClose();
  };

  const totalValue = local.reduce((sum, a) => sum + (a.current_value ?? 0), 0);
  const totalIncome = local.reduce((sum, a) => sum + (a.income_generated ?? 0), 0);

  const fmt = (n: number) => '£' + Math.round(n).toLocaleString('en-GB');

  // Group columns by their group label
  const groups = [...new Set(COLUMNS.map(c => c.group))];

  const renderCell = (asset: Asset, col: Column, idx: number) => {
    // Check if column applies to this asset
    if (col.showFor && !col.showFor(asset)) {
      return <td key={col.key} className="grid-cell grid-cell-na">—</td>;
    }

    const val = (asset as any)[col.field];
    const gap = getFieldGap(asset, col.key);
    const gapClass = gap ? `grid-cell-gap-${gap.impact}` : '';

    const gapTitle = gap ? `⚠ ${gap.consequence}` : undefined;

    switch (col.type) {
      case 'text':
        return (
          <td key={col.key} className={`grid-cell ${gapClass}`} title={gapTitle}>
            <input
              type="text"
              className="grid-input grid-input-text"
              value={val ?? ''}
              onChange={e => updateField(idx, col.field, e.target.value)}
            />
          </td>
        );
      case 'currency':
        return (
          <td key={col.key} className={`grid-cell ${gapClass}`} title={gapTitle}>
            <input
              type="number"
              className="grid-input grid-input-num"
              value={val ?? 0}
              onChange={e => updateField(idx, col.field, Number(e.target.value) || 0)}
              min={0}
              step={1000}
            />
          </td>
        );
      case 'pct':
        return (
          <td key={col.key} className={`grid-cell ${gapClass}`} title={gapTitle}>
            <input
              type="number"
              className="grid-input grid-input-num"
              value={val ?? 0}
              onChange={e => updateField(idx, col.field, Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
              min={0}
              max={100}
              step={5}
            />
          </td>
        );
      case 'pct_decimal':
        return (
          <td key={col.key} className={`grid-cell ${gapClass}`} title={gapTitle}>
            <input
              type="number"
              className="grid-input grid-input-num"
              value={+((val ?? 0) * 100).toFixed(2)}
              onChange={e => updateField(idx, col.field, (Number(e.target.value) || 0) / 100)}
              min={-10}
              max={30}
              step={0.5}
            />
          </td>
        );
      case 'number':
        return (
          <td key={col.key} className={`grid-cell ${gapClass}`} title={gapTitle}>
            <input
              type="number"
              className="grid-input grid-input-num"
              value={val ?? 0}
              onChange={e => updateField(idx, col.field, Number(e.target.value) || 0)}
            />
          </td>
        );
      case 'select':
        return (
          <td key={col.key} className={`grid-cell ${gapClass}`} title={gapTitle}>
            <select
              className="grid-input grid-input-select"
              value={val ?? ''}
              onChange={e => updateField(idx, col.field, e.target.value)}
            >
              {col.options?.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </td>
        );
      case 'checkbox':
        return (
          <td key={col.key} className={`grid-cell grid-cell-center ${gapClass}`} title={gapTitle}>
            <input
              type="checkbox"
              checked={val ?? false}
              onChange={e => updateField(idx, col.field, e.target.checked)}
            />
          </td>
        );
      case 'date':
        return (
          <td key={col.key} className={`grid-cell ${gapClass}`} title={gapTitle}>
            <input
              type="date"
              className="grid-input grid-input-date"
              value={val ?? ''}
              onChange={e => updateField(idx, col.field, e.target.value || null)}
            />
          </td>
        );
      default:
        return <td key={col.key} className={`grid-cell ${gapClass}`} title={gapTitle}>{String(val ?? '')}</td>;
    }
  };

  return (
    <div className="asset-editor-overlay" onClick={e => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className="asset-grid-modal">
        {/* Header */}
        <div className="asset-grid-header">
          <div>
            <h2>Asset Register</h2>
            <div className="asset-editor-summary">
              <span>Total: {fmt(totalValue)}</span>
              <span className="sep">/</span>
              <span>Income: {fmt(totalIncome)}/yr</span>
              <span className="sep">/</span>
              <span>{local.length} assets</span>
            </div>
          </div>
          <div className="asset-editor-actions">
            <button className="ae-btn accent" onClick={() => setShowAddPanel(!showAddPanel)}>
              + Add Asset
            </button>
            <button className="ae-btn primary" onClick={handleApply} disabled={!isDirty}>
              Apply Changes
            </button>
            <button className="ae-btn ghost" onClick={handleClose}>{'\u2715'}</button>
          </div>
        </div>

        {/* Add panel */}
        {showAddPanel && (
          <div className="add-asset-panel">
            <div className="add-asset-type-grid">
              {Object.entries(TEMPLATES).map(([key]) => (
                <button
                  key={key}
                  className={`add-asset-type-btn ${addType === key ? 'selected' : ''}`}
                  onClick={() => setAddType(key)}
                >
                  {ASSET_CLASS_LABELS[key] ?? key}
                </button>
              ))}
            </div>
            <div className="add-asset-form">
              <input
                type="text"
                placeholder={`Name, e.g. "ISA — Vanguard"`}
                value={addLabel}
                onChange={e => setAddLabel(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddAsset()}
                maxLength={60}
              />
              <button className="ae-btn primary small" onClick={handleAddAsset}>Add</button>
            </div>
          </div>
        )}

        {/* Grid */}
        <div className="asset-grid-scroll">
          <table className="asset-grid-table">
            <thead>
              {/* Group header row */}
              <tr className="grid-group-row">
                {groups.map(g => {
                  const cols = COLUMNS.filter(c => c.group === g);
                  return (
                    <th key={g} colSpan={cols.length} className="grid-group-th">
                      {g}
                    </th>
                  );
                })}
                <th className="grid-group-th" />
              </tr>
              {/* Column header row */}
              <tr className="grid-header-row">
                {COLUMNS.map(col => (
                  <th
                    key={col.key}
                    className="grid-col-th"
                    style={{ minWidth: col.width, width: col.width }}
                    title={col.hint}
                  >
                    {col.label}
                  </th>
                ))}
                <th className="grid-col-th" style={{ width: 60 }} />
              </tr>
            </thead>
            <tbody>
              {local.map((asset, idx) => (
                <tr key={asset.asset_id} className="grid-row">
                  {COLUMNS.map(col => renderCell(asset, col, idx))}
                  <td className="grid-cell grid-cell-action">
                    <button
                      className={`grid-delete-btn ${confirmDeleteId === asset.asset_id ? 'confirm' : ''}`}
                      onClick={() => handleDelete(asset.asset_id)}
                      title={confirmDeleteId === asset.asset_id ? 'Click again to confirm' : 'Remove asset'}
                    >
                      {confirmDeleteId === asset.asset_id ? '✓' : '×'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {local.length === 0 && (
          <div className="asset-grid-empty">
            No assets yet. Click "+ Add Asset" to get started.
          </div>
        )}
      </div>
    </div>
  );
}
