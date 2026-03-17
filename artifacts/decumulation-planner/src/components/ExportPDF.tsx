import { useState } from 'react';
import jsPDF from 'jspdf';
import type { SimulationInputs, SimulationResult, Asset } from '../engine/decumulation';
import { STRATEGY_PRESETS } from '../engine/decumulation';
import type { TaxParametersFile } from '../engine/taxLogic';
import { runSimulation } from '../engine/decumulation';
import type { DrawdownStrategy } from '../engine/decumulation';

interface Props {
  inputs: SimulationInputs;
  result: SimulationResult;
  assets: Asset[];
  taxParams: TaxParametersFile;
}

function fmt(v: number): string {
  return '\u00A3' + Math.round(v).toLocaleString('en-GB');
}

function pct(v: number): string {
  return (v * 100).toFixed(1) + '%';
}

type RGB = [number, number, number];
const ACCENT: RGB = [0, 187, 119];
const DARK: RGB = [14, 17, 20];
const MID: RGB = [30, 37, 48];
const TEXT: RGB = [234, 242, 247];
const MUTED: RGB = [159, 179, 200];
const RED: RGB = [239, 68, 68];
const GREEN: RGB = [0, 187, 119];

export default function ExportPDF({ inputs, result, assets, taxParams }: Props) {
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      await generatePDF(inputs, result, assets, taxParams);
    } finally {
      setExporting(false);
    }
  }

  return (
    <button
      className="export-pdf-btn"
      onClick={handleExport}
      disabled={exporting}
    >
      {exporting ? 'Generating...' : 'Export PDF'}
    </button>
  );
}

