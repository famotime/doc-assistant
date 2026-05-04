import {
  collectLayoutTabIds,
  isPinnedTab,
  resolveMoveTabNextIdAfterPinned,
  type PinnedTabPlacementLike,
} from "@/core/pinned-tab-placement-core";

type LayoutStateLike = {
  layout?: {
    centerLayout?: unknown;
  };
  config?: {
    uiLayout?: {
      layout?: unknown;
    };
  };
};

export type PinnedTabPlacementManagedTab = PinnedTabPlacementLike & {
  id: string;
  parent?: {
    children?: PinnedTabPlacementManagedTab[];
    moveTab?: (tab: PinnedTabPlacementManagedTab, nextId?: string) => void;
  };
};

type PinnedTabPlacementProtyleLike = {
  model?: {
    parent?: unknown;
  };
};

type HandleProtyleSwitchOptions = {
  protyle?: PinnedTabPlacementProtyleLike;
  enabled: boolean;
  isMobile: boolean;
};

type CreatePinnedTabPlacementManagerOptions = {
  retryDelays?: number[];
};

export function createPinnedTabPlacementManager(
  options: CreatePinnedTabPlacementManagerOptions = {}
) {
  const retryDelays = options.retryDelays || [0, 32, 96, 192];
  const knownTabIds = new Set<string>();
  const pendingTasks = new Map<string, ReturnType<typeof setTimeout>>();

  const getSiblingTabs = (currentTab: PinnedTabPlacementManagedTab): PinnedTabPlacementManagedTab[] => {
    return Array.isArray(currentTab.parent?.children) ? currentTab.parent.children : [];
  };

  const getProtyleTab = (protyle?: PinnedTabPlacementProtyleLike): PinnedTabPlacementManagedTab | null => {
    const tab = protyle?.model?.parent as PinnedTabPlacementManagedTab | undefined;
    if (!tab || typeof tab !== "object") {
      return null;
    }
    return typeof tab.id === "string" ? tab : null;
  };

  const revealPinnedTabHeaders = (tabs: PinnedTabPlacementManagedTab[]) => {
    const firstPinnedTab = tabs.find((tab) => isPinnedTab(tab));
    const headElement = firstPinnedTab?.headElement;
    if (!headElement || !(headElement instanceof HTMLElement)) {
      return;
    }
    if (typeof headElement.scrollIntoView === "function") {
      headElement.scrollIntoView({
        block: "nearest",
        inline: "start",
      });
      return;
    }
    const tabStrip = headElement.parentElement;
    if (tabStrip) {
      tabStrip.scrollLeft = 0;
    }
  };

  const placeTabBehindPinnedAndKeepPinnedVisible = (currentTab: PinnedTabPlacementManagedTab) => {
    const siblingTabs = getSiblingTabs(currentTab);
    if (!siblingTabs.length) {
      return;
    }

    const currentIndex = siblingTabs.findIndex((tab) => tab.id === currentTab.id);
    if (currentIndex < 0) {
      revealPinnedTabHeaders(siblingTabs);
      return;
    }

    const desiredIndex = siblingTabs.reduce((lastPinnedIndex, tab, index) => {
      return isPinnedTab(tab) ? index : lastPinnedIndex;
    }, -1) + 1;

    if (desiredIndex <= 0 || currentIndex === desiredIndex) {
      revealPinnedTabHeaders(siblingTabs);
      return;
    }

    const moveTab = currentTab.parent?.moveTab;
    if (typeof moveTab !== "function") {
      revealPinnedTabHeaders(siblingTabs);
      return;
    }

    let latestTabs = siblingTabs;
    const nextId = resolveMoveTabNextIdAfterPinned(latestTabs, currentTab.id);
    if (nextId) {
      try {
        moveTab(currentTab, nextId);
      } finally {
        latestTabs = getSiblingTabs(currentTab);
      }
    }

    revealPinnedTabHeaders(latestTabs);
  };

  const scheduleRetry = (
    tabId: string,
    protyle: PinnedTabPlacementProtyleLike | undefined,
    enabled: boolean,
    isMobile: boolean,
    attempt = 0
  ) => {
    const delay = retryDelays[attempt];
    if (typeof delay === "undefined") {
      return;
    }

    if (attempt === 0) {
      const pending = pendingTasks.get(tabId);
      if (typeof pending !== "undefined") {
        clearTimeout(pending);
      }
    }

    const task = setTimeout(() => {
      pendingTasks.delete(tabId);
      if (!enabled || isMobile) {
        return;
      }
      const currentTab = getProtyleTab(protyle);
      if (!currentTab || currentTab.id !== tabId) {
        return;
      }
      placeTabBehindPinnedAndKeepPinnedVisible(currentTab);
      scheduleRetry(tabId, protyle, enabled, isMobile, attempt + 1);
    }, delay);

    pendingTasks.set(tabId, task);
  };

  return {
    seedKnownTabIds(layoutState?: LayoutStateLike) {
      for (const id of collectLayoutTabIds(layoutState?.layout?.centerLayout)) {
        knownTabIds.add(id);
      }
      for (const id of collectLayoutTabIds(layoutState?.config?.uiLayout?.layout)) {
        knownTabIds.add(id);
      }
    },

    isKnownTabId(tabId: string) {
      return knownTabIds.has(tabId);
    },

    handleProtyleSwitch({ protyle, enabled, isMobile }: HandleProtyleSwitchOptions) {
      const currentTab = getProtyleTab(protyle);
      if (!currentTab?.id || !enabled || isMobile) {
        return;
      }

      const siblingTabs = getSiblingTabs(currentTab);
      const isKnownTab = knownTabIds.has(currentTab.id);
      siblingTabs.forEach((tab) => {
        if (tab?.id) {
          knownTabIds.add(tab.id);
        }
      });
      knownTabIds.add(currentTab.id);

      if (isKnownTab) {
        return;
      }

      placeTabBehindPinnedAndKeepPinnedVisible(currentTab);
      scheduleRetry(currentTab.id, protyle, enabled, isMobile);
    },

    clearPendingTasks() {
      pendingTasks.forEach((task) => {
        clearTimeout(task);
      });
      pendingTasks.clear();
    },
  };
}
