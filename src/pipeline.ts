import { v4 as uuidv4 } from "uuid";
import { store } from "./db";
import { AgentVersion, PipelineRun, StageResult, StageName, BenchmarkRecord } from "./types";

const STAGE_ORDER: StageName[] = [
  "build",
  "eval_benchmarks",
  "security_checks",
  "regression_tests",
  "canary",
  "production",
];

// Thresholds used by the simulated stages. A real implementation would call
// out to EvalOps / SentinelAI / a test runner for each of these.
const EVAL_THRESHOLD = 0.75;
const SECURITY_BLOCKLIST = ["rm -rf", "DROP TABLE", "ignore previous instructions"];

function now(): string {
  return new Date().toISOString();
}

export function registerAgentVersion(input: {
  agentName: string;
  version: string;
  promptVersion: string;
  commitSha: string;
}): AgentVersion {
  const av: AgentVersion = { id: uuidv4(), createdAt: now(), ...input };
  store.insert("agent_versions", av);
  return av;
}

export function listAgentVersions(): AgentVersion[] {
  return store.all<AgentVersion>("agent_versions");
}

export function getAgentVersion(id: string): AgentVersion | undefined {
  return store.find<AgentVersion>("agent_versions", (a) => a.id === id);
}

export function getCurrentProductionVersion(agentName: string): PipelineRun | undefined {
  const runs = store
    .filter<PipelineRun>("pipeline_runs", (r) => r.status === "succeeded" && !!r.deployedVersionId)
    .filter((r) => {
      const av = getAgentVersion(r.agentVersionId);
      return av?.agentName === agentName;
    })
    .sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || ""));
  return runs[0];
}

function newStage(name: StageName): StageResult {
  return { name, status: "pending", startedAt: now(), finishedAt: null, metrics: {}, details: "" };
}

function runStage(stage: StageResult, agentVersion: AgentVersion, run: PipelineRun): void {
  stage.status = "running";
  stage.startedAt = now();

  switch (stage.name) {
    case "build": {
      // Builds always succeed in this MVP (would invoke real build tooling).
      stage.metrics = { durationMs: 1200 };
      stage.status = "passed";
      stage.details = `Built agent '${agentVersion.agentName}' @ ${agentVersion.version} (prompt ${agentVersion.promptVersion})`;
      break;
    }
    case "eval_benchmarks": {
      // Deterministic pseudo-score derived from the commit sha so results
      // are reproducible across runs for the same version.
      const score = pseudoScore(agentVersion.commitSha, 0.55, 1.0);
      const passed = score >= EVAL_THRESHOLD;
      stage.metrics = { score, threshold: EVAL_THRESHOLD };
      stage.status = passed ? "passed" : "failed";
      stage.details = `EvalOps benchmark score ${score.toFixed(2)} (threshold ${EVAL_THRESHOLD})`;

      const benchmark: BenchmarkRecord = {
        id: uuidv4(),
        pipelineRunId: run.id,
        agentVersionId: agentVersion.id,
        benchmarkName: "core-eval-suite",
        score,
        threshold: EVAL_THRESHOLD,
        passed,
        createdAt: now(),
      };
      store.insert("benchmarks", benchmark);
      break;
    }
    case "security_checks": {
      const hits = SECURITY_BLOCKLIST.filter((kw) =>
        `${agentVersion.commitSha} ${agentVersion.promptVersion}`.toLowerCase().includes(kw.toLowerCase())
      );
      const passed = hits.length === 0;
      stage.metrics = { violations: hits.length };
      stage.status = passed ? "passed" : "failed";
      stage.details = passed
        ? "SentinelAI: no policy violations detected"
        : `SentinelAI: blocked patterns found: ${hits.join(", ")}`;
      break;
    }
    case "regression_tests": {
      const passRate = pseudoScore(agentVersion.version, 0.8, 1.0);
      const passed = passRate >= 0.85;
      stage.metrics = { passRate };
      stage.status = passed ? "passed" : "failed";
      stage.details = `Regression suite pass rate ${(passRate * 100).toFixed(1)}%`;
      break;
    }
    case "canary": {
      const errorRate = pseudoScore(agentVersion.version + agentVersion.commitSha, 0, 0.1);
      const passed = errorRate < 0.05;
      stage.metrics = { errorRate, trafficPercent: 5 };
      stage.status = passed ? "passed" : "failed";
      stage.details = `Canary @ 5% traffic, error rate ${(errorRate * 100).toFixed(2)}%`;
      break;
    }
    case "production": {
      stage.metrics = { trafficPercent: 100 };
      stage.status = "passed";
      stage.details = "Promoted to 100% production traffic";
      break;
    }
  }

  stage.finishedAt = now();
}

