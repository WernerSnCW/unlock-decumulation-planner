import { useMemo } from 'react';
import type { SimulationInputs, SimulationResult, DrawdownStrategy } from '../engine/decumulation';
import { runSimulation } from '../engine/decumulation';
import type { Asset } from '../engine/decumulation';
import type { TaxParametersFile } from '../engine/taxLogic';

interface Props {
  inputs: SimulationInputs;
  register: Asset[];
  taxParams: TaxParametersFile;
  currentStrategy: DrawdownStrategy;
}

const STRATEGIES: { value: DrawdownStrategy; label: string }[] = [
  { value: 'tax_optimised', label: 'Tax Optimised' },
  { value: 'iht_optimised', label: 'IHT Optimised' },
  { value: 'income_first', label: 'Income First' },
  { value: 'growth_first', label: 'Growth First' },
];

function formatMoney(value: number): string {
  if (Math.abs(value) >= 10000) {
    return '£' + Math.round(value).toLocaleString('en-GB');
  }
  return '£' + value.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export default function StrategyComparison({ inputs, register, taxParams, currentStrategy }: Props) {
  const results = useMemo(() => {
    const map: Record<string, SimulationResult> = {};
    for (const s of STRATEGIES) {
      const modInputs = { ...inputs, drawdown_strategy: s.value };
      map[s.value] = runSimulation(modInputs, register, taxParams);
    }
    return map;
  }, [inputs, register, taxParams]);

  const rows = [
    { label: 'Funded Years', key: 'funded_years' as const, format: (v: number) => `${v}` },
    { label: 'Total Tax Paid', key: 'total_tax_paid' as const, format: formatMoney },
    { label: 'IHT at Plan End', key: 'iht_at_end' as const, format: formatMoney },
    { label: 'First Shortfall', key: 'first_shortfall_year' as const, format: (v: number | null) => v ? `Year ${v}` : '—' },
  ];

  return (
    <div className="chart-container">
      <div className="chart-title">Strategy Comparison</div>
      <div className="comparison-grid">
        <div className="header-cell" />
        {STRATEGIES.map(s => (
          <div key={s.value} className={`header-cell ${s.value === currentStrategy ? 'selected' : ''}`}>
            {s.label}
          </div>
        ))}
        {rows.map(row => (
          <div key={row.key} style={{ display: 'contents' }}>
            <div className="label-cell">{row.label}</div>
            {STRATEGIES.map(s => (
              <div
                key={`${row.key}-${s.value}`}
                className={`cell ${s.value === currentStrategy ? 'selected' : ''}`}
              >
                {row.format(results[s.value]?.summary[row.key] as any)}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
