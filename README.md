# ai-bridge

<p align="center"><strong>One project AI source of truth for Claude Code and Codex.</strong></p>

<details open>
<summary>Русский</summary>

## Что это и зачем

`ai-bridge` решает одну конкретную проблему: Claude Code и Codex используют разные native-файлы для правил, skills, агентов и MCP. Если поддерживать их вручную, конфигурации расходятся.

Инструмент вводит третью сущность — канонический каталог `.ai/`. Пользователь и ИИ работают только с ним. `ai-bridge setup` один раз создаёт или находит `.ai/`, переносит однозначно найденную существующую конфигурацию, затем генерирует native-файлы Claude Code и Codex.

После `setup` в проект добавляются `CLAUDE.md` и `AGENTS.md` с общей инструкцией для ИИ: изменять AI-инфраструктуру только в `.ai/`. Остальные файлы считаются производными.

Глобальные настройки Claude и Codex в первой версии не изменяются.

## Быстрый старт

Требуется Node.js 20+ (LTS). Глобальная установка не нужна:

```sh
cd your-project
npx --yes ai-bridge-tool setup
```

Для существующей конфигурации, если одновременно найдены Claude и Codex, укажите источник:

```sh
npx --yes ai-bridge-tool setup --from claude
npx --yes ai-bridge-tool setup --from codex
```

## Команды

### `setup`

Единая команда пользовательского сценария:

1. обнаруживает `.ai/`, Claude- и Codex-файлы;
2. создаёт минимальный `.ai/`, если его нет;
3. при одном источнике переносит rules, skills, agents, project instructions и Claude project MCP в `.ai/`;
4. генерирует `CLAUDE.md`, `AGENTS.md`, `.claude/`, `.agents/`, `.codex/`, `.mcp.json` и `.codex/mcp.toml`;
5. устанавливает project-level Stop hooks Claude и Codex;
6. запускает `validate` автоматически.

```sh
npx --yes ai-bridge-tool setup
npx --yes ai-bridge-tool setup --from claude
npx --yes ai-bridge-tool setup --dry-run
npx --yes ai-bridge-tool setup --force
```

`--dry-run` не изменяет файлы. `--force` разрешает перезапись существующего неуправляемого файла. Если найдены несколько источников, команда остановится и попросит выбрать `--from`.

Существующий корневой `CLAUDE.md` или `AGENTS.md` при первом импорте сохраняется в `.ai/instructions/project.md`, а затем включается в оба сгенерированных файла. После этого редактируйте только `.ai/instructions/project.md`.

После `setup` ИИ может менять `.ai/`: в конце его хода Stop hook автоматически запускает внутренний reconcile и обновляет generated-файлы. Если `.ai/` не менялся, reconcile ничего не делает. Ручное изменение generated-файла не затирается молча — инструмент сообщает о drift. Для отключения hooks используйте `--no-hooks`.

### `diff`

Показывает, что generated outputs будут пересобраны, не изменяя проект. Если `.ai/` ещё нет, только сообщает, какой источник был бы импортирован:

```sh
npx --yes ai-bridge-tool diff
```

### `validate`

Проверяет наличие `.ai/`, допустимые имена сущностей, соответствие generated-файлов канону и устаревшие производные файлы:

```sh
npx --yes ai-bridge-tool validate
```

### Общие опции

```text
--root <path>          рабочий каталог проекта
--from claude|codex    явный источник первичного импорта
--dry-run              показать план без записи
--force                разрешить перезапись неуправляемых файлов
--no-hooks             не устанавливать project-level Stop hooks
--version              показать версию
```

## Каноническая структура

```text
.ai/
  instructions/project.md
  rules/<name>/instruction.md
  skills/<name>/SKILL.md
  agents/<name>/prompt.md
  mcp/<name>/config.json
  memory/
```

Редактируйте только `.ai/`. `CLAUDE.md`, `AGENTS.md`, `.claude/`, `.agents/`, `.codex/`, `.mcp.json` и `.codex/mcp.toml` генерируются из него. Generated markers позволяют отличать управляемые файлы от ручных. Если удалить ресурс из `.ai/`, его управляемая производная будет удалена при следующем `setup`.

## MCP

MCP-серверы описываются в `.ai/mcp/<name>/config.json`. Для Claude создаётся project `.mcp.json`. Для Codex создаётся reviewable `.codex/mcp.toml`; глобальный `~/.codex/config.toml` инструмент не меняет.

## Подключение `validate` к CI

