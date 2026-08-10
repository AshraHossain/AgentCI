# PLANNING.md — AgentCI

## What this is

AgentCI is a REST API server that models a CI/CD pipeline for AI agents —
"GitHub Actions for AI Agents." Each `AgentVersion` (a prompt/code version,
identified by `agentName` + `version` + `promptVersion` + `commitSha`) is run
through a fixed sequence of gated stages. A version that clears every gate
becomes the deployed production version for its `agentName`; a failure at any
stage stops the run and leaves production untouched.

This is a deterministic simulation, not a live CI system: every stage's
pass/fail outcome is derived from a local hash function seeded by the version
metadata (commit sha, version, prompt version), so results are reproducible
without calling a real eval/security service.

## Architecture

```
POST /agent-versions { agentName, version, promptVersion, commitSha }
        │
        ▼
  registerAgentVersion (src/pipeline.ts)
        │
        ▼
POST /pipelines { agentVersionId }
        │
        ▼
  runPipeline(agentVersionId)          STAGE_ORDER (src/pipeline.ts)
        │
        ▼
  build → eval_benchmarks → security_checks → regression_tests → canary → production
        │                                                                      │
        └─ first "failed" stage stops the run (status: "failed") ─┘   all passed →
                                                                    status "succeeded",
                                                                    deployedVersionId set
```

### Module responsibilities

| Module | Path | Purpose |
|---|---|---|
| `db` | `src/db.ts` | JSON-file persistence. `store` is the only data access layer — data lives in `data/*.json`. |
| `types` | `src/types.ts` | `AgentVersion`, `StageResult`, `PipelineRun`, `BenchmarkRecord`, and the `StageName`/`StageStatus`/`PipelineStatus` unions. |
| `pipeline` | `src/pipeline.ts` | Core engine. `STAGE_ORDER` defines the fixed stage sequence. `runStage` implements each stage's pass/fail logic via `pseudoScore`. `runPipeline` iterates stages, stopping at the first failure. `rollbackRun` marks a run `rolled_back` and looks up the prior successful deployment for the same agent. |
| `api` | `src/api.ts` | Express routes for agent versions, pipeline runs, rollback, benchmarks, and current production version. |
| `seed` | `src/seed.ts` | Registers 3 versions for `support-agent` (one that passes everything, one that fails `eval_benchmarks`, one that fails `security_checks`) and runs the pipeline for each. |

### Deterministic gate logic

Stage outcomes come from `pseudoScore(seed, min, max)` (in `pipeline.ts`)
rather than a real eval/security service, so pipeline results are
reproducible in CI:

- `eval_benchmarks`: `pseudoScore(commitSha, 0.55, 1.0) >= 0.75` (also writes a `BenchmarkRecord`)
- `security_checks`: checks `${commitSha} ${promptVersion}` against `SECURITY_BLOCKLIST` (e.g. "ignore previous instructions")
- `regression_tests`: `pseudoScore(version, 0.8, 1.0) >= 0.85`
- `canary`: `pseudoScore(version + commitSha, 0, 0.1) < 0.05`

When adding new seed scenarios or stages, pick seed strings whose
`pseudoScore` falls on the intended side of the threshold (brute-force a
small script over candidate strings — see the seed scenarios documented in
README.md for known-good examples).

### Entry point

`src/index.ts` calls `initSchema(["agent_versions", "pipeline_runs",
"benchmarks"])`, builds the Express app via `createApp()`, and listens on
`process.env.PORT` (default `3001`).

## Key design constraints

- **No live model/eval calls** — all stage results are deterministic and
  computed locally. Replacing `pseudoScore`-based checks with real calls to
  EvalOps/SentinelAI/a test runner is the primary next-step extension.
- **`store.update` requires an explicit generic** — e.g.
  `store.update<PipelineRun>("pipeline_runs", run.id, {...})`. Without it, TS
  can't infer the row type from a string table name.
- **One pipeline run per `runPipeline` call** — runs are not resumable; a
  failed run must be re-triggered against a new (or corrected) agent version.

## Next steps (not yet done)

- Replace simulated stages with real calls to EvalOps, SentinelAI, and a test
  runner (see `plugins/README.md`).
- Async/queued pipeline execution with live status streaming.
- Multi-stage canary with progressive traffic shifting.
- Persist deployed-version state per agent for true rollback execution.
- No test framework configured yet — `npm run seed` is the current smoke test.
