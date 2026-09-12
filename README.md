# ai-bridge

Единый источник AI-инфраструктуры проекта для Claude Code и Codex.

## Быстрый старт (RU)

Требуется Node.js 20+ (LTS). Установка:

```sh
npm install --global ai-bridge
cd your-project
ai-bridge setup
```

Команда создаёт или использует `.ai/`, при однозначно найденном Claude/Codex layout переносит его в канон, генерирует native-файлы и запускает проверку. Если найдены несколько источников, используйте `--from claude` или `--from codex`. Для просмотра изменений есть `ai-bridge diff`, для проверки — `ai-bridge validate`.

Редактируйте только `.ai/`. `CLAUDE.md`, `AGENTS.md`, `.claude/`, `.agents/`, `.codex/` и `.mcp.json` — производные файлы. `--force` нужен для перезаписи неуправляемого файла. В документации описано, как самостоятельно подключить `validate` к CI или pre-commit.

## Quick start (EN)

Requires Node.js 20+ (LTS). Install and run:

```sh
npm install --global ai-bridge
cd your-project
ai-bridge setup
```

The command creates or reuses `.ai/`, imports an unambiguous Claude/Codex layout when present, renders native files, and validates the result. If multiple sources are found, pass `--from claude` or `--from codex`. Use `ai-bridge diff` to preview changes and `ai-bridge validate` to check a project.

Edit `.ai/` only. `CLAUDE.md`, `AGENTS.md`, `.claude/`, `.agents/`, `.codex/`, and `.mcp.json` are generated outputs. Use `--force` to overwrite an unmanaged file. The docs explain how to connect `validate` to CI or pre-commit manually.

## Canonical layout

```text
.ai/
  rules/<name>/instruction.md
  skills/<name>/SKILL.md
  agents/<name>/prompt.md
  mcp/<name>/config.json
  memory/
```

Global Claude/Codex settings are intentionally out of scope for v1; see [`docs/future-features.md`](docs/future-features.md).
