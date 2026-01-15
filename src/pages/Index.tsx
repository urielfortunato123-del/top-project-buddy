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
import type { GenericRow, MatrixConfig } from "@/lib/database";
import { saveDataset } from "@/lib/database";

const STATUS_PATTERN = /^(ENT|FOL|BAN|FAL|ATE|FER|ENTREGUE?|FOLGA?|FALTA?|ATESTADO?|FER[IÉ]AS?|BANCO( DE HORAS)?|VAZIO|-)$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}|^\d{2}\/\d{2}\/\d{4}/;

function isStatusLike(v: unknown): boolean {
  const s = String(v ?? "").trim();
  if (!s) return true;
  return STATUS_PATTERN.test(s);
}

function isDateLike(v: unknown): boolean {
  const s = String(v ?? "").trim();
  if (!s) return false;
  return DATE_PATTERN.test(s);
}

// Detecta a coluna que contém nomes de pessoas
// Prioriza colunas com: muitos valores únicos, sem datas, sem status
function findBestPersonColumn(categoryColumns: string[], domainRows: GenericRow[]): string {
  const cols = categoryColumns.filter(Boolean);
  if (cols.length === 0) return "";

  let bestCol = cols[0];
  let bestScore = -1;

  const sample = domainRows.slice(0, 5000);

  for (const colName of cols) {
    const unique = new Set<string>();
    let dateCount = 0;
    let statusCount = 0;
    let total = 0;

    for (const r of sample) {
      const raw = r[colName];
      const s = String(raw ?? "").trim();
      if (!s) continue;
      
      total += 1;
      
      // Se for data, pula essa coluna
      if (isDateLike(s)) {
        dateCount += 1;
        continue;
      }
      
      // Se for status, também marca
      if (isStatusLike(s)) {
        statusCount += 1;
        continue;
      }
      
      unique.add(s);
    }

    // Colunas com muitas datas não são de pessoas
    if (total > 0 && dateCount / total > 0.3) continue;
    
    // Colunas com muitos status não são de pessoas
    if (total > 0 && statusCount / total > 0.5) continue;

    // Score = quantidade de valores únicos não-status/data
    const score = unique.size;
    if (score > bestScore) {
      bestScore = score;
      bestCol = colName;
    }
  }

  return bestCol;
}

// Detecta a coluna que contém status (alta proporção de valores tipo status)
function findStatusColumn(categoryColumns: string[], domainRows: GenericRow[]): string | null {
  const cols = categoryColumns.filter(Boolean);
  if (cols.length === 0) return null;

  const sample = domainRows.slice(0, 5000);

  let bestCol: string | null = null;
  let bestRatio = 0;

  for (const colName of cols) {
    let total = 0;
    let statusLike = 0;

    for (const r of sample) {
      const raw = r[colName];
      const s = String(raw ?? "").trim();
      if (!s) continue;
      
      // Ignora colunas que parecem datas
      if (isDateLike(s)) continue;
      
      total += 1;
      if (isStatusLike(s)) statusLike += 1;
    }

    if (total === 0) continue;
    const ratio = statusLike / total;

    if (ratio > bestRatio) {
      bestRatio = ratio;
      bestCol = colName;
    }
  }

  return bestRatio >= 0.25 ? bestCol : null;
}

