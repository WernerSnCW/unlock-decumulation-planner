import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import type { SimulationInputs, SimulationResult, OptimiserResult, Asset } from '../engine/decumulation';
import {
  runSimulation,
  runOptimiser,
  STRATEGY_PRESETS,
  DEFAULT_MECHANISMS,
  DEFAULT_EIS_STRATEGY,
  DEFAULT_VCT_STRATEGY,
} from '../engine/decumulation';
import type { TaxParametersFile } from '../engine/taxLogic';
import type { Warning } from '../engine/warningEvaluator';
import { evaluateRegisterWarnings } from '../engine/warningEvaluator';
import { useAuth } from './AuthContext';

import taxParameters from '../data/taxParameters.json';

const taxParams = taxParameters as TaxParametersFile;

export const DEFAULT_INPUTS: SimulationInputs = {
  annual_income_target: 80000,
  income_is_net: false,
  plan_years: 25,
  lifestyle_multiplier: 'comfortable',
  current_age: 65,
  inflation_rate: 0.03,
  priority_weights: { ...STRATEGY_PRESETS.balanced },
  annual_gift_amount: 0,
  gift_type: 'pet',
  state_pension_annual: 0,
  private_pension_income: 0,
  strategy_mechanisms: { ...DEFAULT_MECHANISMS },
  apply_2026_bpr_cap: true,
  apply_2027_pension_iht: true,
  cash_reserve: 0,
  legacy_target: 0,
  glory_years: { enabled: false, duration: 5, multiplier: 1.5, target_is_glory: false },
  eis_strategy: { ...DEFAULT_EIS_STRATEGY },
  vct_strategy: { ...DEFAULT_VCT_STRATEGY },
};

function mergeInputs(saved: Partial<SimulationInputs>): SimulationInputs {
  return {
    ...DEFAULT_INPUTS,
    ...saved,
    priority_weights: { ...DEFAULT_INPUTS.priority_weights, ...(saved.priority_weights ?? {}) },
    strategy_mechanisms: { ...DEFAULT_INPUTS.strategy_mechanisms, ...(saved.strategy_mechanisms ?? {}) },
    glory_years: { ...DEFAULT_INPUTS.glory_years, ...(saved.glory_years ?? {}) },
    eis_strategy: { ...DEFAULT_EIS_STRATEGY, ...(saved.eis_strategy ?? {}) },
    vct_strategy: { ...DEFAULT_VCT_STRATEGY, ...(saved.vct_strategy ?? {}) },
  };
}

interface PlannerContextValue {
  // State
  inputs: SimulationInputs;
  assets: Asset[];
  result: SimulationResult | null;
  eisComparisonResult: SimulationResult | null;
  optimiserResult: OptimiserResult | null;
  optimiserRunning: boolean;
  allWarnings: Warning[];
  registerWarnings: Warning[];
  isLoadingData: boolean;
  taxParams: TaxParametersFile;

  // Actions
  updateInputs: (newInputs: SimulationInputs) => void;
  updateAssets: (newAssets: Asset[]) => void;
  runOptimiserAction: (mode: 'max_income' | 'max_estate' | 'balanced') => Promise<void>;
  applyOptimiser: () => void;
}

const PlannerContext = createContext<PlannerContextValue | null>(null);

