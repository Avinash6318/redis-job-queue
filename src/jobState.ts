import redis from "./redisClient";
import { JobStatus } from "./types";

const stateKey = (jobId: number) => `job:state:${jobId}`;

export async function initJobState(jobId: number): Promise<void> {
  const now = Date.now().toString();
  await redis.hset(stateKey(jobId), {
    id: jobId.toString(),
    status: "pending",
    retryCount: "0",
    createdAt: now,
    updatedAt: now,
  });
}

export async function setJobState(
  jobId: number,
  status: JobStatus,
  extra: Record<string, string> = {}
): Promise<void> {
  const now = Date.now().toString();
  await redis.hset(stateKey(jobId), {
    status,
    updatedAt: now,
    ...extra,
  });
}

export async function incrementRetryCount(jobId: number): Promise<number> {
  return redis.hincrby(stateKey(jobId), "retryCount", 1);
}

export async function getJobState(jobId: number) {
  const state = await redis.hgetall(stateKey(jobId));
  return Object.keys(state).length > 0 ? state : null;
}