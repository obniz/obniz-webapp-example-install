"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const body_parser_1 = __importDefault(require("body-parser"));
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const path_1 = __importDefault(require("path"));
const cluster = __importStar(require("cluster"));
const os = __importStar(require("os"));
const app_manager_1 = __importDefault(require("./app_manager"));
const cpuNum = os.cpus().length;
const appManager = new app_manager_1.default();
if (cluster.isMaster) {
    // ============================
    // Web Server
    // ============================
    const expressApp = express_1.default();
    const port = process.env.PORT || "8080";
    expressApp.set("port", port);
    expressApp.set("views", path_1.default.join(__dirname, "../", "views"));
    expressApp.set("view engine", "ejs");
    expressApp.use(body_parser_1.default.json());
    expressApp.use(body_parser_1.default.urlencoded({ extended: false }));
    // routing
    expressApp.get("/", async (req, res) => {
        res.json({});
    });
    expressApp.post("/webhook", async (req, res) => {
        console.log(req.body);
        await appManager.webhooked(req.body);
        res.json({});
    });
    // Listen
    const server = http_1.default.createServer(expressApp);
    server.listen(port);
    server.on("error", (e) => {
        console.error(e);
        process.exit(1);
    });
    server.on("listening", () => {
        console.log("listening");
    });
    // Start child processes
    for (let i = 0; i < cpuNum; i++) {
        cluster.fork();
    }
    // Allocate installs
    appManager.allocate();
}
else {
    process.on("message", (msg) => {
        switch (msg.type) {
            case "start":
                // appManager.startApp(msg.content);
                console.log(`worker ${cluster.worker.id} start app ${msg.content.id}`);
                break;
            case "stop":
                // appManager.stopApp(msg.content);
                console.log(`worker ${cluster.worker.id} stop app ${msg.content.id}`);
                break;
        }
    });
}
// ============================
// Apps
// ============================
// const appManager = new AppManager();
// appManager
//   .start()
//   .then(() => {})
//   .catch((e: Error) => {
//     throw e;
//   });
