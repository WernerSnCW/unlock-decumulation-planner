import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Legend, Line, ComposedChart } from 'recharts';
import type { YearResult } from '../engine/decumulation';

interface Props {
  perYear: YearResult[];
  planYears: number;
  firstShortfallYear: number | null;
  eisComparison?: YearResult[] | null;
  eisScenario?: 'base_case' | 'worst_case';
}

const ASSET_CLASSES = [
  { key: 'cash', label: 'Cash', color: '#6B7280' },
  { key: 'isa', label: 'ISA', color: '#00BB77' },
  { key: 'pension', label: 'Pension', color: '#3B82F6' },
  { key: 'property_investment', label: 'Property (Inv)', color: '#F59E0B' },
  { key: 'property_residential', label: 'Property (Res)', color: '#FB923C' },
  { key: 'vct', label: 'VCT', color: '#A855F7' },
  { key: 'eis', label: 'EIS', color: '#22D3EE' },
  { key: 'aim_shares', label: 'AIM', color: '#F97316' },
  { key: 'eis_programme', label: 'EIS Programme', color: '#EC4899' },
  { key: 'vct_programme', label: 'VCT Programme', color: '#8B5CF6' },
];

function formatAxis(value: number): string {
  if (value >= 1000000) return `£${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `£${Math.round(value / 1000)}k`;
  return `£${value}`;
}

function formatTooltip(value: number): string {
  return '£' + Math.round(value).toLocaleString('en-GB');
}

export default function PortfolioChart({ perYear, planYears, firstShortfallYear, eisComparison, eisScenario }: Props) {
  if (perYear.length === 0) return null;

  const hasEISComparison = eisComparison && eisComparison.length > 0;

  const chartData = perYear.map((yr, i) => {
    const point: Record<string, any> = {
      year: yr.year,
      planYear: yr.planYear,
      age: yr.age,
      isShadow: yr.isShadow,
    };

    for (const ac of ASSET_CLASSES) {
      point[ac.key] = yr.valuesByAssetClass[ac.key] || 0;
    }

    if (hasEISComparison && eisComparison[i]) {
      point['altScenario'] = eisComparison[i].totalPortfolioValue;
    }

    return point;
  });

  const altLabel = eisScenario === 'base_case' ? 'Worst Case scenario' : 'Base Case scenario';

  if (hasEISComparison) {
    return (
      <div className="chart-container">
        <div className="chart-title">Portfolio Value Over Time</div>
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
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
              formatter={(value: number, name: string) => [formatTooltip(value), name]}
              contentStyle={{
                background: '#11161C',
                border: '1px solid rgba(234, 242, 247, 0.10)',
                borderRadius: '10px',
                fontSize: 12,
                fontFamily: 'JetBrains Mono, monospace',
              }}
              labelStyle={{ color: '#EAF2F7' }}
              itemStyle={{ color: '#9FB3C8' }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, color: '#9FB3C8' }}
            />
            {planYears < perYear.length && (
              <ReferenceLine
                x={2025 + planYears - 1}
                stroke="#9FB3C8"
                strokeDasharray="4 4"
                label={{ value: 'Plan End', position: 'top', fill: '#9FB3C8', fontSize: 10 }}
              />
            )}
            {firstShortfallYear && (
              <ReferenceLine
                x={2025 + firstShortfallYear - 2}
                stroke="#EF4444"
                strokeDasharray="4 4"
                label={{ value: 'Shortfall', position: 'top', fill: '#EF4444', fontSize: 10 }}
              />
            )}
            {ASSET_CLASSES.map(ac => (
              <Area
                key={ac.key}
                type="monotone"
                dataKey={ac.key}
                name={ac.label}
                stackId="1"
                stroke={ac.color}
                fill={ac.color}
                fillOpacity={0.7}
              />
            ))}
            <Line
              type="monotone"
              dataKey="altScenario"
              name={altLabel}
              stroke="#EF4444"
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={false}
              legendType="line"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="chart-container">
      <div className="chart-title">Portfolio Value Over Time</div>
      <ResponsiveContainer width="100%" height={350}>
        <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
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
            formatter={(value: number, name: string) => [formatTooltip(value), name]}
            contentStyle={{
              background: '#11161C',
              border: '1px solid rgba(234, 242, 247, 0.10)',
              borderRadius: '10px',
              fontSize: 12,
              fontFamily: 'JetBrains Mono, monospace',
            }}
            labelStyle={{ color: '#EAF2F7' }}
            itemStyle={{ color: '#9FB3C8' }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, color: '#9FB3C8' }}
          />
          {planYears < perYear.length && (
            <ReferenceLine
              x={2025 + planYears - 1}
              stroke="#9FB3C8"
              strokeDasharray="4 4"
              label={{ value: 'Plan End', position: 'top', fill: '#9FB3C8', fontSize: 10 }}
            />
          )}
          {firstShortfallYear && (
            <ReferenceLine
              x={2025 + firstShortfallYear - 2}
              stroke="#EF4444"
              strokeDasharray="4 4"
              label={{ value: 'Shortfall', position: 'top', fill: '#EF4444', fontSize: 10 }}
            />
          )}
          {ASSET_CLASSES.map(ac => (
            <Area
              key={ac.key}
              type="monotone"
              dataKey={ac.key}
              name={ac.label}
              stackId="1"
              stroke={ac.color}
              fill={ac.color}
              fillOpacity={0.7}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
