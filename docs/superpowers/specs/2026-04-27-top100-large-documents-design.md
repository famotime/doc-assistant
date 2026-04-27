# Top100 大文件清单设计

## 背景

在“文档处理-整理”分组中新增一个动作：`输出Top100大文件清单`。

该动作面向当前文档所在笔记本，统计该笔记本内全部文档的体积情况，并在当前笔记本的 Daily Note 父目录下新建一篇结果文档。结果文档内容为 Markdown 表格，便于在思源内直接查看、排序理解和点击跳转。

本次需求明确采用以下产品口径：

- 排序字段为 `文档大小`。
- `文档大小 = 文档本体大小 + 内嵌资源总大小`。
- 文件名列直接写为思源内部链接，点击后直接打开文档。
- 不再单独输出“文档链接”列。

## 目标

- 在 `organize` 分组新增可执行动作 `输出Top100大文件清单`。
- 统计当前笔记本全部文档的 Top 100 大文件。
- 结果文档创建位置复用“本月日记”的 Daily Note 路径解析方式，但创建在 Daily Note 文档的父目录下。
- 输出稳定、可读、可点击的 Markdown 表格。
- 对部分文档或资源读取失败保持容错，不因单个失败中断整份清单。

## 非目标

- 不新增设置项。
- 不修改现有“本月日记”行为。
- 不实现按目录、标签或当前路径过滤。
- 不做分页、二次排序切换或自定义条数。
- 不做额外 UI 面板，仅通过现有动作入口暴露能力。

## 用户体验

用户在任意文档中触发 `输出Top100大文件清单` 后，插件会：

1. 识别当前文档所在笔记本。
2. 扫描该笔记本全部文档。
3. 统计每篇文档的文档本体大小、内嵌资源大小和总大小。
4. 取总大小倒序的前 100 篇文档。
5. 在该笔记本 Daily Note 父目录下创建一篇新文档。
6. 通过消息提示输出结果，例如“已输出 Top100 大文件清单：<标题>（100 篇）”。

结果文档表格列固定为：

- `排名`
- `文件名`
- `文档大小`
- `文档本体`
- `内嵌资源`
- `资源数`
- `文档路径`

其中 `文件名` 列使用 Markdown 链接格式：

```md
[文档标题](siyuan://blocks/<docId>)
```

## 架构设计

### 1. `core`：纯逻辑层

新增 `src/core/large-documents-report-core.ts`，负责：

- 定义排名项类型。
- 格式化字节大小显示，例如 `12.3 MB`。
- 按 `文档大小` 倒序排序。
- 执行 Top100 截断。
- 生成最终 Markdown 表格。

该层不依赖思源 API，不访问文件系统，不做网络请求，保持可单元测试。

### 2. `service`：集成与数据采集层

新增 `src/services/large-documents-report.ts`，负责：

- 根据当前文档 ID 获取当前文档元信息与所属笔记本。
- 读取笔记本配置中的 `dailyNoteSavePath`。
- 通过 `renderSprigTemplate` 解析当前 Daily Note 路径，并取父目录作为结果文档目录。
- 列出当前笔记本全部文档元数据。
- 统计每篇文档的 `.sy` 文件体积。
- 查询每篇文档的内嵌资源列表。
- 统计资源大小并按文档聚合。
- 调用 `core` 生成 Markdown 表格。
- 调用 `createDocWithMd` 创建结果文档。

### 3. `plugin`：动作接入层

- 在 `src/plugin/actions.ts` 新增 action key，并归入 `organize`。
- 在 `src/plugin/action-runner-organize-handlers.ts` 接入 service。
- 保持 `ActionRunner` 主体结构不变，不新增平行动作分发方式。

## 数据来源与统计口径

### 文档范围

统计范围限定为当前文档所在笔记本下的全部文档，不限制目录层级。

### 文档本体大小

文档本体大小按文档 `.sy` 文件字节数统计。

路径组装规则与 `siyuan-network-lens` 参考实现保持一致：

- 文档元数据中的 `box` 作为笔记本标识。
- 文档元数据中的 `path` 作为文档路径。
- 拼接为 `/data/<box>/<path>` 读取文件内容或文件体积。

### 内嵌资源大小

内嵌资源统计方法参考 `D:\MyCodingProjects\siyuan-network-lens\src\analytics\large-documents.ts` 的“大文件·资源”实现，采用以下规则：

- 通过文档资源接口获取当前文档关联资源列表。
- 将资源路径标准化为统一形式，例如 `assets/...`。
- 同一篇文档内重复引用同一路径的资源只统计一次。
- 对每个资源路径读取体积并累加为该文档的 `内嵌资源`。

### 排序规则

按以下优先级排序：

