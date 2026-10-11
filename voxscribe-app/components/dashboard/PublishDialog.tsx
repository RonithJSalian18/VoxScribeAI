"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Loader2, Send, X, AlertCircle, CheckCircle2 } from "lucide-react";
import { apiJson } from "@/lib/api";
import { PublishPlatform, PublishResult } from "@/types";

interface PublishDialogProps {
  content: string;
  defaultTags?: string[];
  getAccessToken: () => Promise<string | null>;
  onClose: () => void;
}

interface Credentials {
  api_key: string;
  site_url: string;
  username: string;
  publication_id: string;
}

type CredentialField = keyof Credentials;

const PLATFORMS: {
  id: PublishPlatform;
  label: string;
  fields: { key: CredentialField; label: string; placeholder: string; secret?: boolean }[];
  help: string;
}[] = [
  {
    id: "devto",
    label: "Dev.to",
    fields: [{ key: "api_key", label: "API key", placeholder: "From dev.to/settings/extensions", secret: true }],
    help: "Create a key under Settings → Extensions → DEV Community API Keys.",
  },
  {
    id: "wordpress",
    label: "WordPress",
    fields: [
      { key: "site_url", label: "Site URL", placeholder: "https://yourblog.com" },
      { key: "username", label: "Username", placeholder: "admin" },
      { key: "api_key", label: "Application password", placeholder: "xxxx xxxx xxxx xxxx", secret: true },
    ],
    help: "Create an Application Password under Users → Profile in your WordPress admin.",
  },
  {
    id: "ghost",
    label: "Ghost",
    fields: [
      { key: "site_url", label: "Site URL", placeholder: "https://yoursite.ghost.io" },
      { key: "api_key", label: "Admin API key", placeholder: "id:secret", secret: true },
    ],
    help: "Create a custom integration under Settings → Integrations and copy its Admin API key.",
  },
  {
    id: "hashnode",
    label: "Hashnode",
    fields: [
      { key: "publication_id", label: "Publication ID", placeholder: "From your blog dashboard URL" },
      { key: "api_key", label: "Personal access token", placeholder: "From hashnode.com/settings/developer", secret: true },
    ],
    help: "Generate a token under Settings → Developer. The publication ID is in your blog dashboard URL.",
  },
];

const EMPTY: Credentials = { api_key: "", site_url: "", username: "", publication_id: "" };
const storageKey = (platform: PublishPlatform) => `voxscribe.publish.${platform}`;

const loadSaved = (platform: PublishPlatform): Credentials | null => {
  try {
    const raw = localStorage.getItem(storageKey(platform));
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : null;
  } catch {
    return null;
  }
};

export function PublishDialog({ content, defaultTags = [], getAccessToken, onClose }: PublishDialogProps) {
  const [platform, setPlatform] = useState<PublishPlatform>("devto");
  const [credentials, setCredentials] = useState<Credentials>(EMPTY);
  const [remember, setRemember] = useState(false);
  const [tags, setTags] = useState(defaultTags.join(", "));
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PublishResult | null>(null);

  const config = PLATFORMS.find((p) => p.id === platform)!;

  useEffect(() => {
    const saved = loadSaved(platform);
    setCredentials(saved ?? EMPTY);
    setRemember(Boolean(saved));
    setError(null);
    setResult(null);
  }, [platform]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPublishing(true);
    setError(null);
    setResult(null);

    try {
      if (remember) localStorage.setItem(storageKey(platform), JSON.stringify(credentials));
      else localStorage.removeItem(storageKey(platform));
    } catch {
      // Storage unavailable (private mode); publishing still works
    }

    try {
      const data = await apiJson<PublishResult>(`/publish/${platform}`, await getAccessToken(), {
        method: "POST",
        body: JSON.stringify({
          content,
          status,
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
          ...Object.fromEntries(Object.entries(credentials).filter(([, v]) => v.trim())),
        }),
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publishing failed.");
    } finally {
      setIsPublishing(false);
    }
  };

  const inputClass =
    "w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-600";

  return (
    <div className="fixed inset-0 z-50 bg-zinc-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-8"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 id="publish-title" className="text-xl font-semibold tracking-tight text-zinc-900">
            Publish post
          </h2>
          <button onClick={onClose} aria-label="Close" className="p-2 rounded-xl text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-1 p-1 bg-zinc-100 rounded-xl mb-6">
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPlatform(p.id)}
              className={`px-2 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                platform === p.id ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <form onSubmit={handlePublish} className="grid gap-4">
          <p className="text-xs text-zinc-500">{config.help}</p>
          {config.fields.map((field) => (
            <div key={field.key}>
              <label htmlFor={`pub-${field.key}`} className="text-xs font-medium text-zinc-500 mb-1.5 block">
                {field.label}
              </label>
              <input
                id={`pub-${field.key}`}
                type={field.secret ? "password" : "text"}
                autoComplete="off"
                required
                placeholder={field.placeholder}
                value={credentials[field.key]}
                onChange={(e) => setCredentials((c) => ({ ...c, [field.key]: e.target.value }))}
                className={inputClass}
              />
            </div>
          ))}

          {platform !== "wordpress" && (
            <div>
              <label htmlFor="pub-tags" className="text-xs font-medium text-zinc-500 mb-1.5 block">
                Tags (comma-separated)
              </label>
              <input id="pub-tags" value={tags} onChange={(e) => setTags(e.target.value)} className={inputClass} />
            </div>
          )}

          <div className="flex gap-1 p-1 bg-zinc-100 rounded-xl w-fit">
            {(["draft", "published"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize ${
                  status === s ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
                }`}
              >
                {s === "draft" ? "Save as draft" : "Publish now"}
              </button>
            ))}
          </div>

          <label className="flex items-start gap-2 text-sm text-zinc-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded accent-indigo-600"
            />
            <span>
              Remember these credentials on this device
              <span className="block text-xs text-zinc-400">
                Stored only in this browser. VoxScribe never saves your platform keys on its servers.
              </span>
            </span>
          </label>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-xl text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {result && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 text-emerald-700 px-4 py-3 rounded-xl text-sm">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <p className="flex-1">{result.status === "draft" ? "Draft created" : "Published"} on {config.label}.</p>
              {result.url && (
                <a href={result.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 font-semibold hover:underline">
                  Open <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isPublishing}
            className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-5 py-3 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:bg-indigo-300"
          >
            {isPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {status === "draft" ? `Send draft to ${config.label}` : `Publish to ${config.label}`}
          </button>
        </form>
      </div>
    </div>
  );
}
