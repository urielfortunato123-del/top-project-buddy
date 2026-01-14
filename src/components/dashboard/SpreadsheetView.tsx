import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Dataset } from "@/lib/database";
import { cn } from "@/lib/utils";

type Chip = "ENT" | "FOL" | "BAN" | "FAL" | "ATE" | "FER" | "-" | "";
type FilterOp = "contains" | "equals";
type ColFilter = { op: FilterOp; value: string };

interface SpreadsheetViewProps {
  dataset: Dataset;
}

function cellToText(v: unknown): string {
  if (v === null || v === undefined) return "";
  const t = typeof v;
  if (t === "string") return v as string;
  if (t === "number" || t === "boolean" || t === "bigint") return String(v);
  if (v instanceof Date) return v.toISOString();
  return "[obj]";
}

function excelCol(i: number): string {
  let n = i + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function normalize(s: string): string {
  return s.trim().toLowerCase();
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

function chipClass(chip: Chip): string {
  if (chip === "ENT") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (chip === "FOL") return "bg-blue-100 text-blue-700 border-blue-200";
  if (chip === "BAN") return "bg-amber-100 text-amber-800 border-amber-200";
  if (chip === "FAL") return "bg-red-100 text-red-700 border-red-200";
  if (chip === "ATE") return "bg-violet-100 text-violet-700 border-violet-200";
  if (chip === "FER") return "bg-sky-100 text-sky-700 border-sky-200";
  if (chip === "-") return "bg-muted text-muted-foreground border-border";
  return "";
}

function rowKind(row: unknown[], rowIndex: number): "teams" | "people" | "dataHeader" | "normal" {
  if (rowIndex === 1) return "teams";
  if (rowIndex === 2) return "people";
  const a = cellToText(row?.[0]).trim().toUpperCase();
  if (a === "DATA") return "dataHeader";
  return "normal";
}

export function SpreadsheetView({ dataset }: SpreadsheetViewProps) {
  const [query, setQuery] = useState("");
  const [compact, setCompact] = useState(true);
  const [showFields, setShowFields] = useState(false);
  const [fullMode, setFullMode] = useState(false);
  const [pageSize, setPageSize] = useState<number>(500);
  const [page, setPage] = useState(1);

  const [hiddenCols, setHiddenCols] = useState<number[]>([]);
  const hiddenSet = useMemo(() => new Set(hiddenCols), [hiddenCols]);

  const [colFilters, setColFilters] = useState<Record<string, ColFilter>>({});

  const [filterOpen, setFilterOpen] = useState<{ col: number; x: number; y: number } | null>(null);
  const [filterDraftOp, setFilterDraftOp] = useState<FilterOp>("contains");
  const [filterDraftValue, setFilterDraftValue] = useState("");

  const [sel, setSel] = useState<{
    active: boolean;
    start: { r: number; c: number } | null;
    end: { r: number; c: number } | null;
  }>({ active: false, start: null, end: null });

  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const grid: unknown[][] = dataset?.rawGrid ?? [];

  const maxCols = useMemo(() => {
    let m = 0;
    for (const r of grid) {
      if (Array.isArray(r) && r.length > m) m = r.length;
    }
    return m;
  }, [grid]);

  const headers = useMemo(() => Array.from({ length: maxCols }, (_, i) => excelCol(i)), [maxCols]);

  const visibleCols = useMemo(() => {
    const cols: number[] = [];
    for (let c = 0; c < maxCols; c++) {
      if (!hiddenSet.has(c)) cols.push(c);
    }
    return cols;
  }, [maxCols, hiddenSet]);

  const filteredRows = useMemo(() => {
    const safe = grid.slice(0, 20000);
    const q = normalize(query);
    const filterKeys = Object.keys(colFilters);

    return safe.filter((row) => {
      if (!Array.isArray(row)) return false;
      
      if (q) {
        const joined = row.map(cellToText).join(" ").toLowerCase();
        if (!joined.includes(q)) return false;
      }

      if (filterKeys.length) {
        for (const k of filterKeys) {
          const c = Number(k);
          const f = colFilters[k];
          if (!f?.value) continue;
          const cell = normalize(cellToText(row?.[c]));
          const v = normalize(f.value);
          if (f.op === "contains") {
            if (!cell.includes(v)) return false;
          } else {
            if (cell !== v) return false;
          }
        }
      }

      return true;
    });
  }, [grid, query, colFilters]);

  useEffect(() => {
    setPage(1);
  }, [query, colFilters, pageSize, fullMode, hiddenCols]);

  const totalRows = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const pageSafe = Math.min(page, totalPages);

  const pagedRows = useMemo(() => {
    if (!fullMode) return filteredRows;
    const start = (pageSafe - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, fullMode, pageSafe, pageSize]);

  const ROW_HEIGHT = compact ? 28 : 36;
  const VIEWPORT_ROWS = 120;
  const BUFFER = 20;

  const totalVirtualRows = pagedRows.length;
  const startIndex = !fullMode ? Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER) : 0;
  const endIndex = !fullMode ? Math.min(totalVirtualRows, startIndex + VIEWPORT_ROWS + BUFFER * 2) : totalVirtualRows;
  const visibleRows = !fullMode ? pagedRows.slice(startIndex, endIndex) : pagedRows;

  const topPad = !fullMode ? startIndex * ROW_HEIGHT : 0;
  const bottomPad = !fullMode ? Math.max(0, (totalVirtualRows - endIndex) * ROW_HEIGHT) : 0;

  function isCellSelected(r: number, c: number): boolean {
    if (!sel.start || !sel.end) return false;
    const r1 = Math.min(sel.start.r, sel.end.r);
    const r2 = Math.max(sel.start.r, sel.end.r);
    const c1 = Math.min(sel.start.c, sel.end.c);
    const c2 = Math.max(sel.start.c, sel.end.c);
    return r >= r1 && r <= r2 && c >= c1 && c <= c2;
  }

  function clearSelection() {
    setSel({ active: false, start: null, end: null });
  }

  async function copySelectionTSV() {
    if (!sel.start || !sel.end) return;

    const r1 = Math.min(sel.start.r, sel.end.r);
    const r2 = Math.max(sel.start.r, sel.end.r);
    const c1 = Math.min(sel.start.c, sel.end.c);
    const c2 = Math.max(sel.start.c, sel.end.c);

    const rows = pagedRows.slice(r1, r2 + 1).map((row) => {
      const cells: string[] = [];
      for (let c = c1; c <= c2; c++) cells.push(cellToText(row?.[c]));
      return cells.join("\t");
    });

    await navigator.clipboard.writeText(rows.join("\n"));
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        if (sel.start && sel.end) {
          e.preventDefault();
          copySelectionTSV();
        }
      }
      if (e.key === "Escape") {
        clearSelection();
        setFilterOpen(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sel, pagedRows]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!filterOpen) return;
      const t = e.target as HTMLElement;
      if (t.closest("[data-filter-popover]")) return;
      setFilterOpen(null);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [filterOpen]);

  function toggleCol(c: number) {
    setHiddenCols((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  function openFilter(col: number, e: React.MouseEvent) {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setFilterDraftOp(colFilters[String(col)]?.op ?? "contains");
    setFilterDraftValue(colFilters[String(col)]?.value ?? "");
    setFilterOpen({ col, x: rect.left, y: rect.bottom + 6 });
  }

  function applyFilter() {
    if (!filterOpen) return;
    const col = filterOpen.col;
    const v = filterDraftValue.trim();

    setColFilters((prev) => {
      const next = { ...prev };
      if (!v) delete next[String(col)];
      else next[String(col)] = { op: filterDraftOp, value: v };
      return next;
    });

    setFilterOpen(null);
  }

  function clearFilter(col: number) {
    setColFilters((prev) => {
      const next = { ...prev };
      delete next[String(col)];
      return next;
    });
  }

  if (!grid.length) {
    return <div className="p-6 text-muted-foreground">Nenhum dado para exibir</div>;
  }

  const cellPad = compact ? "px-2 py-1" : "px-3 py-2";

  return (
    <section className="bg-card border border-border shadow-sm rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="font-bold text-foreground">Planilha (Power BI)</div>
          <div className="text-xs text-muted-foreground">
            {totalRows.toLocaleString("pt-BR")} linhas • {maxCols} colunas
            {Object.keys(colFilters).length ? " • filtros" : ""}
            {query ? " • busca" : ""}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar…"
            className="w-48 rounded-xl border border-border bg-muted px-3 py-2 text-sm"
          />

          <button
            onClick={() => setCompact((c) => !c)}
            className={cn(
              "px-3 py-2 rounded-xl border text-sm font-semibold transition-colors",
              compact ? "bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-muted"
            )}
          >
            Compacto
          </button>

          <button
            onClick={() => setShowFields((s) => !s)}
            className={cn(
              "px-3 py-2 rounded-xl border text-sm font-semibold transition-colors",
              showFields ? "bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-muted"
            )}
          >
            Campos
          </button>

          <button
            onClick={() => setFullMode((m) => !m)}
            className={cn(
              "px-3 py-2 rounded-xl border text-sm font-semibold transition-colors",
              fullMode ? "bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-muted"
            )}
          >
            Paginado
          </button>

          {sel.start && sel.end && (
            <button onClick={copySelectionTSV} className="px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">
              Copiar
            </button>
          )}
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: showFields ? "240px 1fr" : "1fr" }}>
        {showFields && (
          <aside className="border-r border-border bg-muted/50">
            <div className="px-3 py-3 border-b border-border">
              <div className="text-xs font-bold text-muted-foreground">CAMPOS</div>
            </div>

            <div className="p-3 space-y-2 overflow-auto" style={{ maxHeight: "calc(100vh - 220px)" }}>
              {headers.map((h, c) => {
                const hidden = hiddenSet.has(c);
                const hasF = !!colFilters[String(c)];
                return (
                  <button
                    key={h}
                    onClick={() => toggleCol(c)}
                    className={cn(
                      "w-full text-left rounded-xl border px-3 py-2 text-sm transition",
                      hidden ? "bg-card text-muted-foreground" : "bg-card text-foreground hover:bg-muted",
                      hasF && "ring-2 ring-primary"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{h}</span>
                      <span className="text-xs text-muted-foreground">{hidden ? "oculta" : "visível"}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {fullMode && (
              <div className="px-3 py-3 border-t border-border bg-card">
                <div className="text-xs font-bold text-muted-foreground mb-2">PÁGINA</div>
                <div className="flex items-center gap-2">
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="rounded-xl border px-2 py-2 text-sm"
                  >
                    <option value={200}>200</option>
                    <option value={500}>500</option>
                    <option value={1000}>1000</option>
                  </select>

                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-2 py-1 border rounded" disabled={pageSafe <= 1}>
                    ◀
                  </button>
                  <span className="text-sm font-semibold">{pageSafe}/{totalPages}</span>
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="px-2 py-1 border rounded" disabled={pageSafe >= totalPages}>
                    ▶
                  </button>
                </div>
              </div>
            )}
          </aside>
        )}

        <div className="relative">
          <div
            ref={scrollRef}
            className="h-[calc(100vh-160px)] overflow-auto"
            onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
            onMouseLeave={() => setSel((s) => ({ ...s, active: false }))}
          >
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-20 bg-card">
                <tr className="border-b border-border">
                  <th className="text-xs font-bold text-muted-foreground px-3 py-2 bg-card sticky left-0 z-30 border-r border-border w-[56px]">
                    #
                  </th>

                  {visibleCols.includes(0) && (
                    <th className="text-xs font-bold text-muted-foreground px-3 py-2 bg-card sticky left-[56px] z-30 border-r border-border w-[160px]">
                      <div className="flex items-center justify-between gap-2">
                        <span>A</span>
                        <button className="text-xs px-2 py-1 rounded-lg border hover:bg-muted" onClick={(e) => openFilter(0, e)}>
                          ⛃
                        </button>
                      </div>
                    </th>
                  )}

                  {visibleCols.filter((c) => c !== 0).map((c) => (
                    <th key={c} className="text-xs font-bold text-muted-foreground px-3 py-2 text-left whitespace-nowrap">
                      <div className="flex items-center justify-between gap-2">
                        <span>{headers[c]}</span>
                        <button className="text-xs px-2 py-1 rounded-lg border hover:bg-muted" onClick={(e) => openFilter(c, e)}>
                          ⛃
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {topPad > 0 && (
                  <tr><td colSpan={visibleCols.length + 1} style={{ height: topPad }} /></tr>
                )}

                {visibleRows.map((row, i) => {
                  const realRow = (!fullMode ? startIndex : 0) + i;
                  const globalRow = fullMode ? (pageSafe - 1) * pageSize + realRow : realRow;

                  const kind = rowKind(row as unknown[], globalRow);
                  const baseRow =
                    kind === "teams"
                      ? "bg-primary text-primary-foreground"
                      : kind === "people"
                      ? "bg-secondary"
                      : kind === "dataHeader"
                      ? "bg-accent"
                      : "bg-card";

                  return (
                    <tr key={realRow} className={cn("border-b border-border", baseRow)} style={{ height: ROW_HEIGHT }}>
                      <td className={cn("text-xs sticky left-0 z-10 border-r border-border w-[56px]", cellPad,
                        kind === "teams" ? "bg-primary text-primary-foreground" :
                        kind === "people" ? "bg-secondary" :
                        kind === "dataHeader" ? "bg-accent" : "bg-card"
                      )}>
                        {globalRow + 1}
                      </td>

                      {visibleCols.map((c) => {
                        const arr = row as unknown[];
                        const txt = cellToText(arr?.[c]);
                        const chip = detectChip(txt);

                        const stickyA = c === 0
                          ? cn("sticky left-[56px] z-10 border-r border-border w-[160px]",
                              kind === "teams" ? "bg-primary text-primary-foreground" :
                              kind === "people" ? "bg-secondary" :
                              kind === "dataHeader" ? "bg-accent" : "bg-card")
                          : "";

                        const selected = isCellSelected(realRow, c);

                        return (
                          <td
                            key={c}
                            className={cn(cellPad, "whitespace-nowrap", stickyA, selected && "outline outline-2 outline-primary outline-offset-[-2px]")}
                            onMouseDown={(e) => e.button === 0 && setSel({ active: true, start: { r: realRow, c }, end: { r: realRow, c } })}
                            onMouseEnter={() => sel.active && sel.start && setSel((s) => ({ ...s, end: { r: realRow, c } }))}
                            onMouseUp={() => setSel((s) => ({ ...s, active: false }))}
                          >
                            {chip ? (
                              <span className={cn("inline-flex items-center justify-center border rounded-full px-2 py-1 text-xs font-bold", chipClass(chip))}>
                                {chip}
                              </span>
                            ) : (
                              <span className={c === 0 ? "font-semibold truncate block max-w-[150px]" : ""}>{txt}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}

                {bottomPad > 0 && (
                  <tr><td colSpan={visibleCols.length + 1} style={{ height: bottomPad }} /></tr>
                )}
              </tbody>
            </table>
          </div>

          {filterOpen && (
            <div
              data-filter-popover
              className="fixed z-50 bg-card border border-border shadow-lg rounded-2xl p-3 w-[260px]"
              style={{ left: filterOpen.x, top: filterOpen.y }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="font-bold text-sm">Filtro: {headers[filterOpen.col]}</div>
                <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setFilterOpen(null)}>
                  ✕
                </button>
              </div>

              <select
                value={filterDraftOp}
                onChange={(e) => setFilterDraftOp(e.target.value as FilterOp)}
                className="w-full rounded-xl border px-2 py-2 text-sm mb-2"
              >
                <option value="contains">Contém</option>
                <option value="equals">Igual</option>
              </select>

              <input
                value={filterDraftValue}
                onChange={(e) => setFilterDraftValue(e.target.value)}
                className="w-full rounded-xl border px-2 py-2 text-sm mb-2"
                placeholder="Valor..."
              />

              <div className="flex items-center gap-2">
                <button onClick={applyFilter} className="flex-1 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">
                  Aplicar
                </button>
                <button onClick={() => clearFilter(filterOpen.col)} className="px-3 py-2 rounded-xl border text-sm">
                  Limpar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground flex flex-wrap gap-3">
        <span>📚 Campos</span>
        <span>⛃ Filtros</span>
        <span>🖱️ Selecionar</span>
        <span>Ctrl+C copiar</span>
      </div>
    </section>
  );
}
