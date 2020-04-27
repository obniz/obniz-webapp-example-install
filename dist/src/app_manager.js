"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cluster = __importStar(require("cluster"));
const bull_1 = __importDefault(require("bull"));
const ioredis_1 = __importDefault(require("ioredis"));
const app_1 = __importDefault(require("./app"));
const install_1 = __importDefault(require("./install"));
const api_obniz_io = `https://api.obniz.io`;
const WebAppToken = process.env.TOKEN;
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
];
class AppManager {
    constructor() {
        this.apps = [];
        this.installQueue = new bull_1.default('install');
        this.taskQueue = new bull_1.default('task');
        this.maxAppNum = Number(process.env.maxAppNum) || 2;
        this.redis = new ioredis_1.default();
    }
    start_child() {
        this.installQueue.process('install', (job, done) => this.processInstall(job, done));
        this.taskQueue.process('update', (job, done) => this.processUpdate(job, done));
        this.taskQueue.process('delete', (job, done) => this.processDelete(job, done));
        // this.taskQueue.process('delete', this.processDelete);
    }
    async start_master() {
        let installs = [];
        // Getting All Installs
        while (true) {
            const result = await install_1.default(api_obniz_io, WebAppToken, installs.length);
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
    async processInstall(job, done) {
        console.log(`worker:${cluster.worker.id} start ${JSON.stringify(job.data.id)}`);
        const app = new app_1.default(job.data);
        app.start();
        await this.redis.rpush(`worker:${cluster.worker.id}`, JSON.stringify({
            id: job.data.id,
            install: job.data,
            app: app
        }));
        await this.manageWorkers();
        done();
        // looping(app).then(() => {
        //   // finished looping
        //   done();
        // });
    }
    async processUpdate(job, done) {
        const workerId = await this.getWorker(job.data);
        const datas = await this.redis.lrange(`worker:${workerId}`, 0, await this.redis.llen(`worker:${workerId}`));
        for (const data of datas) {
            const data_obj = JSON.parse(data);
            if (data_obj.id == job.data.id) {
                await job.data.app.stop();
                await job.data.app.start();
            }
        }
        done();
    }
    async processDelete(job, done) {
        const workerId = await this.getWorker(job.data);
        const datas = await this.redis.lrange(`worker:${workerId}`, 0, await this.redis.llen(`worker:${workerId}`));
        for (const data of datas) {
            const data_obj = JSON.parse(data);
            if (data_obj.id == job.data.id) {
                await job.data.app.stop();
                await this.redis.lrem(`worker:${workerId}`, 0, JSON.stringify(job.data));
            }
        }
        await this.manageWorkers();
        done();
    }
    async manageWorkers() {
        // 状態を監視して，多すぎたら止める
        const appNum = await this.redis.llen(`worker:${cluster.worker.id}`);
        if (appNum >= this.maxAppNum) {
            await this.installQueue.pause(true);
        }
        else if (appNum < this.maxAppNum) {
            await this.installQueue.resume(true);
        }
    }
    async webhooked(obj) {
        const install = obj.data;
        if (obj.type === "install.create") {
            this.installQueue.add('install', install);
        }
        else if (obj.type === "install.update") {
            this.taskQueue.add('update', install);
        }
        else if (obj.type === "install.delete") {
            this.taskQueue.add('delete', install);
        }
    }
    async getWorker(installId) {
        for (const workerId of Object.keys(cluster.workers)) {
            if (await this.redis.exists("worker:" + workerId)) {
                const havingInstalls = await this.redis.lrange("worker:" + workerId, 0, await this.redis.llen("worker:" + workerId));
                const havingInstallsId = havingInstalls.map((data) => data.id);
                if (havingInstallsId.indexOf(installId) >= 0) {
                    return workerId;
                }
            }
        }
        // TODO: エラー処理
        return null;
    }
}
exports.default = AppManager;
async function looping(app) {
    while (app.state === "starting" || app.state === "started") {
        try {
            await app.loop();
        }
        catch (e) {
            console.error(e);
        }
        await new Promise((resolve) => {
            setTimeout(resolve, 1000);
        });
    }
}
