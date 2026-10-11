"use client";

import { useEffect, useState } from "react";
import { BookOpenText, Check, ClipboardCheck, Loader2, PenLine, RefreshCcw, Sparkles, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { GenerationProgressEvent } from "@/types";

interface GenerationProgressProps {
  /** Progress events received so far, in order. */
  events: GenerationProgressEvent[];
}

interface Step {
  key: string;
  icon: LucideIcon;
  agent: string;
  running: string;
  done: string;
  isDone: boolean;
}

const pluralize = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Derives the pipeline's step list (including an optional revision step) from stream events. */
export const buildSteps = (events: GenerationProgressEvent[]): Step[] => {
  const writes = events.filter((e) => e.node === "writer");
  const review = events.find((e) => e.node === "reviewer");
  const voiceSamples = writes[0]?.voice_samples;

  const steps: Step[] = [
    {
      key: "researcher",
      icon: BookOpenText,
      agent: "Researcher",
      running: "Reading the source and building an outline",
      done: "Source analyzed, outline ready",
      isDone: events.some((e) => e.node === "researcher"),
    },
    {
      key: "writer",
      icon: PenLine,
      agent: "Writer",
      running: "Matching your Brand Voice and drafting",
      done:
        voiceSamples === undefined
          ? "Draft written"
          : voiceSamples > 0
            ? `Draft written using ${pluralize(voiceSamples, "voice sample")}`
            : "Draft written (no voice samples found)",
      isDone: writes.length >= 1,
    },
    {
      key: "reviewer",
      icon: ClipboardCheck,
      agent: "Reviewer",
      running: "Scoring voice match and coverage",
      done:
        review?.score != null
          ? `Scored ${review.score}/10${review.revision_requested ? " — revision requested" : ""}`
          : "Draft reviewed",
      isDone: Boolean(review),
    },
  ];

  if (review?.revision_requested) {
    steps.push({
      key: "revision",
      icon: RefreshCcw,
      agent: "Writer",
      running: "Revising based on the reviewer's feedback",
      done: "Draft revised",
      isDone: writes.length >= 2,
    });
  }

  steps.push({
    key: "editor",
    icon: Sparkles,
    agent: "Editor",
    running: "Polishing the title, structure and formatting",
    done: "Content polished",
    isDone: events.some((e) => e.node === "editor"),
  });

  // The reviewer is skipped when the writer errors; treat it as done once the editor finishes
  if (steps[steps.length - 1].isDone) steps.forEach((s) => (s.isDone = true));
  return steps;
};

function useElapsedSeconds() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  return seconds;
}

export function GenerationProgress({ events }: GenerationProgressProps) {
  const steps = buildSteps(events);
  const activeIndex = steps.findIndex((s) => !s.isDone);
  const doneCount = steps.filter((s) => s.isDone).length;
  const elapsed = useElapsedSeconds();

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8" aria-live="polite">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Your agents are working</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Step {Math.min(doneCount + 1, steps.length)} of {steps.length} · {elapsed}s elapsed
          </p>
        </div>
        <div className="relative flex h-11 w-11 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
          <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Loader2 className="h-5 w-5 animate-spin" />
          </span>
        </div>
      </div>

      <ol className="relative">
        {steps.map((step, index) => {
          const isActive = index === activeIndex;
          const Icon = step.icon;
          const isLast = index === steps.length - 1;
          return (
            <li key={step.key} className="relative flex gap-4 pb-7 last:pb-0">
              {!isLast && (
                <span
                  className={cn(
                    "absolute left-[19px] top-10 h-[calc(100%-2.5rem)] w-px",
                    step.isDone ? "bg-primary/40" : "bg-border",
                  )}
                  aria-hidden="true"
                />
              )}
              <span
                className={cn(
                  "relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-all duration-500",
                  step.isDone && "border-primary bg-primary text-primary-foreground",
                  isActive && "border-primary bg-primary/10 text-primary ring-4 ring-primary/10",
                  !step.isDone && !isActive && "bg-secondary text-muted-foreground",
                )}
              >
                {step.isDone ? <Check className="h-4 w-4" strokeWidth={3} /> : <Icon className="h-4 w-4" />}
              </span>
              <div className={cn("pt-1.5 transition-opacity", !step.isDone && !isActive && "opacity-50")}>
                <p className="text-sm font-semibold">{step.agent}</p>
                <p className="text-sm text-muted-foreground">
                  {step.isDone ? step.done : step.running}
                  {isActive && <span className="ml-1 inline-flex w-4 animate-pulse">…</span>}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
