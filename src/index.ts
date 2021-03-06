import bodyParser from "body-parser";
import express from "express";
import http from "http";
import path from "path";

import AppManager from "./app_manager";

// ============================
// Web Server
// ============================

const expressApp = express();

const port = process.env.PORT || "8080";
expressApp.set("port", port);
expressApp.set("views", path.join(__dirname, "../", "views"));
expressApp.set("view engine", "ejs");
expressApp.use(bodyParser.json());
expressApp.use(bodyParser.urlencoded({ extended: false }));

// routing

expressApp.get("/", async (req: any, res: any) => {
  res.json({});
});

expressApp.post("/webhook", async (req: any, res: any) => {
  console.log(req.body);
  await appManager.webhooked(req.body);

  res.json({});
});

// Listen

const server = http.createServer(expressApp);
server.listen(port);
server.on("error", (e: any) => {
  console.error(e);
  process.exit(1);
});
server.on("listening", () => {
  console.log("listening");
});

// ============================
// Apps
// ============================

const appManager = new AppManager();
appManager
  .start()
  .then(() => {})
  .catch((e: Error) => {
    throw e;
  });
