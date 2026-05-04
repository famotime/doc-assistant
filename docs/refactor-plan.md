# 重构计划

## 1. 项目快照

- 生成日期：2026-05-04
- 范围：`siyuan-doc-assist` 当前主仓库
- 目标：基于上一轮已完成的拆分结果，继续收敛剩余高复杂度编排层，优先降低组合根、关键内容控制器和 kernel 聚合层的耦合与回归面
- 文档刷新目标：`docs/project-structure.md`、`README.md`
- 计划基线：本文件覆盖上一轮计划，上一轮已完成项视为当前仓库基线，不在本轮重复执行

## 2. 架构与模块分析

| 模块 | 关键文件 | 当前职责 | 主要痛点 | 测试覆盖情况 |
| --- | --- | --- | --- | --- |
| 入口与生命周期组合根 | `src/index.ts`、`src/plugin/plugin-lifecycle.ts`、`src/plugin/plugin-lifecycle-state.ts`、`src/plugin/plugin-lifecycle-menu.ts` | 插件启动、状态装载与持久化、Dock/命令注册、标题菜单接入、页签放置策略、对外 provider 暴露 | `plugin-lifecycle.ts` 仍约 584 行，状态突变、事件响应、设置页装配、Dock 协调、页签放置重试逻辑和外部集成都在一个类中，后续新增运行时能力时回归面较大 | `tests/plugin-menu-registration.test.ts`、`tests/plugin-tab-placement.test.ts`、`tests/plugin-lifecycle-state.test.ts` |
| 关键内容侧栏编排 | `src/plugin/key-info-controller.ts`、`src/plugin/key-info-controller-dock.ts`、`src/services/key-info.ts`、`src/ui/key-info-dock.ts` | Dock 注册、关键内容刷新、只读状态同步、文档动作桥接、滚动定位、导出 Markdown | `key-info-controller.ts` 同时承担异步请求竞态控制、Dock 状态投影、点击跳转与下载副作用；刷新失败和销毁时序虽已有测试，但逻辑仍集中在单控制器中 | `tests/key-info-controller-doc-action.test.ts`、`tests/key-info-controller-state.test.ts`、`tests/key-info-dock-scroll-interaction.test.ts`、`tests/key-info-dock-state.test.ts` |
| Kernel 聚合与文档查询层 | `src/services/kernel.ts`、`src/services/kernel-*.ts` | 统一导出 block/file/ref/network API，并承接文档元信息 SQL、子文档查询、`.sy` 树顺序解析等高层查询 | `kernel.ts` 约 488 行，barrel re-export 与具体查询实现混放；SQL 查询、路径归一化、`.sy` 树读取混在一起，后续扩展文档查询时边界不够清晰 | `tests/kernel-list-notebook-docs.test.ts`、`tests/kernel-child-docs.test.ts`、`tests/kernel-map-root.test.ts`、`tests/kernel-list-docs-subtree.test.ts`、`tests/kernel-conf.test.ts` |
| 动作元数据定义 | `src/plugin/actions.ts` | 声明命令 key、分组、文案、提示、Dock 图标文本等元数据 | 文件约 692 行，主要是静态配置；维护成本存在，但行为逻辑简单，风险低于前三项，更适合作为清理型重构 | `tests/plugin-actions.test.ts`、`tests/actions-grouping.test.ts` |
| 插件状态标准化 | `src/plugin/plugin-lifecycle-state.ts` | 菜单注册、收藏动作、关键内容筛选、AI 配置、月记模板的默认值、归一化和序列化 | 文件体量可控，边界相对明确；当前主要风险不在状态纯函数，而在 `plugin-lifecycle.ts` 中对这些状态的读写编排 | `tests/plugin-lifecycle-state.test.ts` |

## 3. 按优先级排序的重构待办

