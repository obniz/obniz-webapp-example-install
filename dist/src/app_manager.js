"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const install_1 = __importDefault(require("./install"));
const queues_1 = __importDefault(require("./queues"));
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
        this.installQueue = queues_1.default.installQueue;
        this.taskQueue = queues_1.default.taskQueue;
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
}
exports.default = AppManager;
