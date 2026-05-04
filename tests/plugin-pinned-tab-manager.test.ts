/** @vitest-environment jsdom */

import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  createPinnedTabPlacementManager,
  type PinnedTabPlacementManagedTab,
} from "@/plugin/plugin-pinned-tab-manager";

function buildTab(id: string, pin = false): PinnedTabPlacementManagedTab {
  return {
    id,
    pin,
    headElement: document.createElement("div"),
  };
}

function attachParent(parent: { children: PinnedTabPlacementManagedTab[]; moveTab?: (tab: PinnedTabPlacementManagedTab, nextId?: string) => void }, tab: PinnedTabPlacementManagedTab) {
  tab.parent = parent;
}

describe("plugin pinned tab manager", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  test("tracks known tab ids from multiple layout roots", () => {
    const manager = createPinnedTabPlacementManager();

    manager.seedKnownTabIds({
      layout: {
        centerLayout: {
          children: [{ children: [{ id: "layout-a" }, { id: "layout-b" }] }],
        },
      },
      config: {
        uiLayout: {
          layout: {
            children: [{ children: [{ id: "layout-c" }] }],
          },
        },
      },
    });

    expect(manager.isKnownTabId("layout-a")).toBe(true);
    expect(manager.isKnownTabId("layout-b")).toBe(true);
    expect(manager.isKnownTabId("layout-c")).toBe(true);
    expect(manager.isKnownTabId("missing")).toBe(false);
  });

  test("moves a newly seen tab behind pinned tabs and keeps the pinned header visible", () => {
    const manager = createPinnedTabPlacementManager();
    const pinnedTab = buildTab("pinned", true);
    const oldTab = buildTab("doc-old");
    const newTab = buildTab("doc-new");
    const scrollIntoView = vi.fn();
    pinnedTab.headElement = document.createElement("div");
    (pinnedTab.headElement as HTMLElement).scrollIntoView = scrollIntoView;
    const parent = {
      children: [pinnedTab, oldTab, newTab],
      moveTab: vi.fn((tab: PinnedTabPlacementManagedTab, nextId?: string) => {
        const currentIndex = parent.children.indexOf(tab);
        if (currentIndex >= 0) {
          parent.children.splice(currentIndex, 1);
        }
        const nextIndex = parent.children.findIndex((item) => item.id === nextId);
        if (nextIndex < 0) {
          parent.children.push(tab);
          return;
        }
        parent.children.splice(nextIndex, 0, tab);
      }),
    };
    attachParent(parent, pinnedTab);
    attachParent(parent, oldTab);
    attachParent(parent, newTab);

    manager.seedKnownTabIds({
      layout: {
        centerLayout: {
          children: [{ children: [pinnedTab, oldTab] }],
        },
      },
    });

    manager.handleProtyleSwitch({
      protyle: { model: { parent: newTab } },
      enabled: true,
      isMobile: false,
    });

    expect(parent.children.map((tab) => tab.id)).toEqual(["pinned", "doc-new", "doc-old"]);
    expect(parent.moveTab).toHaveBeenCalledWith(newTab, "doc-old");
    expect(scrollIntoView).toHaveBeenCalledWith({
      block: "nearest",
      inline: "start",
    });
  });

  test("retries placement after tab siblings become available later", async () => {
    vi.useFakeTimers();

    const manager = createPinnedTabPlacementManager();
    const pinnedTab = buildTab("pinned", true);
    const oldTab = buildTab("doc-old");
    const newTab = buildTab("doc-new");
    const parent = {
      children: [pinnedTab, oldTab],
      moveTab: vi.fn((tab: PinnedTabPlacementManagedTab, nextId?: string) => {
        const currentIndex = parent.children.indexOf(tab);
        if (currentIndex >= 0) {
          parent.children.splice(currentIndex, 1);
        }
        const nextIndex = parent.children.findIndex((item) => item.id === nextId);
        if (nextIndex < 0) {
          parent.children.push(tab);
          return;
        }
        parent.children.splice(nextIndex, 0, tab);
      }),
    };
    attachParent(parent, pinnedTab);
    attachParent(parent, oldTab);
    attachParent(parent, newTab);

    manager.seedKnownTabIds({
      layout: {
        centerLayout: {
          children: [{ children: [pinnedTab, oldTab] }],
        },
      },
    });

    manager.handleProtyleSwitch({
      protyle: { model: { parent: newTab } },
      enabled: true,
      isMobile: false,
    });

    expect(parent.moveTab).not.toHaveBeenCalled();

    parent.children = [pinnedTab, oldTab, newTab];
    attachParent(parent, pinnedTab);
    attachParent(parent, oldTab);
    attachParent(parent, newTab);

    await vi.runAllTimersAsync();

    expect(parent.children.map((tab) => tab.id)).toEqual(["pinned", "doc-new", "doc-old"]);
  });
});
