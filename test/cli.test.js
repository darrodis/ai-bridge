import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

const run = (root, ...args) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [join(process.cwd(), "dist", "cli.js"), ...args], { cwd: root });
  let stdout = ""; let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  child.on("error", reject);
  child.on("close", (code) => resolve({ code, stdout, stderr }));
});

test("setup creates canonical and generated outputs", async () => {
  const root = await mkdtemp(join(tmpdir(), "ai-bridge-"));
  try {
    const result = await run(root, "setup");
    assert.equal(result.code, 0, result.stderr);
    assert.match(await readFile(join(root, "CLAUDE.md"), "utf8"), /ai-bridge:generated/);
    assert.match(await readFile(join(root, "AGENTS.md"), "utf8"), /ai-bridge:generated/);
    assert.equal(JSON.parse(await readFile(join(root, ".mcp.json"), "utf8")).mcpServers instanceof Object, true);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("setup imports a Claude rule", async () => {
  const root = await mkdtemp(join(tmpdir(), "ai-bridge-"));
  try {
    await mkdir(join(root, ".claude", "rules"), { recursive: true });
    await writeFile(join(root, ".claude", "rules", "style.md"), "Be concise.\n");
    const result = await run(root, "setup");
    assert.equal(result.code, 0, result.stderr);
    assert.equal(await readFile(join(root, ".ai", "rules", "style", "instruction.md"), "utf8"), "Be concise.\n");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("setup renders MCP env as TOML", async () => {
  const root = await mkdtemp(join(tmpdir(), "ai-bridge-"));
  try {
    await mkdir(join(root, ".ai", "mcp", "docs"), { recursive: true });
    await writeFile(join(root, ".ai", "mcp", "docs", "config.json"), JSON.stringify({ command: "npx", args: ["-y", "docs-mcp"], env: { API_KEY: "${API_KEY}" } }));
    const result = await run(root, "setup");
    assert.equal(result.code, 0, result.stderr);
    const output = await readFile(join(root, ".codex", "mcp.toml"), "utf8");
    assert.match(output, /args = \["-y", "docs-mcp"\]/);
    assert.match(output, /env = \{ API_KEY = "\$\{API_KEY\}" \}/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("setup imports Claude project MCP", async () => {
  const root = await mkdtemp(join(tmpdir(), "ai-bridge-"));
  try {
    await mkdir(join(root, ".claude"), { recursive: true });
    await writeFile(join(root, ".mcp.json"), JSON.stringify({ mcpServers: { docs: { command: "npx", args: ["-y", "docs-mcp"] } } }));
    const result = await run(root, "setup");
    assert.equal(result.code, 0, result.stderr);
    assert.deepEqual(JSON.parse(await readFile(join(root, ".ai", "mcp", "docs", "config.json"), "utf8")), { command: "npx", args: ["-y", "docs-mcp"] });
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("setup installs Claude and Codex reconcile hooks", async () => {
  const root = await mkdtemp(join(tmpdir(), "ai-bridge-"));
  try {
    const result = await run(root, "setup");
    assert.equal(result.code, 0, result.stderr);
    const claude = JSON.parse(await readFile(join(root, ".claude", "settings.json"), "utf8"));
    assert.match(claude.hooks.Stop[0].hooks[0].command, /ai-bridge-tool __reconcile/);
    assert.match(await readFile(join(root, ".codex", "config.toml"), "utf8"), /\[\[hooks\.Stop\]\]/);
    assert.equal((await run(root, "setup")).code, 0);
    const rerun = JSON.parse(await readFile(join(root, ".claude", "settings.json"), "utf8"));
    assert.equal(rerun.hooks.Stop.flatMap((group) => group.hooks ?? []).filter((hook) => String(hook.command).includes("__reconcile")).length, 1);
    assert.equal((await run(root, "__reconcile")).code, 0);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("reconcile reports native drift without overwriting it", async () => {
  const root = await mkdtemp(join(tmpdir(), "ai-bridge-"));
  try {
    assert.equal((await run(root, "setup")).code, 0);
    const path = join(root, "CLAUDE.md");
    const original = await readFile(path, "utf8");
    await writeFile(path, `${original}\nmanual change\n`);
    const result = await run(root, "__reconcile");
    assert.equal(result.code, 0);
    assert.equal(await readFile(path, "utf8"), `${original}\nmanual change\n`);
    assert.match(result.stderr, /drift detected/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
