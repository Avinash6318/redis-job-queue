import redis from "./redisClient";
import { Job } from "./types";

const QUEUE_KEY = "jobs:priority";
const DELAYED_QUEUE_KEY = "jobs:delayed";
const DEDUP_KEY = "jobs:active-ids";

const ENQUEUE_SCRIPT = `
local priorityQueue = KEYS[1]
local activeIds = KEYS[2]

local jobId = ARGV[1]
local priority = tonumber(ARGV[2])
local jobStr = ARGV[3]
local now = ARGV[4]

-- Check whether the job is already active
local exists = redis.call(
  "SISMEMBER",
  activeIds,
  jobId
)

if exists == 1 then
  return 0
end

-- Atomically mark the job active
redis.call(
  "SADD",
  activeIds,
  jobId
)

-- Add the job to the priority queue
redis.call(
  "ZADD",
  priorityQueue,
  priority,
  jobStr
)

-- Initialize job state
redis.call(
  "HSET",
  "job:state:" .. jobId,
  "id",
  jobId,
  "status",
  "pending",
  "retryCount",
  "0",
  "createdAt",
  now,
  "updatedAt",
  now
)

return 1
`;

export async function enqueue(
  job: Job,
  priority: number
): Promise<void> {
  const jobWithPriority: Job = {
    ...job,
    priority,
  };

  const jobStr = JSON.stringify(jobWithPriority);

  const result = await redis.eval(
    ENQUEUE_SCRIPT,
    2,
    QUEUE_KEY,
    DEDUP_KEY,
    job.id.toString(),
    priority.toString(),
    jobStr,
    Date.now().toString()
  );

  if (result === 0) {
    console.log(
      `Skipped duplicate job ${job.id} — already active in the system`
    );
    return;
  }

  console.log(
    `Enqueued (priority ${priority}):`,
    jobWithPriority
  );
}

export async function enqueueWithDelay(
  job: Job,
  delayMs: number
): Promise<void> {
  const readyAt = Date.now() + delayMs;

  await redis.zadd(
    DELAYED_QUEUE_KEY,
    readyAt.toString(),
    JSON.stringify(job)
  );

  console.log(
    `Re-enqueued job ${job.id}, ready in ${delayMs}ms`
  );
}

const DEQUEUE_SCRIPT = `
local priorityQueue = KEYS[1]
local delayedQueue = KEYS[2]

local now = tonumber(ARGV[1])

-- Find delayed jobs that are ready
local delayedJobs = redis.call(
  "ZRANGEBYSCORE",
  delayedQueue,
  "-inf",
  now
)

-- Move ready delayed jobs into priority queue
for _, jobStr in ipairs(delayedJobs) do
  local removed = redis.call(
    "ZREM",
    delayedQueue,
    jobStr
  )

  if removed == 1 then
    local job = cjson.decode(jobStr)

    local priority = job.priority

    if priority == nil then
      priority = 5
    end

    redis.call(
      "ZADD",
      priorityQueue,
      priority,
      jobStr
    )
  end
end

-- Atomically claim the highest-priority job
local result = redis.call(
  "ZPOPMIN",
  priorityQueue,
  1
)

if #result == 0 then
  return nil
end

return result[1]
`;

export async function dequeue(): Promise<Job | null> {
  const result = await redis.eval(
    DEQUEUE_SCRIPT,
    2,
    QUEUE_KEY,
    DELAYED_QUEUE_KEY,
    Date.now().toString()
  );

  if (!result) {
    return null;
  }

  return JSON.parse(result as string) as Job;
}