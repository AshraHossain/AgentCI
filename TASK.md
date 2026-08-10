# TASK.md — AgentCI

Priority task list. See `PLANNING.md` for architecture context.

## High priority

- [ ] **Replace `pseudoScore` simulation with real integrations** — `eval_benchmarks`
  and `security_checks` currently hash version metadata locally instead of
  calling a real EvalOps/SentinelAI service. This is the primary next-step
  extension called out in `PLANNING.md` and `README.md`'s Future Work section.
- [ ] **Add a test suite** — no test framework is configured. `npm run seed`
  is the current smoke test (registers 3 agent versions, runs the pipeline
  for each, prints results) but is not an automated pass/fail check.

## Medium priority

- [ ] **Async/queued pipeline execution** — `runPipeline` runs synchronously
  end-to-end today; there is no live status streaming for in-progress runs.
- [ ] **Multi-stage canary** — the `canary` stage is a single deterministic
  gate (`pseudoScore(version + commitSha, 0, 0.1) < 0.05`), not progressive
  traffic shifting.
- [ ] **True rollback execution** — `rollbackRun` marks a run `rolled_back`
  and identifies the prior deployed version, but does not persist/restore
  deployed-version state per agent beyond that lookup.
- [ ] **Resumable pipeline runs** — a failed run currently must be
  re-triggered against a new (or corrected) `AgentVersion`; runs are not
  resumable from the point of failure.

## Low priority / infra

- [x] Express 4.19.2 REST API on TypeScript 5.5.3, `tsc` build to `dist/`.
- [x] JSON-file persistence (`src/db.ts`, `data/*.json`).
- [x] Dockerfile (multi-stage build) and `docker-compose.yml` (port 3001).
- [ ] CI workflow (lint/build/seed on push) — not yet configured.
- [ ] Structured logging / observability for the pipeline run lifecycle.
