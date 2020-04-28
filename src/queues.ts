import Queue from "bull";
import Redis from "ioredis";

import MyRedis from "./redis";

function createQueue(name: string) {
  return new Queue(name, {
    createClient(type) {
      console.log(`[redis] create (${type}) type redis`);
      switch (type) {
        case "client":
          return MyRedis.client;
        case "subscriber":
          return MyRedis.subscriber;
        default:
          return new Redis(process.env.REDIS_URL);
      }
    },
  });
}

export default {
  installQueue: createQueue("install"),
  taskQueue: createQueue("task"),
};
