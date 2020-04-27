import Queue from "bull";

export default {
  installQueue: new Queue("install"),
  taskQueue: new Queue("task"),
};
