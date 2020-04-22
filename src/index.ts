import bodyParser from "body-parser";
import express from "express";
import http from "http";
import path from "path";
import * as cluster from "cluster";
import * as os from "os";

import AppManager from "./app_manager";

const cpuNum: number = os.cpus().length;

const appManager = new AppManager();

if (cluster.isMaster) {
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

  // Start child processes
  for (let i = 0; i < cpuNum; i++) {
    cluster.fork();
  }
  // Allocate installs
  appManager.start();

} else {
  
  process.on("message", (msg: any) => {
    switch(msg.type) {
      
      case "start": 
        // await appManager.startApp(msg.content);
        console.log(`worker ${cluster.worker.id} start app ${msg.content.id}`);
        break;
      
      case "stop":
        // await appManager.stopApp(msg.content);
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
