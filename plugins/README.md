# plugins/

Reserved for SuperClaude Framework plugin extensions for this project (e.g.
real eval/security backends, canary traffic managers, or CI notifiers
packaged as plugins).

No plugins are defined yet. AgentCI currently simulates every pipeline stage
deterministically via `pseudoScore` in `src/pipeline.ts` rather than calling
out to a real service — see `PLANNING.md` for the exact gate logic. The
intended extension point is replacing that simulation with real calls to
EvalOps (benchmarks), SentinelAI (security policy checks), a regression test
runner, and a canary traffic manager, each as an installable plugin under
this directory.
