"use client";

import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AlertTriangle, AudioLines, Link2, RotateCcw, Shapes, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Composer } from "@/components/create/Composer";
import { GenerationProgress } from "@/components/create/GenerationProgress";
import { OutlineReview } from "@/components/create/OutlineReview";
import { PostWorkspace } from "@/components/post/PostWorkspace";
import { cn } from "@/lib/utils";
import {
  GenerateRequestBody,
  GenerationProgressEvent,
  ModelInfo,
  OutputFormat,
  Voice,
} from "@/types";

export interface GenerationResult {
  content: string;
  postId?: string | null;
  sourceUrl?: string | null;
  outputFormat?: OutputFormat;
}

interface CreateViewProps {
  voices: Voice[];
  selectedVoice: Voice | null;
  onSelectVoice: (id: string) => void;
  onManageVoices: () => void;
  models: ModelInfo[];
  supabase: SupabaseClient | null;
  getAccessToken: () => Promise<string | null>;

  isLoading: boolean;
  progressEvents: GenerationProgressEvent[];
  pendingOutline: { threadId: string; outline: string } | null;
  result: GenerationResult | null;
  error: string | null;
  canRetry: boolean;
  onGenerate: (body: GenerateRequestBody) => Promise<void>;
  onResume: (outline: string) => void;
  onDiscardOutline: () => void;
  onRetry: () => void;
}

const STEPS = [
  { icon: Link2, title: "Add a source", text: "Paste a YouTube or article link, or upload audio." },
  { icon: Shapes, title: "Pick a format", text: "Blog post, thread, LinkedIn post, newsletter or show notes." },
  { icon: AudioLines, title: "Write in your voice", text: "Four agents research, write, review and polish it for you." },
];

function IdleState({ voiceHasSamples, onManageVoices }: { voiceHasSamples: boolean; onManageVoices: () => void }) {
  return (
    <div className="bg-glow flex h-full min-h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed p-8 text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-fuchsia-500 text-white shadow-lg shadow-primary/25">
        <Wand2 className="h-6 w-6" />
      </div>
      <h2 className="text-xl font-semibold tracking-tight">Ready when you are</h2>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
        Your generated content appears here, ready to edit, optimize and publish.
      </p>

      <ol className="mt-8 grid w-full max-w-2xl gap-3 text-left sm:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, text }, i) => (
          <li key={title} className="rounded-xl border bg-card/80 p-4 backdrop-blur">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {i + 1}
              </span>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">{title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{text}</p>
          </li>
        ))}
      </ol>

      {!voiceHasSamples && (
        <p className="mt-6 text-sm text-muted-foreground">
          Tip: results sound most like you after you{" "}
          <button onClick={onManageVoices} className="font-medium text-primary hover:underline">
            add a writing sample
          </button>
          .
        </p>
      )}
    </div>
  );
}

export function CreateView(props: CreateViewProps) {
  const { isLoading, progressEvents, pendingOutline, result, error } = props;
  const [focusMode, setFocusMode] = useState(false);
  const showComposer = !(focusMode && result && !isLoading);
  const outputRef = useRef<HTMLDivElement>(null);

  // Bring the output panel into view whenever it changes state (most useful on phones,
  // where it sits below the form). Skips the initial idle state.
  const phase = isLoading ? "loading" : pendingOutline ? "outline" : result ? "result" : error ? "error" : "idle";
  useEffect(() => {
    const el = outputRef.current;
    if (phase === "idle" || !el) return;
    const { top } = el.getBoundingClientRect();
    if (top < 0 || top > window.innerHeight * 0.6) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [phase]);

  return (
    <div className={cn("grid items-start gap-6", showComposer && "lg:grid-cols-[minmax(340px,400px)_1fr]")}>
      {showComposer && (
        <div>
          <Composer
            onGenerate={props.onGenerate}
            isLoading={isLoading}
            voices={props.voices}
            selectedVoice={props.selectedVoice}
            onSelectVoice={props.onSelectVoice}
            onManageVoices={props.onManageVoices}
            models={props.models}
            getAccessToken={props.getAccessToken}
          />
        </div>
      )}

      <div ref={outputRef} className="min-w-0 scroll-mt-20 lg:scroll-mt-6">
        {isLoading ? (
          <GenerationProgress events={progressEvents} />
        ) : pendingOutline ? (
          <OutlineReview
            key={pendingOutline.threadId}
            outline={pendingOutline.outline}
            onContinue={props.onResume}
            onCancel={props.onDiscardOutline}
          />
        ) : error && !result ? (
          <div role="alert" className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center">
            <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <AlertTriangle className="h-6 w-6" />
            </span>
            <h2 className="font-semibold">Generation didn&apos;t finish</h2>
            <p className="mt-1.5 max-w-md text-sm text-muted-foreground">{error}</p>
            {props.canRetry && (
              <Button variant="outline" onClick={props.onRetry} className="mt-5">
                <RotateCcw /> Try again
              </Button>
            )}
          </div>
        ) : result ? (
          <PostWorkspace
            key={result.postId ?? result.content.slice(0, 50)}
            content={result.content}
            postId={result.postId}
            sourceUrl={result.sourceUrl}
            outputFormat={result.outputFormat}
            voiceId={props.selectedVoice?.id}
            supabase={props.supabase}
            getAccessToken={props.getAccessToken}
            wide={focusMode}
            onToggleWide={() => setFocusMode((v) => !v)}
          />
        ) : (
          <IdleState
            voiceHasSamples={(props.selectedVoice?.source_count ?? 0) > 0}
            onManageVoices={props.onManageVoices}
          />
        )}
      </div>
    </div>
  );
}
