import React, { useState, useEffect, useCallback } from "react";
import { Sparkles, X, Loader2, RefreshCw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Dataset } from "@/lib/database";
import { detectSector, extractSampleValues, buildSectorContext } from "@/lib/sectorDetection";

interface AutoSummaryProps {
  dataset: Dataset | null;
  filtered?: Record<string, any>[];
}

function buildContext(dataset: Dataset): string {
  const lines: string[] = [];

  // Detect sector and prepend context
  const colNames = dataset.columns?.map(c => c.name) ?? [];
  const sampleVals = extractSampleValues(dataset.rows, colNames, 50);
  const sectorResult = detectSector(colNames, sampleVals);
  if (sectorResult) {
    lines.push("=== SETOR DETECTADO ===");
    lines.push(buildSectorContext(sectorResult));
    lines.push("Use terminologia e KPIs específicos deste setor na análise.");
    lines.push("========================\n");
  }

  lines.push(`Dataset: ${dataset.name}`);
  lines.push(`Total de linhas: ${dataset.totalRows}`);

  if (dataset.summary) {
    const s = dataset.summary;
    if (s.dateRange) lines.push(`Período: ${s.dateRange.from} a ${s.dateRange.to}`);
    if (s.categoryCounts) {
      for (const [col, counts] of Object.entries(s.categoryCounts)) {
        const top = Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, 5);
        lines.push(`${col}: ${top.map(([k, v]) => `${k}(${v})`).join(", ")}`);
      }
    }
    if (s.numericStats) {
      for (const [col, stats] of Object.entries(s.numericStats)) {
        lines.push(`${col}: min=${stats.min}, max=${stats.max}, média=${stats.avg.toFixed(1)}, soma=${stats.sum}`);
      }
    }
  }

  if (dataset.columns) {
    lines.push(`Colunas: ${dataset.columns.map(c => c.name).join(", ")}`);
  }

  const sample = dataset.rows.slice(0, 15);
  if (sample.length > 0) {
    lines.push(`\nAmostra (${Math.min(15, dataset.rows.length)} linhas):`);
    lines.push(JSON.stringify(sample, null, 2));
  }

  return lines.join("\n");
}

export function AutoSummary({ dataset, filtered }: AutoSummaryProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [lastDatasetId, setLastDatasetId] = useState<string | null>(null);

  const generateSummary = useCallback(async (ds: Dataset) => {
    setLoading(true);
    setSummary(null);
    setDismissed(false);

    try {
      const dataContext = buildContext(ds);
      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: {
          messages: [
            {
              role: "user",
              content:
                "Gere um resumo executivo conciso dos dados importados. Inclua: visão geral, principais métricas, destaques e observações importantes. Use formatação markdown com bullet points. Máximo 200 palavras.",
            },
          ],
          dataContext,
        },
      });

      if (error) throw error;
      setSummary(data?.response || "Sem resumo disponível.");
    } catch (err: any) {
      console.error("Auto-summary error:", err);
      setSummary("Não foi possível gerar o resumo automático.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (dataset && dataset.id !== lastDatasetId) {
      setLastDatasetId(dataset.id);
      generateSummary(dataset);
    }
  }, [dataset, lastDatasetId, generateSummary]);

  if (!dataset || dismissed) return null;
  if (!loading && !summary) return null;

  return (
    <div className="mx-4 mt-3 mb-1 rounded-xl border border-primary/20 bg-primary/5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-primary/10">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
          <Sparkles className="w-4 h-4" />
          Resumo Automático IA
        </div>
        <div className="flex gap-1">
          {!loading && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => generateSummary(dataset)}
              title="Regenerar resumo"
            >
              <RefreshCw className="w-3 h-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setDismissed(true)}
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-3 max-h-48 overflow-auto">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Analisando dados com IA...</span>
          </div>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none text-sm [&>p]:my-1 [&>ul]:my-1 [&>ol]:my-1">
            <ReactMarkdown>{summary || ""}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
