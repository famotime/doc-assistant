export function resolveInsertBeforeFromGeometry(options: {
  top: number;
  height: number;
  clientY: number;
}): boolean {
  if (!options.height || Number.isNaN(options.clientY)) {
    return false;
  }
  return options.clientY < options.top + options.height / 2;
}

export function reorderFavoriteActionKeys(
  order: readonly string[],
  sourceKey: string,
  targetKey: string,
  insertBefore: boolean
): string[] {
  if (!sourceKey || !targetKey || sourceKey === targetKey) {
    return [...order];
  }
  const sourceIndex = order.indexOf(sourceKey);
  const targetIndex = order.indexOf(targetKey);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
    return [...order];
  }
  const next = [...order];
  const [dragged] = next.splice(sourceIndex, 1);
  if (!dragged) {
    return [...order];
  }
  const currentTargetIndex = next.indexOf(targetKey);
  if (currentTargetIndex < 0) {
    return [...order];
  }
  const insertIndex = insertBefore ? currentTargetIndex : currentTargetIndex + 1;
  next.splice(insertIndex, 0, dragged);
  return next;
}