// Detecta a melhor coluna de data
function findDateColumn(categoryColumns: string[], domainRows: GenericRow[], detectedDateColumn?: string): string {
  if (detectedDateColumn) return detectedDateColumn;
  
  const cols = categoryColumns.filter(Boolean);
  if (cols.length === 0) return "";

  const sample = domainRows.slice(0, 1000);

  for (const colName of cols) {
    let dateCount = 0;
    let total = 0;

    for (const r of sample) {
      const raw = r[colName];
      const s = String(raw ?? "").trim();
      if (!s) continue;
      total += 1;
      if (isDateLike(s)) dateCount += 1;
    }

    if (total > 0 && dateCount / total > 0.5) {
      return colName;
    }
  }

  return cols[0];
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
  const safeTextColumns = activeDataset?.detectedTextColumns ?? [];

  const matrixCandidateColumns = useMemo(() => {
    return Array.from(new Set([...(safeCategoryColumns || []), ...(safeTextColumns || [])])).filter(Boolean);
  }, [safeCategoryColumns, safeTextColumns]);

  // Colunas efetivas usadas pelos filtros (tenta acertar Pessoa/Status/Equipe mesmo quando a ordem detectada muda)
  const filterColumns = useMemo(() => {
    if (!activeDataset) return { teamCol: "", personCol: "", statusCol: "" };

    const candidates = matrixCandidateColumns;

    const statusCol = findStatusColumn(candidates, safeRows) || "";
    const personCol = findBestPersonColumn(candidates, safeRows) || "";

    // Equipe: primeira coluna candidata que não seja pessoa/status e não pareça data
    const dateCol = findDateColumn(candidates, safeRows, activeDataset.detectedDateColumn);

    const teamCol =
      candidates.find((c) => c && c !== personCol && c !== statusCol && c !== dateCol) ||
      safeCategoryColumns.find((c) => c && c !== personCol && c !== statusCol) ||
      "";

    return { teamCol, personCol, statusCol };
  }, [activeDataset, matrixCandidateColumns, safeRows, safeCategoryColumns]);

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
      .map((r) => r[dateCol])
      .filter((d) => d && typeof d === "string")
      .sort();

    if ((dates?.length ?? 0) === 0) return { min: undefined, max: undefined };
    return {
      min: new Date(dates[0]),
      max: new Date(dates[(dates?.length ?? 1) - 1]),
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

    // Filtros por colunas detectadas (mais robusto do que usar índices fixos)
    if (teamFilter !== "ALL" && filterColumns.teamCol) {
      data = data.filter((r) => r[filterColumns.teamCol] === teamFilter);
    }
    if (personFilter !== "ALL" && filterColumns.personCol) {
      data = data.filter((r) => r[filterColumns.personCol] === personFilter);
    }
    if (statusFilter !== "ALL" && filterColumns.statusCol) {
      data = data.filter((r) => r[filterColumns.statusCol] === statusFilter);
    }

    return data;
  }, [activeDataset, safeRows, personFilter, statusFilter, teamFilter, dateRange, filterColumns]);

  React.useEffect(() => {
    setPersonFilter("ALL");
    setStatusFilter("ALL");
    setTeamFilter("ALL");
    setDateRange({ from: undefined, to: undefined });
  }, [activeDataset?.id]);

  // Listas dinâmicas baseadas nas colunas dos filtros
  const { peopleList, statusList, teamList } = useMemo(() => {
    if (!activeDataset || !activeDataset.summary) return { peopleList: [], statusList: [], teamList: [] };

    const counts = activeDataset.summary.categoryCounts || {};

    const teamCounts = filterColumns.teamCol ? counts[filterColumns.teamCol] : undefined;
    const personCounts = filterColumns.personCol ? counts[filterColumns.personCol] : undefined;
    const statusCounts = filterColumns.statusCol ? counts[filterColumns.statusCol] : undefined;

    const toSortedKeys = (obj?: Record<string, number>) => (obj ? Object.keys(obj).sort((a, b) => a.localeCompare(b, "pt-BR")) : []);

    return {
      teamList: toSortedKeys(teamCounts),
      peopleList: toSortedKeys(personCounts),
      statusList: toSortedKeys(statusCounts),
    };
  }, [activeDataset, filterColumns]);

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
      {activeDataset && activeTab === "dashboard" && (matrixCandidateColumns?.length ?? 0) >= 1 && (
        <aside className="w-[520px] shrink-0 border-l bg-white overflow-hidden flex flex-col shadow-sm">
          <MatrixTable 
            rows={filteredRows}
            domainRows={activeDataset.rows}
            rowColumn={activeDataset.matrixConfig?.rowColumn || findBestPersonColumn(matrixCandidateColumns, activeDataset.rows)}
            colColumn={activeDataset.matrixConfig?.colColumn || findDateColumn(matrixCandidateColumns, activeDataset.rows, activeDataset.detectedDateColumn)}
            valueColumn={activeDataset.matrixConfig?.valueColumn || findStatusColumn(matrixCandidateColumns, activeDataset.rows) || matrixCandidateColumns[0]}
            availableColumns={activeDataset.columns?.map(c => typeof c === 'string' ? c : c.name) || []}
            onColumnsChange={async (row, col, value) => {
              const newConfig: MatrixConfig = { rowColumn: row, colColumn: col, valueColumn: value };
              const updated = { ...activeDataset, matrixConfig: newConfig, updatedAt: new Date().toISOString() };
              await saveDataset(updated);
              updateDataset(updated);
            }}
          />
        </aside>
      )}
    </div>
  );
}
