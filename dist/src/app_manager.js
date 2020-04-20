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
];
class AppManager {
    constructor(options) {
        this.installs = [];
        this.apps = [];
        this.workerStatus = {};
        this.redis = new ioredis_1.default(options);
    }
    async allocate() {
        // Getting All Installs
        while (true) {
            const result = await install_1.default(api_obniz_io, WebAppToken, this.installs.length);
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
    async allocateInstall(install) {
        var _a;
        // Allocate install to worker with minimal installs
        let workerId = Object.keys(this.workerStatus).filter((x) => {
            return this.workerStatus[x] == Math.min(...Object.values(this.workerStatus));
        })[0];
        (_a = cluster.workers[workerId]) === null || _a === void 0 ? void 0 : _a.send({
            type: "start",
            content: install
        });
        this.workerStatus[Number(workerId)] += 1;
        // TODO: 現状の実装だとRedisへの格納は不要
        await this.redis.set(install.id, JSON.stringify({
            content: install,
            worker_id: workerId
        }));
    }
    async webhooked(obj) {
        var _a, _b, _c;
        const install = obj.data;
        if (obj.type === "install.create") {
            // this.installsへ追加
            this.installs.push(install);
            // 割り当て
            await this.allocateInstall(install);
        }
        else if (obj.type === "install.update") {
            const data = await this.redis.get(install.id);
            const workerId = JSON.parse(data).worker_id;
            (_a = cluster.workers[workerId]) === null || _a === void 0 ? void 0 : _a.send({
                type: "stop",
                content: install
            });
            // TODO: stopするのを待つ必要がある気がする
            (_b = cluster.workers[workerId]) === null || _b === void 0 ? void 0 : _b.send({
                type: "start",
                content: install
            });
        }
        else if (obj.type === "install.delete") {
            const data = await this.redis.get(install.id);
            const workerId = JSON.parse(data).worker_id;
            (_c = cluster.workers[workerId]) === null || _c === void 0 ? void 0 : _c.send({
                type: "stop",
                content: install
            });
        }
    }
    async startApp(install) {
        const app = new app_1.default(install);
        this.apps.push(app);
        await app.start();
        looping(app).then(() => {
            // finished looping
        });
    }
    async stopApp(install) {
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
