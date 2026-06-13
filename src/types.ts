export type StageName =
  | "build"
  | "eval_benchmarks"
  | "security_checks"
  | "regression_tests"
  | "canary"
  | "production";

export type StageStatus = "pending" | "running" | "passed" | "failed" | "skipped";

export type PipelineStatus = "running" | "succeeded" | "failed" | "rolled_back";

export interface AgentVersion {
  id: string;
  agentName: string;
  version: string; // semver of the agent build
  promptVersion: string; // semver of the prompt set
  commitSha: string;
  createdAt: string;
}

export interface StageResult {
  name: StageName;
  status: StageStatus;
  startedAt: string;
  finishedAt: string | null;
  metrics: Record<string, number>;
  details: string;
}

export interface PipelineRun {
  id: string;
  agentVersionId: string;
  status: PipelineStatus;
  stages: StageResult[];
  createdAt: string;
  completedAt: string | null;
  deployedVersionId: string | null; // version currently live, used for rollback
}

export interface BenchmarkRecord {
  id: string;
  pipelineRunId: string;
  agentVersionId: string;
  benchmarkName: string;
  score: number;
  threshold: number;
  passed: boolean;
  createdAt: string;
}
