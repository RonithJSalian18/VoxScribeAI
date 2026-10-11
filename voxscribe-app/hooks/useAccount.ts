"use client";

import { useCallback, useEffect, useState } from "react";
import { apiJson } from "@/lib/api";
import { ModelInfo, UsageSummary } from "@/types";

/** Loads the available LLM models and the user's usage/quota from the backend. */
export function useAccount(getAccessToken: () => Promise<string | null>, enabled: boolean) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [usage, setUsage] = useState<UsageSummary | null>(null);

  const refreshUsage = useCallback(async () => {
    try {
      setUsage(await apiJson<UsageSummary>("/usage", await getAccessToken()));
    } catch {
      // Usage is informational; ignore failures (e.g. backend offline)
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (!enabled) return;
    refreshUsage();
    apiJson<ModelInfo[]>("/models", null)
      .then(setModels)
      .catch(() => setModels([]));
  }, [enabled, refreshUsage]);

  return { models, usage, refreshUsage };
}
