import * as cluster from "cluster";

import IORedis from 'ioredis';

import App from "./app";
import InstallRequest from "./install";


const api_obniz_io = `https://api.obniz.io`;
const WebAppToken: string = process.env.TOKEN!;

const dummyInstalls = [
  {
      id: "ins1",
      configs: {},
      createdAt: "",
      updatedAt: "",
      user: {},
      devicesInConfig: {}
  },
  {
    id: "ins2",
    configs: {},
    createdAt: "",
    updatedAt: "",
    user: {},
    devicesInConfig: {}
},
]
export default class AppManager {
  private apps: App[] = [];
  private redis: IORedis.Redis;

  constructor(options?: IORedis.RedisOptions) {
    this.redis = new IORedis(options);
  }

  public async start() {
    let installs: any[] = [];
    // Getting All Installs
    while (true) {
      const result = await InstallRequest(api_obniz_io, WebAppToken, installs.length);
      console.log(result);
      for (const edge of result.webapp.installs.edges) {
        const node = edge.node;
        installs.push(node);
      }
      if (!result.webapp.installs.pageInfo.hasNextPage) {
        break;
      }
    }
    installs = dummyInstalls;
    console.log(`Install app number=${installs.length}`);
    

    // Initialize all workers status
    const workerNum = Object.keys(cluster.workers).length;
    for (let workerId = 1; workerId <= workerNum; workerId++) {
      if (await this.redis.exists("worker:" + workerId)) {
        let havingInstalls = await this.redis.lrange(
          "worker:" + workerId, 0, await this.redis.llen("worker:" + workerId)
        );
        havingInstalls = JSON.parse("[" + String(havingInstalls) + "]");
        const havingInstallsId = havingInstalls.map((install: any) => install.id);
        // Start already allocated installs
        for (const installId of havingInstallsId) {
          const allInstallsId = installs.map((install: any) => install.id);
          if (allInstallsId.indexOf(installId) >= 0) {
            cluster.workers[workerId]?.send({
              type: "start",
              content: havingInstalls.filter((install: any) => install.id == installId)[0]
            });
          } else {
            await this.redis.lrem(
              "worker:" + workerId,
              1,
              JSON.stringify(havingInstalls.filter((install: any) => install.id == installId)[0])
            );
          }
        }
        // Delete started installs from all installs
        installs = installs.filter((install: any) => havingInstallsId.indexOf(install.id) < 0);
      }
    }
    for (const install of installs) {
      await this.allocateInstall(install);
    }
  }

  private async getLazyWorkerId(): Promise<number> {
    let lazyWorkerId = 0;
    let minInstallNum = 1000;
    const workerNum = Object.keys(cluster.workers).length;

    for (let workerId = 1; workerId <= workerNum; workerId++) {
      let havingInstallNum = await this.redis.llen("worker:" + workerId);
      console.log(`worker:${workerId} has ${havingInstallNum} installs`);
      if (havingInstallNum < minInstallNum) {
        minInstallNum = havingInstallNum;
        lazyWorkerId = workerId;
      }
    }

    return lazyWorkerId;
  }

  private async allocateInstall(install: any) {
    // Allocate install to worker with minimal installs
    let workerId = await this.getLazyWorkerId();

    cluster.workers[workerId]?.send({
      type: "start",
      content: install
    });
  }

  private async deleteInstall(install: any) {
    let workerId = await this.getWorker(install.id);

    cluster.workers[workerId!]?.send({
      type: "stop",
      content: install
    });
  }

  public async webhooked(obj: any) {
    const install = obj.data;
    if (obj.type === "install.create") {
      await this.allocateInstall(install);
    } else if (obj.type === "install.update") {
      await this.deleteInstall(install);
      // TODO: stopするのを待つ必要がある気がする
      // TODO: 同じworkerの方がいい？
      await this.allocateInstall(install);
    } else if (obj.type === "install.delete") {
      await this.deleteInstall(install);
    }
  }

  private async getWorker(installId: number | string): Promise<number | null> {
    const workerNum = Object.keys(cluster.workers).length;
    for (let workerId = 1; workerId <= workerNum; workerId++) {
      if (await this.redis.exists("worker:" + workerId)) {
        const havingInstalls = await this.redis.lrange(
          "worker:" + workerId, 0, await this.redis.llen("worker:" + workerId)
        );
        const havingInstallsId = havingInstalls.map((install: any) => install.id);
        if (havingInstallsId.indexOf(installId) >= 0) {
          return workerId;
        }
      }
    }

    return null;
  }

  public async startApp(install: any) {
    const app = new App(install);
    this.apps.push(app);
    await app.start();
    await this.redis.rpush(
      "worker:" + cluster.worker.id,
      JSON.stringify(install)
    );
    looping(app).then(() => {
      // finished looping
    });
  }

  public async stopApp(install: any) {
    for (const app of this.apps) {
      if (app.id === install.id) {
        this.apps.splice(this.apps.indexOf(app), 1);
        await app.stop();
        await this.redis.lrem(
          "worker:" + cluster.worker.id,
          1,
          JSON.stringify(install)
        );
        return;
      }
    }
    console.log(`not found install ${install.id}`);
  }
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
