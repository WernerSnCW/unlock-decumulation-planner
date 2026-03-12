import { useState } from 'react';
import type { Asset } from '../engine/decumulation';

interface AssetEditorProps {
  assets: Asset[];
  defaults: Asset[];
  onChange: (assets: Asset[]) => void;
  onClose: () => void;
}

const ASSET_CLASS_LABELS: Record<string, string> = {
  cash: 'Cash',
  isa: 'ISA',
  pension: 'Pension',
  property_investment: 'Property',
  vct: 'VCT',
  eis: 'EIS',
  aim_shares: 'AIM',
};

const ASSET_CLASS_COLORS: Record<string, string> = {
  cash: '#6366f1',
  isa: '#22c55e',
  pension: '#f59e0b',
  property_investment: '#ef4444',
  vct: '#8b5cf6',
  eis: '#ec4899',
  aim_shares: '#06b6d4',
};

function isOverridden(current: number | null, original: number | null): boolean {
  return (current ?? 0) !== (original ?? 0);
}

function formatCurrency(val: number): string {
  return '\u00A3' + val.toLocaleString('en-GB');
}

function formatPct(val: number): string {
  return (val * 100).toFixed(1) + '%';
}

function getDefault(defaults: Asset[], asset: Asset): Asset | undefined {
  return defaults.find(d => d.asset_id === asset.asset_id);
}

function assetHasOverrides(asset: Asset, orig: Asset | undefined): boolean {
  if (!orig) return true;
  return asset.current_value !== orig.current_value ||
    asset.assumed_growth_rate !== orig.assumed_growth_rate ||
    asset.income_generated !== orig.income_generated ||
    asset.mortgage_balance !== orig.mortgage_balance ||
    (asset.acquisition_cost ?? 0) !== (orig.acquisition_cost ?? 0);
}

