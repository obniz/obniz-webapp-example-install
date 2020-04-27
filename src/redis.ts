import Redis from "ioredis";

export default {
  //   redis: new Redis(process.env.REDIS_URL),
  redis: new Redis(process.env.REDIS_URL),
};
