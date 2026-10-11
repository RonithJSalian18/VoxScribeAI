"use client";

import { useState } from "react";
import { ListChecks, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface OutlineReviewProps {
  outline: string;
  onContinue: (outline: string) => void;
  onCancel: () => void;
}

export function OutlineReview({ outline, onContinue, onCancel }: OutlineReviewProps) {
  const [draft, setDraft] = useState(outline);
  const edited = draft !== outline;

  return (
    <section className="rounded-2xl border border-primary/30 bg-card p-6 shadow-sm ring-4 ring-primary/5 animate-in fade-in slide-in-from-bottom-2 sm:p-8">
      <div className="flex items-start gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ListChecks className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Review the outline</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Reorder, add or remove points. The Writer will follow your version exactly.
          </p>
        </div>
      </div>

      <Textarea
        aria-label="Outline"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={16}
        className="mt-6 resize-y font-mono text-[13px] leading-relaxed"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && draft.trim()) {
            e.preventDefault();
            onContinue(draft);
          }
        }}
      />

      <div className="mt-4 flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">{edited ? "Edited · " : ""}Ctrl+Enter to continue</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel} className="flex-1 sm:flex-none">
            Discard
          </Button>
          <Button onClick={() => onContinue(draft)} disabled={!draft.trim()} className="flex-1 sm:flex-none">
            <Wand2 />
            Continue writing
          </Button>
        </div>
      </div>
    </section>
  );
}
