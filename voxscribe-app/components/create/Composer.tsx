"use client";

import React, { useMemo, useState } from "react";
import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  ChevronDown,
  ClipboardPaste,
  FileText,
  Link2,
  ListMusic,
  Loader2,
  Mail,
  MessagesSquare,
  Mic,
  Newspaper,
  Settings2,
  Wand2,
  X,
  Youtube,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropZone } from "@/components/ui/drop-zone";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import { apiJson } from "@/lib/api";
import { DEFAULT_OPTIONS, LANGUAGES, OUTPUT_FORMATS, TONE_SUGGESTIONS } from "@/lib/formats";
import { getYoutubeId } from "@/lib/markdown";
import { cn } from "@/lib/utils";
import {
  GenerateRequestBody,
  GenerationOptions,
  ModelInfo,
  OutputFormat,
  TranscriptionResponse,
  Voice,
} from "@/types";

type SourceTab = "youtube" | "article" | "audio";

const FORMAT_ICONS: Record<OutputFormat, LucideIcon> = {
  blog: FileText,
  twitter_thread: MessagesSquare,
  linkedin: Briefcase,
  newsletter: Mail,
  show_notes: ListMusic,
};

interface ComposerProps {
  onGenerate: (body: GenerateRequestBody) => Promise<void>;
  isLoading: boolean;
  voices: Voice[];
  selectedVoice: Voice | null;
  onSelectVoice: (id: string) => void;
  onManageVoices: () => void;
  models: ModelInfo[];
  getAccessToken: () => Promise<string | null>;
}

