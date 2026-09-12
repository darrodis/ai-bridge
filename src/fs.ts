import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";

export const exists = async (path: string): Promise<boolean> => {
  try { await access(path); return true; } catch { return false; }
};

export const readText = (path: string): Promise<string> => readFile(path, "utf8");

export const listDirectories = async (path: string): Promise<string[]> => {
  if (!(await exists(path))) return [];
  const entries = await readdir(path, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
};

export const listFiles = async (path: string, extension?: string): Promise<string[]> => {
  if (!(await exists(path))) return [];
  const entries = await readdir(path, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile() && (!extension || entry.name.endsWith(extension))).map((entry) => entry.name).sort();
};

export const writeText = async (path: string, content: string): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
};

export const inside = (root: string, path: string): boolean => {
  const resolvedRoot = resolve(root) + sep;
  return resolve(path).startsWith(resolvedRoot);
};
