import { join } from "node:path";
import { realpath, rm } from "node:fs/promises";
import type { CanonicalModel } from "./types.js";
import { exists, inside, readText, writeTextAtomic } from "./fs.js";
import { digest, hookPaths } from "./state.js";

const marker = "<!-- ai-bridge:generated file=v1 -->";
const generated = (content: string): string => `${marker}\n${content.trim()}\n`;
const tomlKey = (key: string): string => /^[A-Za-z0-9_-]+$/.test(key) ? key : JSON.stringify(key);
const tomlValue = (value: unknown): string => {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(tomlValue).join(", ")}]`;
  if (value && typeof value === "object") return `{ ${Object.entries(value).map(([key, item]) => `${tomlKey(key)} = ${tomlValue(item)}`).join(", ")} }`;
  throw new Error("unsupported TOML value in MCP config");
};

export const renderPlan = (model: CanonicalModel): Record<string, string> => {
  const index = "# AI project configuration\n\nEdit `.ai/` and run `ai-bridge setup`; generated platform files are not source files.\n";
  const instructions = generated(index) + (model.projectInstructions === undefined ? "" : `\n${model.projectInstructions}`);
  const plan: Record<string, string> = { "CLAUDE.md": instructions, "AGENTS.md": instructions };
  for (const rule of model.rules) {
    plan[join(".claude", "rules", `${rule.name}.md`)] = generated(rule.instruction);
    plan[join(".agents", "rules", `${rule.name}.md`)] = generated(rule.instruction);
  }
  for (const skill of model.skills) {
    plan[join(".claude", "skills", skill.name, "SKILL.md")] = generated(skill.content);
    plan[join(".agents", "skills", skill.name, "SKILL.md")] = generated(skill.content);
  }
  for (const agent of model.agents) {
    plan[join(".claude", "agents", `${agent.name}.md`)] = generated(agent.prompt);
    plan[join(".codex", "agents", `${agent.name}.md`)] = generated(agent.prompt);
  }
  const claudeMcp = { mcpServers: Object.fromEntries(model.mcpServers.map(({ name, config }) => [name, config])) };
  const mcpOutput = `${JSON.stringify(claudeMcp, null, 2)}\n`;
  plan[".mcp.json"] = mcpOutput;
  const codexMcp = model.mcpServers.map(({ name, config }) => `[mcp_servers.${tomlKey(name)}]\n${Object.entries(config).map(([key, value]) => `${tomlKey(key)} = ${tomlValue(value)}`).join("\n")}\n`).join("\n");
  const codexMcpOutput = `# ai-bridge generated; copy to a supported Codex project config if needed.\n${codexMcp}`;
  plan[join(".codex", "mcp.toml")] = codexMcpOutput;
  return plan;
};

export const render = async (model: CanonicalModel, force = false, previousOutputs: Record<string, string> = {}): Promise<string[]> => {
  const plan = renderPlan(model);
  const removed: string[] = [];
  for (const relative of Object.keys(previousOutputs)) {
    if (relative in plan || hookPaths.includes(relative)) continue;
    const path = join(model.root, relative);
    if (!inside(model.root, path)) throw new Error(`invalid generated path: ${relative}`);
    if (!(await exists(path))) continue;
    if (!inside(await realpath(model.root), await realpath(path))) throw new Error(`generated path escapes project: ${relative}`);
    if (!(await readText(path)).startsWith(marker)) throw new Error(`refusing to remove manual file: ${relative}`);
    removed.push(path);
  }
  for (const [relative, output] of Object.entries(plan)) {
    const path = join(model.root, relative);
    if (!(await exists(path)) || force) continue;
    const current = await readText(path);
    const marked = current.startsWith(marker) || current.startsWith("# ai-bridge generated;");
    if (!marked && current !== output && digest(current) !== previousOutputs[relative]) throw new Error(`refusing to overwrite manual file: ${relative} (use --force)`);
  }
  for (const [relative, output] of Object.entries(plan)) await writeTextAtomic(join(model.root, relative), output);
  for (const path of removed) await rm(path);
  return Object.keys(plan);
};

export { marker };
