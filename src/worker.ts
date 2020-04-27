import App from "./app";
import Queues from "./queues";
import Redis from "./redis";

const maxAppNum: number = Number(process.env.maxAppNum) || 2;
const dynoId = process.env.DYNO;

Queues.installQueue.process("install", (job, done) => processInstall(job, done));
Queues.taskQueue.process("update", (job, done) => processUpdate(job, done));
Queues.taskQueue.process("delete", (job, done) => processDelete(job, done));

console.log(Redis.redis);

async function processInstall(job: any, done: any) {
  console.log(`worker:${dynoId} start ${JSON.stringify(job.data.id)}`);

  const app = new App(job.data);
  app.start();

  await Redis.redis.rpush(
    `worker:${dynoId}`,
    JSON.stringify({
      id: job.data.id,
      install: job.data,
      app,
    }),
  );
  await manageWorkers();

  // done();
  looping(app).then(() => {
    // finished looping
    done();
  });
}

async function processUpdate(job: any, done: any) {
  const workerId = await getWorker(job.data);
  if (workerId === undefined) {
    done(new Error(`this worker does not have worker:${workerId}.`));
  }
  const datas = await Redis.redis.lrange(`worker:${workerId}`, 0, await Redis.redis.llen(`worker:${workerId}`));
  for (const data of datas) {
    const data_obj = JSON.parse(data);
    if (data_obj.id === job.data.id) {
      await job.data.app.stop();
      await job.data.app.start();
    }
  }
  done();
}

async function processDelete(job: any, done: any) {
  const workerId = await getWorker(job.data);
  if (workerId === undefined) {
    done(new Error(`this worker does not have worker:${workerId}.`));
  }
  const datas = await Redis.redis.lrange(`worker:${workerId}`, 0, await Redis.redis.llen(`worker:${workerId}`));
  for (const data of datas) {
    const data_obj = JSON.parse(data);
    if (data_obj.id === job.data.id) {
      await job.data.app.stop();
      await Redis.redis.lrem(`worker:${workerId}`, 0, JSON.stringify(job.data));
    }
  }

  await manageWorkers();

  done();
}

async function manageWorkers() {
  // 状態を監視して，多すぎたら止める
  const appNum = await Redis.redis.llen(`worker:${dynoId}`);
  if (appNum >= maxAppNum) {
    await Queues.installQueue.pause(true);
    console.log(`[WARNING] worker:${dynoId} is busy.`);
  } else if (appNum < maxAppNum) {
    await Queues.installQueue.resume(true);
  }
}

async function getWorker(installId: string): Promise<string | undefined> {
  if (await Redis.redis.exists("worker:" + dynoId)) {
    const havingInstalls = await Redis.redis.lrange("worker:" + dynoId, 0, await Redis.redis.llen("worker:" + dynoId));
    const havingInstallsId = havingInstalls.map((data: any) => data.id);
    if (havingInstallsId.indexOf(installId) >= 0) {
      return dynoId;
    }
  }
  // TODO: エラー処理
  return undefined;
}

async function looping(app: App) {
  while (app.state === "starting" || app.state === "started") {
    try {
      await app.loop();
    } catch (e) {
      console.error(e);
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 1000);
    });
  }
}
