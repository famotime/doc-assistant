# 按标题拆分文档 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "按标题拆分文档" action that splits a document into child documents by its highest-level headings, deleting the split content from the original.

**Architecture:** Pure core logic (`splitDocByHeadingsCore`) analyzes ordered `ChildBlockMeta[]` and produces a split plan. A service function (`splitDocByHeadings`) orchestrates kernel API calls to create child docs and delete blocks. The action is wired into the existing organize group via `actions.ts` and `action-runner-organize-handlers.ts`.

**Tech Stack:** TypeScript, Vitest, SiYuan kernel HTTP API (`createDocWithMd`, `getChildBlocksByParentId`, `deleteBlocksByIds`, `getDocMetaByID`)

---

### Task 1: Core logic — `splitDocByHeadingsCore`

**Files:**
- Create: `src/core/split-doc-by-headings-core.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/split-doc-by-headings-core.test.ts`:

```typescript
import { describe, expect, test } from "vitest";
import { splitDocByHeadingsCore, type SplitSection } from "@/core/split-doc-by-headings-core";
import type { ChildBlockMeta } from "@/services/kernel-block";

function block(id: string, type: string, markdown: string): ChildBlockMeta {
  return { id, type, content: markdown, markdown };
}

describe("splitDocByHeadingsCore", () => {
  test("returns empty sections when no headings exist", () => {
    const blocks: ChildBlockMeta[] = [
      block("b1", "p", "paragraph one"),
      block("b2", "p", "paragraph two"),
    ];
    const result = splitDocByHeadingsCore(blocks);
    expect(result.sections).toEqual([]);
    expect(result.preHeadingBlockIds).toEqual(["b1", "b2"]);
    expect(result.highestLevel).toBe(0);
  });

  test("detects highest heading level as minimum # count", () => {
    const blocks: ChildBlockMeta[] = [
      block("b1", "h", "## Heading A"),
      block("b2", "p", "content A"),
      block("b3", "h", "### Sub A1"),
      block("b4", "p", "sub content"),
      block("b5", "h", "## Heading B"),
      block("b6", "p", "content B"),
    ];
    const result = splitDocByHeadingsCore(blocks);
    expect(result.highestLevel).toBe(2);
    expect(result.sections).toHaveLength(2);
  });

  test("groups blocks into sections by highest-level headings", () => {
    const blocks: ChildBlockMeta[] = [
      block("b1", "h", "## Section One"),
      block("b2", "p", "para 1a"),
      block("b3", "p", "para 1b"),
      block("b4", "h", "## Section Two"),
      block("b5", "p", "para 2a"),
      block("b6", "h", "## Section Three"),
    ];
    const result = splitDocByHeadingsCore(blocks);
    expect(result.sections).toHaveLength(3);
    expect(result.sections[0]).toMatchObject({
      title: "Section One",
      blockIds: ["b1", "b2", "b3"],
      markdown: "## Section One\n\npara 1a\n\npara 1b",
    });
    expect(result.sections[1]).toMatchObject({
      title: "Section Two",
      blockIds: ["b4", "b5"],
      markdown: "## Section Two\n\npara 2a",
    });
    expect(result.sections[2]).toMatchObject({
      title: "Section Three",
      blockIds: ["b6"],
      markdown: "## Section Three",
    });
  });

  test("collects pre-heading blocks into preHeadingBlockIds", () => {
    const blocks: ChildBlockMeta[] = [
      block("b0", "p", "intro paragraph"),
      block("b1", "h", "## Section One"),
      block("b2", "p", "content"),
      block("b3", "h", "## Section Two"),
      block("b4", "p", "more content"),
    ];
    const result = splitDocByHeadingsCore(blocks);
    expect(result.preHeadingBlockIds).toEqual(["b0"]);
    expect(result.sections).toHaveLength(2);
    expect(result.sections[0].blockIds).toEqual(["b1", "b2"]);
  });

  test("handles only one highest-level heading (single section)", () => {
    const blocks: ChildBlockMeta[] = [
      block("b1", "h", "## Only Section"),
      block("b2", "p", "content"),
    ];
    const result = splitDocByHeadingsCore(blocks);
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].title).toBe("Only Section");
  });

  test("strips bold markers from heading title", () => {
    const blocks: ChildBlockMeta[] = [
      block("b1", "h", "## **Bold Title**"),
      block("b2", "p", "content"),
      block("b3", "h", "## Normal Title"),
      block("b4", "p", "more"),
    ];
    const result = splitDocByHeadingsCore(blocks);
    expect(result.sections[0].title).toBe("Bold Title");
    expect(result.sections[1].title).toBe("Normal Title");
  });

  test("keeps sub-headings within their parent section", () => {
    const blocks: ChildBlockMeta[] = [
      block("b1", "h", "## Chapter 1"),
      block("b2", "p", "intro 1"),
      block("b3", "h", "### Detail 1.1"),
      block("b4", "p", "detail content"),
      block("b5", "h", "## Chapter 2"),
      block("b6", "p", "intro 2"),
      block("b7", "h", "### Detail 2.1"),
      block("b8", "p", "more detail"),
    ];
    const result = splitDocByHeadingsCore(blocks);
    expect(result.sections).toHaveLength(2);
    expect(result.sections[0].blockIds).toEqual(["b1", "b2", "b3", "b4"]);
    expect(result.sections[1].blockIds).toEqual(["b5", "b6", "b7", "b8"]);
    expect(result.sections[0].markdown).toBe(
      "## Chapter 1\n\nintro 1\n\n### Detail 1.1\n\ndetail content"
    );
  });

  test("handles all h1 headings", () => {
    const blocks: ChildBlockMeta[] = [
      block("b1", "h", "# Title One"),
      block("b2", "p", "content one"),
      block("b3", "h", "# Title Two"),
      block("b4", "p", "content two"),
    ];
    const result = splitDocByHeadingsCore(blocks);
    expect(result.highestLevel).toBe(1);
    expect(result.sections).toHaveLength(2);
    expect(result.sections[0].title).toBe("Title One");
  });

  test("strips leading whitespace from heading markdown", () => {
    const blocks: ChildBlockMeta[] = [
      block("b1", "h", "  ## Spaced Heading"),
      block("b2", "p", "content"),
      block("b3", "h", "## Normal"),
      block("b4", "p", "more"),
    ];
    const result = splitDocByHeadingsCore(blocks);
    expect(result.sections[0].title).toBe("Spaced Heading");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/split-doc-by-headings-core.test.ts`
