import { GraphQLClient } from "graphql-request";
import { getSdk } from "obniz-cloud-sdk";

import Queues from "./queues";

const api_obniz_io = `https://api.obniz.io`;
const WebAppToken: string = process.env.TOKEN!;

export default class AppManager {
  private installQueue = Queues.installQueue;
  private taskQueue = Queues.taskQueue;

  constructor() {}

  public async start_master() {
    const installs: any[] = [];
    // Getting All Installs
    const client = new GraphQLClient(`${api_obniz_io}/v1/graphql`, {
      headers: {
        authorization: `Bearer ${WebAppToken}`,
      },
    });
    const cloudSdk = getSdk(client);
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

  public async webhooked(obj: any) {
    const install = obj.data;
    if (obj.type === "install.create") {
      this.installQueue.add("install", install, { attempts: 10 });
    } else if (obj.type === "install.update") {
      this.taskQueue.add("update", install, { attempts: 10 });
    } else if (obj.type === "install.delete") {
      this.taskQueue.add("delete", install, { attempts: 10 });
    }
  }
}
