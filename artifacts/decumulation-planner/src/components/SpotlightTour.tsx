import { useState, useEffect, useCallback, useRef } from 'react';

interface TourStep {
  target: string;
  title: string;
  description: string;
  navigateTo?: string;
  position: 'below' | 'above' | 'right';
}

const TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="portfolio"]',
    title: 'Portfolio',
    description:
      'This is your asset register. Add each wrapper — ISAs, SIPPs, GIAs, VCTs, property — with current values and key details. The more complete your data, the more accurate the simulation. You can type them in or import from a CSV.',
    position: 'below',
  },
  {
    target: '[data-tour="planning"]',
    title: 'Planning',
    description:
      'Set your target annual income, your age, and how many years you want the plan to cover. Then choose a drawdown strategy — tax-optimised, IHT-optimised, or balanced. The engine runs immediately and reacts to every change.',
    position: 'below',
  },
  {
    target: '[data-tour="analysis"]',
    title: 'Analysis',
    description:
      'This is where the output lives. The portfolio chart shows which assets are drawn down in which year. The IHT chart tracks your estate\'s inheritance tax exposure over time. The action plan tells you exactly what to do and when.',
    position: 'below',
  },
  {
    target: '[data-tour="report"]',
    title: 'Report',
    description:
      'A summary of the full simulation — total tax paid, effective rate, estate value, and how much you save compared to doing nothing. You can export this as a PDF.',
    position: 'below',
  },
  {
    target: '[data-tour="settings-bar"]',
    title: 'Settings',
    description:
      'You don\'t need to change these to get started, but this is where you fine-tune: EIS/VCT programmes, estate planning options, inflation assumptions, and more. Open it any time from the Planning page.',
    navigateTo: '/app/planning',
    position: 'below',
  },
];

interface SpotlightTourProps {
  onClose: () => void;
  navigate: (path: string) => void;
}

export default function SpotlightTour({ onClose, navigate }: SpotlightTourProps) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const rafRef = useRef(0);

  const finish = useCallback(() => {
    localStorage.setItem('unlock_tour_completed', 'true');
    onClose();
  }, [onClose]);

  // Find and measure the target element
  const measureTarget = useCallback(() => {
    const current = TOUR_STEPS[step];
    if (!current) return;

    const el = document.querySelector(current.target);
    if (el) {
      const r = el.getBoundingClientRect();
      setRect(r);
      return true;
    }
    return false;
  }, [step]);

  // Navigate if needed, then poll for the target element
  useEffect(() => {
    const current = TOUR_STEPS[step];
    if (!current) return;

    if (current.navigateTo) {
      navigate(current.navigateTo);
    }

    // Poll for the target element (it may not be rendered yet after navigation)
    let attempts = 0;
    const maxAttempts = 30;

    const poll = () => {
      if (measureTarget()) return;
      attempts++;
      if (attempts < maxAttempts) {
        rafRef.current = requestAnimationFrame(poll);
      }
    };

    // Small delay to let navigation settle
    const timer = setTimeout(poll, 100);

    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(rafRef.current);
    };
  }, [step, measureTarget, navigate]);

  // Reposition on resize
  useEffect(() => {
    const onResize = () => measureTarget();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [measureTarget]);

  // Escape to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finish]);

  // Scroll target into view for non-nav elements
  useEffect(() => {
    const current = TOUR_STEPS[step];
    if (!current) return;
    const el = document.querySelector(current.target);
    if (el && current.navigateTo) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [step, rect]);

  const current = TOUR_STEPS[step];
  const isLast = step === TOUR_STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      finish();
    } else {
      setRect(null);
      setStep(s => s + 1);
    }
  };

  // Compute card position
  const getCardStyle = (): React.CSSProperties => {
    if (!rect) return { opacity: 0 };

    const padding = 12;

    if (current.position === 'below') {
      return {
        top: rect.bottom + padding,
        left: Math.max(12, rect.left + rect.width / 2 - 190),
      };
    }
    if (current.position === 'above') {
      return {
        bottom: window.innerHeight - rect.top + padding,
        left: Math.max(12, rect.left + rect.width / 2 - 190),
      };
    }
    // right
    return {
      top: rect.top,
      left: rect.right + padding,
    };
  };

  // Cutout style
  const getCutoutStyle = (): React.CSSProperties => {
    if (!rect) return { opacity: 0 };
    const pad = 6;
    return {
      top: rect.top - pad,
      left: rect.left - pad,
      width: rect.width + pad * 2,
      height: rect.height + pad * 2,
    };
  };

  return (
    <div className="spotlight-overlay" role="dialog" aria-modal="true" aria-labelledby="spotlight-title">
      {/* Dark backdrop with cutout */}
      <div className="spotlight-cutout" style={getCutoutStyle()} />

      {/* Click blocker for the overlay area (not the cutout) */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: -1 }}
        onClick={(e) => e.stopPropagation()}
      />

      {/* Content card */}
      <div className="spotlight-card" style={getCardStyle()}>
        <div className="spotlight-step">Step {step + 1} of {TOUR_STEPS.length}</div>
        <h3 className="spotlight-title" id="spotlight-title">{current.title}</h3>
        <p className="spotlight-desc">{current.description}</p>
        <div className="spotlight-actions">
          <button className="spotlight-skip" onClick={finish}>
            Skip tour
          </button>
          <button className="spotlight-next" onClick={handleNext}>
            {isLast ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
