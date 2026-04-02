# Phase 5: EIS-dependent & Advanced Tensions

**Effort:** 1-2 days | **Dependencies:** Phase 2, 3, and 4 must ALL be complete | **Risk:** Medium

---

## CRITICAL DEPENDENCY

This phase adds 10 tensions that reference EIS behaviour. They require:
- EIS removed from the drawdown queue (Phase 2)
- Per-company EIS tracking with the three-state lifecycle (Phase 2)
- The EIS projection panel with reinvestment logic (Phase 3)
- The tension detection engine and UI framework (Phase 4)

**If any of Phases 2-4 are incomplete, do not start this phase.** The tensions will produce wrong numbers and will need to be rebuilt.

---

## Feature

Add the remaining 10 tensions to the detection engine built in Phase 4. These fall into two groups: EIS-specific tensions that can only be evaluated with the new EIS model, and advanced tensions covering property CGT, risk tolerance, and pension timing.

---

## EIS-dependent tensions (Group A)

**T2 — Triple constraint: income + EIS + legacy (Tier 2)**
- Trigger: User has an active EIS programme, an income target, AND a legacy target, and the three cannot all be achieved
- Impact: cumulative shortfall across the plan
- Helper: "Which matters most — your annual income, your EIS investment, or the estate you leave?"
- Resolutions: prioritise income (reduce EIS), prioritise estate (reduce income), reduce EIS investment, adjust manually

**T3 — Income draw erodes BPR-qualifying assets (Tier 2)**
- Trigger: Insufficient liquid assets forces the engine to consider drawing from AIM or EIS (which would break BPR qualification)
- Impact: additional IHT exposure from lost BPR
- Helper: "If BPR assets are preserved, your liquid assets last approximately [X] years. After that you would need to draw from AIM or EIS. Is that acceptable?"
- Note: With EIS now excluded from drawdown (Phase 2), this tension primarily applies to AIM shares

**T6 — EIS reinvestment vs income availability (Tier 2)**
- Trigger: Reinvest toggle is on, and the non-EIS assets cannot fund income for the extended reinvestment period
- Impact: cumulative income shortfall during reinvestment years
- Helper: "If you reinvest your EIS exit proceeds, income must come from [assets] for approximately [X] years. Is that sustainable at your current draw rate?"

**T8 — BPR cliff: drawdown before qualifying period (Tier 1)**
- Trigger: The drawdown sequencing would draw from AIM or EIS before the 2-year BPR clock completes on those lots
- Impact: quantifiable IHT cost of losing BPR
- System action: Override the drawdown sequence to protect qualifying assets until the BPR clock completes. Surface the cost of the constraint.
- Helper: "Your AIM holdings qualify for BPR in [month/year]. Drawing before then costs approximately [X] in additional IHT. We recommend waiting."
- Note: This is Tier 1 (blocking) because the cost is avoidable by simply waiting

**T9 — Plan horizon shorter than EIS holding period (Tier 2)**
- Trigger: Expected EIS exits fall beyond the user's planning horizon
- Impact: the value of EIS holdings that cannot be realised within the plan
- Helper: "Your EIS investments may not exit within your planning horizon. Would you like to model these as an estate transfer?"

---

## Advanced tensions (Group B)

**T5 — CGT event on property sale (Tier 2)**
- Trigger: A planned property disposal triggers a CGT liability that spikes the user into a higher tax band in that year
- Impact: the one-off CGT liability amount
- Helper: "The CGT liability in [year] will be approximately [X]. Would you like to consider spreading this across two tax years, or is the timing fixed?"
- Resolutions: split across two tax years, accept the liability, adjust manually

**T7 — Legacy target requires more risk than tolerance (Tier 2)**
- Trigger: The growth rate required to hit the legacy target implies an equity allocation higher than the user's stated risk tolerance allows
- Impact: the gap between achievable estate and target estate at the comfortable risk level
- Helper: "At your current allocation, the estate projects to [X] at age [Y]. Hitting your target would require maintaining [Z]% in equities. Are you comfortable with that level of risk?"

**T11 — EIS investment vs pension contribution (Tier 2)**
- Trigger: User is an additional-rate taxpayer making both EIS and pension contributions. EIS gives 30% relief; pension gives up to 45%. But pensions may fall within IHT from April 2027 while EIS is IHT-exempt after 2 years.
- Impact: cumulative tax efficiency difference over the plan
- Helper: "Your marginal rate is [X]%. Pension relief is higher now, but pension assets will face IHT from April 2027 (subject to enactment). EIS is IHT-exempt after 2 years. Given your estate target, which do you prioritise?"
- Note: The April 2027 pension IHT inclusion must be read from the existing `apply_2027_pension_iht` toggle, not hardcoded. When the toggle changes, T11 must re-evaluate automatically.
- Implementation note: T11 requires a "shadow" simulation run comparing EIS-only vs pension-only allocation. Cache this run — do not compute on-demand when the tension fires.

