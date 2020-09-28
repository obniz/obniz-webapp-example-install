"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const graphql_request_1 = require("graphql-request");
const obniz_cloud_sdk_1 = require("obniz-cloud-sdk");
const app_1 = __importDefault(require("./app"));
const api_obniz_io = `https://api.obniz.io`;
const WebAppToken = process.env.TOKEN;
class AppManager {
    constructor() {
        this.installs = [];
        this.apps = [];
    }
    async start() {
        // Getting All Installs
        const client = new graphql_request_1.GraphQLClient(`${api_obniz_io}/v1/graphql`, {
            headers: {
                authorization: `Bearer ${WebAppToken}`,
            },
        });
        const cloudSdk = obniz_cloud_sdk_1.getSdk(client);
        while (true) {
            const result = await cloudSdk.webapp({ first: 10, skip: this.installs.length });
            if (result === null || result === undefined) {
                break;
            }
            if (result.webapp === null || result.webapp === undefined) {
                break;
            }
            if (result.webapp.installs === null || result.webapp.installs === undefined) {
                break;
            }
            console.log(result);
            for (const edge of result.webapp.installs.edges) {
                if (edge === null) {
                    continue;
                }
                const node = edge.node;
                this.installs.push(node);
            }
            if (!result.webapp.installs.pageInfo.hasNextPage) {
                break;
            }
        }
        console.log(`Install app number=${this.installs.length}`);
        // start all apps
        for (const install of this.installs) {
            await this.startApp(install);
        }
    }
    async webhooked(obj) {
        const install = obj.data;
        if (obj.type === "install.create") {
            this.startApp(install);
        }
        else if (obj.type === "install.update") {
            this.stopApp(install);
            this.startApp(install);
        }
        else if (obj.type === "install.delete") {
            this.stopApp(install);
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
