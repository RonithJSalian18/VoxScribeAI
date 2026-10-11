"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Copy,
  Download,
  Eye,
  FileCode2,
  FileDown,
  FileText,
  FileType,
  Loader2,
  Maximize2,
  Minimize2,
  Pencil,
  Save,
  Search,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Textarea } from "@/components/ui/textarea";
import { SeoPanel } from "@/components/post/SeoPanel";
import { PublishDialog } from "@/components/post/PublishDialog";
import { apiJson } from "@/lib/api";
import { exportDocx, exportHtml, exportMarkdown, exportPdf } from "@/lib/export";
import { formatLabel } from "@/lib/formats";
import { getYoutubeId } from "@/lib/markdown";
import { cn } from "@/lib/utils";
import { OutputFormat } from "@/types";

interface PostWorkspaceProps {
  content: string;
  createdAt?: string;
  postId?: string | null;
  sourceUrl?: string | null;
  voiceId?: string | null;
  outputFormat?: OutputFormat;
  supabase?: SupabaseClient | null;
  getAccessToken: () => Promise<string | null>;
  onSaved?: (content: string) => void;
  onBack?: () => void;
  onDelete?: () => void;
  wide?: boolean;
  onToggleWide?: () => void;
}

type Tab = "preview" | "edit" | "seo";

const REWRITE_PRESETS = ["Punchier", "Shorter", "More detail", "Simpler"];
const PRESET_INSTRUCTIONS: Record<string, string> = {
  Punchier: "Make it punchier",
  Shorter: "Make it shorter",
  "More detail": "Add more detail",
  Simpler: "Simplify the language",
};

export const PROSE_CLASSES =
  "prose prose-neutral max-w-none dark:prose-invert [&_blockquote_p]:before:content-none [&_blockquote_p]:after:content-none prose-headings:font-semibold prose-headings:tracking-tight prose-h1:text-3xl sm:prose-h1:text-4xl prose-h1:leading-tight prose-h2:mt-10 prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-blockquote:border-l-primary prose-blockquote:font-normal prose-blockquote:not-italic prose-blockquote:text-foreground/80 prose-li:marker:text-primary prose-code:rounded prose-code:bg-secondary prose-code:px-1 prose-code:py-0.5 prose-code:before:content-none prose-code:after:content-none prose-img:rounded-xl";

const wordCount = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);

