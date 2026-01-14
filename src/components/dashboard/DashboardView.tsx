import React, { useMemo } from "react";
import { CheckCircle, AlertCircle, Coffee, Clock, Users, TrendingUp } from "lucide-react";
import type { Dataset, DatasetRow } from "@/lib/database";
import { KPICard } from "./KPICard";
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
}

function prettyStatus(s: string) {
  if (s === "VAZIO") return "Sem Info";
  return s;
}

export function DashboardView({ dataset, personFilter, statusFilter, teamFilter }: DashboardViewProps) {
  const filtered = useMemo(() => {
    let data = dataset.rows;
    if (teamFilter !== "ALL") data = data.filter((r) => r.team === teamFilter);
    if (personFilter !== "ALL") data = data.filter((r) => r.person === personFilter);
    if (statusFilter !== "ALL") data = data.filter((r) => r.status === statusFilter);
    return data;
  }, [dataset.rows, personFilter, statusFilter, teamFilter]);

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
    <div className="p-4 space-y-4 overflow-auto">
      {/* KPIs Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        <KPICard
          title="Taxa de Entrega"
          value={`${kpis.entreguesPct}%`}
          subtitle={`${kpis.entregue} de ${kpis.total} registros`}
          icon={<TrendingUp className="w-5 h-5 text-primary" />}
          variant="success"
        />
        <KPICard
          title="Total Entregue"
          value={kpis.entregue}
          subtitle="Marcados como ENTREGUE"
          icon={<CheckCircle className="w-5 h-5 text-primary" />}
          variant="success"
        />
        <KPICard
          title="Pendências"
          value={kpis.vazio}
          subtitle="Sem informação lançada"
          icon={<AlertCircle className="w-5 h-5 text-secondary" />}
          variant="warning"
        />
        <KPICard
          title="Folgas"
          value={kpis.folga}
          subtitle="Dias de folga"
          icon={<Coffee className="w-5 h-5 text-accent" />}
          variant="info"
        />
        <KPICard
          title="Banco de Horas"
          value={kpis.banco}
          subtitle="Compensações"
          icon={<Clock className="w-5 h-5 text-purple-500" />}
        />
        <KPICard
          title="Pessoas"
          value={kpis.uniquePeople}
          subtitle="Colaboradores únicos"
          icon={<Users className="w-5 h-5 text-muted-foreground" />}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="Entregas por Dia" className="lg:col-span-2">
          <DeliveryLineChart data={seriesByDay} />
        </ChartCard>
        
        <ChartCard title="Distribuição por Status">
          <StatusPieChart data={pieByStatus} />
        </ChartCard>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="Ranking por Pessoa">
          <PersonBarChart data={barByPerson} />
        </ChartCard>
        
        <ChartCard title="Entregas por Equipe">
          <TeamBarChart data={barByTeam} />
        </ChartCard>

        <ChartCard title="Comparação de Equipes (Taxa %)">
          <TeamComparisonChart data={teamComparison} />
        </ChartCard>
      </div>

      {/* Progress Rings */}
      <ChartCard title="Métricas Rápidas">
        <div className="flex flex-wrap justify-around gap-4 py-4">
          <ProgressRing value={kpis.entreguesPct} label="Taxa Entrega" />
          <ProgressRing 
            value={kpis.total ? Math.round((kpis.folga / kpis.total) * 100) : 0} 
            label="Taxa Folga" 
          />
          <ProgressRing 
            value={kpis.total ? Math.round((kpis.vazio / kpis.total) * 100) : 0} 
            label="Pendências" 
          />
        </div>
      </ChartCard>
    </div>
  );
}
