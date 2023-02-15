/**
 * Copyright (c) HashiCorp, Inc.
 * SPDX-License-Identifier: MPL-2.0
 */

import {
  RunCreateOptions,
  RunResponse,
  TFEClient,
  WorkspaceShowResponse,
} from "./client";
import { DefaultLogger as log } from "./logger";

const pollIntervalRunMs = 2000;
const pollIntervalResourcesMs = 1000;

async function sleep(interval: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, interval));
}

export class Runner {
  private client: TFEClient;
  private wait: boolean;
  private workspace: WorkspaceShowResponse;

  constructor(
    client: TFEClient,
    wait: boolean,
    workspace: WorkspaceShowResponse
  ) {
    this.client = client;
    this.wait = wait;
    this.workspace = workspace;
  }

  public async createRun(opts: RunCreateOptions): Promise<RunResponse> {
    opts.workspaceID = this.workspace.data.id;
    let run = await this.client.createRun(opts);

    if (this.wait) {
      run = await this.pollWaitForRun(run);
      await this.pollWaitForResources(this.workspace);
    }

    return run;
  }

  private async pollWaitForResources(ws: WorkspaceShowResponse): Promise<void> {
    let sv = await this.client.readCurrentStateVersion(ws);
    log.debug(
      `Waiting for workspace ${ws.data.id} to process resources, polling...`
    );
    while (!sv.data.attributes["resources-processed"]) {
      await sleep(pollIntervalResourcesMs);
      sv = await this.client.readCurrentStateVersion(ws);
    }
  }

  private async pollWaitForRun(run: RunResponse): Promise<RunResponse> {
    while (true) {
      switch (run.data.attributes.status) {
        case "canceled":
        case "errored":
        case "discarded":
          throw new Error(
            `run exited unexpectedly with status: ${run.data.attributes.status}`
          );
        case "planned_and_finished":
        case "applied":
          break;
      }
      log.debug(
        `Waiting for run ${run.data.id} to complete, status is ${run.data.attributes.status}, polling...`
      );
      await sleep(pollIntervalRunMs);
      run = await this.client.readRun(run.data.id);
    }

    return run;
  }
}
