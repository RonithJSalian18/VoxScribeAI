"use client";

import { useCallback, useEffect, useState } from "react";
import { apiJson } from "@/lib/api";
import { Voice } from "@/types";

/**
 * Loads the user's Brand Voices and tracks which one is selected.
 * `getAccessToken` supplies the Supabase JWT for backend calls.
 */
export function useVoices(getAccessToken: () => Promise<string | null>, enabled: boolean) {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiJson<Voice[]>("/voices", await getAccessToken());
      setVoices(data);
      setSelectedVoiceId((current) =>
        current && data.some((v) => v.id === current) ? current : data[0]?.id ?? null
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load voices.");
    } finally {
      setIsLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (enabled) refresh();
  }, [enabled, refresh]);

  const selectedVoice = voices.find((v) => v.id === selectedVoiceId) ?? null;

  return { voices, selectedVoice, selectedVoiceId, setSelectedVoiceId, refresh, isLoading, error };
}
