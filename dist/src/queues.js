"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bull_1 = __importDefault(require("bull"));
const ioredis_1 = __importDefault(require("ioredis"));
const redis_1 = __importDefault(require("./redis"));
function createQueue(name) {
    return new bull_1.default(name, {
        createClient(type) {
            console.log(`[redis] create (${type}) type redis`);
            switch (type) {
                case "client":
                    return redis_1.default.client;
                case "subscriber":
                    return redis_1.default.subscriber;
                default:
                    return new ioredis_1.default(process.env.REDIS_URL);
            }
        },
    });
}
exports.default = {
    installQueue: createQueue("install"),
    taskQueue: createQueue("task"),
};
