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
