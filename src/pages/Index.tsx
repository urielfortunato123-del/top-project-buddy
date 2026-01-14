import React, { useState, useMemo } from "react";
import { Download } from "lucide-react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { MatrixTable } from "@/components/dashboard/MatrixTable";
import { SpreadsheetView } from "@/components/dashboard/SpreadsheetView";
import { ViewTabs } from "@/components/dashboard/ViewTabs";
import { useDatasets } from "@/hooks/useDatasets";
import { Button } from "@/components/ui/button";
import type { DateRange } from "@/lib/dateRange";

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
  const [activeTab, setActiveTab] = useState<"dashboard" | "planilha">("dashboard");

  // Get available date range from dataset
  const availableDateRange = useMemo(() => {
    if (!currentDataset || currentDataset.rows.length === 0) return { min: undefined, max: undefined };
    const dateCol = currentDataset.detectedDateColumn;
    if (!dateCol) return { min: undefined, max: undefined };
    
    const dates = currentDataset.rows
      .map(r => r[dateCol])
      .filter(d => d && typeof d === "string")
      .sort();
    
    if (dates.length === 0) return { min: undefined, max: undefined };
    return { 
      min: new Date(dates[0]), 
      max: new Date(dates[dates.length - 1]) 
    };
  }, [currentDataset]);

  // Filtered data
  const filteredRows = useMemo(() => {
    if (!currentDataset) return [];
    let data = [...currentDataset.rows];
    const dateCol = currentDataset.detectedDateColumn;
    
    if (dateCol && dateRange.from) {
      const fromStr = dateRange.from.toISOString().slice(0, 10);
      data = data.filter((r) => r[dateCol] >= fromStr);
    }
    if (dateCol && dateRange.to) {
      const toStr = dateRange.to.toISOString().slice(0, 10);
      data = data.filter((r) => r[dateCol] <= toStr);
    }
    
    // Filtros de categoria baseados nas colunas detectadas
    const catCols = currentDataset.detectedCategoryColumns;
    if (teamFilter !== "ALL" && catCols[0]) {
      data = data.filter((r) => r[catCols[0]] === teamFilter);
    }
    if (personFilter !== "ALL" && catCols[1]) {
      data = data.filter((r) => r[catCols[1]] === personFilter);
    }
    if (statusFilter !== "ALL" && catCols[2]) {
      data = data.filter((r) => r[catCols[2]] === statusFilter);
    }
    
    return data;
  }, [currentDataset, personFilter, statusFilter, teamFilter, dateRange]);

  React.useEffect(() => {
    setPersonFilter("ALL");
    setStatusFilter("ALL");
    setTeamFilter("ALL");
    setDateRange({ from: undefined, to: undefined });
  }, [currentDataset?.id]);

  // Listas dinâmicas baseadas nas colunas de categoria
  const { peopleList, statusList, teamList } = useMemo(() => {
    if (!currentDataset || !currentDataset.summary) return { peopleList: [], statusList: [], teamList: [] };
    
    const catCols = currentDataset.detectedCategoryColumns || [];
    const counts = currentDataset.summary.categoryCounts || {};
    
    return {
      teamList: catCols[0] && counts[catCols[0]] ? Object.keys(counts[catCols[0]]) : [],
      peopleList: catCols[1] && counts[catCols[1]] ? Object.keys(counts[catCols[1]]) : [],
      statusList: catCols[2] && counts[catCols[2]] ? Object.keys(counts[catCols[2]]) : [],
    };
  }, [currentDataset]);

  const clearFilters = () => {
    setPersonFilter("ALL");
    setStatusFilter("ALL");
    setTeamFilter("ALL");
    setDateRange({ from: undefined, to: undefined });
  };

  const hasActiveFilters = personFilter !== "ALL" || statusFilter !== "ALL" || teamFilter !== "ALL" || dateRange.from || dateRange.to;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#F5F7FB" }}>
      {/* LEFT: Sidebar */}
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

      {/* CENTER: Dashboard */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
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
              <h2 className="text-2xl font-bold mb-2">Importe sua Planilha</h2>
              <p className="text-muted-foreground">Faça upload de qualquer arquivo Excel ou CSV para visualizar em um dashboard interativo automático!</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <header className="h-14 border-b bg-white flex items-center justify-between px-4 shrink-0 shadow-sm">
              <div className="flex items-center gap-4">
                <h2 className="font-bold text-lg tracking-tight text-gray-800">
                  {currentDataset.name}
                </h2>
                <span className="text-xs font-semibold text-white bg-primary px-3 py-1 rounded-full">
                  {filteredRows.length} registros
                </span>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs h-7">
                    Limpar Filtros
                  </Button>
                )}
              </div>
              
              {/* Tab Switcher */}
              <ViewTabs value={activeTab} onChange={setActiveTab} />
            </header>

            {/* Content based on active tab */}
            {activeTab === "dashboard" ? (
              <div className="flex-1 overflow-hidden">
                <DashboardView 
                  dataset={currentDataset} 
                  personFilter={personFilter} 
                  statusFilter={statusFilter} 
                  teamFilter={teamFilter} 
                  dateRange={dateRange} 
                />
              </div>
            ) : (
              <SpreadsheetView dataset={currentDataset} />
            )}
          </>
        )}
      </main>

      {/* RIGHT: Matrix Panel - Only show in Dashboard view if we have category data */}
      {currentDataset && activeTab === "dashboard" && currentDataset.detectedCategoryColumns.length >= 2 && (
        <aside className="w-[520px] shrink-0 border-l bg-white overflow-hidden flex flex-col shadow-sm">
          <MatrixTable 
            rows={filteredRows} 
            rowColumn={currentDataset.detectedCategoryColumns[1] || currentDataset.detectedCategoryColumns[0]}
            colColumn={currentDataset.detectedDateColumn || currentDataset.detectedCategoryColumns[0]}
            valueColumn={currentDataset.detectedCategoryColumns[0]}
          />
        </aside>
      )}
    </div>
  );
}
