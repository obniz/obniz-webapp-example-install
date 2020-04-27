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
const app_1 = __importDefault(require("./app"));
const queues_1 = __importDefault(require("./queues"));
const redis_1 = __importDefault(require("./redis"));
const maxAppNum = Number(process.env.maxAppNum) || 2;
queues_1.default.installQueue.process('install', (job, done) => processInstall(job, done));
queues_1.default.taskQueue.process('update', (job, done) => processUpdate(job, done));
queues_1.default.taskQueue.process('delete', (job, done) => processDelete(job, done));
async function processInstall(job, done) {
    console.log(`worker:${cluster.worker.id} start ${JSON.stringify(job.data.id)}`);
    const app = new app_1.default(job.data);
    app.start();
    await redis_1.default.redis.rpush(`worker:${cluster.worker.id}`, JSON.stringify({
        id: job.data.id,
        install: job.data,
        app: app
    }));
    await manageWorkers();
    // done();
    looping(app).then(() => {
        // finished looping
        done();
    });
}
async function processUpdate(job, done) {
    const workerId = await getWorker(job.data);
    const datas = await redis_1.default.redis.lrange(`worker:${workerId}`, 0, await redis_1.default.redis.llen(`worker:${workerId}`));
    for (const data of datas) {
        const data_obj = JSON.parse(data);
        if (data_obj.id == job.data.id) {
            await job.data.app.stop();
            await job.data.app.start();
        }
    }
    done();
}
async function processDelete(job, done) {
    const workerId = await getWorker(job.data);
    const datas = await redis_1.default.redis.lrange(`worker:${workerId}`, 0, await redis_1.default.redis.llen(`worker:${workerId}`));
    for (const data of datas) {
        const data_obj = JSON.parse(data);
        if (data_obj.id == job.data.id) {
            await job.data.app.stop();
            await redis_1.default.redis.lrem(`worker:${workerId}`, 0, JSON.stringify(job.data));
        }
    }
    await manageWorkers();
    done();
}
async function manageWorkers() {
    // 状態を監視して，多すぎたら止める
    const appNum = await redis_1.default.redis.llen(`worker:${cluster.worker.id}`);
    if (appNum >= maxAppNum) {
        await queues_1.default.installQueue.pause(true);
    }
    else if (appNum < maxAppNum) {
        await queues_1.default.installQueue.resume(true);
    }
}
async function getWorker(installId) {
    for (const workerId of Object.keys(cluster.workers)) {
        if (await redis_1.default.redis.exists("worker:" + workerId)) {
            const havingInstalls = await redis_1.default.redis.lrange("worker:" + workerId, 0, await redis_1.default.redis.llen("worker:" + workerId));
            const havingInstallsId = havingInstalls.map((data) => data.id);
            if (havingInstallsId.indexOf(installId) >= 0) {
                return workerId;
            }
        }
    }
    // TODO: エラー処理
    return null;
}
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
