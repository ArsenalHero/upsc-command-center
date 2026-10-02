import type { AppData } from "../types";
import type { DataRepository } from "./repository";
import { validateData } from "./validation";
import { createEmptyData } from "../data/defaults";

export interface RemoteWorkspace {
  data: AppData;
  revision: number;
  updatedAt: string;
}
export interface WorkspaceTransport {
  read(): Promise<RemoteWorkspace | null>;
  write(
    data: AppData,
    expectedRevision: number,
  ): Promise<{ revision: number; updatedAt: string }>;
  dispose?(): void;
}
type Cache = {
  data: AppData;
  revision: number;
  dirty: boolean;
  updatedAt: string;
};
export type SyncStatus = {
  state: "synced" | "saving" | "error" | "conflict";
  message: string;
  updatedAt: string;
};
export class WorkspaceConflict extends Error {}
export const accountStorageKey = (ownerId: string) =>
  `upsc-command-center:account:${ownerId}:v1`;
export class CloudWorkspaceRepository implements DataRepository {
  private data: AppData;
  private revision: number;
  private dirty = false;
  private generation = 0;
  private disposed = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private draining: Promise<void> | undefined;
  private listeners = new Set<() => void>();
  private status: SyncStatus;
  private constructor(
    readonly ownerId: string,
    private transport: WorkspaceTransport,
    private storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
    cloud: RemoteWorkspace | null,
  ) {
    this.data = cloud?.data ?? createEmptyData();
    this.revision = cloud?.revision ?? 0;
    this.status = {
      state: "synced",
      message: "Saved to your account",
      updatedAt: cloud?.updatedAt ?? "",
    };
    const raw = storage.getItem(accountStorageKey(ownerId));
    if (raw) {
      try {
        const saved: Cache = JSON.parse(raw);
        if (saved.dirty) {
          this.data = validateData(saved.data);
          this.dirty = true;
          if (saved.revision !== this.revision)
            this.status = {
              ...this.status,
              state: "conflict",
              message:
                "Newer records were saved on another device. Export your pending changes, then load the cloud copy.",
            };
          else
            this.status = {
              ...this.status,
              state: "saving",
              message: "Syncing pending changes…",
            };
        }
      } catch {
        throw new Error(
          "A pending account backup could not be opened. It has been preserved on this device.",
        );
      }
    }
  }
  static async open(
    ownerId: string,
    transport: WorkspaceTransport,
    storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> = localStorage,
  ) {
    // Never open a private cache before a successful authenticated cloud read.
    const cloud = await transport.read();
    if (cloud) {
      validateData(cloud.data);
      if (!Number.isSafeInteger(cloud.revision) || cloud.revision < 1)
        throw new Error("Your cloud records have an invalid version.");
    }
    return new CloudWorkspaceRepository(ownerId, transport, storage, cloud);
  }
  load() {
    return structuredClone(this.data);
  }
  getSnapshot = () => this.status;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  hasPendingChanges() {
    return this.dirty;
  }
  private setStatus(
    state: SyncStatus["state"],
    message: string,
    updatedAt = this.status.updatedAt,
  ) {
    if (this.disposed) return;
    this.status = { state, message, updatedAt };
    this.listeners.forEach((listener) => listener());
  }
  private persist(data = this.data, dirty = this.dirty) {
    this.storage.setItem(
      accountStorageKey(this.ownerId),
      JSON.stringify({
        data,
        revision: this.revision,
        dirty,
        updatedAt: this.status.updatedAt,
      } satisfies Cache),
    );
  }
  save(data: AppData) {
    if (this.disposed)
      throw new Error("This account is closed. Log in again before saving.");
    if (this.status.state === "conflict") throw new Error(this.status.message);
    validateData(data);
    if (new TextEncoder().encode(JSON.stringify(data)).length > 8 * 1024 * 1024)
      throw new Error(
        "This workspace exceeds the 8 MB account limit. Export a backup and remove unused records before saving.",
      );
    try {
      this.persist(data, true);
    } catch {
      throw new Error(
        "This device could not keep a pending backup. Export your records before clearing storage.",
      );
    }
    this.data = structuredClone(data);
    this.dirty = true;
    this.generation++;
    this.setStatus("saving", "Saving to your account…");
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.flush();
    }, 400);
  }
  async flush(): Promise<boolean> {
    clearTimeout(this.timer);
    if (this.disposed || this.status.state === "conflict") return false;
    if (!this.draining) {
      this.draining = this.drain();
      try {
        await this.draining;
      } finally {
        this.draining = undefined;
      }
    } else await this.draining;
    return !this.dirty && !this.disposed;
  }
  private async drain() {
    while (this.dirty && !this.disposed) {
      const generation = this.generation,
        data = structuredClone(this.data);
      this.setStatus("saving", "Saving to your account…");
      try {
        const saved = await this.transport.write(data, this.revision);
        if (this.disposed) return;
        this.revision = saved.revision;
        this.dirty = generation !== this.generation;
        this.setStatus(
          this.dirty ? "saving" : "synced",
          this.dirty ? "Saving to your account…" : "Saved to your account",
          saved.updatedAt,
        );
        try {
          this.persist();
        } catch {
          this.storage.removeItem(accountStorageKey(this.ownerId));
        }
      } catch (e) {
        this.setStatus(
          e instanceof WorkspaceConflict ? "conflict" : "error",
          e instanceof WorkspaceConflict
            ? "Newer records were saved on another device. Export your pending changes, then load the cloud copy."
            : "Changes are pending on this device. Check your connection and retry syncing.",
        );
        return;
      }
    }
  }
  discardCache() {
    this.storage.removeItem(accountStorageKey(this.ownerId));
  }
  dispose() {
    this.disposed = true;
    clearTimeout(this.timer);
    this.transport.dispose?.();
    this.listeners.clear();
  }
}
