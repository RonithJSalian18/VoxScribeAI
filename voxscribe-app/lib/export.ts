import { marked } from "marked";
import { BackendError, fetchBackend } from "@/lib/api";
import { getPostTitle } from "@/lib/markdown";

const slugify = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "-")
    .slice(0, 80) || "post";

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** Renders Markdown into a standalone, printable HTML document. */
export const toHtmlDocument = (markdown: string): string => {
  const title = getPostTitle(markdown);
  const body = marked.parse(markdown, { async: false });
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: Georgia, "Times New Roman", serif; max-width: 720px; margin: 48px auto; padding: 0 20px; line-height: 1.7; color: #18181b; }
  h1, h2, h3 { font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; line-height: 1.25; }
  h1 { font-size: 2.2rem; }
  blockquote { border-left: 4px solid #6366f1; margin: 1.5em 0; padding: 0.5em 1.25em; background: #eef2ff; }
  code { background: #f4f4f5; padding: 0.1em 0.35em; border-radius: 4px; }
  pre code { display: block; padding: 1em; overflow-x: auto; }
  a { color: #4f46e5; }
  img { max-width: 100%; }
</style>
</head>
<body>
${body}
</body>
</html>`;
};

export const exportMarkdown = (markdown: string) =>
  downloadBlob(new Blob([markdown], { type: "text/markdown;charset=utf-8" }), `${slugify(getPostTitle(markdown))}.md`);

export const exportHtml = (markdown: string) =>
  downloadBlob(new Blob([toHtmlDocument(markdown)], { type: "text/html;charset=utf-8" }), `${slugify(getPostTitle(markdown))}.html`);

/** Prints the post via a hidden iframe so the user can "Save as PDF" (no popup needed). */
export const exportPdf = (markdown: string) => {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  if (!doc || !iframe.contentWindow) {
    iframe.remove();
    return;
  }
  doc.open();
  doc.write(toHtmlDocument(markdown));
  doc.close();

  const win = iframe.contentWindow;
  setTimeout(() => {
    win.focus();
    win.print();
    setTimeout(() => iframe.remove(), 1000);
  }, 250);
};

export const exportDocx = async (markdown: string, accessToken: string | null) => {
  const title = getPostTitle(markdown);
  const response = await fetchBackend(
    "/posts/export/docx",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: markdown, filename: title }),
    },
    accessToken
  );
  if (!response.ok) throw new BackendError(`Word export failed (${response.status}).`);
  downloadBlob(await response.blob(), `${slugify(title)}.docx`);
};
