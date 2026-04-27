# Top100 大文件清单 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为当前文档所在笔记本新增“输出Top100大文件清单”动作，按文档本体加内嵌资源总大小排序，并在 Daily Note 父目录下创建表格报告文档。

**Architecture:** 新增一个 `core` 纯逻辑模块处理排序、格式化和 Markdown 表格生成；新增一个 `service` 模块负责笔记本文档枚举、文档与资源大小统计以及建文档；最后将新 service 接到 `organize` 分组动作与现有测试上。测试遵循 TDD，优先用 `pnpm vitest run ...` 执行，因为当前仓库的 `pnpm test` 包装脚本存在路径兼容问题。

**Tech Stack:** TypeScript, Vitest, SiYuan kernel API, Vite 6

---

### Task 1: 核心表格逻辑

**Files:**
- Create: `src/core/large-documents-report-core.ts`
- Test: `tests/large-documents-report-core.test.ts`

- [ ] **Step 1: Write the failing core test**

```ts
import { describe, expect, test } from "vitest";
import {
  buildLargeDocumentsReportMarkdown,
  formatLargeDocumentBytes,
  rankLargeDocuments,
} from "@/core/large-documents-report-core";

describe("large documents report core", () => {
  test("sorts by total size and renders Siyuan links in markdown table", () => {
    const ranked = rankLargeDocuments([
      {
        documentId: "doc-b",
        title: "B 文档",
        hPath: "/资料/B 文档",
        updated: "20260427120000",
        documentBytes: 100,
        assetBytes: 300,
        assetCount: 2,
      },
      {
        documentId: "doc-a",
        title: "A 文档",
        hPath: "/资料/A 文档",
        updated: "20260427130000",
        documentBytes: 200,
        assetBytes: 200,
        assetCount: 1,
      },
    ]);

    expect(ranked.map((item) => item.documentId)).toEqual(["doc-a", "doc-b"]);

    const markdown = buildLargeDocumentsReportMarkdown({
      notebookLabel: "知识库",
      generatedAt: "2026-04-27 13:30:15",
      items: ranked,
    });

    expect(formatLargeDocumentBytes(1024)).toBe("1.0 KB");
    expect(markdown).toContain("| 排名 | 文件名 | 文档大小 | 文档本体 | 内嵌资源 | 资源数 | 文档路径 |");
    expect(markdown).toContain("[A 文档](siyuan://blocks/doc-a)");
    expect(markdown).toContain("| 1 | [A 文档](siyuan://blocks/doc-a) | 400 B | 200 B | 200 B | 1 | /资料/A 文档 |");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/large-documents-report-core.test.ts`
Expected: FAIL because `@/core/large-documents-report-core` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export type LargeDocumentReportItem = {
  documentId: string;
  title: string;
  hPath: string;
  updated: string;
  documentBytes: number;
  assetBytes: number;
  assetCount: number;
};

export type RankedLargeDocumentReportItem = LargeDocumentReportItem & {
  totalBytes: number;
};

export function formatLargeDocumentBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

export function rankLargeDocuments(
  items: LargeDocumentReportItem[],
  limit = 100
): RankedLargeDocumentReportItem[] {
  return items
    .map((item) => ({
      ...item,
      totalBytes: item.documentBytes + item.assetBytes,
    }))
    .sort((left, right) =>
      right.totalBytes - left.totalBytes
      || String(right.updated || "").localeCompare(String(left.updated || ""))
      || left.title.localeCompare(right.title, "zh-CN")
    )
    .slice(0, limit);
}

