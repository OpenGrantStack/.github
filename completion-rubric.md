# OpenGrantStack Completion Rubric

This document defines exactly how repository completion is scored.  
The goal is transparency and reproducibility — anyone can re-run the scanner and get the same numbers.

## Scoring Signals

| Signal | Weight | How it is measured | Pass condition |
|--------|--------|--------------------|----------------|
| Has description | 5% | GitHub repository description field | Non-empty string |
| Has topics/tags | 5% | GitHub topics array | At least 1 topic |
| Has LICENSE | 10% | File exists at root | `LICENSE` or `LICENSE.md` (or SPDX equivalent) |
| README quality | 10% | File size of `README.md` | ≥ 500 bytes |
| Has tests | 15% | Directory or file patterns | Presence of any of: `tests/`, `test/`, `*_test.*`, `*.test.*`, `*.spec.*`, `__tests__/` |
| Has CI workflows | 15% | Files under `.github/workflows/` | At least one `.yml` or `.yaml` file |
| Recent activity | 20% | Most recent commit date | Commit within the last 90 days |
| Has release or tag | 20% | GitHub Releases API or git tags | At least one release **or** one tag |

**Total weight = 100%**

## Tier Definitions

| Score range | Tier | Meaning |
|-------------|------|---------|
| 0–24 | 🔴 Concept | Idea or skeleton only |
| 25–49 | 🟠 Prototype | Early implementation, missing critical signals |
| 50–74 | 🟡 Active | Meaningful progress, usable but not production-hardened |
| 75–89 | 🟢 Production-Ready | Strong documentation, tests, CI, and recent activity |
| 90–100 | 🟣 Mainnet | Fully production-grade + releases + high signal completeness |

## How to improve a repository’s score

1. Add a clear one-paragraph description and relevant topics.
2. Ensure a `LICENSE` file (Apache-2.0 is the org standard).
3. Write a real README (purpose, quick start, architecture, links).
4. Add at least a minimal test suite.
5. Add a basic CI workflow (lint + test).
6. Keep the repository active (commits within 90 days).
7. Create at least one tagged release when the component is stable.

## Design principles

- **Transparent** — the formula is public.
- **Reproducible** — the same inputs always produce the same score.
- **Actionable** — maintainers can see exactly which signals are missing.
- **Non-subjective** — no human judgment is required for the score itself.

## Related files

- `scripts/scan-org.sh` — the implementation that applies this rubric
- `status/report.md` — generated human-readable summary
- `status/<repo>.json` — generated shields.io endpoint payloads