Expected: FAIL — module `@/core/split-doc-by-headings-core` not found

- [ ] **Step 3: Implement `splitDocByHeadingsCore`**

Create `src/core/split-doc-by-headings-core.ts`:

```typescript
import type { ChildBlockMeta } from "@/services/kernel-block";

export type SplitSection = {
  title: string;
  blockIds: string[];
  markdown: string;
};

export type SplitDocResult = {
  highestLevel: number;
  sections: SplitSection[];
  preHeadingBlockIds: string[];
};

const HEADING_RE = /^(\s{0,3})(#{1,6})\s/;
const BOLD_RE = /\*\*/g;

function isHeadingBlock(block: ChildBlockMeta): boolean {
  if (block.type === "h") {
    return true;
  }
  return HEADING_RE.test(block.markdown || "");
}

function extractHeadingLevel(markdown: string): number {
  const match = (markdown || "").match(HEADING_RE);
  return match ? match[2].length : 0;
}

function extractHeadingTitle(markdown: string): string {
  const match = (markdown || "").match(HEADING_RE);
  if (!match) {
    return "";
  }
  const raw = markdown.trimStart().slice(match[0].length).trim();
  return raw.replace(BOLD_RE, "").trim();
}

export function splitDocByHeadingsCore(
  blocks: ChildBlockMeta[]
): SplitDocResult {
  let highestLevel = Infinity;
  for (const block of blocks) {
    if (!isHeadingBlock(block)) {
      continue;
    }
    const level = extractHeadingLevel(block.markdown);
    if (level > 0 && level < highestLevel) {
      highestLevel = level;
    }
  }

  if (!isFinite(highestLevel)) {
    return { highestLevel: 0, sections: [], preHeadingBlockIds: blocks.map((b) => b.id) };
  }

  const sections: SplitSection[] = [];
  const preHeadingBlockIds: string[] = [];
  let currentSection: SplitSection | null = null;

  for (const block of blocks) {
    const isSplitHeading =
      isHeadingBlock(block) && extractHeadingLevel(block.markdown) === highestLevel;

    if (isSplitHeading) {
      if (currentSection) {
        sections.push(currentSection);
      }
      currentSection = {
        title: extractHeadingTitle(block.markdown),
        blockIds: [block.id],
        markdown: block.markdown.trim(),
      };
    } else if (currentSection) {
      currentSection.blockIds.push(block.id);
      currentSection.markdown += "\n\n" + block.markdown;
    } else {
      preHeadingBlockIds.push(block.id);
    }
  }

  if (currentSection) {
    sections.push(currentSection);
  }

  return { highestLevel, sections, preHeadingBlockIds };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/split-doc-by-headings-core.test.ts`
