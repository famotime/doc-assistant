import { describe, expect, test } from "vitest";
import { buildMergeSelectedListBlocksPreview } from "@/core/list-block-merge-core";

describe("list-block-merge-core", () => {
  test("converts paragraphs and keeps existing list indentation hierarchy", () => {
    const preview = buildMergeSelectedListBlocksPreview([
      { id: "a", type: "p", markdown: "第一段" },
      { id: "b", type: "i", markdown: "1. 第二项" },
      { id: "c", type: "l", markdown: "- 第三项\n  1. 第四项\n    第四项说明" },
    ]);

    expect(preview.supportedBlockCount).toBe(3);
    expect(preview.paragraphBlockCount).toBe(1);
    expect(preview.resultItemCount).toBe(4);
    expect(preview.updateBlockId).toBe("a");
    expect(preview.deleteBlockIds).toEqual(["b", "c"]);
    expect(preview.mergedMarkdown).toBe(
      "- 第一段\n- 第二项\n- 第三项\n  - 第四项\n    第四项说明"
    );
  });

  test("keeps multi-line paragraph body as one list item continuation", () => {
    const preview = buildMergeSelectedListBlocksPreview([
      { id: "a", type: "NodeParagraph", markdown: "第一行\n第二行" },
    ]);

    expect(preview.resultItemCount).toBe(1);
    expect(preview.mergedMarkdown).toBe("- 第一行\n  第二行");
  });

  test("preserves nested list indentation from existing list blocks", () => {
    const preview = buildMergeSelectedListBlocksPreview([
      {
        id: "a",
        type: "NodeList",
        markdown: "- 父项\n  - 子项\n    子项说明\n- 末项",
      },
    ]);

    expect(preview.resultItemCount).toBe(3);
    expect(preview.mergedMarkdown).toBe("- 父项\n  - 子项\n    子项说明\n- 末项");
  });
});
