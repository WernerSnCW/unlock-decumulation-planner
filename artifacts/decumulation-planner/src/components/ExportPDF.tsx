import { useState } from 'react';
import jsPDF from 'jspdf';
import type { SimulationInputs, SimulationResult, Asset, YearResult } from '../engine/decumulation';
import { STRATEGY_PRESETS } from '../engine/decumulation';
import type { TaxParametersFile } from '../engine/taxLogic';
import { runSimulation } from '../engine/decumulation';
import type { DrawdownStrategy } from '../engine/decumulation';
import { evaluateRegisterWarnings } from '../engine/warningEvaluator';

interface Props {
  inputs: SimulationInputs;
  result: SimulationResult;
  assets: Asset[];
  taxParams: TaxParametersFile;
  investorName?: string;
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
const DARK2: RGB = [22, 27, 34];
const MID: RGB = [30, 37, 48];
const TEXT: RGB = [234, 242, 247];
const MUTED: RGB = [159, 179, 200];
const RED: RGB = [239, 68, 68];
const AMBER: RGB = [245, 158, 11];
const BLUE: RGB = [59, 130, 246];

export default function ExportPDF({ inputs, result, assets, taxParams, investorName }: Props) {
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      await generatePDF(inputs, result, assets, taxParams, investorName);
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
      {exporting ? 'Generating...' : 'Export Detailed Report to PDF'}
    </button>
  );
}

class PDFBuilder {
  doc: jsPDF;
  y: number;
  W = 210;
  H = 297;
  M = 14;
  CW: number;
  pageNum = 1;

  constructor() {
    this.doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    this.CW = this.W - this.M * 2;
    this.y = 0;
    this.drawPageBg();
  }

  drawPageBg() {
    this.doc.setFillColor(...DARK);
    this.doc.rect(0, 0, this.W, this.H, 'F');
    this.drawFooter();
  }

  drawFooter() {
    this.doc.setFontSize(6.5);
    this.doc.setTextColor(...MUTED);
    this.doc.text('Unlock Decumulation Planner -- Planning estimate, not financial advice', this.W / 2, this.H - 7, { align: 'center' });
    this.doc.text(`Page ${this.pageNum}`, this.W - this.M, this.H - 7, { align: 'right' });
  }

  ensureSpace(needed: number) {
    if (this.y + needed > this.H - 14) {
      this.doc.addPage();
      this.pageNum++;
      this.drawPageBg();
      this.y = this.M;
    }
  }

  sectionTitle(title: string) {
    this.ensureSpace(14);
    this.doc.setFillColor(...ACCENT);
    this.doc.rect(this.M, this.y, 3, 8, 'F');
    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...TEXT);
    this.doc.text(title, this.M + 7, this.y + 6);
    this.doc.setFont('helvetica', 'normal');
    this.y += 12;
  }

  subTitle(title: string) {
    this.ensureSpace(10);
    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...ACCENT);
    this.doc.text(title, this.M, this.y + 4);
    this.doc.setFont('helvetica', 'normal');
    this.y += 8;
  }

  explanationText(text: string) {
    this.doc.setFontSize(7.5);
    this.doc.setTextColor(...MUTED);
    const lines = this.doc.splitTextToSize(text, this.CW - 4);
    this.ensureSpace(lines.length * 3.5 + 2);
    this.doc.text(lines, this.M + 2, this.y);
    this.y += lines.length * 3.5 + 2;
  }

  keyValue(label: string, value: string, indent = 0) {
    this.ensureSpace(5);
    this.doc.setFontSize(7.5);
    this.doc.setTextColor(...MUTED);
    this.doc.text(label, this.M + 4 + indent, this.y);
    this.doc.setTextColor(...TEXT);
    this.doc.text(value, this.M + this.CW - 4, this.y, { align: 'right' });
    this.y += 5;
  }

  divider() {
    this.y += 2;
    this.doc.setDrawColor(50, 60, 75);
    this.doc.setLineWidth(0.15);
    this.doc.line(this.M, this.y, this.M + this.CW, this.y);
    this.y += 4;
  }

  cardBg(height: number) {
    this.doc.setFillColor(...MID);
    this.doc.roundedRect(this.M, this.y, this.CW, height, 2, 2, 'F');
  }
}

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1910" height="502" viewBox="0 0 1910 502" fill="none">
  <path d="M186.058 376.199C186.058 408.759 169.987 423.926 135.449 423.926C100.91 423.926 84.8396 408.759 84.8396 376.199V6.84961H0V378.288C0 455.664 50.6433 501.85 135.483 501.85C220.322 501.85 271 455.698 271 378.356V6.84961H186.092V376.199H186.058Z" fill="white"/>
  <path d="M542.16 219.372C542.16 255.112 542.81 284.245 543.735 307.558C536.1 286.915 526.583 261.822 514.977 232.21L426.034 6.84966H339.625V494.815H423.741V279.486C423.741 245.287 422.885 216.394 421.687 192.772C429.8 214.271 439.592 239.707 450.958 268.086L539.935 494.747H625.625V6.81543H542.194V219.372H542.16Z" fill="white"/>
  <path d="M782.589 6.91797H697.852V494.918H915.852V418.493H782.589V6.91797Z" fill="white"/>
  <path d="M1426.68 0C1342.38 0 1292.04 46.1719 1292.04 123.548V378.452C1292.04 455.828 1342.38 502 1426.68 502C1510.98 502 1562.04 455.828 1562.04 378.452V327.417H1477.95V376.363C1477.95 408.046 1461.18 423.46 1426.75 423.46C1392.32 423.46 1376.2 408.492 1376.2 376.363V125.637C1376.2 93.0632 1392.25 77.8895 1426.75 77.8895C1461.25 77.8895 1477.95 93.0632 1477.95 125.637V175.988H1562.04V123.548C1562.04 46.1719 1511.45 0 1426.68 0Z" fill="white"/>
  <path d="M1795.51 243.626L1902.99 6.84961H1810.68L1706.17 244.927L1814.1 494.85H1909.17L1795.51 243.626Z" fill="white"/>
  <path d="M1703.51 6.84961H1618.51V494.85H1703.51V6.84961Z" fill="white"/>
  <path d="M1198.18 250.966V123.548C1198.18 46.1719 1147.57 0 1062.84 0C978.12 0 928.23 46.1719 928.23 123.548V251H970.284V378.452C970.284 455.828 1020.62 502 1104.9 502C1189.18 502 1240.23 455.828 1240.23 378.452V250.966H1198.18ZM1104.97 423.46C1070.95 423.46 1054.43 408.081 1054.43 376.431V251H1012.37V125.637C1012.37 93.0632 1028.42 77.8895 1062.91 77.8895C1097.4 77.8895 1114.1 93.0632 1114.1 125.637V250.966H1156.12V259.015H1156.16V376.431C1156.16 408.081 1139.39 423.46 1104.97 423.46Z" fill="white"/>