Expected: All 9 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/split-doc-by-headings-core.ts tests/split-doc-by-headings-core.test.ts
git commit -m "feat: add splitDocByHeadingsCore logic and tests"
```

---

### Task 2: Service layer — `splitDocByHeadings`

**Files:**
- Create: `src/services/split-doc-by-headings.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/split-doc-by-headings-service.test.ts`:

```typescript
import { describe, expect, test, vi, beforeEach } from "vitest";
import type { ChildBlockMeta } from "@/services/kernel-block";
import type { DocMeta } from "@/services/kernel";

vi.mock("@/services/kernel", () => ({
  getDocMetaByID: vi.fn(),
  getChildBlocksByParentId: vi.fn(),
  createDocWithMd: vi.fn(),
  deleteBlocksByIds: vi.fn(),
}));

import {
  getDocMetaByID,
  getChildBlocksByParentId,
  createDocWithMd,
  deleteBlocksByIds,
} from "@/services/kernel";
import { splitDocByHeadings } from "@/services/split-doc-by-headings";

const mockGetDocMeta = vi.mocked(getDocMetaByID);
const mockGetChildBlocks = vi.mocked(getChildBlocksByParentId);
const mockCreateDoc = vi.mocked(createDocWithMd);
const mockDeleteBlocks = vi.mocked(deleteBlocksByIds);

function block(id: string, type: string, markdown: string): ChildBlockMeta {
  return { id, type, content: markdown, markdown };
}

const testDocMeta: DocMeta = {
  id: "doc-1",
  parentId: "",
  rootId: "doc-1",
  box: "nb-1",
  path: "/20260101120000-abc123.sy",
  hPath: "/Notebook/TestDoc",
  updated: "2026-05-01",
  title: "TestDoc",
};

