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
  property_investment: 'Property (Investment)',
  property_residential: 'Property (Residential)',
  vct: 'VCT',
  eis: 'EIS',
  aim_shares: 'AIM Shares',
};

const ASSET_CLASS_COLORS: Record<string, string> = {
  cash: '#6366f1',
  isa: '#22c55e',
  pension: '#f59e0b',
  property_investment: '#ef4444',
  property_residential: '#f87171',
  vct: '#8b5cf6',
  eis: '#ec4899',
  aim_shares: '#06b6d4',
};

interface AssetTemplate {
  asset_class: string;
  wrapper_type: string;
  assumed_growth_rate: number;
  income_generated: number;
  is_iht_exempt: boolean;
  pension_type: string | null;
  relief_claimed_type: string;
  estimated_disposal_cost_pct: number;
  hint: string;
}

const ASSET_TEMPLATES: Record<string, AssetTemplate> = {
  cash: {
    asset_class: 'cash', wrapper_type: 'unwrapped', assumed_growth_rate: 0.045,
    income_generated: 0, is_iht_exempt: false, pension_type: null,
    relief_claimed_type: 'none', estimated_disposal_cost_pct: 0,
    hint: 'Savings accounts, current accounts, NS&I. Interest taxed as savings income.',
  },
  isa: {
    asset_class: 'isa', wrapper_type: 'isa', assumed_growth_rate: 0.06,
    income_generated: 0, is_iht_exempt: false, pension_type: null,
    relief_claimed_type: 'none', estimated_disposal_cost_pct: 0,
    hint: 'Tax-free growth and income. No CGT on disposal. Part of estate for IHT.',
  },
  pension: {
    asset_class: 'pension', wrapper_type: 'pension', assumed_growth_rate: 0.055,
    income_generated: 0, is_iht_exempt: false, pension_type: 'sipp',
    relief_claimed_type: 'none', estimated_disposal_cost_pct: 0,
    hint: 'SIPP or SSAS. Draws taxed as income. PCLS/TFLS available. Currently outside estate pre-2027.',
  },
  property_investment: {
    asset_class: 'property_investment', wrapper_type: 'unwrapped', assumed_growth_rate: 0.03,
    income_generated: 0, is_iht_exempt: false, pension_type: null,
    relief_claimed_type: 'none', estimated_disposal_cost_pct: 0.025,
    hint: 'Buy-to-let or commercial. Rental income taxed as non-savings. CGT on sale with ATED/letting relief.',
  },
  property_residential: {
    asset_class: 'property_residential', wrapper_type: 'unwrapped', assumed_growth_rate: 0.03,
    income_generated: 0, is_iht_exempt: false, pension_type: null,
    relief_claimed_type: 'none', estimated_disposal_cost_pct: 0.025,
    hint: 'Primary or secondary residence. Main residence may qualify for PPR relief on CGT.',
  },
  vct: {
    asset_class: 'vct', wrapper_type: 'unwrapped', assumed_growth_rate: 0.07,
    income_generated: 0, is_iht_exempt: false, pension_type: null,
    relief_claimed_type: 'income_tax_relief', estimated_disposal_cost_pct: 0,
    hint: 'Tax-free dividends, CGT-exempt after 5yr hold. Early disposal claws back income tax relief.',
  },
  eis: {
    asset_class: 'eis', wrapper_type: 'unwrapped', assumed_growth_rate: 0.12,
    income_generated: 0, is_iht_exempt: true, pension_type: null,
    relief_claimed_type: 'both', estimated_disposal_cost_pct: 0,
    hint: 'IHT-exempt via BPR after 2yr hold. CGT-exempt if held 3yr+. Loss relief available.',
  },
  aim_shares: {
    asset_class: 'aim_shares', wrapper_type: 'unwrapped', assumed_growth_rate: 0.065,
    income_generated: 0, is_iht_exempt: true, pension_type: null,
    relief_claimed_type: 'none', estimated_disposal_cost_pct: 0.01,
    hint: 'IHT-exempt via BPR after 2yr hold (subject to 2026 cap). Standard CGT applies on disposal.',
  },
};

