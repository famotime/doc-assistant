import { describe, expect, test } from "vitest";
import {
  convertChineseEnglishPunctuation,
  detectPunctuationToggleMode,
  toggleChineseEnglishPunctuation,
} from "@/core/punctuation-toggle-core";

describe("punctuation-toggle-core", () => {
  test("defaults to english-to-chinese mode when english punctuation exists", () => {
    expect(detectPunctuationToggleMode("Hello, world!")).toBe("en-to-zh");
    expect(detectPunctuationToggleMode("你好，world!")).toBe("en-to-zh");
  });

  test("switches to chinese-to-english mode when punctuation is all chinese", () => {
    expect(detectPunctuationToggleMode("你好，世界！")).toBe("zh-to-en");
  });

  test("converts english punctuation to chinese by mode", () => {
    const result = convertChineseEnglishPunctuation("A, B. C?", "en-to-zh");
    expect(result).toEqual({
      next: "A， B。 C？",
      changedCount: 3,
    });
  });

  test("converts chinese punctuation to english by mode", () => {
    const result = convertChineseEnglishPunctuation("你好，世界！", "zh-to-en");
    expect(result).toEqual({
      next: "你好,世界!",
      changedCount: 2,
    });
  });

  test("auto toggles by detected mode", () => {
    expect(toggleChineseEnglishPunctuation("Hello, world!")).toEqual({
      mode: "en-to-zh",
      next: "Hello， world！",
      changedCount: 2,
    });
    expect(toggleChineseEnglishPunctuation("你好，世界！")).toEqual({
      mode: "zh-to-en",
      next: "你好,世界!",
      changedCount: 2,
    });
  });
});
