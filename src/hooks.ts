import { join } from "node:path";
import { exists, readText, writeTextAtomic } from "./fs.js";

const codexMarker = "# ai-bridge:generated hooks=v1";
const hookCommand = "if [ -x \"$PWD/node_modules/.bin/ai-bridge\" ]; then \"$PWD/node_modules/.bin/ai-bridge\" __reconcile --root \"$PWD\"; else npx --yes ai-bridge-tool __reconcile --root \"$PWD\"; fi";

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord => Boolean(value && typeof value === "object" && !Array.isArray(value));

const isAiBridgeCommand = (value: unknown): boolean => isRecord(value) && value.type === "command" && typeof value.command === "string" && /ai-bridge(?:-tool)?\s+__reconcile/.test(value.command);

const installClaudeHook = async (root: string): Promise<void> => {
  const path = join(root, ".claude", "settings.json");
  let settings: JsonRecord = {};
  if (await exists(path)) {
    const parsed: unknown = JSON.parse(await readText(path));
    if (!isRecord(parsed)) throw new Error("Claude settings must be a JSON object");
    settings = parsed;
  }
  const hooks = isRecord(settings.hooks) ? { ...settings.hooks } : {};
  const stop = Array.isArray(hooks.Stop) ? hooks.Stop : [];
  const cleaned = stop.map((group) => {
    if (!isRecord(group) || !Array.isArray(group.hooks)) return group;
    const remaining = group.hooks.filter((hook) => !isAiBridgeCommand(hook));
    return remaining.length ? { ...group, hooks: remaining } : null;
  }).filter((group): group is JsonRecord => Boolean(group));
  cleaned.push({ matcher: ".*", hooks: [{ type: "command", command: hookCommand, timeout: 30 }] });
  hooks.Stop = cleaned;
  settings.hooks = hooks;
  await writeTextAtomic(path, `${JSON.stringify(settings, null, 2)}\n`);
};

const codexConfig = (): string => `${codexMarker}\n[[hooks.Stop]]\nmatcher = ".*"\n\n[[hooks.Stop.hooks]]\ntype = "command"\ncommand = ${JSON.stringify(hookCommand)}\ntimeout = 30\n`;

const checkCodexHook = async (root: string): Promise<void> => {
  const path = join(root, ".codex", "config.toml");
  if (await exists(path)) {
    const current = await readText(path);
    if (!current.startsWith(codexMarker)) throw new Error("refusing to merge manual .codex/config.toml; add the hook manually or use --no-hooks");
  }
};

const installCodexHook = async (root: string): Promise<void> => {
  await checkCodexHook(root);
  const path = join(root, ".codex", "config.toml");
  await writeTextAtomic(path, codexConfig());
};

export const installHooks = async (root: string): Promise<void> => {
  await checkCodexHook(root);
  await installClaudeHook(root);
  await installCodexHook(root);
};
