"use client";

import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  FileText,
  Copy,
  Check,
  Pencil,
  Eye,
  Save,
  Download,
  Search,
  Send,
  Loader2,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import { apiJson } from "@/lib/api";
import { exportDocx, exportHtml, exportMarkdown, exportPdf } from "@/lib/export";
import { getYoutubeId } from "@/lib/markdown";
import { SeoPanel } from "@/components/dashboard/SeoPanel";
import { PublishDialog } from "@/components/dashboard/PublishDialog";
import { UserProfile } from "@/types";

interface BlogResultViewerProps {
  result: string;
  user: UserProfile | null;
  createdAt?: string;
  label?: string;
  postId?: string | null;
  sourceUrl?: string | null;
  voiceId?: string | null;
  supabase?: SupabaseClient | null;
  getAccessToken: () => Promise<string | null>;
  onSaved?: (content: string) => void;
}

const REWRITE_PRESETS = ["Make it punchier", "Make it shorter", "Add more detail", "Simplify the language"];

const PROSE_CLASSES =
  "prose prose-zinc prose-lg md:prose-xl prose-headings:font-bold prose-headings:tracking-tight prose-h1:text-4xl prose-h1:mb-8 prose-h1:leading-tight prose-h2:text-2xl prose-h2:mt-12 prose-a:text-indigo-600 hover:prose-a:text-indigo-500 prose-blockquote:border-l-indigo-500 prose-blockquote:bg-indigo-50/50 prose-blockquote:py-2 prose-blockquote:px-6 prose-blockquote:rounded-r-2xl prose-blockquote:font-medium prose-blockquote:not-italic prose-blockquote:text-indigo-900 prose-li:marker:text-indigo-500 max-w-none";

