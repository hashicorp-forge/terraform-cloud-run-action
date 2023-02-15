/**
 * Copyright (c) HashiCorp, Inc.
 * SPDX-License-Identifier: MPL-2.0
 */

import axios, { AxiosInstance } from "axios";
import axiosRetry from "axios-retry";
import * as querystring from "querystring";
import { DefaultLogger as log } from "./logger";

export type EntityData = {
  id: string;
  type: string;
};

export type RunResponse = {
  data: EntityData & {
    attributes: {
      status: string;
    };
  };
};

export type CurrentStateVersionWithOutputsResponse = {
  data: EntityData & {
    attributes: {
      "resources-processed": boolean;
    };
  };
};

export type RunCreateOptions = {
  autoApply: boolean;
  isDestroy: boolean;
  message: string;
  workspaceID: string;
  replaceAddrs?: string[];
  targetAddrs?: string[];
};

export type WorkspaceShowResponse = {
  data: EntityData & {
    relationships: {
      "current-state-version": {
        links: {
          related: string;
        };
      };
    };
  };
};

export class TFEClient {
  private client: AxiosInstance;

  constructor(hostname: string, token: string) {
    this.client = axios.create({
      baseURL: `https://${hostname}`,
      timeout: 30000,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
      },
    });
    axiosRetry(this.client, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
    });
  }

  public async readWorkspace(
    organization: string,
    workspace: string
  ): Promise<WorkspaceShowResponse> {
    try {
      const path = `/api/v2/organizations/${querystring.escape(
        organization
      )}/workspaces/${querystring.escape(workspace)}`;

      log.debug(`client fetching path ${path}`);
      const workspaceResponse = await this.client.get<WorkspaceShowResponse>(
        path
      );
      log.debug(`client done`);

      return workspaceResponse.data;
    } catch (err) {
      throw new Error(`Failed to read workspace: ${err.message}`);
    }
  }

  public async readCurrentStateVersion(
    workspaceResponse: WorkspaceShowResponse
  ): Promise<CurrentStateVersionWithOutputsResponse> {
    const path =
      workspaceResponse.data.relationships["current-state-version"].links
        .related;

    try {
      const stateVersionResponse =
        await this.client.get<CurrentStateVersionWithOutputsResponse>(path);

      return stateVersionResponse.data;
    } catch (err) {
      throw new Error(`Failed to read ${path}: ${err.message}`);
    }
  }

  public async readRun(id: string): Promise<RunResponse> {
    try {
      const url = `/api/v2/runs/${querystring.escape(id)}`;
      const resp = await this.client.get<RunResponse>(url);

      return resp.data;
    } catch (err) {
      throw new Error(`Failed to read run status ${id}: ${err.message}`);
    }
  }

  public async createRun(opts: RunCreateOptions): Promise<RunResponse> {
    try {
      const attributes: { [attr: string]: any } = {
        message: opts.message,
        "auto-apply": opts.autoApply,
        "is-destroy": opts.isDestroy,
      };

      if (opts.replaceAddrs) {
        attributes["replace-addrs"] = opts.replaceAddrs;
      }

      if (opts.targetAddrs) {
        attributes["target-addrs"] = opts.targetAddrs;
      }

      const resp = await this.client.post<RunResponse>("runs", {
        data: {
          attributes: attributes,
          type: "runs",
          relationships: {
            workspace: {
              data: {
                type: "workspaces",
                id: opts.workspaceID,
              },
            },
          },
        },
      });

      return resp.data;
    } catch (err) {
      throw new Error(
        `Failed to create run on workspace ${opts.workspaceID}: ${err.message}`
      );
    }
  }
}
