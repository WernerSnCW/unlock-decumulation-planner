import { usePlanner } from '../context/PlannerContext';
import { useAuth } from '../context/AuthContext';
import ExportPDF from '../components/ExportPDF';
import PageGuide from '../components/PageGuide';

function fmt(n: number): string {
  return '£' + Math.round(n).toLocaleString('en-GB');
}

function pct(n: number): string {
  return (n * 100).toFixed(1) + '%';
}

const ASSET_CLASS_LABELS: Record<string, string> = {
  cash: 'Cash',
  isa: 'ISA',
  pension: 'Pension',
  property_investment: 'Investment Property',
  property_residential: 'Residential Property',
  vct: 'VCT',
  eis: 'EIS',
  aim_shares: 'AIM Shares',
};

export default function ReportPage() {
  const { inputs, assets, result, taxParams } = usePlanner();
  const { investor } = useAuth();

  if (assets.length === 0) {
    return (
      <div className="page-placeholder">
        <h2>Add assets first</h2>
        <p>Go to the Portfolio tab to add your assets before generating a report.</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="page-placeholder">
        <h2>Simulation error</h2>
        <p>Check your inputs on the Planning tab and try again.</p>
      </div>
    );
  }

  const s = result.summary;

  // Derived values
  const totalPortfolio = assets.reduce((sum, a) => sum + (a.current_value ?? 0), 0);
  const totalIncome = assets.reduce((sum, a) => sum + (a.income_generated ?? 0), 0);
  const baselinePensionIncome = inputs.state_pension_annual + inputs.private_pension_income;
  const effectiveTaxRate = s.total_spent > 0 ? s.total_tax_paid / s.total_spent : 0;
  const ihtAsEstatePercent = s.estate_at_end > 0 ? s.iht_at_end / s.estate_at_end : 0;

  // Asset class breakdown
  const classTotals: Record<string, number> = {};
  for (const a of assets) {
    const cls = a.asset_class ?? 'cash';
    classTotals[cls] = (classTotals[cls] ?? 0) + (a.current_value ?? 0);
  }
  const sortedClasses = Object.entries(classTotals).sort((a, b) => b[1] - a[1]);

  // Growth rate range
  const growthRates = assets.map(a => a.assumed_growth_rate ?? 0);
  const minGrowth = Math.min(...growthRates);
  const maxGrowth = Math.max(...growthRates);
  const avgGrowth = growthRates.length > 0
    ? growthRates.reduce((s, r) => s + r, 0) / growthRates.length
    : 0;

  return (
    <div className="report-page">
      <div className="page-intro">
        <PageGuide
          title="Report"
          summary="Review a summary of the full simulation and export it as a PDF."
          actions={[
            'Compare total tax paid vs doing nothing',
            'Check your effective tax rate and final estate value',
            'Export the report as PDF for your records or adviser',
          ]}
          tips={[
            'The report reflects whatever strategy is currently active on the Planning page',
            'PDF export includes all charts and the action plan',
          ]}
        />
        <h2>Report</h2>
        <p>Summary of your plan for review. Export as PDF to share with your advisor or keep for your records.</p>
      </div>

      <div className="report-header">
        <h2>Plan Summary</h2>
        <ExportPDF
          inputs={inputs}
          result={result}
          assets={assets}
          taxParams={taxParams}
          investorName={investor?.name}
        />
      </div>

      <div className="report-grid">
        {/* Portfolio Overview */}
        <div className="report-section">
          <h3>Portfolio</h3>
          <div className="report-rows">
            <div className="report-row">
              <span>Total value</span>
              <span className="val-highlight">{fmt(totalPortfolio)}</span>
            </div>
            <div className="report-row">
              <span>Number of assets</span>
              <span>{assets.length}</span>
            </div>
            <div className="report-row">
              <span>Annual asset income</span>
              <span>{fmt(totalIncome)}</span>
            </div>
            <div className="report-divider" />
            {sortedClasses.map(([cls, val]) => (
              <div className="report-row sub" key={cls}>
                <span>{ASSET_CLASS_LABELS[cls] ?? cls}</span>
                <span>{fmt(val)} ({pct(val / totalPortfolio)})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Funding */}
        <div className="report-section">
          <h3>Funding</h3>
          <div className="report-rows">
            <div className="report-row">
              <span>Funded years</span>
              <span className={s.fully_funded ? 'val-ok' : 'val-warn'}>
                {s.funded_years} / {inputs.plan_years}
              </span>
            </div>
            <div className="report-row">
              <span>Age range</span>
              <span>{inputs.current_age} to {inputs.current_age + inputs.plan_years}</span>
            </div>
            <div className="report-row">
              <span>Annual income target</span>
              <span>{fmt(inputs.annual_income_target)} {inputs.income_is_net ? '(net)' : '(gross)'}</span>
            </div>
            {inputs.income_is_net && s.grossed_up_income > 0 && (
              <div className="report-row sub">
                <span>Gross equivalent</span>
                <span>{fmt(s.grossed_up_income)}</span>
              </div>
            )}
            <div className="report-row">
              <span>Lifestyle level</span>
              <span>{inputs.lifestyle_multiplier.charAt(0).toUpperCase() + inputs.lifestyle_multiplier.slice(1)}</span>
            </div>
            {s.first_shortfall_year !== null && (
              <div className="report-row">
                <span>First shortfall</span>
                <span className="val-warn">Year {s.first_shortfall_year} (age {inputs.current_age + s.first_shortfall_year - 1})</span>
              </div>
            )}
          </div>
        </div>

        {/* Income Sources */}
        <div className="report-section">
          <h3>Income Sources</h3>
          <div className="report-rows">
            {inputs.state_pension_annual > 0 && (
              <div className="report-row">
                <span>State pension</span>
                <span>{fmt(inputs.state_pension_annual)}/yr</span>
              </div>
            )}
            {inputs.private_pension_income > 0 && (
              <div className="report-row">
                <span>Private pension</span>
                <span>{fmt(inputs.private_pension_income)}/yr</span>
              </div>
            )}
            {totalIncome > 0 && (
              <div className="report-row">
                <span>Asset income (dividends, rent)</span>
                <span>{fmt(totalIncome)}/yr</span>
              </div>
            )}
            <div className="report-divider" />
            <div className="report-row">
              <span>Total baseline income</span>
              <span className="val-highlight">{fmt(baselinePensionIncome + totalIncome)}/yr</span>
            </div>
            <div className="report-row sub">
              <span>Shortfall to fund from drawdown</span>
              <span>{fmt(Math.max(0, inputs.annual_income_target - baselinePensionIncome - totalIncome))}/yr</span>
            </div>
          </div>
        </div>

        {/* Spending & Tax */}
        <div className="report-section">
          <h3>Spending &amp; Tax</h3>
          <div className="report-rows">
            <div className="report-row">
              <span>Total spend over plan</span>
              <span>{fmt(s.total_spent)}</span>
            </div>
            <div className="report-row">
              <span>Income tax</span>
              <span>{fmt(s.total_income_tax_paid)}</span>
            </div>
            <div className="report-row">
              <span>Capital gains tax</span>
              <span>{fmt(s.total_cgt_paid)}</span>
            </div>
            <div className="report-divider" />
            <div className="report-row">
              <span>Total tax paid</span>
              <span className="val-warn">{fmt(s.total_tax_paid)}</span>
            </div>
            <div className="report-row sub">
              <span>Effective tax rate</span>
              <span>{pct(effectiveTaxRate)}</span>
            </div>
          </div>
        </div>

        {/* Estate & IHT */}
        <div className="report-section">
          <h3>Estate &amp; IHT</h3>
          <div className="report-rows">
            <div className="report-row">
              <span>Estate at plan end</span>
              <span>{fmt(s.estate_at_end)}</span>
            </div>
            <div className="report-row">
              <span>IHT liability</span>
              <span className={s.iht_at_end > 0 ? 'val-warn' : 'val-ok'}>
                {fmt(s.iht_at_end)}
              </span>
            </div>
            {s.estate_at_end > 0 && s.iht_at_end > 0 && (
              <div className="report-row sub">
                <span>IHT as % of estate</span>
                <span>{pct(ihtAsEstatePercent)}</span>
              </div>
            )}
            <div className="report-row">
              <span>Net estate to beneficiaries</span>
              <span className="val-highlight">{fmt(s.net_estate_after_iht)}</span>
            </div>
            <div className="report-divider" />
            <div className="report-row">
              <span>IHT with no plan (baseline)</span>
              <span>{fmt(s.iht_no_plan_baseline)}</span>
            </div>
            <div className="report-row">
              <span>IHT saved by this plan</span>
              <span className={s.iht_saving_vs_no_plan > 0 ? 'val-ok' : ''}>
                {fmt(s.iht_saving_vs_no_plan)}
              </span>
            </div>
            {s.legacy_target > 0 && (
              <>
                <div className="report-divider" />
                <div className="report-row">
                  <span>Legacy target</span>
                  <span>{fmt(s.legacy_target)}</span>
                </div>
                <div className="report-row">
                  <span>Legacy shortfall</span>
                  <span className={s.legacy_shortfall > 0 ? 'val-warn' : 'val-ok'}>
                    {s.legacy_shortfall > 0 ? fmt(s.legacy_shortfall) : 'None'}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Gifting */}
        <div className="report-section">
          <h3>Gifting</h3>
          <div className="report-rows">
            <div className="report-row">
              <span>Annual gift amount</span>
              <span>{fmt(inputs.annual_gift_amount)}/yr</span>
            </div>
            <div className="report-row">
              <span>Gift type</span>
              <span>{inputs.gift_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
            </div>
            <div className="report-row">
              <span>Total gifted</span>
              <span>{fmt(s.total_gifted)}</span>
            </div>
            <div className="report-row">
              <span>IHT saved by gifting</span>
              <span className={s.iht_saving_vs_no_plan > 0 ? 'val-ok' : ''}>
                {fmt(s.iht_saving_vs_no_plan)}
              </span>
            </div>
          </div>
        </div>

        {/* EIS Programme */}
        {s.eis_total_invested > 0 && (
          <div className="report-section">
            <h3>EIS Programme</h3>
            <div className="report-rows">
              <div className="report-row">
                <span>Total invested</span>
                <span>{fmt(s.eis_total_invested)}</span>
              </div>
              <div className="report-row">
                <span>Investment period</span>
                <span>{s.eis_investment_years} years</span>
              </div>
              <div className="report-row">
                <span>Income tax relief (30%)</span>
                <span className="val-ok">{fmt(s.eis_total_relief)}</span>
              </div>
              <div className="report-row">
                <span>CGT deferral</span>
                <span>{fmt(s.eis_cgt_deferral)}</span>
              </div>
              <div className="report-divider" />
              <div className="report-row">
                <span>Portfolio (base case)</span>
                <span>{fmt(s.eis_portfolio_base_case)}</span>
              </div>
              <div className="report-row">
                <span>Portfolio (worst case)</span>
                <span className="val-warn">{fmt(s.eis_portfolio_worst_case)}</span>
              </div>
              <div className="report-row">
                <span>Worst case net cost</span>
                <span>{fmt(s.eis_worst_case_net_cost)}</span>
              </div>
              <div className="report-divider" />
              <div className="report-row">
                <span>IHT exempt (after 2yr hold)</span>
                <span className="val-ok">{fmt(s.eis_iht_exempt)}</span>
              </div>
            </div>
          </div>
        )}

        {/* VCT Programme */}
        {s.vct_total_invested > 0 && (
          <div className="report-section">
            <h3>VCT Programme</h3>
            <div className="report-rows">
              <div className="report-row">
                <span>Total invested</span>
                <span>{fmt(s.vct_total_invested)}</span>
              </div>
              <div className="report-row">
                <span>Income tax relief (30%)</span>
                <span className="val-ok">{fmt(s.vct_total_relief)}</span>
              </div>
              <div className="report-row">
                <span>Tax-free dividends</span>
                <span className="val-ok">{fmt(s.vct_total_dividends)}</span>
              </div>
              <div className="report-divider" />
              <div className="report-row">
                <span>Portfolio (base case)</span>
                <span>{fmt(s.vct_portfolio_base_case)}</span>
              </div>
              <div className="report-row">
                <span>Portfolio (worst case)</span>
                <span className="val-warn">{fmt(s.vct_portfolio_worst_case)}</span>
              </div>
              <div className="report-row">
                <span>Total proceeds returned</span>
                <span>{fmt(s.vct_total_proceeds_returned)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Key Assumptions */}
        <div className="report-section report-section-muted">
          <h3>Key Assumptions</h3>
          <div className="report-rows">
            <div className="report-row">
              <span>Inflation rate</span>
              <span>{pct(inputs.inflation_rate)}</span>
            </div>
            <div className="report-row">
              <span>Growth rate range</span>
              <span>{pct(minGrowth)} – {pct(maxGrowth)}</span>
            </div>
            <div className="report-row">
              <span>Avg growth rate (weighted)</span>
              <span>{pct(avgGrowth)}</span>
            </div>
            <div className="report-row">
              <span>Cash reserve</span>
              <span>{fmt(inputs.cash_reserve)}</span>
            </div>
            {inputs.apply_2026_bpr_cap && (
              <div className="report-row">
                <span>2026 BPR cap</span>
                <span className="val-warn">Active</span>
              </div>
            )}
            {inputs.apply_2027_pension_iht && (
              <div className="report-row">
                <span>2027 Pension IHT</span>
                <span className="val-warn">Active</span>
              </div>
            )}
            {inputs.glory_years?.enabled && (
              <div className="report-row">
                <span>Glory years</span>
                <span>{inputs.glory_years.duration}yr at +{((inputs.glory_years.multiplier - 1) * 100).toFixed(0)}%</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="report-disclaimer">
        This is a planning estimate and does not constitute financial advice.
        All projections are based on assumed growth rates, current tax legislation,
        and the inputs provided. Actual outcomes may differ materially.
      </p>
    </div>
  );
}
