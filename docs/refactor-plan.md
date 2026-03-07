# Refactor Plan

- Generated: 2026-03-07
- Workflow: `code-refactor`
- Current phase: `RF-001`, `RF-002`, `RF-003`, and `RF-004` completed.
- Fallback note: `references/refactor-plan-template.md` is not present in this repository, so this file follows the skill-required structure directly.

## 1. Module and function analysis summary

| Area | Key files | Current responsibility and boundary | Refactor value | Regression risk | Current tests and gaps |
| --- | --- | --- | --- | --- | --- |
| Entry and lifecycle | `src/index.ts`, `src/plugin/plugin-lifecycle.ts`, `src/plugin/plugin-lifecycle-events.ts`, `src/plugin/plugin-lifecycle-menu.ts`, `src/plugin/plugin-lifecycle-state.ts` | `src/index.ts` only boots the plugin. `plugin-lifecycle.ts` is now the lifecycle composition root, while menu-state normalization/persistence and menu/command composition live in dedicated helpers. | High | Medium-high | Lifecycle menu/storage behavior is covered by `tests/plugin-menu-registration.test.ts`, `tests/plugin-actions.test.ts`, and `tests/plugin-doc-context.test.ts`. |
| Action orchestration | `src/plugin/action-runner.ts`, `src/plugin/action-runner-dispatcher.ts`, `src/plugin/action-runner-context.ts`, `src/plugin/action-runner-block-transform.ts`, `src/plugin/action-runner-*-handlers.ts`, `src/plugin/actions.ts` | `action-runner.ts` is now the execution shell for run guards, doc resolution, busy/error handling, and heavier markdown/edit flows. Export/insert/organize/media actions are delegated to grouped handler modules. | Highest | High | Shell invariants are covered by `tests/action-runner-loading.test.ts` and `tests/action-runner-block-transform.test.ts`. |
| Key info pipeline and UI | `src/plugin/key-info-controller.ts`, `src/plugin/key-info-controller-dock.ts`, `src/ui/key-info-dock.ts`, `src/ui/key-info-dock-controls.ts`, `src/ui/key-info-dock-doc-actions.ts`, `src/ui/key-info-dock-state.ts`, `src/services/key-info.ts`, `src/services/key-info-*.ts`, `src/core/key-info-core.ts` | `key-info-controller.ts` now focuses on refresh/navigation/export orchestration, while dock callback bridging and dock action state composition are extracted. In the UI layer, `key-info-dock.ts` keeps state-driven rendering and scroll behavior, while static control-shell DOM creation lives in `key-info-dock-controls.ts`. | High | Medium | Footer callbacks, tab/filter state, dock state, scroll interaction, and controller action wiring are covered by dedicated tests. |
| Markdown cleanup | `src/core/markdown-cleanup-core.ts`, `src/core/markdown-cleanup-text-core.ts`, `src/core/markdown-cleanup-ai-core.ts`, `src/core/markdown-cleanup-block-core.ts` | `markdown-cleanup-core.ts` is now a public facade. Text cleanup, AI-output cleanup, and block cleanup have separate internal modules. | Medium | Low-medium | Public API behavior remains covered by `tests/markdown-cleanup-core.test.ts` and `tests/markdown-cleanup-blocks.test.ts`. |
| Types and boundaries | `src/types/*`, `src/services/kernel*.ts`, `src/core/*` | Boundary types and adapters remain mostly stable. | Lower | Low-medium | Existing kernel/core coverage remains broad enough. |

## 2. Item results

### RF-001 ? P0 ? Decompose `ActionRunner` into a thin execution shell plus grouped action handlers

- Scope files:
  - `src/plugin/action-runner.ts`
  - `src/plugin/action-runner-dispatcher.ts`
  - `src/plugin/action-runner-context.ts`
  - `src/plugin/action-runner-block-transform.ts`
  - `src/plugin/action-runner-export-handlers.ts`
  - `src/plugin/action-runner-insert-handlers.ts`
  - `src/plugin/action-runner-organize-handlers.ts`
  - `src/plugin/action-runner-media-handlers.ts`
  - `tests/action-runner-loading.test.ts`
- Outcome:
  - `action-runner.ts` now acts as the execution shell plus heavier edit/cleanup flows.
  - Export/insert/organize/media groups now live in dedicated handler modules.
  - `action-runner-dispatcher.ts` now exposes `PartialActionHandlerMap`.
- Status: `done`

### RF-002 ? P1 ? Extract lifecycle state persistence and menu composition from `plugin-lifecycle`

- Scope files:
  - `src/plugin/plugin-lifecycle.ts`
  - `src/plugin/plugin-lifecycle-events.ts`
  - `src/plugin/plugin-lifecycle-menu.ts`
  - `src/plugin/plugin-lifecycle-state.ts`
  - `tests/plugin-menu-registration.test.ts`
