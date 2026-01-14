import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { Dataset, GenericRow } from "@/lib/database";
import { saveDataset } from "@/lib/database";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Plus, Trash2, Save, Edit3, X, Check, RotateCcw, 
  PlusCircle, Columns, Rows, Download, Copy
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Chip = "ENT" | "FOL" | "BAN" | "FAL" | "ATE" | "FER" | "-" | "";
type FilterOp = "contains" | "equals";
type ColFilter = { op: FilterOp; value: string };

interface SpreadsheetViewProps {
  dataset: Dataset;
  onDatasetUpdate?: (dataset: Dataset) => void;
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

export function SpreadsheetView({ dataset, onDatasetUpdate }: SpreadsheetViewProps) {
  // Edit mode state
  const [editMode, setEditMode] = useState(false);
  const [editedGrid, setEditedGrid] = useState<unknown[][]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Cell editing
  const [editingCell, setEditingCell] = useState<{ r: number; c: number } | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const cellInputRef = useRef<HTMLInputElement>(null);
  
  // Column rename
  const [renamingCol, setRenamingCol] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  
  // Dialogs
  const [addColDialog, setAddColDialog] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [newColPosition, setNewColPosition] = useState<"start" | "end">("end");
  
  // View state
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

  // Use edited grid in edit mode, original otherwise
  const originalGrid: unknown[][] = dataset?.rawGrid ?? [];
  const grid = editMode ? editedGrid : originalGrid;

  // Initialize edited grid when entering edit mode
  useEffect(() => {
    if (editMode && editedGrid.length === 0) {
      setEditedGrid(JSON.parse(JSON.stringify(originalGrid)));
    }
  }, [editMode, originalGrid]);

  const maxCols = useMemo(() => {
    let m = 0;
    for (const r of grid) {
      if (Array.isArray(r) && r.length > m) m = r.length;
    }
    return m;
  }, [grid]);

  const headers = useMemo(() => {
    // Use first row as headers if available
    if (grid.length > 0 && Array.isArray(grid[0])) {
      return grid[0].map((h, i) => cellToText(h) || excelCol(i));
    }
    return Array.from({ length: maxCols }, (_, i) => excelCol(i));
  }, [grid, maxCols]);

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

    return safe.map((row, idx) => ({ row, originalIndex: idx })).filter(({ row }) => {
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

  const ROW_HEIGHT = compact ? 32 : 40;
  const VIEWPORT_ROWS = 80;
  const BUFFER = 15;

  const totalVirtualRows = pagedRows.length;
  const startIndex = !fullMode ? Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER) : 0;
  const endIndex = !fullMode ? Math.min(totalVirtualRows, startIndex + VIEWPORT_ROWS + BUFFER * 2) : totalVirtualRows;
  const visibleRows = !fullMode ? pagedRows.slice(startIndex, endIndex) : pagedRows;

  const topPad = !fullMode ? startIndex * ROW_HEIGHT : 0;
  const bottomPad = !fullMode ? Math.max(0, (totalVirtualRows - endIndex) * ROW_HEIGHT) : 0;

  // Cell editing functions
  const startEditingCell = useCallback((r: number, c: number) => {
    if (!editMode) return;
    const value = cellToText(editedGrid[r]?.[c]);
    setEditingCell({ r, c });
    setEditingValue(value);
    setTimeout(() => cellInputRef.current?.focus(), 0);
  }, [editMode, editedGrid]);

  const commitCellEdit = useCallback(() => {
    if (!editingCell) return;
    const { r, c } = editingCell;
    
    setEditedGrid(prev => {
      const newGrid = [...prev];
      if (!newGrid[r]) newGrid[r] = [];
      newGrid[r] = [...newGrid[r]];
      newGrid[r][c] = editingValue;
      return newGrid;
    });
    
    setHasChanges(true);
    setEditingCell(null);
    setEditingValue("");
  }, [editingCell, editingValue]);

  const cancelCellEdit = useCallback(() => {
    setEditingCell(null);
    setEditingValue("");
  }, []);

  // Column operations
  const addColumn = useCallback((position: "start" | "end", name: string) => {
    setEditedGrid(prev => {
      return prev.map((row, i) => {
        if (!Array.isArray(row)) return row;
        const newRow = [...row];
        if (position === "start") {
          newRow.unshift(i === 0 ? name : "");
        } else {
          newRow.push(i === 0 ? name : "");
        }
        return newRow;
      });
    });
    setHasChanges(true);
    setAddColDialog(false);
    setNewColName("");
    toast({ title: "Coluna adicionada" });
  }, []);

  const deleteColumn = useCallback((colIndex: number) => {
    setEditedGrid(prev => {
      return prev.map(row => {
        if (!Array.isArray(row)) return row;
        const newRow = [...row];
        newRow.splice(colIndex, 1);
        return newRow;
      });
    });
    setHasChanges(true);
    toast({ title: "Coluna removida" });
  }, []);

  const renameColumn = useCallback((colIndex: number, newName: string) => {
    setEditedGrid(prev => {
      const newGrid = [...prev];
      if (newGrid[0] && Array.isArray(newGrid[0])) {
        newGrid[0] = [...newGrid[0]];
        newGrid[0][colIndex] = newName;
      }
      return newGrid;
    });
    setHasChanges(true);
    setRenamingCol(null);
    setRenameValue("");
  }, []);

  // Row operations
  const addRow = useCallback((position: "top" | "bottom") => {
    const emptyRow = Array(maxCols).fill("");
    setEditedGrid(prev => {
      if (position === "top") {
        // Add after header row
        return [prev[0], emptyRow, ...prev.slice(1)];
      } else {
        return [...prev, emptyRow];
      }
    });
    setHasChanges(true);
    toast({ title: "Linha adicionada" });
  }, [maxCols]);

  const deleteRow = useCallback((rowIndex: number) => {
    if (rowIndex === 0) {
      toast({ title: "Não é possível excluir o cabeçalho", variant: "destructive" });
      return;
    }
    setEditedGrid(prev => {
      const newGrid = [...prev];
      newGrid.splice(rowIndex, 1);
      return newGrid;
    });
    setHasChanges(true);
    toast({ title: "Linha removida" });
  }, []);

  // Save changes
  const saveChanges = useCallback(async () => {
    setSaving(true);
    try {
      // Rebuild the dataset with edited grid
      const updatedDataset: Dataset = {
        ...dataset,
        rawGrid: editedGrid,
        updatedAt: new Date().toISOString(),
      };
      
      await saveDataset(updatedDataset);
      onDatasetUpdate?.(updatedDataset);
      
      setHasChanges(false);
      toast({ title: "Alterações salvas!" });
    } catch (error) {
      console.error("Error saving:", error);
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [dataset, editedGrid, onDatasetUpdate]);

  // Discard changes
  const discardChanges = useCallback(() => {
    setEditedGrid(JSON.parse(JSON.stringify(originalGrid)));
    setHasChanges(false);
    toast({ title: "Alterações descartadas" });
  }, [originalGrid]);

  // Toggle edit mode
  const toggleEditMode = useCallback(() => {
    if (editMode && hasChanges) {
      // Confirm before exiting
      if (!confirm("Você tem alterações não salvas. Deseja sair do modo de edição?")) {
        return;
      }
      discardChanges();
    }
    
    if (!editMode) {
      setEditedGrid(JSON.parse(JSON.stringify(originalGrid)));
    }
    
    setEditMode(!editMode);
  }, [editMode, hasChanges, originalGrid, discardChanges]);

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

    const rows = pagedRows.slice(r1, r2 + 1).map(({ row }) => {
      const cells: string[] = [];
      for (let c = c1; c <= c2; c++) cells.push(cellToText(row?.[c]));
      return cells.join("\t");
    });

    await navigator.clipboard.writeText(rows.join("\n"));
    toast({ title: "Copiado!" });
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Cell editing shortcuts
      if (editingCell) {
        if (e.key === "Enter") {
          e.preventDefault();
          commitCellEdit();
        } else if (e.key === "Escape") {
          cancelCellEdit();
        }
        return;
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        if (sel.start && sel.end) {
          e.preventDefault();
          copySelectionTSV();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s" && editMode && hasChanges) {
        e.preventDefault();
        saveChanges();
      }
      if (e.key === "Escape") {
        clearSelection();
        setFilterOpen(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sel, pagedRows, editingCell, commitCellEdit, cancelCellEdit, editMode, hasChanges, saveChanges]);

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
    <section className="bg-card border border-border shadow-sm rounded-2xl overflow-hidden flex flex-col h-full">
      {/* Header Toolbar */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3 flex-wrap shrink-0">
        <div>
          <div className="font-bold text-foreground flex items-center gap-2">
            Planilha
            {editMode && (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
                Modo Edição
              </span>
            )}
            {hasChanges && (
              <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded-full">
                Não salvo
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {totalRows.toLocaleString("pt-BR")} linhas • {maxCols} colunas
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Edit Mode Toggle */}
          <Button
            variant={editMode ? "default" : "outline"}
            size="sm"
            onClick={toggleEditMode}
            className="gap-2"
          >
            {editMode ? <X className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
            {editMode ? "Sair Edição" : "Editar"}
          </Button>
          
          {/* Edit Mode Actions */}
          {editMode && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAddColDialog(true)}
                className="gap-2"
              >
                <Columns className="w-4 h-4" />
                + Coluna
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => addRow("bottom")}
                className="gap-2"
              >
                <Rows className="w-4 h-4" />
                + Linha
              </Button>
              
              {hasChanges && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={discardChanges}
                    className="gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Desfazer
                  </Button>
                  
                  <Button
                    size="sm"
                    onClick={saveChanges}
                    disabled={saving}
                    className="gap-2 bg-green-600 hover:bg-green-700"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? "Salvando..." : "Salvar"}
                  </Button>
                </>
              )}
            </>
          )}
          
          <div className="h-6 w-px bg-border mx-1" />

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar…"
            className="w-40 rounded-xl border border-border bg-muted px-3 py-2 text-sm"
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

          {sel.start && sel.end && (
            <button onClick={copySelectionTSV} className="px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold gap-2 flex items-center">
              <Copy className="w-4 h-4" />
              Copiar
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 grid overflow-hidden" style={{ gridTemplateColumns: showFields ? "240px 1fr" : "1fr" }}>
        {showFields && (
          <aside className="border-r border-border bg-muted/50 overflow-hidden flex flex-col">
            <div className="px-3 py-3 border-b border-border shrink-0">
              <div className="text-xs font-bold text-muted-foreground">CAMPOS</div>
            </div>

            <div className="p-3 space-y-2 overflow-auto flex-1">
              {headers.map((h, c) => {
                const hidden = hiddenSet.has(c);
                const hasF = !!colFilters[String(c)];
                return (
                  <div key={c} className="flex gap-1">
                    <button
                      onClick={() => toggleCol(c)}
                      className={cn(
                        "flex-1 text-left rounded-xl border px-3 py-2 text-sm transition",
                        hidden ? "bg-card text-muted-foreground" : "bg-card text-foreground hover:bg-muted",
                        hasF && "ring-2 ring-primary"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold truncate">{h}</span>
                        <span className="text-xs text-muted-foreground">{hidden ? "oculta" : ""}</span>
                      </div>
                    </button>
                    {editMode && (
                      <button
                        onClick={() => deleteColumn(c)}
                        className="p-2 rounded-lg border hover:bg-red-50 hover:border-red-200 hover:text-red-600"
                        title="Excluir coluna"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {fullMode && (
              <div className="px-3 py-3 border-t border-border bg-card shrink-0">
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

        {/* Table Area */}
        <div className="relative overflow-hidden">
          <div
            ref={scrollRef}
            className="h-full overflow-auto"
            onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
            onMouseLeave={() => setSel((s) => ({ ...s, active: false }))}
          >
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-20 bg-card">
                <tr className="border-b border-border">
                  <th className="text-xs font-bold text-muted-foreground px-3 py-2 bg-card sticky left-0 z-30 border-r border-border w-[56px]">
                    #
                  </th>

                  {visibleCols.map((c) => (
                    <th 
                      key={c} 
                      className={cn(
                        "text-xs font-bold text-muted-foreground px-3 py-2 text-left whitespace-nowrap bg-card",
                        c === 0 && "sticky left-[56px] z-30 border-r border-border w-[160px]"
                      )}
                    >
                      {renamingCol === c ? (
                        <div className="flex items-center gap-1">
                          <input
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            className="w-24 px-2 py-1 text-xs border rounded"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") renameColumn(c, renameValue);
                              if (e.key === "Escape") setRenamingCol(null);
                            }}
                          />
                          <button onClick={() => renameColumn(c, renameValue)} className="p-1 hover:bg-green-100 rounded">
                            <Check className="w-3 h-3 text-green-600" />
                          </button>
                          <button onClick={() => setRenamingCol(null)} className="p-1 hover:bg-red-100 rounded">
                            <X className="w-3 h-3 text-red-600" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <span 
                            className={cn(editMode && "cursor-pointer hover:text-primary")}
                            onDoubleClick={() => {
                              if (editMode) {
                                setRenamingCol(c);
                                setRenameValue(headers[c]);
                              }
                            }}
                            title={editMode ? "Duplo clique para renomear" : undefined}
                          >
                            {headers[c]}
                          </span>
                          <button className="text-xs px-2 py-1 rounded-lg border hover:bg-muted" onClick={(e) => openFilter(c, e)}>
                            ⛃
                          </button>
                        </div>
                      )}
                    </th>
                  ))}
                  
                  {/* Delete row column */}
                  {editMode && (
                    <th className="text-xs font-bold text-muted-foreground px-2 py-2 bg-card w-[40px]">
                      
                    </th>
                  )}
                </tr>
              </thead>

              <tbody>
                {topPad > 0 && (
                  <tr><td colSpan={visibleCols.length + (editMode ? 2 : 1)} style={{ height: topPad }} /></tr>
                )}

                {visibleRows.map(({ row, originalIndex }, i) => {
                  const realRow = (!fullMode ? startIndex : 0) + i;
                  const globalRow = fullMode ? (pageSafe - 1) * pageSize + realRow : realRow;
                  const isHeader = originalIndex === 0;

                  return (
                    <tr 
                      key={realRow} 
                      className={cn(
                        "border-b border-border",
                        isHeader ? "bg-muted font-semibold" : "bg-card hover:bg-muted/50"
                      )} 
                      style={{ height: ROW_HEIGHT }}
                    >
                      <td className={cn("text-xs sticky left-0 z-10 border-r border-border w-[56px] bg-card", cellPad)}>
                        {originalIndex + 1}
                      </td>

                      {visibleCols.map((c) => {
                        const arr = row as unknown[];
                        const txt = cellToText(arr?.[c]);
                        const chip = !isHeader ? detectChip(txt) : "";
                        const isEditing = editingCell?.r === originalIndex && editingCell?.c === c;

                        const stickyA = c === 0
                          ? "sticky left-[56px] z-10 border-r border-border w-[160px] bg-card"
                          : "";

                        const selected = isCellSelected(realRow, c);

                        return (
                          <td
                            key={c}
                            className={cn(
                              cellPad, 
                              "whitespace-nowrap", 
                              stickyA, 
                              selected && "outline outline-2 outline-primary outline-offset-[-2px]",
                              editMode && !isHeader && "cursor-text hover:bg-blue-50"
                            )}
                            onMouseDown={(e) => {
                              if (!editMode) {
                                e.button === 0 && setSel({ active: true, start: { r: realRow, c }, end: { r: realRow, c } });
                              }
                            }}
                            onMouseEnter={() => !editMode && sel.active && sel.start && setSel((s) => ({ ...s, end: { r: realRow, c } }))}
                            onMouseUp={() => !editMode && setSel((s) => ({ ...s, active: false }))}
                            onDoubleClick={() => !isHeader && startEditingCell(originalIndex, c)}
                          >
                            {isEditing ? (
                              <input
                                ref={cellInputRef}
                                value={editingValue}
                                onChange={(e) => setEditingValue(e.target.value)}
                                className="w-full px-1 py-0.5 border border-primary rounded text-sm bg-white"
                                onBlur={commitCellEdit}
                              />
                            ) : chip ? (
                              <span className={cn("inline-flex items-center justify-center border rounded-full px-2 py-1 text-xs font-bold", chipClass(chip))}>
                                {chip}
                              </span>
                            ) : (
                              <span className={c === 0 ? "font-semibold truncate block max-w-[150px]" : ""}>{txt}</span>
                            )}
                          </td>
                        );
                      })}
                      
                      {/* Delete row button */}
                      {editMode && (
                        <td className="px-1">
                          {!isHeader && (
                            <button
                              onClick={() => deleteRow(originalIndex)}
                              className="p-1 rounded hover:bg-red-100 text-muted-foreground hover:text-red-600"
                              title="Excluir linha"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}

                {bottomPad > 0 && (
                  <tr><td colSpan={visibleCols.length + (editMode ? 2 : 1)} style={{ height: bottomPad }} /></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Filter Popover */}
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

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground flex flex-wrap gap-3 shrink-0 bg-muted/30">
        {editMode ? (
          <>
            <span>🖱️ Duplo clique para editar célula</span>
            <span>📝 Duplo clique no cabeçalho para renomear</span>
            <span>⌨️ Enter salva • Esc cancela</span>
            <span>💾 Ctrl+S salvar</span>
          </>
        ) : (
          <>
            <span>📚 Campos</span>
            <span>⛃ Filtros</span>
            <span>🖱️ Selecionar</span>
            <span>Ctrl+C copiar</span>
          </>
        )}
      </div>

      {/* Add Column Dialog */}
      <Dialog open={addColDialog} onOpenChange={setAddColDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Coluna</DialogTitle>
            <DialogDescription>
              Digite o nome da nova coluna
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Nome da coluna</label>
              <Input
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
                placeholder="Ex: Status, Observação..."
                autoFocus
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Posição</label>
              <div className="flex gap-2">
                <Button
                  variant={newColPosition === "start" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setNewColPosition("start")}
                >
                  Início
                </Button>
                <Button
                  variant={newColPosition === "end" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setNewColPosition("end")}
                >
                  Final
                </Button>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddColDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => addColumn(newColPosition, newColName || "Nova Coluna")}
              disabled={!newColName.trim()}
            >
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
