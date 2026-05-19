# 重构计划

## 1. 项目快照

- 生成日期：2026-05-19
- 范围：`siyuan-doc-assist` 当前主仓库
- 目标：在上一轮模块拆分完成后的新基线上，继续收敛动作执行、AI 文档变更、选区处理、Key-info 模型与 Dock UI 的高复杂度区域，优先为文档变更路径补足测试后再拆分实现
- 当前基线观察：工作区干净；`package.json` 版本为 `1.5.5`；当前 `src/` 约 119 个 TypeScript 文件，`tests/` 约 91 个 Vitest 文件
- 计划边界：本文件只制定下一轮候选项；开始实施任何条目前需用户明确批准具体 ID

## 2. 架构与模块分析

| 模块 | 关键文件 | 当前职责 | 主要痛点 | 测试覆盖情况 |
| --- | --- | --- | --- | --- |
| 入口与生命周期组合根 | `src/index.ts`、`src/plugin/plugin-lifecycle.ts`、`src/plugin/plugin-lifecycle-state.ts`、`src/plugin/plugin-lifecycle-menu.ts`、`src/plugin/plugin-pinned-tab-manager.ts` | 插件加载、事件绑定、设置页装配、持久化状态、确认弹窗、Dock/命令注册、`power-buttons` provider 暴露 | 上一轮已拆出页签协调等模块，但 `plugin-lifecycle.ts` 仍约 490 行；确认详情弹窗 HTML、设置页创建、状态变更后的 Dock 同步仍集中在组合根 | `tests/plugin-menu-registration.test.ts`、`tests/plugin-tab-placement.test.ts`、`tests/plugin-lifecycle-state.test.ts`、`tests/plugin-settings.test.ts`、`tests/power-buttons-provider.test.ts` |
| 动作执行外壳与清理/删除主流程 | `src/plugin/action-runner.ts`、`src/plugin/action-runner-cleanup-handlers.ts`、`src/plugin/action-runner-dispatcher.ts`、`src/core/markdown-cleanup-*` | `ActionKey` 执行入口、运行态/后台态守卫、只读校验、确认弹窗协调、行尾空格清理、从当前/从文首删除流程 | `action-runner.ts` 仍约 708 行，执行外壳和高风险 Markdown 写入重试/验证逻辑混在一起；行尾空格路径有批量 kramdown、DOM fallback、重试、日志与提示，回归面高 | `tests/action-runner-loading.test.ts` 覆盖大量流程；`tests/markdown-cleanup-*.test.ts` 覆盖纯清理规则；缺少针对抽离后 handler 的小粒度测试 |
| AI 动作处理器 | `src/plugin/action-runner-ai-handlers.ts`、`src/services/ai-summary.ts`、`src/services/ai-slop-marker.ts`、`src/services/ai-image-ocr.ts`、`src/services/ai-paragraph-translation.ts`、`src/services/network-lens-ai-index.ts` | AI 摘要/概念地图、口水内容删除线标记、关键内容加粗、图片 OCR、逐段翻译、相关链接与标签、LLM wiki 占位入口 | `action-runner-ai-handlers.ts` 约 1042 行，8 个动作与大量纯解析/Markdown 标记 helper 同处一文件；AI 返回归一化、预览确认、属性合并、块更新副作用耦合，近期功能增长后最容易继续膨胀 | `tests/action-runner-loading.test.ts` 覆盖 AI action 集成路径；`tests/ai-*-service.test.ts` 覆盖服务层；缺少 `action-runner-ai-*` 拆分后的专门 handler/core 测试 |
| 选区/选中块动作处理器 | `src/plugin/action-runner-selection-handlers.ts`、`src/core/selected-block-style-toggle-core.ts`、`src/core/list-block-merge-core.ts`、`src/core/punctuation-toggle-core.ts` | 选中块加粗/高亮、去空格、标点互转、换行/分段互转、列表块合并，并兼容 DOM 选区和 kramdown fallback | 文件约 845 行；DOM Range 处理、文本节点改写、kramdown fallback、确认文案、批量更新在一个工厂函数里；部分逻辑已有 core，但选区输入归一化和更新计划仍不够独立 | `tests/action-runner-loading.test.ts` 覆盖选区集成场景；`tests/*style*`、`tests/list-block-merge-core.test.ts`、`tests/punctuation-toggle-core.test.ts` 覆盖部分纯逻辑；缺少 linebreak/selection DOM helper 的独立测试 |
| Key-info 数据模型与抽取 | `src/core/key-info-core.ts`、`src/services/key-info-model.ts`、`src/services/key-info-inline.ts`、`src/services/key-info-pipeline.ts`、`src/services/key-info-collectors.ts`、`src/services/key-info.ts` | Markdown/SQL/DOM 来源的标题、格式、标签、链接、备注、代码等关键内容抽取、归一化、去重、排序与渲染 | `key-info-model.ts` 约 479 行，HTML entity 解码、链接剥离、代码片段提取、span type 判定、备注解析混杂；`key-info-core.ts` 也包含 Markdown masking 和 regex 抽取，边界容易重复 | `tests/key-info-*.test.ts` 覆盖服务、pipeline、inline、dock 行为；模型函数多为间接覆盖，拆分前需要补直接测试以锁定边界文本处理 |
| Key-info Dock 文档动作 UI | `src/ui/key-info-dock.ts`、`src/ui/key-info-dock-doc-actions.ts`、`src/ui/key-info-dock-controls.ts`、`src/core/dock-doc-action-order-core.ts`、`src/core/dock-panel-core.ts` | Dock 面板、过滤器、文档动作分组、收藏、拖拽排序、后台运行态与列表渲染 | `key-info-dock-doc-actions.ts` 约 660 行，拖拽排序、折叠组状态、图标渲染、搜索/收藏/按钮事件都在单个 render 函数附近；DOM 测试较重，后续 UI 调整成本高 | `tests/key-info-dock-*.test.ts`、`tests/dock-doc-action-order-core.test.ts`、`tests/dock-panel-core.test.ts` 覆盖主要交互；拖拽/过滤模型可进一步用纯函数测试减轻 DOM 回归面 |
| Kernel 与服务适配层 | `src/services/kernel.ts`、`src/services/kernel-*.ts`、`src/services/exporter*.ts`、`src/services/link-resolver.ts`、`src/services/large-documents-report.ts` | SiYuan Kernel API、文件/块/引用/网络、导出、链接解析与大文档报告 | 上一轮已将文档查询拆到 `kernel-doc-query.ts`；当前边界相对清晰。后续主要风险在高层服务编排而非 barrel 出口 | `tests/kernel-*.test.ts`、`tests/exporter-*.test.ts`、`tests/link-resolver-*.test.ts` 覆盖较完整，本轮暂不作为高优先级 |
| 样式入口 | `src/index.scss` | 去重对话框、设置页、Key-info Dock、处理遮罩、确认详情弹窗等所有样式 | 单文件约 1863 行，多个功能区样式混在一起，且部分选择器有重复增强段；视觉回归难靠单测发现，适合作为低风险、低优先级的结构清理 | 缺少视觉快照测试；可用 `pnpm build`、相关 DOM 测试与人工截图验证作为最低保障 |
| 现有测试结构 | `tests/action-runner-loading.test.ts`、`tests/key-info-service-heading-inline.test.ts` 等 | 大量 Vitest 单测/准集成测试 | `tests/action-runner-loading.test.ts` 约 3284 行，承载过多 action runner 场景；重构时应同步拆出更聚焦的测试文件，降低单文件维护成本 | 全量 `pnpm test` 是最终门禁；每项需先跑对应定向测试，再跑全量测试 |

