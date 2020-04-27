import IORedis from "ioredis";

export default {
  redis: new IORedis(process.env.REDIS_URL),
};
