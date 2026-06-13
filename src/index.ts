import { initSchema } from "./db";
import { createApp } from "./api";

initSchema(["agent_versions", "pipeline_runs", "benchmarks"]);

const app = createApp();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

app.listen(PORT, () => {
  console.log(`AgentCI listening on http://localhost:${PORT}`);
});