describe("splitDocByHeadings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("throws when document has no headings", async () => {
    mockGetDocMeta.mockResolvedValue(testDocMeta);
    mockGetChildBlocks.mockResolvedValue([
      block("b1", "p", "paragraph"),
    ]);
    await expect(splitDocByHeadings("doc-1")).rejects.toThrow("未找到标题");
  });

  test("throws when document has only one section", async () => {
    mockGetDocMeta.mockResolvedValue(testDocMeta);
    mockGetChildBlocks.mockResolvedValue([
      block("b1", "h", "## Only Section"),
      block("b2", "p", "content"),
    ]);
    await expect(splitDocByHeadings("doc-1")).rejects.toThrow("仅有一个");
  });

  test("creates child documents and deletes blocks on success", async () => {
    mockGetDocMeta.mockResolvedValue(testDocMeta);
    mockGetChildBlocks.mockResolvedValue([
      block("b1", "h", "## Alpha"),
      block("b2", "p", "content A"),
      block("b3", "h", "## Beta"),
      block("b4", "p", "content B"),
    ]);
    mockCreateDoc
      .mockResolvedValueOnce("new-doc-1")
      .mockResolvedValueOnce("new-doc-2");
    mockDeleteBlocks.mockResolvedValue({ deletedCount: 4, failedIds: [] });

    const report = await splitDocByHeadings("doc-1");

    expect(mockCreateDoc).toHaveBeenCalledTimes(2);
    expect(mockCreateDoc).toHaveBeenCalledWith("nb-1", "/Notebook/TestDoc/Alpha", "## Alpha\n\ncontent A");
    expect(mockCreateDoc).toHaveBeenCalledWith("nb-1", "/Notebook/TestDoc/Beta", "## Beta\n\ncontent B");
    expect(mockDeleteBlocks).toHaveBeenCalledWith(["b1", "b2", "b3", "b4"]);
    expect(report).toEqual({
      sectionCount: 2,
      createdDocIds: ["new-doc-1", "new-doc-2"],
      deletedBlockCount: 4,
    });
  });

  test("does not delete pre-heading blocks", async () => {
    mockGetDocMeta.mockResolvedValue(testDocMeta);
    mockGetChildBlocks.mockResolvedValue([
      block("b0", "p", "intro"),
      block("b1", "h", "## Alpha"),
      block("b2", "p", "content A"),
      block("b3", "h", "## Beta"),
      block("b4", "p", "content B"),
    ]);
    mockCreateDoc
      .mockResolvedValueOnce("new-doc-1")
      .mockResolvedValueOnce("new-doc-2");
    mockDeleteBlocks.mockResolvedValue({ deletedCount: 4, failedIds: [] });

    await splitDocByHeadings("doc-1");

    expect(mockDeleteBlocks).toHaveBeenCalledWith(["b1", "b2", "b3", "b4"]);
  });

  test("sanitizes invalid characters from heading title", async () => {
    mockGetDocMeta.mockResolvedValue(testDocMeta);
    mockGetChildBlocks.mockResolvedValue([
      block("b1", "h", "## Bad/Title:*?"),
      block("b2", "p", "content"),
      block("b3", "h", "## Good Title"),
      block("b4", "p", "more"),
    ]);
    mockCreateDoc
      .mockResolvedValueOnce("new-doc-1")
      .mockResolvedValueOnce("new-doc-2");
    mockDeleteBlocks.mockResolvedValue({ deletedCount: 4, failedIds: [] });

    await splitDocByHeadings("doc-1");

    expect(mockCreateDoc).toHaveBeenCalledWith("nb-1", "/Notebook/TestDoc/BadTitle", expect.any(String));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/split-doc-by-headings-service.test.ts`
Expected: FAIL — module `@/services/split-doc-by-headings` not found

- [ ] **Step 3: Implement `splitDocByHeadings`**

Create `src/services/split-doc-by-headings.ts`:

```typescript
import {
  getDocMetaByID,
  getChildBlocksByParentId,
  createDocWithMd,
  deleteBlocksByIds,
} from "@/services/kernel";
import { splitDocByHeadingsCore } from "@/core/split-doc-by-headings-core";

const INVALID_TITLE_RE = /[\\/:*?"<>|]/g;

export type SplitReport = {
  sectionCount: number;
  createdDocIds: string[];
  deletedBlockCount: number;
};

function sanitizeDocTitle(title: string): string {
  return title.replace(INVALID_TITLE_RE, "").trim();
}

export async function splitDocByHeadings(docId: string): Promise<SplitReport> {
  const docMeta = await getDocMetaByID(docId);
  if (!docMeta) {
    throw new Error("无法获取文档信息");
  }

  const blocks = await getChildBlocksByParentId(docId);
  const { sections } = splitDocByHeadingsCore(blocks);

  if (sections.length === 0) {
    throw new Error("文档中未找到标题，无法拆分");
  }
  if (sections.length === 1) {
    throw new Error("文档中仅有一个最高级标题，无需拆分");
  }

  const createdDocIds: string[] = [];
  for (const section of sections) {
    const title = sanitizeDocTitle(section.title) || "未命名";
    const childHPath = `${docMeta.hPath}/${title}`;
    const newDocId = await createDocWithMd(docMeta.box, childHPath, section.markdown);
    createdDocIds.push(newDocId);
  }

  const allBlockIds = sections.flatMap((s) => s.blockIds);
  const deleteResult = await deleteBlocksByIds(allBlockIds);

  return {
    sectionCount: sections.length,
    createdDocIds,
    deletedBlockIds: deleteResult.deletedCount,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/split-doc-by-headings-service.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/split-doc-by-headings.ts tests/split-doc-by-headings-service.test.ts
git commit -m "feat: add splitDocByHeadings service with kernel API integration"
```

---

### Task 3: Action wiring — `actions.ts` and handler

**Files:**
- Modify: `src/plugin/actions.ts` (lines 3, 74, 115–230)
- Modify: `src/plugin/action-runner-organize-handlers.ts` (lines 1–9, 70–155)

- [ ] **Step 1: Add `ActionKey` entry**

In `src/plugin/actions.ts`, add `"split-doc-by-headings"` to the `ActionKey` union type (after `"delete-from-current-to-end"`):

```typescript
| "delete-from-current-to-end"
| "split-doc-by-headings"
```

- [ ] **Step 2: Add dock icon text**

In `src/plugin/actions.ts`, add to `ACTION_DOCK_ICON_TEXT` (after `"delete-from-current-to-end"`):

```typescript
"split-doc-by-headings": "拆",
```

- [ ] **Step 3: Add action config**

In `src/plugin/actions.ts`, add to `BASE_ACTIONS` (after the `"dedupe"` entry, to keep it in the organize group):

```typescript
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
},
```

- [ ] **Step 4: Add handler**

In `src/plugin/action-runner-organize-handlers.ts`, add import at top:

```typescript
import { splitDocByHeadings } from "@/services/split-doc-by-headings";
import { getChildBlocksByParentId } from "@/services/kernel";
import { splitDocByHeadingsCore } from "@/core/split-doc-by-headings-core";
```

Add handler to the returned map in `createOrganizeActionHandlers` (after the `dedupe` handler):

```typescript
"split-doc-by-headings": async (docId) => {
  const blocks = await getChildBlocksByParentId(docId);
  const { sections } = splitDocByHeadingsCore(blocks);

  if (sections.length === 0) {
    showMessage("文档中未找到标题，无法拆分", 5000, "info");
    return;
  }
  if (sections.length === 1) {
    showMessage("文档中仅有一个最高级标题，无需拆分", 5000, "info");
    return;
  }

  const ok = await options.askConfirmWithVisibleDialog(
    "按标题拆分文档",
    `将按最高级标题拆分为 ${sections.length} 个子文档，原文档中对应内容将被删除，是否继续？`
  );
  if (!ok) {
    return;
  }

  options.setBusy?.(true);
  try {
    const report = await splitDocByHeadings(docId);
    showMessage(
      `拆分完成：已创建 ${report.sectionCount} 个子文档，从原文档删除 ${report.deletedBlockCount} 个块`,
      9000,
      "info"
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    showMessage(`拆分失败：${msg}`, 9000, "error");
  } finally {
    options.setBusy?.(false);
  }
},
```

- [ ] **Step 5: Run typecheck**

Run: `pnpm typecheck:strict`
Expected: No errors

- [ ] **Step 6: Run all tests**

Run: `pnpm test`
Expected: All tests pass (no regressions)

- [ ] **Step 7: Commit**

```bash
git add src/plugin/actions.ts src/plugin/action-runner-organize-handlers.ts
git commit -m "feat: wire split-doc-by-headings action into organize handlers"
```

---

### Task 4: Fix return type and verify full test suite

**Files:**
- Modify: `src/services/split-doc-by-headings.ts`

- [ ] **Step 1: Fix `SplitReport` type if needed**

The service function returns `deletedBlockIds` in Task 2 Step 3 but the type declares `deletedBlockCount`. Ensure the return object uses `deletedBlockCount` consistently:

In `src/services/split-doc-by-headings.ts`, verify the return statement matches:

```typescript
return {
  sectionCount: sections.length,
  createdDocIds,
  deletedBlockCount: deleteResult.deletedCount,
};
```

- [ ] **Step 2: Run all tests**

Run: `pnpm test`
Expected: All tests pass

- [ ] **Step 3: Run typecheck**

Run: `pnpm typecheck:strict`
Expected: No errors

- [ ] **Step 4: Commit (if any fix was needed)**

```bash
git add src/services/split-doc-by-headings.ts
git commit -m "fix: align SplitReport return field name"
```
