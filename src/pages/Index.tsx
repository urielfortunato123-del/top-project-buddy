import React, { useState, useMemo, useRef } from "react";
import { 
  Upload, FileSpreadsheet, Trash2, Database, Settings, 
  TrendingUp, CheckCircle, AlertCircle, Coffee, Clock, Users,
  FileDown, X, CalendarIcon
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useDatasets } from "@/hooks/useDatasets";
import { toast } from "@/hooks/use-toast";
import { exportDashboardToPDF } from "@/lib/pdfExport";
import { exportToExcel } from "@/lib/excelExport";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend, Tooltip as RechartsTooltip
} from "recharts";

export interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

// Status chip config
const STATUS_CHIPS: Record<string, { label: string; bg: string; text: string }> = {
  "ENTREGUE": { label: "ENT", bg: "bg-green-100", text: "text-green-700" },
  "FOLGA": { label: "FOL", bg: "bg-orange-100", text: "text-orange-700" },
  "BANCO DE HORAS": { label: "BAN", bg: "bg-blue-100", text: "text-blue-700" },
  "VAZIO": { label: "-", bg: "bg-gray-100", text: "text-gray-400" },
};

const CHART_COLORS = ["#22c55e", "#f97316", "#3b82f6", "#a855f7", "#6b7280"];

function formatDayMonth(dateStr: string): string {
  const [, month, day] = dateStr.split("-");
  return `${day}/${month}`;
}

