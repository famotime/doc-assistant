import { showMessage } from "siyuan";
import { resizeDocImagesToDisplay } from "@/services/image-display-size";
import { removeDocImageLinks } from "@/services/image-remove";
import { convertDocImagesToPng } from "@/services/image-png";
import { convertDocImagesToWebp } from "@/services/image-webp";
import { PartialActionHandlerMap } from "@/plugin/action-runner-dispatcher";

export function createMediaActionHandlers(): PartialActionHandlerMap {
  return {
    "convert-images-to-webp": async (docId) => {
      const report = await convertDocImagesToWebp(docId);
      if (report.scannedImageCount <= 0) {
        showMessage("当前文档未发现可转换的本地图片", 5000, "info");
        return;
      }
      if (report.replacedLinkCount <= 0) {
        if (report.failedImageCount > 0) {
          showMessage(`未完成任何替换，失败 ${report.failedImageCount} 张图片`, 7000, "error");
          return;
        }
        showMessage("未完成任何替换（可能已是 WebP 或压缩收益不足）", 5000, "info");
        return;
      }
      const savedKb = (report.totalSavedBytes / 1024).toFixed(1);
      const gifSuffix = report.skippedGifCount > 0 ? `（已忽略 GIF ${report.skippedGifCount} 张）` : "";
      const suffix = report.failedImageCount > 0 ? `，失败 ${report.failedImageCount} 张` : "";
      showMessage(
        `图片转换完成：替换 ${report.replacedLinkCount} 处，更新 ${report.updatedBlockCount} 个块，转换 ${report.convertedImageCount} 张，节省 ${savedKb} KB${gifSuffix}${suffix}`,
        report.failedImageCount > 0 ? 7000 : 6000,
        report.failedImageCount > 0 ? "error" : "info"
      );
    },
    "convert-images-to-png": async (docId) => {
      const report = await convertDocImagesToPng(docId);
      if (report.scannedImageCount <= 0) {
        showMessage("当前文档未发现可转换的本地图片", 5000, "info");
        return;
      }
      if (report.replacedLinkCount <= 0) {
        if (report.failedImageCount > 0) {
          showMessage(`未完成任何替换，失败 ${report.failedImageCount} 张图片`, 7000, "error");
          return;
        }
        showMessage("未完成任何替换（已是 PNG 或仅包含 GIF）", 5000, "info");
        return;
      }
      const suffix =
        report.failedImageCount > 0 ? `，失败 ${report.failedImageCount} 张` : "";
      showMessage(
        `PNG 转换完成：替换 ${report.replacedLinkCount} 处，更新 ${report.updatedBlockCount} 个块，转换 ${report.convertedImageCount} 张（已忽略 GIF）${suffix}`,
        report.failedImageCount > 0 ? 7000 : 6000,
        report.failedImageCount > 0 ? "error" : "info"
      );
    },
    "resize-images-to-display": async (docId) => {
      const report = await resizeDocImagesToDisplay(docId);
      if (report.scannedImageCount <= 0) {
        showMessage("当前文档未发现带显示尺寸的本地图片", 5000, "info");
        return;
      }
      if (report.replacedLinkCount <= 0) {
        if (report.failedImageCount > 0) {
          showMessage(`未完成任何替换，失败 ${report.failedImageCount} 张图片`, 7000, "error");
          return;
        }
        showMessage("未完成任何替换（可能尺寸未缩小或压缩收益不足）", 5000, "info");
        return;
      }
      const savedKb = (report.totalSavedBytes / 1024).toFixed(1);
      const suffix =
        report.failedImageCount > 0 ? `，失败 ${report.failedImageCount} 张` : "";
      showMessage(
        `图片尺寸调整完成：替换 ${report.replacedLinkCount} 处，更新 ${report.updatedBlockCount} 个块，缩减 ${report.resizedImageCount} 张，节省 ${savedKb} KB${suffix}`,
        report.failedImageCount > 0 ? 7000 : 6000,
        report.failedImageCount > 0 ? "error" : "info"
      );
    },
    "remove-doc-images": async (docId) => {
      const report = await removeDocImageLinks(docId);
      if (report.scannedImageLinkCount <= 0) {
        showMessage("当前文档未发现可删除的图片链接", 5000, "info");
        return;
      }
      if (report.removedLinkCount <= 0) {
        showMessage(`未删除任何图片链接，失败 ${report.failedBlockCount} 个块`, 7000, "error");
        return;
      }
      const suffix = report.failedBlockCount > 0 ? `，失败 ${report.failedBlockCount} 个块` : "";
      showMessage(
        `图片链接删除完成：删除 ${report.removedLinkCount} 处，更新 ${report.updatedBlockCount} 个块${suffix}`,
        report.failedBlockCount > 0 ? 7000 : 6000,
        report.failedBlockCount > 0 ? "error" : "info"
      );
    },
  };
}
