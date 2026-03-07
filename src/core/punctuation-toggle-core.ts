export type PunctuationToggleMode = "en-to-zh" | "zh-to-en";

const EN_TO_ZH_PUNCTUATION_MAP: Record<string, string> = {
  ",": "，",
  ".": "。",
  "?": "？",
  "!": "！",
  ":": "：",
  ";": "；",
  "(": "（",
  ")": "）",
  "[": "【",
  "]": "】",
  "{": "｛",
  "}": "｝",
  "<": "《",
  ">": "》",
};

const ZH_TO_EN_PUNCTUATION_MAP: Record<string, string> = {
  "，": ",",
  "。": ".",
  "？": "?",
  "！": "!",
  "：": ":",
  "；": ";",
  "（": "(",
  "）": ")",
  "【": "[",
  "】": "]",
  "｛": "{",
  "｝": "}",
  "《": "<",
  "》": ">",
  "、": ",",
  "“": "\"",
  "”": "\"",
  "‘": "'",
  "’": "'",
};

const EN_PUNCTUATION_SET = new Set(Object.keys(EN_TO_ZH_PUNCTUATION_MAP));
const ZH_PUNCTUATION_SET = new Set(Object.keys(ZH_TO_EN_PUNCTUATION_MAP));

function applyPunctuationMap(
  value: string,
  map: Record<string, string>
): { next: string; changedCount: number } {
  let changedCount = 0;
  const next = Array.from(value || "")
    .map((char) => {
      const converted = map[char];
      if (converted === undefined) {
        return char;
      }
      if (converted !== char) {
        changedCount += 1;
      }
      return converted;
    })
    .join("");

  return { next, changedCount };
}

export function detectPunctuationToggleMode(value: string): PunctuationToggleMode {
  let hasSupportedPunctuation = false;
  let hasEnglishPunctuation = false;

  for (const char of Array.from(value || "")) {
    if (EN_PUNCTUATION_SET.has(char)) {
      hasSupportedPunctuation = true;
      hasEnglishPunctuation = true;
      continue;
    }
    if (ZH_PUNCTUATION_SET.has(char)) {
      hasSupportedPunctuation = true;
    }
  }

  if (!hasSupportedPunctuation) {
    return "en-to-zh";
  }
  return hasEnglishPunctuation ? "en-to-zh" : "zh-to-en";
}

export function convertChineseEnglishPunctuation(
  value: string,
  mode: PunctuationToggleMode
): { next: string; changedCount: number } {
  const map =
    mode === "zh-to-en"
      ? ZH_TO_EN_PUNCTUATION_MAP
      : EN_TO_ZH_PUNCTUATION_MAP;
  return applyPunctuationMap(value || "", map);
}

export function toggleChineseEnglishPunctuation(value: string): {
  mode: PunctuationToggleMode;
  next: string;
  changedCount: number;
} {
  const mode = detectPunctuationToggleMode(value || "");
  const converted = convertChineseEnglishPunctuation(value || "", mode);
  return {
    mode,
    next: converted.next,
    changedCount: converted.changedCount,
  };
}
