import type { Warning } from '../engine/warningEvaluator';

interface Props {
  warnings: Warning[];
}

export default function WarningsPanel({ warnings }: Props) {
  if (warnings.length === 0) return null;

  const sorted = [...warnings].sort((a, b) => {
    const order = { error: 0, warning: 1, info: 2 };
    return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
  });

  return (
    <div className="warnings-panel">
      <div className="chart-title">
        Warnings ({warnings.length})
      </div>
      {sorted.map((w, i) => (
        <div key={`${w.id}-${i}`} className="warning-item">
          <span className={`badge-${w.severity}`}>
            {w.severity}
          </span>
          <span style={{ color: 'var(--unlock-muted)' }}>{w.message}</span>
        </div>
      ))}
    </div>
  );
}
