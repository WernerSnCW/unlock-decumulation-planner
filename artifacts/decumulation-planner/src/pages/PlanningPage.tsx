import { usePlanner } from '../context/PlannerContext';
import InputPanel from '../components/InputPanel';
import OptimiserPanel from '../components/OptimiserPanel';
import StrategyComparison from '../components/StrategyComparison';

export default function PlanningPage() {
  const {
    inputs,
    assets,
    result,
    optimiserResult,
    optimiserRunning,
    taxParams,
    updateInputs,
    runOptimiserAction,
    applyOptimiser,
  } = usePlanner();

  if (assets.length === 0) {
    return (
      <div className="page-placeholder">
        <h2>Add assets first</h2>
        <p>Go to the Portfolio tab to add your assets before configuring your plan.</p>
      </div>
    );
  }

  return (
    <div className="planning-page">
      <div className="planning-layout">
        <div className="planning-sidebar">
          <InputPanel
            inputs={inputs}
            summary={result?.summary ?? null}
            onChange={updateInputs}
          />
        </div>
        <div className="planning-main">
          {result && (
            <>
              <OptimiserPanel
                inputs={inputs}
                optimiserResult={optimiserResult}
                optimiserRunning={optimiserRunning}
                onRunOptimiser={runOptimiserAction}
                onApply={applyOptimiser}
              />
              <StrategyComparison
                inputs={inputs}
                register={assets}
                taxParams={taxParams}
              />
            </>
          )}

          {!result && (
            <div className="page-placeholder">
              <h2>Simulation error</h2>
              <p>Check your inputs and try again.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
