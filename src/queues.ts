import Queue from "bull";
import Redis from "./redis";

export default {
  installQueue: new Queue("install", process.env.REDIS_URL!),
  taskQueue: new Queue("task", process.env.REDIS_URL!),
};
