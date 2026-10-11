"use client";

import { useState } from "react";
import { ListChecks, Wand2, X } from "lucide-react";

interface OutlineReviewProps {
  outline: string;
  onContinue: (outline: string) => void;
  onCancel: () => void;
}

export function OutlineReview({ outline, onContinue, onCancel }: OutlineReviewProps) {
  const [draft, setDraft] = useState(outline);

  return (
    <section className="bg-white p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-indigo-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3 mb-2">
        <ListChecks className="w-6 h-6 text-indigo-600" />
        <h2 className="text-xl font-semibold tracking-tight text-zinc-900">Review the outline</h2>
      </div>
      <p className="text-zinc-500 text-sm mb-6">
        The Researcher has drafted this outline. Reorder, add or remove points, then continue and
        the Writer will follow your version.
      </p>

      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={14}
        className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none text-sm font-mono text-zinc-800 resize-y"
      />

      <div className="flex justify-end gap-3 mt-4">
        <button
          onClick={onCancel}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-zinc-600 hover:bg-zinc-100"
        >
          <X className="w-4 h-4" />
          Discard
        </button>
        <button
          onClick={() => onContinue(draft)}
          disabled={!draft.trim()}
          className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:bg-indigo-300"
        >
          <Wand2 className="w-4 h-4" />
          Continue writing
        </button>
      </div>
    </section>
  );
}
