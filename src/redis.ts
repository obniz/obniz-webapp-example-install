import Redis from "ioredis";

export default {
  //   redis: new Redis(process.env.REDIS_URL),
  status: new Redis(process.env.REDIS_URL),
  client: new Redis(process.env.REDIS_URL),
  subscriber: new Redis(process.env.REDIS_URL),
};
