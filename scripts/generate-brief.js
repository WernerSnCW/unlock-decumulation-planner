const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
  PageBreak, LevelFormat, Header, Footer, PageNumber
} = require('docx');

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };

function cell(text, opts = {}) {
  const runs = [];
  if (typeof text === 'string') {
    runs.push(new TextRun({ text, bold: opts.bold || false, size: opts.size || 22, font: "Arial" }));
  } else {
    // array of text runs
    text.forEach(t => runs.push(new TextRun({ ...t, font: "Arial", size: t.size || 22 })));
  }
  return new TableCell({
    borders,
    width: { size: opts.width || 4680, type: WidthType.DXA },
    shading: opts.shading ? { fill: opts.shading, type: ShadingType.CLEAR } : undefined,
    margins: cellMargins,
    children: [new Paragraph({ children: runs, alignment: opts.align || AlignmentType.LEFT })],
  });
}

function heading(text, level) {
  return new Paragraph({
    heading: level,
    spacing: { before: level === HeadingLevel.HEADING_1 ? 360 : 240, after: 160 },
    children: [new TextRun({ text, font: "Arial", bold: true, size: level === HeadingLevel.HEADING_1 ? 32 : level === HeadingLevel.HEADING_2 ? 26 : 24 })],
  });
}

function para(text, opts = {}) {
  const runs = [];
  if (typeof text === 'string') {
    runs.push(new TextRun({ text, font: "Arial", size: 22, ...opts }));
  } else {
    text.forEach(t => runs.push(new TextRun({ font: "Arial", size: 22, ...t })));
  }
  return new Paragraph({
    spacing: { after: opts.afterSpacing || 160 },
    children: runs,
    alignment: opts.alignment || AlignmentType.LEFT,
  });
}

function bullet(text, ref = "bullets") {
  const runs = typeof text === 'string'
    ? [new TextRun({ text, font: "Arial", size: 22 })]
    : text.map(t => new TextRun({ font: "Arial", size: 22, ...t }));
  return new Paragraph({
    numbering: { reference: ref, level: 0 },
    spacing: { after: 80 },
    children: runs,
  });
}

