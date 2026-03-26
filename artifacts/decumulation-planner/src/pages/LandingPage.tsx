import { useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLocation } from 'wouter';

export default function LandingPage() {
  const { login, error, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const [code, setCode] = useState('');

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    const ok = await login(code.trim());
    if (ok) navigate('/app');
  }, [code, login, navigate]);

  return (
    <div className="landing-page">
      {/* Background glow effects */}
      <div className="landing-glow landing-glow-1" />
      <div className="landing-glow landing-glow-2" />

      <div className="landing-content">
        {/* Hero */}
        <div className="landing-hero">
          <div className="landing-logo">
            <span className="landing-logo-letter">U</span>
          </div>
          <h1 className="landing-title">Unlock</h1>
          <p className="landing-subtitle">Decumulation Intelligence</p>
        </div>

        {/* Problem statement */}
        <div className="landing-message">
          <h2>Your retirement wealth is complex.<br />Your drawdown plan shouldn't be.</h2>
          <p>
            Pensions, ISAs, property, VCTs, EIS holdings, AIM portfolios — each with
            different tax rules, growth profiles, and IHT implications. The order you
            draw from them can mean the difference between tens of thousands saved or lost in tax.
          </p>
        </div>

        {/* Key benefits */}
        <div className="landing-benefits">
          <div className="landing-benefit">
            <div className="benefit-icon">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 1L12.5 6.5L18 7.5L14 11.5L15 17L10 14.5L5 17L6 11.5L2 7.5L7.5 6.5L10 1Z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
              </svg>
            </div>
            <h3>Tax-Optimised Sequencing</h3>
            <p>Model income tax, CGT, pension crystallisation, and allowance stacking across every asset wrapper</p>
          </div>
          <div className="landing-benefit">
            <div className="benefit-icon">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M2 15L6 8L10 11L14 4L18 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="18" cy="7" r="1.5" fill="currentColor"/>
              </svg>
            </div>
            <h3>25-Year Projection</h3>
            <p>See exactly how your portfolio evolves year by year — income, growth, tax, and residual estate value</p>
          </div>
          <div className="landing-benefit">
            <div className="benefit-icon">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="3" y="8" width="4" height="9" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                <rect x="8" y="5" width="4" height="12" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                <rect x="13" y="3" width="4" height="14" rx="1" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
            </div>
            <h3>IHT & Estate Planning</h3>
            <p>Quantify BPR relief, gifting strategies, pension IHT exposure, and the 2026 budget impact on your estate</p>
          </div>
        </div>

        {/* How it works */}
        <div className="landing-how">
          <div className="landing-how-step">
            <div className="how-num">1</div>
            <div>
              <h4>Import your portfolio</h4>
              <p>Upload a CSV or enter assets manually — pensions, ISAs, property, tax-advantaged holdings</p>
            </div>
          </div>
          <div className="landing-how-step">
            <div className="how-num">2</div>
            <div>
              <h4>Set your income target</h4>
              <p>Define your desired retirement income, lifestyle phases, and legacy goals</p>
            </div>
          </div>
          <div className="landing-how-step">
            <div className="how-num">3</div>
            <div>
              <h4>See the optimal strategy</h4>
              <p>Compare drawdown sequences, run the optimiser, and export a year-by-year action plan</p>
            </div>
          </div>
        </div>

        {/* Access code entry */}
        <div className="landing-access">
          <h3>Enter your access code</h3>
          <form onSubmit={handleSubmit} className="access-form">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="XXXX-XXXX"
              className="access-input"
              maxLength={9}
              autoFocus
              disabled={isLoading}
            />
            <button
              type="submit"
              className="access-button"
              disabled={isLoading || !code.trim()}
            >
              {isLoading ? 'Verifying...' : 'Continue'}
            </button>
          </form>
          {error && <p className="access-error">{error}</p>}
          <p className="access-hint">
            Your access code was provided by your financial advisor.
          </p>
        </div>

        {/* Subtle admin link */}
        <div className="landing-footer">
          <a href="/admin" className="admin-link">Admin</a>
        </div>
      </div>
    </div>
  );
}
