import React, { useMemo, useState, useRef } from "react";
import { CheckCircle, AlertCircle, Coffee, Clock, Users, TrendingUp, FileDown, Loader2, FileSpreadsheet } from "lucide-react";
import type { Dataset } from "@/lib/database";
import type { DateRange } from "@/pages/Index";
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
    const entreguesPct = total ? Math.round((entregue / total) * 100) : 0;
    const uniquePeople = new Set(filtered.map((r) => r.person)).size;
    
    return { total, entregue, folga, banco, vazio, entreguesPct, uniquePeople };
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

  const handleExportExcel = () => {
    try {
      exportToExcel({
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
          <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum dado para exibir</p>
          <p className="text-sm">Importe um arquivo Excel ou ajuste os filtros</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-end gap-2 p-2 border-b bg-card shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportExcel}
          className="gap-2"
        >
          <FileSpreadsheet className="w-4 h-4" />
          Exportar Excel
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportPDF}
          disabled={exporting}
          className="gap-2"
        >
          {exporting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileDown className="w-4 h-4" />
          )}
          Exportar PDF
        </Button>
      </div>

      <div ref={dashboardRef} className="p-3 md:p-4 space-y-3 md:space-y-4 overflow-auto flex-1 bg-background">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
          <KPICard
            title="Taxa de Entrega"
            value={`${kpis.entreguesPct}%`}
            subtitle={`${kpis.entregue} de ${kpis.total} registros`}
            icon={<TrendingUp className="w-5 h-5 text-primary" />}
            variant="success"
            onClick={() => openModal("taxa")}
          />
          <KPICard
            title="Total Entregue"
            value={kpis.entregue}
            subtitle="Marcados como ENTREGUE"
            icon={<CheckCircle className="w-5 h-5 text-primary" />}
            variant="success"
            onClick={() => openModal("entregue")}
          />
          <KPICard
            title="Pendencias"
            value={kpis.vazio}
            subtitle="Sem informacao lancada"
            icon={<AlertCircle className="w-5 h-5 text-secondary" />}
            variant="warning"
            onClick={() => openModal("pendencias")}
          />
          <KPICard
            title="Folgas"
            value={kpis.folga}
            subtitle="Dias de folga"
            icon={<Coffee className="w-5 h-5 text-accent" />}
            variant="info"
            onClick={() => openModal("folgas")}
          />
          <KPICard
            title="Banco de Horas"
            value={kpis.banco}
            subtitle="Compensacoes"
            icon={<Clock className="w-5 h-5 text-purple-500" />}
            onClick={() => openModal("banco")}
          />
          <KPICard
            title="Pessoas"
            value={kpis.uniquePeople}
            subtitle="Colaboradores unicos"
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          <ChartCard title="Entregas por Dia" className="md:col-span-2">
            <DeliveryLineChart data={seriesByDay} />
          </ChartCard>
          
          <ChartCard title="Distribuicao por Status">
            <StatusPieChart data={pieByStatus} />
          </ChartCard>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          <ChartCard title="Ranking por Pessoa">
            <PersonBarChart data={barByPerson} />
          </ChartCard>
          
          <ChartCard title="Entregas por Equipe">
            <TeamBarChart data={barByTeam} />
          </ChartCard>

          <ChartCard title="Comparacao de Equipes (Taxa %)">
            <TeamComparisonChart data={teamComparison} />
          </ChartCard>
        </div>

        <ChartCard title="Metricas Rapidas">
          <div className="flex flex-wrap justify-around gap-4 py-4">
            <ProgressRing value={kpis.entreguesPct} label="Taxa Entrega" />
            <ProgressRing 
              value={kpis.total ? Math.round((kpis.folga / kpis.total) * 100) : 0} 
              label="Taxa Folga" 
            />
            <ProgressRing 
              value={kpis.total ? Math.round((kpis.vazio / kpis.total) * 100) : 0} 
              label="Pendencias" 
            />
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
