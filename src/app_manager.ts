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
  private installs: any = [];
  private apps: App[] = [];
  private redis: IORedis.Redis;
  public workerStatus: { [key: number]: any } = {};

  constructor(options?: IORedis.RedisOptions) {
    this.redis = new IORedis(options);
  }

  public async allocate() {
    // Getting All Installs
    while (true) {
      const result = await InstallRequest(api_obniz_io, WebAppToken, this.installs.length);
      console.log(result);
      for (const edge of result.webapp.installs.edges) {
        const node = edge.node;
        this.installs.push(node);
      }
      if (!result.webapp.installs.pageInfo.hasNextPage) {
        break;
      }
    }
    console.log(`Install app number=${this.installs.length}`);
    
    this.installs = dummyInstalls;

    const worker_num = Object.keys(cluster.workers).length;
    for (let workerId = 1; workerId <= worker_num; workerId++) {
      this.workerStatus[workerId] = 0;
    }
    for (const install of this.installs) {
      this.allocateInstall(install);
    }

  }

  private async allocateInstall(install: any) {
    // Allocate install to worker with minimal installs
    let workerId = Object.keys(this.workerStatus).filter((x: any) => {
      return this.workerStatus[x] == Math.min(...Object.values(this.workerStatus))
    })[0];

    cluster.workers[workerId]?.send({
      type: "start",
      content: install
    });

    this.workerStatus[Number(workerId)] += 1;

    // TODO: 現状の実装だとRedisへの格納は不要
    await this.redis.set(
      install.id,
      JSON.stringify({
        content: install,
        worker_id: workerId
      })
    );
  }

  public async webhooked(obj: any) {
    const install = obj.data;
    if (obj.type === "install.create") {
      // this.installsへ追加
      this.installs.push(install);
      // 割り当て
      await this.allocateInstall(install);
    } else if (obj.type === "install.update") {
      const data = await this.redis.get(install.id);
      const workerId = JSON.parse(data!).worker_id;
      cluster.workers[workerId]?.send({
        type: "stop",
        content: install
      });
      // TODO: stopするのを待つ必要がある気がする
      cluster.workers[workerId]?.send({
        type: "start",
        content: install
      });
    } else if (obj.type === "install.delete") {
      const data = await this.redis.get(install.id);
      const workerId = JSON.parse(data!).worker_id;
      cluster.workers[workerId]?.send({
        type: "stop",
        content: install
      });
    }
  }

  public async startApp(install: any) {
    const app = new App(install);
    this.apps.push(app);
    await app.start();
    looping(app).then(() => {
      // finished looping
    });
  }

  public async stopApp(install: any) {
    for (const app of this.apps) {
      if (app.id === install.id) {
        this.apps.splice(this.apps.indexOf(app), 1);
        await app.stop();
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
