# AgentCI — Continuous Integration & Deployment for AI Agents

"GitHub Actions for AI Agents." AgentCI runs a versioned agent build through a gated pipeline — evaluation benchmarks, security checks, regression tests, and a canary stage — before promoting it to production, with automatic rollback on failure.

## Pipeline

```
Agent Code Commit
      │
      ▼
  Build Agent
      │
      ▼
EvalOps Benchmarks   ──fail──▶ pipeline stops, status = failed
      │ pass
      ▼
SentinelAI Security Checks ──fail──▶ pipeline stops
      │ pass
      ▼
Regression Tests ──fail──▶ pipeline stops
      │ pass
      ▼
Canary Deployment ──fail──▶ pipeline stops (rollback available)
      │ pass
      ▼
Production (deployedVersionId set)
```

Each stage is simulated deterministically (seeded by the agent version's commit sha / version / id) so the same input always produces the same gate result — useful for demos and tests. Real integrations would call out to EvalOps (benchmarks), SentinelAI (security policy checks), a regression test runner, and a canary traffic manager.

## Features

- **Agent versioning** — `POST /agent-versions` registers an agent build (`agentName`, `version`, `commitSha`)
- **Prompt version control** — each agent version carries a `promptVersion`, tracked alongside the build
- **Evaluation gates** — `eval_benchmarks` stage compares a score against a threshold; results recorded in `benchmarks`
- **Security checks** — `security_checks` stage blocks known bad patterns (SentinelAI-style policy enforcement)
- **Regression tests** — `regression_tests` stage gates on pass rate
- **Canary releases** — `canary` stage simulates 5% traffic with an error-rate gate before full promotion
- **Automatic rollback** — `POST /pipelines/:id/rollback` reverts a run and identifies the previously deployed version to restore
- **Benchmark tracking** — `GET /benchmarks` returns historical eval scores per agent version

## Setup

```bash
npm install
npm run build
npm run seed   # registers 3 sample agent versions and runs the pipeline for each
npm start       # http://localhost:3001
```

## API

| Feature | Endpoint |
|---|---|
| Register agent version | `POST /agent-versions` `{ agentName, version, promptVersion, commitSha }` |
| List/get agent versions | `GET /agent-versions`, `GET /agent-versions/:id` |
| Run pipeline | `POST /pipelines` `{ agentVersionId }` |
| List/get pipeline runs | `GET /pipelines`, `GET /pipelines/:id` |
| Rollback | `POST /pipelines/:id/rollback` |
| Benchmark history | `GET /benchmarks?agentVersionId=` |
| Current production version | `GET /agents/:agentName/production` |

## Docker

```bash
docker compose up --build
```

## Seed Scenarios

The seed script registers three versions of `support-agent`:

1. `1.2.0` — passes every gate, becomes the deployed production version
2. `1.3.0-rc1` — fails the `eval_benchmarks` gate (low deterministic score)
3. `1.3.0-rc2` — prompt contains a blocked phrase, fails `security_checks`

## Future Work

- Replace simulated stages with real calls to EvalOps, SentinelAI, and a test runner (this repo's siblings: ToolHub, EvalOps, SentinelAI)
- Async/queued pipeline execution with live status streaming
- Multi-stage canary with progressive traffic shifting
- Persist deployed-version state per agent for true rollback execution

## License

Proprietary. See [LICENSE](LICENSE). All rights reserved.
