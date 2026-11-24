/** The page numbers a pager shows: every page up to seven, otherwise the first, the last and the
    pages around the current one, with "..." where pages are left out. */
export const buildPageList = (current: number, total: number): (number | "...")[] => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "...")[] = [1];
  if (current > 3) pages.push("...");
  for (
    let index = Math.max(2, current - 1);
    index <= Math.min(total - 1, current + 1);
    index += 1
  ) {
    pages.push(index);
  }
  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
};