export default function Index() {
  const { datasets, currentDataset, loading, importFile, selectDataset, removeDataset } = useDatasets();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dashboardRef = useRef<HTMLDivElement>(null);

  const [personFilter, setPersonFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [teamFilter, setTeamFilter] = useState("ALL");
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [exporting, setExporting] = useState(false);

  // Available date range
  const availableDateRange = useMemo(() => {
    if (!currentDataset || currentDataset.rows.length === 0) return { min: undefined, max: undefined };
    const dates = currentDataset.rows.map(r => r.date).sort();
    return { min: new Date(dates[0]), max: new Date(dates[dates.length - 1]) };
  }, [currentDataset]);

  // Filtered data
  const filteredRows = useMemo(() => {
    if (!currentDataset) return [];
    let data = currentDataset.rows;
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
  }, [currentDataset, personFilter, statusFilter, teamFilter, dateRange]);

  // Lists for filters
  const peopleList = useMemo(() => {
    if (!currentDataset) return [];
    let people = currentDataset.people;
    if (teamFilter !== "ALL") {
      const teamPeople = new Set(currentDataset.rows.filter((r) => r.team === teamFilter).map((r) => r.person));
      people = people.filter((p) => teamPeople.has(p));
    }
    return people;
  }, [currentDataset, teamFilter]);

  const statusList = useMemo(() => currentDataset?.statuses || [], [currentDataset]);
  const teamList = useMemo(() => currentDataset?.teams || [], [currentDataset]);

  // KPIs
  const kpis = useMemo(() => {
    const total = filteredRows.length;
    const entregue = filteredRows.filter((r) => r.status === "ENTREGUE").length;
    const folga = filteredRows.filter((r) => r.status === "FOLGA").length;
    const banco = filteredRows.filter((r) => r.status === "BANCO DE HORAS").length;
    const vazio = filteredRows.filter((r) => r.status === "VAZIO").length;
    const taxa = total ? Math.round((entregue / total) * 100) : 0;
    const pessoas = new Set(filteredRows.map((r) => r.person)).size;
    return { total, entregue, folga, banco, vazio, taxa, pessoas };
  }, [filteredRows]);

  // Chart data
  const chartByDay = useMemo(() => {
    const map = new Map<string, { date: string; entregue: number; total: number }>();
    for (const r of filteredRows) {
      const cur = map.get(r.date) || { date: r.date, entregue: 0, total: 0 };
      cur.total += 1;
      if (r.status === "ENTREGUE") cur.entregue += 1;
      map.set(r.date, cur);
    }
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date)).map(d => ({
      ...d,
      label: formatDayMonth(d.date)
    }));
  }, [filteredRows]);

  const chartByStatus = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of filteredRows) map.set(r.status, (map.get(r.status) || 0) + 1);
    return Array.from(map.entries()).map(([name, value]) => ({
      name: name === "VAZIO" ? "Sem Info" : name,
      value
    }));
  }, [filteredRows]);

  const chartByPerson = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of filteredRows) if (r.status === "ENTREGUE") map.set(r.person, (map.get(r.person) || 0) + 1);
    return Array.from(map.entries()).map(([person, entregue]) => ({ person, entregue }))
      .sort((a, b) => b.entregue - a.entregue).slice(0, 10);
  }, [filteredRows]);

  const chartByTeam = useMemo(() => {
    const map = new Map<string, { team: string; entregue: number; total: number }>();
    for (const r of filteredRows) {
      const team = r.team || "GERAL";
      const cur = map.get(team) || { team, entregue: 0, total: 0 };
      cur.total += 1;
      if (r.status === "ENTREGUE") cur.entregue += 1;
      map.set(team, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.entregue - a.entregue);
  }, [filteredRows]);

  // Matrix data
  const { days, people, statusMap } = useMemo(() => {
    const daysSet = new Set<string>();
    const peopleSet = new Set<string>();
    const map = new Map<string, { status: string; team: string }>();
    for (const r of filteredRows) {
      daysSet.add(r.date);
      peopleSet.add(r.person);
      map.set(`${r.person}|${r.date}`, { status: r.status, team: r.team || "GERAL" });
    }
    return {
      days: Array.from(daysSet).sort(),
      people: Array.from(peopleSet).sort(),
      statusMap: map,
    };
  }, [filteredRows]);

  // Handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { importFile(file); e.target.value = ""; }
  };

  const clearFilters = () => {
    setPersonFilter("ALL");
    setStatusFilter("ALL");
    setTeamFilter("ALL");
    setDateRange({ from: undefined, to: undefined });
  };

  const hasActiveFilters = personFilter !== "ALL" || statusFilter !== "ALL" || teamFilter !== "ALL" || dateRange.from || dateRange.to;

  const handleExportPDF = async () => {
    if (!dashboardRef.current) return;
    setExporting(true);
    try {
      await exportDashboardToPDF({
        element: dashboardRef.current,
        datasetName: currentDataset?.name || "Dashboard",
        filters: { team: teamFilter, person: personFilter, status: statusFilter, dateFrom: dateRange.from, dateTo: dateRange.to },
      });
      toast({ title: "PDF exportado!" });
    } catch { toast({ title: "Erro ao exportar PDF", variant: "destructive" }); }
    finally { setExporting(false); }
  };

  const handleExportExcel = () => {
    if (!currentDataset) return;
    try {
      exportToExcel({
        dataset: currentDataset,
        filters: { team: teamFilter, person: personFilter, status: statusFilter, dateFrom: dateRange.from, dateTo: dateRange.to },
      });
      toast({ title: "Excel exportado!" });
    } catch { toast({ title: "Erro ao exportar Excel", variant: "destructive" }); }
  };

  React.useEffect(() => { clearFilters(); }, [currentDataset?.id]);

  const formatDateRange = () => {
    if (!dateRange.from && !dateRange.to) return "Período";
    if (dateRange.from && !dateRange.to) return format(dateRange.from, "dd/MM/yy", { locale: ptBR });
    if (dateRange.from && dateRange.to) return `${format(dateRange.from, "dd/MM", { locale: ptBR })} - ${format(dateRange.to, "dd/MM/yy", { locale: ptBR })}`;
    return "Período";
  };

  // ========== RENDER ==========
  return (
    <div className="flex h-screen w-full" style={{ background: "#F5F7FB" }}>
      
      {/* ========== LEFT SIDEBAR (280px) ========== */}
      <aside className="w-[280px] shrink-0 bg-white border-r flex flex-col h-full shadow-sm">
        {/* Logo */}
        <div className="p-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-sm text-gray-800">DASHBOARD RDA</h1>
              <p className="text-xs text-gray-500">Excel → Interativo</p>
            </div>
          </div>
        </div>

        {/* Import Button */}
        <div className="p-4 border-b">
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} className="hidden" />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-blue-600 text-white font-semibold text-sm hover:opacity-90 transition-all shadow-md"
          >
            <Upload className="w-4 h-4" />
            Importar Excel/CSV
          </button>
        </div>

        {/* Saved Files */}
        <div className="p-4 border-b flex-1 overflow-auto">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-3 font-medium">
            <Database className="w-3 h-3" />
            ARQUIVOS SALVOS
          </div>
          {datasets.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Nenhum arquivo</p>
          ) : (
            <div className="space-y-2">
              {datasets.map((ds) => (
                <div
                  key={ds.id}
                  onClick={() => selectDataset(ds.id)}
                  className={`group flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all text-sm ${
                    currentDataset?.id === ds.id ? "bg-blue-50 border border-blue-200" : "hover:bg-gray-50 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <FileSpreadsheet className="w-4 h-4 text-gray-500 shrink-0" />
                    <span className="truncate text-gray-700">{ds.name}</span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeDataset(ds.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded transition-all"
                  >
                    <Trash2 className="w-3 h-3 text-red-500" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Filters */}
        {currentDataset && (
          <div className="p-4 border-b space-y-3 overflow-auto">
            <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
              <Settings className="w-3 h-3" />
              FILTROS
            </div>

            {/* Period */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Período</label>
              <div className="flex gap-1">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="flex-1 justify-start text-left h-9 text-xs">
                      <CalendarIcon className="mr-1 h-3 w-3" />
                      {formatDateRange()}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="range"
                      selected={{ from: dateRange.from, to: dateRange.to }}
                      onSelect={(range) => setDateRange({ from: range?.from, to: range?.to })}
                      disabled={(date) => {
                        if (!availableDateRange.min || !availableDateRange.max) return false;
                        return date < availableDateRange.min || date > availableDateRange.max;
                      }}
                      defaultMonth={availableDateRange.min || new Date()}
                      locale={ptBR}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                {(dateRange.from || dateRange.to) && (
                  <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => setDateRange({ from: undefined, to: undefined })}>
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>

            {/* Team */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Equipe</label>
              <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-300">
                <option value="ALL">Todas</option>
                {teamList.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {/* Person */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Pessoa</label>
              <select value={personFilter} onChange={(e) => setPersonFilter(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-300">
                <option value="ALL">Todas</option>
                {peopleList.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Status</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-300">
                <option value="ALL">Todos</option>
                {statusList.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            PWA Offline Ready
          </div>
        </div>
      </aside>

      {/* ========== CENTER CONTENT ========== */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : !currentDataset ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center shadow-2xl">
                <Upload className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Importe um Excel</h2>
              <p className="text-gray-500">Faça upload de uma planilha para visualizar o dashboard interativo</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <header className="h-14 bg-white border-b flex items-center justify-between px-4 shrink-0 shadow-sm">
              <div className="flex items-center gap-3">
                <h2 className="font-bold text-lg text-gray-800 tracking-tight">CONTROLE DE ENTREGA DE RDA</h2>
                <span className="text-xs font-semibold text-white bg-blue-600 px-3 py-1 rounded-full">{filteredRows.length} registros</span>
                {hasActiveFilters && (
                  <button onClick={clearFilters} className="text-xs text-blue-600 hover:underline">Limpar Filtros</button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-2 text-xs">
                  <FileSpreadsheet className="w-4 h-4" />
                  Excel
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={exporting} className="gap-2 text-xs">
                  <FileDown className="w-4 h-4" />
                  PDF
                </Button>
              </div>
            </header>

            {/* Dashboard Content */}
            <div ref={dashboardRef} className="flex-1 overflow-auto p-4 space-y-4">
              {/* KPI Cards */}
              <div className="grid grid-cols-6 gap-3">
                <KPICard icon={<TrendingUp className="w-5 h-5 text-emerald-600" />} title="Taxa de Entrega" value={`${kpis.taxa}%`} color="border-emerald-300" />
                <KPICard icon={<CheckCircle className="w-5 h-5 text-green-600" />} title="Total Entregue" value={kpis.entregue} color="border-green-300" />
                <KPICard icon={<AlertCircle className="w-5 h-5 text-red-500" />} title="Pendentes" value={kpis.vazio} color="border-red-300" />
                <KPICard icon={<Coffee className="w-5 h-5 text-orange-500" />} title="Folgas" value={kpis.folga} color="border-orange-300" />
                <KPICard icon={<Clock className="w-5 h-5 text-blue-500" />} title="Banco de Horas" value={kpis.banco} color="border-blue-300" />
                <KPICard icon={<Users className="w-5 h-5 text-purple-500" />} title="Pessoas" value={kpis.pessoas} color="border-purple-300" />
              </div>

              {/* Charts Row 1 */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 bg-white rounded-2xl shadow-sm border p-4">
                  <h3 className="font-semibold text-sm text-gray-700 mb-3">Entregas por Dia</h3>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartByDay}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <RechartsTooltip />
                        <Line type="monotone" dataKey="entregue" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="bg-white rounded-2xl shadow-sm border p-4">
                  <h3 className="font-semibold text-sm text-gray-700 mb-3">Distribuição por Status</h3>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={chartByStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                          {chartByStatus.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                        </Pie>
                        <RechartsTooltip />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Charts Row 2 */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl shadow-sm border p-4">
                  <h3 className="font-semibold text-sm text-gray-700 mb-3">Ranking por Pessoa (Top 10)</h3>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart layout="vertical" data={chartByPerson}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis type="number" tick={{ fontSize: 10 }} />
                        <YAxis dataKey="person" type="category" width={80} tick={{ fontSize: 9 }} />
                        <RechartsTooltip />
                        <Bar dataKey="entregue" fill="#22c55e" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="bg-white rounded-2xl shadow-sm border p-4">
                  <h3 className="font-semibold text-sm text-gray-700 mb-3">Entregas por Equipe</h3>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartByTeam}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="team" tick={{ fontSize: 9 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <RechartsTooltip />
                        <Bar dataKey="entregue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="bg-white rounded-2xl shadow-sm border p-4">
                  <h3 className="font-semibold text-sm text-gray-700 mb-3">Comparação de Equipes (Taxa %)</h3>
                  <div className="space-y-2 overflow-auto max-h-48">
                    {chartByTeam.map((t) => {
                      const taxa = t.total > 0 ? Math.round((t.entregue / t.total) * 100) : 0;
                      return (
                        <div key={t.team} className="flex items-center gap-2">
                          <span className="text-xs text-gray-600 w-20 truncate">{t.team}</span>
                          <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full" style={{ width: `${taxa}%` }} />
                          </div>
                          <span className="text-xs font-semibold text-gray-700 w-16 text-right">{taxa}% ({t.entregue}/{t.total})</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      {/* ========== RIGHT MATRIX PANEL (520px) ========== */}
      {currentDataset && (
        <aside className="w-[520px] shrink-0 bg-white border-l flex flex-col h-full shadow-sm">
          {/* Matrix Header */}
          <div className="px-4 py-3 border-b bg-gray-50 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-sm text-gray-800">Matriz Pessoa × Dia</h3>
              <div className="flex items-center gap-2 text-[10px]">
                <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 font-semibold">ENT</span>
                <span className="px-2 py-1 rounded-full bg-orange-100 text-orange-700 font-semibold">FOL</span>
                <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-semibold">BAN</span>
                <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-400 font-semibold">-</span>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              <span className="font-medium">{people.length}</span> pessoas • <span className="font-medium">{days.length}</span> dias • <span className="font-medium">{filteredRows.length}</span> registros
            </p>
          </div>

          {/* Matrix Table */}
          <TooltipProvider delayDuration={100}>
            <div className="flex-1 overflow-auto">
              {days.length === 0 || people.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-400 text-sm">Nenhum dado</div>
              ) : (
                <div style={{ minWidth: 160 + days.length * 48 }}>
                  {/* Header Row */}
                  <div className="sticky top-0 z-20 flex bg-white border-b shadow-sm">
                    <div className="sticky left-0 z-30 w-40 min-w-40 px-3 py-2 bg-gray-100 border-r font-semibold text-xs text-gray-700">
                      Colaborador
                    </div>
                    {days.map((day) => (
                      <div key={day} className="w-12 min-w-12 px-1 py-2 text-center text-[10px] font-medium text-gray-600 bg-gray-50 border-r">
                        {formatDayMonth(day)}
                      </div>
                    ))}
                  </div>

                  {/* Data Rows */}
                  {people.map((person) => (
                    <div key={person} className="flex border-b hover:bg-gray-50/50" style={{ height: 36 }}>
                      {/* Person Name */}
                      <div className="sticky left-0 z-10 w-40 min-w-40 px-3 flex items-center bg-white border-r">
                        <span className="text-xs font-medium text-gray-800 truncate" title={person}>{person}</span>
                      </div>

                      {/* Status Cells */}
                      {days.map((day) => {
                        const key = `${person}|${day}`;
                        const data = statusMap.get(key);
                        const status = data?.status || "VAZIO";
                        const team = data?.team || "-";
                        const chip = STATUS_CHIPS[status] || STATUS_CHIPS["VAZIO"];

                        return (
                          <Tooltip key={day}>
                            <TooltipTrigger asChild>
                              <div className="w-12 min-w-12 flex items-center justify-center border-r">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold cursor-default transition-transform hover:scale-110 ${chip.bg} ${chip.text}`}>
                                  {chip.label}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs bg-gray-900 text-white border-0">
                              <p><span className="text-gray-400">Pessoa:</span> {person}</p>
                              <p><span className="text-gray-400">Data:</span> {formatDayMonth(day)}</p>
                              <p><span className="text-gray-400">Status:</span> {status === "VAZIO" ? "Sem Info" : status}</p>
                              <p><span className="text-gray-400">Equipe:</span> {team}</p>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TooltipProvider>
        </aside>
      )}
    </div>
  );
}

// Simple KPI Card Component
function KPICard({ icon, title, value, color }: { icon: React.ReactNode; title: string; value: string | number; color: string }) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border-l-4 ${color} p-4`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-gray-500 font-medium">{title}</span>
      </div>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
    </div>
  );
}
