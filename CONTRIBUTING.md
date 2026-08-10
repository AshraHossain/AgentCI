# Contributing to AgentCI

AgentCI follows the SuperClaude Framework project structure used across this
portfolio. Before making changes, read [`PLANNING.md`](PLANNING.md) for the
architecture (pipeline flow, module responsibilities, deterministic gate
logic, and key design constraints) and [`TASK.md`](TASK.md) for the current
priority list.

## Development Setup

```bash
# Install dependencies
npm install

# Run in development mode (ts-node, no compile step)
npm run dev

# Build TypeScript → dist/
npm run build

# Run the compiled server
npm start

# Seed the database and smoke-test the pipeline
npm run seed
```

No automated test framework is configured yet — `npm run seed` is the
current smoke test. It registers 3 sample agent versions and runs the full
pipeline for each, printing each run's result. Treat a clean `npm run seed`
run as the minimum bar before opening a PR.

## Docker

```bash
docker compose up --build
```

## Project Structure

| Path | Purpose |
|---|---|
| `src/db.ts` | JSON-file persistence layer (`store`) |
| `src/pipeline.ts` | Core pipeline engine — `STAGE_ORDER`, `runStage`, `runPipeline`, `rollbackRun` |
| `src/api.ts` | Express routes |
| `src/seed.ts` | Seed script / smoke test |
| `plugins/` | Reserved extension point — see [`plugins/README.md`](plugins/README.md) |

See [`PLANNING.md`](PLANNING.md) for the authoritative architecture
reference — keep it (and `CLAUDE.md`) in sync with any structural change.

## Conventions

- TypeScript, `tsc` build to `dist/`, Express 4.x, JSON-file persistence — no
  database or ORM.
- `store.update` requires an explicit generic (e.g.
  `store.update<PipelineRun>("pipeline_runs", run.id, {...})`) — TS can't
  infer the row type from a string table name otherwise.
- Stage outcomes must remain deterministic (derived from `pseudoScore`/hash
  functions) so pipeline results stay reproducible in CI. When adding seed
  scenarios, brute-force a seed string that lands on the intended side of the
  threshold rather than hand-picking one.
- Commit messages follow Conventional Commits, scoped to the project:
  `type(AgentCI): description` (e.g. `feat(AgentCI): add async pipeline execution`).

## License

Proprietary — see [LICENSE](LICENSE). Contributions are accepted under the
same terms as the rest of the repository.
