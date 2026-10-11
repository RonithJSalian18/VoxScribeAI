"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AlertCircle, Globe, Library, Mic, PenSquare, RotateCcw, Search, Trash2, X, Youtube } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PostWorkspace } from "@/components/post/PostWorkspace";
import { OUTPUT_FORMATS, formatLabel } from "@/lib/formats";
import { getPostExcerpt, getPostTitle } from "@/lib/markdown";
import { cn } from "@/lib/utils";
import { BlogPostHistoryItem, OutputFormat, UserProfile } from "@/types";

interface LibraryViewProps {
  supabase: SupabaseClient | null;
  user: UserProfile;
  getAccessToken: () => Promise<string | null>;
  onCreate: () => void;
}

const relativeDate = (value: string) => {
  const date = new Date(value);
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

function SourceLabel({ source }: { source: string }) {
  if (source.startsWith("text:")) {
    return (
      <span className="flex min-w-0 items-center gap-1">
        <Mic className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{source.slice(5)}</span>
      </span>
    );
  }
  const isYoutube = /youtube\.com|youtu\.be/.test(source);
  const Icon = isYoutube ? Youtube : Globe;
  let host = source;
  try {
    host = new URL(source).hostname.replace(/^www\./, "");
  } catch {
    // Not a URL; show as-is
  }
  return (
    <span className="flex min-w-0 items-center gap-1">
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{host}</span>
    </span>
  );
}

export function LibraryView({ supabase, user, getAccessToken, onCreate }: LibraryViewProps) {
  const [posts, setPosts] = useState<BlogPostHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [formatFilter, setFormatFilter] = useState<OutputFormat | "all">("all");
  const [pendingDelete, setPendingDelete] = useState<BlogPostHistoryItem | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const loadPosts = useCallback(async () => {
    if (!supabase) {
      setError("Supabase is not configured.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) setError(error.message);
    else setPosts(data ?? []);
    setIsLoading(false);
  }, [supabase, user.id]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const askDelete = (post: BlogPostHistoryItem) => {
    setPendingDelete(post);
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!supabase || !pendingDelete) return;
    const { error } = await supabase.from("blog_posts").delete().eq("id", pendingDelete.id);
    if (error) {
      toast.error(error.message);
      throw error;
    }
    setPosts((prev) => prev.filter((p) => p.id !== pendingDelete.id));
    if (selectedId === pendingDelete.id) setSelectedId(null);
    toast.success("Post deleted");
  };

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    posts.forEach((p) => (map[p.output_format ?? "blog"] = (map[p.output_format ?? "blog"] ?? 0) + 1));
    return map;
  }, [posts]);

  const filteredPosts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return posts.filter(
      (p) =>
        (formatFilter === "all" || (p.output_format ?? "blog") === formatFilter) &&
        (!q || p.content.toLowerCase().includes(q) || p.youtube_url.toLowerCase().includes(q)),
    );
  }, [posts, query, formatFilter]);

  const selectedPost = posts.find((p) => p.id === selectedId);

  const deleteDialog = (
    <ConfirmDialog
      open={deleteOpen}
      onOpenChange={setDeleteOpen}
      title="Delete this post?"
      description={`"${pendingDelete ? getPostTitle(pendingDelete.content) : ""}" will be permanently deleted.`}
      confirmLabel="Delete"
      destructive
      onConfirm={confirmDelete}
    />
  );

  if (selectedPost) {
    return (
      <>
        <PostWorkspace
          key={selectedPost.id}
          content={selectedPost.content}
          createdAt={selectedPost.created_at}
          postId={selectedPost.id}
          sourceUrl={selectedPost.youtube_url}
          voiceId={selectedPost.voice_id}
          outputFormat={selectedPost.output_format}
          supabase={supabase}
          getAccessToken={getAccessToken}
          onBack={() => setSelectedId(null)}
          onDelete={() => askDelete(selectedPost)}
          onSaved={(content) => setPosts((prev) => prev.map((p) => (p.id === selectedPost.id ? { ...p, content } : p)))}
        />
        {deleteDialog}
      </>
    );
  }

  const filterChips: { id: OutputFormat | "all"; label: string; count: number }[] = [
    { id: "all", label: "All", count: posts.length },
    ...OUTPUT_FORMATS.filter((f) => counts[f.id]).map((f) => ({ id: f.id, label: f.label, count: counts[f.id] })),
  ];

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search titles, content or sources…"
            aria-label="Search posts"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-11 pl-9"
          />
        </div>
        <Button onClick={onCreate} className="h-11 sm:w-auto">
          <PenSquare /> New content
        </Button>
      </div>

      {posts.length > 0 && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-thin" role="toolbar" aria-label="Filter by format">
          {filterChips.map((chip) => {
            const active = formatFilter === chip.id;
            return (
              <button
                key={chip.id}
                onClick={() => setFormatFilter(chip.id)}
                aria-pressed={active}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                  active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-secondary",
                )}
              >
                {chip.label}
                <span className={cn("tabular-nums text-xs", active ? "opacity-80" : "text-muted-foreground")}>
                  {chip.count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <div role="alert" className="flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="flex-1">{error}</p>
          <Button variant="outline" size="sm" onClick={loadPosts}>
            <RotateCcw /> Retry
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border bg-card p-5">
              <Skeleton className="mb-4 h-5 w-20 rounded-full" />
              <Skeleton className="mb-2 h-5 w-4/5" />
              <Skeleton className="mb-1.5 h-3.5 w-full" />
              <Skeleton className="mb-6 h-3.5 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : posts.length === 0 && !error ? (
        <EmptyState
          icon={Library}
          title="Your library is empty"
          description="Everything you generate is saved here automatically, ready to edit, export or publish."
          action={
            <Button onClick={onCreate}>
              <PenSquare /> Create your first post
            </Button>
          }
        />
      ) : filteredPosts.length === 0 && !error ? (
        <EmptyState
          icon={Search}
          title="No matching posts"
          description="Try a different search term or format filter."
          action={
            <Button
              variant="outline"
              onClick={() => {
                setQuery("");
                setFormatFilter("all");
              }}
            >
              <X /> Clear filters
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredPosts.map((post) => (
            <li key={post.id} className="group relative">
              <button
                onClick={() => setSelectedId(post.id)}
                className="flex h-full w-full flex-col rounded-2xl border bg-card p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="mb-3 w-fit rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
                  {formatLabel(post.output_format)}
                </span>
                <h3 className="line-clamp-2 pr-8 font-semibold leading-snug tracking-tight">{getPostTitle(post.content)}</h3>
                <p className="mt-2 line-clamp-3 flex-1 text-sm text-muted-foreground">{getPostExcerpt(post.content, 200)}</p>
                <div className="mt-4 flex items-center gap-2 border-t pt-3 text-xs text-muted-foreground">
                  <span className="shrink-0">{relativeDate(post.created_at)}</span>
                  <span aria-hidden="true">·</span>
                  <SourceLabel source={post.youtube_url} />
                </div>
              </button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => askDelete(post)}
                aria-label={`Delete ${getPostTitle(post.content)}`}
                className="absolute right-3 top-3 opacity-100 hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {deleteDialog}
    </div>
  );
}