/** Deterministic pseudo-random number in [min, max) derived from a string seed. */
function pseudoScore(seed: string, min: number, max: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const frac = (hash % 1000) / 1000;
  return min + frac * (max - min);
}

/**
 * Runs the full pipeline for an agent version, synchronously, stopping at the
 * first failed stage (the eval/security/regression/canary gates). On full
 * success the run is marked as the new deployed version. If `canary` passes
 * but a later check were to fail in a real system, `rollbackRun` reverts to
 * the previously deployed version.
 */
export function runPipeline(agentVersionId: string): PipelineRun | undefined {
  const agentVersion = getAgentVersion(agentVersionId);
  if (!agentVersion) return undefined;

  const run: PipelineRun = {
    id: uuidv4(),
    agentVersionId,
    status: "running",
    stages: STAGE_ORDER.map(newStage),
    createdAt: now(),
    completedAt: null,
    deployedVersionId: null,
  };
  store.insert("pipeline_runs", run);

  for (const stage of run.stages) {
    runStage(stage, agentVersion, run);
    store.update<PipelineRun>("pipeline_runs", run.id, { stages: run.stages });
    if (stage.status === "failed") {
      run.status = "failed";
      run.completedAt = now();
      store.update<PipelineRun>("pipeline_runs", run.id, { status: run.status, completedAt: run.completedAt, stages: run.stages });
      return store.find<PipelineRun>("pipeline_runs", (r) => r.id === run.id);
    }
  }

  run.status = "succeeded";
  run.completedAt = now();
  run.deployedVersionId = agentVersionId;
  store.update<PipelineRun>("pipeline_runs", run.id, {
    status: run.status,
    completedAt: run.completedAt,
    deployedVersionId: run.deployedVersionId,
    stages: run.stages,
  });

  return store.find<PipelineRun>("pipeline_runs", (r) => r.id === run.id);
}

export function listPipelineRuns(): PipelineRun[] {
  return store.all<PipelineRun>("pipeline_runs").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getPipelineRun(id: string): PipelineRun | undefined {
  return store.find<PipelineRun>("pipeline_runs", (r) => r.id === id);
}

/**
 * Rolls back a pipeline run: marks it rolled_back and re-promotes the most
 * recent prior successful run for the same agent (if any) as the deployed
 * version. Mirrors "automatic rollback" triggered by a canary regression.
 */
export function rollbackRun(id: string): { run: PipelineRun; restoredVersionId: string | null } | undefined {
  const run = getPipelineRun(id);
  if (!run) return undefined;
  const agentVersion = getAgentVersion(run.agentVersionId);

  const priorSuccess = store
    .filter<PipelineRun>("pipeline_runs", (r) => r.id !== id && r.status === "succeeded")
    .filter((r) => getAgentVersion(r.agentVersionId)?.agentName === agentVersion?.agentName)
    .sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || ""))[0];

  const updated = store.update<PipelineRun>("pipeline_runs", id, {
    status: "rolled_back",
    deployedVersionId: null,
  }) as PipelineRun;

  return { run: updated, restoredVersionId: priorSuccess?.deployedVersionId ?? null };
}

export function listBenchmarks(agentVersionId?: string): BenchmarkRecord[] {
  const all = store.all<BenchmarkRecord>("benchmarks").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return agentVersionId ? all.filter((b) => b.agentVersionId === agentVersionId) : all;
}