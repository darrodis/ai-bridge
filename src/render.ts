import { join } from "node:path";
import type { CanonicalModel } from "./types.js";
import { exists, readText, writeTextAtomic } from "./fs.js";

const marker = "<!-- ai-bridge:generated file=v1 -->";
const generated = (content: string): string => `${marker}\n${content.trim()}\n`;
const tomlKey = (key: string): string => /^[A-Za-z0-9_-]+$/.test(key) ? key : JSON.stringify(key);
const tomlValue = (value: unknown): string => {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(tomlValue).join(", ")}]`;
  if (value && typeof value === "object") return `{ ${Object.entries(value).map(([key, item]) => `${tomlKey(key)} = ${tomlValue(item)}`).join(", ")} }`;
  throw new Error("unsupported TOML value in MCP config");
};

export const render = async (model: CanonicalModel, force = false): Promise<string[]> => {
  const written: string[] = [];
  const write = async (relative: string, content: string) => {
    const path = join(model.root, relative);
    const output = generated(content);
    if (await exists(path) && !force && !(await readText(path)).startsWith(marker)) throw new Error(`refusing to overwrite manual file: ${relative} (use --force)`);
    await writeTextAtomic(path, output);
    written.push(relative);
  };
  const index = "# AI project configuration\n\nEdit `.ai/` and run `ai-bridge setup`; generated platform files are not source files.\n";
  await write("CLAUDE.md", index);
  await write("AGENTS.md", index);
  for (const rule of model.rules) {
    await write(join(".claude", "rules", `${rule.name}.md`), rule.instruction);
    await write(join(".agents", "rules", `${rule.name}.md`), rule.instruction);
  }
  for (const skill of model.skills) {
    await write(join(".claude", "skills", skill.name, "SKILL.md"), skill.content);
    await write(join(".agents", "skills", skill.name, "SKILL.md"), skill.content);
  }
  for (const agent of model.agents) {
    await write(join(".claude", "agents", `${agent.name}.md`), agent.prompt);
    await write(join(".codex", "agents", `${agent.name}.md`), agent.prompt);
  }
  const claudeMcp = { mcpServers: Object.fromEntries(model.mcpServers.map(({ name, config }) => [name, config])) };
  const mcpPath = join(model.root, ".mcp.json");
  const mcpOutput = `${JSON.stringify(claudeMcp, null, 2)}\n`;
  if (await exists(mcpPath) && !force && (await readText(mcpPath)) !== mcpOutput) throw new Error("refusing to overwrite manual .mcp.json (use --force)");
  await writeTextAtomic(mcpPath, mcpOutput);
  written.push(".mcp.json");
  const codexMcp = model.mcpServers.map(({ name, config }) => `[mcp_servers.${tomlKey(name)}]\n${Object.entries(config).map(([key, value]) => `${tomlKey(key)} = ${tomlValue(value)}`).join("\n")}\n`).join("\n");
  const codexMcpPath = join(model.root, ".codex", "mcp.toml");
  const codexMcpOutput = `# ai-bridge generated; copy to a supported Codex project config if needed.\n${codexMcp}`;
  if (await exists(codexMcpPath) && !force && (await readText(codexMcpPath)) !== codexMcpOutput) throw new Error("refusing to overwrite manual .codex/mcp.toml (use --force)");
  await writeTextAtomic(codexMcpPath, codexMcpOutput);
  written.push(join(".codex", "mcp.toml"));
  return written;
};
