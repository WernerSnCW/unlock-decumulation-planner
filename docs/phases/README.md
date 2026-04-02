# Implementation Phases

Feed these to Replit one at a time, in order. Verify each phase works before starting the next.

| File | What | Depends on | Effort |
|------|------|-----------|--------|
| `PHASE-1-asset-growth-defaults.md` | Default growth rates per asset class | Nothing | Half a day |
| `PHASE-2-eis-engine-changes.md` | Remove EIS from drawdown, per-company model, loss formula | Nothing | 2 days |
| `PHASE-3-eis-projection-panel.md` | EIS projection chart, reinvestment, exit controls | Phase 2 |  1-2 days |
| `PHASE-4-core-tensions.md` | Tension framework + first 4 tensions (T1A, T1B, T10, T4) | Nothing | 1-2 days |
| `PHASE-5-eis-and-advanced-tensions.md` | Remaining 10 tensions | Phases 2, 3, AND 4 | 1-2 days |

**Phases 1 and 4 can run in parallel** — they are independent.

**Phase 5 CANNOT start until Phases 2, 3, and 4 are all complete.** Nine of the ten tensions in Phase 5 depend on the new EIS model.

## How to use with Replit

Open a Replit session and say:

> "Read `docs/phases/PHASE-1-asset-growth-defaults.md` and implement it. Run the existing tests when done."

Verify the output. Then start a new session for the next phase.

## Supporting documents

- `docs/Unlock Implementation Brief.docx` — human-readable brief explaining all three workstreams
- `docs/IMPLEMENTATION-SPEC.md` — full technical reference with code snippets and interface definitions
- `docs/Asset Growth into Unlock.docx` — source research for growth rate defaults
- `docs/EIS into Unlock.docx` — source spec for EIS rework and tensions framework
- `docs/Tensions for Unlock.docx` — test fixtures for tension validation
