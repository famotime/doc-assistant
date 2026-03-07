import { createDocAssistantLogger } from "@/core/logger-core";
import { isBlankLine } from "@/core/markdown-cleanup-text-core";

export type ParagraphBlockMeta = {
  id: string;
  type: string;
  content?: string;
  markdown?: string;
  resolved?: boolean;
};

export type BlankParagraphCleanupResult = {
  deleteIds: string[];
  keptBlankIds: string[];
  removedCount: number;
};

export type HeadingBlankParagraphInsertResult = {
  insertBeforeIds: string[];
  insertCount: number;
};

export type DeleteFromCurrentBlockResult = {
  deleteIds: string[];
  deleteCount: number;
};

const blankLinesLogger = createDocAssistantLogger("BlankLines");
const deleteFromCurrentLogger = createDocAssistantLogger("DeleteFromCurrent");

function isBlankParagraph(block: ParagraphBlockMeta): boolean {
  if (block.type !== "p") {
    return false;
  }
  if (block.resolved === false) {
    return false;
  }
  return isBlankLine(block.content || "") && isBlankLine(block.markdown || "");
}

function isHeadingBlock(block: ParagraphBlockMeta): boolean {
  if (block.type === "h") {
    return true;
  }
  const markdown = (block.markdown || "").trimStart();
  return /^#{1,6}\s+\S/.test(markdown);
}

export function findExtraBlankParagraphIds(
  blocks: ParagraphBlockMeta[]
): BlankParagraphCleanupResult {
  const deleteIds: string[] = [];
  const keptBlankIds: string[] = [];

  for (const block of blocks) {
    const blank = isBlankParagraph(block);
    if (blank) {
      deleteIds.push(block.id);
      continue;
    }
  }

  blankLinesLogger.debug("blank paragraphs", {
    totalBlocks: blocks.length,
    blankCount: deleteIds.length,
    sample: deleteIds.slice(0, 8),
  });

  return {
    deleteIds,
    keptBlankIds,
    removedCount: deleteIds.length,
  };
}

export function findHeadingMissingBlankParagraphBeforeIds(
  blocks: ParagraphBlockMeta[]
): HeadingBlankParagraphInsertResult {
  const insertBeforeIds: string[] = [];

  for (let i = 0; i < blocks.length; i += 1) {
    const current = blocks[i];
    if (!isHeadingBlock(current)) {
      continue;
    }
    if (i === 0) {
      continue;
    }
    const previous = i > 0 ? blocks[i - 1] : undefined;
    if (previous && isBlankParagraph(previous)) {
      continue;
    }
    insertBeforeIds.push(current.id);
  }

  blankLinesLogger.debug("headings missing blank paragraph", {
    totalBlocks: blocks.length,
    headingCount: blocks.filter((block) => isHeadingBlock(block)).length,
    insertCount: insertBeforeIds.length,
    sample: insertBeforeIds.slice(0, 8),
  });

  return {
    insertBeforeIds,
    insertCount: insertBeforeIds.length,
  };
}

export function findDeleteFromCurrentBlockIds(
  blocks: ParagraphBlockMeta[],
  currentBlockId: string
): DeleteFromCurrentBlockResult {
  if (!currentBlockId) {
    return { deleteIds: [], deleteCount: 0 };
  }

  const startIndex = blocks.findIndex((block) => block.id === currentBlockId);
  if (startIndex < 0) {
    return { deleteIds: [], deleteCount: 0 };
  }

  const deleteIds = blocks.slice(startIndex).map((block) => block.id);
  deleteFromCurrentLogger.debug("matched blocks", {
    totalBlocks: blocks.length,
    currentBlockId,
    startIndex,
    deleteCount: deleteIds.length,
    sample: deleteIds.slice(0, 8),
  });
  return {
    deleteIds,
    deleteCount: deleteIds.length,
  };
}