`ai-bridge` не добавляет CI-интеграцию автоматически. Пользователь сам решает, нужна ли проверка, и добавляет шаг в workflow проекта:

```yaml
- name: validate ai configuration
  run: npx --yes ai-bridge-tool validate
```

## Подключение `validate` к pre-commit

Добавьте локальный hook проекта, который выполняет ту же команду:

```sh
npx --yes ai-bridge-tool validate
```

Hook можно подключить любым выбранным менеджером (например, lefthook, Husky или простым `.git/hooks/pre-commit`). `ai-bridge` не устанавливает и не активирует hook за пользователя.

## Требования

- Node.js 20+ (LTS);
- npm, pnpm или другой менеджер, способный запускать `npx`;
- Claude Code или Codex — только для использования сгенерированных файлов, не для запуска компилятора.

</details>

<details>
<summary>English</summary>

## What it is

`ai-bridge` keeps Claude Code and Codex project AI infrastructure in one canonical `.ai/` directory. Both tools have different native files for rules, skills, agents, and MCP; maintaining those files by hand creates drift.

The user and the AI edit `.ai/`. `npx --yes ai-bridge-tool setup` creates or discovers it, imports one unambiguous existing Claude/Codex layout, renders native outputs, and validates them.

The command adds project-level `CLAUDE.md` and `AGENTS.md` instructions telling the AI to update only `.ai/`. Native files are generated outputs. Global Claude and Codex settings are intentionally untouched in v1.

## Quick start

Requires Node.js 20+ (LTS). No global installation is needed:

```sh
cd your-project
npx --yes ai-bridge-tool setup
```

If both Claude and Codex sources exist, choose one explicitly:

```sh
npx --yes ai-bridge-tool setup --from claude
npx --yes ai-bridge-tool setup --from codex
```

## Commands

### `setup`

The single user-facing workflow. It discovers sources, creates `.ai/` when needed, imports an unambiguous source (including project instructions), renders Claude/Codex/MCP outputs, and runs `validate` at the end.

```sh
npx --yes ai-bridge-tool setup
npx --yes ai-bridge-tool setup --dry-run
npx --yes ai-bridge-tool setup --force
npx --yes ai-bridge-tool setup --no-hooks
```

After `setup`, project-level Stop hooks run an internal reconcile after an AI turn. They refresh generated files only when `.ai/` changed; native drift is reported instead of being silently overwritten. Use `--no-hooks` to opt out.

### `diff`

Previews a generated refresh without changing files. If `.ai/` does not exist, it only reports which source would be imported:

```sh
npx --yes ai-bridge-tool diff
```

### `validate`

Checks the canonical directory, entity names, generated content, drift, and orphaned outputs:

```sh
npx --yes ai-bridge-tool validate
```

### Options

```text
--root <path>          project working directory
--from claude|codex    explicit import source
--dry-run              preview without writing
--force                allow overwriting unmanaged files
--no-hooks             do not install project-level Stop hooks
--version              print the version
```

## Canonical layout and ownership

```text
.ai/
  instructions/project.md
  rules/<name>/instruction.md
  skills/<name>/SKILL.md
  agents/<name>/prompt.md
  mcp/<name>/config.json
  memory/
```

Edit `.ai/` only. An existing root `CLAUDE.md` or `AGENTS.md` is imported into `.ai/instructions/project.md` on first setup and then rendered into both native instruction files. `CLAUDE.md`, `AGENTS.md`, `.claude/`, `.agents/`, `.codex/`, `.mcp.json`, and `.codex/mcp.toml` are generated outputs. Removing a canonical resource removes its managed generated outputs on the next `setup`.

## MCP

Define MCP servers in `.ai/mcp/<name>/config.json`. Claude receives project `.mcp.json`. Codex receives a reviewable `.codex/mcp.toml`; global `~/.codex/config.toml` is never changed.

## Add `validate` to CI

The tool does not modify CI automatically. Add this step to the project workflow if desired:

```yaml
- name: validate ai configuration
  run: npx --yes ai-bridge-tool validate
```

## Add `validate` to pre-commit

Add the same command to the project hook managed by your preferred tool:

```sh
npx --yes ai-bridge-tool validate
```

`ai-bridge` does not install or enable CI/pre-commit hooks automatically.

## Requirements

- Node.js 20+ (LTS);
- npm, pnpm, or another package manager that can run `npx`;
- Claude Code or Codex only to consume generated files, not to run the compiler.

</details>
