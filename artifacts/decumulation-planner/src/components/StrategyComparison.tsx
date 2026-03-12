import { useMemo } from 'react';
import type { SimulationInputs, SimulationResult, DrawdownStrategy } from '../engine/decumulation';
import { runSimulation, STRATEGY_PRESETS } from '../engine/decumulation';
import type { Asset } from '../engine/decumulation';
import type { TaxParametersFile } from '../engine/taxLogic';

interface Props {
  inputs: SimulationInputs;
  register: Asset[];
  taxParams: TaxParametersFile;
}

const STRATEGIES: { value: DrawdownStrategy; label: string }[] = [
  { value: 'tax_optimised', label: 'Tax Optimised' },
  { value: 'iht_optimised', label: 'IHT Optimised' },
  { value: 'income_first', label: 'Income First' },
  { value: 'growth_first', label: 'Growth First' },
];

function formatMoney(value: number): string {
  if (Math.abs(value) >= 10000) {
    return '\u00A3' + Math.round(value).toLocaleString('en-GB');
  }
  return '\u00A3' + value.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export default function StrategyComparison({ inputs, register, taxParams }: Props) {
  const results = useMemo(() => {
    const map: Record<string, SimulationResult> = {};
    for (const s of STRATEGIES) {
      const modInputs = { ...inputs, priority_weights: { ...STRATEGY_PRESETS[s.value] } };
      map[s.value] = runSimulation(modInputs, register, taxParams);
    }
    map['your_blend'] = runSimulation(inputs, register, taxParams);
    return map;
  }, [inputs, register, taxParams]);

  const rows = [
    { label: 'Funded Years', key: 'funded_years' as const, format: (v: number) => `${v}` },
    { label: 'Total Tax Paid', key: 'total_tax_paid' as const, format: formatMoney },
    { label: 'IHT at Plan End', key: 'iht_at_end' as const, format: formatMoney },
    { label: 'First Shortfall', key: 'first_shortfall_year' as const, format: (v: number | null) => v ? `Year ${v}` : '\u2014' },
  ];

  const columns = [
    ...STRATEGIES.map(s => ({ key: s.value, label: s.label })),
    { key: 'your_blend', label: 'Your Blend' },
  ];

  return (
    <div className="chart-container">
      <div className="chart-title">Strategy Comparison</div>
      <div className="comparison-grid" style={{ gridTemplateColumns: `180px repeat(${columns.length}, 1fr)` }}>
        <div className="header-cell" />
        {columns.map(col => (
          <div key={col.key} className={`header-cell ${col.key === 'your_blend' ? 'selected' : ''}`}>
            {col.label}
          </div>
        ))}
        {rows.map(row => (
          <div key={row.key} style={{ display: 'contents' }}>
            <div className="label-cell">{row.label}</div>
            {columns.map(col => (
              <div
                key={`${row.key}-${col.key}`}
                className={`cell ${col.key === 'your_blend' ? 'selected' : ''}`}
              >
                {row.format(results[col.key]?.summary[row.key] as any)}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
