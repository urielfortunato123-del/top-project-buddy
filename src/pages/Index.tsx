import React, { useState, useMemo } from "react";
import { Search, Download, Maximize2 } from "lucide-react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { SpreadsheetView } from "@/components/dashboard/SpreadsheetView";
import { useDatasets } from "@/hooks/useDatasets";
import { cn } from "@/lib/utils";

export interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

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
  const [splitView, setSplitView] = useState(true);

  // Get available date range from dataset
  const availableDateRange = useMemo(() => {
    if (!currentDataset || currentDataset.rows.length === 0) return { min: undefined, max: undefined };
    const dates = currentDataset.rows.map(r => r.date).sort();
    return { 
      min: new Date(dates[0]), 
      max: new Date(dates[dates.length - 1]) 
    };
  }, [currentDataset]);

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
            <h2 className="font-bold text-lg">{currentDataset ? currentDataset.name : "Dashboard RDA"}</h2>
            {currentDataset && (
              <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                {currentDataset.rows.length} registros
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted border">
              <Search className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{splitView ? "Dashboard + Planilha" : "Dashboard"}</span>
            </div>
            <button
              onClick={() => setSplitView(!splitView)}
              className={cn("p-2 rounded-lg transition-colors", splitView ? "bg-primary/20 text-primary" : "bg-muted")}
            >
              <Maximize2 className="w-4 h-4" />
            </button>
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
          ) : splitView ? (
            <div className="grid grid-cols-2 h-full">
              <div className="border-r overflow-hidden">
                <DashboardView dataset={currentDataset} personFilter={personFilter} statusFilter={statusFilter} teamFilter={teamFilter} dateRange={dateRange} />
              </div>
              <div className="overflow-hidden bg-card">
                <SpreadsheetView dataset={currentDataset} personFilter={personFilter} statusFilter={statusFilter} teamFilter={teamFilter} dateRange={dateRange} />
              </div>
            </div>
          ) : (
            <DashboardView dataset={currentDataset} personFilter={personFilter} statusFilter={statusFilter} teamFilter={teamFilter} dateRange={dateRange} />
          )}
        </div>
      </main>
    </div>
  );
}
