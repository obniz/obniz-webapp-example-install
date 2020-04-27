import * as cluster from "cluster";
import Queue from "bull";

import IORedis from 'ioredis';

import App from "./app";
import InstallRequest from "./install";
import { runInThisContext } from "vm";


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
  {
    id: "ins3",
    configs: {},
    createdAt: "",
    updatedAt: "",
    user: {},
    devicesInConfig: {}
  },
  {
    id: "ins4",
    configs: {},
    createdAt: "",
    updatedAt: "",
    user: {},
    devicesInConfig: {}
  },
  {
    id: "ins5",
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
  private installQueue = new Queue('install');
  private taskQueue = new Queue('task');
  private maxAppNum: number = Number(process.env.maxAppNum) || 2;

  constructor() {
    this.redis = new IORedis();
  }

  public start_child() {
    this.installQueue.process('install', (job, done) => this.processInstall(job, done));
    this.taskQueue.process('update', (job, done) => this.processUpdate(job, done));
    this.taskQueue.process('delete', (job, done) => this.processDelete(job, done));
    // this.taskQueue.process('delete', this.processDelete);
  }

  public async start_master() {
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

    for (const install of installs) {
      this.installQueue.add('install', install);
    }

  }

  private async processInstall(job: any, done: any) {
      console.log(`worker:${cluster.worker.id} start ${JSON.stringify(job.data.id)}`);
      
      const app = new App(job.data);
      app.start();

      await this.redis.rpush(
        `worker:${cluster.worker.id}`,
        JSON.stringify({
          id: job.data.id,
          install: job.data,
          app: app
        })
      );
      await this.manageWorkers();

      // done();
      looping(app).then(() => {
        // finished looping
        done();
      });
  }

  private async processUpdate(job: any, done: any) {
    const workerId = await this.getWorker(job.data);
    const datas = await this.redis.lrange(
      `worker:${workerId}`,
      0,
      await this.redis.llen(`worker:${workerId}`)
    );
    for (const data of datas) {
      const data_obj = JSON.parse(data);
      if (data_obj.id == job.data.id) {
        await job.data.app.stop();
        await job.data.app.start();
      }
    }
    done();
  }

  private async processDelete(job: any, done: any) {
    const workerId = await this.getWorker(job.data);
    const datas = await this.redis.lrange(
      `worker:${workerId}`,
      0,
      await this.redis.llen(`worker:${workerId}`)
    );
    for (const data of datas) {
      const data_obj = JSON.parse(data);
      if (data_obj.id == job.data.id) {
        await job.data.app.stop();
        await this.redis.lrem(
          `worker:${workerId}`,
          0,
          JSON.stringify(job.data)
        );
      }
    }

    await this.manageWorkers();

    done();
  }

  private async manageWorkers() {
    // 状態を監視して，多すぎたら止める
    const appNum = await this.redis.llen(`worker:${cluster.worker.id}`);
    if (appNum >= this.maxAppNum) {
      await this.installQueue.pause(true);
    } else if (appNum < this.maxAppNum) {
      await this.installQueue.resume(true);
    }
  }

  public async webhooked(obj: any) {
    const install = obj.data;
    if (obj.type === "install.create") {
      this.installQueue.add('install', install);
    } else if (obj.type === "install.update") {
      this.taskQueue.add('update', install);
    } else if (obj.type === "install.delete") {
      this.taskQueue.add('delete', install);
    }
  }

  private async getWorker(installId: string): Promise<string | null> {
    for (const workerId of Object.keys(cluster.workers)) {
      if (await this.redis.exists("worker:" + workerId)) {
        const havingInstalls = await this.redis.lrange(
          "worker:" + workerId, 0, await this.redis.llen("worker:" + workerId)
        );
        const havingInstallsId = havingInstalls.map((data: any) => data.id);
        if (havingInstallsId.indexOf(installId) >= 0) {
          return workerId;
        }
      }
    }
    // TODO: エラー処理
    return null;
  }

  // public async startApp(install: any) {
  //   const app = new App(install);
  //   this.apps.push(app);
  //   await app.start();
  //   looping(app).then(() => {
  //     // finished looping
  //   });
  // }

  // public async stopApp(install: any) {
  //   for (const app of this.apps) {
  //     if (app.id === install.id) {
  //       this.apps.splice(this.apps.indexOf(app), 1);
  //       await app.stop();
  //       await this.redis.lrem(
  //         "worker:" + cluster.worker.id,
  //         1,
  //         JSON.stringify(install)
  //       );
  //       return;
  //     }
  //   }
  //   console.log(`not found install ${install.id}`);
  // }
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
