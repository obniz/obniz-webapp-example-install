import Obniz from "obniz";

export default class App {
  public id: string;
  public state: "stopped" | "starting" | "started" | "stopping" = "stopped";

  private obniz!: Obniz;
  private install: any;

  constructor(install: any) {
    this.id = install.id;
    this.install = install;
  }

  public async start() {
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
    this.obniz = new Obniz(obniz_id);
    this.obniz.onconnect = async (obniz) => {
      console.log(`obniz ${this.obniz.id} connected`);
    };
    this.obniz.onclose = async () => {
      console.log(`obniz ${this.obniz.id} closed`);
    };
    this.state = "started";
  }

  public async stop() {
    if (this.state === "starting" || this.state === "started") {
      this.state = "stopping";
      if (this.obniz) {
        this.obniz.close();
      }

      this.state = "stopped";
      console.log(`stopped`);
    }
  }

  public async loop() {
    console.log(`looping`);
  }
}