export function buildLargeDocumentsReportMarkdown(params: {
  notebookLabel: string;
  generatedAt: string;
  items: RankedLargeDocumentReportItem[];
}): string {
  const lines = [
    "# Top100大文件清单",
    "",
    `当前笔记本：${params.notebookLabel}`,
    "统计口径：文档大小 = 文档本体 + 内嵌资源",
    `生成时间：${params.generatedAt}`,
    "",
    "| 排名 | 文件名 | 文档大小 | 文档本体 | 内嵌资源 | 资源数 | 文档路径 |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...params.items.map((item, index) =>
      `| ${index + 1} | [${item.title}](siyuan://blocks/${item.documentId}) | ${formatLargeDocumentBytes(item.totalBytes)} | ${formatLargeDocumentBytes(item.documentBytes)} | ${formatLargeDocumentBytes(item.assetBytes)} | ${item.assetCount} | ${item.hPath} |`
    ),
  ];
  return lines.join("\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/large-documents-report-core.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/large-documents-report-core.test.ts src/core/large-documents-report-core.ts
git commit -m "feat: add large document report core"
```

### Task 2: 服务层统计与建文档

**Files:**
- Create: `src/services/large-documents-report.ts`
- Modify: `src/services/kernel.ts`
- Modify: `src/services/kernel-file.ts`
- Test: `tests/large-documents-report-service.test.ts`

- [ ] **Step 1: Write the failing service test**

```ts
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("@/services/kernel", () => ({
  createDocWithMd: vi.fn(),
  getDocMetaByID: vi.fn(),
  getNotebookConf: vi.fn(),
  renderSprigTemplate: vi.fn(),
  listNotebookDocs: vi.fn(),
  getFileBlob: vi.fn(),
  getDocAssets: vi.fn(),
  statAsset: vi.fn(),
}));

import {
  createDocWithMd,
  getDocAssets,
  getDocMetaByID,
  getFileBlob,
  getNotebookConf,
  listNotebookDocs,
  renderSprigTemplate,
  statAsset,
} from "@/services/kernel";
import { createTop100LargeDocumentsReport } from "@/services/large-documents-report";

test("creates the report under the Daily Note parent path and sums doc plus asset bytes", async () => {
  vi.mocked(getDocMetaByID).mockResolvedValue({ id: "doc-1", box: "nb-1", hPath: "/项目/当前文档" } as any);
  vi.mocked(getNotebookConf).mockResolvedValue({ conf: { dailyNoteSavePath: "/daily/{{now}}" } } as any);
  vi.mocked(renderSprigTemplate).mockResolvedValue("/daily/2026/04/2026-04-27");
  vi.mocked(listNotebookDocs).mockResolvedValue([
    { id: "doc-a", box: "nb-1", path: "/a.sy", hPath: "/A", updated: "20260427100000", title: "A" },
  ] as any);
  vi.mocked(getFileBlob).mockResolvedValue(new Blob(["1234"]));
  vi.mocked(getDocAssets).mockResolvedValue(["assets/shared.png", "assets/shared.png"]);
  vi.mocked(statAsset).mockResolvedValue({ size: 20 } as any);
  vi.mocked(createDocWithMd).mockResolvedValue("report-doc");

  const result = await createTop100LargeDocumentsReport({
    currentDocId: "doc-1",
    now: new Date("2026-04-27T15:30:15+08:00"),
  });

  expect(createDocWithMd).toHaveBeenCalledWith(
    "nb-1",
    expect.stringMatching(/^\/daily\/2026\/04\/Top100大文件清单-/),
    expect.stringContaining("[A](siyuan://blocks/doc-a)")
  );
  expect(result.docCount).toBe(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/large-documents-report-service.test.ts`
Expected: FAIL because service and kernel helpers do not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
type NotebookDocRow = {
  id: string;
  box: string;
  path: string;
  hPath: string;
  updated: string;
  title: string;
};

export async function listNotebookDocs(notebook: string): Promise<NotebookDocRow[]> {
  return sql<NotebookDocRow>(`
    select id, box, path, hpath as hPath, updated
    from blocks
    where type='d' and box='${escapeSqlLiteral(notebook)}'
  `);
}

export async function getDocAssets(id: string): Promise<unknown> {
  return requestApi("/api/asset/getDocAssets", { id });
}

export async function statAsset(path: string): Promise<unknown> {
  return requestApi("/api/asset/statAsset", { path });
}
```

```ts
export async function createTop100LargeDocumentsReport(options: {
  currentDocId: string;
  now?: Date;
}): Promise<{ id: string; title: string; path: string; docCount: number }> {
  // 获取当前文档与 notebook
  // 解析 Daily Note 路径父目录
  // 枚举 notebook 文档
  // 统计文档 blob.size 与资源 size
  // 调用 rankLargeDocuments + buildLargeDocumentsReportMarkdown
  // createDocWithMd 创建结果文档
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/large-documents-report-service.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/large-documents-report-service.test.ts src/services/large-documents-report.ts src/services/kernel.ts src/services/kernel-file.ts
git commit -m "feat: add large documents report service"
```

### Task 3: 动作接入、回归测试与文档

**Files:**
- Modify: `src/plugin/actions.ts`
- Modify: `src/plugin/action-runner-organize-handlers.ts`
- Modify: `tests/action-runner-loading.test.ts`
- Modify: `tests/actions-grouping.test.ts`
- Modify: `tests/plugin-actions.test.ts`
- Modify: `docs/project-structure.md`
- Modify: `docs/public-command-configuration.md`

- [ ] **Step 1: Write the failing action tests**

```ts
vi.mock("@/services/large-documents-report", () => ({
  createTop100LargeDocumentsReport: vi.fn(),
}));

test("runs the large documents report action and shows success message", async () => {
  createTop100LargeDocumentsReportMock.mockResolvedValue({
    id: "report-doc",
    title: "Top100大文件清单-20260427-153015",
    path: "/daily/2026/04/Top100大文件清单-20260427-153015",
    docCount: 100,
  });

  await runner.runAction("create-top100-large-documents-report" as any);

  expect(showMessageMock).toHaveBeenCalledWith(
    "已输出 Top100 大文件清单：Top100大文件清单-20260427-153015（100 篇）",
    5000,
    "info"
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/action-runner-loading.test.ts tests/actions-grouping.test.ts tests/plugin-actions.test.ts`
Expected: FAIL because action key and handler are not registered yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export type ActionKey =
  | "create-top100-large-documents-report"
  // ...
```

```ts
{
  key: "create-top100-large-documents-report",
  commandText: "输出Top100大文件清单",
  menuText: "输出Top100大文件清单",
  tooltip: createActionTooltip(
    "输出Top100大文件清单",
    "统计当前笔记本内文档本体与内嵌资源总大小最大的前 100 篇文档，并在 Daily Note 父目录下生成报告文档。"
  ),
  group: "organize",
  icon: "iconList",
}
```

```ts
"create-top100-large-documents-report": async (docId) => {
  const result = await createTop100LargeDocumentsReport({ currentDocId: docId });
  showMessage(`已输出 Top100 大文件清单：${result.title}（${result.docCount} 篇）`, 5000, "info");
},
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/action-runner-loading.test.ts tests/actions-grouping.test.ts tests/plugin-actions.test.ts`
Expected: PASS

- [ ] **Step 5: Update docs and run focused verification**

Run: `pnpm vitest run tests/large-documents-report-core.test.ts tests/large-documents-report-service.test.ts tests/action-runner-loading.test.ts tests/actions-grouping.test.ts tests/plugin-actions.test.ts`
Expected: PASS

Update:

```md
- `src/core/large-documents-report-core.ts`：Top100 大文件清单的排序、字节格式化与 Markdown 表格拼装
- `src/services/large-documents-report.ts`：统计当前笔记本文档与资源大小并创建清单文档
- `create-top100-large-documents-report` | 输出Top100大文件清单
```

- [ ] **Step 6: Commit**

```bash
git add src/plugin/actions.ts src/plugin/action-runner-organize-handlers.ts tests/action-runner-loading.test.ts tests/actions-grouping.test.ts tests/plugin-actions.test.ts docs/project-structure.md docs/public-command-configuration.md
git commit -m "feat: add top100 large documents report action"
```