| ID | 优先级 | 模块/场景 | 涉及文件 | 重构目标 | 行为不变式 | 风险等级 | 重构前测试清单 | 文档影响 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RF-201 | P0 | `plugin-lifecycle` 组合根继续瘦身，拆分运行时协调职责 | `src/plugin/plugin-lifecycle.ts`；新增 `src/plugin/plugin-pinned-tab-manager.ts`；相关测试 `tests/plugin-menu-registration.test.ts`、`tests/plugin-tab-placement.test.ts`、`tests/plugin-lifecycle-state.test.ts`、`tests/plugin-pinned-tab-manager.test.ts` | 让 `plugin-lifecycle.ts` 主要保留 SiYuan 插件生命周期入口与依赖装配，把页签放置、菜单/命令刷新协作、状态变更后的副作用同步进一步下沉到专门模块 | `onload` / `onunload` / `openSetting` / `getPowerButtonsIntegration` 对外行为保持不变；`doc-menu-registration` 存储结构保持兼容；标题菜单、命令注册顺序、Dock 初始化、页签重排与重试策略、忙碌遮罩时机保持一致 | 高 | - [x] `pnpm vitest run tests/plugin-pinned-tab-manager.test.ts tests/plugin-tab-placement.test.ts tests/plugin-menu-registration.test.ts tests/plugin-lifecycle-state.test.ts`<br>- [x] 覆盖菜单状态恢复、命令注册顺序、收藏动作持久化、power-buttons provider 暴露<br>- [x] 覆盖页签重排、重试、保持钉住页签可见等回归场景 | `docs/project-structure.md` 需补充新的 lifecycle 协调模块；`README.md` 仅在开发结构说明受影响时同步 | done |
| RF-202 | P1 | `key-info-controller` 拆分刷新/只读状态同步与跳转副作用 | `src/plugin/key-info-controller.ts`；新增 `src/plugin/key-info-navigation.ts`、`src/plugin/key-info-controller-refresh.ts`；相关测试 `tests/key-info-controller-doc-action.test.ts`、`tests/key-info-controller-state.test.ts`、`tests/key-info-dock-scroll-interaction.test.ts`、`tests/key-info-controller-refresh.test.ts`、`tests/key-info-navigation.test.ts` | 让控制器收敛为 Dock 装配与回调入口，把刷新流程、请求竞态控制、只读态同步、块跳转/高亮/下载副作用拆成可单测模块 | Dock UI 结构、过滤器持久化、文档动作透传参数、只读态禁用逻辑、平滑滚动与协议跳转兜底、导出文件命名规则保持不变 | 中 | - [x] `pnpm vitest run tests/key-info-navigation.test.ts tests/key-info-controller-refresh.test.ts tests/key-info-controller-doc-action.test.ts tests/key-info-controller-state.test.ts tests/key-info-dock-scroll-interaction.test.ts tests/key-info-dock-state.test.ts`<br>- [x] 覆盖刷新失败后销毁、筛选器恢复、只读状态切换、收藏动作拖拽排序<br>- [x] 覆盖块内定位成功与协议跳转兜底场景 | `docs/project-structure.md` 需补充 key-info 控制器 helper；`README.md` 正常情况下只做最小同步 | done |
| RF-203 | P1 | `kernel.ts` 拆分文档查询实现与公共导出层 | `src/services/kernel.ts`；新增 `src/services/kernel-doc-query.ts`；相关测试 `tests/kernel-list-notebook-docs.test.ts`、`tests/kernel-child-docs.test.ts`、`tests/kernel-map-root.test.ts`、`tests/kernel-list-docs-subtree.test.ts`、`tests/kernel-conf.test.ts`、`tests/kernel-doc-query-service.test.ts` | 保留 `@/services/kernel` 作为稳定公共入口，同时把文档元信息 SQL、子文档查询、`.sy` 树顺序解析从 barrel 文件移出，建立更清晰的查询边界 | `@/services/kernel` 的现有导出名与调用方式保持兼容；文档标题提取、路径归一化、直接子文档过滤、根文档 ID 回退、分页 SQL 行为保持不变 | 中 | - [x] `pnpm vitest run tests/kernel-doc-query-service.test.ts tests/kernel-sy-order.test.ts tests/kernel-list-notebook-docs.test.ts tests/kernel-child-docs.test.ts tests/kernel-map-root.test.ts tests/kernel-list-docs-subtree.test.ts tests/kernel-conf.test.ts`<br>- [x] 覆盖分页读取、直接子文档过滤、空 `root_id` 回退、notebook 配置读取与 `.sy` 顺序解析场景 | `docs/project-structure.md` 需更新 kernel 查询层职责映射；`README.md` 仅在内部结构说明发生变化时同步 | done |
| RF-204 | P2 | `actions.ts` 静态元数据按分组拆分 | `src/plugin/actions.ts`；新增 `src/plugin/action-definitions.ts`；相关测试 `tests/plugin-actions.test.ts`、`tests/actions-grouping.test.ts`、`tests/action-definitions.test.ts` | 降低新增命令时对超长静态配置文件的编辑摩擦，让导出/整理/插入/编辑/图片等动作定义按分组组织 | 所有 `ActionKey`、分组、命令文案、菜单文案、tooltip、Dock 图标文本、默认排序与隐藏配置联动保持不变 | 低 | - [x] `pnpm vitest run tests/action-definitions.test.ts tests/plugin-actions.test.ts tests/actions-grouping.test.ts`<br>- [x] 覆盖 action key 唯一性、分组一致性、文案约束与 alpha 隐藏行为相关回归 | `docs/project-structure.md` 需补充动作定义拆分方式；`README.md` 通常无需用户可见更新 | done |