const isHttpUrl = (value: string) => {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="grid gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Composer({
  onGenerate,
  isLoading,
  voices,
  selectedVoice,
  onSelectVoice,
  onManageVoices,
  models,
  getAccessToken,
}: ComposerProps) {
  const [sourceTab, setSourceTab] = useState<SourceTab>("youtube");
  const [url, setUrl] = useState("");
  const [touched, setTouched] = useState(false);
  const [audio, setAudio] = useState<TranscriptionResponse | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [options, setOptions] = useState<GenerationOptions>(DEFAULT_OPTIONS);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [reviewOutline, setReviewOutline] = useState(false);

  const setOption = <K extends keyof GenerationOptions>(key: K, value: GenerationOptions[K]) =>
    setOptions((prev) => ({ ...prev, [key]: value }));

  const youtubeId = sourceTab === "youtube" ? getYoutubeId(url) : null;
  const urlError = useMemo(() => {
    if (!url.trim()) return null;
    if (sourceTab === "youtube" && !youtubeId) return "That doesn't look like a YouTube video link.";
    if (sourceTab === "article" && !isHttpUrl(url.trim())) return "Enter a full URL starting with https://";
    return null;
  }, [url, sourceTab, youtubeId]);

  const canSubmit =
    !isLoading &&
    !isTranscribing &&
    (sourceTab === "audio" ? Boolean(audio) : Boolean(url.trim()) && !urlError);

  const keywordApplies = options.output_format === "blog" || options.output_format === "newsletter";

  const handlePaste = async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (text) {
        setUrl(text);
        setTouched(true);
      }
    } catch {
      toast.error("Clipboard access was blocked. Paste the link with Ctrl+V instead.");
    }
  };

  const handleAudio = async (file: File) => {
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Audio file is too large. The maximum size is 25MB.");
      return;
    }
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await apiJson<TranscriptionResponse>("/generate/transcribe", await getAccessToken(), {
        method: "POST",
        body: formData,
      });
      setAudio(result);
      toast.success(`Transcribed ${result.filename}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Transcription failed.");
    } finally {
      setIsTranscribing(false);
    }
  };

  const submit = async () => {
    setTouched(true);
    if (!canSubmit) return;
    const voice_id = selectedVoice?.id ?? null;
    if (sourceTab === "audio" && audio) {
      await onGenerate({
        source_type: "text",
        transcript: audio.transcript,
        timestamped_transcript: audio.timestamped_transcript,
        source_label: audio.filename,
        voice_id,
        options,
        review_outline: reviewOutline,
      });
    } else {
      await onGenerate({
        source_type: sourceTab === "audio" ? "youtube" : sourceTab,
        source_url: url.trim(),
        voice_id,
        options,
        review_outline: reviewOutline,
      });
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          submit();
        }
      }}
      className="grid gap-7 rounded-2xl border bg-card p-5 shadow-sm sm:p-6"
    >
      {/* Source */}
      <Section title="Source">
        <SegmentedControl
          label="Source type"
          fullWidth
          value={sourceTab}
          onChange={(v) => {
            setSourceTab(v);
            setTouched(false);
          }}
          options={[
            { value: "youtube", label: "YouTube", icon: Youtube },
            { value: "article", label: "Article", icon: Newspaper },
            { value: "audio", label: "Audio", icon: Mic },
          ]}
        />

        {sourceTab === "audio" ? (
          audio ? (
            <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success/10 p-3.5 text-sm">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{audio.filename}</p>
                <p className="text-xs text-muted-foreground">
                  {audio.transcript.split(/\s+/).length.toLocaleString()} words transcribed
                </p>
              </div>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => setAudio(null)} aria-label="Remove audio">
                <X />
              </Button>
            </div>
          ) : (
            <DropZone
              accept="audio/*,video/mp4,video/webm,.m4a,.mp3,.wav,.ogg,.flac,.webm,.mp4"
              onFile={handleAudio}
              icon={Mic}
              title="Drop a podcast or recording"
              hint="MP3, M4A, WAV, WEBM, OGG, FLAC or MP4 · up to 25MB"
              busy={isTranscribing}
              busyLabel="Transcribing with Whisper..."
            />
          )
        ) : (
          <div className="grid gap-2">
            <div className="relative">
              <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="url"
                inputMode="url"
                aria-label={sourceTab === "youtube" ? "YouTube URL" : "Article URL"}
                aria-invalid={Boolean(touched && urlError)}
                placeholder={sourceTab === "youtube" ? "https://youtube.com/watch?v=..." : "https://example.com/article"}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onBlur={() => setTouched(true)}
                className={cn("h-11 pl-9 pr-11", touched && urlError && "border-destructive focus-visible:ring-destructive/30")}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={handlePaste}
                className="absolute right-1.5 top-1/2 -translate-y-1/2"
                aria-label="Paste link from clipboard"
                title="Paste from clipboard"
              >
                <ClipboardPaste />
              </Button>
            </div>
            {touched && urlError && (
              <p className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5" /> {urlError}
              </p>
            )}
            {youtubeId && (
              <div className="flex items-center gap-3 rounded-xl border bg-secondary/40 p-2 animate-in fade-in">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={youtubeId}
                  src={`https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`}
                  alt=""
                  onError={(e) => (e.currentTarget.style.display = "none")}
                  className="h-12 w-20 shrink-0 rounded-md bg-secondary object-cover"
                />
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Video found.</span> Captions are used when available,
                  otherwise the audio is transcribed.
                </p>
              </div>
            )}
          </div>
        )}
      </Section>

      {/* Format */}
      <Section title="Format">
        <div role="radiogroup" aria-label="Output format" className="flex flex-wrap gap-2">
          {OUTPUT_FORMATS.map((format) => {
            const Icon = FORMAT_ICONS[format.id];
            const selected = options.output_format === format.id;
            return (
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                key={format.id}
                title={format.description}
                onClick={() => setOption("output_format", format.id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selected
                    ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary"
                    : "text-muted-foreground hover:border-foreground/20 hover:bg-secondary/50 hover:text-foreground",
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", selected && "text-primary")} />
                <span className="whitespace-nowrap">{format.label}</span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {OUTPUT_FORMATS.find((f) => f.id === options.output_format)?.description}
        </p>
      </Section>

      {/* Voice */}
      <Section
        title="Voice"
        action={
          <button type="button" onClick={onManageVoices} className="text-xs font-medium text-primary hover:underline">
            Manage voices
          </button>
        }
      >
        <NativeSelect
          aria-label="Brand voice"
          value={selectedVoice?.id ?? ""}
          onChange={(e) => onSelectVoice(e.target.value)}
          disabled={voices.length === 0}
        >
          {voices.length === 0 && <option value="">Loading voices...</option>}
          {voices.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name} · {v.source_count} sample{v.source_count === 1 ? "" : "s"}
            </option>
          ))}
        </NativeSelect>
        {selectedVoice && selectedVoice.source_count === 0 && (
          <p className="text-xs text-muted-foreground">
            This voice has no writing samples yet, so output will use a neutral style.{" "}
            <button type="button" onClick={onManageVoices} className="font-medium text-primary hover:underline">
              Add a sample
            </button>
          </p>
        )}
      </Section>

      {/* Advanced */}
      <section className="grid gap-4">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          aria-expanded={showAdvanced}
          className="flex items-center justify-between rounded-lg text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            Fine-tune
            {(options.tone || options.audience || options.keyword || options.language !== "English" || options.length !== "medium") && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">Customized</span>
            )}
          </span>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", showAdvanced && "rotate-180")} />
        </button>

        {showAdvanced && (
          <div className="grid gap-4 animate-in fade-in slide-in-from-top-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2 lg:col-span-1 xl:col-span-2">
              <Label>Length</Label>
              <SegmentedControl
                label="Length"
                fullWidth
                size="sm"
                value={options.length}
                onChange={(v) => setOption("length", v)}
                options={[
                  { value: "short", label: "Short" },
                  { value: "medium", label: "Medium" },
                  { value: "long", label: "Long" },
                ]}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="opt-language">Language</Label>
              <NativeSelect id="opt-language" value={options.language} onChange={(e) => setOption("language", e.target.value)}>
                {LANGUAGES.map((lang) => (
                  <option key={lang}>{lang}</option>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="opt-tone">Tone</Label>
              <Input
                id="opt-tone"
                list="tone-suggestions"
                placeholder="Match my voice"
                value={options.tone}
                onChange={(e) => setOption("tone", e.target.value)}
                maxLength={80}
              />
              <datalist id="tone-suggestions">
                {TONE_SUGGESTIONS.map((tone) => (
                  <option key={tone} value={tone} />
                ))}
              </datalist>
            </div>
            <div className="grid gap-2 sm:col-span-2 lg:col-span-1 xl:col-span-2">
              <Label htmlFor="opt-audience">Audience</Label>
              <Input
                id="opt-audience"
                placeholder="e.g. early-stage founders"
                value={options.audience}
                onChange={(e) => setOption("audience", e.target.value)}
                maxLength={200}
              />
            </div>
            <div className="grid gap-2 sm:col-span-2 lg:col-span-1 xl:col-span-2">
              <Label htmlFor="opt-keyword">SEO keyword</Label>
              <Input
                id="opt-keyword"
                placeholder={keywordApplies ? "e.g. remote team productivity" : "Used for blog posts and newsletters"}
                value={options.keyword}
                onChange={(e) => setOption("keyword", e.target.value)}
                maxLength={100}
                disabled={!keywordApplies}
              />
            </div>
            {models.length > 1 && (
              <div className="grid gap-2 sm:col-span-2 lg:col-span-1 xl:col-span-2">
                <Label htmlFor="opt-model">AI model</Label>
                <NativeSelect
                  id="opt-model"
                  value={options.model || models.find((m) => m.default)?.id || ""}
                  onChange={(e) => setOption("model", e.target.value)}
                >
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.id}
                      {m.default ? " (default)" : ""}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Review toggle + submit */}
      <div className="grid gap-4 border-t pt-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Label htmlFor="review-outline" className="cursor-pointer">
              Review outline first
            </Label>
            <p id="review-outline-hint" className="mt-0.5 text-xs text-muted-foreground">
              Pause after research so you can edit the structure.
            </p>
          </div>
          <Switch
            id="review-outline"
            checked={reviewOutline}
            onCheckedChange={setReviewOutline}
            aria-describedby="review-outline-hint"
          />
        </div>

        <Button type="submit" size="lg" disabled={!canSubmit} className="relative w-full">
          {isLoading ? <Loader2 className="animate-spin" /> : <Wand2 />}
          {isLoading ? "Generating..." : "Generate"}
          {!isLoading && (
            <kbd className="absolute right-3 hidden rounded border border-current px-1.5 py-0.5 font-mono text-[10px] font-normal opacity-60 sm:inline">
              Ctrl ↵
            </kbd>
          )}
        </Button>
      </div>
    </form>
  );
}
