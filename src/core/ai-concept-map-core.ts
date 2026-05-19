export function buildConceptMapDocTitle(docTitle: string, now = new Date()): string {
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const prefix = (docTitle || "").trim();
  return `${prefix ? `${prefix}-` : ""}概念地图-${yyyy}${mm}${dd}-${hh}${min}${ss}`;
}

export function joinChildDocHPath(parentHPath: string, title: string): string {
  const base = (parentHPath || "").trim().replace(/\/+$/u, "");
  if (!base) {
    return `/${title}`;
  }
  return `${base}/${title}`;
}