优先级说明：
- `P0`：价值和风险都最高，优先执行
- `P1`：价值或风险中等，放在 `P0` 之后
- `P2`：低风险清理项，最后执行

状态说明：
- `pending`
- `in_progress`
- `done`
- `blocked`

## 4. 执行日志

| ID | 开始日期 | 结束日期 | 验证命令 | 结果 | 已刷新文档 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| RF-201 | 2026-05-04 | 2026-05-04 | `pnpm vitest run tests/plugin-pinned-tab-manager.test.ts tests/plugin-tab-placement.test.ts tests/plugin-menu-registration.test.ts tests/plugin-lifecycle-state.test.ts`；`pnpm test` | pass | 待定 | 新增 `plugin-pinned-tab-manager` 与 3 条定向单测；`plugin-lifecycle.ts` 不再内嵌页签放置状态、重试与已知页签追踪逻辑 |
| RF-202 | 2026-05-04 | 2026-05-04 | `pnpm vitest run tests/key-info-navigation.test.ts tests/key-info-controller-refresh.test.ts tests/key-info-controller-doc-action.test.ts tests/key-info-controller-state.test.ts tests/key-info-dock-scroll-interaction.test.ts tests/key-info-dock-state.test.ts`；`pnpm test` | pass | 待定 | 新增导航与刷新纯函数测试 8 条；`key-info-controller.ts` 已抽离块跳转/协议打开/闪烁逻辑与刷新状态投影 helper |
| RF-203 | 2026-05-04 | 2026-05-04 | `pnpm vitest run tests/kernel-doc-query-service.test.ts tests/kernel-sy-order.test.ts tests/kernel-list-notebook-docs.test.ts tests/kernel-child-docs.test.ts tests/kernel-map-root.test.ts tests/kernel-list-docs-subtree.test.ts tests/kernel-conf.test.ts`；`pnpm test` | pass | 待定 | 新增 `kernel-doc-query` 纯函数测试 5 条；`kernel.ts` 已收敛为稳定公共出口，文档查询与 `.sy` 顺序逻辑迁至专门模块 |
| RF-204 | 2026-05-04 | 2026-05-04 | `pnpm vitest run tests/action-definitions.test.ts tests/plugin-actions.test.ts tests/actions-grouping.test.ts`；`pnpm test` | pass | 待定 | 新增 grouped definitions 结构测试 2 条；`actions.ts` 已收敛为公共聚合出口，按组静态定义迁至 `action-definitions.ts` |

## 5. 决策与确认

- 用户批准的条目：
  - `RF-201`
  - `RF-202`
  - `RF-203`
  - `RF-204`
- 延后的条目：
- 阻塞条目及原因：

## 6. 文档刷新

- `docs/project-structure.md`：已于 `2026-05-04` 刷新，补充 `plugin-pinned-tab-manager`、`key-info-navigation`、`key-info-controller-refresh`、`kernel-doc-query`、`action-definitions` 等模块，并同步最新文件/测试统计
- `README.md`：已于 `2026-05-04` 刷新，补充当前开发命令与最新内部结构边界说明
- 最终同步检查：4 个获批条目均已完成，结构文档、README 与当前仓库状态已同步

## 7. 下一步

1. 本轮已完成，后续可基于新的模块边界继续评估下一轮候选项。
2. 若继续拆分运行时模块，保持 `docs/refactor-plan.md`、`docs/project-structure.md` 与 `README.md` 同步更新。
