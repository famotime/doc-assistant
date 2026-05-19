import { KeyInfoType } from "@/core/key-info-core";
import { tokenizeType } from "@/services/key-info-model";

function hasBackgroundHighlightStyle(value: string): boolean {
  const normalized = (value || "").toLowerCase();
  return (
    normalized.includes("background-color") ||
    normalized.includes("background:") ||
    normalized.includes("--b3-font-background")
  );
}

function hasColorHighlightStyle(value: string): boolean {
  const normalized = (value || "").toLowerCase();
  return normalized.includes("color:") || normalized.includes("--b3-font-color");
}

function hasExcludedGenericHighlightToken(tokens: string[]): boolean {
  const hasToken = (token: string) => tokens.includes(token);
  const hasInlineMathToken =
    (hasToken("inline") && hasToken("math")) ||
    hasToken("inlinemath") ||
    hasToken("mathjax") ||
    hasToken("katex");
  return (
    hasToken("code") ||
    hasToken("kbd") ||
    hasToken("s") ||
    hasToken("strike") ||
    hasToken("strikethrough") ||
    hasToken("formula") ||
    hasInlineMathToken
  );
}

export function resolveSpanFormatType(spanType: string, ial?: string): KeyInfoType | null {
  const normalized = [spanType, ial].filter(Boolean).join(" ").toLowerCase();
  const tokens = tokenizeType(normalized);
  const hasToken = (token: string) => tokens.includes(token);
  const hasLinkToken =
    hasToken("a") ||
    hasToken("link") ||
    normalized.includes("href=") ||
    normalized.includes("data-href=");
  const hasInlineMemo =
    normalized.includes("inline-memo") ||
    (hasToken("inline") && hasToken("memo"));
  if (hasInlineMemo) {
    return "remark";
  }
  if (hasToken("tag")) {
    return "tag";
  }
  if (hasToken("strong")) {
    return "bold";
  }
  if (hasToken("em")) {
    return "italic";
  }
  if (hasToken("u") || hasToken("underline") || hasToken("ins")) {
    return "underline";
  }
  const hasExplicitHighlightToken = hasToken("mark");
  const hasGenericHighlightToken = hasToken("textmark") || hasToken("text");
  const hasSuperOrSubscriptToken =
    hasToken("sup") || hasToken("superscript") || hasToken("sub") || hasToken("subscript");
  if ((hasExplicitHighlightToken || hasGenericHighlightToken) && hasSuperOrSubscriptToken) {
    return null;
  }
  if (hasExcludedGenericHighlightToken(tokens)) {
    return null;
  }
  if (hasExplicitHighlightToken) {
    return "highlight";
  }
  if (!hasLinkToken && hasToken("textmark")) {
    return "highlight";
  }
  if (
    !hasLinkToken &&
    hasToken("text") &&
    (hasBackgroundHighlightStyle(normalized) || hasColorHighlightStyle(normalized))
  ) {
    return "highlight";
  }
  return null;
}
