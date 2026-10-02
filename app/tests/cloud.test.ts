import assert from "node:assert/strict";
import { test } from "node:test";
import { createEmptyData } from "../src/data/defaults";
import {
  CloudWorkspaceRepository,
  WorkspaceConflict,
  accountStorageKey,
  type RemoteWorkspace,
  type WorkspaceTransport,
} from "../src/services/cloudRepository";
import {
  parseAuthConfig,
  readAuthCallback,
  authRedirect,
} from "../src/services/authConfig";
import { createWorkspaceTransport } from "../src/services/workspaceTransport";
import type { SupabaseClient } from "@supabase/supabase-js";

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => {
      values.set(k, v);
    },
    removeItem: (k: string) => {
      values.delete(k);
    },
  };
}
function transport(
  initial: RemoteWorkspace | null = null,
): WorkspaceTransport & {
  writes: number[];
  read(): Promise<RemoteWorkspace | null>;
} {
  let cloud = initial;
  const writes: number[] = [];
  return {
    writes,
    async read() {
      return cloud && structuredClone(cloud);
    },
    async write(data, expected) {
      writes.push(expected);
      if (expected !== (cloud?.revision ?? 0)) throw new WorkspaceConflict();
      cloud = {
        data: structuredClone(data),
        revision: expected + 1,
        updatedAt: "2026-10-02T01:00:00Z",
      };
      return cloud;
    },
  };
}
test("browser auth configuration rejects private keys and unsafe origins", () => {
  assert.equal(parseAuthConfig({ url: "", publishableKey: "" }), null);
  assert.deepEqual(
    parseAuthConfig({
      url: "https://project.supabase.co/",
      publishableKey: "sb_publishable_example",
    }),
    {
      url: "https://project.supabase.co",
      publishableKey: "sb_publishable_example",
    },
  );
  const jwt = (role: string) =>
    "header." +
    Buffer.from(JSON.stringify({ role })).toString("base64url") +
    ".signature";
  assert.ok(
    parseAuthConfig({
      url: "https://project.supabase.co",
      publishableKey: jwt("anon"),
    }),
  );
  for (const key of ["sb_secret_danger", jwt("service_role"), "placeholder"])
    assert.throws(
      () =>
        parseAuthConfig({
          url: "https://project.supabase.co",
          publishableKey: key,
        }),
      /browser key/,
    );
  for (const url of [
    "http://project.supabase.co",
    "https://user:pass@project.supabase.co",
    "https://project.supabase.co?key=private",
    "javascript:alert(1)",
  ])
    assert.throws(() =>
      parseAuthConfig({ url, publishableKey: "sb_publishable_example" }),
    );
});
test("confirmation and recovery callbacks preserve the GitHub Pages project path", () => {
  assert.equal(
    authRedirect(
      "recovery",
      "https://arsenalhero.github.io/upsc-command-center/?old=1#/daily-study",
    ),
    "https://arsenalhero.github.io/upsc-command-center/?auth=recovery",
  );
  assert.equal(
    readAuthCallback(
      "https://example.test/upsc/?auth=recovery#access_token=secret&type=recovery",
    ).type,
    "recovery",
  );
  assert.equal(
    readAuthCallback("https://example.test/upsc/?token_hash=abc&type=email")
      .tokenHash,
    "abc",
  );
  assert.equal(
    readAuthCallback("https://example.test/upsc/#/daily-study").type,
    null,
  );
  assert.equal(
    readAuthCallback("https://example.test/upsc/#error_description=expired")
      .error,
    "expired",
  );
});
test("account caches stay separate and a failed cloud read cannot expose a cached workspace", async () => {
  const saved = storage();
  const a = await CloudWorkspaceRepository.open("alice", transport(), saved),
    b = await CloudWorkspaceRepository.open("bob", transport(), saved);
  const data = a.load();
  data.settings.optional = "Alice private notes";
  a.save(data);
  assert.equal(b.load().settings.optional, createEmptyData().settings.optional);
  assert.ok(saved.getItem(accountStorageKey("alice")));
  assert.equal(saved.getItem(accountStorageKey("bob")), null);
  await assert.rejects(
    () =>
      CloudWorkspaceRepository.open(
        "alice",
        {
          async read() {
            throw new Error("Unauthenticated");
          },
          async write() {
            throw new Error();
          },
        },
        saved,
      ),
    /Unauthenticated/,
  );
  a.dispose();
  b.dispose();
});
test("cloud writes are serialized and include edits made during an earlier save", async () => {
  let release: (() => void) | undefined;
  const remote = transport();
  const writes: string[] = [];
  const original = remote.write;
  remote.write = async (data, expected) => {
    writes.push(data.settings.optional);
    if (writes.length === 1)
      await new Promise<void>((r) => {
        release = r;
      });
    return original(data, expected);
  };
  const repo = await CloudWorkspaceRepository.open("alice", remote, storage());
  const first = repo.load();
  first.settings.optional = "First edit";
  repo.save(first);
  const flush = repo.flush();
  const second = repo.load();
  second.settings.optional = "Second edit";
  repo.save(second);
  release!();
  assert.equal(await flush, true);
  assert.deepEqual(writes, ["First edit", "Second edit"]);
  assert.deepEqual(remote.writes, [0, 1]);
  assert.equal(repo.getSnapshot().state, "synced");
  repo.dispose();
});
test("failed saves survive a refresh and retry without using guest data", async () => {
  const saved = storage(),
    remote = transport();
  const original = remote.write;
  remote.write = async () => {
    throw new Error("Offline");
  };
  const repo = await CloudWorkspaceRepository.open("alice", remote, saved);
  const data = repo.load();
  data.settings.optional = "Pending study";
  repo.save(data);
  assert.equal(await repo.flush(), false);
  assert.equal(repo.getSnapshot().state, "error");
  repo.dispose();
  remote.write = original;
  const reopened = await CloudWorkspaceRepository.open("alice", remote, saved);
  assert.equal(reopened.load().settings.optional, "Pending study");
  assert.equal(await reopened.flush(), true);
  assert.equal((await remote.read())?.data.settings.optional, "Pending study");
  reopened.dispose();
});
test("stale device revisions cannot silently overwrite a newer cloud copy", async () => {
  const saved = storage(),
    remote = transport({
      data: createEmptyData(),
      revision: 1,
      updatedAt: "now",
    });
  const a = await CloudWorkspaceRepository.open("alice", remote, saved),
    b = await CloudWorkspaceRepository.open("alice", remote, storage());
  const dataA = a.load();
  dataA.settings.optional = "Old device draft";
  a.save(dataA);
  const dataB = b.load();
  dataB.settings.optional = "New device saved";
  b.save(dataB);
  assert.equal(await b.flush(), true);
  assert.equal(await a.flush(), false);
  assert.equal(a.getSnapshot().state, "conflict");
  assert.throws(() => a.save(dataA), /Newer records/);
  assert.equal(
    (await remote.read())?.data.settings.optional,
    "New device saved",
  );
  a.dispose();
  b.dispose();
  const reopened = await CloudWorkspaceRepository.open("alice", remote, saved);
  assert.equal(reopened.getSnapshot().state, "conflict");
  assert.equal(reopened.load().settings.optional, "Old device draft");
  reopened.dispose();
});
test("closing an account cancels queued writes and prevents further saves", async () => {
  const remote = transport(),
    saved = storage();
  const repo = await CloudWorkspaceRepository.open("alice", remote, saved);
  repo.save(repo.load());
  repo.discardCache();
  repo.dispose();
  assert.equal(await repo.flush(), false);
  assert.deepEqual(remote.writes, []);
  assert.equal(saved.getItem(accountStorageKey("alice")), null);
  assert.throws(() => repo.save(createEmptyData()), /closed/);
});
test("transport freezes the owner's token and blocks requests after switching accounts", async () => {
  const fetchOriginal = globalThis.fetch;
  let id = "alice",
    token = "alice-token";
  const requests: RequestInit[] = [];
  const client = {
    auth: {
      async getSession() {
        return {
          data: { session: { user: { id }, access_token: token } },
          error: null,
        };
      },
    },
  } as unknown as SupabaseClient;
  globalThis.fetch = async (_url, init) => {
    requests.push(init!);
    id = "bob";
    token = "bob-token";
    return new Response("[]", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  try {
    const remote = createWorkspaceTransport(
      client,
      {
        url: "https://project.supabase.co",
        publishableKey: "sb_publishable_example",
      },
      "alice",
    );
    assert.equal(await remote.read(), null);
    assert.equal(
      (requests[0].headers as Record<string, string>).Authorization,
      "Bearer alice-token",
    );
    await assert.rejects(
      () => remote.write(createEmptyData(), 0),
      /this account again/,
    );
    assert.equal(requests.length, 1);
    remote.dispose();
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});
