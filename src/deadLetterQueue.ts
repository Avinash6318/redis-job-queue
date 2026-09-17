import redis from "./redisClient";
import { Job } from "./types";

const DLQ_KEY = "jobs:dead-letter";

export async function moveToDLQ(job: Job, reason: string): Promise<void> {
  const entry = {
    job,
    reason,
    failedAt: Date.now(),
  };
  await redis.rpush(DLQ_KEY, JSON.stringify(entry));
  console.log(`Moved job ${job.id} to DLQ:`, reason);
}

export async function listDLQ(): Promise<any[]> {
  const entries = await redis.lrange(DLQ_KEY, 0, -1);
  return entries.map((e) => JSON.parse(e));
}

export async function replayFromDLQ(jobId: number): Promise<Job | null> {
  const entries = await redis.lrange(DLQ_KEY, 0, -1);

  for (const entryStr of entries) {
    const entry = JSON.parse(entryStr);
    if (entry.job.id === jobId) {
      // Remove this specific entry from the DLQ
      await redis.lrem(DLQ_KEY, 1, entryStr);
      return entry.job;
    }
  }
  return null;
}