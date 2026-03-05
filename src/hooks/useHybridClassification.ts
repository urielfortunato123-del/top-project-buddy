/**
 * Hybrid Service Profile Detection
 * Runs local heuristic first, then calls AI if confidence < 0.65
 */

import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Dataset } from "@/lib/database";
import { saveDataset } from "@/lib/database";
import {
  detectServiceProfile,
  buildClassificationPrompt,
  type ServiceProfile,
  type ServiceType,
} from "@/lib/serviceProfile";

const AI_CONFIDENCE_THRESHOLD = 0.65;

/**
 * Run local detection and optionally refine with AI.
 * Returns the profile and an updated dataset (if AI was called).
 */
export async function classifyDatasetHybrid(
  dataset: Dataset,
  onUpdate?: (updated: Dataset) => void
): Promise<ServiceProfile> {
  // 1) Local heuristic
  const localProfile = detectServiceProfile({
    name: dataset.name,
    columns: dataset.columns.map((c) => ({
      name: c.name,
      uniqueValues: c.uniqueValues,
    })),
    rows: dataset.rows,
  });

  // Save local profile immediately
  const withLocal = {
    ...dataset,
    serviceProfile: localProfile,
    updatedAt: new Date().toISOString(),
  };
  await saveDataset(withLocal);
  onUpdate?.(withLocal);

  // 2) If confidence is high enough, we're done
  if (localProfile.confidence >= AI_CONFIDENCE_THRESHOLD) {
    return localProfile;
  }

  // 3) Call AI for refinement (non-blocking for UI)
  try {
    const topValuesByColumn: Record<string, string[]> = {};
    for (const col of dataset.columns) {
      topValuesByColumn[col.name] = (col.uniqueValues ?? []).slice(0, 15);
    }

    const prompt = buildClassificationPrompt(
      dataset.name,
      dataset.columns.map((c) => c.name),
      topValuesByColumn,
      dataset.rows.slice(0, 20)
    );

    const { data, error } = await supabase.functions.invoke("ai-chat", {
      body: {
        messages: [{ role: "user", content: prompt }],
        dataContext: "",
      },
    });

    if (error) throw error;

    const raw = data?.response || "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in AI response");

    const parsed = JSON.parse(jsonMatch[0]);

    // Merge AI result into profile
    const aiProfile: ServiceProfile = {
      type: (parsed.type as ServiceType) || localProfile.type,
      confidence: Math.max(parsed.confidence ?? 0.7, localProfile.confidence),
      domain: parsed.domain || localProfile.domain,
      service: parsed.service || localProfile.service,
      signals: {
        matchedKeywords: [
          ...localProfile.signals.matchedKeywords,
          ...(parsed.reason || []),
        ],
        matchedColumns: localProfile.signals.matchedColumns,
        notes: [
          ...localProfile.signals.notes,
          "Refinado por IA",
          ...(parsed.reason || []),
        ],
      },
      semanticMap: {
        ...localProfile.semanticMap,
        ...(parsed.semanticMap
          ? Object.fromEntries(
              Object.entries(parsed.semanticMap).filter(([, v]) => v && v !== "null")
            )
          : {}),
      },
      labels: {
        ...localProfile.labels,
        ...(parsed.labels || {}),
      },
      kpiProfile: parsed.kpiProfile || localProfile.kpiProfile,
      matrixDefaults: localProfile.matrixDefaults,
      statusDictionary: localProfile.statusDictionary,
    };

    // Save AI-refined profile
    const withAI = {
      ...dataset,
      serviceProfile: aiProfile,
      updatedAt: new Date().toISOString(),
    };
    await saveDataset(withAI);
    onUpdate?.(withAI);

    return aiProfile;
  } catch (err) {
    console.warn("AI classification failed, using local profile:", err);
    return localProfile;
  }
}

/**
 * React hook for hybrid classification.
 */
export function useHybridClassification() {
  const classify = useCallback(
    async (
      dataset: Dataset,
      onUpdate?: (updated: Dataset) => void
    ) => {
      return classifyDatasetHybrid(dataset, onUpdate);
    },
    []
  );

  return { classify };
}
