/**
 * Lead with pictures: within the first `top` items, places with a photo come
 * first, then by score. The rest keep their order.
 */
export function photoFirst<T extends { image?: string; score?: number }>(list: T[], top = 24): T[] {
  const head = list.slice(0, top).sort(
    (a, b) => Number(!!b.image) - Number(!!a.image) || (b.score ?? 0) - (a.score ?? 0),
  );
  return [...head, ...list.slice(top)];
}