const doc = new Document({
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } }
        }]
      },
      {
        reference: "numbers",
        levels: [{
          level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } }
        }]
      },
    ]
  },
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, font: "Arial", color: "1A1A1A" },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, font: "Arial", color: "2A2A2A" },
        paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: "3A3A3A" },
        paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 2 } },
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
      }
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: "Unlock Decumulation Planner \u2014 Implementation Brief", font: "Arial", size: 18, color: "888888", italics: true })]
        })]
      })
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "Confidential \u2014 Page ", font: "Arial", size: 18, color: "888888" }),
            new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 18, color: "888888" }),
          ]
        })]
      })
    },
    children: [
      // ═══════════════ TITLE PAGE ═══════════════
      new Paragraph({ spacing: { before: 2400 }, children: [] }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [new TextRun({ text: "Unlock Decumulation Planner", font: "Arial", size: 48, bold: true })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 600 },
        children: [new TextRun({ text: "Implementation Brief", font: "Arial", size: 36, color: "00BB77" })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
        children: [new TextRun({ text: "Three workstreams: Asset Growth Defaults, EIS Rework, Tensions Framework", font: "Arial", size: 22, color: "666666" })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 1200 },
        children: [new TextRun({ text: "April 2026", font: "Arial", size: 22, color: "666666" })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
        children: [new TextRun({ text: "Prepared by: Werner Snyman", font: "Arial", size: 20, color: "888888" })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "Source: Tom King specification documents (April 2026)", font: "Arial", size: 20, color: "888888" })]
      }),

      new Paragraph({ children: [new PageBreak()] }),

      // ═══════════════ CONTEXT ═══════════════
      heading("What this document is", HeadingLevel.HEADING_1),

      para("This brief explains three sets of changes that need to be made to the Unlock Decumulation Planner. It is written for the developer who will implement them."),

      para("The changes come from three specification documents written by Tom King. Rather than hand those documents over raw, this brief translates them into a practical implementation guide: what the app does today, what needs to change, what the risks are, and what order to do it in."),

      para("The three workstreams are:"),

      bullet([{ text: "Asset Growth Defaults", bold: true }, { text: " \u2014 giving each asset class a researched default growth rate instead of making the user guess" }]),
      bullet([{ text: "EIS Rework", bold: true }, { text: " \u2014 fundamentally changing how Enterprise Investment Scheme assets are modelled, displayed, and projected" }]),
      bullet([{ text: "Tensions Framework", bold: true }, { text: " \u2014 a new system that detects when a user\u2019s goals are in conflict and helps them resolve the trade-off" }]),

      para("They range from straightforward to architecturally significant. Read this brief before starting any of them."),

      new Paragraph({ children: [new PageBreak()] }),

      // ═══════════════ WHERE WE ARE TODAY ═══════════════
      heading("Where the app is today", HeadingLevel.HEADING_1),

      para("The Unlock Decumulation Planner is a multi-page React/TypeScript application. An investor logs in with an access code, enters their portfolio of assets (ISAs, pensions, properties, VCTs, EIS, AIM shares, cash), sets an income target, and the engine simulates year-by-year drawdown across a 25+ year retirement horizon."),

      para("The engine is sophisticated. It handles income tax, CGT, IHT (including RNRB, BPR, charitable deductions), pension crystallisation with PCLS, multiple drawdown strategies (tax-optimised, IHT-optimised, balanced), EIS/VCT programme modelling, NRB trust gifting, and asset-specific disposal events. There are 178 engine tests, 177 of which pass."),

      para("What it does not yet do:"),

      bullet("Provide sensible default growth rates per asset class \u2014 the user must set each one manually"),
      bullet("Model EIS correctly \u2014 EIS is currently treated like any other asset in the drawdown queue, which is wrong. EIS capital is locked, illiquid, and its return profile is fundamentally different from equities or bonds"),
      bullet("Detect goal conflicts \u2014 if a user wants high income, a large legacy, and an active EIS programme, the app does not tell them these goals are in tension. It just runs the numbers and lets them figure it out"),

      para("These three gaps are what the specification documents address."),

      new Paragraph({ children: [new PageBreak()] }),

      // ═══════════════ WORKSTREAM A ═══════════════
      heading("Workstream A: Asset Growth Defaults", HeadingLevel.HEADING_1),

      heading("What it is", HeadingLevel.HEADING_2),

      para("Every asset in the register has a growth rate field. Today, the user sets it manually. Most users have no idea what to put. The spec provides researched defaults for each asset class, with source references, and a sensible override range."),

      heading("The defaults", HeadingLevel.HEADING_2),

      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [2200, 1400, 1400, 4360],
        rows: [
          new TableRow({ children: [
            cell("Asset Class", { bold: true, width: 2200, shading: "E8F5E9" }),
            cell("Default", { bold: true, width: 1400, shading: "E8F5E9" }),
            cell("Range", { bold: true, width: 1400, shading: "E8F5E9" }),
            cell("Source", { bold: true, width: 4360, shading: "E8F5E9" }),
          ]}),
          new TableRow({ children: [
            cell("Cash", { width: 2200 }), cell("3.5%", { width: 1400 }), cell("1\u20136%", { width: 1400 }),
            cell("BoE base rate less savings drag", { width: 4360 }),
          ]}),
          new TableRow({ children: [
            cell("ISA (equities)", { width: 2200 }), cell("6.5%", { width: 1400 }), cell("2\u201310%", { width: 1400 }),
            cell("FCA mid rate (5%) to long-run nominal (7.5%)", { width: 4360 }),
          ]}),
          new TableRow({ children: [
            cell("Pension (drawdown)", { width: 2200 }), cell("4.5%", { width: 1400 }), cell("2\u20139%", { width: 1400 }),
            cell("De-risked 60/40 blend for decumulation", { width: 4360 }),
          ]}),
          new TableRow({ children: [
            cell("Property", { width: 2200 }), cell("3.0%", { width: 1400 }), cell("0\u20137%", { width: 1400 }),
            cell("Land Registry long-run; capital only, not rent", { width: 4360 }),
          ]}),
          new TableRow({ children: [
            cell("AIM shares", { width: 2200 }), cell("5.0%", { width: 1400 }), cell("-5\u201315%", { width: 1400 }),
            cell("Main market discount; BPR is the real value", { width: 4360 }),
          ]}),
          new TableRow({ children: [
            cell("VCT (NAV)", { width: 2200 }), cell("0\u20133%", { width: 1400 }), cell("-5\u20138%", { width: 1400 }),
            cell("Capital return modest; dividends are the return", { width: 4360 }),
          ]}),
          new TableRow({ children: [
            cell("EIS", { width: 2200 }), cell("Scenario", { width: 1400 }), cell("N/A", { width: 1400 }),
            cell("Non-deterministic \u2014 use scenario-based model", { width: 4360 }),
          ]}),
        ]
      }),

      para(""),

      heading("What to build", HeadingLevel.HEADING_2),

      para("This is the simplest of the three workstreams. Three things:"),

      new Paragraph({
        numbering: { reference: "numbers", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "A config file ", font: "Arial", size: 22 }), new TextRun({ text: "(src/data/assetGrowthDefaults.ts)", font: "Arial", size: 22, italics: true }), new TextRun({ text: " with the defaults, ranges, and source text for each asset class", font: "Arial", size: 22 })],
      }),
      new Paragraph({
        numbering: { reference: "numbers", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Auto-populate the growth rate when a user selects an asset class in the editor. Do not overwrite rates the user has already set.", font: "Arial", size: 22 })],
      }),
      new Paragraph({
        numbering: { reference: "numbers", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Show the source basis as a tooltip next to the growth rate field, and warn (do not block) if the user enters a value outside the recommended range.", font: "Arial", size: 22 })],
      }),

      para(""),

      heading("Risk", HeadingLevel.HEADING_2),

      para("Essentially none. This does not touch the engine. It only changes how default values are populated in the UI. Existing assets with user-set rates are unaffected."),

      para([{ text: "Estimated effort: half a day.", bold: true }]),

      new Paragraph({ children: [new PageBreak()] }),

      // ═══════════════ WORKSTREAM B ═══════════════
      heading("Workstream B: EIS Rework", HeadingLevel.HEADING_1),

      heading("Why this matters", HeadingLevel.HEADING_2),

      para("This is the most important and most dangerous workstream. The current app treats EIS like any other asset \u2014 it sits in the drawdown queue, gets drawn down when the engine needs cash, and shows a single scenario value on the portfolio chart. That is wrong."),

      para("EIS capital is locked. You cannot sell EIS shares on demand. The return is binary \u2014 an investment might return nothing or 20 times the original amount. The timeline is unknowable: exits happen when they happen, typically 5\u201310 years but sometimes never. Loss relief changes the effective cost of failure. None of this is reflected in the current model."),

      para("The spec calls for a two-layer architecture:"),

      heading("Layer 1: Main plan", HeadingLevel.HEADING_3),

      bullet("EIS is removed from the drawdown queue entirely. The engine never draws from EIS to fund income."),
      bullet([{ text: "EIS is displayed at \u201Cnet capital at risk\u201D " }, { text: "(amount invested minus 30% income tax relief)", italics: true }, { text: ", not at gross value. This is what the user has economically committed." }]),
      bullet("EIS has zero growth in the main plan. It sits as a locked, non-growing position until an actual exit event is confirmed."),
      bullet("A banner reminds the user that EIS is not in their drawdown projections."),

      heading("Layer 2: EIS projection panel", HeadingLevel.HEADING_3),

      bullet("A dedicated panel below the main plan charts, with its own projection chart running on the same timeline."),
      bullet([{ text: "Three scenarios shown simultaneously: " }, { text: "all investments fail", bold: true }, { text: " (net effective loss after reliefs), " }, { text: "typical portfolio outcome", bold: true }, { text: " (range, not a line), and " }, { text: "strong performance", bold: true }, { text: " (range, not a line)." }]),
      bullet("An exit horizon slider (3/5/7/10/12+ years, default 7) and a reinvest/harvest toggle."),
      bullet("When reinvest is selected, six things must happen simultaneously: proceeds stay out of the main plan, a new EIS lot is created, fresh 30% relief is applied, fresh CGT and BPR clocks start, and income must come entirely from other assets during the reinvestment period."),

      heading("Per-company tracking", HeadingLevel.HEADING_3),

      para("The current model tracks EIS at vintage-year level (one entry per year of investment). The spec calls for per-company tracking with three states:"),

      bullet([{ text: "Modelled", bold: true }, { text: " \u2014 scenario assumption only, never in main cashflow" }]),
      bullet([{ text: "Estimated", bold: true }, { text: " \u2014 user has entered a valuation, updates display but still not in main cashflow" }]),
      bullet([{ text: "Confirmed", bold: true }, { text: " \u2014 actual exit or write-off recorded with date and proceeds, becomes a dated cashflow event in the main plan" }]),

      para("Confirmed events cannot be downgraded. They are permanent records. Each company has its own 2-year BPR qualifying clock."),

      heading("The loss formula", HeadingLevel.HEADING_3),

      para("Implement exactly as specified:"),

      para([
        { text: "I", bold: true }, { text: " = gross investment" }, { text: "\n" }
      ]),
      para([
        { text: "R", bold: true }, { text: " = 30% \u00D7 I (income tax relief)" }
      ]),
      para([
        { text: "A", bold: true }, { text: " = I \u2013 R (net capital at risk)" }
      ]),
      para([
        { text: "L", bold: true }, { text: " = A \u00D7 m (loss relief, where m = marginal tax rate)" }
      ]),
      para([
        { text: "N", bold: true }, { text: " = I \u2013 R \u2013 L (net effective loss after all reliefs)" }
      ]),

      para("For an additional-rate taxpayer investing \u00A3100,000: N = \u00A3100,000 \u2013 \u00A330,000 \u2013 \u00A331,500 = \u00A338,500. That is 38.5p on the pound. Never show \u00A3100,000 as the downside \u2014 that overstates the risk."),

      heading("What this breaks", HeadingLevel.HEADING_2),

      para([{ text: "This will change simulation results for every user who has EIS in their portfolio.", bold: true }, { text: " When EIS is removed from the drawdown queue, liquid assets (cash, ISAs, GIAs) deplete faster because they are now covering income that EIS used to cover. Portfolio charts will look different. Funded years may change." }]),

      para("You need a feature flag to roll this back if something goes wrong. Add an engine setting that lets you switch between the old model and the new one."),

      para("The existing 178-test engine suite will need EIS-related tests updated \u2014 the expected values will be different because the model is fundamentally different. That is expected, not a bug."),

      para([{ text: "Estimated effort: 3\u20134 days.", bold: true }, { text: " Most of the time will be spent on the engine changes and making sure the per-company data model works cleanly with the existing vintage-year fallback." }]),

      new Paragraph({ children: [new PageBreak()] }),

      // ═══════════════ WORKSTREAM C ═══════════════
      heading("Workstream C: Tensions Framework", HeadingLevel.HEADING_1),

      heading("The idea", HeadingLevel.HEADING_2),

      para("A tension is when two or more of the user\u2019s goals conflict. For example: a user wants \u00A3250,000 per year in retirement income, an active EIS programme investing \u00A350,000 per year, and a \u00A35 million legacy for their children. These three goals cannot all be achieved simultaneously with a \u00A33 million portfolio. The tool needs to detect this and say so \u2014 in plain English, with numbers, and with actionable options."),

      para("Today, the app has warnings (missing data, shortfall alerts) but no concept of goal conflicts. The user sets their inputs, runs the simulation, and interprets the output themselves. The tensions framework changes this by automatically detecting conflicts and presenting them as decision cards with resolution options that reconfigure the plan."),

      heading("How it works", HeadingLevel.HEADING_2),

      para([{ text: "Step 1: Goal capture.", bold: true }, { text: " On first use, the user sets their goals: annual income target, legacy target, EIS investment amount, risk tolerance, and any other objectives (property to pass to children, care cost reserve, charitable giving). These are soft targets \u2014 optimisation objectives, not hard constraints." }]),

      para([{ text: "Step 2: Detection.", bold: true }, { text: " After the simulation runs, the tension engine evaluates 14 defined tensions. Each has a trigger condition, a financial impact calculation (either one-off or cumulative over the plan horizon), and a severity rating." }]),

      para([{ text: "Step 3: Presentation.", bold: true }, { text: " Tensions are shown in two tiers:" }]),

      bullet([{ text: "Issues to resolve", bold: true }, { text: " (Tier 1) \u2014 things that will materially damage the plan regardless of preferences. Shown first, prominently." }]),
      bullet([{ text: "Decisions to consider", bold: true }, { text: " (Tier 2) \u2014 genuine trade-offs where the user must choose which goal to prioritise. Shown after Tier 1." }]),

      para([{ text: "Step 4: Resolution.", bold: true }, { text: " Each tension card has a helper question and 2\u20133 resolution options. Selecting one immediately changes the plan parameters and re-runs the simulation. The tension card updates to show whether the conflict is resolved." }]),

      heading("The 14 tensions", HeadingLevel.HEADING_2),

      para("The spec defines 14 specific tensions across five groups. The most important ones:"),

      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [700, 900, 3400, 1200, 3160],
        rows: [
          new TableRow({ children: [
            cell("ID", { bold: true, width: 700, shading: "E8F5E9" }),
            cell("Tier", { bold: true, width: 900, shading: "E8F5E9" }),
            cell("What it detects", { bold: true, width: 3400, shading: "E8F5E9" }),
            cell("Group", { bold: true, width: 1200, shading: "E8F5E9" }),
            cell("Depends on", { bold: true, width: 3160, shading: "E8F5E9" }),
          ]}),
          new TableRow({ children: [
            cell("T1A", { width: 700 }), cell("1", { width: 900 }),
            cell("Plan runs out of money before the end of the horizon", { width: 3400 }),
            cell("Income", { width: 1200 }), cell("Nothing \u2014 build first", { width: 3160 }),
          ]}),
          new TableRow({ children: [
            cell("T1B", { width: 700 }), cell("2", { width: 900 }),
            cell("Legacy target not achievable at current settings", { width: 3400 }),
            cell("Income", { width: 1200 }), cell("Nothing", { width: 3160 }),
          ]}),
          new TableRow({ children: [
            cell("T10", { width: 700 }), cell("1", { width: 900 }),
            cell("Cash floor breached within the plan horizon", { width: 3400 }),
            cell("Horizon", { width: 1200 }), cell("Nothing", { width: 3160 }),
          ]}),
          new TableRow({ children: [
            cell("T4", { width: 700 }), cell("2", { width: 900 }),
            cell("IHT optimisation conflicts with income tax minimisation", { width: 3400 }),
            cell("Tax", { width: 1200 }), cell("Nothing", { width: 3160 }),
          ]}),
          new TableRow({ children: [
            cell("T2", { width: 700 }), cell("2", { width: 900 }),
            cell("Income + EIS + legacy all competing for the same assets", { width: 3400 }),
            cell("Income", { width: 1200 }), cell("EIS rework (B)", { width: 3160 }),
          ]}),
          new TableRow({ children: [
            cell("T8", { width: 700 }), cell("1", { width: 900 }),
            cell("Engine would draw from AIM/EIS before BPR clock completes", { width: 3400 }),
            cell("Estate", { width: 1200 }), cell("EIS rework (B)", { width: 3160 }),
          ]}),
          new TableRow({ children: [
            cell("T13", { width: 700 }), cell("2", { width: 900 }),
            cell("EIS looks wealthy on paper but the capital is inaccessible", { width: 3400 }),
            cell("EIS", { width: 1200 }), cell("EIS rework (B)", { width: 3160 }),
          ]}),
        ]
      }),

      para(""),

      para("The full list of all 14 tensions with their trigger conditions, formulas, and helper text is in the source documents. The key point for implementation: 9 of the 14 tensions reference EIS behaviour. They cannot be built correctly until Workstream B (EIS Rework) is complete."),

      heading("Suppression", HeadingLevel.HEADING_2),

      para("Not every conflict is worth surfacing. Small tensions are noise. The spec defines a suppression rule:"),

      bullet("Compounding tensions (ones that accumulate over the plan horizon): only show if cumulative impact is \u00A325,000 or more"),
      bullet("One-off tensions (single events): only show if impact is \u00A35,000 or more"),

      heading("Test fixtures", HeadingLevel.HEADING_2),

      para([{ text: "The Tensions for Unlock document includes three full JSON test fixtures " }, { text: "(T1A, T10, T12)", italics: true }, { text: " with exact expected values and rendered card copy. Use these as your acceptance tests. If the engine produces these payloads correctly for the described scenarios, the implementation is right." }]),

      para([{ text: "Estimated effort: 2\u20133 days.", bold: true }, { text: " The tension detection engine is new code, not a refactor. The hardest part is the resolution action loop \u2014 when a resolution changes a parameter, it triggers re-simulation, which might resolve one tension but create another. Cap the re-detection loop at 3 cycles." }]),

      new Paragraph({ children: [new PageBreak()] }),

      // ═══════════════ BUILD ORDER ═══════════════
      heading("Build order", HeadingLevel.HEADING_1),

      para("This matters. Get it wrong and you will be rebuilding things."),

      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [800, 3400, 1200, 3960],
        rows: [
          new TableRow({ children: [
            cell("Phase", { bold: true, width: 800, shading: "E8F5E9" }),
            cell("What", { bold: true, width: 3400, shading: "E8F5E9" }),
            cell("Effort", { bold: true, width: 1200, shading: "E8F5E9" }),
            cell("Depends on", { bold: true, width: 3960, shading: "E8F5E9" }),
          ]}),
          new TableRow({ children: [
            cell("1", { width: 800 }), cell("Asset Growth Defaults", { width: 3400 }),
            cell("Half a day", { width: 1200 }), cell("Nothing. Do this first.", { width: 3960 }),
          ]}),
          new TableRow({ children: [
            cell("2", { width: 800 }), cell("EIS Rework \u2014 engine changes", { width: 3400 }),
            cell("2 days", { width: 1200 }), cell("Phase 1 (ideally, not strictly)", { width: 3960 }),
          ]}),
          new TableRow({ children: [
            cell("3", { width: 800 }), cell("EIS Rework \u2014 projection panel + UI", { width: 3400 }),
            cell("1\u20132 days", { width: 1200 }), cell("Phase 2", { width: 3960 }),
          ]}),
          new TableRow({ children: [
            cell("4", { width: 800 }), cell("Core Tensions (T1A, T1B, T10, T4)", { width: 3400 }),
            cell("1\u20132 days", { width: 1200 }), cell("Nothing (these 4 do not need EIS)", { width: 3960 }),
          ]}),
          new TableRow({ children: [
            cell("5", { width: 800 }), cell("EIS-dependent Tensions (remaining 10)", { width: 3400 }),
            cell("1\u20132 days", { width: 1200 }), cell([{ text: "Phase 3 (EIS rework must be done)", bold: true }], { width: 3960 }),
          ]}),
        ]
      }),

      para(""),

      para([
        { text: "Critical dependency: ", bold: true },
        { text: "Phase 5 will fail if Phase 3 is not complete. Nine of the fourteen tensions depend on EIS being modelled correctly \u2014 removed from the drawdown queue, with per-company tracking and the three-state lifecycle. If you build those tensions against the current EIS model, they will produce wrong numbers and you will have to rebuild them." }
      ]),

      para("Phases 1 and 4 can run in parallel if you have the capacity. They are independent."),

      new Paragraph({ children: [new PageBreak()] }),

      // ═══════════════ RISKS ═══════════════
      heading("Risks and things to watch", HeadingLevel.HEADING_1),

      heading("EIS regression is certain", HeadingLevel.HEADING_2),

      para("Removing EIS from the drawdown queue will change every simulation that includes EIS. This is by design \u2014 the current model is wrong \u2014 but it means existing users will see different numbers. Implement a feature flag so you can switch between old and new behaviour during testing."),

      heading("Per-company EIS is optional", HeadingLevel.HEADING_2),

      para("The per-company tracking layer should be additive. Users who do not enter company-level detail should still get results from the existing vintage-year cohort model. Do not force migration. The per-company layer overrides the cohort model only when populated."),

      heading("Tension resolution can loop", HeadingLevel.HEADING_2),

      para("When a user selects a resolution option, it changes a parameter, which re-runs the simulation, which re-evaluates tensions. A resolution that fixes one tension might trigger another. Cap the re-detection loop at three cycles. If tensions are still unstable after three rounds, show whatever remains."),

      heading("EIS scenario ranges are not fully specified", HeadingLevel.HEADING_2),

      para("The spec says scenarios 2 and 3 should show ranges (bands), not single lines. It does not define the range bounds precisely. Use the existing scenario multiples as the midpoint and apply a sensible spread (e.g., the base case scenario range runs from the bear multiple to the bull multiple). Clarify with Tom if needed."),

      heading("Test with the provided fixtures", HeadingLevel.HEADING_2),

      para("The Tensions for Unlock document contains three complete JSON test fixtures with exact expected values. These are your acceptance criteria. Run them early and often."),

      new Paragraph({ children: [new PageBreak()] }),

      // ═══════════════ REFERENCE ═══════════════
      heading("Technical reference", HeadingLevel.HEADING_1),

      para("The detailed file map, code snippets, interface definitions, and per-tension trigger conditions are in docs/IMPLEMENTATION-SPEC.md in the repo. That document is the engineering companion to this brief. This brief tells you what and why; the spec tells you exactly how."),

      heading("Key files", HeadingLevel.HEADING_2),

      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [4680, 4680],
        rows: [
          new TableRow({ children: [
            cell("File", { bold: true, width: 4680, shading: "E8F5E9" }),
            cell("What it does", { bold: true, width: 4680, shading: "E8F5E9" }),
          ]}),
          new TableRow({ children: [
            cell("src/engine/decumulation.ts", { width: 4680 }),
            cell("Main simulation engine (1,600+ lines). This is where EIS drawdown removal happens.", { width: 4680 }),
          ]}),
          new TableRow({ children: [
            cell("src/engine/warningEvaluator.ts", { width: 4680 }),
            cell("Existing warnings. Keep these \u2014 tensions are strategic, warnings are tactical.", { width: 4680 }),
          ]}),
          new TableRow({ children: [
            cell("src/components/InputPanel.tsx", { width: 4680 }),
            cell("All settings UI. EIS controls, growth rates, and goal capture live here.", { width: 4680 }),
          ]}),
          new TableRow({ children: [
            cell("src/context/PlannerContext.tsx", { width: 4680 }),
            cell("State management. Runs simulation on input changes. Tension detection hooks in here.", { width: 4680 }),
          ]}),
          new TableRow({ children: [
            cell("src/pages/AnalysisPage.tsx", { width: 4680 }),
            cell("Charts and output. EIS panel and tensions panel go here.", { width: 4680 }),
          ]}),
          new TableRow({ children: [
            cell("docs/IMPLEMENTATION-SPEC.md", { width: 4680 }),
            cell("Full technical specification with code snippets and interface definitions.", { width: 4680 }),
          ]}),
        ]
      }),

      para(""),

      heading("Source documents", HeadingLevel.HEADING_2),

      bullet([{ text: "Asset Growth into Unlock.docx", bold: true }, { text: " \u2014 researched growth rates for all asset classes with FCA, ONS, and market data references" }]),
      bullet([{ text: "EIS into Unlock.docx", bold: true }, { text: " \u2014 full EIS display and modelling specification including the two-layer architecture, per-company tracking, reinvestment logic, and loss formula" }]),
      bullet([{ text: "Tensions for Unlock.docx", bold: true }, { text: " \u2014 tension framework with all 14 tensions defined, plus three JSON test fixtures for validation" }]),

      para("All three are in the docs/ folder of the repository."),

      new Paragraph({ children: [new PageBreak()] }),

      // ═══════════════ HOW TO IMPLEMENT WITH REPLIT ═══════════════
      heading("How to implement this with Replit", HeadingLevel.HEADING_1),

      para("The work has been broken into five self-contained specification files, one per phase. Each file defines what the feature must do, the acceptance criteria to verify it, and the constraints to follow. They do not contain code snippets or file edit instructions \u2014 Replit figures out the implementation; you verify the output."),

      para("The files are in the repository under docs/phases/:"),

      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [3600, 1200, 2000, 2560],
        rows: [
          new TableRow({ children: [
            cell("File", { bold: true, width: 3600, shading: "E8F5E9" }),
            cell("Effort", { bold: true, width: 1200, shading: "E8F5E9" }),
            cell("Depends on", { bold: true, width: 2000, shading: "E8F5E9" }),
            cell("What it covers", { bold: true, width: 2560, shading: "E8F5E9" }),
          ]}),
          new TableRow({ children: [
            cell("PHASE-1-asset-growth-defaults.md", { width: 3600 }),
            cell("Half a day", { width: 1200 }),
            cell("Nothing", { width: 2000 }),
            cell("Default growth rates per asset class", { width: 2560 }),
          ]}),
          new TableRow({ children: [
            cell("PHASE-2-eis-engine-changes.md", { width: 3600 }),
            cell("2 days", { width: 1200 }),
            cell("Nothing", { width: 2000 }),
            cell("Remove EIS from drawdown, per-company model, loss formula", { width: 2560 }),
          ]}),
          new TableRow({ children: [
            cell("PHASE-3-eis-projection-panel.md", { width: 3600 }),
            cell("1\u20132 days", { width: 1200 }),
            cell("Phase 2", { width: 2000 }),
            cell("EIS projection chart, reinvestment, exit controls", { width: 2560 }),
          ]}),
          new TableRow({ children: [
            cell("PHASE-4-core-tensions.md", { width: 3600 }),
            cell("1\u20132 days", { width: 1200 }),
            cell("Nothing", { width: 2000 }),
            cell("Tension framework + 4 core tensions", { width: 2560 }),
          ]}),
          new TableRow({ children: [
            cell("PHASE-5-eis-and-advanced-tensions.md", { width: 3600 }),
            cell("1\u20132 days", { width: 1200 }),
            cell([{ text: "Phases 2, 3, AND 4", bold: true }], { width: 2000 }),
            cell("Remaining 10 tensions", { width: 2560 }),
          ]}),
        ]
      }),

      para(""),

      heading("The process", HeadingLevel.HEADING_2),

      para("For each phase:"),

      new Paragraph({
        numbering: { reference: "numbers", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Open a new Replit agent session", font: "Arial", size: 22 })],
      }),
      new Paragraph({
        numbering: { reference: "numbers", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Give it this prompt: ", font: "Arial", size: 22 }), new TextRun({ text: "\"Read docs/phases/PHASE-X-name.md and implement it. Run the existing tests when done.\"", font: "Arial", size: 22, italics: true })],
      }),
      new Paragraph({
        numbering: { reference: "numbers", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Let Replit work through it", font: "Arial", size: 22 })],
      }),
      new Paragraph({
        numbering: { reference: "numbers", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Check the output against the acceptance criteria listed in the phase file", font: "Arial", size: 22 })],
      }),
      new Paragraph({
        numbering: { reference: "numbers", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Only move to the next phase once you are satisfied", font: "Arial", size: 22 })],
      }),

      para(""),

      para([{ text: "Do not give Replit all five files at once.", bold: true }, { text: " It will try to do everything in one go and make a mess. One phase per session. Verify between phases. This is how you control the quality." }]),

      heading("What can run in parallel", HeadingLevel.HEADING_2),

      para("Phases 1 and 4 are completely independent of each other. If you have the capacity, you can run them simultaneously in separate Replit sessions."),

      para([{ text: "Phase 5 is the critical gate.", bold: true }, { text: " It depends on Phases 2, 3, and 4 all being complete and verified. Nine of the ten tensions in Phase 5 reference EIS behaviour from the new model. If the EIS rework is not done correctly, those tensions will produce wrong numbers and you will have to rebuild them." }]),

      heading("What to look for when verifying", HeadingLevel.HEADING_2),

      para("Each phase file has an \u201CAcceptance criteria\u201D section with specific, testable statements. Go through them one by one. If any fail, tell Replit what failed and let it fix before moving on."),

      para("After Phase 2 in particular, run the existing 178-test engine suite (docs/engine-matrix.test.ts). Some EIS-related tests will need updating because the model has fundamentally changed \u2014 that is expected. But non-EIS tests should all still pass."),

      para(""),
      para(""),

      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 600 },
        children: [new TextRun({ text: "\u2014 End of brief \u2014", font: "Arial", size: 20, color: "888888", italics: true })]
      }),
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  const path = 'docs/Unlock Implementation Brief.docx';
  fs.writeFileSync(path, buffer);
  console.log(`Written to ${path} (${(buffer.length / 1024).toFixed(0)} KB)`);
});
