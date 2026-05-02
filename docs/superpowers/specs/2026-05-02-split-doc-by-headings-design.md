# 按标题拆分文档 — 设计文档

**日期:** 2026-05-02
**状态:** 待实现

## 概述

在文档处理-整理分类中新增"按标题拆分文档"命令。将文档根据其中出现的最高一级标题，拆分为多个子文档，并将原文档中已拆分的内容删除。

## 行为规则

1. **最高级标题**：扫描文档所有子块，找出所有标题块（h1–h6），取其中 `#` 数最少的级别作为拆分边界。例如文档中出现 h2 和 h3，则以 h2 为拆分边界。
2. **前置内容**：第一个最高级标题之前的非标题内容保留在原文档中，不拆分。
3. **子文档生成**：每个最高级标题及其下所有内容（直到下一个同级标题或文档末尾）拆成一个子文档，标题文本作为子文档标题。
4. **原文档清理**：被拆分的块从原文档中删除，不插入子文档链接。
5. **单节跳过**：若文档中最高级标题只有一个（即只有一个拆分段），跳过操作并提示用户。
6. **无标题跳过**：若文档中没有任何标题块，跳过操作并提示用户。

## 架构

### 文件结构

```
src/core/split-doc-by-headings-core.ts   ← 纯逻辑：输入 ChildBlockMeta[]，输出 SplitDocResult
src/services/split-doc-by-headings.ts    ← 服务层：调用 kernel API 完成拆分
tests/split-doc-by-headings-core.test.ts ← 单元测试
```

### 修改文件

```
src/plugin/actions.ts                    ← 新增 ActionKey、ActionConfig、dockIconText
src/plugin/action-runner-organize-handlers.ts ← 新增 handler
```

---

## 核心逻辑：`splitDocByHeadingsCore`

### 类型定义

```typescript
type SplitSection = {
  title: string       // 标题文本（去除 #、** 等标记）
  blockIds: string[]  // 该段包含的所有块 ID（标题 + 内容）
  markdown: string    // 重组后的 markdown 内容
}

type SplitDocResult = {
  highestLevel: number          // 最高级标题的 # 数（如 h2 → 2）
  sections: SplitSection[]     // 每个待拆分段
  preHeadingBlockIds: string[] // 第一个最高级标题之前的块 ID（保留在原文档）
}
```

### 算法

```
输入：blocks: ChildBlockMeta[]（已按文档顺序排列）

1. 遍历所有块，识别标题块并提取级别：
   - 标题判断：block.type === "h" 或 block.markdown 匹配 /^#{1,6}\s/
   - 级别提取：正则 /^(\s{0,3})(#{1,6})\s/ 的第二组长度
   - highestLevel = min(所有标题级别)，若无标题则返回空 sections

2. 分段：
   - 索引 i = 0
   - 跳过所有非最高级标题块，收集到 preHeadingBlockIds
   - 遇到第一个最高级标题时开始新段：
     - 标题文本 = 去除 # 前缀，去除行内 ** 标记
     - 后续块归入该段，直到遇到下一个最高级标题
   - 每段的 markdown = 块的 markdown 字段以 "\n\n" 连接

3. 返回 SplitDocResult
```

### 边界情况

| 情况 | 行为 |
|------|------|
| 无标题块 | `sections = []` |
| 仅一个最高级标题 | `sections.length === 1`，调用方提示跳过 |
| 文档以非标题内容开始 | 非标题块进入 `preHeadingBlockIds` |
| 标题含加粗标记 `**` | 从 title 中去除 `**` |
| 同一标题级别出现多次 | 每次出现均作为新段起始 |

---

## 服务层：`splitDocByHeadings`

### 函数签名

```typescript
export async function splitDocByHeadings(docId: string): Promise<SplitReport>

type SplitReport = {
  sectionCount: number
  createdDocIds: string[]
  deletedBlockCount: number
}
```

### 流程

