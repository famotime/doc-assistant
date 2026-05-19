export function openDocByProtocol(blockId: string) {
  const url = `siyuan://blocks/${blockId}`;
  try {
    window.open(url);
  } catch {
    window.location.href = url;
  }
}
