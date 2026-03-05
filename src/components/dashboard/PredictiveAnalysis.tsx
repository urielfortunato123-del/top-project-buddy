import React, { useState, useCallback, useEffect } from "react";
import { Sparkles, Loader2, RefreshCw, TrendingUp, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, Area, AreaChart, ReferenceLine,
} from "recharts";
import type { Dataset } from "@/lib/database";
import { detectSector, extractSampleValues, buildSectorContext } from "@/lib/sectorDetection";

interface PredictiveAnalysisProps {
  dataset: Dataset | null;
  filtered?: Record<string, any>[];
}

interface PredictionData {
  trendData: { label: string; real: number | null; predicted: number | null }[];
  insights: string[];
  metric: string;
  trend: "up" | "down" | "stable";
  confidence: string;
}

function buildAnalysisContext(dataset: Dataset): string {
  const lines: string[] = [];

  // Detect sector
  const colNames = dataset.columns?.map(c => c.name) ?? [];
  const sampleVals = extractSampleValues(dataset.rows, colNames, 50);
  const sectorResult = detectSector(colNames, sampleVals);
  if (sectorResult) {
    lines.push("=== SETOR DETECTADO ===");
    lines.push(buildSectorContext(sectorResult));
    lines.push("========================\n");
  }

  lines.push(`Dataset: ${dataset.name}`);
  lines.push(`Total de linhas: ${dataset.totalRows}`);

  if (dataset.summary) {
    const s = dataset.summary;
    if (s.dateRange) lines.push(`Período: ${s.dateRange.from} a ${s.dateRange.to}`);
    if (s.categoryCounts) {
      for (const [col, counts] of Object.entries(s.categoryCounts)) {
        const top = Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, 10);
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
    lines.push(`Colunas: ${dataset.columns.map((c) => c.name).join(", ")}`);
  }

  const sample = dataset.rows.slice(0, 30);
  if (sample.length > 0) {
    lines.push(`\nAmostra (${Math.min(30, dataset.rows.length)} linhas):`);
    lines.push(JSON.stringify(sample, null, 2));
  }

  return lines.join("\n");
}

const PREDICTION_PROMPT = `Analise os dados e gere uma análise preditiva. Retorne EXCLUSIVAMENTE um JSON válido (sem markdown, sem texto extra) no seguinte formato:
{
  "trendData": [
    {"label": "Jan", "real": 100, "predicted": null},
    {"label": "Fev", "real": 110, "predicted": null},
    {"label": "Mar (prev)", "real": null, "predicted": 120}
  ],
  "insights": ["Insight 1", "Insight 2", "Insight 3"],
  "metric": "Nome da métrica principal analisada",
  "trend": "up",
  "confidence": "75%"
}

Regras:
- trendData deve ter 6-12 pontos, sendo os últimos 2-3 previsões (predicted != null, real = null)
- Os pontos reais devem ter predicted = null
- insights deve ter 3-5 frases curtas sobre tendências e previsões
- trend: "up", "down" ou "stable"
- Baseie-se nos dados reais fornecidos para criar previsões realistas
- Use labels curtos (meses, semanas, ou períodos relevantes)`;

export function PredictiveAnalysis({ dataset, filtered }: PredictiveAnalysisProps) {
  const [prediction, setPrediction] = useState<PredictionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastDatasetId, setLastDatasetId] = useState<string | null>(null);

  const generate = useCallback(async (ds: Dataset) => {
    setLoading(true);
    setError(null);
    setPrediction(null);

    try {
      const dataContext = buildAnalysisContext(ds);
      const { data, error: fnError } = await supabase.functions.invoke("ai-chat", {
        body: {
          messages: [{ role: "user", content: PREDICTION_PROMPT }],
          dataContext,
        },
      });

      if (fnError) throw fnError;

      const raw = data?.response || "";
      // Extract JSON from response (handle potential markdown wrapping)
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Resposta inválida da IA");

      const parsed = JSON.parse(jsonMatch[0]) as PredictionData;
      setPrediction(parsed);
    } catch (err: any) {
      console.error("Predictive analysis error:", err);
      setError("Não foi possível gerar a análise preditiva.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (dataset && dataset.id !== lastDatasetId) {
      setLastDatasetId(dataset.id);
      generate(dataset);
    }
  }, [dataset, lastDatasetId, generate]);

  if (!dataset) return null;

  const trendColor =
    prediction?.trend === "up" ? "hsl(var(--chart-2))" :
    prediction?.trend === "down" ? "hsl(var(--destructive))" :
    "hsl(var(--chart-4))";

  const trendLabel =
    prediction?.trend === "up" ? "↑ Tendência de Alta" :
    prediction?.trend === "down" ? "↓ Tendência de Queda" :
    "→ Estável";

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">Análise Preditiva IA</span>
          {prediction && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
              {trendLabel}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => dataset && generate(dataset)}
          disabled={loading}
          title="Regenerar análise"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Content */}
      <div className="p-4">
        {loading && (
          <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-sm">Gerando análise preditiva...</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive py-4">
            <AlertTriangle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        {prediction && !loading && (
          <div className="space-y-4">
            {/* Chart */}
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={prediction.trendData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="realGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="predGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={trendColor} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={trendColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="real"
                    stroke="hsl(var(--primary))"
                    fill="url(#realGradient)"
                    strokeWidth={2}
                    name="Real"
                    connectNulls={false}
                    dot={{ r: 3 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="predicted"
                    stroke={trendColor}
                    fill="url(#predGradient)"
                    strokeWidth={2}
                    strokeDasharray="6 3"
                    name="Previsão"
                    connectNulls={false}
                    dot={{ r: 3, strokeDasharray: "0" }}
                  />
                  <Legend />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Metrics row */}
            <div className="flex gap-3">
              <div className="flex-1 rounded-lg bg-muted/50 px-3 py-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Métrica</p>
                <p className="text-sm font-semibold truncate">{prediction.metric}</p>
              </div>
              <div className="rounded-lg bg-muted/50 px-3 py-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Confiança</p>
                <p className="text-sm font-semibold">{prediction.confidence}</p>
              </div>
            </div>

            {/* Insights */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Insights
              </p>
              {prediction.insights.map((insight, i) => (
                <p key={i} className="text-xs text-foreground/80 pl-4 border-l-2 border-primary/30 py-0.5">
                  {insight}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
