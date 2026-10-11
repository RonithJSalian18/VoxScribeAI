"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  UploadCloud,
  CheckCircle2,
  Loader2,
  AlertCircle,
  FileText,
  Link2,
  Type,
  Trash2,
  Plus,
  Pencil,
  RefreshCw,
  Sparkles,
  Globe,
} from "lucide-react";
import { apiJson } from "@/lib/api";
import { VaultSource, VaultUploadResponse, Voice } from "@/types";

interface BrandVaultCardProps {
  voices: Voice[];
  selectedVoice: Voice | null;
  onSelectVoice: (id: string) => void;
  onVoicesChanged: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}

type InputMode = "file" | "text" | "url";
type Status = { kind: "success" | "error" | "info"; text: string } | null;

const MODES: { id: InputMode; label: string; icon: typeof UploadCloud }[] = [
  { id: "file", label: "Upload file", icon: UploadCloud },
  { id: "text", label: "Paste text", icon: Type },
  { id: "url", label: "From URL", icon: Link2 },
];

const sourceIcon = (type: VaultSource["source_type"]) =>
  type === "url" ? Globe : type === "text" ? Type : FileText;

export function BrandVaultCard({
  voices,
  selectedVoice,
  onSelectVoice,
  onVoicesChanged,
  getAccessToken,
}: BrandVaultCardProps) {
  const [mode, setMode] = useState<InputMode>("file");
  const [status, setStatus] = useState<Status>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [pastedTitle, setPastedTitle] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [importUrl, setImportUrl] = useState("");
  const [sources, setSources] = useState<VaultSource[]>([]);
  const [isLoadingSources, setIsLoadingSources] = useState(false);
  const [deletingSourceId, setDeletingSourceId] = useState<string | null>(null);
  const [isRefreshingProfile, setIsRefreshingProfile] = useState(false);

  const voiceId = selectedVoice?.id ?? null;

  const loadSources = useCallback(async () => {
    if (!voiceId) return setSources([]);
    setIsLoadingSources(true);
    try {
      setSources(
        await apiJson<VaultSource[]>(`/vault/sources?voice_id=${voiceId}`, await getAccessToken())
      );
    } catch (err) {
      setStatus({ kind: "error", text: err instanceof Error ? err.message : "Failed to load sources." });
    } finally {
      setIsLoadingSources(false);
    }
  }, [voiceId, getAccessToken]);

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  /** Runs an ingest request, then refreshes sources and (after the background profile job) voices. */
  const ingest = async (request: (token: string | null) => Promise<VaultUploadResponse>) => {
    setIsBusy(true);
    setStatus({ kind: "info", text: "Analyzing your writing and saving it to the Vault..." });
    try {
      const data = await request(await getAccessToken());
      if (data.status !== "Success") throw new Error(data.message);
      setStatus({ kind: "success", text: data.message });
      await Promise.all([loadSources(), onVoicesChanged()]);
      // The style profile is regenerated in a background task on the server
      setTimeout(() => onVoicesChanged(), 6000);
      return true;
    } catch (err) {
      setStatus({ kind: "error", text: err instanceof Error ? err.message : "Upload failed." });
      return false;
    } finally {
      setIsBusy(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setStatus({ kind: "error", text: "File is too large. The maximum size is 10MB." });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    if (voiceId) formData.append("voice_id", voiceId);
    await ingest((token) =>
      apiJson<VaultUploadResponse>("/vault/upload", token, { method: "POST", body: formData })
    );
  };

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await ingest((token) =>
      apiJson<VaultUploadResponse>("/vault/text", token, {
        method: "POST",
        body: JSON.stringify({
          title: pastedTitle.trim() || "Pasted text",
          text: pastedText,
          voice_id: voiceId,
        }),
      })
    );
    if (ok) {
      setPastedTitle("");
      setPastedText("");
    }
  };

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await ingest((token) =>
      apiJson<VaultUploadResponse>("/vault/url", token, {
        method: "POST",
        body: JSON.stringify({ url: importUrl, voice_id: voiceId }),
      })
    );
    if (ok) setImportUrl("");
  };

  const handleDeleteSource = async (source: VaultSource) => {
    if (!confirm(`Remove "${source.name}" from this voice?`)) return;
    setDeletingSourceId(source.id);
    try {
      await apiJson(`/vault/sources/${source.id}`, await getAccessToken(), { method: "DELETE" });
      setSources((prev) => prev.filter((s) => s.id !== source.id));
      await onVoicesChanged();
      setTimeout(() => onVoicesChanged(), 6000);
    } catch (err) {
      setStatus({ kind: "error", text: err instanceof Error ? err.message : "Delete failed." });
    } finally {
      setDeletingSourceId(null);
    }
  };

  const handleCreateVoice = async () => {
    const name = prompt("Name your new voice (e.g. \"Company blog\"):")?.trim();
    if (!name) return;
    try {
      const voice = await apiJson<Voice>("/voices", await getAccessToken(), {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      await onVoicesChanged();
      onSelectVoice(voice.id);
    } catch (err) {
      setStatus({ kind: "error", text: err instanceof Error ? err.message : "Could not create voice." });
    }
  };

  const handleRenameVoice = async () => {
    if (!selectedVoice) return;
    const name = prompt("Rename voice:", selectedVoice.name)?.trim();
    if (!name || name === selectedVoice.name) return;
    try {
      await apiJson(`/voices/${selectedVoice.id}`, await getAccessToken(), {
        method: "PATCH",
        body: JSON.stringify({ name }),
      });
      await onVoicesChanged();
    } catch (err) {
      setStatus({ kind: "error", text: err instanceof Error ? err.message : "Rename failed." });
    }
  };

  const handleDeleteVoice = async () => {
    if (!selectedVoice) return;
    if (
      !confirm(
        `Delete the voice "${selectedVoice.name}" and all ${selectedVoice.source_count} of its writing samples? This cannot be undone.`
      )
    )
      return;
    try {
      await apiJson(`/voices/${selectedVoice.id}`, await getAccessToken(), { method: "DELETE" });
      await onVoicesChanged();
    } catch (err) {
      setStatus({ kind: "error", text: err instanceof Error ? err.message : "Delete failed." });
    }
  };

  const handleRefreshProfile = async () => {
    if (!selectedVoice) return;
    setIsRefreshingProfile(true);
    try {
      await apiJson(`/voices/${selectedVoice.id}/profile`, await getAccessToken(), { method: "POST" });
      await onVoicesChanged();
    } catch (err) {
      setStatus({ kind: "error", text: err instanceof Error ? err.message : "Profile refresh failed." });
    } finally {
      setIsRefreshingProfile(false);
    }
  };

  const inputClass =
    "w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all outline-none text-zinc-900 placeholder:text-zinc-400 text-sm";

  return (
    <section className="bg-white p-8 rounded-3xl shadow-[0_2px_10px_rgb(0,0,0,0.02)] border border-zinc-100">
      <div className="flex items-center gap-3 mb-2">
        <UploadCloud className="w-6 h-6 text-indigo-600" />
        <h2 className="text-xl font-semibold tracking-tight text-zinc-900">Train Brand Voice</h2>
      </div>
      <p className="text-zinc-500 text-sm mb-6">
        Add samples of your past writing. Our AI agents will analyze them and mimic your exact
        style, vocabulary, and tone.
      </p>

      {/* Voice selector */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <label htmlFor="voice-select" className="text-sm font-medium text-zinc-700 mr-1">
          Voice
        </label>
        <select
          id="voice-select"
          value={selectedVoice?.id ?? ""}
          onChange={(e) => onSelectVoice(e.target.value)}
          className="p-2.5 pr-8 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-medium text-zinc-900 outline-none focus:ring-2 focus:ring-indigo-600"
        >
          {voices.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name} ({v.source_count} sample{v.source_count === 1 ? "" : "s"})
            </option>
          ))}
        </select>
        <button onClick={handleCreateVoice} className="p-2.5 rounded-xl text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900" aria-label="New voice" title="New voice">
          <Plus className="w-4 h-4" />
        </button>
        <button onClick={handleRenameVoice} disabled={!selectedVoice} className="p-2.5 rounded-xl text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-40" aria-label="Rename voice" title="Rename voice">
          <Pencil className="w-4 h-4" />
        </button>
        <button onClick={handleDeleteVoice} disabled={!selectedVoice} className="p-2.5 rounded-xl text-zinc-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-40" aria-label="Delete voice" title="Delete voice">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Input mode tabs */}
      <div className="flex gap-1 p-1 bg-zinc-100 rounded-xl mb-4 w-fit">
        {MODES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              mode === id ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-900"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {mode === "file" && (
        <div className="relative border-2 border-dashed border-zinc-200 rounded-2xl p-8 hover:bg-zinc-50 transition-colors group cursor-pointer">
          <input
            type="file"
            accept=".pdf,.docx,.txt,.md"
            onChange={handleFileUpload}
            disabled={isBusy}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          />
          <div className="flex flex-col items-center justify-center text-center">
            <div className="bg-indigo-50 p-4 rounded-full mb-4 group-hover:scale-110 transition-transform">
              <UploadCloud className="w-8 h-8 text-indigo-600" />
            </div>
            <p className="font-semibold text-zinc-900 mb-1">Click to upload or drag and drop</p>
            <p className="text-xs text-zinc-500">PDF, DOCX, TXT or MD (Max 10MB)</p>
          </div>
        </div>
      )}

      {mode === "text" && (
        <form onSubmit={handleTextSubmit} className="grid gap-3">
          <input
            type="text"
            placeholder="Title (optional)"
            value={pastedTitle}
            onChange={(e) => setPastedTitle(e.target.value)}
            maxLength={200}
            className={inputClass}
          />
          <textarea
            placeholder="Paste an article, newsletter or essay you wrote (at least 50 characters)..."
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            rows={6}
            minLength={50}
            required
            className={`${inputClass} resize-y`}
          />
          <button type="submit" disabled={isBusy || pastedText.trim().length < 50} className="justify-self-end bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:bg-indigo-300 transition-colors">
            Add to Vault
          </button>
        </form>
      )}

      {mode === "url" && (
        <form onSubmit={handleUrlSubmit} className="flex flex-col sm:flex-row gap-3">
          <input
            type="url"
            placeholder="https://yourblog.com/a-post-you-wrote"
            value={importUrl}
            onChange={(e) => setImportUrl(e.target.value)}
            required
            className={inputClass}
          />
          <button type="submit" disabled={isBusy} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:bg-indigo-300 transition-colors whitespace-nowrap">
            Import
          </button>
        </form>
      )}

      {status && (
        <div
          className={`mt-4 flex items-center gap-2 p-4 rounded-xl text-sm font-medium border ${
            status.kind === "success"
              ? "bg-emerald-50 text-emerald-700 border-emerald-100"
              : status.kind === "error"
                ? "bg-red-50 text-red-700 border-red-100"
                : "bg-blue-50 text-blue-700 border-blue-100"
          }`}
        >
          {status.kind === "success" ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : status.kind === "error" ? (
            <AlertCircle className="w-5 h-5 shrink-0" />
          ) : (
            <Loader2 className="w-5 h-5 animate-spin shrink-0" />
          )}
          <p>{status.text}</p>
        </div>
      )}

      {/* Style profile */}
      {selectedVoice && (
        <div className="mt-6 p-5 bg-indigo-50/50 border border-indigo-100 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <p className="flex items-center gap-2 text-sm font-semibold text-indigo-900">
              <Sparkles className="w-4 h-4" />
              Style profile
            </p>
            <button
              onClick={handleRefreshProfile}
              disabled={isRefreshingProfile || selectedVoice.source_count === 0}
              className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingProfile ? "animate-spin" : ""}`} />
              Re-analyze
            </button>
          </div>
          <p className="text-sm text-indigo-900/80 whitespace-pre-line">
            {selectedVoice.style_profile ||
              (selectedVoice.source_count === 0
                ? "Add a writing sample to generate a style profile for this voice."
                : "Style profile is being generated...")}
          </p>
        </div>
      )}

      {/* Sources list */}
      <div className="mt-6">
        <p className="text-sm font-semibold text-zinc-700 mb-3">
          Writing samples{selectedVoice ? ` · ${selectedVoice.chunk_count} chunks` : ""}
        </p>
        {isLoadingSources ? (
          <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
        ) : sources.length === 0 ? (
          <p className="text-sm text-zinc-400">No samples in this voice yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 border border-zinc-100 rounded-2xl">
            {sources.map((source) => {
              const Icon = sourceIcon(source.source_type);
              return (
                <li key={source.id} className="flex items-center gap-3 px-4 py-3">
                  <Icon className="w-4 h-4 text-zinc-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-900 truncate">{source.name}</p>
                    <p className="text-xs text-zinc-400">
                      {source.source_type.toUpperCase()} · {source.chunk_count} chunks ·{" "}
                      {new Date(source.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteSource(source)}
                    disabled={deletingSourceId === source.id}
                    aria-label={`Remove ${source.name}`}
                    className="p-2 rounded-xl text-zinc-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    {deletingSourceId === source.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
