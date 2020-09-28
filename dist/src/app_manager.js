"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const graphql_request_1 = require("graphql-request");
const obniz_cloud_sdk_1 = require("obniz-cloud-sdk");
const queues_1 = __importDefault(require("./queues"));
const api_obniz_io = `https://api.obniz.io`;
const WebAppToken = process.env.TOKEN;
class AppManager {
    constructor() {
        this.installQueue = queues_1.default.installQueue;
        this.taskQueue = queues_1.default.taskQueue;
    }
    async start_master() {
        const installs = [];
        // Getting All Installs
        const client = new graphql_request_1.GraphQLClient(`${api_obniz_io}/v1/graphql`, {
            headers: {
                authorization: `Bearer ${WebAppToken}`,
            },
        });
        const cloudSdk = obniz_cloud_sdk_1.getSdk(client);
        while (true) {
            const result = await cloudSdk.webapp({ first: 10, skip: installs.length });
            if (result === null || result === undefined) {
                break;
            }
            if (result.webapp === null || result.webapp === undefined) {
                break;
            }
            if (result.webapp.installs === null || result.webapp.installs === undefined) {
                break;
            }
            for (const edge of result.webapp.installs.edges) {
                if (edge === null) {
                    continue;
                }
                const node = edge.node;
                installs.push(node);
            }
            if (!result.webapp.installs.pageInfo.hasNextPage) {
                break;
            }
        }
        for (const install of installs) {
            this.installQueue.add("install", install);
        }
    }
    async webhooked(obj) {
        const install = obj.data;
        if (obj.type === "install.create") {
            this.installQueue.add("install", install, { attempts: 10 });
        }
        else if (obj.type === "install.update") {
            this.taskQueue.add("update", install, { attempts: 10 });
        }
        else if (obj.type === "install.delete") {
            this.taskQueue.add("delete", install, { attempts: 10 });
        }
    }
}
exports.default = AppManager;
