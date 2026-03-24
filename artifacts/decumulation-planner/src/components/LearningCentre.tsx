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
  {
    id: 'state-pension',
    icon: '\u{1F4B7}',
    title: 'State Pension & Pension Income',
    subtitle: 'How pensions interact with your tax position',
    sections: [
      {
        title: 'State Pension basics',
        content: 'The full new State Pension is approximately \u00A311,500 per year (2025/26). It is taxable income and counts towards your income tax bands, but it is paid gross (no tax deducted at source). For many retirees, the State Pension alone almost uses up the Personal Allowance (\u00A312,570), meaning almost all other income will be taxed at the basic rate or above.',
      },
      {
        title: 'Deferring State Pension',
        content: 'You can defer taking your State Pension and receive a higher amount later \u2014 currently 1% extra for every 9 weeks deferred (about 5.8% per year). This can be valuable if you have other income sources and would otherwise push into a higher tax band. The break-even point is typically around 17\u201319 years.',
      },
      {
        title: 'Private pension income',
        content: 'Defined benefit (final salary) pensions provide guaranteed income for life, usually with some inflation protection. This income is taxable and must be factored into your overall tax planning. The planner treats this as fixed income that cannot be varied, so your drawdown strategy optimises around it.',
      },
      {
        title: 'SIPP drawdown vs annuity',
        content: 'With a SIPP (Self-Invested Personal Pension), you control when and how much to draw. Each withdrawal is 75% taxable, 25% tax-free (via the tax-free lump sum entitlement). An annuity converts your pension pot into guaranteed income, removing investment risk but sacrificing flexibility and estate planning potential. This planner focuses on flexible drawdown scenarios.',
      },
    ],
  },
  {
    id: 'cgt-planning',
    icon: '\u{1F4C9}',
    title: 'Capital Gains Tax Planning',
    subtitle: 'Strategies for managing and reducing CGT',
    sections: [
      {
        title: 'Annual CGT exemption',
        content: 'Each tax year, you have a CGT Annual Exempt Amount (\u00A33,000 from 2024/25). Gains up to this amount are tax-free. A couple can use \u00A36,000 between them. Using this allowance each year (by crystallising small gains) prevents a large gain building up to be taxed later \u2014 a process sometimes called \u201Cgain harvesting.\u201D',
      },
      {
        title: 'Bed & ISA',
        content: 'A \u201CBed & ISA\u201D involves selling investments in a taxable account (GIA) and immediately rebuying them inside an ISA. This crystallises the gain (hopefully within your annual exemption) and moves the asset into a tax-free wrapper. Over time, this transfers your portfolio from taxable to tax-free, eliminating future CGT and income tax on dividends.',
      },
      {
        title: 'Loss harvesting',
        content: 'Capital losses can be offset against gains in the same tax year, or carried forward indefinitely. If you hold investments at a loss, selling them to crystallise the loss can shelter gains elsewhere in your portfolio. Losses must be used against gains in the current year first before carrying forward.',
      },
      {
        title: 'CGT and income tax interaction',
        content: 'Your CGT rate depends on your income tax band. Basic rate taxpayers pay 18% CGT (10% for business assets), while higher rate taxpayers pay 24% (20% for business assets). A large capital gain can push you into a higher band, so timing disposals across tax years and managing the interaction with pension withdrawals is important.',
      },
    ],
  },
  {
    id: 'dividends',
    icon: '\u{1F4B5}',
    title: 'Dividend Tax',
    subtitle: 'Understanding dividend allowance and tax rates',
    sections: [
      {
        title: 'Dividend allowance',
        content: 'The dividend allowance is \u00A3500 per year (2024/25). Dividends within this allowance are tax-free. Above it, rates are 8.75% (basic), 33.75% (higher), and 39.35% (additional). This has reduced significantly from \u00A35,000 when first introduced, making ISA wrappers increasingly important for dividend-producing investments.',
      },
      {
        title: 'Dividends inside wrappers',
        content: 'Dividends received inside ISAs and pensions are completely tax-free. VCT dividends are also tax-free regardless of wrapper. This is a key reason to hold dividend-heavy investments (equity income funds, REITs) inside tax-efficient wrappers, and to prioritise drawing income from unwrapped accounts where dividends are taxable.',
      },
      {
        title: 'Dividend vs interest income',
        content: 'Dividends and savings interest are taxed differently. Savings interest benefits from the Personal Savings Allowance (\u00A31,000 for basic rate, \u00A3500 for higher rate). When planning income, understanding which type of return each asset produces helps optimise your overall tax position.',
      },
    ],
  },
  {
    id: 'cash-buffer',
    icon: '\u{1F6E1}\uFE0F',
    title: 'Cash Buffer Strategy',
    subtitle: 'Why holding a cash reserve matters in drawdown',
    sections: [
      {
        title: 'Sequence of returns risk',
        content: 'In accumulation, the order of returns doesn\u2019t matter \u2014 only the average. In drawdown, it matters enormously. A market crash early in retirement, combined with ongoing withdrawals, can permanently damage your portfolio because you\u2019re selling at depressed prices. This is called \u201Csequence of returns risk\u201D and is one of the biggest threats to a retirement plan.',
      },
      {
        title: 'How a cash buffer helps',
        content: 'A cash buffer (typically 1\u20133 years of spending) lets you draw income from cash during market downturns instead of selling investments at a loss. Once markets recover, you replenish the buffer from your portfolio. This avoids the worst effects of selling low and can significantly improve long-term outcomes.',
      },
      {
        title: 'How much is enough?',
        content: 'The optimal buffer size depends on your risk tolerance and portfolio volatility. One year of spending is a minimum. Two to three years is common for equity-heavy portfolios. More than three years starts to create significant cash drag (cash earning below inflation). The planner\u2019s Optimiser can help find the right balance.',
      },
      {
        title: 'Cash drag trade-off',
        content: 'Cash earns less than long-term investment returns, so holding too much in cash reduces your overall portfolio growth. The key is balancing the insurance benefit of a cash buffer against the opportunity cost of not being invested. This trade-off is why the planner models the cash buffer explicitly and the Optimiser can search for the optimal amount.',
      },
    ],
  },
  {
    id: 'glory-years',
    icon: '\u2600\uFE0F',
    title: 'Glory Years Spending',
    subtitle: 'Front-loading spending in early retirement',
    sections: [
      {
        title: 'Why spend more early?',
        content: 'Research consistently shows that retirees spend more in their 60s and early 70s \u2014 travelling, dining out, pursuing hobbies, and helping family. Spending naturally declines in later years as activity levels reduce. Modelling a flat income throughout retirement often understates early needs and overstates later ones.',
      },
      {
        title: 'Two-phase spending model',
        content: 'The Glory Years feature divides your retirement into two phases: a higher-spending early phase (typically 5\u201315 years) and a lower-spending later phase. The multiplier lets you set the boost (e.g., 1.3\u00D7 means 30% more in early years). The planner automatically adjusts the post-Glory-Years income to keep the plan sustainable.',
      },
      {
        title: 'Impact on plan sustainability',
        content: 'Front-loading spending uses up assets faster in early years but is often sustainable because: (1) total years of high spending are limited, (2) later spending is lower, and (3) assets continue to grow during the entire period. The Optimiser can find the maximum Glory Years multiplier that keeps your plan fully funded.',
      },
    ],
  },
  {
    id: 'gifting-pets',
    icon: '\u{1F381}',
    title: 'Gifting & PET Taper Relief',
    subtitle: 'Reducing your estate through lifetime giving',
    sections: [
      {
        title: 'Potentially Exempt Transfers (PETs)',
        content: 'A gift to an individual is a PET. If you survive 7 years, the gift is completely outside your estate for IHT. If you die within 7 years, the gift is added back to your estate. However, taper relief reduces the IHT on the gift: 3\u20134 years = 32%, 4\u20135 years = 24%, 5\u20136 years = 16%, 6\u20137 years = 8% (instead of the full 40% rate).',
      },
      {
        title: 'Annual exemptions',
        content: 'Several gifts are immediately exempt from IHT regardless of survival: the Annual Exemption (\u00A33,000 per year, can carry forward one year), Small Gifts (\u00A3250 per person per year), Wedding Gifts (\u00A35,000 to a child, \u00A32,500 to grandchild, \u00A31,000 to anyone else), and Normal Expenditure out of Income (unlimited, if from surplus income and regular).',
      },
      {
        title: 'Chargeable Lifetime Transfers (CLTs)',
        content: 'Gifts into most trusts are CLTs. They immediately use your nil-rate band (\u00A3325,000). If the CLT exceeds the nil-rate band, IHT is charged at 20% immediately (with the remainder at 40% if you die within 7 years). CLTs and PETs share the same nil-rate band and are cumulated over a rolling 7-year window.',
      },
      {
        title: 'Strategic gifting in drawdown',
        content: 'Regular gifting during retirement can significantly reduce your IHT bill. The planner models annual gifting as an additional \u201Cdrawdown\u201D from your portfolio, reducing your estate over time. The key consideration is ensuring gifts don\u2019t compromise your own income security \u2014 only gift from surplus you genuinely don\u2019t need.',
      },
    ],
  },
  {
    id: 'pension-death',
    icon: '\u{1F3E5}',
    title: 'Pension Death Benefits',
    subtitle: 'Why pensions are often best left last',
    sections: [
      {
        title: 'Death before 75',
        content: 'If you die before age 75, your remaining pension fund can be passed to any nominated beneficiary completely tax-free (no income tax, no IHT under current rules). This makes undrawn pension funds one of the most tax-efficient assets to leave to the next generation, and is a key reason why many advisers recommend spending other assets first.',
      },
      {
        title: 'Death after 75',
        content: 'If you die after 75, beneficiaries can still inherit your pension fund, but any withdrawals they make will be taxed as income at their marginal rate. The fund itself remains outside the estate for IHT purposes (under current rules). Even with income tax on withdrawals, this is often more efficient than leaving taxable assets that attract both IHT and income/CGT.',
      },
      {
        title: 'Proposed changes from April 2027',
        content: 'The government has announced plans to bring pension death benefits into the IHT net from April 2027. If enacted, this would fundamentally change retirement planning \u2014 the incentive to preserve pension funds for inheritance would be significantly reduced. The planner\u2019s scenario toggles let you model the impact of this proposed change.',
      },
    ],
  },
  {
    id: 'inflation',
    icon: '\u{1F4C8}',
    title: 'Inflation & Real Returns',
    subtitle: 'How inflation erodes your purchasing power',
    sections: [
      {
        title: 'The impact over 25 years',
        content: 'At 2% inflation, \u00A380,000 of spending today requires \u00A3131,000 in 25 years to maintain the same lifestyle. At 3%, that rises to \u00A3167,000. At 4%, it\u2019s \u00A3213,000. Over a long retirement, inflation is one of the biggest risks to your plan. The planner inflates your income target each year to show the true cost in nominal terms.',
      },
      {
        title: 'Real vs nominal returns',
        content: 'An investment returning 7% per year sounds good, but if inflation is 3%, the real return is only about 4%. When evaluating whether your portfolio can sustain your income, it\u2019s the real (after-inflation) return that matters. The planner shows both nominal portfolio values and inflation-adjusted income needs.',
      },
      {
        title: 'Inflation protection strategies',
        content: 'Assets that tend to keep pace with inflation include: equities (company earnings grow with inflation over time), property (rental income and values tend to track inflation), and index-linked gilts (directly inflation-protected). Cash and fixed-rate bonds lose value in real terms during high inflation periods.',
      },
    ],
  },
  {
    id: 'rnrb',
    icon: '\u{1F3E0}',
    title: 'Residence Nil-Rate Band',
    subtitle: 'Extra IHT threshold for the family home',
    sections: [
      {
        title: 'How RNRB works',
        content: 'The Residence Nil-Rate Band (RNRB) provides an extra \u00A3175,000 IHT threshold when you leave your main residence to direct descendants (children, grandchildren). Combined with the standard \u00A3325,000 nil-rate band, this gives an individual threshold of \u00A3500,000 and a couple\u2019s threshold of \u00A31,000,000.',
      },
      {
        title: 'Tapering for large estates',
        content: 'The RNRB tapers away for estates over \u00A32 million \u2014 you lose \u00A31 of RNRB for every \u00A32 of estate above \u00A32 million. This means the RNRB is fully lost at an estate value of \u00A32.35 million. For larger estates, IHT planning strategies (gifting, EIS, trust planning) become even more important because you\u2019ve lost this additional relief.',
      },
      {
        title: 'Downsizing provisions',
        content: 'If you sell or downsize your home after 8 July 2015, you may still qualify for the RNRB on the downsizing amount, provided assets of at least equivalent value are left to direct descendants. This protects retirees who release equity from their property to fund retirement.',
      },
      {
        title: 'Transferable between spouses',
        content: 'Like the main nil-rate band, any unused RNRB is transferable to a surviving spouse. If the first spouse to die doesn\u2019t use their RNRB, the surviving spouse can claim up to 100% of the unused amount, effectively doubling their available RNRB to \u00A3350,000.',
      },
    ],
  },
  {
    id: 'trusts',
    icon: '\u{1F4DC}',
    title: 'Trust Planning Basics',
    subtitle: 'When trusts can help with IHT and control',
    sections: [
      {
        title: 'Why use a trust?',
        content: 'Trusts allow you to give away assets while retaining some control over how they are used. They can protect assets from divorce, bankruptcy, or irresponsible spending by beneficiaries. For IHT purposes, assets placed in trust are removed from your estate (subject to the CLT rules and potential entry charges).',
      },
      {
        title: 'Discretionary trusts',
        content: 'The trustees have discretion over who benefits and when. Useful for protecting assets for future generations. The transfer into a discretionary trust is a CLT: it uses your nil-rate band, and any excess is charged at 20% immediately. The trust also faces periodic charges every 10 years (up to 6% of value above the nil-rate band).',
      },
      {
        title: 'Bare trusts',
        content: 'The beneficiary has an absolute right to both the capital and income. Simpler and with fewer tax complications. The transfer into a bare trust is a PET (potentially exempt transfer), so it falls out of your estate after 7 years with no entry charge. However, you lose all control \u2014 the beneficiary can demand the assets at age 18.',
      },
      {
        title: 'Loan trusts and discounted gift trusts',
        content: 'These specialist structures let you retain access to some capital or income while removing future growth from your estate. A Loan Trust lends capital to a trust (the loan is in your estate but growth isn\u2019t). A Discounted Gift Trust gives you a fixed income stream while gifting the remainder. Both have specific conditions and often involve insurance company bonds.',
      },
    ],
  },
  {
    id: 'concentration-risk',
    icon: '\u26A0\uFE0F',
    title: 'Concentration Risk',
    subtitle: 'The danger of putting too much in one basket',
    sections: [
      {
        title: 'What is concentration risk?',
        content: 'Concentration risk is the danger of having too much of your wealth in a single asset, asset class, sector, or strategy. In retirement, this risk is magnified because you have less time to recover from a significant loss. A diversified portfolio spreads risk across multiple assets, so the failure of any single investment doesn\u2019t jeopardise your retirement plan.',
      },
      {
        title: 'Common concentration traps',
        content: 'Many retirees unknowingly take on concentration risk through: (1) a large pension in a single fund, (2) heavy allocation to a single property (often their home), (3) over-reliance on EIS or VCT for tax planning, (4) holding shares in a former employer, (5) too much in one asset class (e.g., all equities or all cash). The planner\u2019s asset register helps you see your total allocation across all wrappers.',
      },
      {
        title: 'EIS/VCT concentration',
        content: 'EIS and VCT investments are attractive for tax relief and IHT planning, but they carry inherent concentration risk in small, unquoted companies. A prudent approach limits EIS/VCT to 10\u201320% of your total portfolio. The planner shows your EIS and VCT allocations as a proportion of total assets so you can monitor this.',
      },
      {
        title: 'Property concentration',
        content: 'Many UK retirees have a large proportion of their wealth tied up in their home. While property provides security and potential growth, it\u2019s illiquid and concentrated in a single asset. Downsizing or equity release can diversify your portfolio, but both have tax and lifestyle implications. The planner models property as a separate asset class so you can see its impact.',
      },
      {
        title: 'Diversification in practice',
        content: 'Effective diversification means spreading risk across: (1) asset classes (equities, bonds, property, cash), (2) geographies (UK, international), (3) wrappers (ISA, pension, GIA, EIS), (4) income sources (drawdown, annuity, state pension, rental income), and (5) time horizons (cash buffer for short-term, equities for long-term). No single investment should be so large that its failure threatens your retirement.',
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