## 3. 按优先级排序的重构待办

| ID | 优先级 | 模块/场景 | 涉及文件 | 重构目标 | 行为不变式 | 风险等级 | 重构前测试清单 | 文档影响 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RF-301 | P0 | AI action handler 按能力拆分，并抽出纯更新/解析 helper | `src/plugin/action-runner-ai-handlers.ts`；拟新增 `src/plugin/action-runner-ai-summary-handlers.ts`、`src/plugin/action-runner-ai-marker-handlers.ts`、`src/plugin/action-runner-ai-related-handlers.ts` 或等价小模块；可新增 `src/core/ai-marker-action-core.ts`、`src/core/ai-related-suggestions-core.ts`；相关测试 `tests/action-runner-ai-handlers.test.ts`、`tests/action-runner-loading.test.ts`、`tests/ai-*-service.test.ts` | 保留 `createAiActionHandlers` 公共入口，把摘要/概念地图、段落标记、图片 OCR/翻译、相关链接标签拆成独立 handler；将 AI payload 归一化、待更新块计划、确认详情构造等纯逻辑移到可单测模块 | `ActionKey`、提示文案语义、确认前后 busy 状态、自动确认 workflow 行为、AI 配置读取、Network Lens fallback、块更新顺序、标签合并、协议打开目标保持不变 | 高 | - [ ] 新增/迁移 AI handler 定向测试，覆盖摘要插入位置、概念地图子文档路径、口水内容片段标记、关键内容加粗、相关链接/标签选择写入、取消确认不写入<br>- [ ] `pnpm vitest run tests/action-runner-loading.test.ts tests/ai-summary-service.test.ts tests/ai-slop-marker-service.test.ts tests/ai-image-ocr-service.test.ts tests/ai-paragraph-translation-service.test.ts tests/network-lens-ai-index.test.ts`<br>- [ ] 抽离后再运行同一组测试和 `pnpm test` | `docs/project-structure.md` 需记录新的 AI handler/core 模块 | done |
| RF-302 | P0 | `action-runner.ts` 瘦身：行尾空格清理与前后段落删除 handler 外移 | `src/plugin/action-runner.ts`；拟新增 `src/plugin/action-runner-trim-handlers.ts`、`src/plugin/action-runner-delete-range-handlers.ts` 或并入 cleanup handler；可能新增 `src/core/trailing-whitespace-update-core.ts`；相关测试 `tests/action-runner-cleanup-handlers.test.ts`、`tests/action-runner-loading.test.ts`、`tests/markdown-cleanup-*.test.ts` | 让 `ActionRunner` 只保留运行态守卫、只读校验、后台任务、确认桥接与 dispatch；将行尾空格扫描/高风险判断/DOM fallback/重试验证、从当前到末尾/从文首到当前删除移出 | `runAction` 返回结构、`setBusy` 时机、后台任务互斥、只读文档提示、行尾空格高风险跳过策略、kramdown 与 DOM 写入 fallback、重试次数/延迟语义、删除范围与嵌套块映射保持不变 | 高 | - [ ] 为行尾空格更新计划新增小粒度测试：普通 markdown、含 block IAL、含备注/引用高风险 DOM fallback、无变化、验证仍脏的日志摘要<br>- [ ] 为删除范围新增 handler 测试：当前块缺失、嵌套块映射、删除失败提示、用户取消不删除<br>- [ ] `pnpm vitest run tests/action-runner-loading.test.ts tests/markdown-cleanup-core.test.ts tests/markdown-cleanup-blocks.test.ts`<br>- [ ] 抽离后再运行同一组测试和 `pnpm test` | `docs/project-structure.md` 需更新 action runner helper 职责 | done |
| RF-303 | P1 | 选区动作处理器拆分 DOM selection 与 kramdown fallback | `src/plugin/action-runner-selection-handlers.ts`；拟新增 `src/plugin/action-runner-selection-style-handlers.ts`、`src/plugin/action-runner-selection-text-handlers.ts`、`src/plugin/action-runner-selection-structure-handlers.ts` 或等价模块；可能新增 `src/core/selection-text-transform-core.ts`、`src/core/linebreak-toggle-core.ts` | 将选中块样式、选区文本清理/标点、换行分段互转、列表合并拆分；把“选区输入 -> 更新计划 -> 执行结果摘要”做成纯函数或小 handler，降低 DOM 测试耦合 | 显式选中块优先于普通选区、DOM 直接改写成功时不走 kramdown fallback、标点模式检测、行/段互转确认内容、列表合并删除顺序、失败/跳过提示保持不变 | 中 | - [ ] 新增 linebreak/selection text core 测试：单块局部选区、多块选中、无选区、读取失败、更新失败、中文/英文标点模式<br>- [ ] `pnpm vitest run tests/action-runner-loading.test.ts tests/punctuation-toggle-core.test.ts tests/selected-block-style-toggle-core.test.ts tests/list-block-merge-core.test.ts`<br>- [ ] 抽离后再运行同一组测试和 `pnpm test` | `docs/project-structure.md` 需记录新的 selection handler/core 模块 | done |
| RF-304 | P1 | Key-info model 拆分文本归一化、span 判定与备注/代码解析 | `src/services/key-info-model.ts`、`src/core/key-info-core.ts`；拟新增 `src/services/key-info-text-normalize.ts`、`src/services/key-info-span-format.ts`、`src/services/key-info-remark-model.ts` 或等价模块；相关测试 `tests/key-info-model.test.ts`、`tests/key-info-inline.test.ts`、`tests/key-info-pipeline.test.ts` | 将 HTML/Markdown 可见文本归一化、链接/代码剥离、span type + IAL 判定、备注解析拆成边界明确的模型模块；保留服务层导出兼容 | Key-info 类型识别、标签去重顺序、备注文本格式、内联代码高亮识别、链接可见文本、list prefix 展示、SQL literal escape 与 chunk 行为保持不变 | 中 | - [ ] 新增 `tests/key-info-model.test.ts` 直接覆盖 `normalizeInlineVisibleText`、`extractHighlightInlineCodeTexts`、`resolveSpanFormatType`、`parseRemarkText`、`extractInlineMemoHint` 等边界<br>- [ ] `pnpm vitest run tests/key-info-model.test.ts tests/key-info-inline.test.ts tests/key-info-pipeline.test.ts tests/key-info-service-heading-inline.test.ts tests/key-info-service-list-prefix.test.ts tests/key-info-core.test.ts`<br>- [ ] 抽离后再运行同一组测试和 `pnpm test` | `docs/project-structure.md` 需更新 Key-info 服务模型职责 | done |
| RF-305 | P1 | Key-info Dock 文档动作 UI 拆分渲染、拖拽和收藏模型 | `src/ui/key-info-dock-doc-actions.ts`、`src/ui/key-info-dock.ts`、`src/core/dock-doc-action-order-core.ts`；拟新增 `src/ui/key-info-dock-action-groups.ts`、`src/ui/key-info-dock-action-row.ts` 或 `src/core/dock-doc-action-drag-core.ts` | 从 660 行 render 模块中抽出拖拽 reorder/insert-before 判定、分组折叠状态、图标节点创建和行渲染；让 UI 层更多调用可测试模型 | 收藏动作排序、拖拽 drop-before/drop-after 行为、折叠状态保留、搜索过滤、禁用态/后台运行态、SVG 图标 fallback、空收藏提示保持不变 | 中 | - [ ] 新增纯函数测试覆盖 favorite reorder、insert-before 判定、分组 label 计数/折叠状态<br>- [ ] `pnpm vitest run tests/key-info-dock-controls.test.ts tests/key-info-dock-state.test.ts tests/key-info-dock-scroll-interaction.test.ts tests/dock-doc-action-order-core.test.ts tests/dock-panel-core.test.ts`<br>- [ ] 抽离后再运行同一组测试和 `pnpm test` | `docs/project-structure.md` 需更新 UI 模块清单 | done |
| RF-306 | P2 | 生命周期确认详情弹窗下沉到 UI 模块 | `src/plugin/plugin-lifecycle.ts`；拟新增 `src/ui/confirm-detail-dialog.ts`；相关测试 `tests/plugin-confirm-detail-dialog.test.ts`、`tests/plugin-menu-registration.test.ts` | 将带详情/可选择项的确认弹窗 HTML、转义和按钮事件从组合根移出，使 lifecycle 只保留依赖装配和回调 | 普通 `confirm()` 路径不变；详情项 HTML 转义、`selected` 回写、确认/取消 resolve 值、按钮文案和宽度保持不变 | 低 | - [ ] 补/迁移 `confirm-detail-dialog` 测试：HTML 转义、可选项默认勾选、取消不改写、确认回写 selected<br>- [ ] `pnpm vitest run tests/plugin-confirm-detail-dialog.test.ts tests/plugin-menu-registration.test.ts tests/plugin-settings.test.ts`<br>- [ ] 抽离后再运行同一组测试和 `pnpm test` | `docs/project-structure.md` 需新增确认详情 UI helper | done |
| RF-307 | P2 | `src/index.scss` 按功能区拆分并同步结构文档 | `src/index.scss`；拟新增 `src/styles/dedupe.scss`、`src/styles/settings.scss`、`src/styles/key-info.scss`、`src/styles/action-processing.scss`、`src/styles/confirm-detail.scss` 或等价 partial；`src/index.ts` 或 `src/index.scss` 保持统一入口 | 降低样式单文件维护成本，按 UI 模块组织样式；保持构建入口和 class 名不变 | 所有现有 class/selector 名称、动画名、响应式规则、颜色/间距语义、主题变量引用保持不变；`src/index.ts` 仍加载一个稳定样式入口或等价 imports | 低 | - [ ] 拆分前记录样式分区，确保没有 selector 丢失<br>- [ ] `pnpm vitest run tests/action-processing-overlay.test.ts tests/plugin-settings.test.ts tests/key-info-dock-controls.test.ts tests/key-info-dock-scroll-interaction.test.ts`<br>- [ ] 抽离后运行同一组测试、`pnpm build` 和 `pnpm test` | `docs/project-structure.md` 必须同步样式目录；可顺便刷新版本/文件统计 | done |

