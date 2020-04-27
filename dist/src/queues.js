"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bull_1 = __importDefault(require("bull"));
exports.default = {
    installQueue: new bull_1.default("install", process.env.REDIS_URL),
    taskQueue: new bull_1.default("task", process.env.REDIS_URL),
};
