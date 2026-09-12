# OpenGrantStack – Core Repository Audit (Initial)

This is a high-level prioritization based on available public information as of the last scan.  
Scores will become precise once `scripts/scan-org.sh` is run with authenticated `gh` access.

## Priority Ranking (Core Platform)

| Priority | Repository | Current Assessment | Recommended Next Actions |
|----------|------------|--------------------|--------------------------|
| 1 | `webhook-receiver` | Strongest of the core services. FastAPI + signature verification + ledger integration described. | Add/confirm tests + CI, ensure LICENSE + topics, create first release tag |
| 2 | `GrantReady-Ledger` / `contribution-ledger` | Immutable ledger is central to the transparency claim. | Standardize naming, complete README, add tests & CI |
| 3 | `GrantReady-hub-SaaS` | Main collaboration surface. Has description and Python code. | Flesh out RBAC + workflow docs, add tests, CI, release |
| 4 | `GrantReady-Analytics` | Dashboards and insights. | Confirm data sources, add tests, improve README |
| 5 | `GrantReady-Docs` / `docs-site` | Documentation foundation. | Expand architecture diagrams and onboarding guides |
| 6 | `GrantReady-cloud` | Backend workflows & storage. | Clarify relationship to hub-SaaS, add structure |
| 7 | Governance / AI Assistants | Early but strategically important. | Keep lightweight until core platform is solid |
| 8 | SDKs + CLI | Developer experience layer. | Build after core services stabilize |

## Recommended Completion Sequence

### Sprint 1 – Foundation
- [ ] Adopt the new org-level `README.md`
- [ ] Commit `docs/completion-rubric.md` and `scripts/scan-org.sh`
- [ ] Run the scanner and publish first `status/` files
- [ ] Ensure every flagship repo has LICENSE + decent README + topics

### Sprint 2 – Core Hardening
- [ ] `webhook-receiver`: tests + CI + first release
- [ ] Ledger: tests + CI + clear public vs internal distinction
- [ ] Hub-SaaS: critical path tests + basic CI

### Sprint 3 – Consistency
- [ ] Apply the unified enterprise file structure to the top 8 repos
- [ ] Add minimal `SECURITY.md` and `CONTRIBUTING.md` everywhere
- [ ] Align naming (decide on GrantReady-* vs lowercase)

### Sprint 4 – Developer Experience
- [ ] SDK-Python + SDK-JS skeletons
- [ ] CLI skeleton
- [ ] Examples and templates

## Notes

- Many repositories currently share very similar low star counts and recent update dates (early 2026). This suggests the org is still in the “architecture + scaffolding” phase.
- The biggest leverage right now is **consistency + measurable progress**, not adding more repositories.
- Once the scanner is live, the tier sections in the org README will update themselves.
