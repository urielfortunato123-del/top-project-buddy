import React, { useMemo, useRef, useState } from "react";
import type { Dataset } from "@/lib/database";
import type { DateRange } from "@/lib/dateRange";
import { cn } from "@/lib/utils";

interface SpreadsheetViewProps {
  dataset: Dataset;
  personFilter: string;
  statusFilter: string;
  teamFilter: string;
  dateRange: DateRange;
}

type Chip = "ENT" | "FOL" | "BAN" | "FAL" | "ATE" | "FER" | "-" | "";

function cellToText(v: any) {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function excelCol(i: number) {
  let n = i + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function detectChip(value: string): Chip {
  const v = value.trim().toUpperCase();
  if (!v) return "";
  if (v === "-" || v === "0") return "-";
  if (v.includes("ENT")) return "ENT";
  if (v.includes("FOL")) return "FOL";
  if (v.includes("BAN")) return "BAN";
  if (v.includes("FAL")) return "FAL";
  if (v.includes("ATE")) return "ATE";
  if (v.includes("FÉR") || v.includes("FER")) return "FER";
  return "";
}

function chipClass(chip: Chip) {
  if (chip === "ENT") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (chip === "FOL") return "bg-blue-100 text-blue-700 border-blue-200";
  if (chip === "BAN") return "bg-amber-100 text-amber-800 border-amber-200";
  if (chip === "FAL") return "bg-red-100 text-red-700 border-red-200";
  if (chip === "ATE") return "bg-violet-100 text-violet-700 border-violet-200";
  if (chip === "FER") return "bg-sky-100 text-sky-700 border-sky-200";
  if (chip === "-") return "bg-muted text-muted-foreground border-border";
  return "";
}

function rowKind(row: any[], rowIndex: number) {
  if (rowIndex === 1) return "teams";
  if (rowIndex === 2) return "people";
  const a = cellToText(row?.[0]).trim().toUpperCase();
  if (a === "DATA") return "dataHeader";
  return "normal";
}

export function SpreadsheetView({ dataset, personFilter, statusFilter, teamFilter, dateRange }: SpreadsheetViewProps) {
  const [query, setQuery] = useState("");
  const [compact, setCompact] = useState(true);

  const ROW_HEIGHT = compact ? 28 : 36;
  const VIEWPORT_ROWS = 120;
  const BUFFER = 20;

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const grid = dataset?.rawGrid ?? [];

  const prepared = useMemo(() => {
    const safe = grid.slice(0, 20000);
    const maxCols = Math.max(...safe.map((r) => (r?.length ?? 0)), 0);
    const headers = Array.from({ length: maxCols }, (_, i) => excelCol(i));

    const q = query.trim().toLowerCase();
    const filtered = q
      ? safe.filter((row) => {
          const joined = row.map(cellToText).join(" ").toLowerCase();
          return joined.includes(q);
        })
      : safe;

    return { rows: filtered, maxCols, headers };
  }, [grid, query]);

  const totalRows = prepared.rows.length;

  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER);
  const endIndex = Math.min(totalRows, startIndex + VIEWPORT_ROWS + BUFFER * 2);

  const visible = prepared.rows.slice(startIndex, endIndex);

  const topPad = startIndex * ROW_HEIGHT;
  const bottomPad = Math.max(0, (totalRows - endIndex) * ROW_HEIGHT);

  const colHeaders = prepared.headers;

  if (!grid.length) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Nenhum dado para exibir
      </div>
    );
  }

  return (
    <section className="h-full flex flex-col bg-card border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center justify-between gap-3 shrink-0">
        <div>
          <div className="font-bold text-foreground">Planilha (Power BI)</div>
          <div className="text-xs text-muted-foreground">
            {totalRows.toLocaleString("pt-BR")} linhas • {prepared.maxCols} colunas
            {query ? " • filtrado" : ""}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar… (qualquer coluna)"
              className="w-72 max-w-[50vw] rounded-xl border border-border bg-muted px-3 py-2 text-sm"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-2 top-2 text-xs text-muted-foreground hover:text-foreground"
                aria-label="limpar"
              >
                ✕
              </button>
            )}
          </div>

          <button
            onClick={() => setCompact((c) => !c)}
            className={cn(
              "px-3 py-2 rounded-xl border text-sm font-semibold transition-colors",
              compact 
                ? "bg-primary text-primary-foreground" 
                : "bg-card text-foreground hover:bg-muted"
            )}
          >
            {compact ? "Compacto: ON" : "Compacto: OFF"}
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-auto"
        onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
      >
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-20 bg-muted">
            <tr className="border-b border-border">
              <th className="text-[11px] font-bold text-muted-foreground px-3 py-2 bg-muted sticky left-0 z-30 border-r border-border w-[56px]">
                #
              </th>
              <th className="text-[11px] font-bold text-muted-foreground px-3 py-2 bg-muted sticky left-[56px] z-30 border-r border-border w-[160px]">
                A
              </th>
              {colHeaders.slice(1).map((h) => (
                <th
                  key={h}
                  className="text-[11px] font-bold text-muted-foreground px-3 py-2 text-left whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {topPad > 0 && (
              <tr>
                <td colSpan={prepared.maxCols + 1} style={{ height: topPad }} />
              </tr>
            )}

            {visible.map((row, i) => {
              const realRowIndex = startIndex + i;
              const kind = rowKind(row, realRowIndex);

              const baseRow =
                kind === "teams"
                  ? "bg-primary text-primary-foreground"
                  : kind === "people"
                  ? "bg-secondary"
                  : kind === "dataHeader"
                  ? "bg-accent"
                  : "bg-card";

              const cellPad = compact ? "px-2 py-1" : "px-3 py-2";
              const aVal = cellToText(row?.[0]);

              return (
                <tr key={realRowIndex} className={cn("border-b border-border", baseRow)} style={{ height: ROW_HEIGHT }}>
                  <td
                    className={cn(
                      "text-[11px] sticky left-0 z-10 border-r border-border w-[56px]",
                      cellPad,
                      kind === "teams" ? "bg-primary text-primary-foreground" : 
                      kind === "people" ? "bg-secondary" : 
                      kind === "dataHeader" ? "bg-accent" : "bg-card"
                    )}
                  >
                    {realRowIndex + 1}
                  </td>

                  <td
                    className={cn(
                      "text-[12px] font-semibold sticky left-[56px] z-10 border-r border-border w-[160px]",
                      cellPad,
                      kind === "teams" ? "bg-primary text-primary-foreground" : 
                      kind === "people" ? "bg-secondary" : 
                      kind === "dataHeader" ? "bg-accent" : "bg-card"
                    )}
                    title={aVal}
                  >
                    <div className="truncate">{aVal}</div>
                  </td>

                  {Array.from({ length: prepared.maxCols - 1 }).map((_, cIdx) => {
                    const v = cellToText(row?.[cIdx + 1]);
                    const chip = detectChip(v);

                    if (chip) {
                      return (
                        <td key={cIdx} className={cn(cellPad, "whitespace-nowrap")}>
                          <span className={cn(
                            "inline-flex items-center justify-center border rounded-full px-2 py-0.5 text-[11px] font-bold",
                            chipClass(chip)
                          )}>
                            {chip}
                          </span>
                        </td>
                      );
                    }

                    return (
                      <td key={cIdx} className={cn(cellPad, "whitespace-nowrap")}>
                        {v}
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {bottomPad > 0 && (
              <tr>
                <td colSpan={prepared.maxCols + 1} style={{ height: bottomPad }} />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground flex flex-wrap gap-3 shrink-0">
        <span>🎛️ Busca instantânea</span>
        <span>🧊 Header/colunas fixas</span>
        <span>⚡ Virtualização (não trava)</span>
        <span>🎨 Status colorido</span>
      </div>
    </section>
  );
}