export function PostWorkspace({
  content: initialContent,
  createdAt,
  postId,
  sourceUrl,
  voiceId,
  outputFormat,
  supabase,
  getAccessToken,
  onSaved,
  onBack,
  onDelete,
  wide = false,
  onToggleWide,
}: PostWorkspaceProps) {
  const [content, setContent] = useState(initialContent);
  const [savedContent, setSavedContent] = useState(initialContent);
  const [tab, setTab] = useState<Tab>("preview");
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [seoTags, setSeoTags] = useState<string[]>([]);
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
  const [instruction, setInstruction] = useState("");
  const [isRewriting, setIsRewriting] = useState(false);
  const [coverFallback, setCoverFallback] = useState(false);
  const [coverFailed, setCoverFailed] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isDirty = content !== savedContent;
  const canSave = Boolean(supabase && postId);
  const words = useMemo(() => wordCount(content), [content]);
  const youtubeId = getYoutubeId(sourceUrl);
  const coverUrl =
    youtubeId && !coverFailed
      ? `https://img.youtube.com/vi/${youtubeId}/${coverFallback ? "hqdefault" : "maxresdefault"}.jpg`
      : null;

  const handleSave = async () => {
    if (!supabase || !postId || !isDirty) return;
    setIsSaving(true);
    const { error } = await supabase.from("blog_posts").update({ content }).eq("id", postId);
    setIsSaving(false);
    if (error) return toast.error(error.message);
    setSavedContent(content);
    onSaved?.(content);
    toast.success("Changes saved");
  };

  // Ctrl/Cmd+S saves while the workspace is open
  const saveRef = useRef(handleSave);
  useEffect(() => {
    saveRef.current = handleSave;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Warn before leaving the page with unsaved edits
  useEffect(() => {
    if (!isDirty || !canSave) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty, canSave]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = async (format: "md" | "html" | "pdf" | "docx") => {
    try {
      if (format === "md") exportMarkdown(content);
      else if (format === "html") exportHtml(content);
      else if (format === "pdf") exportPdf(content);
      else await exportDocx(content, await getAccessToken());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed.");
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
    setIsRewriting(true);
    try {
      const data = await apiJson<{ text: string }>("/posts/rewrite", await getAccessToken(), {
        method: "POST",
        body: JSON.stringify({
          text: content.slice(start, end),
          instruction: (preset && PRESET_INSTRUCTIONS[preset]) || instruction || "Improve clarity and flow",
          context: content.slice(Math.max(0, start - 1500), Math.min(content.length, end + 1500)),
          voice_id: voiceId ?? null,
        }),
      });
      setContent(content.slice(0, start) + data.text + content.slice(end));
      setInstruction("");
      // Re-select the rewritten passage so it's visible (and can be rewritten again)
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
        textareaRef.current?.setSelectionRange(start, start + data.text.length);
        setSelection({ start, end: start + data.text.length });
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rewrite failed.");
    } finally {
      setIsRewriting(false);
    }
  };

  const preview = (
    <article className={PROSE_CLASSES}>
      <ReactMarkdown>{content}</ReactMarkdown>
    </article>
  );

  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-500">
      {coverUrl && (
        <div className="relative h-36 overflow-hidden bg-secondary sm:h-44">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverUrl}
            alt=""
            onError={() => (coverFallback ? setCoverFailed(true) : setCoverFallback(true))}
            onLoad={(e) => {
              // YouTube serves a 120px grey placeholder (not an error) when maxres doesn't exist
              if (!coverFallback && e.currentTarget.naturalWidth <= 120) setCoverFallback(true);
            }}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />
        </div>
      )}

      {/* Toolbar */}
      <div className="sticky top-14 z-20 flex flex-wrap items-center gap-2 border-b bg-card/90 px-4 py-3 backdrop-blur md:top-0 sm:px-6">
        {onBack && (
          <Button variant="ghost" size="icon-sm" onClick={onBack} aria-label="Back to library">
            <ArrowLeft />
          </Button>
        )}
        <SegmentedControl
          label="View"
          size="sm"
          value={tab}
          onChange={setTab}
          options={[
            { value: "preview", label: "Preview", icon: Eye },
            { value: "edit", label: "Edit", icon: Pencil },
            { value: "seo", label: "SEO", icon: Search },
          ]}
        />

        <div className="ml-auto flex items-center gap-1.5">
          {canSave && (
            <Button
              variant={isDirty ? "soft" : "ghost"}
              size="sm"
              onClick={handleSave}
              disabled={!isDirty || isSaving}
              title="Save (Ctrl+S)"
            >
              {isSaving ? <Loader2 className="animate-spin" /> : isDirty ? <Save /> : <Check />}
              <span className="hidden sm:inline">{isDirty ? "Save" : "Saved"}</span>
              {isDirty && <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-label="Unsaved changes" />}
            </Button>
          )}
          <Button variant="ghost" size="icon-sm" onClick={handleCopy} aria-label="Copy content" title="Copy">
            {copied ? <Check className="text-success" /> : <Copy />}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" aria-label="Export">
                <Download />
                <span className="hidden sm:inline">Export</span>
                <ChevronDown className="hidden opacity-60 sm:block" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-xl">
              <DropdownMenuItem onSelect={() => handleExport("md")} className="gap-2">
                <FileText className="h-4 w-4" /> Markdown
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleExport("html")} className="gap-2">
                <FileCode2 className="h-4 w-4" /> HTML
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleExport("pdf")} className="gap-2">
                <FileDown className="h-4 w-4" /> PDF (print)
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleExport("docx")} className="gap-2">
                <FileType className="h-4 w-4" /> Word document
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {onToggleWide && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onToggleWide}
              className="hidden lg:inline-flex"
              aria-label={wide ? "Exit focus mode" : "Focus mode"}
              title={wide ? "Exit focus mode" : "Focus mode"}
            >
              {wide ? <Minimize2 /> : <Maximize2 />}
            </Button>
          )}
          {onDelete && (
            <Button variant="ghost" size="icon-sm" onClick={onDelete} aria-label="Delete post" title="Delete" className="hover:text-destructive">
              <Trash2 />
            </Button>
          )}
          <Button size="sm" onClick={() => setPublishOpen(true)}>
            <Send />
            <span className="hidden sm:inline">Publish</span>
          </Button>
        </div>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pt-5 text-xs text-muted-foreground sm:px-8">
        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-medium text-primary">{formatLabel(outputFormat)}</span>
        <span>
          {(createdAt ? new Date(createdAt) : new Date()).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
        <span aria-hidden="true">·</span>
        <span className="tabular-nums">{words.toLocaleString()} words</span>
        <span aria-hidden="true">·</span>
        <span>{Math.max(1, Math.ceil(words / 230))} min read</span>
      </div>

      <div className="px-4 py-6 sm:px-8 sm:py-8">
        {tab === "preview" && preview}

        {tab === "seo" && (
          <SeoPanel content={content} postId={postId} getAccessToken={getAccessToken} onResult={(r) => setSeoTags(r.tags)} />
        )}

        {tab === "edit" && (
          <div className={cn("grid gap-6", wide && "xl:grid-cols-2")}>
            <div className="grid content-start gap-3">
              <div
                className={cn(
                  "rounded-xl border p-3 transition-colors",
                  selection ? "border-primary/30 bg-primary/5" : "bg-secondary/40",
                )}
              >
                <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  {selection
                    ? `AI rewrite · ${selection.end - selection.start} characters selected`
                    : "Select text below to rewrite it in your voice"}
                </p>
                {selection && (
                  <div className="mt-3 grid gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      {REWRITE_PRESETS.map((preset) => (
                        <Button
                          key={preset}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleRewrite(preset)}
                          disabled={isRewriting}
                          className="h-7 rounded-full"
                        >
                          {preset}
                        </Button>
                      ))}
                    </div>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleRewrite();
                      }}
                      className="flex gap-2"
                    >
                      <Input
                        value={instruction}
                        onChange={(e) => setInstruction(e.target.value)}
                        placeholder="Or describe the change…"
                        maxLength={300}
                        className="h-9"
                        aria-label="Rewrite instruction"
                      />
                      <Button type="submit" size="sm" disabled={isRewriting} className="h-9">
                        {isRewriting ? <Loader2 className="animate-spin" /> : <Sparkles />}
                        Rewrite
                      </Button>
                    </form>
                  </div>
                )}
              </div>
              <Textarea
                ref={textareaRef}
                aria-label="Post content (Markdown)"
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  setSelection(null);
                }}
                onSelect={trackSelection}
                onKeyUp={trackSelection}
                onMouseUp={trackSelection}
                spellCheck
                className="min-h-[60vh] resize-y font-mono text-[13px] leading-relaxed"
              />
            </div>
            {wide && (
              <div className="hidden max-h-[80vh] overflow-y-auto rounded-xl border p-6 scrollbar-thin xl:block">{preview}</div>
            )}
          </div>
        )}
      </div>

      <PublishDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        content={content}
        defaultTags={seoTags}
        getAccessToken={getAccessToken}
      />
    </section>
  );
}