function createNewAsset(templateKey: string, label: string): Asset {
  const t = ASSET_TEMPLATES[templateKey];
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
    income_generated: t.income_generated,
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
    (asset.acquisition_cost ?? 0) !== (orig.acquisition_cost ?? 0) ||
    (asset.reinvested_pct ?? 0) !== (orig.reinvested_pct ?? 0) ||
    (asset.disposal_type ?? 'none') !== (orig.disposal_type ?? 'none') ||
    (asset.transfer_year ?? null) !== (orig.transfer_year ?? null);
}

export default function AssetEditor({ assets, defaults, onChange, onClose }: AssetEditorProps) {
  const [local, setLocal] = useState<Asset[]>(() => assets.map(a => ({ ...a })));
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [addType, setAddType] = useState<string>('cash');
  const [addLabel, setAddLabel] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const isDirty = local.length !== assets.length || local.some((a, i) => {
    const current = assets[i];
    if (!current) return true;
    return a.current_value !== current.current_value ||
      a.assumed_growth_rate !== current.assumed_growth_rate ||
      a.income_generated !== current.income_generated ||
      a.mortgage_balance !== current.mortgage_balance ||
      (a.acquisition_cost ?? 0) !== (current.acquisition_cost ?? 0) ||
      (a.reinvested_pct ?? 0) !== (current.reinvested_pct ?? 0) ||
      (a.disposal_type ?? 'none') !== (current.disposal_type ?? 'none') ||
      (a.transfer_year ?? null) !== (current.transfer_year ?? null) ||
      a.label !== current.label ||
      a.asset_id !== current.asset_id;
  });

  const updateAsset = (index: number, field: keyof Asset, value: any) => {
    const updated = local.map((a, i) => i === index ? { ...a, [field]: value } : a);
    setLocal(updated);
  };

  const handleAddAsset = () => {
    const template = ASSET_TEMPLATES[addType];
    if (!template) return;
    const label = addLabel.trim() || `New ${ASSET_CLASS_LABELS[template.asset_class] ?? addType}`;
    const newAsset = createNewAsset(addType, label);
    setLocal([...local, newAsset]);
    setExpandedId(newAsset.asset_id);
    setShowAddPanel(false);
    setAddLabel('');
  };

  const handleDeleteAsset = (assetId: string) => {
    if (confirmDeleteId !== assetId) {
      setConfirmDeleteId(assetId);
      return;
    }
    setLocal(local.filter(a => a.asset_id !== assetId));
    setConfirmDeleteId(null);
    if (expandedId === assetId) setExpandedId(null);
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
            <button className="ae-btn accent" onClick={() => setShowAddPanel(!showAddPanel)}>
              + Add Asset
            </button>
            {hasAnyOverride && (
              <button className="ae-btn secondary" onClick={resetAll}>Reset All</button>
            )}
            <button className="ae-btn primary" onClick={handleApply}>Apply Changes</button>
            <button className="ae-btn ghost" onClick={handleClose}>{'\u2715'}</button>
          </div>
        </div>

        {showAddPanel && (
          <div className="add-asset-panel">
            <div className="add-asset-type-grid">
              {Object.entries(ASSET_TEMPLATES).map(([key, t]) => (
                <button
                  key={key}
                  className={`add-asset-type-btn ${addType === key ? 'selected' : ''}`}
                  onClick={() => setAddType(key)}
                  style={{ borderColor: addType === key ? (ASSET_CLASS_COLORS[t.asset_class] ?? '#888') : undefined }}
                >
                  <span className="add-type-badge" style={{ background: ASSET_CLASS_COLORS[t.asset_class] ?? '#888' }}>
                    {ASSET_CLASS_LABELS[t.asset_class] ?? key}
                  </span>
                </button>
              ))}
            </div>
            <div className="add-asset-hint">
              {ASSET_TEMPLATES[addType]?.hint}
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
              <button className="ae-btn primary small" onClick={handleAddAsset}>
                Add
              </button>
            </div>
          </div>
        )}

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
                    {/* ── Core fields ── */}
                    <div className="field-section-label">Core</div>

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

                    <div className="field-row">
                      <label>Wrapper Type</label>
                      <div className="field-input-wrap">
                        <select
                          value={asset.wrapper_type}
                          onChange={(e) => updateAsset(idx, 'wrapper_type', e.target.value)}
                        >
                          <option value="unwrapped">Unwrapped</option>
                          <option value="isa">ISA</option>
                          <option value="pension">Pension</option>
                        </select>
                      </div>
                    </div>

                    <div className="field-row">
                      <label>Reinvested %</label>
                      <div className="field-input-wrap">
                        <input
                          type="number"
                          value={asset.reinvested_pct ?? 0}
                          onChange={(e) => updateAsset(idx, 'reinvested_pct', Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                          min={0}
                          max={100}
                          step={5}
                        />
                        <span className="field-suffix">%</span>
                        <span className="field-hint-inline">Income reinvested back into the asset</span>
                      </div>
                    </div>

                    {/* ── CGT & Acquisition ── */}
                    <div className="field-section-label">Acquisition & CGT</div>

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
                        <span className="field-hint-inline">Original purchase price — used for CGT on disposal</span>
                      </div>
                    </div>

                    <div className="field-row">
                      <label>Acquisition Date</label>
                      <div className="field-input-wrap">
                        <input
                          type="date"
                          value={asset.acquisition_date ?? ''}
                          onChange={(e) => updateAsset(idx, 'acquisition_date', e.target.value || null)}
                        />
                        <span className="field-hint-inline">Used for BPR qualifying period checks</span>
                      </div>
                    </div>

                    <div className="field-row">
                      <label>Disposal Cost</label>
                      <div className="field-input-wrap">
                        <input
                          type="number"
                          value={+((asset.estimated_disposal_cost_pct ?? 0) * 100).toFixed(2)}
                          onChange={(e) => updateAsset(idx, 'estimated_disposal_cost_pct', (Number(e.target.value) || 0) / 100)}
                          min={0}
                          max={20}
                          step={0.25}
                        />
                        <span className="field-suffix">%</span>
                        <span className="field-hint-inline">Selling costs deducted on disposal (e.g. agent fees)</span>
                      </div>
                    </div>

                    {/* ── IHT ── */}
                    <div className="field-section-label">IHT & Estate</div>

                    <div className="field-row">
                      <label>IHT Exempt (BPR)</label>
                      <div className="field-input-wrap">
                        <label className="transfer-toggle-label">
                          <input
                            type="checkbox"
                            checked={asset.is_iht_exempt ?? false}
                            onChange={(e) => updateAsset(idx, 'is_iht_exempt', e.target.checked)}
                          />
                          Asset qualifies for Business Property Relief
                        </label>
                      </div>
                    </div>

                    {(asset.asset_class === 'property_investment' || asset.asset_class === 'property_residential') && (
                      <>
                        <div className="field-row">
                          <label>Mortgage Balance</label>
                          <div className="field-input-wrap">
                            <span className="field-prefix">{'\u00A3'}</span>
                            <input
                              type="number"
                              value={asset.mortgage_balance ?? 0}
                              onChange={(e) => updateAsset(idx, 'mortgage_balance', Number(e.target.value) || 0)}
                              min={0}
                              step={1000}
                            />
                            <span className="field-hint-inline">Outstanding mortgage reduces net estate value</span>
                          </div>
                        </div>

                        <div className="field-row">
                          <label>Transfer to Beneficiary</label>
                          <div className="field-input-wrap transfer-fields">
                            <label className="transfer-toggle-label">
                              <input
                                type="checkbox"
                                checked={(asset.disposal_type ?? 'none') === 'transfer'}
                                onChange={(e) => {
                                  const updated = local.map((a, i) => i === idx ? {
                                    ...a,
                                    disposal_type: e.target.checked ? 'transfer' as const : 'none' as const,
                                    transfer_year: e.target.checked ? (a.transfer_year ?? 1) : null
                                  } : a);
                                  setLocal(updated);
                                }}
                              />
                              Transfer as PET
                            </label>
                            {(asset.disposal_type ?? 'none') === 'transfer' && (
                              <div className="transfer-year-input">
                                <label>Transfer in year</label>
                                <input
                                  type="number"
                                  value={asset.transfer_year ?? 1}
                                  onChange={(e) => updateAsset(idx, 'transfer_year', Math.max(1, Number(e.target.value) || 1))}
                                  min={1}
                                  max={50}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    )}

                    {/* ── Pension-specific ── */}
                    {asset.asset_class === 'pension' && (
                      <>
                        <div className="field-section-label">Pension</div>
                        <div className="field-row">
                          <label>Pension Type</label>
                          <div className="field-input-wrap">
                            <select
                              value={asset.pension_type ?? 'sipp'}
                              onChange={(e) => updateAsset(idx, 'pension_type', e.target.value)}
                            >
                              <option value="sipp">SIPP</option>
                              <option value="ssas">SSAS</option>
                              <option value="db">Defined Benefit</option>
                            </select>
                          </div>
                        </div>
                      </>
                    )}

                    {/* ── EIS/VCT-specific ── */}
                    {(asset.asset_class === 'eis' || asset.asset_class === 'vct') && (
                      <>
                        <div className="field-section-label">Tax Relief</div>
                        <div className="field-row">
                          <label>Original Subscription</label>
                          <div className="field-input-wrap">
                            <span className="field-prefix">{'\u00A3'}</span>
                            <input
                              type="number"
                              value={asset.original_subscription_amount ?? 0}
                              onChange={(e) => updateAsset(idx, 'original_subscription_amount', Number(e.target.value) || 0)}
                              min={0}
                              step={1000}
                            />
                            <span className="field-hint-inline">Amount originally invested</span>
                          </div>
                        </div>

                        <div className="field-row">
                          <label>Tax Relief Claimed</label>
                          <div className="field-input-wrap">
                            <span className="field-prefix">{'\u00A3'}</span>
                            <input
                              type="number"
                              value={asset.tax_relief_claimed ?? 0}
                              onChange={(e) => updateAsset(idx, 'tax_relief_claimed', Number(e.target.value) || 0)}
                              min={0}
                              step={100}
                            />
                            <span className="field-hint-inline">Income tax or CGT relief already received</span>
                          </div>
                        </div>

                        <div className="field-row">
                          <label>Relief Type</label>
                          <div className="field-input-wrap">
                            <select
                              value={asset.relief_claimed_type ?? 'none'}
                              onChange={(e) => updateAsset(idx, 'relief_claimed_type', e.target.value)}
                            >
                              <option value="none">None</option>
                              <option value="income_tax_relief">Income Tax Relief</option>
                              <option value="cgt_deferral">CGT Deferral</option>
                              <option value="both">Both</option>
                            </select>
                          </div>
                        </div>
                      </>
                    )}

                    <div className="asset-card-bottom-actions">
                      {assetHasOverride && (
                        <button className="ae-btn secondary small" onClick={() => resetAsset(idx)}>
                          Reset to default
                        </button>
                      )}
                      <button
                        className={`ae-btn small ${confirmDeleteId === asset.asset_id ? 'danger' : 'danger-outline'}`}
                        onClick={() => handleDeleteAsset(asset.asset_id)}
                      >
                        {confirmDeleteId === asset.asset_id ? 'Confirm Remove' : 'Remove Asset'}
                      </button>
                    </div>
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
