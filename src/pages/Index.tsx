import React, { useState, useMemo } from "react";
import { Download, LayoutGrid, Table2, Grid3X3 } from "lucide-react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { SpreadsheetView } from "@/components/dashboard/SpreadsheetView";
import { MatrixTable } from "@/components/dashboard/MatrixTable";
import { useDatasets } from "@/hooks/useDatasets";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

type ViewMode = "dashboard" | "split" | "matrix";

export default function Index() {
  const {
    datasets,
    currentDataset,
    loading,
    importFile,
    selectDataset,
    removeDataset,
  } = useDatasets();

  const [personFilter, setPersonFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [teamFilter, setTeamFilter] = useState("ALL");
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [viewMode, setViewMode] = useState<ViewMode>("split");

  // Get available date range from dataset
  const availableDateRange = useMemo(() => {
    if (!currentDataset || currentDataset.rows.length === 0) return { min: undefined, max: undefined };
    const dates = currentDataset.rows.map(r => r.date).sort();
    return { 
      min: new Date(dates[0]), 
      max: new Date(dates[dates.length - 1]) 
    };
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

  React.useEffect(() => {
    setPersonFilter("ALL");
    setStatusFilter("ALL");
    setTeamFilter("ALL");
    setDateRange({ from: undefined, to: undefined });
  }, [currentDataset?.id]);

  const peopleList = useMemo(() => {
    if (!currentDataset) return [];
    let people = currentDataset.people;
    if (teamFilter !== "ALL") {
      const teamPeople = new Set(
        currentDataset.rows.filter((r) => r.team === teamFilter).map((r) => r.person)
      );
      people = people.filter((p) => teamPeople.has(p));
    }
    return people;
  }, [currentDataset, teamFilter]);

  const statusList = useMemo(() => currentDataset?.statuses || [], [currentDataset]);
  const teamList = useMemo(() => currentDataset?.teams || [], [currentDataset]);

  const clearFilters = () => {
    setPersonFilter("ALL");
    setStatusFilter("ALL");
    setTeamFilter("ALL");
    setDateRange({ from: undefined, to: undefined });
  };

  const hasActiveFilters = personFilter !== "ALL" || statusFilter !== "ALL" || teamFilter !== "ALL" || dateRange.from || dateRange.to;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        datasets={datasets}
        currentDataset={currentDataset}
        onImport={importFile}
        onSelectDataset={selectDataset}
        onDeleteDataset={removeDataset}
        personFilter={personFilter}
        setPersonFilter={setPersonFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        teamFilter={teamFilter}
        setTeamFilter={setTeamFilter}
        dateRange={dateRange}
        setDateRange={setDateRange}
        availableDateRange={availableDateRange}
        peopleList={peopleList}
        statusList={statusList}
        teamList={teamList}
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 border-b bg-card flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="font-bold text-lg tracking-tight">
              {currentDataset ? "CONTROLE DE ENTREGA DE RDA" : "Dashboard RDA"}
            </h2>
            {currentDataset && (
              <span className="text-xs font-semibold text-primary-foreground bg-primary px-2 py-1 rounded-full">
                {filteredRows.length} registros
              </span>
            )}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs h-7">
                Limpar Filtros
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-muted rounded-lg p-1">
              <button
                onClick={() => setViewMode("dashboard")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                  viewMode === "dashboard" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Dashboard
              </button>
              <button
                onClick={() => setViewMode("split")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                  viewMode === "split" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Table2 className="w-3.5 h-3.5" />
                + Planilha
              </button>
              <button
                onClick={() => setViewMode("matrix")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                  viewMode === "matrix" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Grid3X3 className="w-3.5 h-3.5" />
                Matriz
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : !currentDataset ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md">
                <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-2xl">
                  <Download className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Importe um Excel</h2>
                <p className="text-muted-foreground">Faça upload de uma planilha Excel para visualizar em dashboard interativo. Funciona offline!</p>
              </div>
            </div>
          ) : viewMode === "dashboard" ? (
            <DashboardView 
              dataset={currentDataset} 
              personFilter={personFilter} 
              statusFilter={statusFilter} 
              teamFilter={teamFilter} 
              dateRange={dateRange} 
            />
          ) : viewMode === "split" ? (
            <div className="grid grid-cols-2 h-full">
              <div className="border-r overflow-hidden">
                <DashboardView 
                  dataset={currentDataset} 
                  personFilter={personFilter} 
                  statusFilter={statusFilter} 
                  teamFilter={teamFilter} 
                  dateRange={dateRange} 
                />
              </div>
              <div className="overflow-hidden bg-card">
                <SpreadsheetView 
                  dataset={currentDataset} 
                  personFilter={personFilter} 
                  statusFilter={statusFilter} 
                  teamFilter={teamFilter} 
                  dateRange={dateRange} 
                />
              </div>
            </div>
          ) : (
            <div className="h-full p-4">
              <MatrixTable rows={filteredRows} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
