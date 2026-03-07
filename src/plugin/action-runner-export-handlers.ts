import { showMessage } from "siyuan";
import { KeyInfoFilter } from "@/core/key-info-core";
import { createDocAssistantLogger } from "@/core/logger-core";
import { decodeURIComponentSafe } from "@/core/workspace-path-core";
import {
  exportCurrentDocMarkdown,
  exportDocAndChildKeyInfoAsZip,
  exportDocIdsAsMarkdownZip,
} from "@/services/exporter";
import { getDocMetaByID } from "@/services/kernel";
import { getBacklinkDocs, getForwardLinkedDocIds } from "@/services/link-resolver";
import { PartialActionHandlerMap } from "@/plugin/action-runner-dispatcher";

type CreateExportActionHandlersOptions = {
  getKeyInfoFilter?: () => KeyInfoFilter | undefined;
};

const forwardLinksLogger = createDocAssistantLogger("ForwardLinks");

async function exportDocZip(ids: string[], label: string, currentDocId: string) {
  if (!ids.length) {
    showMessage(`未找到可导出的${label}文档`, 5000, "error");
    return;
  }

  const currentDoc = await getDocMetaByID(currentDocId);
  const preferredZipName = currentDoc?.title || currentDocId;
  const result = await exportDocIdsAsMarkdownZip(ids, preferredZipName);
  const displayName = decodeURIComponentSafe(result.name || "");
  const displayZip = decodeURIComponentSafe(result.zip || "");
  showMessage(`导出完成（${displayName}）：${displayZip}`, 9000, "info");
}

export function createExportActionHandlers(
  options: CreateExportActionHandlersOptions = {}
): PartialActionHandlerMap {
  return {
    "export-current": async (docId) => {
      const result = await exportCurrentDocMarkdown(docId);
      if (result.mode === "zip") {
        showMessage(
          `导出完成（含媒体）：${result.fileName}${result.zipPath ? `，路径 ${result.zipPath}` : ""}`,
          8000,
          "info"
        );
        return;
      }
      showMessage(`导出完成：${result.fileName}`, 5000, "info");
    },
    "export-child-key-info-zip": async (docId, protyle) => {
      const result = await exportDocAndChildKeyInfoAsZip({
        docId,
        filter: options.getKeyInfoFilter?.(),
        protyle,
      });
      showMessage(`导出完成：${result.docCount} 篇文档，${result.itemCount} 条关键内容`, 6000, "info");
    },
    "export-backlinks-zip": async (docId) => {
      const backlinks = await getBacklinkDocs(docId);
      const ids = backlinks.map((item) => item.id);
      await exportDocZip(ids, "反链", docId);
    },
    "export-forward-zip": async (docId) => {
      const ids = await getForwardLinkedDocIds(docId);
      forwardLinksLogger.debug("export-forward-zip trigger", {
        currentDocId: docId,
        forwardDocCount: ids.length,
        forwardDocIds: ids,
      });
      if (!ids.length) {
        showMessage(
          "未找到可导出的正链文档。请打开开发者工具查看 [DocAssistant][ForwardLinks] 调试日志",
          9000,
          "error"
        );
        return;
      }
      await exportDocZip(ids, "正链", docId);
    },
  };
}
