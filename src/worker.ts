import App from "./app";
import Queues from "./queues";
import Redis from "./redis";

const maxAppNum: number = Number(process.env.maxAppNum) || 2;
const dynoId = process.env.DYNO || "local";
const sleep = (msec: number) => new Promise((resolve) => setTimeout(resolve, msec));

// Start worker
startHavingApps();
Queues.installQueue.process("install", (job, done) => processInstall(job, done));
Queues.taskQueue.process("update", (job, done) => processUpdate(job, done));
Queues.taskQueue.process("delete", (job, done) => processDelete(job, done));

async function startHavingApps() {
  const havingAppsString = await Redis.status.lrange(
    `worker:${dynoId}`,
    0,
    await Redis.status.llen(`worker:${dynoId}`),
  );
  const havingApps = havingAppsString.map((data: string) => JSON.parse(data).app);
  for (const app of havingApps) {
    debugprint(`start ${app.id}`);
    // app.start();
  }
}

async function processInstall(job: any, done: any) {
  const maxFlag: boolean = await manageWorkers();
  if (maxFlag) {
    done(new Error(`cannnot have more apps`));
    return;
  }

  debugprint(`start ${JSON.stringify(job.data.id)}`);
  const app = new App(job.data);
  // app.start();

  await Redis.status.rpush(
    `worker:${dynoId}`,
    JSON.stringify({
      id: job.data.id,
      install: job.data,
      app,
    }),
  );
  await manageWorkers();

  done();
  // looping(app).then(() => {
  //   // finished looping
  //   done();
  // });
}

async function processUpdate(job: any, done: any) {
  debugprint("process update task");
  const installFlag = await checkWorkerHas(job.data);
  if (!installFlag) {
    debugprint(`not have ${job.data.id}`);
    done(new Error(`this job is not have ${job.data.id}.`));
    return;
  }
  const datas = await Redis.status.lrange(`worker:${dynoId}`, 0, await Redis.status.llen(`worker:${dynoId}`));
  for (const data of datas) {
    const data_obj = JSON.parse(data);
    if (data_obj.id === job.data.id) {
      // await job.data.app.stop();
      // await job.data.app.start();
      debugprint(`updated ${job.data.id}`);
    }
  }
  done();
}

async function processDelete(job: any, done: any) {
  debugprint("process delete task");
  const installFlag = await checkWorkerHas(job.data);
  if (!installFlag) {
    debugprint(`not have ${job.data.id}`);
    done(new Error(`this worker does not have ${job.data.id}.`));
    return;
  }
  const datas = await Redis.status.lrange(`worker:${dynoId}`, 0, await Redis.status.llen(`worker:${dynoId}`));

  datas.forEach(async (data, index) => {
    const data_obj = JSON.parse(data);
    if (data_obj.id === job.data.id) {
      // await job.data.app.stop();
      await Redis.status.lset(`worker:${dynoId}`, index, "deleted");
      await Redis.status.lrem(`worker:${dynoId}`, 0, "deleted");
    }
  });
  debugprint(`deleted ${job.data.id}`);
  await sleep(500);
  await manageWorkers();
  done();
}

async function manageWorkers(): Promise<boolean> {
  // 状態を監視して，多すぎたら止める
  const appNum = await Redis.status.llen(`worker:${dynoId}`);
  if (appNum >= maxAppNum) {
    debugprint(`stop subscribe(has ${appNum} apps)`);
    Queues.installQueue.pause(true);
    return true;
  } else {
    Queues.installQueue.resume(true);
    return false;
  }
}

async function checkWorkerHas(install: any): Promise<boolean> {
  const havingInstalls = await Redis.status.lrange(`worker:${dynoId}`, 0, await Redis.status.llen(`worker:${dynoId}`));
  const havingInstallsId = havingInstalls.map((data: string) => JSON.parse(data).id);
  debugprint(`have ${havingInstallsId}`);
  if (havingInstallsId.indexOf(install.id) >= 0) {
    return true;
  }
  // TODO: エラー処理
  return false;
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

function debugprint(content?: string) {
  console.log(`[worker:${dynoId}] ${content}`);
}
