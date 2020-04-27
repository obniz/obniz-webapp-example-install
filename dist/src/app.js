"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const obniz_1 = __importDefault(require("obniz"));
class App {
    constructor(install) {
        this.state = "stopped";
        this.id = install.id;
        this.install = install;
    }
    async start() {
        if (this.state !== "stopped") {
            throw new Error(`invalid state`);
        }
        this.state = "starting";
        // connection to obniz device
        const configs = JSON.parse(this.install.configs);
        let obniz_id;
        for (const keyval of configs.values) {
            if (keyval.type === "obniz_id") {
                obniz_id = keyval.value;
                break;
            }
        }
        if (!obniz_id) {
            return;
        }
        console.log(`obniz ${obniz_id}`);
        this.obniz = new obniz_1.default(obniz_id);
        this.obniz.onconnect = async (obniz) => {
            console.log(`obniz ${this.obniz.id} connected`);
        };
        this.obniz.onclose = async () => {
            console.log(`obniz ${this.obniz.id} closed`);
        };
        this.state = "started";
    }
    async stop() {
        if (this.state === "starting" || this.state === "started") {
            this.state = "stopping";
            if (this.obniz) {
                this.obniz.close();
            }
            this.state = "stopped";
            console.log(`stopped`);
        }
    }
    async loop() {
        console.log(`looping`);
    }
}
exports.default = App;
