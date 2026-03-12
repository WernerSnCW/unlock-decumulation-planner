import type { SimulationSummary } from '../engine/decumulation';

interface Props {
  summary: SimulationSummary;
  planYears: number;
  currentAge: number;
}

function formatMoney(value: number): string {
  if (Math.abs(value) >= 10000) {
    return '£' + Math.round(value).toLocaleString('en-GB');
  }
  return '£' + value.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export default function FundedYearsIndicator({ summary, planYears, currentAge }: Props) {
  const fullyFunded = summary.funded_years >= planYears && summary.shadow_funded_years >= Math.max(planYears, 90 - currentAge);
  const partiallyFunded = summary.funded_years >= planYears && !fullyFunded;
  const shortfall = summary.funded_years < planYears;

  const statusClass = shortfall ? 'funded-red' : partiallyFunded ? 'funded-amber' : 'funded-green';
  const statusLabel = shortfall
    ? `Shortfall in year ${summary.first_shortfall_year}`
    : partiallyFunded
    ? `Funded for ${summary.funded_years} years — review age 90 projection`
    : `Funded for ${summary.funded_years} years ✓`;

  return (
    <div className="summary-grid">
      <div className="summary-card accent-glow">
        <div className="label">Funded Years</div>
        <div className={`value ${statusClass}`}>{summary.funded_years}</div>
        <div style={{ fontSize: 12, color: 'var(--unlock-muted)', marginTop: 4 }}>
          of {planYears} planned
        </div>
        <div className={statusClass} style={{ fontSize: 12, marginTop: 4, fontWeight: 500 }}>
          {statusLabel}
        </div>
      </div>

      <div className="summary-card">
        <div className="label">Total Tax Paid</div>
        <div className="mono" style={{ color: 'var(--unlock-text)' }}>
          {formatMoney(summary.total_tax_paid)}
        </div>
        <div style={{ fontSize: 11, color: 'var(--unlock-muted)', marginTop: 4 }}>
          Income: {formatMoney(summary.total_income_tax_paid)} · CGT: {formatMoney(summary.total_cgt_paid)}
        </div>
      </div>

      <div className="summary-card">
        <div className="label">Estate at Plan End</div>
        <div className="mono" style={{ color: 'var(--unlock-text)' }}>
          {formatMoney(summary.estate_at_end)}
        </div>
      </div>

      <div className="summary-card">
        <div className="label">IHT at Plan End</div>
        <div className="mono" style={{ color: 'var(--chart-iht)' }}>
          {formatMoney(summary.iht_at_end)}
        </div>
      </div>
    </div>
  );
}
