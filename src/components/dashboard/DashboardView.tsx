import React, { useMemo, useState, useRef } from "react";
import { PredictiveAnalysis } from "./PredictiveAnalysis";
import { 
  FileDown, Loader2, BarChart3, PieChart, TrendingUp, 
  Hash, Calendar, Tag, Users, Database, Layers, FileCode,
  CheckCircle2, Clock, Coffee, Briefcase, AlertCircle
} from "lucide-react";
import type { Dataset, ColumnMetadata } from "@/lib/database";
import { detectServiceProfile, type ServiceProfile } from "@/lib/serviceProfile";
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

// Detecta se é uma planilha tipo RDA baseado nos valores de status
function detectRDAType(categoryCounts: Record<string, Record<string, number>>): {
  isRDA: boolean;
  statusColumn: string | null;
  personColumn: string | null;
  teamColumn: string | null;
} {
  let statusColumn: string | null = null;
  let personColumn: string | null = null;
  let teamColumn: string | null = null;
  
  const statusPatterns = /^(ENTREGUE?|FOLGA?|FALTA?|BANCO|ATESTADO?|FER[IÉ]AS?|VAZIO|-)$/i;
  
  for (const [colName, counts] of Object.entries(categoryCounts)) {
    const values = Object.keys(counts);
    const hasStatusValues = values.some(v => statusPatterns.test(v.trim()));
    
    if (hasStatusValues && !statusColumn) {
      statusColumn = colName;
    } else if (!statusColumn) {
      // Se não tem valores de status, pode ser pessoa ou equipe
      const uniqueCount = values.length;
      if (uniqueCount > 10 && !personColumn) {
        personColumn = colName; // Muitos valores = provavelmente pessoas
      } else if (uniqueCount <= 10 && uniqueCount > 1 && !teamColumn) {
        teamColumn = colName; // Poucos valores = provavelmente equipes
      }
    }
  }
  
  // Se não encontrou pessoa, usa a coluna com mais valores únicos
  if (!personColumn && teamColumn) {
    for (const [colName, counts] of Object.entries(categoryCounts)) {
      if (colName !== statusColumn && colName !== teamColumn) {
        personColumn = colName;
        break;
      }
    }
  }
  
  return {
    isRDA: statusColumn !== null,
    statusColumn,
    personColumn,
    teamColumn,
  };
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

  // Detecta tipo RDA
  const rdaInfo = useMemo(() => {
    return detectRDAType(safeSummary.categoryCounts || {});
  }, [safeSummary.categoryCounts]);

  // Use persisted profile or compute locally as fallback
  const serviceProfile = useMemo<ServiceProfile | null>(() => {
    if (!dataset) return null;
    if (dataset.serviceProfile) return dataset.serviceProfile;
    return detectServiceProfile({
      name: dataset.name,
      columns: safeColumns.map(c => ({ name: c.name, uniqueValues: c.uniqueValues })),
      rows: safeRows,
    });
  }, [dataset, safeColumns, safeRows]);

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

  // ── KPIs dinâmicos baseados no serviceProfile ──────────────────
  const profileKpis = useMemo(() => {
    if (!dataset) return { statusCounts: {} as Record<string, number>, uniquePeople: new Set<string>(), peopleByStatus: {} as Record<string, Set<string>>, total: 0 };

    const statusCol = serviceProfile?.semanticMap?.status || rdaInfo.statusColumn;
    const personCol = serviceProfile?.semanticMap?.person || rdaInfo.personColumn;
    const dict = serviceProfile?.statusDictionary || {};

    const statusCounts: Record<string, number> = {};
    const uniquePeople = new Set<string>();
    const peopleByStatus: Record<string, Set<string>> = {};

    for (const r of filtered) {
      // Status normalization via dictionary
      let rawStatus = String(r[statusCol || ''] || '').trim().toLowerCase();
      const normalizedStatus = dict[rawStatus] || rawStatus.toUpperCase() || 'VAZIO';
      statusCounts[normalizedStatus] = (statusCounts[normalizedStatus] || 0) + 1;

      if (personCol) {
        const person = String(r[personCol] || '').trim();
        if (person && person !== '-' && person !== '') {
          uniquePeople.add(person);
          if (!peopleByStatus[normalizedStatus]) peopleByStatus[normalizedStatus] = new Set();
          peopleByStatus[normalizedStatus].add(person);
        }
      }
    }

    return { statusCounts, uniquePeople, peopleByStatus, total: filtered.length };
  }, [filtered, serviceProfile, rdaInfo]);

  const kpis = useMemo(() => {
    if (!dataset || !serviceProfile) return [];

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
      detailList?: Array<{ name: string; detail?: string }>;
    }> = [];

    const includes = serviceProfile.kpiProfile.include;
    const labels = serviceProfile.labels;
    const { statusCounts, uniquePeople, peopleByStatus, total } = profileKpis;
    const toList = (s?: Set<string>) => Array.from(s || []).sort().map(name => ({ name }));

    // ── Primary rate KPI ──
    if (serviceProfile.kpiProfile.primaryRate !== 'none') {
      let rateValue = 0;
      let rateCount = 0;

      if (serviceProfile.kpiProfile.primaryRate === 'delivery_rate') {
        rateCount = (statusCounts['ENT'] || 0) + (statusCounts['ENTREGUE'] || 0);
        rateValue = total > 0 ? Math.round((rateCount / total) * 100) : 0;
      } else if (serviceProfile.kpiProfile.primaryRate === 'conformity_rate') {
        rateCount = (statusCounts['SIM'] || 0) + (statusCounts['OK'] || 0);
        rateValue = total > 0 ? Math.round((rateCount / total) * 100) : 0;
      } else if (serviceProfile.kpiProfile.primaryRate === 'non_empty_rate') {
        const empty = (statusCounts['VAZIO'] || 0) + (statusCounts['-'] || 0) + (statusCounts[''] || 0);
        rateCount = total - empty;
        rateValue = total > 0 ? Math.round((rateCount / total) * 100) : 0;
      }

      result.push({
        title: labels.primaryRateLabel,
        value: `${rateValue}%`,
        subtitle: `${rateCount} de ${total} registros`,
        icon: <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-primary" />,
        variant: "default",
        type: "count",
        total,
        percentage: rateValue,
      });
    }

    // ── Total records ──
    if (includes.includes('total_records')) {
      result.push({
        title: labels.totalLabel,
        value: total.toLocaleString("pt-BR"),
        subtitle: `de ${dataset.totalRows} no arquivo`,
        icon: <Database className="w-4 h-4 md:w-5 md:h-5 text-primary" />,
        variant: "default",
        type: "count",
        total: dataset.totalRows,
      });
    }

    // ── Delivered total ──
    if (includes.includes('delivered_total')) {
      const delivered = (statusCounts['ENT'] || 0) + (statusCounts['ENTREGUE'] || 0);
      result.push({
        title: "Total Entregue",
        value: delivered.toLocaleString("pt-BR"),
        subtitle: `${toList(peopleByStatus['ENT'] || peopleByStatus['ENTREGUE']).length} colaboradores`,
        icon: <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 text-primary" />,
        variant: "success",
        type: "count",
        detailList: toList(new Set([...(peopleByStatus['ENT'] || []), ...(peopleByStatus['ENTREGUE'] || [])])),
      });
    }

    // ── Pending total ──
    if (includes.includes('pending_total') && labels.pendingLabel) {
      const empty = (statusCounts['VAZIO'] || 0) + (statusCounts['-'] || 0) + (statusCounts[''] || 0);
      const nonConf = (statusCounts['NAO'] || 0) + (statusCounts['NOK'] || 0);
      const pending = Math.max(empty, nonConf);
      result.push({
        title: labels.pendingLabel,
        value: pending.toLocaleString("pt-BR"),
        subtitle: `registros pendentes/NC`,
        icon: <AlertCircle className="w-4 h-4 md:w-5 md:h-5 text-secondary" />,
        variant: "warning",
        type: "count",
        detailList: toList(new Set([...(peopleByStatus['VAZIO'] || []), ...(peopleByStatus['NAO'] || []), ...(peopleByStatus['NOK'] || [])])),
      });
    }

    // ── Folga / Banco / Falta (RDA-specific) ──
    if (includes.includes('folga_total')) {
      const folga = (statusCounts['FOL'] || 0) + (statusCounts['FOLGA'] || 0);
      result.push({
        title: "Folgas",
        value: folga.toLocaleString("pt-BR"),
        subtitle: `${toList(peopleByStatus['FOL'] || peopleByStatus['FOLGA']).length} colaboradores`,
        icon: <Coffee className="w-4 h-4 md:w-5 md:h-5 text-accent" />,
        variant: "info",
        type: "count",
        detailList: toList(new Set([...(peopleByStatus['FOL'] || []), ...(peopleByStatus['FOLGA'] || [])])),
      });
    }

    if (includes.includes('banco_total')) {
      const banco = (statusCounts['BAN'] || 0) + (statusCounts['BANCO'] || 0) + (statusCounts['BANCO DE HORAS'] || 0);
      result.push({
        title: "Banco de Horas",
        value: banco.toLocaleString("pt-BR"),
        subtitle: `colaboradores`,
        icon: <Clock className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />,
        variant: "default",
        type: "count",
        detailList: toList(new Set([...(peopleByStatus['BAN'] || []), ...(peopleByStatus['BANCO'] || []), ...(peopleByStatus['BANCO DE HORAS'] || [])])),
      });
    }

    // ── Unique people ──
    if (includes.includes('unique_people') && labels.peopleLabel) {
      result.push({
        title: labels.peopleLabel,
        value: uniquePeople.size.toLocaleString("pt-BR"),
        subtitle: "únicos detectados",
        icon: <Users className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />,
        variant: "default",
        type: "count",
        detailList: toList(uniquePeople),
      });
    }

    // ── Conformity-specific: empty rate ──
    if (includes.includes('empty_rate')) {
      const empty = (statusCounts['VAZIO'] || 0) + (statusCounts['-'] || 0) + (statusCounts[''] || 0);
      const rate = total > 0 ? Math.round((empty / total) * 100) : 0;
      result.push({
        title: "% Vazios",
        value: `${rate}%`,
        subtitle: `${empty} campos vazios`,
        icon: <Layers className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />,
        variant: rate > 30 ? "danger" : "default",
        type: "count",
        percentage: rate,
      });
    }

    // ── Top categories / observations ──
    if (includes.includes('top_categories') || includes.includes('top_observations')) {
      const catCol = serviceProfile.semanticMap.observation || safeCategoryColumns[0];
      if (catCol) {
        const counts = safeSummary.categoryCounts?.[catCol];
        if (counts) {
          const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
          const topValue = entries[0];
          result.push({
            title: catCol,
            value: entries.length.toLocaleString("pt-BR"),
            subtitle: topValue ? `Top: ${topValue[0]} (${topValue[1]})` : "valores únicos",
            icon: <Tag className="w-4 h-4 md:w-5 md:h-5 text-secondary" />,
            variant: "warning",
            type: "category",
            columnName: catCol,
            distribution: entries.map(([name, value]) => ({ name, value })),
          });
        }
      }
    }

    // ── Date range ──
    if (includes.includes('date_range') && safeSummary.dateRange) {
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

    // ── Numeric stats (generic fallback) ──
    if (includes.includes('unique_entities') || serviceProfile.kpiProfile.primaryRate === 'none') {
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
            stats: { min: stats.min, max: stats.max, avg: stats.avg, sum: stats.sum },
          });
        }
      }
    }

    return result.slice(0, 8);
  }, [dataset, serviceProfile, profileKpis, safeNumericColumns, safeCategoryColumns, safeSummary]);

  const handleKPIClick = (kpi: typeof kpis[0]) => {
    setSelectedKPI(kpi);
    setKpiModalOpen(true);
  };

  // Gera dados para gráfico de linha (entregas por dia)
  // Helper para normalizar data para string ISO
  const normalizeDateValue = (v: any): string => {
    if (!v) return "";
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (typeof v === "object" && v._type === "Date" && v.value?.iso) {
      return v.value.iso.slice(0, 10);
    }
    if (typeof v === "string") return v;
    return String(v);
  };

  const lineChartData = useMemo(() => {
    if (!dataset) return null;
    const dateCol = dataset.detectedDateColumn;
    if (!dateCol) return null;
    
    const statusCol = rdaInfo.statusColumn;
    
    const map = new Map<string, { date: string; count: number; entregue: number }>();
    
    for (const r of filtered) {
      const rawDate = r[dateCol];
      if (!rawDate) continue;
      
      const date = normalizeDateValue(rawDate);
      if (!date) continue;
      
      const cur = map.get(date) || { date, count: 0, entregue: 0 };
      cur.count += 1;
      
      // Para RDA, conta entregas
      if (statusCol) {
        const status = String(r[statusCol] || "").trim().toUpperCase();
        if (status === "ENTREGUE" || status === "ENT") {
          cur.entregue += 1;
        }
      }
      
      map.set(date, cur);
    }
    
    return Array.from(map.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(item => ({
        date: item.date,
        value1: rdaInfo.isRDA ? item.entregue : item.count,
        label1: rdaInfo.isRDA ? "Entregas" : "Registros",
      }));
  }, [dataset, filtered, rdaInfo]);

  // Gera dados para gráfico de pizza (distribuição por status)
  const pieChartData = useMemo(() => {
    if (safeCategoryColumns.length === 0) return null;
    
    // Para RDA, usa coluna de status
    const catCol = rdaInfo.isRDA && rdaInfo.statusColumn 
      ? rdaInfo.statusColumn 
      : safeCategoryColumns[0];
    
    const counts = new Map<string, number>();
    for (const r of filtered) {
      let v = String(r[catCol] || "(vazio)").trim();
      if (!v || v === "-") v = "VAZIO";
      counts.set(v, (counts.get(v) || 0) + 1);
    }
    
    return {
      data: Array.from(counts.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10),
      columnName: catCol,
    };
  }, [filtered, safeCategoryColumns, rdaInfo]);

  // Gera dados para ranking por pessoa
  const personChartData = useMemo(() => {
    const personCol = rdaInfo.personColumn || safeCategoryColumns[1] || safeCategoryColumns[0];
    if (!personCol) return null;
    
    const statusCol = rdaInfo.statusColumn;
    
    const map = new Map<string, { name: string; total: number; entregue: number }>();
    
    for (const r of filtered) {
      const person = String(r[personCol] || "(vazio)").trim();
      
      // Ignora valores que parecem status
      if (/^(ENTREGUE?|FOLGA?|FALTA?|BANCO|ATESTADO?|FER[IÉ]AS?|VAZIO|-)$/i.test(person)) continue;
      
      const cur = map.get(person) || { name: person, total: 0, entregue: 0 };
      cur.total += 1;
      
      if (statusCol) {
        const status = String(r[statusCol] || "").trim().toUpperCase();
        if (status === "ENTREGUE" || status === "ENT") {
          cur.entregue += 1;
        }
      }
      
      map.set(person, cur);
    }
    
    return {
      data: Array.from(map.values())
        .sort((a, b) => b.entregue - a.entregue)
        .slice(0, 10)
        .map(item => ({ name: item.name, value: rdaInfo.isRDA ? item.entregue : item.total })),
      columnName: personCol,
    };
  }, [filtered, safeCategoryColumns, rdaInfo]);

  // Gera dados para entregas por equipe
  const teamChartData = useMemo(() => {
    const teamCol = rdaInfo.teamColumn || safeCategoryColumns[0];
    if (!teamCol) return null;
    
    const statusCol = rdaInfo.statusColumn;
    
    const map = new Map<string, { category: string; count: number; entregue: number }>();
    
    for (const r of filtered) {
      const team = String(r[teamCol] || "(vazio)").trim();
      
      // Ignora valores que parecem status
      if (/^(ENTREGUE?|FOLGA?|FALTA?|BANCO|ATESTADO?|FER[IÉ]AS?|VAZIO|-)$/i.test(team)) continue;
      
      const cur = map.get(team) || { category: team, count: 0, entregue: 0 };
      cur.count += 1;
      
      if (statusCol) {
        const status = String(r[statusCol] || "").trim().toUpperCase();
        if (status === "ENTREGUE" || status === "ENT") {
          cur.entregue += 1;
        }
      }
      
      map.set(team, cur);
    }
    
    return Array.from(map.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(item => ({ category: item.category, count: rdaInfo.isRDA ? item.entregue : item.count }));
  }, [filtered, safeCategoryColumns, rdaInfo]);

  // Taxa por equipe (para RDA)
  const teamRateData = useMemo(() => {
    if (!rdaInfo.isRDA) return null;
    
    const teamCol = rdaInfo.teamColumn || safeCategoryColumns[0];
    const statusCol = rdaInfo.statusColumn;
    if (!teamCol || !statusCol) return null;
    
    const map = new Map<string, { name: string; total: number; entregue: number }>();
    
    for (const r of filtered) {
      const team = String(r[teamCol] || "(vazio)").trim();
      
      // Ignora valores que parecem status
      if (/^(ENTREGUE?|FOLGA?|FALTA?|BANCO|ATESTADO?|FER[IÉ]AS?|VAZIO|-)$/i.test(team)) continue;
      
      const cur = map.get(team) || { name: team, total: 0, entregue: 0 };
      cur.total += 1;
      
      const status = String(r[statusCol] || "").trim().toUpperCase();
      if (status === "ENTREGUE" || status === "ENT") {
        cur.entregue += 1;
      }
      
      map.set(team, cur);
    }
    
    return Array.from(map.values())
      .map(item => ({
        name: item.name,
        value: item.total > 0 ? Math.round((item.entregue / item.total) * 100) : 0,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filtered, safeCategoryColumns, rdaInfo]);

  // Progress rings para status
  const progressRings = useMemo(() => {
    const catCol = rdaInfo.statusColumn || safeCategoryColumns[0];
    if (!catCol) return [];
    
    const counts = new Map<string, number>();
    for (const r of filtered) {
      let v = String(r[catCol] || "VAZIO").trim().toUpperCase();
      if (!v || v === "-") v = "VAZIO";
      counts.set(v, (counts.get(v) || 0) + 1);
    }
    
    const total = filtered.length;
    
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([label, count]) => ({
        label,
        value: total > 0 ? Math.round((count / total) * 100) : 0,
      }));
  }, [filtered, safeCategoryColumns, rdaInfo]);

  const handleExport = async () => {
    setExporting(true);
    toast({ title: "Exportando...", description: "Preparando dados para download" });
    
    try {
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
              <h1 className="font-black text-lg text-card-foreground tracking-tight">{dataset?.name ?? 'Dashboard'}</h1>
              <p className="text-xs text-muted-foreground">
                {filtered.length} registros • {safeColumns.length} colunas
                {safeSummary.dateRange ? ` • ${safeSummary.dateRange.from} a ${safeSummary.dateRange.to}` : ''}
              </p>
            </div>
          </div>
          
          {/* Quick stats badges */}
          <div className="hidden md:flex items-center gap-2">
            {serviceProfile && serviceProfile.confidence > 0.35 && (() => {
              const isAiRefined = serviceProfile.signals.notes.some(n => n.includes("Refinado por IA"));
              const isFallback = serviceProfile.signals.notes.some(n => n.includes("Fallback"));
              const sourceIcon = isAiRefined ? "🤖" : "📐";
              const sourceLabel = isAiRefined ? "IA" : "Local";
              const confPct = Math.round(serviceProfile.confidence * 100);
              return (
                <span
                  className="px-3 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full flex items-center gap-1.5"
                  title={`Confiança: ${confPct}% • Fonte: ${isAiRefined ? "Refinado por IA" : "Heurística local"} | ${serviceProfile.signals.matchedKeywords.join(', ')}`}
                >
                  🏷️ {serviceProfile.domain} › {serviceProfile.service}
                  <span className={`ml-1 px-1.5 py-0.5 rounded text-[9px] font-semibold ${isAiRefined ? 'bg-accent/20 text-accent-foreground' : 'bg-muted text-muted-foreground'}`}>
                    {sourceIcon} {sourceLabel} {confPct}%
                  </span>
                </span>
              );
            })()}
            {rdaInfo.isRDA && (
              <span className="px-3 py-1 bg-secondary/10 text-secondary text-xs font-bold rounded-full">
                📋 RDA
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
        
        {/* KPI Cards */}
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

        {/* Charts Row 1: Line + Pie */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {lineChartData && (lineChartData.length ?? 0) > 1 && (
            <ChartCard 
              title={rdaInfo.isRDA ? "📈 Entregas por Dia" : `Evolução por ${dataset?.detectedDateColumn ?? 'Data'}`}
              subtitle="Tendência ao longo do tempo"
              className="lg:col-span-2"
            >
              <GenericLineChart data={lineChartData} />
            </ChartCard>
          )}
          
          {pieChartData && (pieChartData.data.length ?? 0) > 0 && (
            <ChartCard 
              title={rdaInfo.isRDA ? "🍩 Distribuição por Status" : `Distribuição: ${pieChartData.columnName ?? 'Categoria'}`}
              subtitle="Composição geral"
            >
              <GenericPieChart data={pieChartData.data} />
            </ChartCard>
          )}
        </div>

        {/* Charts Row 2: Person Ranking + Team + Team Rate */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {personChartData && (personChartData.data.length ?? 0) > 0 && (
            <ChartCard 
              title={rdaInfo.isRDA ? "👤 Ranking por Pessoa" : `Por ${personChartData.columnName ?? "Pessoa"}`}
              subtitle="Top 10 por quantidade"
            >
              <GenericHorizontalBarChart data={personChartData.data} />
            </ChartCard>
          )}
          
          {teamChartData && (teamChartData.length ?? 0) > 0 && (
            <ChartCard 
              title={rdaInfo.isRDA ? "👥 Entregas por Equipe" : `Por ${rdaInfo.teamColumn || safeCategoryColumns[0] || "Categoria"}`}
              subtitle="Distribuição por grupo"
            >
              <GenericBarChart data={teamChartData} />
            </ChartCard>
          )}

          {rdaInfo.isRDA && teamRateData && (teamRateData.length ?? 0) > 0 ? (
            <ChartCard 
              title="📊 Taxa por Equipe (%)"
              subtitle="Percentual de entregas"
            >
              <GenericHorizontalBarChart data={teamRateData} />
            </ChartCard>
          ) : (
            (progressRings?.length ?? 0) > 0 && (
              <ChartCard 
                title="Métricas Rápidas"
                subtitle={`Taxas por ${rdaInfo.statusColumn || safeCategoryColumns[0] || 'Categoria'}`}
              >
                <div className="flex flex-wrap justify-around items-center gap-4 py-4">
                  {progressRings.map((ring, idx) => (
                    <ProgressRing key={idx} value={ring.value} label={ring.label} size="md" />
                  ))}
                </div>
              </ChartCard>
            )
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
            {rdaInfo.statusColumn && (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                <span className="text-muted-foreground">Status:</span>
                <span className="font-semibold truncate">{rdaInfo.statusColumn}</span>
              </div>
            )}
            {rdaInfo.personColumn && (
              <div className="flex items-center gap-2 text-sm">
                <Users className="w-4 h-4 text-accent" />
                <span className="text-muted-foreground">Pessoa:</span>
                <span className="font-semibold truncate">{rdaInfo.personColumn}</span>
              </div>
            )}
            {rdaInfo.teamColumn && (
              <div className="flex items-center gap-2 text-sm">
                <Briefcase className="w-4 h-4 text-secondary" />
                <span className="text-muted-foreground">Equipe:</span>
                <span className="font-semibold truncate">{rdaInfo.teamColumn}</span>
              </div>
            )}
            {!rdaInfo.isRDA && safeNumericColumns.slice(0, 2).map((col) => (
              <div key={col} className="flex items-center gap-2 text-sm">
                <Hash className="w-4 h-4 text-accent" />
                <span className="text-muted-foreground">Número:</span>
                <span className="font-semibold truncate">{col}</span>
              </div>
            ))}
            {!rdaInfo.isRDA && safeCategoryColumns.slice(0, 3).map((col) => (
              <div key={col} className="flex items-center gap-2 text-sm">
                <Tag className="w-4 h-4 text-secondary" />
                <span className="text-muted-foreground">Categoria:</span>
                <span className="font-semibold truncate">{col}</span>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* Predictive Analysis */}
      <div className="px-6 pb-6">
        <PredictiveAnalysis dataset={dataset} />
      </div>
    </div>
  );
}
