import { useState } from 'react';
import type { YearResult, Asset } from '../engine/decumulation';

interface Props {
  perYear: YearResult[];
  register: Asset[];
}

function formatMoney(value: number): string {
  if (Math.abs(value) >= 10000) {
    return '£' + Math.round(value).toLocaleString('en-GB');
  }
  return '£' + value.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export default function YearDetailTable({ perYear, register }: Props) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const toggleRow = (planYear: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(planYear)) {
        next.delete(planYear);
      } else {
        next.add(planYear);
      }
      return next;
    });
  };

  const assetMap = new Map(register.map(a => [a.asset_id, a.label]));

  if (perYear.length === 0) return null;

  return (
    <div className="chart-container" style={{ padding: 0 }}>
      <div className="chart-title" style={{ padding: '20px 20px 0' }}>Per-Year Detail</div>
      <div className="table-scroll">
        <table className="detail-table">
          <thead>
            <tr>
              <th style={{ width: 30 }}></th>
              <th>Year</th>
              <th>Age</th>
              <th>Portfolio</th>
              <th>IHT</th>
              <th>Spend</th>
              <th>Inc. Tax</th>
              <th>CGT</th>
              <th>TFLS Left</th>
              <th>Flags</th>
            </tr>
          </thead>
          <tbody>
            {perYear.flatMap(yr => {
              const hasError = yr.flags.some(f => f.severity === 'error');
              const hasWarning = yr.flags.some(f => f.severity === 'warning');
              const rowClass = hasError ? 'row-error' : hasWarning ? 'row-warning' : '';
              const isExpanded = expandedRows.has(yr.planYear);
              const rows = [];

              rows.push(
                <tr
                  key={yr.planYear}
                  className={`${rowClass} ${yr.isShadow ? 'shadow-row' : ''}`}
                >
                  <td>
                    {Object.keys(yr.drawsByAsset).length > 0 && (
                      <button
                        className="expand-btn"
                        onClick={() => toggleRow(yr.planYear)}
                      >
                        {isExpanded ? '▼' : '▶'}
                      </button>
                    )}
                  </td>
                  <td>{yr.year}</td>
                  <td>{yr.age}</td>
                  <td>{formatMoney(yr.totalPortfolioValue)}</td>
                  <td style={{ color: 'var(--chart-iht)' }}>{formatMoney(yr.estimatedIHTBill)}</td>
                  <td>
                    {formatMoney(yr.spendTargetNominal)}
                    {!yr.spendMet && (
                      <span style={{ color: 'var(--tone-error)', fontSize: 10, marginLeft: 4 }}>✗</span>
                    )}
                  </td>
                  <td>{formatMoney(yr.incomeTaxThisYear)}</td>
                  <td>{formatMoney(yr.cgtThisYear)}</td>
                  <td className="tfls-display">{formatMoney(yr.tflsRemaining)}</td>
                  <td>
                    {yr.flags.length > 0 && (
                      <span className={`badge-${yr.flags[0].severity}`}>
                        {yr.flags.length}
                      </span>
                    )}
                  </td>
                </tr>
              );

              if (isExpanded) {
                rows.push(
                  <tr key={`exp-${yr.planYear}`}>
                    <td colSpan={10} style={{ padding: 0 }}>
                      <div className="expanded-detail">
                        <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8, color: 'var(--unlock-text)' }}>
                          Draws by Asset — Year {yr.planYear}
                        </div>
                        {Object.entries(yr.drawsByAsset).map(([assetId, amount]) => (
                          <div key={assetId} className="draw-item">
                            <span>{assetMap.get(assetId) || assetId}</span>
                            <span className="draw-value">{formatMoney(amount)}</span>
                          </div>
                        ))}
                        {yr.flags.length > 0 && (
                          <>
                            <div style={{ fontWeight: 600, fontSize: 12, marginTop: 12, marginBottom: 8, color: 'var(--unlock-text)' }}>
                              Flags
                            </div>
                            {yr.flags.map((f, i) => (
                              <div key={i} style={{ fontSize: 12, color: 'var(--unlock-muted)', padding: '2px 0' }}>
                                <span className={`badge-${f.severity}`} style={{ marginRight: 6 }}>{f.severity}</span>
                                {f.message}
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              }

              return rows;
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
