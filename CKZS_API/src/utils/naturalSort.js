const zhNaturalCollator = new Intl.Collator('zh-CN', {
  numeric: true,
  sensitivity: 'base',
});

export const compareByRemarkName = (a, b, order = 'asc') => {
  const aName = String(a?.remarkName ?? '').trim();
  const bName = String(b?.remarkName ?? '').trim();

  if (!aName && !bName) return Number(b?.id || 0) - Number(a?.id || 0);
  if (!aName) return 1;
  if (!bName) return -1;

  const cmp = zhNaturalCollator.compare(aName, bName);
  if (cmp !== 0) {
    return order === 'desc' ? -cmp : cmp;
  }

  return Number(b?.id || 0) - Number(a?.id || 0);
};
