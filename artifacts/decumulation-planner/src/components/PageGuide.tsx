import { useState, useEffect, useCallback } from 'react';

interface PageGuideProps {
  title: string;
  summary: string;
  actions: string[];
  tips: string[];
}

export default function PageGuide({ title, summary, actions, tips }: PageGuideProps) {
  const [isOpen, setIsOpen] = useState(false);

  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, close]);

  return (
    <>
      <button
        className="page-guide-trigger"
        onClick={() => setIsOpen(true)}
        aria-label={`Help for ${title}`}
        title={`About this page`}
      >
        ?
      </button>

      {isOpen && (
        <>
          <div className="page-guide-backdrop" onClick={close} />
          <div
            className="page-guide-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="page-guide-title"
          >
            <div className="page-guide-header">
              <h3 id="page-guide-title">{title}</h3>
              <button className="page-guide-close" onClick={close} aria-label="Close help">
                ×
              </button>
            </div>

            <div className="page-guide-body">
              <div className="page-guide-section">
                <p className="page-guide-section-title">What this page does</p>
                <p className="page-guide-summary">{summary}</p>
              </div>

              <div className="page-guide-section">
                <p className="page-guide-section-title">Key actions</p>
                <ul className="page-guide-list">
                  {actions.map((action, i) => (
                    <li key={i}>{action}</li>
                  ))}
                </ul>
              </div>

              <div className="page-guide-section">
                <p className="page-guide-section-title">Tips</p>
                <div className="page-guide-tips">
                  <ul className="page-guide-list">
                    {tips.map((tip, i) => (
                      <li key={i}>{tip}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
