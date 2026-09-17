import redis from "./redisClient";

const DEDUP_KEY = "jobs:active-ids";

export async function isDuplicate(jobId: number): Promise<boolean> {
  const exists = await redis.sismember(DEDUP_KEY, jobId.toString());
  return exists === 1;
}

export async function markActive(jobId: number): Promise<void> {
  await redis.sadd(DEDUP_KEY, jobId.toString());
}

export async function markInactive(jobId: number): Promise<void> {
  await redis.srem(DEDUP_KEY, jobId.toString());
}