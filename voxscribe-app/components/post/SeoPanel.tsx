"use client";

import { useState } from "react";
import { Check, Copy, Gauge, Link2, Loader2, Search, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiJson } from "@/lib/api";
import { cn } from "@/lib/utils";
import { SeoResult } from "@/types";

interface SeoPanelProps {
  content: string;
  postId?: string | null;
  getAccessToken: () => Promise<string | null>;
  onResult?: (result: SeoResult) => void;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      aria-label={`Copy ${label}`}
      className="h-7 w-7"
    >
      {copied ? <Check className="text-success" /> : <Copy />}
    </Button>
  );
}

const scoreTone = (score: number) =>
  score >= 60 ? "text-success" : score >= 40 ? "text-warning" : "text-destructive";

export function SeoPanel({ content, postId, getAccessToken, onResult }: SeoPanelProps) {
  const [keyword, setKeyword] = useState("");
  const [result, setResult] = useState<SeoResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiJson<SeoResult>("/posts/seo", await getAccessToken(), {
        method: "POST",
        body: JSON.stringify({ content, keyword, post_id: postId ?? null }),
      });
      setResult(data);
      onResult?.(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "SEO analysis failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const metaLength = result?.meta_description.length ?? 0;

  return (
    <div className="grid gap-6">
      <form onSubmit={analyze} className="flex flex-col gap-2 sm:flex-row">
        <Input
          placeholder="Focus keyword (optional)"
          aria-label="Focus keyword"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          maxLength={100}
        />
        <Button type="submit" disabled={isLoading} className="h-10 shrink-0">
          {isLoading ? <Loader2 className="animate-spin" /> : <Search />}
          {result ? "Re-analyze" : "Analyze SEO"}
        </Button>
      </form>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {isLoading && !result && (
        <div className="grid gap-4">
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-10 rounded-xl" />
        </div>
      )}

      {!result && !isLoading && !error && (
        <p className="text-sm text-muted-foreground">
          Get a meta description, URL slug, tags, a readability score and links to your related posts.
        </p>
      )}

      {result && (
        <div className={cn("grid gap-6 transition-opacity", isLoading && "opacity-50")}>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border p-4">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Gauge className="h-3.5 w-3.5" /> Readability
              </p>
              <p className={cn("mt-1 text-2xl font-semibold tabular-nums", scoreTone(result.readability.flesch_score))}>
                {result.readability.flesch_score}
              </p>
              <p className="text-xs text-muted-foreground">{result.readability.level}</p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="text-xs text-muted-foreground">Words</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{result.readability.words.toLocaleString()}</p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="text-xs text-muted-foreground">Reading time</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{result.readability.reading_minutes}m</p>
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">
                Meta description{" "}
                <span className={cn("tabular-nums", metaLength > 160 ? "text-warning" : "")}>({metaLength}/160)</span>
              </p>
              <CopyButton value={result.meta_description} label="meta description" />
            </div>
            <p className="rounded-xl border bg-secondary/40 p-3 text-sm">{result.meta_description}</p>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">URL slug</p>
              <CopyButton value={result.slug} label="slug" />
            </div>
            <p className="break-all rounded-xl border bg-secondary/40 p-3 font-mono text-sm">/{result.slug}</p>
          </div>

          {result.tags.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Tags</p>
              <div className="flex flex-wrap gap-2">
                {result.tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                    <Tag className="h-3 w-3" />
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Internal link suggestions</p>
            {result.internal_links.length === 0 ? (
              <p className="text-sm text-muted-foreground">No related earlier posts found yet.</p>
            ) : (
              <ul className="grid gap-2">
                {result.internal_links.map((link) => (
                  <li key={link.post_id} className="flex items-start gap-2.5 rounded-xl border p-3 text-sm">
                    <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>
                      Link <span className="font-medium">&ldquo;{link.anchor_text}&rdquo;</span> to{" "}
                      <span className="font-medium text-primary">{link.title}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
