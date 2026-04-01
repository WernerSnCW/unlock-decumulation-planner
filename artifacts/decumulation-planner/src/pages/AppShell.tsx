import { Route, Switch, useLocation, Link, Redirect } from 'wouter';
import { useAuth } from '../context/AuthContext';
import { PlannerProvider, usePlanner } from '../context/PlannerContext';
import LearningCentre from '../components/LearningCentre';
import SpotlightTour from '../components/SpotlightTour';
import PortfolioPage from './PortfolioPage';
import PlanningPage from './PlanningPage';
import AnalysisPage from './AnalysisPage';
import ReportPage from './ReportPage';
import { useState, useEffect } from 'react';
import UnlockLogo from '../components/UnlockLogo';
import { assessAsset } from '../lib/completenessChecks';

const NAV_ITEMS = [
  { path: '/app/portfolio', label: 'Portfolio', step: 1 },
  { path: '/app/planning', label: 'Planning', step: 2 },
  { path: '/app/analysis', label: 'Analysis', step: 3 },
  { path: '/app/report', label: 'Report', step: 4 },
] as const;

const VISITED_KEY = 'unlock_visited_pages';

function getConfidenceScore(assets: any[]): number {
  if (assets.length === 0) return 0;
  const totalValue = assets.reduce((s: number, a: any) => s + (a.current_value ?? 0), 0);
  if (totalValue === 0) return 0;
  return Math.round(
    assets.reduce((s: number, a: any) => s + assessAsset(a).score * (a.current_value ?? 0), 0) / totalValue
  );
}

function confidenceLabel(score: number): string {
  if (score >= 90) return 'High';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Fair';
  return 'Low';
}

function confidenceColor(score: number): string {
  if (score >= 90) return 'var(--tone-success)';
  if (score >= 70) return '#F59E0B';
  return '#EF4444';
}

function AppShellInner() {
  const { investor, logout } = useAuth();
  const { result, inputs, assets, isLoadingData } = usePlanner();
  const [location, setLocation] = useLocation();
  const [learningOpen, setLearningOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Auto-launch tour on first visit
  useEffect(() => {
    if (!localStorage.getItem('unlock_tour_completed')) {
      const timer = setTimeout(() => setTourOpen(true), 600);
      return () => clearTimeout(timer);
    }
  }, []);

  const confidence = getConfidenceScore(assets);
  const showConfidenceBanner = !bannerDismissed && assets.length > 0 && confidence < 70 &&
    ['/app/planning', '/app/analysis', '/app/report'].includes(location);

  const [visitedPages, setVisitedPages] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(VISITED_KEY);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    if (location && !visitedPages.has(location)) {
      const updated = new Set(visitedPages).add(location);
      setVisitedPages(updated);
      localStorage.setItem(VISITED_KEY, JSON.stringify([...updated]));
    }
  }, [location]);

  if (isLoadingData) {
    return (
      <div className="app-layout">
        <div className="app-loading">
          <UnlockLogo height={36} />
          <p>Loading your plan…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <header className="app-header">
        <UnlockLogo height={28} />
        <h1>Decumulation Planner</h1>

        <nav className="app-nav">
          {NAV_ITEMS.map(({ path, label, step }, i) => {
            const isActive = location === path;
            const isVisited = visitedPages.has(path);
            const showStep = !isVisited || isActive;
            return (
              <span key={path} className="nav-item-wrapper">
                <Link
                  href={path}
                  className={`nav-link ${isActive ? 'nav-link-active' : ''}`}
                  data-tour={label.toLowerCase()}
                >
                  {showStep && (
                    <span className={`nav-step-badge ${isActive ? 'nav-step-active' : ''}`}>
                      {step}
                    </span>
                  )}
                  {label}
                </Link>
                {i < NAV_ITEMS.length - 1 && (
                  <span className="nav-step-arrow">›</span>
                )}
              </span>
            );
          })}
        </nav>

        <div className="header-spacer" />

        {result && (
          <div className="header-funded">
            <span className={`funded-badge ${result.summary.fully_funded ? 'funded-ok' : 'funded-short'}`}>
              {result.summary.funded_years}/{inputs.plan_years}yr
            </span>
          </div>
        )}

        {assets.length > 0 && (
          <Link href="/app/portfolio" className="confidence-badge" style={{ '--conf-color': confidenceColor(confidence) } as React.CSSProperties} title={`Simulation confidence: ${confidence}% — based on data completeness across ${assets.length} assets`}>
            <span className="confidence-score">{confidence}%</span>
            <span className="confidence-label">{confidenceLabel(confidence)}</span>
          </Link>
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

      {learningOpen && (
        <LearningCentre
          onClose={() => setLearningOpen(false)}
          onStartTour={() => {
            setLearningOpen(false);
            setTourOpen(true);
          }}
        />
      )}

      {tourOpen && (
        <SpotlightTour
          onClose={() => setTourOpen(false)}
          navigate={setLocation}
        />
      )}

      <div className="app-body-full">
        {showConfidenceBanner && (
          <div className="confidence-banner" style={{ borderColor: confidenceColor(confidence) }}>
            <span>
              <strong>Simulation confidence: {confidence}%</strong> — some asset data is missing or estimated.
              Results may be less accurate.{' '}
              <Link href="/app/portfolio" className="confidence-banner-link">Review portfolio data →</Link>
            </span>
            <button className="confidence-banner-dismiss" onClick={() => setBannerDismissed(true)}>×</button>
          </div>
        )}
        <Switch>
          <Route path="/app/portfolio" component={PortfolioPage} />
          <Route path="/app/planning" component={PlanningPage} />
          <Route path="/app/analysis" component={AnalysisPage} />
          <Route path="/app/report" component={ReportPage} />
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