```
1. getDocMetaByID(docId)
   → 获取 box（笔记本 ID）和 hPath

2. getChildBlocksByParentId(docId)
   → 获取文档所有直接子块（已排序）

3. splitDocByHeadingsCore(blocks)
   → 获取 sections, preHeadingBlockIds

4. 校验：sections.length < 2 时抛出异常（调用方捕获并提示）

5. 对每个 section：
   a. title = sanitizeDocTitle(section.title)
      — 移除文件名非法字符：/ \ : * ? " < > |
   b. childHPath = hPath + "/" + title
   c. createDocWithMd(box, childHPath, section.markdown)
      → 新文档 ID 存入 createdDocIds

6. deleteBlocksByIds(所有 section 的 blockIds 扁平化)
   — 使用现有并发删除（默认并发数 4）

7. 返回 SplitReport
```

---

## Action 集成

### `actions.ts` 新增

```typescript
// ActionKey 联合类型新增：
| "split-doc-by-headings"

// ACTION_DOCK_ICON_TEXT 新增：
"split-doc-by-headings": "拆"

// BASE_ACTIONS 新增（organize 组）：
{
  key: "split-doc-by-headings",
  commandText: "按标题拆分文档",
  menuText: "按标题拆分文档",
  tooltip: createActionTooltip(
    "按标题拆分文档",
    "将文档按最高级标题拆分为多个子文档；第一个标题前的内容保留在原文档，拆分后原文档中的已拆分内容将被删除。"
  ),
  group: "organize",
  requiresWritableDoc: true,
  icon: "iconSplitLR",
}
```

### `action-runner-organize-handlers.ts` 新增

```typescript
"split-doc-by-headings": async (docId) => {
  // 1. 预检：获取 blocks，调用 core 分析，显示预览信息
  // 2. 确认对话框："将按最高级标题拆分为 N 个子文档，原文档中对应内容将被删除，是否继续？"
  // 3. setBusy(true)
  // 4. await splitDocByHeadings(docId)
  // 5. showMessage 报告结果
  // 6. setBusy(false)（在 finally 中）
}
```

---

## 测试

### `tests/split-doc-by-headings-core.test.ts`

| 测试用例 | 验证内容 |
|---------|---------|
| 最高级别检测 | 混合 h2/h3 → `highestLevel === 2` |
| 段落分组 | 3 个 h2 + 内容 → 3 个 sections，blockIds 和 markdown 正确 |
| 前置内容 | 第一个最高级标题前的块进入 `preHeadingBlockIds`，不在任何 section 中 |
| 单节跳过 | 仅 1 个 h2 → `sections.length === 1`（调用方处理跳过） |
| 无标题 | 全是段落 → `sections.length === 0` |
| 标题文本清理 | `## **加粗标题**` → `title === "加粗标题"` |
| 同级标题分段 | 3 个 h2 各带 h3 子标题 → 按 h2 分段，h3 归入对应 section |
| 全 h1 文档 | 文档含 h1（文档标题本身通常不在正文中，但若出现）→ `highestLevel === 1` |

---

## 用户交互流程

```
用户触发"按标题拆分文档"
    ↓
获取文档子块 → splitDocByHeadingsCore 分析
    ↓
无标题？ ──→ 提示"文档中未找到标题，无法拆分"
    ↓
仅一个最高级标题？ ──→ 提示"文档中仅有一个最高级标题，无需拆分"
    ↓
显示确认对话框："将按最高级标题（如 h2）拆分为 N 个子文档，原文档中对应内容将被删除，是否继续？"
    ↓ 用户确认
setBusy(true)
    ↓
为每个 section 创建子文档（createDocWithMd）
    ↓
批量删除原文档中已拆分的块（deleteBlocksByIds）
    ↓
showMessage："拆分完成：已创建 N 个子文档，从原文档删除 M 个块"
setBusy(false)
```

## 注意事项

- 子文档标题冲突：SiYuan 的 `createDocWithMd` 在同路径下遇到重名时会自动追加后缀，无需额外处理。
- 标题中的非法字符：`/` `\` `:` `*` `?` `"` `<` `>` `|` 在文件路径中有特殊含义，需从标题文本中移除。
- 块排序：`getChildBlocksByParentId` 返回的块已按文档顺序排列，可直接用于分段。
- 大文档性能：`deleteBlocksByIds` 内置并发控制（默认 4 路），对于包含大量块的文档也能高效删除。
