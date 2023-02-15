/**
 * Copyright (c) HashiCorp, Inc.
 * SPDX-License-Identifier: MPL-2.0
 */

import * as core from "@actions/core";
import { RunCreateOptions, TFEClient } from "./client";
import { DefaultLogger as log } from "./logger";

import { Runner } from "./runner";

function configureClient(): TFEClient {
  return new TFEClient(core.getInput("hostname"), core.getInput("token"));
}

function configureRunCreateOptions(wsID: string): RunCreateOptions {
  return {
    autoApply: core.getBooleanInput("auto-apply"),
    isDestroy: core.getBooleanInput("is-destroy"),
    message: core.getInput("message"),
    replaceAddrs: core.getMultilineInput("replace-addrs"),
    targetAddrs: core.getMultilineInput("target-addrs"),
    workspaceID: wsID,
  };
}

(async () => {
  try {
    const client = configureClient();
    const ws = await client.readWorkspace(
      core.getInput("organization"),
      core.getInput("workspace")
    );
    const runner = new Runner(client, core.getBooleanInput("wait"), ws);
    const run = await runner.createRun(configureRunCreateOptions(ws.data.id));

    log.debug(`Created run ${run.data.id}`);

    core.setOutput("run-id", run.data.id);
  } catch (error) {
    core.setFailed(error.message);
  }
})();
