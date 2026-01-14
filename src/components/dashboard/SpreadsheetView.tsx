import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Dataset } from "@/lib/database";

type FilterOp = "contains" | "equals";
type ColFilter = { op: FilterOp; value: string };

type RowKind = "teams" | "people" | "dataHeader" | "normal";

type Sel = {
  active: boolean;
  start: { r: number; c: number } | null;
  end: { r: number; c: number } | null;
};

function cellToText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return "[obj]";
  return String(v);
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

function detectChip(v: string): string {
  const x = v.trim().toUpperCase();
  if (!x) return "";
  if (x === "-" || x === "0") return "-";
  if (x.includes("ENT")) return "ENT";
  if (x.includes("FOL")) return "FOL";
  if (x.includes("BAN")) return "BAN";
  if (x.includes("FAL")) return "FAL";
  if (x.includes("ATE")) return "ATE";
  if (x.includes("FÉR") || x.includes("FER")) return "FER";
  return "";
}

function chipClass(chip: string): string {
  // Somente tokens sem cores hard-coded
  switch (chip) {
    case "ENT":
      return "bg-primary/15 text-foreground border-primary/30";
    case "FOL":
      return "bg-info/15 text-foreground border-info/30";
    case "BAN":
      return "bg-secondary/15 text-foreground border-secondary/30";
    case "FAL":
      return "bg-destructive/15 text-foreground border-destructive/30";
    case "ATE":
      return "bg-accent/15 text-foreground border-accent/30";
    case "FER":
      return "bg-muted text-foreground border-border";
    case "-":
      return "bg-muted/50 text-muted-foreground border-border";
    default:
      return "";
  }
}

function rowKind(row: unknown[], rowIndex: number): RowKind {
  // Seu formato: linha 2 = equipes, linha 3 = pessoas (0-based: 1 e 2)
  if (rowIndex === 1) return "teams";
  if (rowIndex === 2) return "people";
  const a = cellToText(row?.[0]).trim().toUpperCase();
  if (a === "DATA") return "dataHeader";
  return "normal";
}

function isCellSelected(sel: Sel, r: number, c: number): boolean {
  if (!sel.start || !sel.end) return false;
  const r1 = Math.min(sel.start.r, sel.end.r);
  const r2 = Math.max(sel.start.r, sel.end.r);
  const c1 = Math.min(sel.start.c, sel.end.c);
  const c2 = Math.max(sel.start.c, sel.end.c);
  return r >= r1 && r <= r2 && c >= c1 && c <= c2;
}

