#!/usr/bin/env node
import { cwd } from "node:process";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import pc from "picocolors";
import { detectSources, importPlatform } from "./discovery.js";
import { exists, writeText } from "./fs.js";
import { loadModel } from "./model.js";
import { render } from "./render.js";
import { validate } from "./validate.js";
import { installHooks } from "./hooks.js";
import { reconcile } from "./reconcile.js";
import { hookPaths, readState, saveState } from "./state.js";
import type { Platform } from "./types.js";

const args = process.argv.slice(2);
const command = args[0] ?? "setup";
const root = resolve(args.includes("--root") ? args[args.indexOf("--root") + 1] ?? cwd() : cwd());
const from = args.includes("--from") ? args[args.indexOf("--from") + 1] as Platform : undefined;
const dryRun = args.includes("--dry-run");
const force = args.includes("--force");
const noHooks = args.includes("--no-hooks");

const fail = (message: string): never => { console.error(pc.red(`✖ ${message}`)); process.exit(1); };
const ensureSkeleton = async (): Promise<void> => {
  if (await exists(join(root, ".ai", "README.md"))) return;
  if (!dryRun) await writeText(join(root, ".ai", "README.md"), "# AI project configuration\n\nEdit this directory; run `ai-bridge setup` to render Claude Code and Codex files.\n");
};

const main = async (): Promise<void> => {
  if (["--version", "-v"].includes(command)) {
    const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")) as { version: string };
    console.log(packageJson.version);
    return;
  }
  if (command === "help" || command === "--help") { console.log("ai-bridge setup [--from claude|codex] [--dry-run] [--no-hooks]\nai-bridge diff\nai-bridge validate"); return; }
  if (command === "__reconcile") {
    const result = await reconcile(root);
    if (result === "drift") { console.error(pc.yellow("⚠ generated file drift detected; edit .ai/ and run ai-bridge setup")); return; }
    if (result === "changed") console.log(pc.green("✓ generated files refreshed"));
    return;
  }
  if (!["setup", "diff", "validate"].includes(command)) fail(`unknown command: ${command}`);
  if (command === "validate") {
    const errors = await validate(await loadModel(root));
    if (errors.length) fail(errors.join("\n"));
    console.log(pc.green("✓ valid"));
    return;
  }
  const hasCanonical = await exists(join(root, ".ai"));
  if (command === "diff") {
    if (!hasCanonical) {
      const sources = await detectSources(root);
      const selected = from ?? (sources.length === 1 ? sources[0] : undefined);
      if (sources.length > 1 && !from) fail("both Claude and Codex sources found; use --from claude|codex");
      console.log(pc.dim(selected ? `dry-run: would import ${selected} and refresh generated files` : "dry-run: no canonical configuration found"));
      return;
    }
    const model = await loadModel(root);
    const errors = await validate(model, false);
    if (errors.length) fail(errors.join("\n"));
    console.log(pc.dim("dry-run: generated files would be refreshed"));
    return;
  }
  let imported: Record<string, string> = {};
  if (!hasCanonical) {
    const sources = await detectSources(root);
    const selected = from ?? (sources.length === 1 ? sources[0] : undefined);
    if (sources.length > 1 && !from) fail("both Claude and Codex sources found; use --from claude|codex");
    if (selected && !dryRun) imported = await importPlatform(root, selected);
    await ensureSkeleton();
  }
  const model = await loadModel(root);
  if (dryRun) { console.log(pc.dim("dry-run: setup would refresh generated files")); return; }
  const previous = await readState(root);
  const errors = await validate(model, false);
  if (errors.length) fail(errors.join("\n"));
  const written = await render(model, force, { ...previous?.outputs, ...imported });
  if (!noHooks) await installHooks(root);
  await saveState(root, noHooks ? written : [...written, ...hookPaths]);
  const validationErrors = await validate(model);
  if (validationErrors.length) fail(validationErrors.join("\n"));
  console.log(pc.green(`✓ setup complete ${pc.dim(`(${model.rules.length} rules, ${model.skills.length} skills, ${model.agents.length} agents, ${model.mcpServers.length} MCP servers)`)}`));
};

main().catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)));
