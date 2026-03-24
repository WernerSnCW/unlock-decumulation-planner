import { useState, useEffect, useRef } from 'react';

interface TopicSection {
  title: string;
  content: string;
}

interface Topic {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  sections: TopicSection[];
}

const TOPICS: Topic[] = [
  {
    id: 'drawdown',
    icon: '\u{1F4B0}',
    title: 'Retirement Drawdown',
    subtitle: 'How income is generated from your portfolio',
    sections: [
      {
        title: 'What is decumulation?',
        content: 'Decumulation is the phase of retirement where you draw down your savings to fund your lifestyle. Unlike accumulation (building wealth), decumulation requires careful planning to ensure your money lasts as long as you need it. The key challenge is balancing income needs against longevity risk \u2014 the risk of outliving your savings.',
      },
      {
        title: 'Drawdown order matters',
        content: 'The order in which you draw from different accounts significantly affects your total tax bill and estate value. Generally, drawing from taxable accounts first preserves tax-advantaged growth in ISAs and pensions. However, preserving assets that qualify for IHT relief (like AIM shares or EIS) can reduce your estate\u2019s inheritance tax. This planner lets you set priority weights to balance these competing objectives.',
      },
      {
        title: 'Sustainable withdrawal rates',
        content: 'The traditional \u201C4% rule\u201D suggests withdrawing 4% of your portfolio annually, adjusted for inflation. However, this is a US-centric guideline based on historical stock/bond returns. UK retirees face different tax treatment, inflation patterns, and asset mixes. This planner models your specific portfolio composition and tax position to find a sustainable income level.',
      },
      {
        title: 'Glory Years spending',
        content: 'Many retirees spend more in early retirement when they\u2019re active and healthy. The \u201CGlory Years\u201D feature lets you model higher spending in the early years of your plan, with a reduced level later. This more realistic spending profile often means you can afford a higher initial income than a flat withdrawal rate would suggest.',
      },
    ],
  },
  {
    id: 'tax',
    icon: '\u{1F3E6}',
    title: 'UK Tax Planning',
    subtitle: 'Income tax, CGT, and tax-efficient withdrawal',
    sections: [
      {
        title: 'Income tax bands (2025/26)',
        content: 'UK income tax operates in bands: the Personal Allowance (\u00A312,570 tax-free), Basic Rate (20% on \u00A312,571\u2013\u00A350,270), Higher Rate (40% on \u00A350,271\u2013\u00A3125,140), and Additional Rate (45% over \u00A3125,140). Crucially, the Personal Allowance tapers away at \u00A31 for every \u00A32 of income over \u00A3100,000, creating an effective 60% marginal rate between \u00A3100,000\u2013\u00A3125,140.',
      },
      {
        title: 'The 60% tax trap',
        content: 'Between \u00A3100,000 and \u00A3125,140 of income, the Personal Allowance is withdrawn at \u00A31 for every \u00A32 of additional income. This means each extra pound is taxed at 40% AND loses 50p of allowance (worth 20p in tax), creating an effective 60% marginal rate. EIS investments can be particularly valuable here \u2014 claiming relief in this band effectively saves 60p per pound invested, not just 30p.',
      },
      {
        title: 'Capital Gains Tax',
        content: 'CGT applies when you sell assets for a profit. The annual exempt amount is \u00A33,000 (2024/25). Rates are 18% (basic rate taxpayer) or 24% (higher rate) for most assets. ISAs, pensions, and EIS/SEIS shares held for 3+ years are CGT-exempt. Understanding which assets trigger CGT helps optimise your drawdown sequence.',
      },
      {
        title: 'Tax-efficient drawdown sequence',
        content: 'A tax-efficient drawdown typically starts with: (1) Using your tax-free pension lump sum (25% PCLS), (2) Drawing from taxable accounts up to your Personal Allowance, (3) Using ISA withdrawals for amounts above that, (4) Drawing pension income to fill basic-rate band. However, IHT considerations may override pure tax efficiency \u2014 for example, preserving ISAs (which are in your estate) while spending pension funds (which may be IHT-exempt).',
      },
    ],
  },
  {
    id: 'iht',
    icon: '\u{1F3DB}\uFE0F',
    title: 'Inheritance Tax (IHT)',
    subtitle: 'Understanding and reducing your estate\u2019s tax bill',
    sections: [
      {
        title: 'How IHT works',
        content: 'Inheritance Tax is charged at 40% on estates above the Nil-Rate Band (\u00A3325,000). The Residence Nil-Rate Band adds up to \u00A3175,000 if you leave your home to direct descendants, giving a combined threshold of \u00A3500,000 (or \u00A31,000,000 for a married couple). Anything above these thresholds is taxed at 40%.',
      },
      {
        title: 'Pensions and IHT',
        content: 'Currently, pension funds are generally outside your estate for IHT purposes. However, from April 2027, the government plans to bring unused pension funds into the IHT net. This planner can model both scenarios. If pensions become taxable, the optimal drawdown sequence changes significantly \u2014 spending pension funds first becomes less attractive if they would otherwise pass IHT-free.',
      },
      {
        title: 'Gifting strategies',
        content: 'Lifetime gifts can reduce your estate. Potentially Exempt Transfers (PETs) fall out of your estate after 7 years. Chargeable Lifetime Transfers (CLTs, typically into trusts) use your nil-rate band. The Annual Exemption (\u00A33,000/year) is immediately IHT-free. Regular gifts from surplus income (Normal Expenditure out of Income, or NEFI) are also exempt immediately if you can demonstrate a pattern of giving from income you don\u2019t need.',
      },
      {
        title: 'Business Property Relief (BPR)',
        content: 'BPR provides 100% relief from IHT on qualifying business assets held for 2+ years. This includes shares in unlisted trading companies (such as EIS/SEIS qualifying companies and AIM-listed shares). From April 2026, the government proposes capping 100% BPR relief at \u00A31 million of combined business and agricultural property, with 50% relief on amounts above. This planner models both pre- and post-cap scenarios.',
      },
    ],
  },
  {
    id: 'eis',
    icon: '\u{1F680}',
    title: 'EIS & SEIS',
    subtitle: 'Enterprise and Seed Enterprise Investment Schemes',
    sections: [
      {
        title: 'What is EIS?',
        content: 'The Enterprise Investment Scheme (EIS) encourages investment in small, high-risk trading companies by offering generous tax reliefs. You can invest up to \u00A31 million per year (or \u00A32 million if at least \u00A31 million is in knowledge-intensive companies). The shares must be held for at least 3 years to retain the reliefs.',
      },
      {
        title: 'EIS tax reliefs',
        content: '(1) Income Tax Relief: 30% of the amount invested, reducing your income tax bill that year. (2) CGT Exemption: No CGT on gains when you sell EIS shares (after 3+ years). (3) Loss Relief: If the company fails, you can offset the loss (minus any income tax relief claimed) against your income at your marginal rate. (4) CGT Deferral: You can defer CGT on other gains by investing the proceeds into EIS within 1 year before or 3 years after the gain. (5) IHT Relief: After 2 years, EIS shares qualify for Business Property Relief (100% IHT exemption, subject to proposed cap).',
      },
      {
        title: 'What is SEIS?',
        content: 'The Seed Enterprise Investment Scheme offers even more generous reliefs for investment in very early-stage companies. Income tax relief is 50% (vs 30% for EIS), with a \u00A3200,000 annual investment cap. SEIS also provides 50% CGT reinvestment relief on gains reinvested into SEIS shares. The higher risk is offset by the more generous tax treatment.',
      },
      {
        title: 'Quality tiers and expected returns',
        content: 'EIS fund managers vary significantly in quality and track record. This planner models three tiers: Cautious (lower-risk, lower-return managers, ~2.9\u00D7 base multiple), Base (typical established funds, ~5.65\u00D7), and Strong (top-tier managers with strong exits, ~10.25\u00D7). The exit ramp models how EIS portfolio value builds gradually over 7 years as companies mature.',
      },
      {
        title: 'Blend mode (SEIS/EIS split)',
        content: 'Many EIS fund managers operate a blended portfolio with approximately 13% in SEIS-qualifying companies and 87% in EIS-qualifying companies. The Blend mode models this typical fund allocation, giving you the benefit of higher SEIS relief on a portion while deploying the bulk into EIS.',
      },
      {
        title: 'CGT deferral explained',
        content: 'If you have a capital gain (e.g., from selling a property or business), you can defer the CGT by investing the gain into EIS-qualifying shares. The deferred CGT becomes payable when you dispose of the EIS shares. If the EIS shares qualify for BPR (held 2+ years) and you hold them at death, the deferred gain may be eliminated entirely. This makes EIS a powerful tool for managing large one-off capital gains.',
      },
      {
        title: 'Risk considerations',
        content: 'EIS investments are high-risk \u2014 these are small, unquoted companies and many will fail entirely. The tax reliefs significantly reduce the downside: with 30% income tax relief and loss relief at your marginal rate, the worst-case net cost is typically 25\u201340p per pound invested. However, EIS shares are illiquid (typically held 3\u20137 years) and there is no guaranteed exit. Never invest more than you can afford to lose.',
      },
    ],
  },
  {
    id: 'vct',
    icon: '\u{1F4CA}',
    title: 'Venture Capital Trusts (VCTs)',
    subtitle: 'Tax-efficient income from a diversified fund',
    sections: [
      {
        title: 'What is a VCT?',
        content: 'A Venture Capital Trust is a listed company that invests in a portfolio of small, unquoted trading companies. Unlike direct EIS investment, a VCT provides diversification across many companies, professional management, and (limited) liquidity through stock exchange listing. VCTs are designed to provide tax-efficient income via dividends.',
      },
      {
        title: 'VCT tax reliefs',
        content: '(1) Income Tax Relief: 30% of the amount subscribed for new shares (reducing to 20% from April 2026 under current plans), provided you hold for 5 years. (2) Tax-Free Dividends: All dividends from VCTs are free of income tax. (3) CGT-Free Disposal: No CGT on gains when you sell VCT shares. Note: VCTs do NOT qualify for Business Property Relief, so they remain in your estate for IHT purposes.',
      },
      {
        title: 'VCT vs EIS',
        content: 'VCTs offer lower risk (diversified portfolio) but lower potential returns and no IHT benefit. EIS offers higher potential returns and IHT relief (via BPR) but higher risk (concentrated positions) and less liquidity. Many advisers use both: VCTs for steady tax-free income, EIS for IHT planning and growth. This planner lets you model both strategies simultaneously.',
      },
      {
        title: 'Recycling vs cash out',
        content: 'When VCT shares reach their 5-year minimum holding period, you can either: (1) Reinvest/recycle the proceeds into new VCT shares to claim fresh income tax relief, or (2) Cash out the proceeds back into your portfolio. Recycling generates additional relief but keeps capital locked in VCTs. Cashing out provides liquidity. The optimal choice depends on your income tax position and liquidity needs.',
      },
    ],
  },
  {
    id: 'portfolio',
    icon: '\u{1F4BC}',
    title: 'Portfolio Construction',
    subtitle: 'Building a resilient retirement portfolio',
    sections: [
      {
        title: 'Asset classes for retirement',
        content: 'A well-diversified retirement portfolio typically includes: Cash (liquidity buffer, low growth), ISAs (tax-free growth and withdrawals), Pensions/SIPPs (tax-deferred, 25% tax-free lump sum), Property (rental income, potential growth), AIM shares (growth potential, BPR for IHT), and potentially EIS/VCT for tax-efficient investing. Each has different tax treatment, growth characteristics, and liquidity.',
      },
      {
        title: 'The cash buffer',
        content: 'Maintaining a cash reserve (typically 1\u20133 years of spending) protects against sequence-of-returns risk \u2014 the danger of being forced to sell investments during a market downturn. The planner\u2019s \u201CCash Buffer\u201D setting ensures the engine won\u2019t draw cash below your minimum, forcing drawdowns from other assets instead.',
      },
      {
        title: 'Balancing growth vs security',
        content: 'The priority weights in this planner (Tax Efficiency, IHT Reduction, Preserve Growth, Liquidity) let you express your preferences. A growth-focused retiree might prioritise preserving equity holdings, while someone focused on leaving an inheritance might prioritise IHT-efficient assets. The Optimiser can find the best balance for your specific situation.',
      },
      {
        title: 'Inflation protection',
        content: 'Inflation erodes purchasing power over a 25\u201330 year retirement. At 3% inflation, \u00A380,000 of spending today requires \u00A3167,000 in 25 years. The planner inflates your spending target each year and models nominal asset growth, giving you a realistic picture of whether your portfolio can maintain your lifestyle in real terms.',
      },
    ],
  },
  {
    id: 'bpr',
    icon: '\u{1F3E0}',
    title: 'Business Property Relief',
    subtitle: 'How BPR reduces inheritance tax',
    sections: [
      {
        title: 'What qualifies for BPR?',
        content: 'BPR provides relief from IHT on qualifying business assets. 100% relief applies to: shares in unquoted trading companies (including EIS/SEIS), interests in trading partnerships, sole trader businesses, and shares traded on AIM (the Alternative Investment Market). 50% relief applies to: land, buildings, or machinery owned personally but used by a qualifying business.',
      },
      {
        title: 'The 2-year holding requirement',
        content: 'Assets must be held for at least 2 years before death to qualify for BPR. This is why the planner tracks \u201CBPR qualifying year\u201D for each EIS cohort and AIM holding. If you die within 2 years of purchasing qualifying assets, they won\u2019t receive BPR and will be fully taxable for IHT.',
      },
      {
        title: 'The proposed 2026 BPR cap',
        content: 'From April 2026, the government proposes capping 100% BPR relief at \u00A31 million of combined business and agricultural property. Above \u00A31 million, relief drops to 50% (i.e., 20% effective IHT rate instead of 0%). This significantly affects estate planning for those with substantial BPR-qualifying portfolios. The planner\u2019s scenario toggle lets you see the impact of this change.',
      },
      {
        title: 'AIM shares and BPR',
        content: 'Many AIM-listed companies qualify for BPR, offering IHT relief combined with stock market liquidity and growth potential. Unlike EIS, AIM shares don\u2019t provide income tax relief but are more liquid. Some strategies combine AIM (for liquidity and BPR) with EIS (for income tax relief, CGT deferral, and BPR). Note: not all AIM companies qualify \u2014 they must be trading companies, not investment companies.',
      },
    ],
  },
  {
    id: 'optimiser',
    icon: '\u{2699}\uFE0F',
    title: 'Using the Optimiser',
    subtitle: 'Finding the best income and estate balance',
    sections: [
      {
        title: 'What the Optimiser does',
        content: 'The Optimiser runs hundreds of simulations with different income levels to find the best outcome for your chosen objective. It searches for the income level and cash buffer that maximises your goal while keeping your plan fully funded (no shortfall years).',
      },
      {
        title: 'Max Income mode',
        content: 'Finds the highest sustainable income that keeps your plan fully funded for the entire duration. This is useful for answering the question: \u201CWhat\u2019s the most I can spend without running out of money?\u201D',
      },
      {
        title: 'Max Estate mode',
        content: 'Finds the income level that maximises your net estate after IHT. This typically means spending less to preserve assets, but the Optimiser also considers the IHT impact \u2014 sometimes spending down taxable assets while preserving IHT-exempt ones can increase the net estate.',
      },
      {
        title: 'Balanced mode',
        content: 'Finds the best trade-off between income and estate value, weighting both equally. This is often the most practical starting point for planning conversations.',
      },
    ],
  },
];

