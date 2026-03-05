import React, { useMemo, useRef, useEffect, useState } from "react";
import type { GenericRow } from "@/lib/database";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, Calendar, Tag } from "lucide-react";

interface MatrixTableProps {
  rows: GenericRow[];
  domainRows?: GenericRow[];
  rowColumn: string;
  colColumn: string;
  valueColumn: string;
  availableColumns?: string[];
  onColumnsChange?: (row: string, col: string, value: string) => void;
}

// Status-aware color mapping using CSS tokens
const STATUS_COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
  ENTREGUE: { bg: "bg-[hsl(var(--status-ent-bg))]", text: "text-[hsl(var(--status-ent-fg))]", border: "border-[hsl(var(--status-ent-fg)/0.3)]" },
  ENT: { bg: "bg-[hsl(var(--status-ent-bg))]", text: "text-[hsl(var(--status-ent-fg))]", border: "border-[hsl(var(--status-ent-fg)/0.3)]" },
  FOLGA: { bg: "bg-[hsl(var(--status-fol-bg))]", text: "text-[hsl(var(--status-fol-fg))]", border: "border-[hsl(var(--status-fol-fg)/0.3)]" },
  FOL: { bg: "bg-[hsl(var(--status-fol-bg))]", text: "text-[hsl(var(--status-fol-fg))]", border: "border-[hsl(var(--status-fol-fg)/0.3)]" },
  "BANCO DE HORAS": { bg: "bg-[hsl(var(--status-ban-bg))]", text: "text-[hsl(var(--status-ban-fg))]", border: "border-[hsl(var(--status-ban-fg)/0.3)]" },
  BANCO: { bg: "bg-[hsl(var(--status-ban-bg))]", text: "text-[hsl(var(--status-ban-fg))]", border: "border-[hsl(var(--status-ban-fg)/0.3)]" },
  BAN: { bg: "bg-[hsl(var(--status-ban-bg))]", text: "text-[hsl(var(--status-ban-fg))]", border: "border-[hsl(var(--status-ban-fg)/0.3)]" },
  FALTA: { bg: "bg-[hsl(var(--status-fal-bg))]", text: "text-[hsl(var(--status-fal-fg))]", border: "border-[hsl(var(--status-fal-fg)/0.3)]" },
  FAL: { bg: "bg-[hsl(var(--status-fal-bg))]", text: "text-[hsl(var(--status-fal-fg))]", border: "border-[hsl(var(--status-fal-fg)/0.3)]" },
  ATESTADO: { bg: "bg-[hsl(var(--status-ate-bg))]", text: "text-[hsl(var(--status-ate-fg))]", border: "border-[hsl(var(--status-ate-fg)/0.3)]" },
  ATE: { bg: "bg-[hsl(var(--status-ate-bg))]", text: "text-[hsl(var(--status-ate-fg))]", border: "border-[hsl(var(--status-ate-fg)/0.3)]" },
  "FÉRIAS": { bg: "bg-[hsl(var(--status-fer-bg))]", text: "text-[hsl(var(--status-fer-fg))]", border: "border-[hsl(var(--status-fer-fg)/0.3)]" },
  FERIAS: { bg: "bg-[hsl(var(--status-fer-bg))]", text: "text-[hsl(var(--status-fer-fg))]", border: "border-[hsl(var(--status-fer-fg)/0.3)]" },
  FER: { bg: "bg-[hsl(var(--status-fer-bg))]", text: "text-[hsl(var(--status-fer-fg))]", border: "border-[hsl(var(--status-fer-fg)/0.3)]" },
};

const DEFAULT_COLOR = { bg: "bg-[hsl(var(--status-empty-bg))]", text: "text-[hsl(var(--status-empty-fg))]", border: "border-[hsl(var(--status-empty-fg)/0.2)]" };

// Fallback indexed colors for non-status values
const INDEXED_COLORS = [
  { bg: "bg-[hsl(var(--chart-1)/0.15)]", text: "text-[hsl(var(--chart-1))]", border: "border-[hsl(var(--chart-1)/0.3)]" },
  { bg: "bg-[hsl(var(--chart-2)/0.15)]", text: "text-[hsl(var(--chart-2))]", border: "border-[hsl(var(--chart-2)/0.3)]" },
  { bg: "bg-[hsl(var(--chart-3)/0.15)]", text: "text-[hsl(var(--chart-3))]", border: "border-[hsl(var(--chart-3)/0.3)]" },
  { bg: "bg-[hsl(var(--chart-4)/0.15)]", text: "text-[hsl(var(--chart-4))]", border: "border-[hsl(var(--chart-4)/0.3)]" },
  { bg: "bg-[hsl(var(--chart-5)/0.15)]", text: "text-[hsl(var(--chart-5))]", border: "border-[hsl(var(--chart-5)/0.3)]" },
  { bg: "bg-[hsl(var(--chart-6)/0.15)]", text: "text-[hsl(var(--chart-6))]", border: "border-[hsl(var(--chart-6)/0.3)]" },
];

