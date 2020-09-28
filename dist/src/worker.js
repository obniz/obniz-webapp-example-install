"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const queues_1 = __importDefault(require("./queues"));
const redis_1 = __importDefault(require("./redis"));
const maxAppNum = Number(process.env.maxAppNum) || 2;
const dynoId = process.env.DYNO || "local";
const sleep = (msec) => new Promise((resolve) => setTimeout(resolve, msec));
// Start worker process
startHavingApps();
queues_1.default.installQueue.process("install", (job, done) => processInstall(job, done));
queues_1.default.taskQueue.process("update", (job, done) => processUpdate(job, done));
queues_1.default.taskQueue.process("delete", (job, done) => processDelete(job, done));
async function startHavingApps() {
    const havingAppsString = await redis_1.default.status.lrange(`worker:${dynoId}`, 0, await redis_1.default.status.llen(`worker:${dynoId}`));
    const havingApps = havingAppsString.map((data) => JSON.parse(data).app);
    for (const app of havingApps) {
        // app.start();
    }
}
async function processInstall(job, done) {
    const maxFlag = await manageWorkers();
    if (maxFlag) {
        done(new Error(`cannnot have more apps`));
        return;
    }
    const app = new app_1.default(job.data);
    // app.start();
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
    const installFlag = await checkWorkerHas(job.data);
    if (!installFlag) {
        done(new Error(`this job is not have ${job.data.id}.`));
        return;
    }
    const datas = await redis_1.default.status.lrange(`worker:${dynoId}`, 0, await redis_1.default.status.llen(`worker:${dynoId}`));
    for (const data of datas) {
        const data_obj = JSON.parse(data);
        if (data_obj.id === job.data.id) {
            // await job.data.app.stop();
            // await job.data.app.start();
        }
    }
    done();
}
async function processDelete(job, done) {
    const installFlag = await checkWorkerHas(job.data);
    if (!installFlag) {
        done(new Error(`this worker does not have ${job.data.id}.`));
        return;
    }
    const datas = await redis_1.default.status.lrange(`worker:${dynoId}`, 0, await redis_1.default.status.llen(`worker:${dynoId}`));
    datas.forEach(async (data, index) => {
        const data_obj = JSON.parse(data);
        if (data_obj.id === job.data.id) {
            // await job.data.app.stop();
            await redis_1.default.status.lset(`worker:${dynoId}`, index, "deleted");
            await redis_1.default.status.lrem(`worker:${dynoId}`, 0, "deleted");
        }
    });
    await sleep(500);
    await manageWorkers();
    done();
}
async function manageWorkers() {
    // 状態を監視して，多すぎたら止める
    const appNum = await redis_1.default.status.llen(`worker:${dynoId}`);
    if (appNum >= maxAppNum) {
        queues_1.default.installQueue.pause(true);
        return true;
    }
    else {
        queues_1.default.installQueue.resume(true);
        return false;
    }
}
async function checkWorkerHas(install) {
    const havingInstalls = await redis_1.default.status.lrange(`worker:${dynoId}`, 0, await redis_1.default.status.llen(`worker:${dynoId}`));
    const havingInstallsId = havingInstalls.map((data) => JSON.parse(data).id);
    if (havingInstallsId.indexOf(install.id) >= 0) {
        return true;
    }
    // TODO: エラー処理
    return false;
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
