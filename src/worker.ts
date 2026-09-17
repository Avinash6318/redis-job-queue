import { dequeue, enqueueWithDelay } from "./queue";
import {
  setJobState,
  incrementRetryCount,
  getJobState,
} from "./jobState";
import { moveToDLQ } from "./deadLetterQueue";
import { markInactive } from "./dedup";
import { Job } from "./types";
import redis from "./redisClient";

const WORKER_ID = process.argv[2] || "worker-1";

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000;

let isShuttingDown = false;
let isProcessing = false;

function calculateBackoff(retryCount: number): number {
  return BASE_DELAY_MS * Math.pow(2, retryCount);
}

async function processJob(job: Job): Promise<void> {
  isProcessing = true;

  await setJobState(job.id, "processing", {
    workerId: WORKER_ID,
  });

  console.log(`[${WORKER_ID}] Processing job:`, job);

  try {
    await new Promise((res) => setTimeout(res, 1000));

    if (job.shouldFail) {
      throw new Error("Simulated failure");
    }

    await setJobState(job.id, "completed", {
      result: "success",
      workerId: WORKER_ID,
    });

    await markInactive(job.id);

    console.log(`[${WORKER_ID}] Done:`, job.id);
  } catch (err) {
    const state = await getJobState(job.id);

    const currentRetries = state
      ? parseInt(state.retryCount || "0", 10)
      : 0;

    if (currentRetries < MAX_RETRIES) {
      const newRetryCount = await incrementRetryCount(job.id);

      const delay = calculateBackoff(newRetryCount);

      await setJobState(job.id, "retrying", {
        error: String(err),
        workerId: WORKER_ID,
      });

      console.log(
        `[${WORKER_ID}] Job ${job.id} failed ` +
          `(attempt ${newRetryCount}/${MAX_RETRIES}), ` +
          `retrying in ${delay}ms`
      );

      await enqueueWithDelay(job, delay);
    } else {
      await setJobState(job.id, "failed", {
        error: String(err),
        workerId: WORKER_ID,
      });

      await moveToDLQ(job, String(err));

      await markInactive(job.id);

      console.log(
        `[${WORKER_ID}] Job ${job.id} permanently failed ` +
          `after ${MAX_RETRIES} retries — moved to DLQ`
      );
    }
  } finally {
    isProcessing = false;
  }
}

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  console.log(
    `[${WORKER_ID}] Received ${signal}. Shutting down gracefully...`
  );

  if (isProcessing) {
    console.log(
      `[${WORKER_ID}] Waiting for current job to finish...`
    );

    while (isProcessing) {
      await new Promise((res) => setTimeout(res, 100));
    }
  }

  console.log(`[${WORKER_ID}] Closing Redis connection...`);

  await redis.quit();

  console.log(`[${WORKER_ID}] Shutdown complete.`);

  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

async function startWorker(): Promise<void> {
  console.log(`Starting ${WORKER_ID}...`);

  while (!isShuttingDown) {
    const job = await dequeue();

    if (job) {
      await processJob(job);
    } else {
      await new Promise((res) => setTimeout(res, 500));
    }
  }
}

startWorker().catch(async (err) => {
  console.error(`[${WORKER_ID}] Worker crashed:`, err);

  try {
    await redis.quit();
  } finally {
    process.exit(1);
  }
});