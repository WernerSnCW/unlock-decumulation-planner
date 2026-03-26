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
      <div className="landing-content">
        {/* Hero */}
        <div className="landing-hero">
          <div className="landing-logo">U</div>
          <h1 className="landing-title">Unlock</h1>
          <p className="landing-subtitle">Decumulation Planner</p>
        </div>

        {/* Problem statement */}
        <div className="landing-message">
          <h2>Your retirement wealth is complex.<br />Your plan shouldn't be.</h2>
          <p>
            Multiple asset types, tax wrappers, pension rules, inheritance tax —
            drawing down your wealth in retirement involves dozens of moving parts.
            Getting the sequence wrong can cost tens of thousands in unnecessary tax.
          </p>
          <p>
            Unlock models your complete financial picture year by year, optimising
            when and how you draw from each asset to minimise tax and maximise
            what you keep.
          </p>
        </div>

        {/* Key benefits */}
        <div className="landing-benefits">
          <div className="landing-benefit">
            <div className="benefit-icon">£</div>
            <h3>Tax-Optimised Drawdown</h3>
            <p>Model income tax, CGT, and pension rules across your full portfolio</p>
          </div>
          <div className="landing-benefit">
            <div className="benefit-icon">⟳</div>
            <h3>Year-by-Year Projection</h3>
            <p>See exactly how your assets evolve over 25+ years of retirement</p>
          </div>
          <div className="landing-benefit">
            <div className="benefit-icon">⛊</div>
            <h3>Estate Planning</h3>
            <p>Minimise inheritance tax with BPR, trusts, and gifting strategies</p>
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
              {isLoading ? 'Verifying…' : 'Continue'}
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
