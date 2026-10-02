import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthConfig } from "./authConfig";
import {
  WorkspaceConflict,
  type RemoteWorkspace,
  type WorkspaceTransport,
} from "./cloudRepository";
import type { AppData } from "../types";
import { validateData } from "./validation";

export function createWorkspaceTransport(
  client: SupabaseClient,
  config: AuthConfig,
  ownerId: string,
): WorkspaceTransport {
  let disposed = false;
  const pending = new Set<AbortController>();
  const request = async (path: string, body?: unknown) => {
    if (disposed) throw new Error("This account is closed.");
    const {
      data: { session },
      error,
    } = await client.auth.getSession();
    if (error || !session || session.user.id !== ownerId || disposed)
      throw new Error("Log in to this account again before syncing.");
    const controller = new AbortController();
    pending.add(controller);
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      // Freeze the token for this request. An account switch cannot send the old
      // workspace under the new user's token while a queued write is running.
      const response = await fetch(config.url + "/rest/v1/" + path, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          apikey: config.publishableKey,
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: controller.signal,
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) {
        if (result.code === "P0001" && result.message === "workspace_conflict")
          throw new WorkspaceConflict("workspace_conflict");
        throw new Error(
          response.status === 401 || response.status === 403
            ? "Your session has expired. Log in again."
            : "Your account records could not be synced. Please retry.",
        );
      }
      return result;
    } finally {
      clearTimeout(timer);
      pending.delete(controller);
    }
  };
  return {
    async read(): Promise<RemoteWorkspace | null> {
      const rows = await request(
        "study_workspaces?select=payload,revision,updated_at&user_id=eq." +
          encodeURIComponent(ownerId),
      );
      if (!Array.isArray(rows) || rows.length > 1)
        throw new Error("Your cloud records could not be opened.");
      if (!rows.length) return null;
      return {
        data: validateData(rows[0].payload),
        revision: rows[0].revision,
        updatedAt: rows[0].updated_at,
      };
    },
    async write(data: AppData, expectedRevision: number) {
      const rows = await request("rpc/save_study_workspace", {
        p_payload: data,
        p_expected_revision: expectedRevision,
      });
      const row = Array.isArray(rows) ? rows[0] : rows;
      if (
        !row ||
        !Number.isSafeInteger(row.revision) ||
        row.revision !== expectedRevision + 1 ||
        typeof row.updated_at !== "string"
      )
        throw new Error("The cloud save could not be confirmed.");
      return { revision: row.revision, updatedAt: row.updated_at };
    },
    dispose() {
      disposed = true;
      pending.forEach((c) => c.abort());
      pending.clear();
    },
  };
}
