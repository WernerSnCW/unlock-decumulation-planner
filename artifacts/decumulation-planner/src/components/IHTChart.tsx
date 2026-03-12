import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';
import type { YearResult } from '../engine/decumulation';

interface Props {
  perYear: YearResult[];
  toggles: { apply_2026_bpr_cap: boolean; apply_2027_pension_iht: boolean };
}

function formatAxis(value: number): string {
  if (value >= 1000000) return `£${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `£${Math.round(value / 1000)}k`;
  return `£${value}`;
}

function formatTooltip(value: number): string {
  return '£' + Math.round(value).toLocaleString('en-GB');
}

export default function IHTChart({ perYear, toggles }: Props) {
  if (perYear.length === 0) return null;

  const data = perYear.map(yr => ({
    year: yr.year,
    iht: yr.estimatedIHTBill,
    isShadow: yr.isShadow,
  }));

  return (
    <div className="chart-container">
      <div className="chart-title">IHT Trajectory</div>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(234,242,247,0.06)" />
          <XAxis
            dataKey="year"
            stroke="var(--unlock-muted)"
            fontSize={11}
            tickLine={false}
          />
          <YAxis
            tickFormatter={formatAxis}
            stroke="var(--unlock-muted)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            formatter={(value: number) => [formatTooltip(value), 'Est. IHT']}
            contentStyle={{
              background: 'var(--unlock-surface)',
              border: '1px solid var(--unlock-border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 12,
            }}
            labelStyle={{ color: 'var(--unlock-text)' }}
          />
          {toggles.apply_2026_bpr_cap && (
            <ReferenceLine
              x={2026}
              stroke="var(--tone-warning)"
              strokeDasharray="6 3"
              label={{ value: 'BPR Cap', position: 'top', fill: 'var(--tone-warning)', fontSize: 10 }}
            />
          )}
          {toggles.apply_2027_pension_iht && (
            <ReferenceLine
              x={2027}
              stroke="var(--tone-info)"
              strokeDasharray="6 3"
              label={{ value: 'Pension IHT', position: 'top', fill: 'var(--tone-info)', fontSize: 10 }}
            />
          )}
          <Line
            type="monotone"
            dataKey="iht"
            stroke="var(--chart-iht)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: 'var(--chart-iht)' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
