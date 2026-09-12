#!/usr/bin/env node
import { cwd } from "node:process";
import { join, resolve } from "node:path";
import pc from "picocolors";
import { detectSources, importPlatform } from "./discovery.js";
import { exists, writeText } from "./fs.js";
import { loadModel } from "./model.js";
import { render } from "./render.js";
import { validate } from "./validate.js";
import type { Platform } from "./types.js";

const args = process.argv.slice(2);
const command = args[0] ?? "setup";
const root = resolve(args.includes("--root") ? args[args.indexOf("--root") + 1] ?? cwd() : cwd());
const from = args.includes("--from") ? args[args.indexOf("--from") + 1] as Platform : undefined;
const dryRun = args.includes("--dry-run");
const force = args.includes("--force");

const fail = (message: string): never => { console.error(pc.red(`✖ ${message}`)); process.exit(1); };
const ensureSkeleton = async (): Promise<void> => {
  if (await exists(join(root, ".ai", "README.md"))) return;
  if (!dryRun) await writeText(join(root, ".ai", "README.md"), "# AI project configuration\n\nEdit this directory; run `ai-bridge setup` to render Claude Code and Codex files.\n");
};

const main = async (): Promise<void> => {
  if (["--version", "-v"].includes(command)) { console.log("0.1.0"); return; }
  if (command === "help" || command === "--help") { console.log("ai-bridge setup [--from claude|codex] [--dry-run]\nai-bridge diff\nai-bridge validate"); return; }
  if (!["setup", "diff", "validate"].includes(command)) fail(`unknown command: ${command}`);
  if (command === "validate") {
    const errors = await validate(await loadModel(root));
    if (errors.length) fail(errors.join("\n"));
    console.log(pc.green("✓ valid"));
    return;
  }
  const hasCanonical = await exists(join(root, ".ai"));
  let imported = false;
  if (!hasCanonical) {
    const sources = await detectSources(root);
    const selected = from ?? (sources.length === 1 ? sources[0] : undefined);
    if (sources.length > 1 && !from) fail("both Claude and Codex sources found; use --from claude|codex");
    if (selected && !dryRun) { await importPlatform(root, selected); imported = true; }
    await ensureSkeleton();
  }
  const model = await loadModel(root);
  if (command === "diff") { console.log(pc.dim("dry-run: generated files would be refreshed")); return; }
  if (dryRun) { console.log(pc.dim("dry-run: setup would refresh generated files")); return; }
  await render(model, force || imported);
  const errors = await validate(model);
  if (errors.length) fail(errors.join("\n"));
  console.log(pc.green(`✓ setup complete ${pc.dim(`(${model.rules.length} rules, ${model.skills.length} skills, ${model.agents.length} agents, ${model.mcpServers.length} MCP servers)`)}`));
};

main().catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)));
