import { useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLocation } from 'wouter';
import UnlockLogo from '../components/UnlockLogo';

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
      {/* Background effects */}
      <div className="landing-glow landing-glow-1" />
      <div className="landing-glow landing-glow-2" />
      <div className="landing-grid-bg" />

      <div className="landing-split">
        {/* Left — branding & value prop */}
        <div className="landing-left">
          <div className="landing-logo">
            <UnlockLogo height={44} />
          </div>
          <p className="landing-subtitle">Decumulation Intelligence</p>

          <h2 className="landing-headline">
            Your retirement wealth is complex.<br />
            Your drawdown plan shouldn&rsquo;t be.
          </h2>

          <p className="landing-description">
            Pensions, ISAs, property, VCTs, EIS holdings, AIM portfolios &mdash; each with
            different tax rules, growth profiles, and IHT implications. The order you
            draw from them matters.
          </p>

          <div className="landing-features">
            <div className="landing-feature-card">
              <div className="feature-card-icon">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 1L12.5 6.5L18 7.5L14 11.5L15 17L10 14.5L5 17L6 11.5L2 7.5L7.5 6.5L10 1Z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                </svg>
              </div>
              <div>
                <strong>Tax-Optimised Sequencing</strong>
                <span>Income tax, CGT, and allowance stacking across every wrapper</span>
              </div>
            </div>
            <div className="landing-feature-card">
              <div className="feature-card-icon">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M2 15L6 8L10 11L14 4L18 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="18" cy="7" r="1.5" fill="currentColor"/>
                </svg>
              </div>
              <div>
                <strong>25-Year Projection</strong>
                <span>Year-by-year income, growth, tax, and estate value</span>
              </div>
            </div>
            <div className="landing-feature-card">
              <div className="feature-card-icon">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <rect x="3" y="8" width="4" height="9" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                  <rect x="8" y="5" width="4" height="12" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                  <rect x="13" y="3" width="4" height="14" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                </svg>
              </div>
              <div>
                <strong>IHT &amp; Estate Planning</strong>
                <span>BPR relief, gifting strategies, and 2026 budget impact</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right — access form & steps */}
        <div className="landing-right">
          <div className="landing-access-card">
            <div className="access-card-header">
              <div className="access-card-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <h3>Access Your Plan</h3>
              <p className="access-card-desc">Enter the code provided by your financial advisor</p>
            </div>
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
          </div>

          <div className="landing-steps-row">
            <div className="landing-step-item">
              <span className="step-num">1</span>
              <div>
                <strong>Import portfolio</strong>
                <span>CSV or manual entry</span>
              </div>
            </div>
            <div className="step-divider" />
            <div className="landing-step-item">
              <span className="step-num">2</span>
              <div>
                <strong>Set income target</strong>
                <span>Lifestyle &amp; legacy goals</span>
              </div>
            </div>
            <div className="step-divider" />
            <div className="landing-step-item">
              <span className="step-num">3</span>
              <div>
                <strong>See optimal strategy</strong>
                <span>Drawdown &amp; action plan</span>
              </div>
            </div>
          </div>

          <div className="landing-footer">
            <a href="/admin" className="admin-link">Admin Portal</a>
          </div>
        </div>
      </div>
    </div>
  );
}
