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
        this.apps = [];
        this.redis = new ioredis_1.default(options);
    }
    async start() {
        var _a;
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
        // Initialize all workers status
        const workerNum = Object.keys(cluster.workers).length;
        for (let workerId = 1; workerId <= workerNum; workerId++) {
            if (await this.redis.exists("worker:" + workerId)) {
                let havingInstalls = await this.redis.lrange("worker:" + workerId, 0, await this.redis.llen("worker:" + workerId));
                havingInstalls = JSON.parse("[" + String(havingInstalls) + "]");
                const havingInstallsId = havingInstalls.map((install) => install.id);
                // Start already allocated installs
                for (const installId of havingInstallsId) {
                    const allInstallsId = installs.map((install) => install.id);
                    if (allInstallsId.indexOf(installId) >= 0) {
                        (_a = cluster.workers[workerId]) === null || _a === void 0 ? void 0 : _a.send({
                            type: "start",
                            content: havingInstalls.filter((install) => install.id == installId)[0]
                        });
                    }
                    else {
                        await this.redis.lrem("worker:" + workerId, 1, JSON.stringify(havingInstalls.filter((install) => install.id == installId)[0]));
                    }
                }
                // Delete started installs from all installs
                installs = installs.filter((install) => havingInstallsId.indexOf(install.id) < 0);
            }
        }
        for (const install of installs) {
            await this.allocateInstall(install);
        }
    }
    async getLazyWorkerId() {
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
    async allocateInstall(install) {
        var _a;
        // Allocate install to worker with minimal installs
        let workerId = await this.getLazyWorkerId();
        (_a = cluster.workers[workerId]) === null || _a === void 0 ? void 0 : _a.send({
            type: "start",
            content: install
        });
    }
    async deleteInstall(install) {
        var _a;
        let workerId = await this.getWorker(install.id);
        (_a = cluster.workers[workerId]) === null || _a === void 0 ? void 0 : _a.send({
            type: "stop",
            content: install
        });
    }
    async webhooked(obj) {
        const install = obj.data;
        if (obj.type === "install.create") {
            await this.allocateInstall(install);
        }
        else if (obj.type === "install.update") {
            await this.deleteInstall(install);
            // TODO: stopするのを待つ必要がある気がする
            // TODO: 同じworkerの方がいい？
            await this.allocateInstall(install);
        }
        else if (obj.type === "install.delete") {
            await this.deleteInstall(install);
        }
    }
    async getWorker(installId) {
        const workerNum = Object.keys(cluster.workers).length;
        for (let workerId = 1; workerId <= workerNum; workerId++) {
            if (await this.redis.exists("worker:" + workerId)) {
                const havingInstalls = await this.redis.lrange("worker:" + workerId, 0, await this.redis.llen("worker:" + workerId));
                const havingInstallsId = havingInstalls.map((install) => install.id);
                if (havingInstallsId.indexOf(installId) >= 0) {
                    return workerId;
                }
            }
        }
        return null;
    }
    async startApp(install) {
        const app = new app_1.default(install);
        this.apps.push(app);
        await app.start();
        await this.redis.rpush("worker:" + cluster.worker.id, JSON.stringify(install));
        looping(app).then(() => {
            // finished looping
        });
    }
    async stopApp(install) {
        for (const app of this.apps) {
            if (app.id === install.id) {
                this.apps.splice(this.apps.indexOf(app), 1);
                await app.stop();
                await this.redis.lrem("worker:" + cluster.worker.id, 1, JSON.stringify(install));
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
