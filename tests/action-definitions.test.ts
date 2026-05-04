import { describe, expect, test } from "vitest";
import { ACTIONS } from "@/plugin/actions";
import { ACTION_DEFINITIONS_BY_GROUP } from "@/plugin/action-definitions";

describe("action definitions", () => {
  test("keeps grouped action definitions flattened in the same export order", () => {
    const groupedKeys = ACTION_DEFINITIONS_BY_GROUP.flatMap((entry) =>
      entry.actions.map((action) => action.key)
    );

    expect(groupedKeys).toEqual(ACTIONS.map((action) => action.key));
  });

  test("keeps every grouped action aligned with its group label", () => {
    for (const entry of ACTION_DEFINITIONS_BY_GROUP) {
      for (const action of entry.actions) {
        expect(action.group).toBe(entry.group);
      }
    }
  });
});