async function apiFetch<T>(path: string, accessCode: string, options?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Access-Code': accessCode,
        ...(options?.headers ?? {}),
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function PlannerProvider({ children }: { children: ReactNode }) {
  const { investor } = useAuth();
  const accessCode = investor?.accessCode ?? '';

  const [inputs, setInputs] = useState<SimulationInputs>(DEFAULT_INPUTS);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [eisComparisonResult, setEisComparisonResult] = useState<SimulationResult | null>(null);
  const [optimiserResult, setOptimiserResult] = useState<OptimiserResult | null>(null);
  const [optimiserRunning, setOptimiserRunning] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveSettingsRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Run simulation
  const runSim = useCallback((inp: SimulationInputs, reg?: Asset[]) => {
    const currentAssets = reg ?? assets;
    if (currentAssets.length === 0) {
      setResult(null);
      setEisComparisonResult(null);
      return;
    }
    try {
      const res = runSimulation(inp, currentAssets, taxParams);
      setResult(res);

      const hasEis = inp.eis_strategy?.enabled &&
        (inp.eis_strategy.allocation_mode === 'tax_allowance' ||
         inp.eis_strategy.annual_eis_amount > 0 ||
         inp.eis_strategy.annual_seis_amount > 0);
      const hasVct = inp.vct_strategy?.enabled && inp.vct_strategy.annual_vct_amount > 0;

      if (hasEis || hasVct) {
        const altEisScenario = inp.eis_strategy.scenario === 'worst_case' ? 'base_case' as const : 'worst_case' as const;
        const altEis = hasEis ? { ...inp.eis_strategy, scenario: altEisScenario } : inp.eis_strategy;
        const altVctScenario = inp.vct_strategy.scenario === 'worst_case' ? 'base_case' as const : 'worst_case' as const;
        const altVct = hasVct ? { ...inp.vct_strategy, scenario: altVctScenario } : inp.vct_strategy;
        const altInputs: SimulationInputs = { ...inp, eis_strategy: altEis, vct_strategy: altVct };
        setEisComparisonResult(runSimulation(altInputs, currentAssets, taxParams));
      } else {
        setEisComparisonResult(null);
      }
    } catch (e) {
      console.error('Simulation error:', e);
      setResult(null);
      setEisComparisonResult(null);
    }
  }, [assets]);

  // Fetch assets and settings from API on mount
  useEffect(() => {
    if (!accessCode) return;

    async function load() {
      setIsLoadingData(true);
      const [apiAssets, apiSettings] = await Promise.all([
        apiFetch<Asset[]>('/api/investor/assets', accessCode),
        apiFetch<SimulationInputs | null>('/api/investor/settings', accessCode),
      ]);

      const loadedAssets = apiAssets ?? [];
      const loadedInputs = apiSettings ? mergeInputs(apiSettings) : DEFAULT_INPUTS;

      setAssets(loadedAssets);
      setInputs(loadedInputs);
      setIsLoadingData(false);

      if (loadedAssets.length > 0) {
        try {
          const res = runSimulation(loadedInputs, loadedAssets, taxParams);
          setResult(res);
        } catch (e) {
          console.error('Initial simulation error:', e);
        }
      }
    }

    load();
  }, [accessCode]);

  // Save settings to API (debounced)
  const saveSettingsToApi = useCallback((data: SimulationInputs) => {
    if (!accessCode) return;
    if (saveSettingsRef.current) clearTimeout(saveSettingsRef.current);
    saveSettingsRef.current = setTimeout(() => {
      fetch('/api/investor/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Access-Code': accessCode },
        body: JSON.stringify(data),
      }).catch(() => {});
    }, 1000);
  }, [accessCode]);

  // Save assets to API
  const saveAssetsToApi = useCallback((data: Asset[]) => {
    if (!accessCode) return;
    fetch('/api/investor/assets', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Access-Code': accessCode },
      body: JSON.stringify(data),
    }).catch(() => {});
  }, [accessCode]);

  const updateInputs = useCallback((newInputs: SimulationInputs) => {
    setInputs(newInputs);
    setOptimiserResult(null);
    saveSettingsToApi(newInputs);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runSim(newInputs);
    }, 400);
  }, [runSim, saveSettingsToApi]);

  const updateAssets = useCallback((newAssets: Asset[]) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setAssets(newAssets);
    setOptimiserResult(null);
    saveAssetsToApi(newAssets);
    runSim(inputs, newAssets);
  }, [inputs, runSim, saveAssetsToApi]);

  const runOptimiserAction = useCallback(async (mode: 'max_income' | 'max_estate' | 'balanced') => {
    setOptimiserRunning(true);
    setOptimiserResult(null);
    await new Promise(r => setTimeout(r, 50));
    try {
      const res = await runOptimiser(inputs, assets, taxParams, mode);
      setOptimiserResult(res);
    } catch (e) {
      console.error('Optimiser error:', e);
    }
    setOptimiserRunning(false);
  }, [inputs, assets]);

  const applyOptimiser = useCallback(() => {
    if (!optimiserResult) return;
    const newInputs: SimulationInputs = {
      ...inputs,
      annual_income_target: optimiserResult.optimal_income,
      cash_reserve: optimiserResult.optimal_buffer,
      income_is_net: false,
    };
    setInputs(newInputs);
    saveSettingsToApi(newInputs);
    runSim(newInputs);
  }, [optimiserResult, inputs, runSim, saveSettingsToApi]);

  const registerWarnings = useMemo(() => evaluateRegisterWarnings(assets), [assets]);

  const allWarnings = useMemo(() => {
    const yearWarnings: Warning[] = result?.perYear
      .filter(yr => !yr.isShadow)
      .flatMap(yr => yr.flags) ?? [];
    return [...registerWarnings, ...yearWarnings];
  }, [result, registerWarnings]);

  return (
    <PlannerContext.Provider value={{
      inputs,
      assets,
      result,
      eisComparisonResult,
      optimiserResult,
      optimiserRunning,
      allWarnings,
      registerWarnings,
      isLoadingData,
      taxParams,
      updateInputs,
      updateAssets,
      runOptimiserAction,
      applyOptimiser,
    }}>
      {children}
    </PlannerContext.Provider>
  );
}

export function usePlanner(): PlannerContextValue {
  const ctx = useContext(PlannerContext);
  if (!ctx) throw new Error('usePlanner must be used within PlannerProvider');
  return ctx;
}
