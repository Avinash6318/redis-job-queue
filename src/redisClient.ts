import Redis from "ioredis";

const redisHost = process.env.REDIS_HOST || "127.0.0.1";
const redisPort = Number(process.env.REDIS_PORT || 6379);

const redis = new Redis({
  host: redisHost,
  port: redisPort,
});

redis.on("connect", () => {
  console.log(`Connected to Redis at ${redisHost}:${redisPort}`);
});

redis.on("error", (err) => {
  console.error("Redis error:", err);
});

export default redis;