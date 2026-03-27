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
      <div className="landing-glow landing-glow-1" />
      <div className="landing-glow landing-glow-2" />

      <div className="landing-split">
        {/* Left — branding & value prop */}
        <div className="landing-left">
          <div className="landing-logo">
            <UnlockLogo height={40} />
          </div>
          <p className="landing-subtitle">Decumulation Intelligence</p>

          <h2 className="landing-headline">
            Your retirement wealth is complex.<br />
            Your drawdown plan shouldn't be.
          </h2>

          <div className="landing-features">
            <div className="landing-feature">
              <span className="feature-dot" />
              <span>Tax-optimised drawdown sequencing across every wrapper</span>
            </div>
            <div className="landing-feature">
              <span className="feature-dot" />
              <span>25-year projection with income, growth, tax & estate</span>
            </div>
            <div className="landing-feature">
              <span className="feature-dot" />
              <span>IHT planning — BPR, gifting, pension exposure & 2026 budget</span>
            </div>
          </div>
        </div>

        {/* Right — access form + steps */}
        <div className="landing-right">
          <div className="landing-access-card">
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

          <div className="landing-steps">
            <div className="landing-step">
              <span className="step-num">1</span>
              <span>Import your portfolio</span>
            </div>
            <div className="landing-step">
              <span className="step-num">2</span>
              <span>Set your income target</span>
            </div>
            <div className="landing-step">
              <span className="step-num">3</span>
              <span>See the optimal strategy</span>
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
