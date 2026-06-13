import express from "express";
import * as pipeline from "./pipeline";

export function createApp() {
  const app = express();
  app.use(express.json());

  // ---- Agent versions (agent versioning + prompt version control) ----
  app.post("/agent-versions", (req, res) => {
    const { agentName, version, promptVersion, commitSha } = req.body;
    if (!agentName || !version || !promptVersion || !commitSha) {
      return res.status(400).json({ error: "agentName, version, promptVersion, commitSha are required" });
    }
    res.status(201).json(pipeline.registerAgentVersion({ agentName, version, promptVersion, commitSha }));
  });

  app.get("/agent-versions", (req, res) => {
    res.json(pipeline.listAgentVersions());
  });

  app.get("/agent-versions/:id", (req, res) => {
    const av = pipeline.getAgentVersion(req.params.id);
    av ? res.json(av) : res.status(404).json({ error: "not found" });
  });

  // ---- Pipelines ----
  app.post("/pipelines", (req, res) => {
    const { agentVersionId } = req.body;
    const run = pipeline.runPipeline(agentVersionId);
    run ? res.status(201).json(run) : res.status(404).json({ error: "agent version not found" });
  });

  app.get("/pipelines", (req, res) => {
    res.json(pipeline.listPipelineRuns());
  });

  app.get("/pipelines/:id", (req, res) => {
    const run = pipeline.getPipelineRun(req.params.id);
    run ? res.json(run) : res.status(404).json({ error: "not found" });
  });

  app.post("/pipelines/:id/rollback", (req, res) => {
    const result = pipeline.rollbackRun(req.params.id);
    result ? res.json(result) : res.status(404).json({ error: "not found" });
  });

  // ---- Benchmark tracking ----
  app.get("/benchmarks", (req, res) => {
    const { agentVersionId } = req.query as { agentVersionId?: string };
    res.json(pipeline.listBenchmarks(agentVersionId));
  });

  // ---- Current production version per agent ----
  app.get("/agents/:agentName/production", (req, res) => {
    const run = pipeline.getCurrentProductionVersion(req.params.agentName);
    run ? res.json(run) : res.status(404).json({ error: "no production deployment found" });
  });

  return app;
}