function getValueColor(value: string, idx: number) {
  const normalized = value.trim().toUpperCase();
  if (STATUS_COLOR_MAP[normalized]) return STATUS_COLOR_MAP[normalized];
  if (!value || value === "-" || value === "(vazio)" || normalized === "VAZIO") return DEFAULT_COLOR;
  return INDEXED_COLORS[idx % INDEXED_COLORS.length];
}

function formatValue(value: any): string {
  if (value == null || value === "") return "-";
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [, month, day] = s.split("-");
    return `${day}/${month}`;
  }
  if (s.length > 6) return s.slice(0, 4).toUpperCase();
  return s.slice(0, 5).toUpperCase();
}

function getShortLabel(value: any): string {
  if (value == null || value === "") return "-";
  const s = String(value).trim();
  const first = s.split(/\s+/)[0];
  return first.slice(0, 4).toUpperCase();
}

export function MatrixTable({ 
  rows, 
  domainRows, 
  rowColumn: initialRowColumn, 
  colColumn: initialColColumn, 
  valueColumn: initialValueColumn,
  availableColumns = [],
  onColumnsChange,
}: MatrixTableProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 30 });
  
  const [selectedRowCol, setSelectedRowCol] = useState(initialRowColumn);
  const [selectedColCol, setSelectedColCol] = useState(initialColColumn);
  const [selectedValueCol, setSelectedValueCol] = useState(initialValueColumn);

  useEffect(() => { if (initialRowColumn) setSelectedRowCol(initialRowColumn); }, [initialRowColumn]);
  useEffect(() => { if (initialColColumn) setSelectedColCol(initialColColumn); }, [initialColColumn]);
  useEffect(() => { if (initialValueColumn) setSelectedValueCol(initialValueColumn); }, [initialValueColumn]);

  const handleRowColChange = (val: string) => { setSelectedRowCol(val); onColumnsChange?.(val, selectedColCol, selectedValueCol); };
  const handleColColChange = (val: string) => { setSelectedColCol(val); onColumnsChange?.(selectedRowCol, val, selectedValueCol); };
  const handleValueColChange = (val: string) => { setSelectedValueCol(val); onColumnsChange?.(selectedRowCol, selectedColCol, val); };

  const rowColumn = selectedRowCol || initialRowColumn;
  const colColumn = selectedColCol || initialColColumn;
  const valueColumn = selectedValueCol || initialValueColumn;
  const domain = domainRows ?? rows;
  
  const { cols, rowKeys, valueMap, colorMap } = useMemo(() => {
    const colsSet = new Set<string>();
    const rowsSet = new Set<string>();
    const map = new Map<string, any>();
    const uniqueValues = new Set<string>();

    for (const r of domain) {
      const rowKey = String(r[rowColumn] || "(vazio)").trim();
      const colKey = String(r[colColumn] || "(vazio)");
      colsSet.add(colKey);
      if (rowKey) rowsSet.add(rowKey);
    }

    for (const r of rows) {
      const rowKey = String(r[rowColumn] || "(vazio)").trim();
      const colKey = String(r[colColumn] || "(vazio)");
      const value = r[valueColumn];
      if (rowKey) {
        const key = `${rowKey}|${colKey}`;
        map.set(key, value);
        uniqueValues.add(String(value || "(vazio)"));
      }
    }

    const colorMap = new Map<string, { bg: string; text: string; border: string }>();
    let idx = 0;
    Array.from(uniqueValues).forEach((v) => {
      colorMap.set(v, getValueColor(v, idx));
      idx++;
    });

    return {
      cols: Array.from(colsSet).sort(),
      rowKeys: Array.from(rowsSet).sort(),
      valueMap: map,
      colorMap,
    };
  }, [domain, rows, rowColumn, colColumn, valueColumn]);

  const ROW_HEIGHT = 40;
  const VISIBLE_BUFFER = 5;
  
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const containerHeight = container.clientHeight;
      const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - VISIBLE_BUFFER);
      const end = Math.min(rowKeys.length, Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + VISIBLE_BUFFER);
      setVisibleRange({ start, end });
    };
    handleScroll();
    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [rowKeys.length]);

  const visibleRows = rowKeys.slice(visibleRange.start, visibleRange.end);
  const totalHeight = rowKeys.length * ROW_HEIGHT;
  const offsetTop = visibleRange.start * ROW_HEIGHT;

  const columnOptions = useMemo(() => {
    if (availableColumns.length > 0) return availableColumns;
    const cols = new Set<string>();
    for (const r of rows.slice(0, 100)) {
      Object.keys(r).forEach(k => cols.add(k));
    }
    return Array.from(cols).filter(Boolean);
  }, [availableColumns, rows]);

  const ColumnSelectors = () => (
    <div className="grid grid-cols-3 gap-2">
      <div className="space-y-1">
        <label className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Users className="w-3 h-3" /> Pessoa
        </label>
        <Select value={selectedRowCol} onValueChange={handleRowColChange}>
          <SelectTrigger className="h-8 text-xs bg-input border-border">
            <SelectValue placeholder="Coluna..." />
          </SelectTrigger>
          <SelectContent className="bg-popover z-50">
            {columnOptions.map((col) => (
              <SelectItem key={col} value={col} className="text-xs">{col}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <label className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Calendar className="w-3 h-3" /> Data
        </label>
        <Select value={selectedColCol} onValueChange={handleColColChange}>
          <SelectTrigger className="h-8 text-xs bg-input border-border">
            <SelectValue placeholder="Coluna..." />
          </SelectTrigger>
          <SelectContent className="bg-popover z-50">
            {columnOptions.map((col) => (
              <SelectItem key={col} value={col} className="text-xs">{col}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <label className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Tag className="w-3 h-3" /> Status
        </label>
        <Select value={selectedValueCol} onValueChange={handleValueColChange}>
          <SelectTrigger className="h-8 text-xs bg-input border-border">
            <SelectValue placeholder="Coluna..." />
          </SelectTrigger>
          <SelectContent className="bg-popover z-50">
            {columnOptions.map((col) => (
              <SelectItem key={col} value={col} className="text-xs">{col}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  if (cols.length === 0 || rowKeys.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="px-4 py-3 border-b bg-muted/50 shrink-0 space-y-3">
          <h3 className="font-bold text-sm text-card-foreground">Configurar Matriz</h3>
          <ColumnSelectors />
        </div>
        <div className="flex items-center justify-center flex-1 text-muted-foreground">
          <p className="text-sm">Nenhum dado para matriz</p>
        </div>
      </div>
    );
  }

  const displayCols = cols.slice(0, 50);

  return (
    <TooltipProvider delayDuration={100}>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b bg-muted/50 shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-card-foreground">Matriz: {rowColumn} × {colColumn}</h3>
            <span className="text-[10px] text-muted-foreground">{rowKeys.length} × {cols.length}</span>
          </div>
          <ColumnSelectors />
        </div>

        {/* Table */}
        <div ref={containerRef} className="flex-1 overflow-auto">
          <div style={{ height: totalHeight + 48, position: "relative", minWidth: 160 + displayCols.length * 52 }}>
            {/* Sticky Header */}
            <div className="sticky top-0 z-20 flex bg-card border-b shadow-sm">
              <div className="sticky left-0 z-30 w-40 min-w-40 px-3 py-2 bg-muted border-r font-semibold text-xs text-card-foreground truncate">
                {rowColumn}
              </div>
              {displayCols.map((col) => (
                <div
                  key={col}
                  className="w-[52px] min-w-[52px] px-1 py-2 text-center text-xs font-medium text-muted-foreground bg-muted/50 border-r truncate"
                  title={col}
                >
                  {formatValue(col)}
                </div>
              ))}
            </div>

            {/* Rows */}
            <div style={{ transform: `translateY(${offsetTop}px)`, position: "absolute", top: 48, left: 0, right: 0 }}>
              {visibleRows.map((rowKey, rowIdx) => (
                <div
                  key={rowKey}
                  className={`flex border-b border-border/50 ${rowIdx % 2 === 0 ? 'bg-card' : 'bg-muted/20'} hover:bg-muted/40 transition-colors`}
                  style={{ height: ROW_HEIGHT }}
                >
                  <div className="sticky left-0 z-10 w-40 min-w-40 px-3 flex items-center bg-card border-r border-border/50">
                    <span className="text-xs font-medium text-card-foreground truncate" title={rowKey}>
                      {rowKey}
                    </span>
                  </div>

                  {displayCols.map((col) => {
                    const key = `${rowKey}|${col}`;
                    const value = valueMap.get(key);
                    const label = getShortLabel(value);
                    const color = colorMap.get(String(value || "(vazio)")) || DEFAULT_COLOR;

                    return (
                      <Tooltip key={col}>
                        <TooltipTrigger asChild>
                          <div className="w-[52px] min-w-[52px] flex items-center justify-center border-r border-border/30">
                            <span
                              className={`px-2 py-1 rounded-full text-[10px] font-semibold cursor-default transition-transform hover:scale-110 border ${color.bg} ${color.text} ${color.border}`}
                            >
                              {label}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs bg-popover text-popover-foreground border border-border">
                          <div className="space-y-0.5">
                            <p><span className="text-muted-foreground">{rowColumn}:</span> {rowKey}</p>
                            <p><span className="text-muted-foreground">{colColumn}:</span> {col}</p>
                            <p><span className="text-muted-foreground">{valueColumn}:</span> {value || "(vazio)"}</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="px-4 py-3 border-t bg-muted/50 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-muted-foreground font-medium mr-1">Legenda:</span>
            {Array.from(colorMap.entries()).map(([value, color]) => (
              <div 
                key={value} 
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border ${color.bg} ${color.text} ${color.border}`}
              >
                <span className="font-semibold">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
