"use client";

import React, { useState } from "react";
import {
  Wand2,
  Loader2,
  AlertCircle,
  Youtube,
  Newspaper,
  Mic,
  ChevronDown,
  CheckCircle2,
  X,
} from "lucide-react";
import { apiJson } from "@/lib/api";
import { DEFAULT_OPTIONS, LANGUAGES, OUTPUT_FORMATS, TONE_SUGGESTIONS } from "@/lib/formats";
import { GenerateRequestBody, GenerationOptions, ModelInfo, TranscriptionResponse } from "@/types";

type SourceTab = "youtube" | "article" | "audio";

interface GeneratePostCardProps {
  onGenerate: (body: Omit<GenerateRequestBody, "voice_id">) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  voiceName?: string;
  getAccessToken: () => Promise<string | null>;
  models?: ModelInfo[];
}

const SOURCE_TABS: { id: SourceTab; label: string; icon: typeof Youtube }[] = [
  { id: "youtube", label: "YouTube", icon: Youtube },
  { id: "article", label: "Article", icon: Newspaper },
  { id: "audio", label: "Audio file", icon: Mic },
];

export function GeneratePostCard({
  onGenerate,
  isLoading,
  error,
  voiceName,
  getAccessToken,
  models = [],
}: GeneratePostCardProps) {
  const [sourceTab, setSourceTab] = useState<SourceTab>("youtube");
  const [url, setUrl] = useState("");
  const [audio, setAudio] = useState<TranscriptionResponse | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [options, setOptions] = useState<GenerationOptions>(DEFAULT_OPTIONS);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [reviewOutline, setReviewOutline] = useState(false);

  const setOption = <K extends keyof GenerationOptions>(key: K, value: GenerationOptions[K]) =>
    setOptions((prev) => ({ ...prev, [key]: value }));

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      setLocalError("Audio file is too large. The maximum size is 25MB.");
      return;
    }

    setIsTranscribing(true);
    setLocalError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      setAudio(
        await apiJson<TranscriptionResponse>("/generate/transcribe", await getAccessToken(), {
          method: "POST",
          body: formData,
        })
      );
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Transcription failed.");
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (sourceTab === "audio") {
      if (!audio) {
        setLocalError("Upload an audio file first.");
        return;
      }
      await onGenerate({
        source_type: "text",
        transcript: audio.transcript,
        timestamped_transcript: audio.timestamped_transcript,
        source_label: audio.filename,
        options,
        review_outline: reviewOutline,
      });
    } else {
      await onGenerate({ source_type: sourceTab, source_url: url, options, review_outline: reviewOutline });
    }
  };

  const inputClass =
    "w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all outline-none text-zinc-900 placeholder:text-zinc-400 text-sm";
  const shownError = localError || error;
  const keywordApplies = options.output_format === "blog" || options.output_format === "newsletter";

  return (
    <section className="bg-white p-8 rounded-3xl shadow-[0_2px_10px_rgb(0,0,0,0.02)] border border-zinc-100">
      <div className="flex items-center justify-between gap-4 mb-6">
        <h2 className="text-xl font-semibold tracking-tight text-zinc-900">Generate Content</h2>
        {voiceName && (
          <span className="text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full">
            Writing as: {voiceName}
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="grid gap-6">
        {/* Source */}
        <div>
          <div className="flex gap-1 p-1 bg-zinc-100 rounded-xl mb-3 w-fit">
            {SOURCE_TABS.map(({ id, label, icon: Icon }) => (
              <button
                type="button"
                key={id}
                onClick={() => setSourceTab(id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  sourceTab === id ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {sourceTab === "audio" ? (
            audio ? (
              <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-sm text-emerald-800">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <p className="flex-1 min-w-0 truncate">
                  Transcribed <span className="font-semibold">{audio.filename}</span> ·{" "}
                  {audio.transcript.split(/\s+/).length.toLocaleString()} words
                </p>
                <button type="button" onClick={() => setAudio(null)} aria-label="Remove audio" className="p-1 rounded-lg hover:bg-emerald-100">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="relative border-2 border-dashed border-zinc-200 rounded-2xl p-6 hover:bg-zinc-50 transition-colors text-center">
                <input
                  type="file"
                  accept="audio/*,video/mp4,video/webm,.m4a,.mp3,.wav,.ogg,.flac,.webm,.mp4"
                  onChange={handleAudioUpload}
                  disabled={isTranscribing}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
                {isTranscribing ? (
                  <p className="flex items-center justify-center gap-2 text-sm font-medium text-indigo-700">
                    <Loader2 className="w-4 h-4 animate-spin" /> Transcribing with Whisper...
                  </p>
                ) : (
                  <>
                    <p className="font-semibold text-zinc-900 text-sm">Upload a podcast or recording</p>
                    <p className="text-xs text-zinc-500 mt-1">MP3, M4A, WAV, WEBM, OGG, FLAC or MP4 (Max 25MB)</p>
                  </>
                )}
              </div>
            )
          ) : (
            <input
              type="url"
              placeholder={sourceTab === "youtube" ? "Paste YouTube URL here..." : "Paste article URL here..."}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              className={`${inputClass} p-4 text-base rounded-2xl`}
            />
          )}
        </div>

        {/* Output format */}
        <div>
          <p className="text-sm font-medium text-zinc-700 mb-2">Output format</p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {OUTPUT_FORMATS.map((format) => (
              <button
                type="button"
                key={format.id}
                onClick={() => setOption("output_format", format.id)}
                title={format.description}
                className={`px-3 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                  options.output_format === format.id
                    ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                    : "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300"
                }`}
              >
                {format.label}
              </button>
            ))}
          </div>
        </div>

        {/* Advanced options */}
        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-900"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
            Advanced options
          </button>

          {showAdvanced && (
            <div className="grid sm:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Length</label>
                <div className="flex gap-1 p-1 bg-zinc-100 rounded-xl">
                  {(["short", "medium", "long"] as const).map((len) => (
                    <button
                      type="button"
                      key={len}
                      onClick={() => setOption("length", len)}
                      className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
                        options.length === len ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
                      }`}
                    >
                      {len}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label htmlFor="opt-language" className="text-xs font-medium text-zinc-500 mb-1.5 block">
                  Language
                </label>
                <select
                  id="opt-language"
                  value={options.language}
                  onChange={(e) => setOption("language", e.target.value)}
                  className={inputClass}
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang}>{lang}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="opt-tone" className="text-xs font-medium text-zinc-500 mb-1.5 block">
                  Tone (optional)
                </label>
                <input
                  id="opt-tone"
                  list="tone-suggestions"
                  placeholder="Match my voice"
                  value={options.tone}
                  onChange={(e) => setOption("tone", e.target.value)}
                  maxLength={80}
                  className={inputClass}
                />
                <datalist id="tone-suggestions">
                  {TONE_SUGGESTIONS.map((tone) => (
                    <option key={tone} value={tone} />
                  ))}
                </datalist>
              </div>
              <div>
                <label htmlFor="opt-audience" className="text-xs font-medium text-zinc-500 mb-1.5 block">
                  Target audience (optional)
                </label>
                <input
                  id="opt-audience"
                  placeholder="e.g. early-stage founders"
                  value={options.audience}
                  onChange={(e) => setOption("audience", e.target.value)}
                  maxLength={200}
                  className={inputClass}
                />
              </div>
              {models.length > 1 && (
                <div className="sm:col-span-2">
                  <label htmlFor="opt-model" className="text-xs font-medium text-zinc-500 mb-1.5 block">
                    AI model
                  </label>
                  <select
                    id="opt-model"
                    value={options.model || models.find((m) => m.default)?.id || ""}
                    onChange={(e) => setOption("model", e.target.value)}
                    className={inputClass}
                  >
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.id}
                        {m.default ? " (default)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="sm:col-span-2">
                <label htmlFor="opt-keyword" className="text-xs font-medium text-zinc-500 mb-1.5 block">
                  SEO keyword (optional{keywordApplies ? "" : " — used for blog posts and newsletters"})
                </label>
                <input
                  id="opt-keyword"
                  placeholder="e.g. remote team productivity"
                  value={options.keyword}
                  onChange={(e) => setOption("keyword", e.target.value)}
                  maxLength={100}
                  disabled={!keywordApplies}
                  className={`${inputClass} disabled:opacity-50`}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <label className="flex items-center gap-2 text-sm text-zinc-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={reviewOutline}
              onChange={(e) => setReviewOutline(e.target.checked)}
              className="w-4 h-4 rounded accent-indigo-600"
            />
            Let me review the outline before writing
          </label>
          <button
            type="submit"
            disabled={isLoading || isTranscribing}
            className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-semibold hover:bg-indigo-700 disabled:bg-indigo-400 transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)] hover:shadow-[0_0_25px_rgba(79,70,229,0.5)] flex items-center justify-center gap-2 min-w-[200px]"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Wand2 className="w-5 h-5" />
                Generate
              </>
            )}
          </button>
        </div>
      </form>

      {shownError && (
        <div className="mt-6 flex items-center gap-2 bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-xl text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p>{shownError}</p>
        </div>
      )}
    </section>
  );
}
