"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const queues_1 = __importDefault(require("./queues"));
const redis_1 = __importDefault(require("./redis"));
const maxAppNum = Number(process.env.maxAppNum) || 2;
const dynoId = process.env.DYNO;
queues_1.default.installQueue.process("install", (job, done) => processInstall(job, done));
queues_1.default.taskQueue.process("update", (job, done) => processUpdate(job, done));
queues_1.default.taskQueue.process("delete", (job, done) => processDelete(job, done));
async function processInstall(job, done) {
    console.log(`worker:${dynoId} start ${JSON.stringify(job.data.id)}`);
    const app = new app_1.default(job.data);
    app.start();
    await redis_1.default.status.rpush(`worker:${dynoId}`, JSON.stringify({
        id: job.data.id,
        install: job.data,
        app,
    }));
    await manageWorkers();
    done();
    // looping(app).then(() => {
    //   // finished looping
    //   done();
    // });
}
async function processUpdate(job, done) {
    const workerId = await getWorker(job.data);
    if (workerId === undefined) {
        done(new Error(`this worker does not have worker:${workerId}.`));
    }
    const datas = await redis_1.default.status.lrange(`worker:${workerId}`, 0, await redis_1.default.status.llen(`worker:${workerId}`));
    for (const data of datas) {
        const data_obj = JSON.parse(data);
        if (data_obj.id === job.data.id) {
            await job.data.app.stop();
            await job.data.app.start();
        }
    }
    done();
}
async function processDelete(job, done) {
    const workerId = await getWorker(job.data);
    if (workerId === undefined) {
        done(new Error(`this worker does not have worker:${workerId}.`));
    }
    const datas = await redis_1.default.status.lrange(`worker:${workerId}`, 0, await redis_1.default.status.llen(`worker:${workerId}`));
    for (const data of datas) {
        const data_obj = JSON.parse(data);
        if (data_obj.id === job.data.id) {
            await job.data.app.stop();
            await redis_1.default.status.lrem(`worker:${workerId}`, 0, JSON.stringify(job.data));
        }
    }
    await manageWorkers();
    done();
}
async function manageWorkers() {
    // 状態を監視して，多すぎたら止める
    const appNum = await redis_1.default.status.llen(`worker:${dynoId}`);
    if (appNum >= maxAppNum) {
        await queues_1.default.installQueue.pause(true);
        console.log(`[WARNING] worker:${dynoId} is busy.`);
    }
    else if (appNum < maxAppNum) {
        await queues_1.default.installQueue.resume(true);
    }
}
async function getWorker(installId) {
    if (await redis_1.default.status.exists("worker:" + dynoId)) {
        const havingInstalls = await redis_1.default.status.lrange("worker:" + dynoId, 0, await redis_1.default.status.llen("worker:" + dynoId));
        const havingInstallsId = havingInstalls.map((data) => data.id);
        if (havingInstallsId.indexOf(installId) >= 0) {
            return dynoId;
        }
    }
    // TODO: エラー処理
    return undefined;
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