1. `文档大小` 倒序
2. `updated` 倒序
3. 标题按中文 locale 排序

其中：

- `文档大小 = 文档本体 + 内嵌资源`

### Top100 截断

- 默认输出前 100 项。
- 若当前笔记本文档不足 100 篇，则全部输出。

## 文档创建规则

结果文档创建逻辑复用“本月日记”的路径解析思路：

1. 读取当前笔记本 `dailyNoteSavePath`。
2. 用 `renderSprigTemplate` 渲染出当天日记路径。
3. 取该路径父目录作为结果文档目录。
4. 在该目录下创建结果文档。

这意味着：

- 若 Daily Note 渲染为 `/daily note/2026/04/2026-04-27`
- 则结果文档创建到 `/daily note/2026/04/<结果标题>`

结果标题采用时间戳避免重名，建议格式：

- `Top100大文件清单-YYYYMMDD-HHmmss`

## Markdown 输出格式

结果文档以表格为主体，建议格式如下：

```md
# Top100大文件清单

当前笔记本：<notebook>
统计口径：文档大小 = 文档本体 + 内嵌资源
生成时间：2026-04-27 15:30:15

| 排名 | 文件名 | 文档大小 | 文档本体 | 内嵌资源 | 资源数 | 文档路径 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | [示例文档](siyuan://blocks/20260427153015-abcdefg) | 12.3 MB | 1.1 MB | 11.2 MB | 8 | /项目/示例文档 |
```

说明：

- `文件名` 为可点击内部链接。
- `文档路径` 使用文档 `hPath`，便于辨认位置。
- 表头前增加简短说明，帮助用户理解排序口径。

## 内核接口设计

优先复用现有能力；若现有 `kernel` 未暴露所需接口，则新增最小能力，不引入大范围重构。

本次可能需要的能力包括：

- 获取当前笔记本全部文档元数据。
- 获取文档资源列表。
- 获取资源体积。
- 获取文档文件内容或文件体积。

接口新增原则：

- 尽量沿用现有 `kernel.ts` 聚合导出方式。
- 若某能力已有底层 API 封装，则优先补导出而不是重写实现。
- 若新增 API 封装，命名保持与现有 `kernel-*` 模块风格一致。

## 错误处理

### 直接失败

以下场景直接中止并抛出可读错误：

- 当前文档不存在或无法解析所属笔记本。
- 当前笔记本未配置 `Daily Note` 保存路径。
- `dailyNoteSavePath` 渲染后为空。
- 最终结果文档创建失败。

错误文案风格与现有“本月日记”保持一致。

### 容错继续

以下场景不应中止整份清单：

- 单篇文档 `.sy` 文件读取失败。
- 单篇文档资源列表读取失败。
- 某个资源体积读取失败。

处理方式：

- 失败部分按 `0` 处理。
- 继续统计其他文档。
- 保证最终报告仍可生成。

## 测试设计

### 1. `core` 单测

新增 `tests/large-documents-report-core.test.ts`，覆盖：

- 字节格式化输出。
- 按总大小排序。
- 相同大小时按更新时间和标题稳定排序。
- Top100 截断。
- Markdown 表格生成。
- `文件名` 列输出为思源内部链接。

### 2. `service` 单测

新增 `tests/large-documents-report-service.test.ts`，通过 mock 内核接口覆盖：

- 在 Daily Note 父目录下创建结果文档。
- 正确累计 `文档本体 + 内嵌资源`。
- 对重复资源去重。
- 对部分资源或文档读取失败继续输出。
- 未配置 Daily Note 路径时报错。

### 3. 动作接入测试

补充现有测试，覆盖：

- action key 已注册。
- action 分组为 `organize`。
- action runner 调用新 service。
- 执行成功后显示成功消息。

## 受影响文件

预计新增或修改以下文件：

- `src/core/large-documents-report-core.ts`
- `src/services/large-documents-report.ts`
- `src/plugin/actions.ts`
- `src/plugin/action-runner-organize-handlers.ts`
- `src/services/kernel.ts`
- 必要时对应的 `kernel-*` 模块
- `tests/large-documents-report-core.test.ts`
- `tests/large-documents-report-service.test.ts`
- `tests/action-runner-loading.test.ts`
- `tests/actions-grouping.test.ts`
- `tests/plugin-actions.test.ts`
- `docs/project-structure.md`
- `docs/public-command-configuration.md`

## 范围控制与后续演进

本次实现只交付固定的 Top100 报告能力，保持最小闭环。

若后续需要扩展，可在不破坏本次结构的前提下追加：

- 自定义条数
- 自定义排序口径
- 按路径范围过滤
- 按资源体积单独排序
- 输出 CSV 或其他报表格式
