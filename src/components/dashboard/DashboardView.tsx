import React, { useMemo, useState, useRef } from "react";
import { 
  FileDown, Loader2, BarChart3, PieChart, TrendingUp, 
  Hash, Calendar, Tag, Users, Database, Layers, FileCode
} from "lucide-react";
import type { Dataset, ColumnMetadata } from "@/lib/database";
import { KPICard } from "./KPICard";
import { KPIDetailModal } from "./KPIDetailModal";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { exportHTML } from "@/lib/htmlExport";
import {
  ChartCard,
  GenericLineChart,
  GenericBarChart,
  GenericPieChart,
  GenericHorizontalBarChart,
  ProgressRing,
} from "./Charts";

interface DashboardViewProps {
  dataset: Dataset;
  personFilter: string;
  statusFilter: string;
  teamFilter: string;
  dateRange: { from?: Date; to?: Date };
}

export function DashboardView({ dataset, personFilter, statusFilter, teamFilter, dateRange }: DashboardViewProps) {
  const [exporting, setExporting] = useState(false);
  const [selectedKPI, setSelectedKPI] = useState<any>(null);
  const [kpiModalOpen, setKpiModalOpen] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);

  // Safe accessors
  const safeRows = dataset?.rows ?? [];
  const safeColumns = dataset?.columns ?? [];
  const safeCategoryColumns = dataset?.detectedCategoryColumns ?? [];
  const safeNumericColumns = dataset?.detectedNumericColumns ?? [];
  const safeTextColumns = dataset?.detectedTextColumns ?? [];
  const safeSummary = dataset?.summary ?? { totalRecords: 0, categoryCounts: {}, numericStats: {}, dateRange: undefined };

  // Filtra dados baseado nos filtros ativos
  const filtered = useMemo(() => {
    if (!dataset) return [];
    let data = [...safeRows];
    
    const dateCol = dataset.detectedDateColumn;
    
    if (dateCol && dateRange.from) {
      const fromStr = dateRange.from.toISOString().slice(0, 10);
      data = data.filter((r) => r[dateCol] >= fromStr);
    }
    if (dateCol && dateRange.to) {
      const toStr = dateRange.to.toISOString().slice(0, 10);
      data = data.filter((r) => r[dateCol] <= toStr);
    }
    
    // Aplica filtros de categoria genéricos
    if (teamFilter !== "ALL" && safeCategoryColumns[0]) {
      data = data.filter((r) => r[safeCategoryColumns[0]] === teamFilter);
    }
    if (personFilter !== "ALL" && safeCategoryColumns[1]) {
      data = data.filter((r) => r[safeCategoryColumns[1]] === personFilter);
    }
    if (statusFilter !== "ALL" && safeCategoryColumns[2]) {
      data = data.filter((r) => r[safeCategoryColumns[2]] === statusFilter);
    }
    
    return data;
  }, [dataset, safeRows, safeCategoryColumns, personFilter, statusFilter, teamFilter, dateRange]);

  // Gera KPIs dinâmicos com dados expandidos
  const kpis = useMemo(() => {
    if (!dataset) return [];
    
    const result: Array<{
      title: string;
      value: string;
      subtitle: string;
      icon: React.ReactNode;
      variant: "default" | "success" | "warning" | "danger" | "info" | "purple";
      type: "count" | "numeric" | "category" | "date";
      columnName?: string;
      stats?: { min?: number; max?: number; avg?: number; sum?: number };
      distribution?: Array<{ name: string; value: number }>;
      total?: number;
      percentage?: number;
    }> = [];
    
    // KPI: Total de registros
    const filteredCount = filtered?.length ?? 0;
    const totalCount = dataset.totalRows ?? 0;
    result.push({
      title: "Total Registros",
      value: filteredCount.toLocaleString("pt-BR"),
      subtitle: `de ${totalCount} no arquivo`,
      icon: <Database className="w-4 h-4 md:w-5 md:h-5 text-primary" />,
      variant: "default",
      type: "count",
      total: totalCount,
      percentage: totalCount > 0 ? (filteredCount / totalCount) * 100 : 100,
    });
    
    // KPIs para cada coluna numérica (soma e média)
    for (const colName of safeNumericColumns.slice(0, 2)) {
      const stats = safeSummary.numericStats?.[colName];
      if (stats) {
        result.push({
          title: `Soma ${colName}`,
          value: stats.sum.toLocaleString("pt-BR", { maximumFractionDigits: 2 }),
          subtitle: `Média: ${stats.avg.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`,
          icon: <Hash className="w-4 h-4 md:w-5 md:h-5 text-accent" />,
          variant: "info",
          type: "numeric",
          columnName: colName,
          stats: {
            min: stats.min,
            max: stats.max,
            avg: stats.avg,
            sum: stats.sum,
          },
        });
      }
    }
    
    // KPIs para colunas de categoria (contagem de valores únicos)
    for (const colName of safeCategoryColumns.slice(0, 3)) {
      const counts = safeSummary.categoryCounts?.[colName];
      if (counts) {
        const entries = Object.entries(counts) as [string, number][];
        const sortedEntries = [...entries].sort((a, b) => b[1] - a[1]);
        const uniqueCount = entries.length;
        const topValue = sortedEntries[0];
        
        result.push({
          title: colName,
          value: uniqueCount.toLocaleString("pt-BR"),
          subtitle: topValue ? `Top: ${topValue[0]} (${topValue[1]})` : "valores únicos",
          icon: <Tag className="w-4 h-4 md:w-5 md:h-5 text-secondary" />,
          variant: "warning",
          type: "category",
          columnName: colName,
          distribution: sortedEntries.map(([name, value]) => ({ name, value })),
        });
      }
    }
    
    // KPI: Data range se existir
    if (safeSummary.dateRange) {
      result.push({
        title: "Período",
        value: `${safeSummary.dateRange.from?.slice(5) ?? ''} a ${safeSummary.dateRange.to?.slice(5) ?? ''}`,
        subtitle: `Coluna: ${dataset.detectedDateColumn ?? ''}`,
        icon: <Calendar className="w-4 h-4 md:w-5 md:h-5 text-violet-500" />,
        variant: "purple",
        type: "date",
        columnName: dataset.detectedDateColumn,
      });
    }
    
    return result.slice(0, 6); // Máximo 6 KPIs
  }, [dataset, filtered, safeNumericColumns, safeCategoryColumns, safeSummary]);

  const handleKPIClick = (kpi: typeof kpis[0]) => {
    setSelectedKPI(kpi);
    setKpiModalOpen(true);
  };

  // Gera dados para gráfico de linha (se tiver coluna de data)
  const lineChartData = useMemo(() => {
    if (!dataset) return null;
    const dateCol = dataset.detectedDateColumn;
    if (!dateCol) return null;
    
    const numCol = safeNumericColumns[0];
    const catCol = safeCategoryColumns[0];
    
    const map = new Map<string, { date: string; count: number; sum: number }>();
    
    for (const r of filtered) {
      const date = r[dateCol];
      if (!date) continue;
      
      const cur = map.get(date) || { date, count: 0, sum: 0 };
      cur.count += 1;
      if (numCol) cur.sum += parseFloat(r[numCol]) || 0;
      map.set(date, cur);
    }
    
    return Array.from(map.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(item => ({
        date: item.date,
        value1: item.count,
        value2: numCol ? item.sum : undefined,
        label1: "Registros",
        label2: numCol || undefined,
      }));
  }, [dataset, filtered, safeNumericColumns, safeCategoryColumns]);

  // Gera dados para gráfico de pizza (primeira coluna de categoria)
  const pieChartData = useMemo(() => {
    const catCol = safeCategoryColumns[0];
    if (!catCol) return null;
    
    const counts = new Map<string, number>();
    for (const r of filtered) {
      const v = String(r[catCol] || "(vazio)").trim();
      counts.set(v, (counts.get(v) || 0) + 1);
    }
    
    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filtered, safeCategoryColumns]);

  // Gera dados para gráfico de barras (segunda coluna de categoria)
  const barChartData = useMemo(() => {
    const catCol = safeCategoryColumns[1] || safeCategoryColumns[0];
    if (!catCol) return null;
    
    const numCol = safeNumericColumns[0];
    
    const map = new Map<string, { category: string; count: number; sum: number }>();
    
    for (const r of filtered) {
      const cat = String(r[catCol] || "(vazio)").trim();
      const cur = map.get(cat) || { category: cat, count: 0, sum: 0 };
      cur.count += 1;
      if (numCol) cur.sum += parseFloat(r[numCol]) || 0;
      map.set(cat, cur);
    }
    
    return Array.from(map.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [filtered, safeCategoryColumns, safeNumericColumns]);

  // Gera dados para gráfico horizontal (terceira coluna de categoria ou texto)
  const horizontalBarData = useMemo(() => {
    const catCol = safeCategoryColumns[2] || 
                   safeTextColumns[0] || 
                   safeCategoryColumns[0];
    if (!catCol) return null;
    
    const counts = new Map<string, number>();
    for (const r of filtered) {
      const v = String(r[catCol] || "(vazio)").trim();
      counts.set(v, (counts.get(v) || 0) + 1);
    }
    
    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filtered, safeCategoryColumns, safeTextColumns]);

  // Progress rings para categorias principais
  const progressRings = useMemo(() => {
    const catCol = safeCategoryColumns[0];
    if (!catCol) return [];
    
    const counts = safeSummary.categoryCounts?.[catCol];
    if (!counts) return [];
    
    const entries = Object.entries(counts) as [string, number][];
    const total = entries.reduce((a, b) => a + b[1], 0);
    
    return entries
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([label, count]) => ({
        label,
        value: total > 0 ? Math.round((count / total) * 100) : 0,
      }));
  }, [safeCategoryColumns, safeSummary]);

  const handleExport = async () => {
    setExporting(true);
    toast({ title: "Exportando...", description: "Preparando dados para download" });
    
    try {
      // Exporta como JSON
      const exportData = {
        dataset: dataset?.name ?? 'dataset',
        exportedAt: new Date().toISOString(),
        summary: dataset?.summary,
        data: filtered,
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${dataset?.name ?? 'dataset'}-export.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast({ title: "Exportado com sucesso!" });
    } catch (error) {
      console.error("Error exporting:", error);
      toast({ title: "Erro ao exportar", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const handleExportHTML = () => {
    if (!dataset) return;
    toast({ title: "Exportando HTML...", description: "Gerando dashboard interativo" });
    try {
      exportHTML(dataset, {
        team: teamFilter,
        person: personFilter,
        status: statusFilter,
        dateFrom: dateRange.from,
        dateTo: dateRange.to,
      });
      toast({ title: "HTML exportado com sucesso!" });
    } catch (error) {
      console.error("Error exporting HTML:", error);
      toast({ title: "Erro ao exportar HTML", variant: "destructive" });
    }
  };

  if (filtered.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <Database className="w-16 h-16 mx-auto mb-6 text-muted-foreground/30" />
          <p className="text-xl font-semibold">Nenhum dado para exibir</p>
          <p className="text-sm mt-2">Importe um arquivo Excel/CSV ou ajuste os filtros</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-4 px-4 py-3 border-b bg-card/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-8 rounded-full bg-primary" />
            <div>
              <h1 className="font-black text-lg text-card-foreground tracking-tight">Dashboard</h1>
              <p className="text-xs text-muted-foreground">{dataset?.name ?? 'Dataset'}</p>
            </div>
          </div>
          
          {/* Quick stats badges */}
          <div className="hidden md:flex items-center gap-2">
            <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full">
              {safeColumns.length} colunas
            </span>
            <span className="px-3 py-1 bg-accent/10 text-accent text-xs font-bold rounded-full">
              {filtered.length} registros
            </span>
            {(safeCategoryColumns.length ?? 0) > 0 && (
              <span className="px-3 py-1 bg-secondary/10 text-secondary text-xs font-bold rounded-full">
                {safeCategoryColumns.length} categorias
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportHTML}
            className="gap-2 font-semibold"
          >
            <FileCode className="w-4 h-4" />
            <span className="hidden sm:inline">HTML</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={exporting}
            className="gap-2 font-semibold"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            <span className="hidden sm:inline">JSON</span>
          </Button>
        </div>
      </div>

      {/* Dashboard Content */}
      <div ref={dashboardRef} className="p-4 md:p-6 space-y-6 overflow-auto flex-1 bg-gradient-to-br from-background via-background to-muted/30">
        
        {/* KPI Cards Dinâmicos */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
          {kpis.map((kpi, idx) => (
            <KPICard
              key={idx}
              title={kpi.title}
              value={kpi.value}
              subtitle={kpi.subtitle}
              icon={kpi.icon}
              variant={kpi.variant}
              size="sm"
              onClick={() => handleKPIClick(kpi)}
            />
          ))}
        </div>

        {/* KPI Detail Modal */}
        <KPIDetailModal
          open={kpiModalOpen}
          onOpenChange={setKpiModalOpen}
          kpi={selectedKPI}
        />

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {lineChartData && (lineChartData.length ?? 0) > 1 && (
            <ChartCard 
              title={`Evolução por ${dataset?.detectedDateColumn ?? 'Data'}`}
              subtitle="Tendência ao longo do tempo"
              className="lg:col-span-2"
            >
              <GenericLineChart data={lineChartData} />
            </ChartCard>
          )}
          
          {pieChartData && (pieChartData.length ?? 0) > 0 && (
            <ChartCard 
              title={`Distribuição: ${safeCategoryColumns[0] ?? 'Categoria'}`}
              subtitle="Composição geral"
            >
              <GenericPieChart data={pieChartData} />
            </ChartCard>
          )}
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {barChartData && (barChartData.length ?? 0) > 0 && (
            <ChartCard 
              title={`Por ${safeCategoryColumns[1] || safeCategoryColumns[0] || "Categoria"}`}
              subtitle="Top 10 por quantidade"
            >
              <GenericBarChart data={barChartData} />
            </ChartCard>
          )}
          
          {horizontalBarData && (horizontalBarData.length ?? 0) > 0 && (
            <ChartCard 
              title={`Ranking: ${safeCategoryColumns[2] || safeTextColumns[0] || "Valores"}`}
              subtitle="Distribuição horizontal"
            >
              <GenericHorizontalBarChart data={horizontalBarData} />
            </ChartCard>
          )}

          {(progressRings?.length ?? 0) > 0 && (
            <ChartCard 
              title="Métricas Rápidas"
              subtitle={`Taxas por ${safeCategoryColumns[0] ?? 'Categoria'}`}
            >
              <div className="flex flex-wrap justify-around items-center gap-4 py-4">
                {progressRings.map((ring, idx) => (
                  <ProgressRing key={idx} value={ring.value} label={ring.label} size="md" />
                ))}
              </div>
            </ChartCard>
          )}
        </div>

        {/* Info sobre colunas detectadas */}
        <ChartCard 
          title="Estrutura Detectada"
          subtitle="Colunas identificadas automaticamente"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-2">
            {dataset?.detectedDateColumn && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-violet-500" />
                <span className="text-muted-foreground">Data:</span>
                <span className="font-semibold truncate">{dataset.detectedDateColumn}</span>
              </div>
            )}
            {safeNumericColumns.slice(0, 2).map((col, idx) => (
              <div key={col} className="flex items-center gap-2 text-sm">
                <Hash className="w-4 h-4 text-accent" />
                <span className="text-muted-foreground">Número:</span>
                <span className="font-semibold truncate">{col}</span>
              </div>
            ))}
            {safeCategoryColumns.slice(0, 3).map((col, idx) => (
              <div key={col} className="flex items-center gap-2 text-sm">
                <Tag className="w-4 h-4 text-secondary" />
                <span className="text-muted-foreground">Categoria:</span>
                <span className="font-semibold truncate">{col}</span>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
