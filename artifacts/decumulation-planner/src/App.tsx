import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import './App.css';
import type { SimulationInputs, SimulationResult, OptimiserResult } from './engine/decumulation';
import { runSimulation, runOptimiser, STRATEGY_PRESETS, DEFAULT_MECHANISMS } from './engine/decumulation';
import type { Asset } from './engine/decumulation';
import type { TaxParametersFile } from './engine/taxLogic';
import type { Warning } from './engine/warningEvaluator';
import { evaluateRegisterWarnings } from './engine/warningEvaluator';

import InputPanel from './components/InputPanel';
import FundedYearsIndicator from './components/FundedYearsIndicator';
import StrategyComparison from './components/StrategyComparison';
import PortfolioChart from './components/PortfolioChart';
import IHTChart from './components/IHTChart';
import WarningsPanel from './components/WarningsPanel';
import YearDetailTable from './components/YearDetailTable';
import ActionPlan from './components/ActionPlan';
import DisclosurePanel from './components/DisclosurePanel';
import OptimiserPanel from './components/OptimiserPanel';

import AssetEditor from './components/AssetEditor';

import mockRegister from './data/mockRegister.json';
import taxParameters from './data/taxParameters.json';

const defaultRegister = mockRegister as Asset[];
const taxParams = taxParameters as TaxParametersFile;

const DEFAULT_INPUTS: SimulationInputs = {
  annual_income_target: 80000,
  plan_years: 25,
  lifestyle_multiplier: 'comfortable',
  current_age: 65,
  inflation_rate: 0.03,
  priority_weights: { ...STRATEGY_PRESETS.tax_optimised },
  annual_gift_amount: 0,
  gift_type: 'pet',
  state_pension_annual: 0,
  strategy_mechanisms: { ...DEFAULT_MECHANISMS },
  apply_2026_bpr_cap: true,
  apply_2027_pension_iht: true,
  cash_reserve: 0,
  legacy_target: 0,
  glory_years: { enabled: false, duration: 5, multiplier: 1.5 },
};

const STORAGE_KEY_INPUTS = 'unlock-planner-inputs';
const STORAGE_KEY_ASSETS = 'unlock-planner-assets';

function loadSaved<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveTo(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* quota exceeded — silently ignore */ }
}

function restoreInputs(): SimulationInputs {
  const saved = loadSaved<Partial<SimulationInputs>>(STORAGE_KEY_INPUTS, {});
  return {
    ...DEFAULT_INPUTS,
    ...saved,
    priority_weights: { ...DEFAULT_INPUTS.priority_weights, ...(saved.priority_weights ?? {}) },
    strategy_mechanisms: { ...DEFAULT_INPUTS.strategy_mechanisms, ...(saved.strategy_mechanisms ?? {}) },
    glory_years: { ...DEFAULT_INPUTS.glory_years, ...(saved.glory_years ?? {}) },
  };
}

