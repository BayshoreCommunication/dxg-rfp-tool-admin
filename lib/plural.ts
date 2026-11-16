/** "0 proposals", "1 proposal", "1,234 proposals": a count with its noun in the right number. */
export const countLabel = (count: number, singular: string, plural = `${singular}s`): string =>
  `${count.toLocaleString("en-US")} ${count === 1 ? singular : plural}`;