async function generatePDF(
  inputs: SimulationInputs,
  result: SimulationResult,
  assets: Asset[],
  taxParams: TaxParametersFile
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210;
  const H = 297;
  const M = 15;
  const CW = W - M * 2;
  let y = 0;

  function checkPage(needed: number) {
    if (y + needed > H - M) {
      doc.addPage();
      y = M;
      drawFooter(doc, W, H);
    }
  }

  function drawFooter(d: jsPDF, w: number, h: number) {
    d.setFontSize(7);
    d.setTextColor(...MUTED);
    d.text('Unlock Decumulation Planner — Planning estimate, not financial advice', w / 2, h - 8, { align: 'center' });
    d.text(`Generated ${new Date().toLocaleDateString('en-GB')}`, w / 2, h - 4, { align: 'center' });
  }

  doc.setFillColor(...DARK);
  doc.rect(0, 0, W, H, 'F');
  drawFooter(doc, W, H);

  doc.setFillColor(...ACCENT);
  doc.rect(0, 0, W, 28, 'F');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('Unlock Decumulation Plan', M, 12);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, M, 20);

  y = 36;

  doc.setFillColor(...MID);
  doc.roundedRect(M, y, CW, 32, 2, 2, 'F');

  const s = result.summary;
  const cardW = CW / 4;
  const cards = [
    { label: 'FUNDED YEARS', value: `${s.funded_years} of ${inputs.plan_years}`, color: s.funded_years >= inputs.plan_years ? GREEN : RED },
    { label: 'TOTAL TAX PAID', value: fmt(s.total_tax_paid), color: TEXT },
    { label: 'ESTATE AT END', value: fmt(s.estate_at_end), color: TEXT },
    { label: 'IHT AT END', value: fmt(s.iht_at_end), color: RED },
  ];

  cards.forEach((c, i) => {
    const cx = M + i * cardW + cardW / 2;
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(c.label, cx, y + 10, { align: 'center' });
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...(c.color as [number, number, number]));
    doc.text(c.value, cx, y + 20, { align: 'center' });
    doc.setFont('helvetica', 'normal');
  });

  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(`Income: ${fmt(s.total_income_tax_paid)} \u00B7 CGT: ${fmt(s.total_cgt_paid)} \u00B7 Net after IHT: ${fmt(s.net_estate_after_iht)}`, W / 2, y + 28, { align: 'center' });

  y += 40;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...TEXT);
  doc.text('Plan Inputs', M, y);
  y += 6;

  doc.setFillColor(...MID);
  doc.roundedRect(M, y, CW, 52, 2, 2, 'F');

  const inputRows = [
    ['Annual Income Target', `${fmt(inputs.annual_income_target)} (${inputs.income_is_net ? 'net' : 'gross'})`],
    ['Plan Duration', `${inputs.plan_years} years (age ${inputs.current_age} to ${inputs.current_age + inputs.plan_years})`],
    ['Lifestyle Level', inputs.lifestyle_multiplier.charAt(0).toUpperCase() + inputs.lifestyle_multiplier.slice(1)],
    ['Inflation Rate', pct(inputs.inflation_rate)],
    ['State Pension', fmt(inputs.state_pension_annual) + '/yr'],
    ['Private Pension Income', fmt(inputs.private_pension_income) + '/yr'],
    ['Annual Gifting', inputs.annual_gift_amount > 0 ? `${fmt(inputs.annual_gift_amount)} (${inputs.gift_type === 'pet' ? 'PET' : inputs.gift_type === 'discretionary_trust' ? 'CLT' : 'NEFI'})` : 'None'],
    ['Cash Reserve', fmt(inputs.cash_reserve)],
  ];

  doc.setFontSize(8);
  inputRows.forEach((row, i) => {
    const ry = y + 6 + i * 6;
    doc.setTextColor(...MUTED);
    doc.text(row[0], M + 4, ry);
    doc.setTextColor(...TEXT);
    doc.text(row[1], M + CW - 4, ry, { align: 'right' });
  });

  y += 58;

  if (inputs.glory_years.enabled) {
    checkPage(20);
    const t = inputs.annual_income_target;
    const m = inputs.glory_years.multiplier;
    const isGlory = inputs.glory_years.target_is_glory;
    const earlyAmt = isGlory ? t : Math.round(t * m);
    const laterAmt = isGlory ? Math.round(t / m) : t;

    doc.setFillColor(...MID);
    doc.roundedRect(M, y, CW, 14, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text('Glory Years', M + 4, y + 5);
    doc.setTextColor(...TEXT);
    doc.text(`Early: ${fmt(earlyAmt)}/yr (years 1\u2013${inputs.glory_years.duration})  \u00B7  Later: ${fmt(laterAmt)}/yr (years ${inputs.glory_years.duration + 1}+)`, M + 4, y + 11);
    y += 20;
  }

  checkPage(20);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...TEXT);
  doc.text('Drawdown Priorities', M, y);
  y += 6;

  const weights = inputs.priority_weights;
  const wLabels = ['Tax Efficiency', 'IHT Reduction', 'Preserve Growth', 'Liquidity'];
  const wKeys = ['tax_efficiency', 'iht_reduction', 'preserve_growth', 'liquidity'] as const;
  const wColors: [number, number, number][] = [[0, 187, 119], [239, 68, 68], [59, 130, 246], [245, 158, 11]];

  let activeStrategy = '';
  for (const [key, preset] of Object.entries(STRATEGY_PRESETS)) {
    if (wKeys.every(k => Math.abs(weights[k] - preset[k]) < 0.01)) {
      activeStrategy = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      break;
    }
  }

  doc.setFillColor(...MID);
  doc.roundedRect(M, y, CW, 18, 2, 2, 'F');

  doc.setFontSize(8);
  if (activeStrategy) {
    doc.setTextColor(...ACCENT);
    doc.text(`Strategy: ${activeStrategy}`, M + 4, y + 5);
  }

  wKeys.forEach((k, i) => {
    const bx = M + 4 + i * 44;
    const by = y + (activeStrategy ? 11 : 8);
    doc.setFillColor(...wColors[i]);
    doc.roundedRect(bx, by - 3, Math.max(1, weights[k] * 36), 3, 1, 1, 'F');
    doc.setTextColor(...TEXT);
    doc.setFontSize(7);
    doc.text(`${wLabels[i]} ${Math.round(weights[k] * 100)}%`, bx, by + 4);
  });

  y += 24;

  checkPage(8 + assets.length * 6);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...TEXT);
  doc.text('Asset Register', M, y);
  y += 2;

  const totalValue = assets.reduce((sum, a) => sum + a.current_value, 0);
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(`${assets.length} assets \u00B7 Total: ${fmt(totalValue)}`, M + CW, y, { align: 'right' });
  y += 5;

  const assetClassLabels: Record<string, string> = {
    cash: 'Cash', isa: 'ISA', pension: 'Pension',
    property_investment: 'Property (Inv)', property_residential: 'Property (Res)',
    vct: 'VCT', eis: 'EIS', aim_shares: 'AIM'
  };

  const colX = [M + 4, M + 80, M + 115, M + 145];

  doc.setFillColor(...MID);
  doc.roundedRect(M, y, CW, 7, 1, 1, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...MUTED);
  doc.text('Asset', colX[0], y + 5);
  doc.text('Type', colX[1], y + 5);
  doc.text('Value', colX[2], y + 5);
  doc.text('Growth', colX[3], y + 5);
  doc.setFont('helvetica', 'normal');
  y += 9;

  for (const a of assets) {
    checkPage(7);
    doc.setFontSize(7);
    doc.setTextColor(...TEXT);
    const label = a.label.length > 32 ? a.label.substring(0, 30) + '...' : a.label;
    doc.text(label, colX[0], y);
    doc.setTextColor(...MUTED);
    doc.text(assetClassLabels[a.asset_class] ?? a.asset_class, colX[1], y);
    doc.setTextColor(...TEXT);
    doc.text(fmt(a.current_value), colX[2], y);
    doc.text(pct(a.assumed_growth_rate), colX[3], y);

    if (a.wrapper_type === 'unwrapped' && a.asset_class !== 'cash') {
      doc.setTextColor(...MUTED);
      doc.text('GIA', M + CW - 4, y, { align: 'right' });
    } else if (a.wrapper_type === 'isa') {
      doc.setTextColor(...GREEN);
      doc.text('ISA', M + CW - 4, y, { align: 'right' });
    } else if (a.wrapper_type === 'pension') {
      doc.setTextColor(59, 130, 246);
      doc.text('Pension', M + CW - 4, y, { align: 'right' });
    }

    y += 5.5;
  }

  y += 4;

  checkPage(50);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...TEXT);
  doc.text('Year-by-Year Projection', M, y);
  y += 6;

  const headerY = y;
  const yCols = [M + 4, M + 18, M + 42, M + 66, M + 90, M + 114, M + 140, M + 164];
  doc.setFillColor(...MID);
  doc.roundedRect(M, headerY, CW, 7, 1, 1, 'F');
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...MUTED);
  ['Year', 'Income', 'Tax Paid', 'Drawdown', 'Portfolio', 'IHT', 'Gifts', 'Net Estate'].forEach((h, i) => {
    doc.text(h, yCols[i], headerY + 5);
  });
  doc.setFont('helvetica', 'normal');
  y = headerY + 9;

  const realYears = result.perYear.filter(yr => !yr.isShadow);
  for (const yr of realYears) {
    checkPage(6);
    doc.setFontSize(6.5);
    const isShortfall = yr.shortfall > 0;
    doc.setTextColor(isShortfall ? RED[0] : TEXT[0], isShortfall ? RED[1] : TEXT[1], isShortfall ? RED[2] : TEXT[2]);
    doc.text(`${yr.year}`, yCols[0], y);
    doc.text(fmt(yr.spendTargetNominal), yCols[1], y);
    doc.text(fmt(yr.incomeTaxThisYear + yr.cgtThisYear), yCols[2], y);
    const totalDrawn = Object.values(yr.drawsByAsset).reduce((s, v) => s + v, 0);
    doc.text(fmt(totalDrawn), yCols[3], y);
    doc.text(fmt(yr.totalPortfolioValue), yCols[4], y);
    doc.text(fmt(yr.estimatedIHTBill), yCols[5], y);
    doc.text(fmt(yr.giftedThisYear), yCols[6], y);
    doc.text(fmt(yr.totalPortfolioValue - yr.estimatedIHTBill), yCols[7], y);
    y += 5;
  }

  y += 6;

  checkPage(50);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...TEXT);
  doc.text('Strategy Comparison', M, y);
  y += 6;

  const strategies: { key: DrawdownStrategy; label: string }[] = [
    { key: 'balanced', label: 'Balanced' },
    { key: 'tax_optimised', label: 'Tax Optimised' },
    { key: 'iht_optimised', label: 'IHT Optimised' },
    { key: 'income_first', label: 'Income First' },
    { key: 'growth_first', label: 'Growth First' },
  ];

  const stratResults = strategies.map(s => {
    const modInputs = { ...inputs, priority_weights: { ...STRATEGY_PRESETS[s.key] } };
    return { ...s, result: runSimulation(modInputs, assets, taxParams) };
  });

  const sColW = CW / (strategies.length + 1);
  doc.setFillColor(...MID);
  doc.roundedRect(M, y, CW, 7, 1, 1, 'F');
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...MUTED);
  doc.text('', M + 4, y + 5);
  stratResults.forEach((s, i) => {
    doc.text(s.label, M + sColW * (i + 1) + 2, y + 5);
  });
  doc.setTextColor(...ACCENT);
  doc.text('Your Blend', M + sColW * (strategies.length + 1) - sColW + 2, y + 5);
  doc.setFont('helvetica', 'normal');
  y += 9;

  const compRows = [
    { label: 'Funded Years', getValue: (r: SimulationResult) => `${r.summary.funded_years}` },
    { label: 'Total Tax', getValue: (r: SimulationResult) => fmt(r.summary.total_tax_paid) },
    { label: 'IHT', getValue: (r: SimulationResult) => fmt(r.summary.iht_at_end) },
    { label: 'Net Estate', getValue: (r: SimulationResult) => fmt(r.summary.net_estate_after_iht) },
  ];

  for (const row of compRows) {
    doc.setFontSize(6.5);
    doc.setTextColor(...MUTED);
    doc.text(row.label, M + 4, y);
    stratResults.forEach((s, i) => {
      doc.setTextColor(...TEXT);
      doc.text(row.getValue(s.result), M + sColW * (i + 1) + 2, y);
    });
    doc.setTextColor(...ACCENT);
    doc.text(row.getValue(result), M + sColW * (strategies.length + 1) - sColW + 2, y);
    y += 5;
  }

  y += 6;

  checkPage(20);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...TEXT);
  doc.text('Settings Applied', M, y);
  y += 5;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...MUTED);

  const toggles = [
    ['2026 BPR Cap', inputs.apply_2026_bpr_cap],
    ['2027 Pension IHT', inputs.apply_2027_pension_iht],
    ['Preserve EIS BPR', inputs.strategy_mechanisms.preserve_eis_bpr],
    ['Preserve AIM BPR', inputs.strategy_mechanisms.preserve_aim_bpr],
    ['Protect Property', inputs.strategy_mechanisms.protect_property],
    ['Draw ISAs Early', inputs.strategy_mechanisms.draw_isa_early],
    ['Draw Pension Early', inputs.strategy_mechanisms.draw_pension_early],
    ['Preserve VCT Income', inputs.strategy_mechanisms.preserve_vct_income],
  ] as const;

  toggles.forEach(([label, val], i) => {
    const col = i < 4 ? 0 : 1;
    const row = i % 4;
    const tx = M + col * 90;
    const ty = y + row * 5;
    doc.text(`${label}: `, tx, ty);
    const c = val ? GREEN : RED;
    doc.setTextColor(c[0], c[1], c[2]);
    doc.text(val ? 'ON' : 'OFF', tx + 36, ty);
    doc.setTextColor(...MUTED);
  });

  y += 24;

  checkPage(16);
  doc.setDrawColor(...MUTED);
  doc.setLineWidth(0.2);
  doc.line(M, y, M + CW, y);
  y += 6;
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text('IMPORTANT: This is a planning estimate only — not financial advice. All projections are based on assumed', M, y);
  y += 4;
  doc.text('growth rates and current tax rules that may change. Consult a qualified financial adviser before making decisions.', M, y);
  y += 4;
  doc.text(`Tax parameters: UK HMRC rates (${taxParams.schedule[0]?.tax_year ?? 'current'})`, M, y);

  const filename = `Unlock-Plan-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
