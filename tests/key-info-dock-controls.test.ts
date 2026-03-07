/** @vitest-environment jsdom */

import { describe, expect, test, vi } from "vitest";
import { createKeyInfoDock } from "@/ui/key-info-dock";
import type { KeyInfoItem, KeyInfoType } from "@/core/key-info-core";

function buildItem(id: string, type: KeyInfoType = "bold"): KeyInfoItem {
  return {
    id,
    type,
    text: `text-${id}`,
    raw: `text-${id}`,
    offset: 0,
    blockId: `block-${id}`,
    blockSort: 0,
    order: 0,
  };
}

describe("key-info-dock controls", () => {
  test("invokes footer refresh and export callbacks", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const onRefresh = vi.fn();
    const onExport = vi.fn();

    const dock = createKeyInfoDock(host, { onRefresh, onExport });

    const refreshBtn = host.querySelector(
      ".doc-assistant-keyinfo__footer-btn--refresh"
    ) as HTMLButtonElement | null;
    const exportBtn = host.querySelector(
      ".doc-assistant-keyinfo__footer-btn--export"
    ) as HTMLButtonElement | null;

    expect(refreshBtn).not.toBeNull();
    expect(exportBtn).not.toBeNull();

    refreshBtn?.click();
    exportBtn?.click();

    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onExport).toHaveBeenCalledTimes(1);

    dock.destroy();
    host.remove();
  });

  test("updates tab and filter active state from dock state and user clicks", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);

    const dock = createKeyInfoDock(host, { onExport: () => {} });
    dock.setState({
      items: [buildItem("1", "bold"), buildItem("2", "title")],
      filter: ["bold"],
    });

    const keyInfoTab = host.querySelector(
      '.doc-assistant-keyinfo__tab[data-tab="key-info"]'
    ) as HTMLButtonElement | null;
    const docProcessTab = host.querySelector(
      '.doc-assistant-keyinfo__tab[data-tab="doc-process"]'
    ) as HTMLButtonElement | null;
    const boldFilter = host.querySelector(
      '.doc-assistant-keyinfo__filter[data-type="bold"]'
    ) as HTMLButtonElement | null;
    const titleFilter = host.querySelector(
      '.doc-assistant-keyinfo__filter[data-type="title"]'
    ) as HTMLButtonElement | null;
    const allFilter = host.querySelector(
      '.doc-assistant-keyinfo__filter[data-type="all"]'
    ) as HTMLButtonElement | null;

    expect(keyInfoTab?.classList.contains("is-active")).toBe(true);
    expect(docProcessTab?.classList.contains("is-active")).toBe(false);
    expect(boldFilter?.classList.contains("is-active")).toBe(true);
    expect(titleFilter?.classList.contains("is-active")).toBe(false);
    expect(allFilter?.classList.contains("is-active")).toBe(false);

    docProcessTab?.click();
    expect(docProcessTab?.classList.contains("is-active")).toBe(true);
    expect(keyInfoTab?.classList.contains("is-active")).toBe(false);

    titleFilter?.click();
    expect(titleFilter?.classList.contains("is-active")).toBe(true);
    expect(allFilter?.classList.contains("is-active")).toBe(false);

    allFilter?.click();
    expect(allFilter?.classList.contains("is-active")).toBe(true);
    expect(boldFilter?.classList.contains("is-active")).toBe(true);
    expect(titleFilter?.classList.contains("is-active")).toBe(true);

    dock.destroy();
    host.remove();
  });
});