export function SpreadsheetView({ dataset }: { dataset: Dataset | null }) {
  // UI controls
  const [query, setQuery] = useState<string>("");
  const [compact, setCompact] = useState<boolean>(true);
  const [showFields, setShowFields] = useState<boolean>(false);

  // paging
  const [fullMode, setFullMode] = useState<boolean>(false);
  const [pageSize, setPageSize] = useState<number>(500);
  const [page, setPage] = useState<number>(1);

  // column visibility + filters (prefer arrays/records para reduzir carga do checker)
  const [hiddenCols, setHiddenCols] = useState<number[]>([]); // 0-based
  const [colFilters, setColFilters] = useState<Record<string, ColFilter>>({});

  // header filter popover
  const [filterOpen, setFilterOpen] = useState<{ col: number; x: number; y: number } | null>(null);
  const [filterDraftOp, setFilterDraftOp] = useState<FilterOp>("contains");
  const [filterDraftValue, setFilterDraftValue] = useState<string>("");

  // selection
  const [sel, setSel] = useState<Sel>({ active: false, start: null, end: null });

  // virtualization
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState<number>(0);

  const grid: unknown[][] = dataset?.rawGrid ?? [];

  const maxCols = useMemo<number>(() => {
    let m = 0;
    for (const r of grid) m = Math.max(m, (r?.length ?? 0) as number);
    return m;
  }, [grid]);

  const headers = useMemo<string[]>(() => {
    const out: string[] = [];
    for (let i = 0; i < maxCols; i++) out.push(excelCol(i));
    return out;
  }, [maxCols]);

  const hiddenSet = useMemo<Record<string, true>>(() => {
    const set: Record<string, true> = {};
    for (const c of hiddenCols) set[String(c)] = true;
    return set;
  }, [hiddenCols]);

  const visibleCols = useMemo<number[]>(() => {
    const cols: number[] = [];
    for (let c = 0; c < maxCols; c++) if (!hiddenSet[String(c)]) cols.push(c);
    return cols;
  }, [maxCols, hiddenSet]);

  const filteredRows = useMemo<unknown[][]>(() => {
    const safe = grid.slice(0, 20000);
    const q = normalize(query);
    const filterKeys = Object.keys(colFilters);

    return safe.filter((row) => {
      if (q) {
        let joined = "";
        for (let i = 0; i < row.length; i++) joined += " " + cellToText(row[i]);
        if (!joined.toLowerCase().includes(q)) return false;
      }

      if (filterKeys.length) {
        for (const k of filterKeys) {
          const f = colFilters[k];
          if (!f?.value) continue;
          const c = Number(k);
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

  useEffect(() => setPage(1), [query, colFilters, pageSize, fullMode, hiddenCols]);

  const totalRows = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const pageSafe = Math.min(page, totalPages);

  const pagedRows = useMemo<unknown[][]>(() => {
    if (!fullMode) return filteredRows;
    const start = (pageSafe - 1) * pageSize;
    const end = start + pageSize;
    return filteredRows.slice(start, end);
  }, [filteredRows, fullMode, pageSafe, pageSize]);

  const ROW_HEIGHT = compact ? 28 : 36;
  const VIEWPORT_ROWS = 120;
  const BUFFER = 20;

  const totalVirtualRows = pagedRows.length;
  const startIndex = !fullMode ? Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER) : 0;
  const endIndex = !fullMode
    ? Math.min(totalVirtualRows, startIndex + VIEWPORT_ROWS + BUFFER * 2)
    : totalVirtualRows;

  const visibleRows = !fullMode ? pagedRows.slice(startIndex, endIndex) : pagedRows;
  const topPad = !fullMode ? startIndex * ROW_HEIGHT : 0;
  const bottomPad = !fullMode ? Math.max(0, (totalVirtualRows - endIndex) * ROW_HEIGHT) : 0;

  function toggleCol(c: number) {
    setHiddenCols((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  function openFilter(col: number, e: React.MouseEvent) {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const existing = colFilters[String(col)];
    setFilterDraftOp(existing?.op ?? "contains");
    setFilterDraftValue(existing?.value ?? "");
    setFilterOpen({ col, x: rect.left, y: rect.bottom + 6 });
  }

  function applyFilter() {
    if (!filterOpen) return;
    const col = filterOpen.col;
    const v = filterDraftValue.trim();

    setColFilters((prev) => {
      const next: Record<string, ColFilter> = { ...prev };
      if (!v) delete next[String(col)];
      else next[String(col)] = { op: filterDraftOp, value: v };
      return next;
    });

    setFilterOpen(null);
  }

  function clearFilter(col: number) {
    setColFilters((prev) => {
      const next: Record<string, ColFilter> = { ...prev };
      delete next[String(col)];
      return next;
    });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  if (!dataset || !grid.length) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Nenhum dado para exibir
      </div>
    );
  }

  const cellPad = compact ? "px-2 py-1" : "px-3 py-2";

  function rowBaseClass(kind: RowKind): string {
    if (kind === "teams") return "bg-sidebar text-sidebar-foreground";
    if (kind === "people") return "bg-muted";
    if (kind === "dataHeader") return "bg-secondary/15";
    return "bg-card";
  }

  function rowStickyClass(kind: RowKind): string {
    if (kind === "teams") return "bg-sidebar text-sidebar-foreground";
    if (kind === "people") return "bg-muted";
    if (kind === "dataHeader") return "bg-secondary/15";
    return "bg-card";
  }

  return (
    <section className="h-full flex flex-col bg-card border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center justify-between gap-3 shrink-0">
        <div>
          <div className="font-bold text-foreground">Planilha (Power BI)</div>
          <div className="text-xs text-muted-foreground">
            {totalRows.toLocaleString("pt-BR")} linhas • {maxCols} colunas
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar…"
            className="w-56 max-w-[50vw] rounded-xl border border-border bg-muted px-3 py-2 text-sm"
          />

          <button
            onClick={() => setCompact((c) => !c)}
            className="px-3 py-2 rounded-xl bg-card border border-border text-sm font-semibold hover:bg-muted"
          >
            {compact ? "Compacto: ON" : "Compacto: OFF"}
          </button>

          <button
            onClick={() => setShowFields((s) => !s)}
            className="px-3 py-2 rounded-xl bg-card border border-border text-sm font-semibold hover:bg-muted"
          >
            {showFields ? "Campos: ON" : "Campos: OFF"}
          </button>

          <button
            onClick={() => setFullMode((m) => !m)}
            className="px-3 py-2 rounded-xl bg-card border border-border text-sm font-semibold hover:bg-muted"
          >
            {fullMode ? "Planilha completa: ON" : "Planilha completa: OFF"}
          </button>

          {sel.start && sel.end && (
            <button
              onClick={copySelectionTSV}
              className="px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
              title="Copiar seleção (Ctrl+C)"
            >
              Copiar
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {showFields && (
          <aside className="w-64 border-r bg-muted/50 flex flex-col shrink-0">
            <div className="px-3 py-3 border-b">
              <div className="text-xs font-bold text-muted-foreground">CAMPOS</div>
              <div className="text-[11px] text-muted-foreground">Clique para ocultar/exibir</div>
            </div>

            <div className="p-3 space-y-2 overflow-auto flex-1">
              {headers.map((h, c) => {
                const hidden = !!hiddenSet[String(c)];
                const hasF = !!colFilters[String(c)];
                return (
                  <button
                    key={h}
                    onClick={() => toggleCol(c)}
                    className={
                      "w-full text-left rounded-xl border px-3 py-2 text-sm transition " +
                      (hidden ? "bg-card text-muted-foreground" : "bg-card text-foreground hover:bg-muted") +
                      (hasF ? " ring-2 ring-primary/40" : "")
                    }
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{h}</span>
                      <span className="text-[11px] text-muted-foreground">{hidden ? "oculta" : "visível"}</span>
                    </div>
                    {hasF && (
                      <div className="text-[11px] text-muted-foreground mt-1">
                        {colFilters[String(c)].op}: “{colFilters[String(c)].value}”
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {fullMode && (
              <div className="px-3 py-3 border-t bg-card">
                <div className="text-xs font-bold text-muted-foreground mb-2">PAGINAÇÃO</div>
                <div className="flex items-center gap-2">
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="rounded-xl border border-border bg-card px-2 py-2 text-sm"
                  >
                    <option value={200}>200</option>
                    <option value={500}>500</option>
                    <option value={1000}>1000</option>
                  </select>

                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-2 py-1 border border-border rounded"
                    disabled={pageSafe <= 1}
                  >
                    ◀
                  </button>
                  <div className="text-sm font-semibold text-foreground">
                    {pageSafe} / {totalPages}
                  </div>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="px-2 py-1 border border-border rounded"
                    disabled={pageSafe >= totalPages}
                  >
                    ▶
                  </button>
                </div>
              </div>
            )}
          </aside>
        )}

        <div className="flex-1 relative overflow-hidden">
          <div
            ref={scrollRef}
            className="h-full overflow-auto"
            onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
            onMouseLeave={() => setSel((s) => ({ ...s, active: false }))}
          >
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-20 bg-muted">
                <tr className="border-b border-border">
                  <th className="text-[11px] font-bold text-muted-foreground px-3 py-2 bg-muted sticky left-0 z-30 border-r border-border w-[56px]">
                    #
                  </th>

                  {visibleCols.map((c) => {
                    const isA = c === 0;
                    return (
                      <th
                        key={c}
                        className={
                          "text-[11px] font-bold text-muted-foreground px-3 py-2 bg-muted " +
                          (isA ? "sticky left-[56px] z-30 border-r border-border w-[160px]" : "text-left whitespace-nowrap")
                        }
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span>{headers[c]}</span>
                          <button
                            className="text-[11px] px-2 py-1 rounded-lg border border-border hover:bg-card"
                            onClick={(e) => openFilter(c, e)}
                            title="Filtro"
                          >
                            ⛃
                          </button>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                {topPad > 0 && (
                  <tr>
                    <td colSpan={visibleCols.length + 1} style={{ height: topPad }} />
                  </tr>
                )}

                {visibleRows.map((row, i) => {
                  const realRow = (!fullMode ? startIndex : 0) + i;
                  const absoluteRowIndex = fullMode ? (pageSafe - 1) * pageSize + realRow : realRow;
                  const kind = rowKind(row, absoluteRowIndex);

                  return (
                    <tr
                      key={absoluteRowIndex}
                      className={"border-b border-border " + rowBaseClass(kind)}
                      style={{ height: ROW_HEIGHT }}
                    >
                      <td
                        className={
                          "text-[11px] sticky left-0 z-10 border-r border-border w-[56px] " +
                          cellPad +
                          " " +
                          rowStickyClass(kind)
                        }
                      >
                        {absoluteRowIndex + 1}
                      </td>

                      {visibleCols.map((c) => {
                        const txt = cellToText(row?.[c]);
                        const chip = detectChip(txt);
                        const isA = c === 0;
                        const stickyA = isA
                          ? "sticky left-[56px] z-10 border-r border-border w-[160px] " + rowStickyClass(kind)
                          : "";

                        const selected = isCellSelected(sel, realRow, c);

                        return (
                          <td
                            key={c}
                            className={
                              cellPad +
                              " whitespace-nowrap " +
                              stickyA +
                              (selected ? " outline outline-2 outline-primary outline-offset-[-2px]" : "")
                            }
                            onMouseDown={(e) => {
                              if (e.button !== 0) return;
                              setSel({ active: true, start: { r: realRow, c }, end: { r: realRow, c } });
                            }}
                            onMouseEnter={() => {
                              if (!sel.active || !sel.start) return;
                              setSel((s) => ({ ...s, end: { r: realRow, c } }));
                            }}
                            onMouseUp={() => setSel((s) => ({ ...s, active: false }))}
                            title={txt}
                          >
                            {chip ? (
                              <span
                                className={
                                  "inline-flex items-center justify-center border rounded-full px-2 py-0.5 text-[11px] font-bold " +
                                  chipClass(chip)
                                }
                              >
                                {chip}
                              </span>
                            ) : isA ? (
                              <span className="font-semibold truncate block max-w-[150px]">{txt}</span>
                            ) : (
                              txt
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}

                {bottomPad > 0 && (
                  <tr>
                    <td colSpan={visibleCols.length + 1} style={{ height: bottomPad }} />
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {filterOpen && (
            <div
              data-filter-popover
              className="fixed z-[9999] bg-popover text-popover-foreground border border-border shadow-lg rounded-2xl p-3 w-[280px]"
              style={{ left: filterOpen.x, top: filterOpen.y }}
            >
              <div className="flex items-center justify-between">
                <div className="font-bold text-sm">Filtro: {headers[filterOpen.col]}</div>
                <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setFilterOpen(null)}>
                  ✕
                </button>
              </div>

              <div className="mt-3 space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">Operação</label>
                <select
                  value={filterDraftOp}
                  onChange={(e) => setFilterDraftOp(e.target.value as FilterOp)}
                  className="w-full rounded-xl border border-border bg-card px-2 py-2 text-sm"
                >
                  <option value="contains">Contém</option>
                  <option value="equals">Igual</option>
                </select>

                <label className="text-xs font-semibold text-muted-foreground">Valor</label>
                <input
                  value={filterDraftValue}
                  onChange={(e) => setFilterDraftValue(e.target.value)}
                  className="w-full rounded-xl border border-border bg-card px-2 py-2 text-sm"
                  placeholder="ex: ENT"
                />

                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={applyFilter}
                    className="flex-1 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
                  >
                    Aplicar
                  </button>
                  <button
                    onClick={() => clearFilter(filterOpen.col)}
                    className="px-3 py-2 rounded-xl border border-border text-sm font-semibold hover:bg-muted"
                    title="Limpar filtro da coluna"
                  >
                    Limpar
                  </button>
                </div>

                <div className="text-[11px] text-muted-foreground">
                  Esc fecha • Ctrl+C copia seleção
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-3 border-t text-xs text-muted-foreground flex flex-wrap gap-3 shrink-0">
        <span>📚 Campos</span>
        <span>⛃ Filtros</span>
        <span>🖱️ Seleção</span>
        <span>⌘/Ctrl+C</span>
        <span>📄 Paginação</span>
      </div>
    </section>
  );
}
