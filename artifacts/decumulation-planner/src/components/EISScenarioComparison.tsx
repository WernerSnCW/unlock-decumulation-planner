import { useMemo } from 'react';
import type { SimulationInputs, SimulationResult, EISScenario } from '../engine/decumulation';
import { runSimulation } from '../engine/decumulation';
import type { Asset } from '../engine/decumulation';
import type { TaxParametersFile } from '../engine/taxLogic';

interface Props {
  inputs: SimulationInputs;
  register: Asset[];
  taxParams: TaxParametersFile;
  currentScenario: EISScenario;
}

interface InfoTipProps { text: string }
function InfoTip({ text }: InfoTipProps) {
  return <span className="info-tip-wrap"><span className="info-tip-icon">i</span><span className="info-tip-bubble">{text}</span></span>;
}

const SCENARIOS: { key: 'no_eis' | EISScenario; label: string }[] = [
  { key: 'no_eis', label: 'No EIS' },
  { key: 'worst_case', label: 'EIS All Fail' },
  { key: 'bear', label: 'EIS Bear' },
  { key: 'base_case', label: 'EIS Base Case' },
  { key: 'bull', label: 'EIS Bull' },
];

function fmt(v: number): string {
  if (Math.abs(v) >= 1_000_000) {
    return '\u00A3' + (v / 1_000_000).toFixed(2) + 'M';
  }
  return '\u00A3' + Math.round(v).toLocaleString('en-GB');
}

function delta(v: number, baseline: number): JSX.Element | null {
  const d = v - baseline;
  if (Math.abs(d) < 1) return null;
  const sign = d > 0 ? '+' : '';
  const color = d > 0 ? 'var(--unlock-accent)' : '#EF4444';
  return (
    <span style={{ fontSize: '0.75rem', color, display: 'block' }}>
      {sign}{fmt(d)}
    </span>
  );
}

export default function EISScenarioComparison({ inputs, register, taxParams, currentScenario }: Props) {
  const results = useMemo(() => {
    const map: Record<string, SimulationResult> = {};

    // No EIS baseline
    const noEisInputs = {
      ...inputs,
      eis_strategy: { ...inputs.eis_strategy!, enabled: false },
    };
    map['no_eis'] = runSimulation(noEisInputs, register, taxParams);

    // Each EIS scenario
    for (const sc of ['worst_case', 'bear', 'base_case', 'bull'] as EISScenario[]) {
      const scInputs = {
        ...inputs,
        eis_strategy: { ...inputs.eis_strategy!, scenario: sc },
      };
      map[sc] = runSimulation(scInputs, register, taxParams);
    }

    return map;
  }, [inputs, register, taxParams]);

  const baseline = results['no_eis'].summary;

  const rows: { label: string; tip: string; getValue: (s: typeof baseline) => number; format?: (v: number) => string }[] = [
    { label: 'Funded Years', tip: 'Number of years the plan is fully funded', getValue: s => s.funded_years, format: v => `${v}` },
    { label: 'Estate at Plan End', tip: 'Total estate value at the end of the plan period', getValue: s => s.estate_at_end },
    { label: 'Net Estate After IHT', tip: 'Estate value after inheritance tax is deducted', getValue: s => s.net_estate_after_iht },
    { label: 'IHT Bill', tip: 'Inheritance tax payable at the end of the plan', getValue: s => s.iht_at_end },
    { label: 'Total Income Tax', tip: 'Total income tax paid over the plan period', getValue: s => s.total_income_tax_paid },
    { label: 'Total Tax Paid', tip: 'Combined income tax and CGT over the plan period', getValue: s => s.total_tax_paid },
    { label: 'EIS Portfolio Value', tip: 'Value of the EIS programme portfolio at plan end', getValue: s => s.eis_portfolio_base_case },
    { label: 'EIS IHT Exempt', tip: 'EIS holdings qualifying for Business Property Relief (IHT exempt after 2 years)', getValue: s => s.eis_iht_exempt },
    { label: 'EIS Relief Claimed', tip: 'Total income tax relief claimed on EIS/SEIS investments', getValue: s => s.eis_total_relief },
  ];

  const qualityLabel = inputs.eis_strategy?.quality_tier ?? 'base';
  const annualInvestment = (inputs.eis_strategy?.annual_eis_amount ?? 0) + (inputs.eis_strategy?.annual_seis_amount ?? 0);

  return (
    <div className="eis-comparison">
      <h3 className="eis-comparison-title">
        EIS Scenario Comparison <InfoTip text="Compares the plan with and without EIS across all scenarios. Deltas show the difference vs the No EIS baseline." />
      </h3>

      <div className="eis-comparison-table-wrap">
        <table className="eis-comparison-table">
          <thead>
            <tr>
              <th></th>
              {SCENARIOS.map(sc => (
                <th
                  key={sc.key}
                  className={sc.key === currentScenario ? 'eis-col-active' : ''}
                >
                  {sc.label.toUpperCase()} <InfoTip text={
                    sc.key === 'no_eis' ? 'Baseline: no EIS programme' :
                    sc.key === 'worst_case' ? 'All EIS investments fail completely' :
                    sc.key === 'bear' ? 'Below-average EIS portfolio returns' :
                    sc.key === 'base_case' ? 'Expected EIS portfolio returns' :
                    'Above-average EIS portfolio returns'
                  } />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.label}>
                <td className="eis-row-label">
                  {row.label} <InfoTip text={row.tip} />
                </td>
                {SCENARIOS.map(sc => {
                  const s = results[sc.key].summary;
                  const val = row.getValue(s);
                  const formatted = row.format ? row.format(val) : fmt(val);
                  const isBaseline = sc.key === 'no_eis';
                  const isActive = sc.key === currentScenario;
                  return (
                    <td key={sc.key} className={isActive ? 'eis-col-active' : ''}>
                      <span className="eis-cell-value">{formatted}</span>
                      {!isBaseline && delta(val, row.getValue(baseline))}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="eis-comparison-note">
        Deltas shown vs "No EIS" baseline. Your current scenario ({currentScenario === 'worst_case' ? 'all fail' : currentScenario.replace('_', ' ')}) is highlighted. Quality tier: {qualityLabel}. Annual investment: {fmt(annualInvestment)}.
      </p>
    </div>
  );
}
