const stripInlineMarkdown = (text: string): string =>
  text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`~]/g, "")
    .trim();

/** Returns the first H1 heading of a Markdown post, or a fallback. */
export const getPostTitle = (markdown: string, fallback = "Untitled post"): string => {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? stripInlineMarkdown(match[1]) : fallback;
};

/** Returns a plain-text excerpt from the body of a Markdown post. */
export const getPostExcerpt = (markdown: string, maxLength = 160): string => {
  const body = markdown
    .split("\n")
    .filter((line) => line.trim() && !/^\s*(#|>|---|\*\*\*)/.test(line))
    .map((line) => stripInlineMarkdown(line.replace(/^\s*([-*+]|\d+[.)])\s+/, "")))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return body.length > maxLength ? `${body.slice(0, maxLength).trimEnd()}…` : body;
};

/** Returns the 11-character YouTube video ID from a URL, or null. */
export const getYoutubeId = (url?: string | null): string | null => {
  if (!url) return null;
  const match = url.match(/(?:v=|\/embed\/|\/shorts\/|\/live\/|youtu\.be\/)([0-9A-Za-z_-]{11})/);
  return match ? match[1] : null;
};
