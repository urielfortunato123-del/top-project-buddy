import React, { useMemo, useState, useRef } from "react";
import { 
  CheckCircle, AlertCircle, Coffee, Clock, Users, TrendingUp, 
  FileDown, Loader2, FileSpreadsheet, Calendar, Target, Award 
} from "lucide-react";
import type { Dataset } from "@/lib/database";
import type { DateRange } from "@/lib/dateRange";
import { KPICard } from "./KPICard";
import { KPIDetailModal, type KPIType } from "./KPIDetailModal";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { exportDashboardToPDF } from "@/lib/pdfExport";
import { exportToExcel } from "@/lib/excelExport";
import {
  ChartCard,
  DeliveryLineChart,
  PersonBarChart,
  StatusPieChart,
  TeamBarChart,
  TeamComparisonChart,
  ProgressRing,
} from "./Charts";

interface DashboardViewProps {
  dataset: Dataset;
  personFilter: string;
  statusFilter: string;
  teamFilter: string;
  dateRange: DateRange;
}

function prettyStatus(s: string) {
  if (s === "VAZIO") return "Sem Info";
  return s;
}

export function DashboardView({ dataset, personFilter, statusFilter, teamFilter, dateRange }: DashboardViewProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<KPIType>("taxa");
  const [exporting, setExporting] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    let data = dataset.rows;
    
    if (dateRange.from) {
      const fromStr = dateRange.from.toISOString().slice(0, 10);
      data = data.filter((r) => r.date >= fromStr);
    }
    if (dateRange.to) {
      const toStr = dateRange.to.toISOString().slice(0, 10);
      data = data.filter((r) => r.date <= toStr);
    }
    
    if (teamFilter !== "ALL") data = data.filter((r) => r.team === teamFilter);
    if (personFilter !== "ALL") data = data.filter((r) => r.person === personFilter);
    if (statusFilter !== "ALL") data = data.filter((r) => r.status === statusFilter);
    return data;
  }, [dataset.rows, personFilter, statusFilter, teamFilter, dateRange]);

  const kpis = useMemo(() => {
    const total = filtered.length;
    const entregue = filtered.filter((r) => r.status === "ENTREGUE").length;
    const folga = filtered.filter((r) => r.status === "FOLGA").length;
    const banco = filtered.filter((r) => r.status === "BANCO DE HORAS").length;
    const vazio = filtered.filter((r) => r.status === "VAZIO").length;
    const falta = filtered.filter((r) => r.status === "FALTA").length;
    const entreguesPct = total ? Math.round((entregue / total) * 100) : 0;
    const uniquePeople = new Set(filtered.map((r) => r.person)).size;
    const uniqueDays = new Set(filtered.map((r) => r.date)).size;
    const uniqueTeams = new Set(filtered.map((r) => r.team)).size;
    
    return { total, entregue, folga, banco, vazio, falta, entreguesPct, uniquePeople, uniqueDays, uniqueTeams };
  }, [filtered]);

  const seriesByDay = useMemo(() => {
    const map = new Map<string, { date: string; entregue: number; total: number }>();
    for (const r of filtered) {
      const cur = map.get(r.date) || { date: r.date, entregue: 0, total: 0 };
      cur.total += 1;
      if (r.status === "ENTREGUE") cur.entregue += 1;
      map.set(r.date, cur);
    }
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [filtered]);

  const barByPerson = useMemo(() => {
    const map = new Map<string, { person: string; entregue: number; total: number }>();
    for (const r of filtered) {
      const cur = map.get(r.person) || { person: r.person, entregue: 0, total: 0 };
      cur.total += 1;
      if (r.status === "ENTREGUE") cur.entregue += 1;
      map.set(r.person, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.entregue - a.entregue);
  }, [filtered]);

  const pieByStatus = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of filtered) map.set(r.status, (map.get(r.status) || 0) + 1);
    return Array.from(map.entries())
      .map(([status, value]) => ({ name: prettyStatus(status), value }))
      .sort((a, b) => b.value - a.value);
  }, [filtered]);

  const barByTeam = useMemo(() => {
    const map = new Map<string, { team: string; entregue: number; total: number }>();
    for (const r of filtered) {
      const team = r.team || "GERAL";
      const cur = map.get(team) || { team, entregue: 0, total: 0 };
      cur.total += 1;
      if (r.status === "ENTREGUE") cur.entregue += 1;
      map.set(team, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.entregue - a.entregue);
  }, [filtered]);

  const teamComparison = useMemo(() => {
    return barByTeam.map(item => ({
      ...item,
      taxa: item.total > 0 ? Math.round((item.entregue / item.total) * 100) : 0
    }));
  }, [barByTeam]);

  const openModal = (type: KPIType) => {
    setModalType(type);
    setModalOpen(true);
  };

  const handleExportPDF = async () => {
    if (!dashboardRef.current) return;
    
    setExporting(true);
    toast({ title: "Gerando PDF...", description: "Aguarde enquanto capturamos o dashboard" });

    try {
      await exportDashboardToPDF({
        element: dashboardRef.current,
        datasetName: dataset.name,
        filters: {
          team: teamFilter,
          person: personFilter,
          status: statusFilter,
          dateFrom: dateRange.from,
          dateTo: dateRange.to,
        },
      });
      toast({ title: "PDF exportado com sucesso!" });
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast({ title: "Erro ao exportar PDF", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      toast({ title: "Gerando Excel...", description: "Aguarde enquanto processamos os dados" });
      await exportToExcel({
        dataset,
        filters: {
          team: teamFilter,
          person: personFilter,
          status: statusFilter,
          dateFrom: dateRange.from,
          dateTo: dateRange.to,
        },
      });
      toast({ title: "Excel exportado com sucesso!" });
    } catch (error) {
      console.error("Error exporting Excel:", error);
      toast({ title: "Erro ao exportar Excel", variant: "destructive" });
    }
  };

  if (filtered.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 mx-auto mb-6 text-muted-foreground/30" />
          <p className="text-xl font-semibold">Nenhum dado para exibir</p>
          <p className="text-sm mt-2">Importe um arquivo Excel ou ajuste os filtros</p>
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
              <h1 className="font-black text-lg text-card-foreground tracking-tight">Dashboard RDA</h1>
              <p className="text-xs text-muted-foreground">{dataset.name}</p>
            </div>
          </div>
          
          {/* Quick stats badges */}
          <div className="hidden md:flex items-center gap-2">
            <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full">
              {kpis.uniquePeople} pessoas
            </span>
            <span className="px-3 py-1 bg-accent/10 text-accent text-xs font-bold rounded-full">
              {kpis.uniqueDays} dias
            </span>
            <span className="px-3 py-1 bg-secondary/10 text-secondary text-xs font-bold rounded-full">
              {kpis.uniqueTeams} equipes
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            className="gap-2 font-semibold"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span className="hidden sm:inline">Excel</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            disabled={exporting}
            className="gap-2 font-semibold"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            <span className="hidden sm:inline">PDF</span>
          </Button>
        </div>
      </div>

      {/* Dashboard Content */}
      <div ref={dashboardRef} className="p-4 md:p-6 space-y-6 overflow-auto flex-1 bg-gradient-to-br from-background via-background to-muted/30">
        
        {/* KPI Cards - 2 rows of 3 for larger cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KPICard
            title="Taxa de Entrega"
            value={`${kpis.entreguesPct}%`}
            subtitle={`${kpis.entregue} de ${kpis.total} registros`}
            icon={<Target className="w-5 h-5 text-primary" />}
            variant="success"
            trend={kpis.entreguesPct >= 80 ? "up" : kpis.entreguesPct >= 50 ? "neutral" : "down"}
            onClick={() => openModal("taxa")}
          />
          <KPICard
            title="Total Entregue"
            value={kpis.entregue.toLocaleString("pt-BR")}
            subtitle="Marcados como ENTREGUE"
            icon={<CheckCircle className="w-5 h-5 text-primary" />}
            variant="success"
            onClick={() => openModal("entregue")}
          />
          <KPICard
            title="Pendências"
            value={(kpis.vazio + kpis.falta).toLocaleString("pt-BR")}
            subtitle={`${kpis.vazio} vazios + ${kpis.falta} faltas`}
            icon={<AlertCircle className="w-5 h-5 text-destructive" />}
            variant="danger"
            onClick={() => openModal("pendencias")}
          />
          <KPICard
            title="Folgas"
            value={kpis.folga.toLocaleString("pt-BR")}
            subtitle="Dias de descanso"
            icon={<Coffee className="w-5 h-5 text-accent" />}
            variant="info"
            onClick={() => openModal("folgas")}
          />
          <KPICard
            title="Banco de Horas"
            value={kpis.banco.toLocaleString("pt-BR")}
            subtitle="Compensações registradas"
            icon={<Clock className="w-5 h-5 text-violet-500" />}
            variant="purple"
            onClick={() => openModal("banco")}
          />
          <KPICard
            title="Colaboradores"
            value={kpis.uniquePeople.toLocaleString("pt-BR")}
            subtitle={`Em ${kpis.uniqueTeams} equipes`}
            icon={<Users className="w-5 h-5 text-muted-foreground" />}
            onClick={() => openModal("pessoas")}
          />
        </div>

        <KPIDetailModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          type={modalType}
          data={filtered}
          kpis={kpis}
        />

        {/* Charts Row 1 - Full width trend + Pie */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ChartCard 
            title="Tendência de Entregas" 
            subtitle="Evolução diária no período"
            className="lg:col-span-2"
          >
            <DeliveryLineChart data={seriesByDay} />
          </ChartCard>
          
          <ChartCard 
            title="Distribuição por Status" 
            subtitle="Composição geral"
          >
            <StatusPieChart data={pieByStatus} />
          </ChartCard>
        </div>

        {/* Charts Row 2 - Three columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <ChartCard 
            title="Top 10 por Pessoa" 
            subtitle="Ranking de entregas"
            action={
              <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-full">
                <Award className="w-3 h-3 inline mr-1" />
                TOP 10
              </span>
            }
          >
            <PersonBarChart data={barByPerson} />
          </ChartCard>
          
          <ChartCard 
            title="Entregas por Equipe" 
            subtitle="Volume absoluto"
          >
            <TeamBarChart data={barByTeam} />
          </ChartCard>

          <ChartCard 
            title="Taxa por Equipe" 
            subtitle="Comparativo de performance"
          >
            <TeamComparisonChart data={teamComparison} />
          </ChartCard>
        </div>

        {/* Quick Metrics - Progress Rings */}
        <ChartCard 
          title="Métricas Rápidas" 
          subtitle="Visão consolidada das taxas"
        >
          <div className="flex flex-wrap justify-around items-center gap-6 py-4">
            <ProgressRing value={kpis.entreguesPct} label="Taxa Entrega" size="lg" />
            <ProgressRing 
              value={kpis.total ? Math.round((kpis.folga / kpis.total) * 100) : 0} 
              label="Taxa Folga" 
            />
            <ProgressRing 
              value={kpis.total ? Math.round(((kpis.vazio + kpis.falta) / kpis.total) * 100) : 0} 
              label="Pendências" 
            />
            <ProgressRing 
              value={kpis.total ? Math.round((kpis.banco / kpis.total) * 100) : 0} 
              label="Banco Horas" 
            />
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