function App() {
  const [inputs, setInputs] = useState<SimulationInputs>(restoreInputs);
  const [assets, setAssets] = useState<Asset[]>(() => {
    const saved = loadSaved<Asset[] | null>(STORAGE_KEY_ASSETS, null);
    return saved ?? defaultRegister.map(a => ({ ...a }));
  });
  const [assetEditorOpen, setAssetEditorOpen] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [optimiserResult, setOptimiserResult] = useState<OptimiserResult | null>(null);
  const [optimiserRunning, setOptimiserRunning] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSim = useCallback((inp: SimulationInputs, reg?: Asset[]) => {
    try {
      const res = runSimulation(inp, reg ?? assets, taxParams);
      setResult(res);
    } catch (e) {
      console.error('Simulation error:', e);
      setResult(null);
    }
  }, [assets]);

  useEffect(() => {
    runSim(inputs);
  }, []);

  const handleInputChange = useCallback((newInputs: SimulationInputs) => {
    setInputs(newInputs);
    setOptimiserResult(null);
    saveTo(STORAGE_KEY_INPUTS, newInputs);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runSim(newInputs);
    }, 400);
  }, [runSim]);

  const handleAssetsChange = useCallback((newAssets: Asset[]) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setAssets(newAssets);
    setOptimiserResult(null);
    saveTo(STORAGE_KEY_ASSETS, newAssets);
    runSim(inputs, newAssets);
  }, [inputs, runSim]);

  const handleRunOptimiser = useCallback((mode: 'max_income' | 'max_estate' | 'balanced') => {
    setOptimiserRunning(true);
    setTimeout(() => {
      try {
        const res = runOptimiser(inputs, assets, taxParams, mode);
        setOptimiserResult(res);
      } catch (e) {
        console.error('Optimiser error:', e);
      }
      setOptimiserRunning(false);
    }, 50);
  }, [inputs, assets]);

  const handleApplyOptimiser = useCallback(() => {
    if (!optimiserResult) return;
    const newInputs: SimulationInputs = {
      ...inputs,
      annual_income_target: optimiserResult.optimal_income,
      cash_reserve: optimiserResult.optimal_buffer,
    };
    setInputs(newInputs);
    saveTo(STORAGE_KEY_INPUTS, newInputs);
    runSim(newInputs);
  }, [optimiserResult, inputs, runSim]);

  const registerWarnings = useMemo(() => evaluateRegisterWarnings(assets), [assets]);

  const allWarnings = useMemo(() => {
    const yearWarnings: Warning[] = result?.perYear
      .filter(yr => !yr.isShadow)
      .flatMap(yr => yr.flags) ?? [];
    return [...registerWarnings, ...yearWarnings];
  }, [result, registerWarnings]);

  const errorWarnings = allWarnings.filter(w => w.severity === 'error');
  const scenarioActive = inputs.apply_2026_bpr_cap || inputs.apply_2027_pension_iht;
  const hasShortfall = result && result.summary.funded_years < inputs.plan_years;

  const hasOverrides = assets.some(a => {
    const orig = defaultRegister.find(d => d.asset_id === a.asset_id);
    if (!orig) return true;
    return a.current_value !== orig.current_value ||
      a.assumed_growth_rate !== orig.assumed_growth_rate ||
      a.income_generated !== orig.income_generated ||
      a.mortgage_balance !== orig.mortgage_balance ||
      (a.acquisition_cost ?? 0) !== (orig.acquisition_cost ?? 0);
  }) || assets.length !== defaultRegister.length;

  if (assets.length === 0) {
    return (
      <div className="app-layout">
        <header className="app-header">
          <div className="logo">U</div>
          <h1>Decumulation Planner</h1>
        </header>
        <div className="empty-state">
          <h2>No assets found in your register</h2>
          <p>Add assets to the register to begin planning.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="logo">U</div>
        <h1>Decumulation Planner</h1>
        <div className="header-spacer" />
        <button
          className={`edit-assets-btn ${hasOverrides ? 'has-overrides' : ''}`}
          onClick={() => setAssetEditorOpen(true)}
        >
          {hasOverrides ? 'Assets (edited)' : 'Edit Assets'}
        </button>
        <span className="subtitle">Planning estimate — not financial advice</span>
      </header>

      {assetEditorOpen && (
        <AssetEditor
          assets={assets}
          defaults={defaultRegister}
          onChange={handleAssetsChange}
          onClose={() => setAssetEditorOpen(false)}
        />
      )}

      <div className="app-body">
        <InputPanel inputs={inputs} onChange={handleInputChange} />

        <div className="main-content">
          {scenarioActive && (
            <div className="scenario-banner">
              <span>⚠</span>
              <span>
                One or more scenario assumptions are active. These model proposed rules that have not been enacted into law.
              </span>
            </div>
          )}

          {hasShortfall && result && (
            <div className="error-banner">
              Your plan runs out of funds in year {result.summary.first_shortfall_year} at age {inputs.current_age + (result.summary.first_shortfall_year ?? 0) - 1}. Consider reducing lifestyle level or reviewing growth assumptions.
            </div>
          )}

          {errorWarnings.length > 0 && (
            <div className="error-banner">
              {errorWarnings.slice(0, 3).map((w, i) => (
                <div key={i} style={{ marginBottom: i < 2 ? 4 : 0 }}>{w.message}</div>
              ))}
            </div>
          )}

          {result && (
            <>
              <FundedYearsIndicator
                summary={result.summary}
                planYears={inputs.plan_years}
                currentAge={inputs.current_age}
              />

              <OptimiserPanel
                inputs={inputs}
                optimiserResult={optimiserResult}
                optimiserRunning={optimiserRunning}
                onRunOptimiser={handleRunOptimiser}
                onApply={handleApplyOptimiser}
              />

              <StrategyComparison
                inputs={inputs}
                register={assets}
                taxParams={taxParams}
              />

              <PortfolioChart
                perYear={result.perYear}
                planYears={inputs.plan_years}
                firstShortfallYear={result.summary.first_shortfall_year}
              />

              <IHTChart
                perYear={result.perYear}
                toggles={{
                  apply_2026_bpr_cap: inputs.apply_2026_bpr_cap,
                  apply_2027_pension_iht: inputs.apply_2027_pension_iht,
                }}
              />

              <ActionPlan
                perYear={result.perYear}
                register={assets}
                inputs={inputs}
              />

              <div className="two-col">
                <WarningsPanel warnings={allWarnings} />
                <YearDetailTable perYear={result.perYear} register={assets} />
              </div>

              <DisclosurePanel taxParams={taxParams} />
            </>
          )}

          {!result && (
            <div className="empty-state">
              <h2>An error occurred running your plan</h2>
              <p>Check your inputs and try again.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
