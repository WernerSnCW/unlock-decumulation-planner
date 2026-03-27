import { Link } from 'wouter';
import { usePlanner } from '../context/PlannerContext';
import FundedYearsIndicator from '../components/FundedYearsIndicator';
import PortfolioChart from '../components/PortfolioChart';
import IHTChart from '../components/IHTChart';
import ActionPlan from '../components/ActionPlan';
import WarningsPanel from '../components/WarningsPanel';
import YearDetailTable from '../components/YearDetailTable';
import DisclosurePanel from '../components/DisclosurePanel';

export default function AnalysisPage() {
  const {
    inputs,
    assets,
    result,
    eisComparisonResult,
    allWarnings,
    taxParams,
  } = usePlanner();

  if (assets.length === 0) {
    return (
      <div className="page-placeholder">
        <h2>Add assets first</h2>
        <p>Go to the Portfolio tab to add your assets before viewing analysis.</p>
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

  const errorWarnings = allWarnings.filter(w => w.severity === 'error');
  const scenarioActive = inputs.apply_2026_bpr_cap || inputs.apply_2027_pension_iht;
  const hasShortfall = result.summary.funded_years < inputs.plan_years;

  return (
    <div className="analysis-page">
      <div className="page-intro">
        <h2>Analysis</h2>
        <p>Year-by-year projection of how your assets are drawn down, taxes paid, and estate value over the plan period.</p>
        <details className="page-tip">
          <summary>Tip</summary>
          <span>Scroll down to the Action Plan for specific steps in the first few years. The Year Detail table shows the full numbers behind each year.</span>
        </details>
      </div>

      {scenarioActive && (
        <div className="scenario-banner">
          <span>⚠</span>
          <span>
            One or more scenario assumptions are active. These model proposed rules that have not been enacted into law.
          </span>
        </div>
      )}

      {hasShortfall && (
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

      <FundedYearsIndicator
        summary={result.summary}
        planYears={inputs.plan_years}
        currentAge={inputs.current_age}
      />

      <PortfolioChart
        perYear={result.perYear}
        planYears={inputs.plan_years}
        firstShortfallYear={result.summary.first_shortfall_year}
        eisComparison={eisComparisonResult?.perYear ?? null}
        eisScenario={inputs.eis_strategy?.scenario ?? 'base_case'}
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

      <div className="next-step">
        <Link href="/app/report" className="next-step-btn">
          Next: View report →
        </Link>
      </div>
    </div>
  );
}
