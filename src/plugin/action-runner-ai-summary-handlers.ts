import { showMessage } from "siyuan";
import { buildConceptMapDocTitle, joinChildDocHPath } from "@/core/ai-concept-map-core";
import {
  buildAiSummaryBlockMarkdown,
  resolveAiSummaryInsertTarget,
} from "@/core/ai-summary-core";
import {
  generateDocumentConceptMap,
  generateDocumentSummary,
} from "@/services/ai-summary";
import { loadFreshNetworkLensDocumentSummary } from "@/services/network-lens-ai-index";
import {
  appendBlock,
  createDocWithMd,
  getChildBlocksByParentId,
  getDocMetaByID,
  getRootDocRawMarkdown,
  insertBlockBefore,
} from "@/services/kernel";
import { PartialActionHandlerMap } from "@/plugin/action-runner-dispatcher";
import { openDocByProtocol } from "@/plugin/action-runner-ai-shared";
import { CreateAiActionHandlersOptions } from "@/plugin/action-runner-ai-types";

export function createAiSummaryActionHandlers(
  options: CreateAiActionHandlersOptions = {}
): PartialActionHandlerMap {
  return {
    "create-doc-concept-map": async (docId) => {
      const documentMarkdown = (await getRootDocRawMarkdown(docId)).trim();
      if (!documentMarkdown) {
        showMessage("当前文档没有可供生成概念地图的正文", 5000, "info");
        return;
      }

      const docMeta = await getDocMetaByID(docId).catch(() => null);
      if (!docMeta?.box) {
        throw new Error("未找到当前文档信息，无法生成概念地图");
      }

      const conceptMap = await generateDocumentConceptMap({
        config: options.getAiSummaryConfig?.(),
        documentTitle: docMeta.title,
        documentMarkdown,
      });
      const title = buildConceptMapDocTitle(docMeta.title);
      const path = joinChildDocHPath(docMeta.hPath, title);
      const conceptDocId = await createDocWithMd(docMeta.box, path, conceptMap);
      openDocByProtocol(conceptDocId);
      showMessage("已生成概念地图子文档", 5000, "info");
    },
    "insert-doc-summary": async (docId) => {
      const documentMarkdown = (await getRootDocRawMarkdown(docId)).trim();
      if (!documentMarkdown) {
        showMessage("当前文档没有可供摘要的正文", 5000, "info");
        return;
      }

      let docMeta: Awaited<ReturnType<typeof getDocMetaByID>> = null;
      try {
        docMeta = await getDocMetaByID(docId);
      } catch {
        docMeta = null;
      }
      const summary = await generateDocumentSummary({
        config: options.getAiSummaryConfig?.(),
        documentId: docId,
        documentTitle: docMeta?.title,
        documentUpdatedAt: docMeta?.updated,
        documentMarkdown,
        loadFreshDocumentSummary: async (params) => loadFreshNetworkLensDocumentSummary({
          networkLensPlugin: options.resolveNetworkLensPlugin?.(),
          documentId: params.documentId,
          documentUpdatedAt: params.documentUpdatedAt,
        }),
      });
      const blocks = await getChildBlocksByParentId(docId);
      const summaryMarkdown = buildAiSummaryBlockMarkdown(summary);
      const target = resolveAiSummaryInsertTarget(blocks);

      if (target.mode === "append") {
        await appendBlock(summaryMarkdown, docId);
      } else {
        await insertBlockBefore(summaryMarkdown, target.nextId, docId);
      }

      showMessage("已插入 AI 文档摘要", 5000, "info");
    },
  };
}
