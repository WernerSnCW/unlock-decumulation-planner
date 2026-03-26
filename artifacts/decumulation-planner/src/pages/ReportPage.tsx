import { usePlanner } from '../context/PlannerContext';
import ExportPDF from '../components/ExportPDF';

function fmt(n: number): string {
  return '£' + Math.round(n).toLocaleString('en-GB');
}

function pct(n: number): string {
  return (n * 100).toFixed(1) + '%';
}

export default function ReportPage() {
  const { inputs, assets, result, taxParams } = usePlanner();

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

  return (
    <div className="report-page">
      <div className="report-header">
        <h2>Plan Summary</h2>
        <ExportPDF
          inputs={inputs}
          result={result}
          assets={assets}
          taxParams={taxParams}
        />
      </div>

      <div className="report-grid">
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
              <span>Starting age</span>
              <span>{inputs.current_age}</span>
            </div>
            <div className="report-row">
              <span>Plan end age</span>
              <span>{inputs.current_age + inputs.plan_years}</span>
            </div>
            <div className="report-row">
              <span>Annual income target</span>
              <span>{fmt(inputs.annual_income_target)} {inputs.income_is_net ? '(net)' : '(gross)'}</span>
            </div>
          </div>
        </div>

        {/* Spending */}
        <div className="report-section">
          <h3>Spending</h3>
          <div className="report-rows">
            <div className="report-row">
              <span>Total spend</span>
              <span>{fmt(s.total_spend)}</span>
            </div>
            <div className="report-row">
              <span>Total income tax</span>
              <span>{fmt(s.total_income_tax)}</span>
            </div>
            <div className="report-row">
              <span>Total CGT</span>
              <span>{fmt(s.total_cgt)}</span>
            </div>
            <div className="report-row">
              <span>Total tax paid</span>
              <span>{fmt(s.total_tax)}</span>
            </div>
          </div>
        </div>

        {/* Estate */}
        <div className="report-section">
          <h3>Estate</h3>
          <div className="report-rows">
            <div className="report-row">
              <span>Estate at end</span>
              <span>{fmt(s.estate_at_end)}</span>
            </div>
            <div className="report-row">
              <span>IHT bill</span>
              <span className={s.iht_bill > 0 ? 'val-warn' : 'val-ok'}>
                {fmt(s.iht_bill)}
              </span>
            </div>
            <div className="report-row">
              <span>Net estate after IHT</span>
              <span>{fmt(s.net_estate_after_iht)}</span>
            </div>
            {s.legacy_target > 0 && (
              <div className="report-row">
                <span>Legacy target</span>
                <span className={s.legacy_shortfall > 0 ? 'val-warn' : 'val-ok'}>
                  {fmt(s.legacy_target)}
                  {s.legacy_shortfall > 0 && ` (shortfall: ${fmt(s.legacy_shortfall)})`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Gifts */}
        <div className="report-section">
          <h3>Gifting</h3>
          <div className="report-rows">
            <div className="report-row">
              <span>Total gifted</span>
              <span>{fmt(s.total_gifted)}</span>
            </div>
            <div className="report-row">
              <span>IHT savings</span>
              <span className="val-ok">{fmt(s.iht_savings_vs_baseline)}</span>
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
                <span>Income tax relief</span>
                <span className="val-ok">{fmt(s.eis_total_relief)}</span>
              </div>
              <div className="report-row">
                <span>Portfolio (base case)</span>
                <span>{fmt(s.eis_portfolio_base)}</span>
              </div>
              <div className="report-row">
                <span>IHT exempt amount</span>
                <span>{fmt(s.eis_iht_exempt_amount)}</span>
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
                <span>Income tax relief</span>
                <span className="val-ok">{fmt(s.vct_total_relief)}</span>
              </div>
              <div className="report-row">
                <span>Tax-free dividends</span>
                <span>{fmt(s.vct_total_dividends)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <p className="report-disclaimer">
        This is a planning estimate and does not constitute financial advice.
        All projections are based on assumed growth rates, current tax legislation,
        and the inputs provided. Actual outcomes may differ materially.
      </p>
    </div>
  );
}