export function BlogResultViewer({
  result,
  user,
  createdAt,
  label = "Generated Draft",
  postId,
  sourceUrl,
  voiceId,
  supabase,
  getAccessToken,
  onSaved,
}: BlogResultViewerProps) {
  const [content, setContent] = useState(result);
  const [savedContent, setSavedContent] = useState(result);
  const [mode, setMode] = useState<"preview" | "edit">("preview");
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [showSeo, setShowSeo] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [seoTags, setSeoTags] = useState<string[]>([]);
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
  const [instruction, setInstruction] = useState("");
  const [isRewriting, setIsRewriting] = useState(false);
  const [coverFallback, setCoverFallback] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isDirty = content !== savedContent;
  const canSave = Boolean(supabase && postId);
  const youtubeId = getYoutubeId(sourceUrl);
  const coverUrl = youtubeId
    ? `https://img.youtube.com/vi/${youtubeId}/${coverFallback ? "hqdefault" : "maxresdefault"}.jpg`
    : null;

  const userInitial = user?.email ? user.email.charAt(0).toUpperCase() : "U";
  const userName = user?.email ? user.email.split("@")[0] : "Author";

  const flash = (kind: "success" | "error", text: string) => {
    setNotice({ kind, text });
    setTimeout(() => setNotice(null), 4000);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    if (!supabase || !postId) return;
    setIsSaving(true);
    const { error } = await supabase.from("blog_posts").update({ content }).eq("id", postId);
    setIsSaving(false);
    if (error) return flash("error", error.message);
    setSavedContent(content);
    onSaved?.(content);
    flash("success", "Changes saved.");
  };

  const handleExport = async (format: "md" | "html" | "pdf" | "docx") => {
    setShowExport(false);
    try {
      if (format === "md") exportMarkdown(content);
      else if (format === "html") exportHtml(content);
      else if (format === "pdf") exportPdf(content);
      else await exportDocx(content, await getAccessToken());
    } catch (err) {
      flash("error", err instanceof Error ? err.message : "Export failed.");
    }
  };

  const trackSelection = () => {
    const el = textareaRef.current;
    if (!el) return;
    setSelection(el.selectionEnd > el.selectionStart ? { start: el.selectionStart, end: el.selectionEnd } : null);
  };

  const handleRewrite = async (preset?: string) => {
    if (!selection) return;
    const { start, end } = selection;
    const text = content.slice(start, end);
    setIsRewriting(true);
    try {
      const data = await apiJson<{ text: string }>("/posts/rewrite", await getAccessToken(), {
        method: "POST",
        body: JSON.stringify({
          text,
          instruction: preset || instruction || "Improve clarity and flow",
          context: content.slice(Math.max(0, start - 1500), Math.min(content.length, end + 1500)),
          voice_id: voiceId ?? null,
        }),
      });
      const next = content.slice(0, start) + data.text + content.slice(end);
      setContent(next);
      setSelection(null);
      setInstruction("");
      // Re-select the rewritten passage so the user can see (or rewrite) it again
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
        textareaRef.current?.setSelectionRange(start, start + data.text.length);
        setSelection({ start, end: start + data.text.length });
      });
    } catch (err) {
      flash("error", err instanceof Error ? err.message : "Rewrite failed.");
    } finally {
      setIsRewriting(false);
    }
  };

  const toolbarButton =
    "text-sm font-medium px-3.5 py-2 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50";

  return (
    <section className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-zinc-100 mt-4 animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-hidden">
      {/* Cover: video thumbnail for YouTube sources, decorative gradient otherwise */}
      <div className="h-32 md:h-48 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 w-full relative">
        {coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt=""
            onError={() => setCoverFallback(true)}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        <div className="absolute -bottom-6 left-8 bg-white p-2 rounded-2xl shadow-sm">
          <div className="bg-zinc-100 w-12 h-12 rounded-xl flex items-center justify-center">
            <FileText className="w-6 h-6 text-indigo-600" />
          </div>
        </div>
      </div>

      <div className="p-6 md:p-12 pt-12">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end mb-8 pb-6 border-b border-zinc-100 gap-4">
          <div>
            <p className="text-sm font-semibold tracking-widest text-indigo-500 uppercase mb-3">{label}</p>
            <div className="flex items-center gap-3 text-sm text-zinc-500">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-700 shadow-sm border border-indigo-200">
                {userInitial}
              </div>
              <span className="font-medium text-zinc-700">By {userName}</span>
              <span>•</span>
              <span>
                {(createdAt ? new Date(createdAt) : new Date()).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setMode(mode === "edit" ? "preview" : "edit")}
              className={`${toolbarButton} ${mode === "edit" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}
            >
              {mode === "edit" ? <Eye className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
              {mode === "edit" ? "Preview" : "Edit"}
            </button>
            {canSave && (
              <button
                onClick={handleSave}
                disabled={!isDirty || isSaving}
                className={`${toolbarButton} bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isDirty ? "Save" : "Saved"}
              </button>
            )}
            <button onClick={handleCopy} className={`${toolbarButton} bg-indigo-50 text-indigo-600 hover:bg-indigo-100`}>
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied!" : "Copy"}
            </button>
            <div className="relative">
              <button
                onClick={() => setShowExport((v) => !v)}
                className={`${toolbarButton} bg-zinc-100 text-zinc-700 hover:bg-zinc-200`}
                aria-expanded={showExport}
              >
                <Download className="w-4 h-4" />
                Export
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {showExport && (
                <div className="absolute right-0 mt-2 w-44 bg-white border border-zinc-100 rounded-xl shadow-lg py-1 z-20">
                  {([
                    ["md", "Markdown (.md)"],
                    ["html", "HTML (.html)"],
                    ["pdf", "PDF (print)"],
                    ["docx", "Word (.docx)"],
                  ] as const).map(([format, text]) => (
                    <button
                      key={format}
                      onClick={() => handleExport(format)}
                      className="w-full text-left px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                    >
                      {text}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => setShowSeo((v) => !v)}
              className={`${toolbarButton} ${showSeo ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}
            >
              <Search className="w-4 h-4" />
              SEO
            </button>
            <button onClick={() => setShowPublish(true)} className={`${toolbarButton} bg-indigo-600 text-white hover:bg-indigo-700`}>
              <Send className="w-4 h-4" />
              Publish
            </button>
          </div>
        </div>

        {notice && (
          <p
            className={`mb-6 text-sm font-medium px-4 py-3 rounded-xl border ${
              notice.kind === "success"
                ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                : "bg-red-50 text-red-700 border-red-100"
            }`}
          >
            {notice.text}
          </p>
        )}

        {showSeo && (
          <div className="mb-8">
            <SeoPanel
              content={content}
              postId={postId}
              getAccessToken={getAccessToken}
              onResult={(r) => setSeoTags(r.tags)}
            />
          </div>
        )}

        {mode === "edit" ? (
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="grid gap-3 content-start">
              <div
                className={`flex flex-col gap-2 p-3 rounded-2xl border transition-colors ${
                  selection ? "bg-indigo-50/60 border-indigo-100" : "bg-zinc-50 border-zinc-100"
                }`}
              >
                <p className="flex items-center gap-2 text-xs font-medium text-zinc-500">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  {selection
                    ? `Rewrite the ${selection.end - selection.start} selected characters`
                    : "Select text in the editor to rewrite it with AI"}
                </p>
                {selection && (
                  <>
                    <div className="flex flex-wrap gap-1.5">
                      {REWRITE_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          onClick={() => handleRewrite(preset)}
                          disabled={isRewriting}
                          className="text-xs font-medium px-2.5 py-1 rounded-full bg-white border border-indigo-100 text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleRewrite();
                      }}
                      className="flex gap-2"
                    >
                      <input
                        value={instruction}
                        onChange={(e) => setInstruction(e.target.value)}
                        placeholder="Or describe the change..."
                        maxLength={300}
                        className="flex-1 p-2 bg-white border border-zinc-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-600"
                      />
                      <button
                        type="submit"
                        disabled={isRewriting}
                        className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:bg-indigo-300"
                      >
                        {isRewriting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        Rewrite
                      </button>
                    </form>
                  </>
                )}
              </div>
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  setSelection(null);
                }}
                onSelect={trackSelection}
                onKeyUp={trackSelection}
                onMouseUp={trackSelection}
                spellCheck
                className="w-full min-h-[60vh] p-4 bg-zinc-50 border border-zinc-200 rounded-2xl font-mono text-sm leading-relaxed text-zinc-800 outline-none focus:ring-2 focus:ring-indigo-600 resize-y"
              />
            </div>
            <article className={`${PROSE_CLASSES} prose-base md:prose-lg border border-zinc-100 rounded-2xl p-6 max-h-[80vh] overflow-y-auto`}>
              <ReactMarkdown>{content}</ReactMarkdown>
            </article>
          </div>
        ) : (
          <article className={PROSE_CLASSES}>
            <ReactMarkdown>{content}</ReactMarkdown>
          </article>
        )}
      </div>

      {showPublish && (
        <PublishDialog
          content={content}
          defaultTags={seoTags}
          getAccessToken={getAccessToken}
          onClose={() => setShowPublish(false)}
        />
      )}
    </section>
  );
}