**T12 — EIS write-off: loss relief absorption (Tier 2)**
- Trigger: An EIS write-off occurs in a year where income drawdown has consumed available tax bands, meaning loss relief cannot be fully absorbed against income
- Impact: the wasted loss relief amount
- Helper: "Loss relief of [X] from your EIS write-off cannot be fully absorbed against income in [year]. [Y] would need to be carried forward against capital gains instead."
- System action: When a write-off is recorded, calculate available loss relief and check whether it can be fully absorbed against income in that tax year. Account for total income including all planned drawdown and other reliefs already applied.

**T13 — Phantom wealth: illiquid EIS vs income timing (Tier 2)**
- Trigger: The plan appears well-funded when EIS scenarios are included, but EIS capital is inaccessible in the years income is actually needed. Liquid assets alone cannot cover the gap.
- Impact: the income shortfall in the years before EIS exits
- Helper: "Your EIS portfolio represents significant value, but it cannot fund income in the next [X] years. Income during that period must come entirely from [cash/pension/ISA]. Is that sustainable?"

**T14 — Legacy target contingent on EIS performance (Tier 2)**
- Trigger: Legacy target is achievable on the upside EIS scenario but not on typical or catastrophic
- Impact: estate shortfall on the typical scenario vs the target
- Helper: "Your legacy target is achievable if your EIS portfolio delivers strong returns. On a typical outcome, your projected estate is [Y]. On the worst case, [Z]. Your legacy target currently depends on EIS performance. Is that acceptable?"

---

## Severity scoring

For all tensions except T1A (which is rule-based):

```
severityScore = abs(impact) / severityBasis_value

Critical:  score >= 0.50
Material:  score >= 0.10
Info:      score < 0.10
```

Where `severityBasis_value` depends on the tension:
- T2, T3, T6, T13: spendable portfolio value
- T1B, T7, T9, T14: legacy target
- T5: one-off CGT event amount (rule-based: Material if >5,000)
- T8: IHT cost of lost BPR (rule-based: always Material or Critical)
- T11, T12: cumulative tax efficiency gap

---

## Tension clustering

Some tensions are linked. When multiple linked tensions fire, group them under a meta-label:

- T1A + T12 → "This plan has a fundamental funding gap"
- T4 + T10 → "Pension drawdown strategy: two connected trade-offs"
- T2 + T13 + T14 → "Your EIS programme creates several competing pressures"

Use the `linkedTensionIds` field to identify clusters. Show the meta-label above the grouped cards.

---

## Acceptance criteria

1. All 10 tensions fire correctly for their trigger conditions
2. Tensions referencing EIS use the new model (excluded from drawdown, net capital at risk, per-lot BPR)
3. T8 (BPR cliff) is Tier 1 and shown in "Issues to resolve"
4. T11 re-evaluates when the `apply_2027_pension_iht` toggle changes
5. T12 correctly checks loss relief absorption against the full income picture for the write-off year
6. Linked tensions are grouped with meta-labels
7. Suppression thresholds apply (cumulative >= 25,000 for compounding; one-off >= 5,000)
8. The test fixtures from `docs/Tensions for Unlock.docx` (T12, T10, T1A payloads) produce correct outputs

---

## Personas to test against

| Persona | Expected primary tensions |
|---------|--------------------------|
| High income, large EIS investor | T2 (triple constraint) |
| Older investor, long plan horizon | T9 (EIS exit beyond horizon) |
| AIM-heavy portfolio | T8 (BPR cliff) |
| Conservative, de-risked | T7 (legacy needs more risk) |
| Mixed pension + property + EIS | T4 (IHT vs income tax) |
| Property-heavy, cash-light | T10 (cash floor sustainability) |
| Large EIS, large estate target | T14 (legacy contingent on EIS) |

Set up test portfolios matching each persona and verify the expected tensions fire.

---

## Constraints

- Do not modify the simulation engine for tension detection. Tensions read results, they do not change the simulation.
- Counterfactual runs (T4, T7, T11) must be cached. Do not re-run on every render cycle.
- The resolution loop cap from Phase 4 (3 cycles max) applies to all tensions including these.
- `probability_pension_iht` on T11 is a platform-level setting, not a user input. Read from platform config.

---

## Source reference

- Full tension taxonomy (all 14 tensions with trigger conditions, helper text, resolution options): `docs/EIS into Unlock.docx`, Part 2
- Test fixtures: `docs/Tensions for Unlock.docx`
- Persona table: `docs/EIS into Unlock.docx`, Part 2 (Personas section)
