import { Route, Switch, useLocation, Link, Redirect } from 'wouter';
import { useAuth } from '../context/AuthContext';
import { PlannerProvider, usePlanner } from '../context/PlannerContext';
import LearningCentre from '../components/LearningCentre';
import PortfolioPage from './PortfolioPage';
import PlanningPage from './PlanningPage';
import { useState } from 'react';

// Placeholder pages — will be replaced in Phase 4b
function AnalysisPlaceholder() {
  return (
    <div className="page-placeholder">
      <h2>Analysis</h2>
      <p>Charts, action plan, and detailed results coming in the next phase.</p>
    </div>
  );
}

function ReportPlaceholder() {
  return (
    <div className="page-placeholder">
      <h2>Report</h2>
      <p>Summary and PDF export coming in the next phase.</p>
    </div>
  );
}

const NAV_ITEMS = [
  { path: '/app/portfolio', label: 'Portfolio' },
  { path: '/app/planning', label: 'Planning' },
  { path: '/app/analysis', label: 'Analysis' },
  { path: '/app/report', label: 'Report' },
] as const;

function AppShellInner() {
  const { investor, logout } = useAuth();
  const { result, inputs, isLoadingData } = usePlanner();
  const [location] = useLocation();
  const [learningOpen, setLearningOpen] = useState(false);

  if (isLoadingData) {
    return (
      <div className="app-layout">
        <div className="app-loading">
          <div className="landing-logo">U</div>
          <p>Loading your plan…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="logo">U</div>
        <h1>Decumulation Planner</h1>

        <nav className="app-nav">
          {NAV_ITEMS.map(({ path, label }) => (
            <Link
              key={path}
              href={path}
              className={`nav-link ${location === path ? 'nav-link-active' : ''}`}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="header-spacer" />

        {result && (
          <div className="header-funded">
            <span className={`funded-badge ${result.summary.fully_funded ? 'funded-ok' : 'funded-short'}`}>
              {result.summary.funded_years}/{inputs.plan_years}yr
            </span>
          </div>
        )}

        <button
          className="edit-assets-btn learn-btn"
          onClick={() => setLearningOpen(true)}
        >
          Learn
        </button>

        <div className="header-user">
          <span className="user-name">{investor?.name}</span>
          <button className="logout-btn" onClick={logout}>
            Log out
          </button>
        </div>

        <span className="subtitle">Planning estimate — not financial advice</span>
      </header>

      {learningOpen && <LearningCentre onClose={() => setLearningOpen(false)} />}

      <div className="app-body-full">
        <Switch>
          <Route path="/app/portfolio" component={PortfolioPage} />
          <Route path="/app/planning" component={PlanningPage} />
          <Route path="/app/analysis" component={AnalysisPlaceholder} />
          <Route path="/app/report" component={ReportPlaceholder} />
          <Route>
            <Redirect to="/app/portfolio" />
          </Route>
        </Switch>
      </div>
    </div>
  );
}

export default function AppShell() {
  return (
    <PlannerProvider>
      <AppShellInner />
    </PlannerProvider>
  );
}
