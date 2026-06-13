# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
npm install

# Development (ts-node, no compile step)
npm run dev

# Build TypeScript → dist/
npm run build

# Run compiled server
npm start

# Seed the database: registers 3 agent versions and runs the pipeline for each
npm run seed
```

No test framework is configured yet. `npm run seed` doubles as the smoke test —
it exercises the full pipeline and prints each run's result.

## Architecture

AgentCI is a REST API server that models a CI/CD pipeline for AI agents: each
`AgentVersion` (a prompt/code version) is run through a fixed sequence of
gated stages, and a version that clears every gate becomes the deployed
production version.

### Pipeline flow

```
registerAgentVersion
        ↓
runPipeline(agentVersionId)
        ↓
  build → eval_benchmarks → security_checks → regression_tests → canary → production
        │                                                                      │
        └─ first "failed" stage stops the run (status: "failed") ─┘    all passed →
                                                                    status "succeeded",
                                                                    deployedVersionId set
```

### Module responsibilities

| Module | Path | Purpose |
|---|---|---|
| `db` | `src/db.ts` | JSON-file persistence. `store` is the only data access layer — data lives in `data/*.json`. |
| `pipeline` | `src/pipeline.ts` | Core engine. `STAGE_ORDER` defines the fixed stage sequence. `runStage` implements each stage's pass/fail logic. `runPipeline` iterates stages, stopping at the first failure. `rollbackRun` marks a run `rolled_back` and looks up the prior successful deployment for the same agent. |
| `api` | `src/api.ts` | Express routes for agent versions, pipeline runs, rollback, benchmarks, and current production version. |
| `seed` | `src/seed.ts` | Registers 3 versions for `support-agent` (one that passes everything, one that fails `eval_benchmarks`, one that fails `security_checks`) and runs the pipeline for each. |

### Deterministic gate logic

Stage outcomes are derived from a `pseudoScore(seed, min, max)` hash function
(in `pipeline.ts`) rather than calling a real eval/security service — this
keeps pipeline results reproducible in CI:

- `eval_benchmarks`: `pseudoScore(commitSha, 0.55, 1.0) >= 0.75` (also writes a `BenchmarkRecord`)
- `security_checks`: checks `${commitSha} ${promptVersion}` against `SECURITY_BLOCKLIST` (e.g. "ignore previous instructions")
- `regression_tests`: `pseudoScore(version, 0.8, 1.0) >= 0.85`
- `canary`: `pseudoScore(version + commitSha, 0, 0.1) < 0.05`

When adding new seed scenarios or stages, pick seed strings whose
`pseudoScore` falls on the intended side of the threshold (brute-force a
small script over candidate strings — see the seed scenarios documented in
README.md for known-good examples).

### Key design constraints

- **No live model/eval calls** — all stage results are deterministic and
  computed locally. Replacing `pseudoScore`-based checks with real calls to
  EvalOps/SentinelAI/a test runner is the primary next-step extension.
- **`store.update` requires an explicit generic** — e.g.
  `store.update<PipelineRun>("pipeline_runs", run.id, {...})`. Without it, TS
  can't infer the row type from a string table name.
- **One pipeline run per `runPipeline` call** — runs are not resumable; a
  failed run must be re-triggered against a new (or corrected) agent version.
