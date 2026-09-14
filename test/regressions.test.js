import assert from "node:assert/strict";
import { test } from "node:test";
import { cp, mkdtemp, readFile, rm, stat, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync, spawn } from "node:child_process";

const run = (root, ...args) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [join(process.cwd(), "dist", "cli.js"), ...args], { cwd: root });
  let stdout = ""; let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  child.on("error", reject);
  child.on("close", (code) => resolve({ code, stdout, stderr }));
});

const temporary = async () => mkdtemp(join(tmpdir(), "ai-bridge-regression-"));
const cleanup = async (root) => rm(root, { recursive: true, force: true });

for (const sourceFile of ["CLAUDE.md", "AGENTS.md"]) test(`imports ${sourceFile} instructions into canonical and renders them`, async () => {
  const root = await temporary();
  try {
    const instructions = "# Project instructions\n\nNever delete production data.\n\n";
    await writeFile(join(root, sourceFile), instructions);
    const result = await run(root, "setup");
    assert.equal(result.code, 0, result.stderr);
    assert.equal(await readFile(join(root, ".ai", "instructions", "project.md"), "utf8"), instructions);
    assert.ok((await readFile(join(root, "CLAUDE.md"), "utf8")).endsWith(instructions));
    assert.ok((await readFile(join(root, "AGENTS.md"), "utf8")).endsWith(instructions));
    assert.equal((await run(root, "setup")).code, 0);
    await writeFile(join(root, ".ai", "instructions", "project.md"), "Updated project instructions.\n");
    assert.equal((await run(root, "__reconcile")).code, 0);
    assert.match(await readFile(join(root, "AGENTS.md"), "utf8"), /Updated project instructions/);
  } finally { await cleanup(root); }
});

test("diff is read-only when canonical config is absent", async () => {
  const root = await temporary();
  try {
    await mkdir(join(root, ".claude", "rules"), { recursive: true });
    await writeFile(join(root, ".claude", "rules", "style.md"), "Be concise.\n");
    const result = await run(root, "diff");
    assert.equal(result.code, 0, result.stderr);
    await assert.rejects(() => stat(join(root, ".ai")));
    await assert.rejects(() => stat(join(root, "CLAUDE.md")));
  } finally { await cleanup(root); }
});

test("setup removes deleted generated rules but keeps canonical state", async () => {
  const root = await temporary();
  try {
    await mkdir(join(root, ".ai", "rules", "obsolete"), { recursive: true });
    await writeFile(join(root, ".ai", "rules", "obsolete", "instruction.md"), "Old.\n");
    assert.equal((await run(root, "setup")).code, 0);
    await rm(join(root, ".ai", "rules", "obsolete"), { recursive: true });
    assert.equal((await run(root, "setup")).code, 0);
    await assert.rejects(() => stat(join(root, ".claude", "rules", "obsolete.md")));
    await assert.rejects(() => stat(join(root, ".agents", "rules", "obsolete.md")));
    assert.doesNotMatch(await readFile(join(root, ".ai-bridge", "state.json"), "utf8"), /obsolete/);
  } finally { await cleanup(root); }
});

test("validate reports native drift and orphan files", async () => {
  const root = await temporary();
  try {
    await mkdir(join(root, ".ai", "rules", "style"), { recursive: true });
    await writeFile(join(root, ".ai", "rules", "style", "instruction.md"), "Be concise.\n");
    assert.equal((await run(root, "setup")).code, 0);
    await writeFile(join(root, "CLAUDE.md"), `${await readFile(join(root, "CLAUDE.md"), "utf8")}manual\n`);
    let result = await run(root, "validate");
    assert.equal(result.code, 1);
    assert.match(result.stderr, /generated file drift: CLAUDE\.md/);
    await writeFile(join(root, "CLAUDE.md"), await readFile(join(root, "AGENTS.md"), "utf8"));
    await rm(join(root, ".ai", "rules", "style"), { recursive: true });
    result = await run(root, "validate");
    assert.equal(result.code, 1);
    assert.match(result.stderr, /orphan generated file: \.claude\/rules\/style\.md/);
  } finally { await cleanup(root); }
});

test("reconcile refuses to overwrite native and canonical changes together", async () => {
  const root = await temporary();
  try {
    await mkdir(join(root, ".ai", "rules", "style"), { recursive: true });
    await writeFile(join(root, ".ai", "rules", "style", "instruction.md"), "Be concise.\n");
    assert.equal((await run(root, "setup")).code, 0);
    const native = join(root, ".claude", "rules", "style.md");
    await writeFile(native, `${await readFile(native, "utf8")}manual\n`);
    await writeFile(join(root, ".ai", "rules", "style", "instruction.md"), "Be extremely concise.\n");
    const result = await run(root, "__reconcile");
    assert.equal(result.code, 0);
    assert.match(result.stderr, /drift detected/);
    assert.match(await readFile(native, "utf8"), /manual/);
  } finally { await cleanup(root); }
});

test("version comes from installed package metadata, not a build constant", async () => {
  const root = await temporary();
  try {
    await cp(join(process.cwd(), "dist"), join(root, "dist"), { recursive: true });
    await cp(join(process.cwd(), "node_modules", "picocolors"), join(root, "node_modules", "picocolors"), { recursive: true });
    await writeFile(join(root, "package.json"), JSON.stringify({ type: "module", version: "9.8.7" }));
    const result = execFileSync(process.execPath, [join(root, "dist", "cli.js"), "--version"], { encoding: "utf8" });
    assert.equal(result.trim(), "9.8.7");
  } finally { await cleanup(root); }
});

test("reconcile removes generated skills and agents without reinstalling hooks", async () => {
  const root = await temporary();
  try {
    await mkdir(join(root, ".ai", "skills", "review"), { recursive: true });
    await mkdir(join(root, ".ai", "agents", "reviewer"), { recursive: true });
    await writeFile(join(root, ".ai", "skills", "review", "SKILL.md"), "Review code.\n");
    await writeFile(join(root, ".ai", "agents", "reviewer", "prompt.md"), "Review changes.\n");
    assert.equal((await run(root, "setup")).code, 0);
    await rm(join(root, ".ai", "skills", "review", "SKILL.md"));
    await rm(join(root, ".ai", "agents", "reviewer", "prompt.md"));
    const result = await run(root, "__reconcile");
    assert.equal(result.code, 0, result.stderr);
    for (const path of [".claude/skills/review/SKILL.md", ".agents/skills/review/SKILL.md", ".claude/agents/reviewer.md", ".codex/agents/reviewer.md"]) await assert.rejects(() => stat(join(root, path)));
    assert.equal((await run(root, "validate")).code, 0);
    assert.equal((await run(root, "__reconcile")).stdout, "");
  } finally { await cleanup(root); }
});

test("setup does not delete or overwrite a manual orphan", async () => {
  const root = await temporary();
  try {
    await mkdir(join(root, ".ai", "rules", "style"), { recursive: true });
    await writeFile(join(root, ".ai", "rules", "style", "instruction.md"), "Be concise.\n");
    assert.equal((await run(root, "setup")).code, 0);
    await rm(join(root, ".ai", "rules", "style", "instruction.md"));
    await writeFile(join(root, ".claude", "rules", "style.md"), "Manual file.\n");
    const result = await run(root, "setup");
    assert.equal(result.code, 1);
    assert.match(result.stderr, /refusing to remove manual file/);
    assert.equal(await readFile(join(root, ".claude", "rules", "style.md"), "utf8"), "Manual file.\n");
    assert.equal((await run(root, "validate")).code, 1);
  } finally { await cleanup(root); }
});
