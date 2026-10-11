"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, ExternalLink, Loader2, Lock, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import { apiJson } from "@/lib/api";
import { PublishPlatform, PublishResult } from "@/types";

interface PublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: string;
  defaultTags?: string[];
  getAccessToken: () => Promise<string | null>;
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
    help: "Add a custom integration under Settings → Integrations and copy its Admin API key.",
  },
  {
    id: "hashnode",
    label: "Hashnode",
    fields: [
      { key: "publication_id", label: "Publication ID", placeholder: "From your blog dashboard URL" },
      { key: "api_key", label: "Personal access token", placeholder: "From hashnode.com/settings/developer", secret: true },
    ],
    help: "Generate a token under Settings → Developer. The publication ID is in your dashboard URL.",
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

export function PublishDialog({ open, onOpenChange, content, defaultTags = [], getAccessToken }: PublishDialogProps) {
  const [platform, setPlatform] = useState<PublishPlatform>("devto");
  const [credentials, setCredentials] = useState<Credentials>(EMPTY);
  const [remember, setRemember] = useState(false);
  const [tags, setTags] = useState("");
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

  // Joined string (not the array) so a new [] each render doesn't reset what the user typed
  const defaultTagList = defaultTags.join(", ");
  useEffect(() => {
    if (open) setTags(defaultTagList);
  }, [open, defaultTagList]);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Publish post</DialogTitle>
          <DialogDescription>Send this post to your blog as a draft or publish it right away.</DialogDescription>
        </DialogHeader>

        <SegmentedControl
          label="Platform"
          fullWidth
          size="sm"
          value={platform}
          onChange={setPlatform}
          options={PLATFORMS.map((p) => ({ value: p.id, label: p.label }))}
        />

        <form onSubmit={handlePublish} className="grid gap-4">
          <p className="text-xs text-muted-foreground">{config.help}</p>
          {config.fields.map((field) => (
            <div key={field.key} className="grid gap-2">
              <Label htmlFor={`pub-${field.key}`}>{field.label}</Label>
              <Input
                id={`pub-${field.key}`}
                type={field.secret ? "password" : "text"}
                autoComplete="off"
                required
                placeholder={field.placeholder}
                value={credentials[field.key]}
                onChange={(e) => setCredentials((c) => ({ ...c, [field.key]: e.target.value }))}
              />
            </div>
          ))}

          {platform !== "wordpress" && (
            <div className="grid gap-2">
              <Label htmlFor="pub-tags">Tags</Label>
              <Input id="pub-tags" placeholder="comma, separated" value={tags} onChange={(e) => setTags(e.target.value)} />
            </div>
          )}

          <div className="grid gap-2">
            <Label>Status</Label>
            <SegmentedControl
              label="Publish status"
              fullWidth
              size="sm"
              value={status}
              onChange={setStatus}
              options={[
                { value: "draft", label: "Save as draft" },
                { value: "published", label: "Publish now" },
              ]}
            />
          </div>

          <div className="flex items-start justify-between gap-4 rounded-xl border bg-secondary/40 p-3">
            <div>
              <Label htmlFor="pub-remember" className="cursor-pointer">
                Remember on this device
              </Label>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" /> Stored only in this browser, never on our servers.
              </p>
            </div>
            <Switch id="pub-remember" checked={remember} onCheckedChange={setRemember} />
          </div>

          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {result && (
            <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 p-3 text-sm">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
              <p className="flex-1">
                {result.status === "draft" ? "Draft created" : "Published"} on {config.label}.
              </p>
              {result.url && (
                <a href={result.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                  Open <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          )}

          <Button type="submit" disabled={isPublishing} className="h-10 w-full">
            {isPublishing ? <Loader2 className="animate-spin" /> : <Send />}
            {status === "draft" ? `Send draft to ${config.label}` : `Publish to ${config.label}`}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
