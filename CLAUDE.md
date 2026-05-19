# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A SiYuan Notes plugin (v1.5.5, minAppVersion 3.5.7) that adds document extraction, organization, AI-assisted marking, and editing tools. Built with TypeScript + Vite 6, compiled to CommonJS format as required by SiYuan's plugin system.

## Commands

```bash
pnpm install                  # Install dependencies
pnpm dev                      # Vite watch mode → deploys to local SiYuan workspace
pnpm build                    # Produce dist/ and package.zip
pnpm test                     # Run Vitest once
pnpm test:watch               # Run Vitest in watch mode
pnpm typecheck:strict         # TypeScript strict type check
pnpm release:patch/minor/major  # Bump version in plugin.json + package.json, tag, push
```

**Environment setup:** Copy `.env.example` to `.env` and set `VITE_SIYUAN_WORKSPACE_PATH` to your SiYuan data directory. Dev builds auto-deploy to `<workspace>/data/plugins/siyuan-doc-assist`.

**Run a single test file:**
```bash
pnpm vitest run tests/key-info-core.test.ts
```

## Architecture

### Layer Structure

```
plugin-lifecycle.ts (extends SiYuan Plugin)
  ├── ActionRunner          → executes document actions through focused handlers
  ├── KeyInfoController     → manages key-info sidebar panel
  └── Plugin Event Bindings → SiYuan editor events
        ↓
core/          Pure domain logic (*-core.ts files)
services/      Kernel API facade + DB queries (SQL via /api/query/sql)
ui/            Vanilla DOM panel and dialog components
styles/        SCSS feature partials imported by src/index.scss
```

### Entry Point

`src/index.ts` imports `src/index.scss`, which aggregates `src/styles/` partials, then exports `DocLinkToolkitPlugin` from `src/plugin/plugin-lifecycle.ts`.

### Action System

All user-facing operations are defined in `src/plugin/action-definitions.ts` and exported through `src/plugin/actions.ts` (49 actions in 6 groups: export, organize, insert, ai, edit, image). `ActionRunner` in `src/plugin/action-runner.ts` is the execution shell for busy state, read-only checks, confirmations, and dispatch; specialized behavior lives in focused handler files:
- `action-runner-export-handlers.ts`, `action-runner-organize-handlers.ts`, `action-runner-insert-handlers.ts`, `action-runner-media-handlers.ts`
- `action-runner-ai-handlers.ts` plus `action-runner-ai-summary/marker/media/related/wiki-handlers.ts`
- `action-runner-cleanup-handlers.ts`, `action-runner-selection-handlers.ts`, `action-runner-trim-handlers.ts`, `action-runner-delete-range-handlers.ts`
- `action-runner-context.ts` — resolves selected block IDs from the editor
- `action-runner-block-transform.ts` — applies markdown transforms to blocks
- `action-runner-dispatcher.ts` — routes action keys to handlers

Actions are available via:
- SiYuan command palette (always registered)
- Editor title right-click menu (user-configurable, order draggable, persisted via `plugin.saveData()`)

### Key-Info Extraction

`src/services/key-info.ts` orchestrates extraction. `src/core/key-info-core.ts` contains pure extraction/render helpers, while `src/services/key-info-model.ts` re-exports smaller model helpers from `key-info-text-normalize.ts`, `key-info-span-format.ts`, and `key-info-remark-model.ts`. Results are merged and ordered by document block structure through the key-info pipeline modules.

### Kernel API Access

`src/services/kernel.ts` is the facade for all SiYuan HTTP API calls. Batch operations (e.g., `getBlockKramdowns([ids])`) are preferred over per-block requests in loops.

## Module Conventions

- `core/` — pure business logic, named `*-core.ts`, tested by `tests/*-core.test.ts`
- `services/` — kernel API calls and data transformation
- `ui/` — DOM manipulation for panels and dialogs (no Vue components used in practice)
- `tests/` — mirrors module names; use deterministic inputs; mock SiYuan APIs

## Coding Style

- 2-space indentation, trimmed trailing whitespace, final newline (enforced by `.editorconfig`)
- Kebab-case file names
- ESLint: `@antfu/eslint-config` (`eslint.config.mjs`)
- Both English and Chinese acceptable in code comments and commit messages
- Commit message style: short direct summary, optional `type:` prefix (e.g., `fix:`, `feat:`)
- Keep `plugin.json` and `package.json` versions in sync — use `pnpm release:*` to do this automatically

## Key Files

| File | Purpose |
|------|---------|
| `src/plugin/plugin-lifecycle.ts` | Main plugin class, SiYuan lifecycle hooks |
| `src/plugin/action-runner.ts` | Action execution shell; delegates to focused handler modules |
| `src/plugin/action-definitions.ts` | Action key definitions, groups, metadata |
| `src/plugin/actions.ts` | Public action metadata export and compatibility helpers |
| `src/services/kernel.ts` | SiYuan kernel API facade |
| `src/services/key-info.ts` | Key-info extraction pipeline |
| `src/services/key-info-model.ts` | Key-info SQL row model exports and inline text/span/remark helpers |
| `src/core/key-info-core.ts` | Pure key-info extraction and Markdown rendering helpers |
| `src/ui/key-info-dock.ts` | Sidebar panel DOM component |
| `src/ui/confirm-detail-dialog.ts` | Detail confirmation dialog helper |
| `src/services/link-resolver.ts` | Backlink/forward-link resolution |
| `src/index.scss` | Stable style entry importing `src/styles/` feature partials |

## Project Structure

- `src/`: application source.
- `src/core/`: pure domain logic in `*-core.ts` files, intended for focused unit tests.
- `src/plugin/`: plugin lifecycle, command/menu registration, action dispatch, controller wiring.
- `src/services/`: SiYuan kernel/file access adapters and higher-level feature services.
- `src/ui/`: dock, dialog, overlay, and DOM rendering helpers.
- `src/styles/`: SCSS feature partials imported by `src/index.scss`.
- `src/types/`: local type declarations and SiYuan type augmentation.
- `tests/`: Vitest suites and `tests/mocks/`.
- `developer_docs/`: local SiYuan API and reference materials.
- `plugin-sample-vite-vue/`: template/reference project, not part of the main plugin runtime.
