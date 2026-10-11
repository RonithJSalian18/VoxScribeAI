"use client";

import { Loader2, CheckCircle2 } from "lucide-react";
import { GenerationProgressEvent } from "@/types";

interface GenerationProgressProps {
  /** Progress events received so far, in order. */
  events: GenerationProgressEvent[];
}

interface Step {
  key: string;
  running: string;
  done: string;
  isDone: boolean;
}

const pluralize = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Derives the pipeline's step list (including an optional revision step) from stream events. */
const buildSteps = (events: GenerationProgressEvent[]): Step[] => {
  const writes = events.filter((e) => e.node === "writer");
  const review = events.find((e) => e.node === "reviewer");
  const voiceSamples = writes[0]?.voice_samples;

  const steps: Step[] = [
    {
      key: "researcher",
      running: "Researcher: reading the source & outlining...",
      done: "Source analyzed & outline ready",
      isDone: events.some((e) => e.node === "researcher"),
    },
    {
      key: "writer",
      running: "Writer: matching your Brand Voice & drafting...",
      done:
        voiceSamples === undefined
          ? "Draft written"
          : voiceSamples > 0
            ? `Draft written using ${pluralize(voiceSamples, "Brand Voice sample")}`
            : "Draft written (no Brand Voice samples found)",
      isDone: writes.length >= 1,
    },
    {
      key: "reviewer",
      running: "Reviewer: scoring voice match & coverage...",
      done:
        review?.score != null
          ? `Reviewed: ${review.score}/10${review.revision_requested ? " — revision requested" : ""}`
          : "Reviewed",
      isDone: Boolean(review),
    },
  ];

  if (review?.revision_requested) {
    steps.push({
      key: "revision",
      running: "Writer: revising based on feedback...",
      done: "Draft revised",
      isDone: writes.length >= 2,
    });
  }

  steps.push({
    key: "editor",
    running: "Editor: polishing title & formatting...",
    done: "Content polished",
    isDone: events.some((e) => e.node === "editor"),
  });

  // The reviewer is skipped when the writer errors; treat it as done once the editor finishes
  if (steps[steps.length - 1].isDone) steps.forEach((s) => (s.isDone = true));
  return steps;
};

export function GenerationProgress({ events }: GenerationProgressProps) {
  const steps = buildSteps(events);
  const activeIndex = steps.findIndex((s) => !s.isDone);

  return (
    <div className="bg-white p-8 rounded-3xl shadow-[0_2px_10px_rgb(0,0,0,0.02)] border border-zinc-100 flex flex-col items-center justify-center py-16">
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-indigo-500 rounded-full blur-xl opacity-20 animate-pulse"></div>
        <div className="bg-indigo-50 p-6 rounded-full relative">
          <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
        </div>
      </div>

      <div className="space-y-4 w-full max-w-sm">
        {steps.map((step, index) => {
          const isActive = index === activeIndex;
          return (
            <div
              key={step.key}
              className={`flex items-center gap-3 transition-opacity duration-500 ${
                step.isDone || isActive ? "opacity-100" : "opacity-30"
              }`}
            >
              {step.isDone ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              ) : (
                <Loader2 className={`w-5 h-5 text-indigo-500 shrink-0 ${isActive ? "animate-spin" : ""}`} />
              )}
              <p className="font-medium text-zinc-700">{step.isDone ? step.done : step.running}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
