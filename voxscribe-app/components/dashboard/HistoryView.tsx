"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ArrowLeft,
  FileText,
  Loader2,
  Search,
  Trash2,
  Youtube,
  Globe,
  Mic,
  AlertCircle,
} from "lucide-react";
import { BlogResultViewer } from "@/components/dashboard/BlogResultViewer";
import { formatLabel } from "@/lib/formats";
import { getPostExcerpt, getPostTitle } from "@/lib/markdown";
import { BlogPostHistoryItem, UserProfile } from "@/types";

interface HistoryViewProps {
  supabase: SupabaseClient | null;
  user: UserProfile;
  getAccessToken: () => Promise<string | null>;
}

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export function HistoryView({ supabase, user, getAccessToken }: HistoryViewProps) {
  const [posts, setPosts] = useState<BlogPostHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

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

  const handleDelete = async (id: string) => {
    if (!supabase || !confirm("Delete this post permanently?")) return;

    setDeletingId(id);
    const { error } = await supabase.from("blog_posts").delete().eq("id", id);
    if (error) {
      setError(error.message);
    } else {
      setPosts((prev) => prev.filter((p) => p.id !== id));
      if (selectedId === id) setSelectedId(null);
    }
    setDeletingId(null);
  };

  const filteredPosts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter(
      (p) => p.content.toLowerCase().includes(q) || p.youtube_url.toLowerCase().includes(q)
    );
  }, [posts, query]);

  const selectedPost = posts.find((p) => p.id === selectedId);

  if (selectedPost) {
    return (
      <div className="grid gap-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSelectedId(null)}
            className="flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to history
          </button>
          <button
            onClick={() => handleDelete(selectedPost.id)}
            disabled={deletingId === selectedPost.id}
            className="flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-red-600 transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
        <BlogResultViewer
          key={selectedPost.id}
          result={selectedPost.content}
          user={user}
          createdAt={selectedPost.created_at}
          label="Saved Post"
          postId={selectedPost.id}
          sourceUrl={selectedPost.youtube_url}
          voiceId={selectedPost.voice_id}
          supabase={supabase}
          getAccessToken={getAccessToken}
          onSaved={(content) =>
            setPosts((prev) => prev.map((p) => (p.id === selectedPost.id ? { ...p, content } : p)))
          }
        />
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="relative">
        <Search className="w-5 h-5 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="search"
          placeholder="Search your posts..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full p-4 pl-12 bg-white border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all outline-none text-zinc-900 placeholder:text-zinc-400"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-xl text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="bg-white p-8 rounded-3xl shadow-[0_2px_10px_rgb(0,0,0,0.02)] border border-zinc-100 text-center py-16">
          <FileText className="w-10 h-10 text-zinc-300 mx-auto mb-4" />
          <p className="text-zinc-500">
            {posts.length === 0
              ? "No posts yet. Generate your first post from the Dashboard."
              : "No posts match your search."}
          </p>
        </div>
      ) : (
        <ul className="grid gap-4">
          {filteredPosts.map((post) => (
            <li
              key={post.id}
              className="bg-white p-6 rounded-3xl shadow-[0_2px_10px_rgb(0,0,0,0.02)] border border-zinc-100 hover:border-indigo-200 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <button onClick={() => setSelectedId(post.id)} className="flex-1 text-left min-w-0">
                  <h3 className="font-semibold text-lg text-zinc-900 tracking-tight truncate">
                    {getPostTitle(post.content)}
                  </h3>
                  <p className="text-sm text-zinc-500 mt-1 line-clamp-2">
                    {getPostExcerpt(post.content)}
                  </p>
                </button>
                <button
                  onClick={() => handleDelete(post.id)}
                  disabled={deletingId === post.id}
                  aria-label="Delete post"
                  className="p-2 rounded-xl text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  {deletingId === post.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
              <div className="flex items-center gap-3 mt-4 text-xs text-zinc-400">
                <span className="font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full shrink-0">
                  {formatLabel(post.output_format)}
                </span>
                <span className="shrink-0">{formatDate(post.created_at)}</span>
                <span>•</span>
                <SourceLink source={post.youtube_url} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Shows a post's source: a link for URLs, a label for uploaded transcripts (stored as "text:<name>"). */
function SourceLink({ source }: { source: string }) {
  if (source.startsWith("text:")) {
    return (
      <span className="flex items-center gap-1 truncate">
        <Mic className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate">{source.slice(5)}</span>
      </span>
    );
  }
  const Icon = /youtube\.com|youtu\.be/.test(source) ? Youtube : Globe;
  return (
    <a
      href={source}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1 hover:text-indigo-600 truncate"
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span className="truncate">{source}</span>
    </a>
  );
}