</svg>`;

function svgToPngDataUrl(svgString: string, width: number, height: number): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve('');
    };
    img.src = url;
  });
}

async function generatePDF(
  inputs: SimulationInputs,
  result: SimulationResult,
  assets: Asset[],
  taxParams: TaxParametersFile,
  investorName?: string
) {
  const p = new PDFBuilder();
  const { doc } = p;
  const s = result.summary;
  const realYears = result.perYear.filter(yr => !yr.isShadow);

  // Header bar
  doc.setFillColor(...ACCENT);
  doc.rect(0, 0, p.W, 36, 'F');

  // Embed SVG logo as PNG image
  const logoH = 8; // mm in PDF
  const logoW = logoH * (1910 / 502); // maintain aspect ratio ~30mm
  try {
    const logoPng = await svgToPngDataUrl(LOGO_SVG, 764, 201); // 4x render for clarity
    if (logoPng) {
      doc.addImage(logoPng, 'PNG', p.M, 6, logoW, logoH);
    }
  } catch {
    // Fallback: text
    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('UNLOCK', p.M, 14);
  }

  // Subtitle
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(255, 255, 255);
  doc.text('Decumulation Plan', p.M + logoW + 4, 12);

  // Generated for line
  const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const forLine = investorName ? `Generated ${dateStr} for ${investorName}` : `Generated ${dateStr}`;
  doc.setFontSize(10);
  doc.text(forLine, p.M, 24);

  // Age / plan line
  doc.setFontSize(8);
  doc.text(`Age ${inputs.current_age} -- ${inputs.plan_years}-year plan to age ${inputs.current_age + inputs.plan_years}`, p.M, 31);
  p.y = 42;

  p.cardBg(28);
  const cardW = p.CW / 4;
  const cards = [
    { label: 'FUNDED YEARS', value: `${s.funded_years} / ${inputs.plan_years}`, sub: s.funded_years >= inputs.plan_years ? 'Fully funded' : `Shortfall year ${s.first_shortfall_year}`, color: s.funded_years >= inputs.plan_years ? ACCENT : RED },
    { label: 'TOTAL TAX', value: fmt(s.total_tax_paid), sub: `Inc: ${fmt(s.total_income_tax_paid)} | CGT: ${fmt(s.total_cgt_paid)}`, color: TEXT },
    { label: 'ESTATE AT END', value: fmt(s.estate_at_end), sub: `Net after IHT: ${fmt(s.net_estate_after_iht)}`, color: TEXT },
    { label: 'IHT LIABILITY', value: fmt(s.iht_at_end), sub: s.iht_saving_vs_no_plan > 0 ? `Saving ${fmt(s.iht_saving_vs_no_plan)} vs no plan` : '', color: RED },
  ];
  cards.forEach((c, i) => {
    const cx = p.M + i * cardW + cardW / 2;
    doc.setFontSize(6.5);
    doc.setTextColor(...MUTED);
    doc.text(c.label, cx, p.y + 7, { align: 'center' });
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...c.color);
    doc.text(c.value, cx, p.y + 15, { align: 'center' });
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MUTED);
    doc.text(c.sub, cx, p.y + 21, { align: 'center' });
  });
  p.y += 34;

  p.sectionTitle('Executive Summary');
  const fullyFunded = s.funded_years >= inputs.plan_years;
  const summaryLines = [];
  if (fullyFunded) {
    summaryLines.push(`Your portfolio of ${fmt(assets.reduce((t, a) => t + a.current_value, 0))} across ${assets.length} assets is projected to fully fund your retirement income of ${fmt(inputs.annual_income_target)}/yr (${inputs.income_is_net ? 'net' : 'gross'}) for all ${inputs.plan_years} years.`);
  } else {
    summaryLines.push(`Your portfolio of ${fmt(assets.reduce((t, a) => t + a.current_value, 0))} across ${assets.length} assets is projected to fund ${s.funded_years} of your ${inputs.plan_years} planned years. A shortfall occurs in year ${s.first_shortfall_year}. Consider reducing the income target or reviewing asset growth assumptions.`);
  }
  summaryLines.push(`Over the plan, you will pay an estimated ${fmt(s.total_tax_paid)} in tax (${fmt(s.total_income_tax_paid)} income tax, ${fmt(s.total_cgt_paid)} CGT). Your estate at plan end is projected at ${fmt(s.estate_at_end)}, with an IHT liability of ${fmt(s.iht_at_end)} -- leaving ${fmt(s.net_estate_after_iht)} net to beneficiaries.`);
  if (s.iht_saving_vs_no_plan > 0) {
    summaryLines.push(`This plan saves an estimated ${fmt(s.iht_saving_vs_no_plan)} in IHT compared to taking no action (baseline IHT: ${fmt(s.iht_no_plan_baseline)}).`);
  }
  if (inputs.glory_years.enabled) {
    const t = inputs.annual_income_target;
    const m = inputs.glory_years.multiplier;
    const isGlory = inputs.glory_years.target_is_glory;
    const earlyAmt = isGlory ? t : Math.round(t * m);
    const laterAmt = isGlory ? Math.round(t / m) : t;
    summaryLines.push(`Glory Years active: spending ${fmt(earlyAmt)}/yr for the first ${inputs.glory_years.duration} years, then ${fmt(laterAmt)}/yr thereafter.`);
  }
  for (const line of summaryLines) {
    p.explanationText(line);
  }

  p.y += 3;

  if (s.iht_saving_vs_no_plan > 0) {
    p.sectionTitle('How IHT Is Saved');
    p.explanationText(`You need to draw income regardless -- the IHT saving of ${fmt(s.iht_saving_vs_no_plan)} does not come from spending itself, but from choosing which assets to spend and which to preserve. A naive approach (e.g. drawing from cash first, or proportionally) would leave a larger IHT bill. This plan saves tax by drawing strategically:`);

    const lastYear = realYears[realYears.length - 1];
    const totalGifted = s.total_gifted;

    const pensionAssets = assets.filter(a => a.asset_class === 'pension');
    const hasPensions = pensionAssets.length > 0 && pensionAssets.reduce((t, a) => t + a.current_value, 0) > 0;
    const pensionStartVal = pensionAssets.reduce((t, a) => t + a.current_value, 0);

    const eisAssets = assets.filter(a => a.asset_class === 'eis' && a.is_iht_exempt);
    const aimAssets = assets.filter(a => a.asset_class === 'aim_shares' && a.is_iht_exempt);
    const hasBPR = eisAssets.length > 0 || aimAssets.length > 0;
    const bprStartVal = [...eisAssets, ...aimAssets].reduce((t, a) => t + a.current_value, 0);
    const bprEndVal = lastYear?.ihtExemptTotal ?? 0;

    const mechanisms: { icon: string; title: string; explanation: string; color: RGB }[] = [];

    const drawdownOrder = inputs.priority_weights;
    if (drawdownOrder.iht_reduction > 0) {
      const ihtWeight = Math.round(drawdownOrder.iht_reduction * 100);
      mechanisms.push({
        icon: '>',
        title: `Drawing from IHT-liable assets first (IHT weight: ${ihtWeight}%)`,
        explanation: `The key saving comes from which assets you spend. Cash, GIAs, and ISAs are all fully taxable in your estate at 40%. Pensions and BPR-qualifying assets are not. By spending the IHT-liable assets for your income and preserving the IHT-exempt ones, you shift the composition of your estate towards sheltered assets -- same lifestyle, lower tax bill.`,
        color: BLUE,
      });
    }

    if (hasPensions) {
      const pensionExplanation = inputs.apply_2027_pension_iht
        ? `From April 2027 (if enacted), unused pensions will be included in the estate for IHT. Your plan models this change, which reduces the pension advantage in later years.`
        : `Pension funds currently pass outside the estate on death entirely. By spending other assets first and letting pensions grow, you shift more of your wealth into this IHT-free wrapper.`;
      mechanisms.push({
        icon: '>',
        title: `Preserving pensions: ${fmt(pensionStartVal)} in SIPPs`,
        explanation: `Pensions are the most IHT-efficient asset -- they currently sit entirely outside the estate. If you drew from your SIPP to fund income and left your GIA untouched, you would be spending IHT-free money and keeping IHT-liable money. This plan does the opposite: spend the GIA, keep the pension. ${pensionExplanation}`,
        color: BLUE,
      });
    }

    if (hasBPR) {
      mechanisms.push({
        icon: '*',
        title: `Preserving BPR assets: ${fmt(bprStartVal)} qualifying`,
        explanation: `EIS and AIM shares held 2+ years qualify for Business Property Relief -- up to 100% IHT exempt. Selling these to fund income would destroy the relief. By drawing from non-exempt assets instead, these holdings pass to beneficiaries IHT-free. Projected BPR value at plan end: ${fmt(bprEndVal)}.${inputs.apply_2026_bpr_cap ? ' The 2026 BPR cap limits AIM/unlisted relief to 100% on the first \u00A31M, then 50% above.' : ''}`,
        color: ACCENT,
      });
    }

    if (inputs.strategy_mechanisms.draw_isa_early) {
      const isaAssets = assets.filter(a => a.wrapper_type === 'isa');
      const isaStartVal = isaAssets.reduce((t, a) => t + a.current_value, 0);
      if (isaStartVal > 0) {
        mechanisms.push({
          icon: 'o',
          title: `Spending ISAs before pensions: ${fmt(isaStartVal)} in ISAs`,
          explanation: `ISAs give tax-free growth and income, which makes them feel valuable -- but they sit fully inside the estate for IHT. Pensions do not. By spending ISAs first and keeping pensions, you get the same tax-free income now while reducing the IHT-liable estate. This is a common area where intuition ("keep ISAs, they're tax-free") leads to worse outcomes.`,
          color: AMBER,
        });
      }
    }

    if (totalGifted > 0) {
      const giftExplanation = inputs.gift_type === 'pet'
        ? `As Potentially Exempt Transfers (PETs), these fall outside your estate entirely if you survive 7 years. Taper relief applies between 3-7 years.`
        : inputs.gift_type === 'discretionary_trust'
          ? `As Chargeable Lifetime Transfers (CLTs), the first \u00A3325k uses your nil-rate band; excess is taxed at 20% when given but reduces the estate.`
          : `As Normal Expenditure from Income (NEFI), these are immediately IHT-exempt provided they are regular, from income, and leave you with enough to live on.`;
      mechanisms.push({
        icon: '+',
        title: `Gifting: ${fmt(totalGifted)} transferred out of the estate`,
        explanation: `Unlike spending (which converts assets to lifestyle), gifting genuinely removes wealth from the estate and passes it to beneficiaries now rather than at death -- avoiding the 40% IHT charge. ${giftExplanation}`,
        color: AMBER,
      });
    }

    mechanisms.push({
      icon: '=',
      title: `Net result: ${fmt(s.iht_saving_vs_no_plan)} less IHT than a naive approach`,
      explanation: `The "no plan" baseline assumes you draw income but without optimising the order -- all assets grow and deplete proportionally. That baseline produces IHT of ${fmt(s.iht_no_plan_baseline)}. This plan, by drawing strategically, produces IHT of ${fmt(s.iht_at_end)}. The ${fmt(s.iht_saving_vs_no_plan)} difference is genuine tax saved -- your beneficiaries receive more, for the same lifestyle cost to you.`,
      color: ACCENT,
    });

    for (const mech of mechanisms) {
      p.ensureSpace(16);
      doc.setFontSize(7.5);
      doc.setTextColor(...mech.color);
      doc.text(mech.icon, p.M + 2, p.y);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...TEXT);
      doc.text(mech.title, p.M + 8, p.y);
      doc.setFont('helvetica', 'normal');
      p.y += 4;
      doc.setFontSize(6.5);
      doc.setTextColor(...MUTED);
      const mechLines = doc.splitTextToSize(mech.explanation, p.CW - 10);
      p.ensureSpace(mechLines.length * 3.2 + 2);
      doc.text(mechLines, p.M + 8, p.y);
      p.y += mechLines.length * 3.2 + 4;
    }

    p.y += 2;
  }

  p.sectionTitle('Plan Inputs');
  p.explanationText('These are the assumptions and parameters used to run the simulation. Changes to any of these will affect the projections.');
  p.cardBg(46);
  p.y += 3;
  p.keyValue('Annual Income Target', `${fmt(inputs.annual_income_target)} (${inputs.income_is_net ? 'net of tax' : 'gross'})`);
  p.keyValue('Plan Duration', `${inputs.plan_years} years (age ${inputs.current_age} to ${inputs.current_age + inputs.plan_years})`);
  p.keyValue('Lifestyle Level', inputs.lifestyle_multiplier.charAt(0).toUpperCase() + inputs.lifestyle_multiplier.slice(1));
  p.keyValue('Inflation Rate', `${(inputs.inflation_rate * 100).toFixed(0)}% per year`);
  p.keyValue('State Pension', `${fmt(inputs.state_pension_annual)}/yr`);
  p.keyValue('Private Pension Income', inputs.private_pension_income > 0 ? `${fmt(inputs.private_pension_income)}/yr (e.g. final salary)` : 'None');
  p.keyValue('Annual Gifting', inputs.annual_gift_amount > 0 ? `${fmt(inputs.annual_gift_amount)} as ${inputs.gift_type === 'pet' ? 'PET' : inputs.gift_type === 'discretionary_trust' ? 'CLT' : 'NEFI'}` : 'None');
  p.keyValue('Cash Reserve', inputs.cash_reserve > 0 ? fmt(inputs.cash_reserve) : 'No minimum set');
  if (s.legacy_target > 0) {
    p.keyValue('Legacy Target', fmt(s.legacy_target));
  }
  p.y += 4;

  p.sectionTitle('Drawdown Strategy');
  p.explanationText('The drawdown strategy determines which assets to sell first when you need income. The weights below control the priority given to each objective. Higher weight = stronger preference.');

  const weights = inputs.priority_weights;
  const wKeys = ['tax_efficiency', 'iht_reduction', 'preserve_growth', 'liquidity'] as const;
  const wLabels = ['Tax Efficiency', 'IHT Reduction', 'Preserve Growth', 'Liquidity'];
  const wDescs = [
    'Minimise income tax and capital gains tax on withdrawals',
    'Spend assets that are taxable on death first, reducing inheritance tax',
    'Keep high-growth assets invested longer to compound returns',
    'Draw from easily accessible assets (cash, ISAs) before illiquid ones'
  ];
  const wColors: RGB[] = [ACCENT, RED, BLUE, AMBER];

  let activeStrategy = '';
  for (const [key, preset] of Object.entries(STRATEGY_PRESETS)) {
    if (wKeys.every(k => Math.abs(weights[k] - preset[k]) < 0.01)) {
      activeStrategy = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      break;
    }
  }

  p.cardBg(activeStrategy ? 30 : 26);
  p.y += 3;
  if (activeStrategy) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...ACCENT);
    doc.text(`Active Preset: ${activeStrategy}`, p.M + 4, p.y);
    doc.setFont('helvetica', 'normal');
    p.y += 5;
  }
  wKeys.forEach((k, i) => {
    const bx = p.M + 4;
    const barW = (p.CW - 8) * 0.4;
    doc.setFontSize(7);
    doc.setTextColor(...TEXT);
    doc.text(`${wLabels[i]}`, bx, p.y);
    doc.setTextColor(...MUTED);
    doc.text(`${Math.round(weights[k] * 100)}%`, bx + 40, p.y);
    doc.setFillColor(40, 48, 60);
    doc.roundedRect(bx + 52, p.y - 2.5, barW, 3, 1, 1, 'F');
    doc.setFillColor(...wColors[i]);
    doc.roundedRect(bx + 52, p.y - 2.5, Math.max(1, weights[k] * barW), 3, 1, 1, 'F');
    doc.setFontSize(6);
    doc.setTextColor(...MUTED);
    doc.text(wDescs[i], bx + 52 + barW + 4, p.y);
    p.y += 5;
  });
  p.y += 4;

  const mechs = inputs.strategy_mechanisms;
  p.subTitle('Strategy Mechanisms');
  p.explanationText('Fine-grained controls that override the general drawdown order for specific asset types.');
  const mechItems = [
    ['Preserve EIS for BPR', mechs.preserve_eis_bpr, 'Keep EIS holdings for IHT Business Property Relief (100% relief after 2yrs)'],
    ['Preserve AIM for BPR', mechs.preserve_aim_bpr, 'Keep AIM shares for IHT BPR (subject to 2026 cap)'],
    ['Protect Property', mechs.protect_property, 'Avoid selling property -- illiquid, CGT & disposal costs'],
    ['Draw ISAs Early', mechs.draw_isa_early, 'Use tax-free ISA withdrawals first to reduce IHT-liable estate'],
    ['Draw Pension Early', mechs.draw_pension_early, 'Access pension funds early (taxed as income, currently outside IHT)'],
    ['Preserve VCT Income', mechs.preserve_vct_income, 'Keep VCT holdings to maintain tax-free dividend stream'],
  ] as const;

  p.cardBg(mechItems.length * 5 + 4);
  p.y += 3;
  for (const [label, val, desc] of mechItems) {
    doc.setFontSize(7);
    const c = val ? ACCENT : RED;
    doc.setTextColor(c[0], c[1], c[2]);
    doc.text(val ? 'Y' : 'x', p.M + 4, p.y);
    doc.setTextColor(...TEXT);
    doc.text(`${label}`, p.M + 10, p.y);
    doc.setFontSize(6);
    doc.setTextColor(...MUTED);
    doc.text(desc, p.M + 55, p.y);
    p.y += 5;
  }
  p.y += 4;

  p.subTitle('Scenario Assumptions');
  p.explanationText('These toggles model proposed tax rule changes that have not yet been enacted into law.');
  p.cardBg(14);
  p.y += 3;
  const scenarios = [
    ['2026 BPR Cap', inputs.apply_2026_bpr_cap, 'BPR relief capped at \u00A31M for AIM/unlisted; 50% above \u00A31M'],
    ['2027 Pension IHT', inputs.apply_2027_pension_iht, 'Unused pension funds included in estate for IHT from April 2027'],
  ] as const;
  for (const [label, val, desc] of scenarios) {
    doc.setFontSize(7);
    const c = val ? ACCENT : MUTED;
    doc.setTextColor(c[0], c[1], c[2]);
    doc.text(val ? 'Y ON' : 'x OFF', p.M + 4, p.y);
    doc.setTextColor(...TEXT);
    doc.text(`${label}`, p.M + 18, p.y);
    doc.setFontSize(6);
    doc.setTextColor(...MUTED);
    doc.text(desc, p.M + 55, p.y);
    p.y += 5;
  }
  p.y += 4;

  p.sectionTitle('Asset Register');
  const totalValue = assets.reduce((sum, a) => sum + a.current_value, 0);
  p.explanationText(`Your portfolio contains ${assets.length} assets totalling ${fmt(totalValue)}. The table below shows each holding, its type, tax wrapper, current value, and assumed annual growth rate.`);

  const assetClassLabels: Record<string, string> = {
    cash: 'Cash', isa: 'ISA/Fund', pension: 'Pension',
    property_investment: 'BTL Property', property_residential: 'Residence',
    vct: 'VCT', eis: 'EIS', aim_shares: 'AIM'
  };
  const wrapperLabels: Record<string, string> = {
    unwrapped: 'GIA', isa: 'ISA', pension: 'Pension', cash: 'Cash'
  };

  const colX = [p.M + 3, p.M + 62, p.M + 92, p.M + 118, p.M + 142, p.M + 162];
  p.ensureSpace(10 + assets.length * 5);
  p.cardBg(8 + assets.length * 5);
  p.y += 2;
  doc.setFillColor(40, 48, 60);
  doc.roundedRect(p.M + 1, p.y, p.CW - 2, 5, 1, 1, 'F');
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...MUTED);
  doc.text('Asset Name', colX[0], p.y + 3.5);
  doc.text('Type', colX[1], p.y + 3.5);
  doc.text('Wrapper', colX[2], p.y + 3.5);
  doc.text('Value', colX[3], p.y + 3.5);
  doc.text('Growth', colX[4], p.y + 3.5);
  doc.text('Income', colX[5], p.y + 3.5);
  doc.setFont('helvetica', 'normal');
  p.y += 7;

  for (let i = 0; i < assets.length; i++) {
    const a = assets[i];
    if (i % 2 === 0) {
      doc.setFillColor(...DARK2);
      doc.rect(p.M + 1, p.y - 3, p.CW - 2, 5, 'F');
    }
    doc.setFontSize(6.5);
    doc.setTextColor(...TEXT);
    const label = a.label.length > 28 ? a.label.substring(0, 26) + '..' : a.label;
    doc.text(label, colX[0], p.y);
    doc.setTextColor(...MUTED);
    doc.text(assetClassLabels[a.asset_class] ?? a.asset_class, colX[1], p.y);
    const wrapperColor: RGB = a.wrapper_type === 'isa' ? ACCENT : a.wrapper_type === 'pension' ? BLUE : MUTED;
    doc.setTextColor(...wrapperColor);
    doc.text(wrapperLabels[a.wrapper_type] ?? a.wrapper_type, colX[2], p.y);
    doc.setTextColor(...TEXT);
    doc.text(fmt(a.current_value), colX[3], p.y);
    doc.text(pct(a.assumed_growth_rate), colX[4], p.y);
    doc.text(a.income_generated > 0 ? fmt(a.income_generated) : '--', colX[5], p.y);
    p.y += 5;
  }

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...ACCENT);
  doc.text('Total', colX[0], p.y);
  doc.text(fmt(totalValue), colX[3], p.y);
  doc.setFont('helvetica', 'normal');
  p.y += 6;

  const byClass: Record<string, number> = {};
  for (const a of assets) {
    byClass[a.asset_class] = (byClass[a.asset_class] || 0) + a.current_value;
  }
  p.explanationText('Asset allocation: ' + Object.entries(byClass).map(([cls, val]) => `${assetClassLabels[cls] ?? cls}: ${fmt(val)} (${(val / totalValue * 100).toFixed(0)}%)`).join(' | '));

  p.y += 2;

  p.sectionTitle('Year-by-Year Action Plan');
  p.explanationText('This section shows what happens each year of your plan: income received, assets drawn, taxes paid, gifts made, and key milestones. This is the step-by-step roadmap for executing your drawdown strategy.');

  const assetMap = new Map(assets.map(a => [a.asset_id, a]));

  for (let i = 0; i < realYears.length; i++) {
    const yr = realYears[i];
    const prevYr = i > 0 ? realYears[i - 1] : null;
    const totalDrawn = Object.values(yr.drawsByAsset).reduce((s, v) => s + v, 0);
    const age = inputs.current_age + i;

    p.ensureSpace(20);

    doc.setFillColor(...MID);
    doc.roundedRect(p.M, p.y, p.CW, 6, 1, 1, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...TEXT);
    doc.text(`Year ${yr.year} -- Age ${age}`, p.M + 4, p.y + 4.2);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MUTED);
    doc.text(`Portfolio: ${fmt(yr.totalPortfolioValue)}  |  IHT: ${fmt(yr.estimatedIHTBill)}  |  Net: ${fmt(yr.totalPortfolioValue - yr.estimatedIHTBill)}`, p.M + p.CW - 4, p.y + 4.2, { align: 'right' });
    p.y += 8;

    const steps: { icon: string; label: string; amount?: string; detail?: string; color: RGB }[] = [];

    if (yr.baselineCashIncome > 0) {
      const sources: string[] = [];
      if (inputs.private_pension_income > 0) sources.push(`Private Pension ${fmt(inputs.private_pension_income)}`);
      if (inputs.state_pension_annual > 0) sources.push(`State Pension ${fmt(inputs.state_pension_annual)}`);
      for (const a of assets) {
        if (a.income_generated > 0 && (yr.valuesByAssetClass[a.asset_class] ?? 0) > 0) {
          sources.push(`${a.label} ${fmt(a.income_generated)}`);
        }
      }
      steps.push({
        icon: '->', label: 'Receive natural income',
        amount: fmt(yr.baselineCashIncome),
        detail: sources.join(', '),
        color: ACCENT
      });
    }

    if (yr.spendTargetNominal > 0) {
      steps.push({
        icon: 'o', label: `Income target (inflation-adjusted)`,
        amount: fmt(yr.spendTargetNominal),
        color: TEXT
      });
    }

    const sortedDraws = Object.entries(yr.drawsByAsset).filter(([, v]) => v > 0).sort(([, a], [, b]) => b - a);
    for (const [assetId, amount] of sortedDraws) {
      const asset = assetMap.get(assetId);
      if (!asset) continue;
      const verb = asset.wrapper_type === 'pension' ? 'Draw from' : asset.wrapper_type === 'isa' ? 'Withdraw from' : asset.asset_class.includes('property') ? 'Release from' : 'Sell from';
      let detail: string | undefined;
      if (asset.wrapper_type === 'pension' && prevYr && yr.tflsRemaining < prevYr.tflsRemaining) {
        const pclsTaken = prevYr.tflsRemaining - yr.tflsRemaining;
        if (pclsTaken > 0) detail = `Includes ${fmt(pclsTaken)} tax-free lump sum (PCLS)`;
      }
      steps.push({
        icon: '->', label: `${verb} ${asset.label}`,
        amount: fmt(amount), detail, color: BLUE
      });
    }

    if (yr.giftedThisYear > 0) {
      const gType = inputs.gift_type === 'pet' ? 'PET -- exempt if donor survives 7yr' : inputs.gift_type === 'discretionary_trust' ? `CLT -- cumulative ${fmt(yr.clt7yrCumulative)}` : 'NEFI -- immediately IHT exempt';
      steps.push({
        icon: '+', label: `Gift (${gType})`,
        amount: fmt(yr.giftedThisYear), color: AMBER
      });
    }

    if (yr.incomeTaxThisYear > 0 || yr.cgtThisYear > 0) {
      const parts: string[] = [];
      if (yr.incomeTaxThisYear > 0) parts.push(`Income Tax ${fmt(yr.incomeTaxThisYear)}`);
      if (yr.cgtThisYear > 0) parts.push(`CGT ${fmt(yr.cgtThisYear)}`);
      steps.push({
        icon: '$', label: `Tax payable: ${parts.join(' + ')}`,
        amount: fmt(yr.incomeTaxThisYear + yr.cgtThisYear), color: RED
      });
    }

    if (!yr.spendMet) {
      steps.push({
        icon: 'x', label: 'SHORTFALL -- income target not met',
        amount: fmt(yr.shortfall),
        detail: `Target: ${fmt(yr.spendTargetNominal)}, shortfall: ${fmt(yr.shortfall)}`,
        color: RED
      });
    }

    if (yr.year === 2026 && inputs.apply_2026_bpr_cap) {
      steps.push({ icon: '!', label: 'BPR cap takes effect -- 100% relief up to \u00A31M, 50% above', color: AMBER });
    }
    if (yr.year === 2027 && inputs.apply_2027_pension_iht) {
      steps.push({ icon: '!', label: 'Pension funds enter IHT estate from this year', color: AMBER });
    }

    if (prevYr) {
      for (const cls of Object.keys(prevYr.valuesByAssetClass)) {
        const prev = prevYr.valuesByAssetClass[cls] ?? 0;
        const curr = yr.valuesByAssetClass[cls] ?? 0;
        if (prev > 0 && curr <= 0) {
          steps.push({ icon: 'x', label: `${assetClassLabels[cls] ?? cls} fully depleted`, detail: `Was ${fmt(prev)}, now exhausted`, color: AMBER });
        }
      }
    }

    for (const step of steps) {
      p.ensureSpace(5);
      doc.setFontSize(6.5);
      doc.setTextColor(...step.color);
      doc.text(step.icon, p.M + 4, p.y);
      doc.setTextColor(...TEXT);
      doc.text(step.label, p.M + 10, p.y);
      if (step.amount) {
        doc.setFont('helvetica', 'bold');
        doc.text(step.amount, p.M + p.CW - 4, p.y, { align: 'right' });
        doc.setFont('helvetica', 'normal');
      }
      p.y += 3.5;
      if (step.detail) {
        doc.setFontSize(6);
        doc.setTextColor(...MUTED);
        const detailLines = doc.splitTextToSize(step.detail, p.CW - 16);
        doc.text(detailLines, p.M + 10, p.y);
        p.y += detailLines.length * 3;
      }
    }

    p.y += 3;
  }

  p.sectionTitle('Projection Summary Table');
  p.explanationText('Consolidated year-by-year numbers showing how your portfolio, tax burden, and estate evolve over time.');

  const tCols = [p.M + 2, p.M + 14, p.M + 28, p.M + 50, p.M + 70, p.M + 92, p.M + 116, p.M + 138, p.M + 160];
  p.ensureSpace(10);
  doc.setFillColor(40, 48, 60);
  doc.roundedRect(p.M, p.y, p.CW, 5, 1, 1, 'F');
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...MUTED);
  ['Yr', 'Age', 'Target', 'Income Tax', 'CGT', 'Portfolio', 'IHT', 'Gifts', 'Net Estate'].forEach((h, i) => {
    doc.text(h, tCols[i], p.y + 3.5);
  });
  doc.setFont('helvetica', 'normal');
  p.y += 7;

  for (let i = 0; i < realYears.length; i++) {
    const yr = realYears[i];
    p.ensureSpace(5);
    if (i % 2 === 0) {
      doc.setFillColor(...DARK2);
      doc.rect(p.M, p.y - 3, p.CW, 4.5, 'F');
    }
    doc.setFontSize(6);
    const isShortfall = yr.shortfall > 0;
    doc.setTextColor(isShortfall ? RED[0] : TEXT[0], isShortfall ? RED[1] : TEXT[1], isShortfall ? RED[2] : TEXT[2]);
    doc.text(`${yr.year}`, tCols[0], p.y);
    doc.text(`${inputs.current_age + i}`, tCols[1], p.y);
    doc.text(fmt(yr.spendTargetNominal), tCols[2], p.y);
    doc.text(fmt(yr.incomeTaxThisYear), tCols[3], p.y);
    doc.text(fmt(yr.cgtThisYear), tCols[4], p.y);
    doc.text(fmt(yr.totalPortfolioValue), tCols[5], p.y);
    doc.text(fmt(yr.estimatedIHTBill), tCols[6], p.y);
    doc.text(fmt(yr.giftedThisYear), tCols[7], p.y);
    doc.text(fmt(yr.totalPortfolioValue - yr.estimatedIHTBill), tCols[8], p.y);
    p.y += 4.5;
  }
  p.y += 4;

  p.sectionTitle('Strategy Comparison');
  p.explanationText('How your chosen blend compares to the standard preset strategies. Each column shows the result if that strategy were applied to your entire portfolio.');

  const strategies: { key: DrawdownStrategy; label: string }[] = [
    { key: 'balanced', label: 'Balanced' },
    { key: 'tax_optimised', label: 'Tax Opt.' },
    { key: 'iht_optimised', label: 'IHT Opt.' },
    { key: 'income_first', label: 'Income 1st' },
    { key: 'growth_first', label: 'Growth 1st' },
  ];
  const stratResults = strategies.map(s => ({
    ...s, result: runSimulation({ ...inputs, priority_weights: { ...STRATEGY_PRESETS[s.key] } }, assets, taxParams)
  }));

  const sColW = (p.CW - 32) / 6;
  p.ensureSpace(28);
  p.cardBg(26);
  p.y += 3;
  doc.setFillColor(40, 48, 60);
  doc.roundedRect(p.M + 1, p.y, p.CW - 2, 5, 1, 1, 'F');
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...MUTED);
  doc.text('Metric', p.M + 4, p.y + 3.5);
  stratResults.forEach((s, i) => {
    doc.text(s.label, p.M + 32 + i * sColW, p.y + 3.5);
  });
  doc.setTextColor(...ACCENT);
  doc.text('Your Blend', p.M + 32 + 5 * sColW, p.y + 3.5);
  doc.setFont('helvetica', 'normal');
  p.y += 7;

  const compRows = [
    { label: 'Funded Years', getValue: (r: SimulationResult) => `${r.summary.funded_years}/${inputs.plan_years}` },
    { label: 'Total Tax', getValue: (r: SimulationResult) => fmt(r.summary.total_tax_paid) },
    { label: 'IHT Liability', getValue: (r: SimulationResult) => fmt(r.summary.iht_at_end) },
    { label: 'Net Estate', getValue: (r: SimulationResult) => fmt(r.summary.net_estate_after_iht) },
  ];
  for (const row of compRows) {
    doc.setFontSize(6);
    doc.setTextColor(...MUTED);
    doc.text(row.label, p.M + 4, p.y);
    stratResults.forEach((s, i) => {
      doc.setTextColor(...TEXT);
      doc.text(row.getValue(s.result), p.M + 32 + i * sColW, p.y);
    });
    doc.setTextColor(...ACCENT);
    doc.setFont('helvetica', 'bold');
    doc.text(row.getValue(result), p.M + 32 + 5 * sColW, p.y);
    doc.setFont('helvetica', 'normal');
    p.y += 4;
  }
  p.y += 6;

  const warnings = evaluateRegisterWarnings(assets);
  const yearWarnings = realYears.flatMap(yr => yr.flags);
  const allWarnings = [...warnings, ...yearWarnings];
  if (allWarnings.length > 0) {
    p.sectionTitle('Warnings & Recommendations');
    p.explanationText('Issues identified with your portfolio or plan that may need attention.');
    for (const w of allWarnings.slice(0, 15)) {
      p.ensureSpace(6);
      const wColor = w.severity === 'error' ? RED : w.severity === 'warning' ? AMBER : MUTED;
      doc.setFontSize(6.5);
      doc.setTextColor(...wColor);
      doc.text(w.severity === 'error' ? 'x' : w.severity === 'warning' ? '!' : 'i', p.M + 2, p.y);
      doc.setTextColor(...TEXT);
      const wLines = doc.splitTextToSize(w.message, p.CW - 12);
      doc.text(wLines, p.M + 8, p.y);
      p.y += wLines.length * 3.5 + 2;
    }
    p.y += 4;
  }

  p.sectionTitle('Glossary');
  p.explanationText('Key terms used in this report:');
  const glossary = [
    ['IHT', 'Inheritance Tax -- 40% tax on estate value above the nil-rate band (\u00A3325k + \u00A3175k residence nil-rate)'],
    ['BPR', 'Business Property Relief -- up to 100% IHT relief for qualifying business assets held 2+ years'],
    ['CGT', 'Capital Gains Tax -- tax on profit when selling assets (10%/20% basic/higher rate; 18%/24% for property)'],
    ['PET', 'Potentially Exempt Transfer -- gift to individuals, exempt from IHT if donor survives 7 years'],
    ['CLT', 'Chargeable Lifetime Transfer -- gift into a trust, taxed at 20% above nil-rate band'],
    ['NEFI', 'Normal Expenditure from Income -- regular gifts from surplus income, immediately IHT exempt'],
    ['PCLS/TFLS', 'Pension Commencement Lump Sum / Tax-Free Lump Sum -- 25% of pension taken tax-free'],
    ['VCT', 'Venture Capital Trust -- tax-free dividends, CGT-exempt after 5yr hold. NOT IHT exempt'],
    ['EIS', 'Enterprise Investment Scheme -- IHT exempt via BPR after 2yr hold, CGT-exempt if held 3yr+'],
    ['ISA', 'Individual Savings Account -- tax-free growth and income, but remains in estate for IHT'],
    ['GIA', 'General Investment Account -- unwrapped investments subject to income tax, CGT, and IHT'],
    ['SIPP', 'Self-Invested Personal Pension -- pension drawn as taxable income, currently outside IHT estate'],
  ];
  for (const [term, desc] of glossary) {
    p.ensureSpace(5);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...ACCENT);
    doc.text(term, p.M + 4, p.y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MUTED);
    const descLines = doc.splitTextToSize(desc, p.CW - 30);
    doc.text(descLines, p.M + 24, p.y);
    p.y += descLines.length * 3.5 + 1;
  }

  p.y += 6;
  p.ensureSpace(20);
  doc.setDrawColor(50, 60, 75);
  doc.setLineWidth(0.2);
  doc.line(p.M, p.y, p.M + p.CW, p.y);
  p.y += 5;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...TEXT);
  doc.text('Important Disclaimer', p.M, p.y);
  p.y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...MUTED);
  const disclaimer = 'This document is a planning estimate only and does not constitute financial advice. All projections are based on assumed growth rates, current tax rules, and the parameters shown above. Tax rules, allowances, and rates may change. Actual returns will vary from assumed growth rates. You should consult a qualified financial adviser before making any financial decisions based on these projections.';
  const discLines = doc.splitTextToSize(disclaimer, p.CW);
  doc.text(discLines, p.M, p.y);
  p.y += discLines.length * 3.5 + 3;
  doc.setFontSize(6);
  doc.text(`Tax parameters: UK HMRC ${taxParams.schedule[0]?.tax_year ?? 'current year'} rates. ${taxParams.hold_flat_disclosure}`, p.M, p.y);

  const filename = `Unlock-Plan-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