export default function AssetEditor({ assets, defaults, onChange, onClose }: AssetEditorProps) {
  const [local, setLocal] = useState<Asset[]>(() => assets.map(a => ({ ...a })));
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const isDirty = local.some((a, i) => {
    const current = assets[i];
    if (!current) return true;
    return a.current_value !== current.current_value ||
      a.assumed_growth_rate !== current.assumed_growth_rate ||
      a.income_generated !== current.income_generated ||
      a.mortgage_balance !== current.mortgage_balance ||
      (a.acquisition_cost ?? 0) !== (current.acquisition_cost ?? 0);
  });

  const updateAsset = (index: number, field: keyof Asset, value: number) => {
    const updated = local.map((a, i) => i === index ? { ...a, [field]: value } : a);
    setLocal(updated);
  };

  const resetAsset = (index: number) => {
    const orig = getDefault(defaults, local[index]);
    if (!orig) return;
    const updated = local.map((a, i) => i === index ? { ...orig } : a);
    setLocal(updated);
  };

  const resetAll = () => {
    setLocal(defaults.map(a => ({ ...a })));
  };

  const handleApply = () => {
    onChange(local);
    onClose();
  };

  const handleClose = () => {
    if (isDirty) {
      if (!window.confirm('You have unsaved changes. Discard them?')) return;
    }
    onClose();
  };

  const totalValue = local.reduce((sum, a) => sum + a.current_value, 0);
  const totalIncome = local.reduce((sum, a) => sum + a.income_generated, 0);

  const hasAnyOverride = local.some(a => assetHasOverrides(a, getDefault(defaults, a)));

  return (
    <div className="asset-editor-overlay" onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className="asset-editor-modal">
        <div className="asset-editor-header">
          <div>
            <h2>Asset Register</h2>
            <div className="asset-editor-summary">
              <span>Total: {formatCurrency(totalValue)}</span>
              <span className="sep">/</span>
              <span>Income: {formatCurrency(totalIncome)}/yr</span>
              <span className="sep">/</span>
              <span>{local.length} assets</span>
            </div>
          </div>
          <div className="asset-editor-actions">
            {hasAnyOverride && (
              <button className="ae-btn secondary" onClick={resetAll}>Reset All</button>
            )}
            <button className="ae-btn primary" onClick={handleApply}>Apply Changes</button>
            <button className="ae-btn ghost" onClick={handleClose}>{'\u2715'}</button>
          </div>
        </div>

        <div className="asset-editor-body">
          {local.map((asset, idx) => {
            const orig = getDefault(defaults, asset);
            const isExpanded = expandedId === asset.asset_id;
            const classLabel = ASSET_CLASS_LABELS[asset.asset_class] ?? asset.asset_class;
            const classColor = ASSET_CLASS_COLORS[asset.asset_class] ?? '#888';
            const assetHasOverride = assetHasOverrides(asset, orig);

            return (
              <div
                key={asset.asset_id}
                className={`asset-card ${isExpanded ? 'expanded' : ''} ${assetHasOverride ? 'overridden' : ''}`}
              >
                <div
                  className="asset-card-header"
                  onClick={() => setExpandedId(isExpanded ? null : asset.asset_id)}
                >
                  <div className="asset-card-left">
                    <span className="asset-class-badge" style={{ background: classColor }}>
                      {classLabel}
                    </span>
                    <span className="asset-label">{asset.label}</span>
                    {assetHasOverride && <span className="override-dot" />}
                  </div>
                  <div className="asset-card-right">
                    <span className="asset-value">{formatCurrency(asset.current_value)}</span>
                    <span className={`expand-arrow ${isExpanded ? 'open' : ''}`}>{'\u25B8'}</span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="asset-card-fields">
                    <div className="field-row">
                      <label>Current Value</label>
                      <div className="field-input-wrap">
                        <span className="field-prefix">{'\u00A3'}</span>
                        <input
                          type="number"
                          value={asset.current_value}
                          onChange={(e) => updateAsset(idx, 'current_value', Number(e.target.value) || 0)}
                          min={0}
                          step={1000}
                        />
                        {orig && isOverridden(asset.current_value, orig.current_value) && (
                          <span className="field-original">was {formatCurrency(orig.current_value)}</span>
                        )}
                      </div>
                    </div>

                    <div className="field-row">
                      <label>Growth Rate</label>
                      <div className="field-input-wrap">
                        <input
                          type="number"
                          value={+(asset.assumed_growth_rate * 100).toFixed(2)}
                          onChange={(e) => updateAsset(idx, 'assumed_growth_rate', (Number(e.target.value) || 0) / 100)}
                          min={-10}
                          max={30}
                          step={0.5}
                        />
                        <span className="field-suffix">%</span>
                        {orig && isOverridden(asset.assumed_growth_rate, orig.assumed_growth_rate) && (
                          <span className="field-original">was {formatPct(orig.assumed_growth_rate)}</span>
                        )}
                      </div>
                    </div>

                    <div className="field-row">
                      <label>Annual Income</label>
                      <div className="field-input-wrap">
                        <span className="field-prefix">{'\u00A3'}</span>
                        <input
                          type="number"
                          value={asset.income_generated}
                          onChange={(e) => updateAsset(idx, 'income_generated', Number(e.target.value) || 0)}
                          min={0}
                          step={500}
                        />
                        {orig && isOverridden(asset.income_generated, orig.income_generated) && (
                          <span className="field-original">was {formatCurrency(orig.income_generated)}</span>
                        )}
                      </div>
                    </div>

                    {asset.acquisition_cost !== null && (
                      <div className="field-row">
                        <label>Acquisition Cost</label>
                        <div className="field-input-wrap">
                          <span className="field-prefix">{'\u00A3'}</span>
                          <input
                            type="number"
                            value={asset.acquisition_cost ?? 0}
                            onChange={(e) => updateAsset(idx, 'acquisition_cost', Number(e.target.value) || 0)}
                            min={0}
                            step={1000}
                          />
                          {orig && isOverridden(asset.acquisition_cost, orig.acquisition_cost) && (
                            <span className="field-original">was {formatCurrency(orig.acquisition_cost ?? 0)}</span>
                          )}
                        </div>
                      </div>
                    )}

                    {asset.mortgage_balance > 0 && (
                      <div className="field-row">
                        <label>Mortgage Balance</label>
                        <div className="field-input-wrap">
                          <span className="field-prefix">{'\u00A3'}</span>
                          <input
                            type="number"
                            value={asset.mortgage_balance}
                            onChange={(e) => updateAsset(idx, 'mortgage_balance', Number(e.target.value) || 0)}
                            min={0}
                            step={1000}
                          />
                          {orig && isOverridden(asset.mortgage_balance, orig.mortgage_balance) && (
                            <span className="field-original">was {formatCurrency(orig.mortgage_balance)}</span>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="asset-meta">
                      <span>Wrapper: {asset.wrapper_type}</span>
                      {asset.is_iht_exempt && <span className="meta-badge">IHT Exempt</span>}
                      {asset.bpr_qualifying_date && <span className="meta-badge">BPR Qualifying</span>}
                      {asset.pension_type && <span>Pension: {asset.pension_type}</span>}
                    </div>

                    {assetHasOverride && (
                      <button className="ae-btn secondary small" onClick={() => resetAsset(idx)}>
                        Reset to default
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
