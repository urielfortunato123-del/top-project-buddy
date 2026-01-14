import React, { useState, useMemo } from "react";
import { Download, Edit3 } from "lucide-react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { MatrixTable } from "@/components/dashboard/MatrixTable";
import { SpreadsheetView } from "@/components/dashboard/SpreadsheetView";
import { ViewTabs } from "@/components/dashboard/ViewTabs";
import { DatasetSelect } from "@/components/dashboard/DatasetSelect";
import { useDatasets } from "@/hooks/useDatasets";
import { Button } from "@/components/ui/button";
import type { DateRange } from "@/lib/dateRange";

// Detecta a coluna que contém nomes de pessoas (mais valores únicos que não são status)
function findBestPersonColumn(
  categoryColumns: string[],
  categoryCounts: Record<string, Record<string, number>>
): string {
  const statusPattern = /^(ENT|FOL|BAN|FAL|ATE|FER|ENTREGUE?|FOLGA?|FALTA?|ATESTADO?|FER[IÉ]AS?|BANCO|VAZIO|-)$/i;
  
  let bestCol = categoryColumns[0] || "";
  let maxNonStatusValues = 0;
  
  for (const colName of categoryColumns) {
    const counts = categoryCounts[colName];
    if (!counts) continue;
    
    const values = Object.keys(counts);
    const nonStatusValues = values.filter(v => !statusPattern.test(v.trim()));
    
    if (nonStatusValues.length > maxNonStatusValues) {
      maxNonStatusValues = nonStatusValues.length;
      bestCol = colName;
    }
  }
  
  return bestCol;
}

// Detecta a coluna que contém status
function findStatusColumn(
  categoryColumns: string[],
  categoryCounts: Record<string, Record<string, number>>
): string | null {
  const statusPattern = /^(ENT|FOL|BAN|FAL|ATE|FER|ENTREGUE?|FOLGA?|FALTA?|ATESTADO?|FER[IÉ]AS?|BANCO|VAZIO|-)$/i;
  
  for (const colName of categoryColumns) {
    const counts = categoryCounts[colName];
    if (!counts) continue;
    
    const values = Object.keys(counts);
    const statusValues = values.filter(v => statusPattern.test(v.trim()));
    
    // Se mais da metade dos valores são status, é provavelmente a coluna de status
    if (statusValues.length > values.length * 0.3) {
      return colName;
    }
  }
  
  return null;
}

export default function Index() {
  const {
    datasets,
    currentDataset,
    loading,
    importFile,
    selectDataset,
    removeDataset,
    updateDataset,
  } = useDatasets();

  // Safe defaults
  const safeDatasets = datasets ?? [];
  const activeDataset = currentDataset ?? safeDatasets[0] ?? null;
  const safeRows = activeDataset?.rows ?? [];
  const safeCategoryColumns = activeDataset?.detectedCategoryColumns ?? [];

  const [personFilter, setPersonFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [teamFilter, setTeamFilter] = useState("ALL");
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [activeTab, setActiveTab] = useState<"dashboard" | "planilha">("planilha");

  // Get available date range from dataset
  const availableDateRange = useMemo(() => {
    if (!activeDataset || (safeRows.length ?? 0) === 0) return { min: undefined, max: undefined };
    const dateCol = activeDataset.detectedDateColumn;
    if (!dateCol) return { min: undefined, max: undefined };
    
    const dates = safeRows
      .map(r => r[dateCol])
      .filter(d => d && typeof d === "string")
      .sort();
    
    if ((dates?.length ?? 0) === 0) return { min: undefined, max: undefined };
    return { 
      min: new Date(dates[0]), 
      max: new Date(dates[(dates?.length ?? 1) - 1]) 
    };
  }, [activeDataset, safeRows]);

  // Filtered data
  const filteredRows = useMemo(() => {
    if (!activeDataset) return [];
    let data = [...safeRows];
    const dateCol = activeDataset.detectedDateColumn;
    
    if (dateCol && dateRange.from) {
      const fromStr = dateRange.from.toISOString().slice(0, 10);
      data = data.filter((r) => r[dateCol] >= fromStr);
    }
    if (dateCol && dateRange.to) {
      const toStr = dateRange.to.toISOString().slice(0, 10);
      data = data.filter((r) => r[dateCol] <= toStr);
    }
    
    // Filtros de categoria baseados nas colunas detectadas
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
  }, [activeDataset, safeRows, safeCategoryColumns, personFilter, statusFilter, teamFilter, dateRange]);

  React.useEffect(() => {
    setPersonFilter("ALL");
    setStatusFilter("ALL");
    setTeamFilter("ALL");
    setDateRange({ from: undefined, to: undefined });
  }, [activeDataset?.id]);

  // Listas dinâmicas baseadas nas colunas de categoria
  const { peopleList, statusList, teamList } = useMemo(() => {
    if (!activeDataset || !activeDataset.summary) return { peopleList: [], statusList: [], teamList: [] };
    
    const counts = activeDataset.summary.categoryCounts || {};
    
    return {
      teamList: safeCategoryColumns[0] && counts[safeCategoryColumns[0]] ? Object.keys(counts[safeCategoryColumns[0]]) : [],
      peopleList: safeCategoryColumns[1] && counts[safeCategoryColumns[1]] ? Object.keys(counts[safeCategoryColumns[1]]) : [],
      statusList: safeCategoryColumns[2] && counts[safeCategoryColumns[2]] ? Object.keys(counts[safeCategoryColumns[2]]) : [],
    };
  }, [activeDataset, safeCategoryColumns]);

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
        datasets={safeDatasets}
        currentDataset={activeDataset}
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
        ) : !activeDataset ? (
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
            <header className="h-14 border-b bg-card flex items-center justify-between px-4 shrink-0 shadow-sm">
              <div className="flex items-center gap-3 min-w-0">
                <DatasetSelect datasets={safeDatasets} valueId={activeDataset.id} onChange={selectDataset} />

                <span className="text-xs font-semibold bg-primary text-primary-foreground px-3 py-1 rounded-full shrink-0">
                  {filteredRows?.length ?? 0} registros
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
                  dataset={activeDataset} 
                  personFilter={personFilter} 
                  statusFilter={statusFilter} 
                  teamFilter={teamFilter} 
                  dateRange={dateRange} 
                />
              </div>
            ) : (
              <SpreadsheetView dataset={activeDataset} onDatasetUpdate={updateDataset} />
            )}
          </>
        )}
      </main>

      {/* RIGHT: Matrix Panel - Only show in Dashboard view if we have category data */}
      {activeDataset && activeTab === "dashboard" && (safeCategoryColumns?.length ?? 0) >= 1 && (
        <aside className="w-[520px] shrink-0 border-l bg-white overflow-hidden flex flex-col shadow-sm">
          <MatrixTable 
            rows={filteredRows}
            domainRows={activeDataset.rows}
            rowColumn={findBestPersonColumn(safeCategoryColumns, activeDataset.summary?.categoryCounts || {})}
            colColumn={activeDataset.detectedDateColumn || safeCategoryColumns[0]}
            valueColumn={findStatusColumn(safeCategoryColumns, activeDataset.summary?.categoryCounts || {}) || safeCategoryColumns[0]}
          />
        </aside>
      )}
    </div>
  );
}
