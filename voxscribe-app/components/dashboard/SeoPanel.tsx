"use client";

import { useState } from "react";
import { Check, Copy, Link2, Loader2, Search, Tag } from "lucide-react";
import { apiJson } from "@/lib/api";
import { SeoResult } from "@/types";

interface SeoPanelProps {
  content: string;
  postId?: string | null;
  getAccessToken: () => Promise<string | null>;
  onResult?: (result: SeoResult) => void;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      aria-label="Copy"
      className="p-1.5 rounded-lg text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 shrink-0"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

const scoreColor = (score: number) =>
  score >= 60 ? "text-emerald-600" : score >= 40 ? "text-amber-600" : "text-red-600";

export function SeoPanel({ content, postId, getAccessToken, onResult }: SeoPanelProps) {
  const [keyword, setKeyword] = useState("");
  const [result, setResult] = useState<SeoResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = async () => {
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

  return (
    <div className="border border-zinc-100 rounded-2xl p-6 bg-zinc-50/50">
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          placeholder="Focus keyword (optional)"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          maxLength={100}
          className="flex-1 p-3 bg-white border border-zinc-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-600"
        />
        <button
          onClick={analyze}
          disabled={isLoading}
          className="flex items-center justify-center gap-2 bg-zinc-900 text-white px-5 py-3 rounded-xl text-sm font-semibold hover:bg-zinc-800 disabled:opacity-60"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {result ? "Re-analyze" : "Analyze SEO"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {result && (
        <dl className="mt-6 grid gap-5 text-sm">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white border border-zinc-100 rounded-xl p-3">
              <dt className="text-xs text-zinc-500">Readability</dt>
              <dd className={`text-lg font-semibold ${scoreColor(result.readability.flesch_score)}`}>
                {result.readability.flesch_score}
              </dd>
              <dd className="text-xs text-zinc-500">{result.readability.level}</dd>
            </div>
            <div className="bg-white border border-zinc-100 rounded-xl p-3">
              <dt className="text-xs text-zinc-500">Words</dt>
              <dd className="text-lg font-semibold text-zinc-900">{result.readability.words.toLocaleString()}</dd>
            </div>
            <div className="bg-white border border-zinc-100 rounded-xl p-3">
              <dt className="text-xs text-zinc-500">Reading time</dt>
              <dd className="text-lg font-semibold text-zinc-900">{result.readability.reading_minutes} min</dd>
            </div>
          </div>

          <div>
            <dt className="flex items-center justify-between text-xs font-medium text-zinc-500 mb-1">
              Meta description ({result.meta_description.length} chars)
              <CopyButton value={result.meta_description} />
            </dt>
            <dd className="bg-white border border-zinc-100 rounded-xl p-3 text-zinc-800">{result.meta_description}</dd>
          </div>

          <div>
            <dt className="flex items-center justify-between text-xs font-medium text-zinc-500 mb-1">
              URL slug
              <CopyButton value={result.slug} />
            </dt>
            <dd className="bg-white border border-zinc-100 rounded-xl p-3 font-mono text-zinc-800 break-all">/{result.slug}</dd>
          </div>

          {result.tags.length > 0 && (
            <div>
              <dt className="text-xs font-medium text-zinc-500 mb-2">Tags</dt>
              <dd className="flex flex-wrap gap-2">
                {result.tags.map((tag) => (
                  <span key={tag} className="flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full text-xs font-medium">
                    <Tag className="w-3 h-3" />
                    {tag}
                  </span>
                ))}
              </dd>
            </div>
          )}

          <div>
            <dt className="text-xs font-medium text-zinc-500 mb-2">Internal link suggestions</dt>
            <dd>
              {result.internal_links.length === 0 ? (
                <p className="text-zinc-400">No related earlier posts found.</p>
              ) : (
                <ul className="grid gap-2">
                  {result.internal_links.map((link) => (
                    <li key={link.post_id} className="flex items-start gap-2 bg-white border border-zinc-100 rounded-xl p-3">
                      <Link2 className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
                      <span>
                        Link <span className="font-medium">&ldquo;{link.anchor_text}&rdquo;</span> to your post{" "}
                        <span className="font-medium text-indigo-700">{link.title}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </dd>
          </div>
        </dl>
      )}
    </div>
  );
}
