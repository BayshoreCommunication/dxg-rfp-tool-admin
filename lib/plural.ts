/** "0 proposals", "1 proposal", "1,234 proposals": a count with its noun in the right number. */
export const countLabel = (count: number, singular: string, plural = `${singular}s`): string => {
  // Backend JSON is untyped at runtime: a count that arrives as "1" still reads "1 proposal".
  const value = Number(count);
  return `${value.toLocaleString("en-US")} ${value === 1 ? singular : plural}`;
};