export default function LearningCentre({ onClose }: { onClose: () => void }) {
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());

  const toggleSection = (idx: number) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const currentTopic = TOPICS.find(t => t.id === activeTopic);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    panelRef.current?.focus();
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="learning-overlay" onClick={onClose}>
      <div
        className="learning-panel"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="learning-title"
        ref={panelRef}
        tabIndex={-1}
      >
        <div className="learning-header">
          <div className="learning-header-left">
            {currentTopic && (
              <button className="learning-back" onClick={() => { setActiveTopic(null); setExpandedSections(new Set()); }} aria-label="Back to topics">
                {'\u2190'}
              </button>
            )}
            <h2 id="learning-title">{currentTopic ? currentTopic.title : 'Learning Centre'}</h2>
          </div>
          <button className="learning-close" onClick={onClose} aria-label="Close">{'\u00D7'}</button>
        </div>

        {!currentTopic ? (
          <div className="learning-body">
            <p className="learning-intro">
              Understand the key concepts behind retirement planning, tax efficiency, and estate optimisation.
            </p>
            <div className="learning-topics-grid">
              {TOPICS.map(topic => (
                <button
                  key={topic.id}
                  className="learning-topic-card"
                  onClick={() => setActiveTopic(topic.id)}
                >
                  <span className="learning-topic-icon">{topic.icon}</span>
                  <div className="learning-topic-text">
                    <span className="learning-topic-title">{topic.title}</span>
                    <span className="learning-topic-subtitle">{topic.subtitle}</span>
                  </div>
                  <span className="learning-topic-arrow">{'\u203A'}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="learning-body">
            <p className="learning-topic-desc">{currentTopic.subtitle}</p>
            <div className="learning-sections">
              {currentTopic.sections.map((section, idx) => (
                <div key={idx} className={`learning-section ${expandedSections.has(idx) ? 'expanded' : ''}`}>
                  <button className="learning-section-header" onClick={() => toggleSection(idx)}>
                    <span>{section.title}</span>
                    <span className="learning-chevron">{expandedSections.has(idx) ? '\u25B2' : '\u25BC'}</span>
                  </button>
                  {expandedSections.has(idx) && (
                    <div className="learning-section-content">
                      {section.content}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