优先级说明：
- `P0`：文档变更路径复杂、风险高且近期增长快；执行时必须先补定向测试
- `P1`：中等风险或中等维护价值；在 P0 完成并稳定后执行
- `P2`：低风险结构清理和文档/样式维护；最后执行

状态说明：
- `pending`：尚未开始
- `in_progress`：已获批并正在执行
- `done`：已完成代码、测试与文档同步
- `blocked`：因测试基线、需求不清或外部依赖阻塞

## 4. 执行日志

| ID | 开始日期 | 结束日期 | 验证命令 | 结果 | 已刷新文档 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| RF-301 | 2026-05-19 | 2026-05-19 | `corepack pnpm vitest run tests/ai-marker-action-core.test.ts tests/ai-related-suggestions-core.test.ts tests/ai-summary-service.test.ts tests/ai-slop-marker-service.test.ts tests/ai-image-ocr-service.test.ts tests/ai-paragraph-translation-service.test.ts tests/network-lens-ai-index.test.ts tests/action-runner-loading.test.ts` | pass | `docs/project-structure.md`、`AGENTS.md`、`CLAUDE.md` | AI handler 拆分为 summary / marker / media / related / wiki 小模块，并新增纯逻辑核心测试 |
| RF-302 | 2026-05-19 | 2026-05-19 | `corepack pnpm vitest run tests/markdown-cleanup-core.test.ts tests/markdown-cleanup-blocks.test.ts tests/action-runner-loading.test.ts` | pass | `docs/project-structure.md`、`AGENTS.md`、`CLAUDE.md` | 新增 trim 与 delete-range handlers；`action-runner.ts` 仅保留执行壳和 handler 聚合 |
| RF-303 | 2026-05-19 | 2026-05-19 | `corepack pnpm vitest run tests/selection-text-transform-core.test.ts tests/punctuation-toggle-core.test.ts tests/selected-block-style-toggle-core.test.ts tests/list-block-merge-core.test.ts tests/action-runner-loading.test.ts` | pass | `docs/project-structure.md`、`AGENTS.md`、`CLAUDE.md` | 新增 selection text transform core 并将换行/标点/空格计划逻辑下沉；保留 DOM 局部选区行为 |
| RF-304 | 2026-05-19 | 2026-05-19 | `corepack pnpm vitest run tests/key-info-model.test.ts tests/key-info-inline.test.ts tests/key-info-pipeline.test.ts tests/key-info-service-heading-inline.test.ts tests/key-info-service-list-prefix.test.ts tests/key-info-core.test.ts` | pass | `docs/project-structure.md`、`AGENTS.md`、`CLAUDE.md` | 拆出 key-info 文本归一化、span 判定、备注模型模块并新增 model 定向测试 |
| RF-305 | 2026-05-19 | 2026-05-19 | `corepack pnpm vitest run tests/dock-doc-action-drag-core.test.ts tests/key-info-dock-controls.test.ts tests/key-info-dock-state.test.ts tests/key-info-dock-scroll-interaction.test.ts tests/dock-doc-action-order-core.test.ts tests/dock-panel-core.test.ts` | pass | `docs/project-structure.md`、`AGENTS.md`、`CLAUDE.md` | 抽出 Dock 文档动作拖拽几何与收藏重排核心，并新增定向测试 |
| RF-306 | 2026-05-19 | 2026-05-19 | `corepack pnpm vitest run tests/plugin-confirm-detail-dialog.test.ts tests/plugin-menu-registration.test.ts tests/plugin-settings.test.ts` | pass | `docs/project-structure.md`、`AGENTS.md`、`CLAUDE.md` | 新增 `ui/confirm-detail-dialog`，生命周期组合根改为调用 UI helper |
| RF-307 | 2026-05-19 | 2026-05-19 | `corepack pnpm vitest run tests/action-processing-overlay.test.ts tests/plugin-settings.test.ts tests/key-info-dock-controls.test.ts tests/key-info-dock-scroll-interaction.test.ts`; `corepack pnpm build`; `corepack pnpm test` | pass | `docs/project-structure.md`、`AGENTS.md`、`CLAUDE.md` | `src/index.scss` 改为统一入口，样式拆分到 `src/styles/` 功能 partial |

## 5. 决策与确认

- 用户批准的条目：`RF-301`、`RF-302`、`RF-303`、`RF-304`、`RF-305`、`RF-306`、`RF-307`
- 延后的条目：
- 阻塞条目及原因：

## 6. 下一步

1. 本轮已获批条目 `RF-301` 至 `RF-307` 已全部完成。
2. `docs/project-structure.md`、`AGENTS.md` 与 `CLAUDE.md` 已按重构后的模块边界刷新。
3. 最终验证：`corepack pnpm test`，96 个测试文件、626 个用例通过。
