"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const body_parser_1 = __importDefault(require("body-parser"));
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const path_1 = __importDefault(require("path"));
const app_manager_1 = __importDefault(require("./app_manager"));
const appManager = new app_manager_1.default();
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
server.on("listening", () => { });
// Start master process
appManager.start_master();