- Outcome:
  - `plugin-lifecycle.ts` now focuses on lifecycle composition, current-doc context, and helper coordination.
  - `plugin-lifecycle-state.ts` owns menu-state defaults, normalization, serialization, and updates.
  - `plugin-lifecycle-menu.ts` owns title-menu composition and command registration wiring.
- Status: `done`

### RF-003 ? P1 ? Separate key-info dock rendering from controller interaction orchestration

- Scope files:
  - `src/plugin/key-info-controller.ts`
  - `src/plugin/key-info-controller-dock.ts`
  - `src/ui/key-info-dock.ts`
  - `src/ui/key-info-dock-controls.ts`
  - `src/ui/key-info-dock-doc-actions.ts`
  - `src/ui/key-info-dock-state.ts`
  - `tests/key-info-dock-controls.test.ts`
- Outcome:
  - `key-info-controller.ts` now delegates dock callback bridging and doc-action state shaping to `key-info-controller-dock.ts`.
  - `key-info-dock.ts` now delegates static control-shell DOM creation to `key-info-dock-controls.ts`.
  - Scroll behavior, list rendering, and doc-action rendering remain in `key-info-dock.ts`.
- Status: `done`

### RF-004 ? P2 ? Split `markdown-cleanup-core` by transform family while preserving public API

- Scope files:
  - `src/core/markdown-cleanup-core.ts`
  - `src/core/markdown-cleanup-text-core.ts`
  - `src/core/markdown-cleanup-ai-core.ts`
  - `src/core/markdown-cleanup-block-core.ts`
  - `tests/markdown-cleanup-blocks.test.ts`
- Outcome:
  - `markdown-cleanup-core.ts` is now the stable public facade.
  - Text cleanup, AI cleanup, and block cleanup are separated into focused internal modules.
  - Public imports used by the plugin and tests remain unchanged.
- Status: `done`

## 3. Validation evidence

- Tests added or updated before implementation:
  - `tests/action-runner-loading.test.ts`
  - `tests/plugin-menu-registration.test.ts`
  - `tests/key-info-dock-controls.test.ts`
  - `tests/markdown-cleanup-blocks.test.ts`
- RF-001 targeted baseline:
  - `pnpm vitest run tests/action-runner-loading.test.ts tests/action-runner-block-transform.test.ts tests/plugin-actions.test.ts`
  - Result: pass (`3` files, `68` tests)
- RF-002 targeted baseline:
  - `pnpm vitest run tests/plugin-menu-registration.test.ts tests/plugin-actions.test.ts tests/plugin-doc-context.test.ts`
  - Result: pass (`3` files, `17` tests)
- RF-003 targeted baseline:
  - `pnpm vitest run tests/key-info-controller-state.test.ts tests/key-info-controller-doc-action.test.ts tests/key-info-dock-state.test.ts tests/key-info-dock-scroll-interaction.test.ts tests/key-info-dock-list-prefix.test.ts tests/key-info-dock-controls.test.ts`
  - Result: pass (`6` files, `42` tests)
- RF-004 targeted baseline:
  - `pnpm vitest run tests/markdown-cleanup-core.test.ts tests/markdown-cleanup-blocks.test.ts`
  - Result: pass (`2` files, `30` tests)
- Final full-suite validation:
  - `pnpm test`
  - Result: pass (`55` files, `333` tests)
- Additional validation:
  - `pnpm typecheck:strict`
  - Result: still blocked by a pre-existing strict-mode error in `src/core/punctuation-toggle-core.ts:55`

## 4. Documentation refresh result

- `docs/project-structure.md`
  - updated `src/`, `src/core/`, `src/plugin/`, `src/ui/`, and `tests/` file counts
  - updated the core/plugin/UI structure descriptions to reflect all completed refactors
  - added the new cleanup, lifecycle, action-runner, and key-info helper modules
- `README.md`
  - updated the development/documentation section to describe the final internal structure after all approved refactors

## 5. Progress tracking

| ID | Priority | Scope summary | Status |
| --- | --- | --- | --- |
| RF-001 | P0 | Thin `ActionRunner` shell + grouped handlers | `done` |
| RF-002 | P1 | Lifecycle persistence/menu composition extraction | `done` |
| RF-003 | P1 | Key-info dock/controller UI seam cleanup | `done` |
| RF-004 | P2 | `markdown-cleanup-core` internal split | `done` |

## 6. Completion

- Approved items completed: `RF-001`, `RF-002`, `RF-003`, `RF-004`
- Skipped items: none
- Remaining approved-plan items: none
