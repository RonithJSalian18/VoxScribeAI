"use client";

import { useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

interface DropZoneProps {
  accept: string;
  onFile: (file: File) => void;
  icon: LucideIcon;
  title: string;
  hint: string;
  busy?: boolean;
  busyLabel?: string;
  disabled?: boolean;
  className?: string;
}

/** Click-or-drop file picker with visible drag state and keyboard support. */
export function DropZone({
  accept,
  onFile,
  icon: Icon,
  title,
  hint,
  busy = false,
  busyLabel = "Uploading...",
  disabled = false,
  className,
}: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const inactive = disabled || busy;

  const pick = (files: FileList | null) => {
    const file = files?.[0];
    if (file && !inactive) onFile(file);
  };

  return (
    <div
      role="button"
      tabIndex={inactive ? -1 : 0}
      aria-disabled={inactive}
      onClick={() => !inactive && inputRef.current?.click()}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !inactive) {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!inactive) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        pick(e.dataTransfer.files);
      }}
      className={cn(
        "group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        dragging
          ? "scale-[1.01] border-primary bg-primary/5"
          : "border-border hover:border-primary/50 hover:bg-secondary/50",
        inactive && "cursor-not-allowed opacity-70",
        className,
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          pick(e.target.files);
          e.target.value = "";
        }}
      />
      <div
        className={cn(
          "mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform",
          !inactive && "group-hover:scale-110",
        )}
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
      </div>
      <p className="text-sm font-medium">{busy ? busyLabel : dragging ? "Drop to upload" : title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
