import express from "express";
import cors from "cors";
import redis from "./redisClient";
import { enqueue } from "./queue";
import { getJobState } from "./jobState";
import { listDLQ, replayFromDLQ } from "./deadLetterQueue";

const app = express();

const PORT = Number(process.env.API_PORT || 3000);

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    name: "Redis Job Queue API",
    status: "running",
    endpoints: {
      health: "GET /health",
      createJob: "POST /jobs",
      jobStatus: "GET /jobs/:id",
      deadLetterQueue: "GET /dlq",
      replayDLQ: "POST /dlq/:id/replay",
    },
  });
});

app.get("/health", async (_req, res) => {
  try {
    const redisStatus = await redis.ping();

    res.json({
      status: "healthy",
      redis: redisStatus === "PONG" ? "connected" : "unknown",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      redis: "disconnected",
      error: String(error),
    });
  }
});

app.post("/jobs", async (req, res) => {
  try {
    const { id, task, payload, priority, shouldFail } = req.body;

    if (!id || !task) {
      return res.status(400).json({
        error: "id and task are required",
      });
    }

    const jobPriority = Number(priority ?? 5);

    if (!Number.isFinite(jobPriority)) {
      return res.status(400).json({
        error: "priority must be a number",
      });
    }

    await enqueue(
      {
        id: Number(id),
        task: String(task),
        payload,
        shouldFail,
      },
      jobPriority
    );

    return res.status(201).json({
      message: "Job submitted",
      job: {
        id: Number(id),
        task: String(task),
        payload,
        priority: jobPriority,
        shouldFail: Boolean(shouldFail),
      },
    });
  } catch (error) {
    console.error("Create job error:", error);

    return res.status(500).json({
      error: "Failed to enqueue job",
    });
  }
});

app.get("/jobs/:id", async (req, res) => {
  try {
    const jobId = Number(req.params.id);

    if (!Number.isInteger(jobId)) {
      return res.status(400).json({
        error: "Invalid job ID",
      });
    }

    const state = await getJobState(jobId);

    if (!state) {
      return res.status(404).json({
        error: "Job not found",
      });
    }

    return res.json({
      jobId,
      state,
    });
  } catch (error) {
    console.error("Get job status error:", error);

    return res.status(500).json({
      error: "Failed to get job status",
    });
  }
});

app.get("/dlq", async (_req, res) => {
  try {
    const entries = await listDLQ();

    return res.json({
      count: entries.length,
      entries,
    });
  } catch (error) {
    console.error("DLQ error:", error);

    return res.status(500).json({
      error: "Failed to read DLQ",
    });
  }
});

app.post("/dlq/:id/replay", async (req, res) => {
  try {
    const jobId = Number(req.params.id);

    if (!Number.isInteger(jobId)) {
      return res.status(400).json({
        error: "Invalid job ID",
      });
    }

    const job = await replayFromDLQ(jobId);

    if (!job) {
      return res.status(404).json({
        error: "Job not found in DLQ",
      });
    }

    const priority = Number(job.priority ?? 5);

    await enqueue(job, priority);

    return res.json({
      message: "Job replayed successfully",
      job,
      priority,
    });
  } catch (error) {
    console.error("DLQ replay error:", error);

    return res.status(500).json({
      error: "Failed to replay job",
    });
  }
});

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});

process.on("SIGINT", async () => {
  console.log("API shutting down...");
  await redis.quit();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("API shutting down...");
  await redis.quit();
  process.exit(0);
});