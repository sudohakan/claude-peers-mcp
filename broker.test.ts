import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 17000 + (process.pid % 2000);
const BASE = `http://127.0.0.1:${PORT}`;
const DIR = mkdtempSync(join(tmpdir(), "peers-broker-"));
let broker: ReturnType<typeof Bun.spawn>;

const post = async (path: string, body: unknown) =>
  (await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })).json();

const register = (id: string | undefined, pid = process.pid) =>
  post("/register", { id, pid, cwd: DIR, git_root: null, tty: null, summary: "test" }) as Promise<{ id: string }>;

const listIds = async () =>
  ((await post("/list-peers", { scope: "machine", cwd: DIR, git_root: null })) as Array<{ id: string }>).map((p) => p.id);

beforeAll(async () => {
  broker = Bun.spawn(["bun", join(import.meta.dir, "broker.ts")], {
    env: { ...process.env, CLAUDE_PEERS_PORT: String(PORT), CLAUDE_PEERS_DB: join(DIR, "peers.db") },
    stdout: "ignore",
    stderr: "ignore",
  });
  for (let i = 0; i < 100; i++) {
    const up = await fetch(`${BASE}/health`).then((r) => r.ok).catch(() => false);
    if (up) return;
    await Bun.sleep(50);
  }
  throw new Error("broker did not start");
});

afterAll(() => {
  broker.kill();
  rmSync(DIR, { recursive: true, force: true });
});

test("pinned ids from one process coexist", async () => {
  await register("jarvis-a");
  await register("jarvis-b");
  await register("hcd-dashboard");
  const ids = await listIds();
  expect(ids).toContain("jarvis-a");
  expect(ids).toContain("jarvis-b");
  expect(ids).toContain("hcd-dashboard");
});

test("a session without a pinned id replaces its own earlier row", async () => {
  const pid = process.ppid;
  const first = await register(undefined, pid);
  const second = await register(undefined, pid);
  const ids = await listIds();
  expect(ids).not.toContain(first.id);
  expect(ids).toContain(second.id);
});

test("re-registering a pinned id keeps a single row", async () => {
  await register("jarvis-a");
  await register("jarvis-a");
  expect((await listIds()).filter((id) => id === "jarvis-a")).toHaveLength(1);
});
