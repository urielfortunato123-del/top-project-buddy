import React, { useMemo, useRef, useEffect, useState } from "react";
import type { GenericRow } from "@/lib/database";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface MatrixTableProps {
  /** Linhas visíveis (já filtradas) usadas para preencher os valores */
  rows: GenericRow[];
  /** Linhas de domínio (sem filtros) usadas para garantir que todos os funcionários/colunas apareçam */
  domainRows?: GenericRow[];
  rowColumn: string; // Coluna para usar como linhas
  colColumn: string; // Coluna para usar como colunas
  valueColumn: string; // Coluna para mostrar os valores
}

// Cores para diferentes valores
const VALUE_COLORS = [
  { bg: "bg-green-100", text: "text-green-700", border: "border-green-300" },
  { bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-300" },
  { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-300" },
  { bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-300" },
  { bg: "bg-pink-100", text: "text-pink-700", border: "border-pink-300" },
  { bg: "bg-cyan-100", text: "text-cyan-700", border: "border-cyan-300" },
  { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-300" },
  { bg: "bg-gray-100", text: "text-gray-500", border: "border-gray-200" },
];

function formatValue(value: any): string {
  if (value == null || value === "") return "-";
  const s = String(value).trim();
  // Se for data, formata
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [, month, day] = s.split("-");
    return `${day}/${month}`;
  }
  // Se for muito longo, abrevia
  if (s.length > 6) return s.slice(0, 4).toUpperCase();
  return s.slice(0, 5).toUpperCase();
}

function getShortLabel(value: any): string {
  if (value == null || value === "") return "-";
  const s = String(value).trim();
  // Primeira palavra, até 4 caracteres
  const first = s.split(/\s+/)[0];
  return first.slice(0, 4).toUpperCase();
}

export function MatrixTable({ rows, domainRows, rowColumn, colColumn, valueColumn }: MatrixTableProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 30 });

  const domain = domainRows ?? rows;
  
  // Agrupa dados
  const { cols, rowKeys, valueMap, colorMap } = useMemo(() => {
    const colsSet = new Set<string>();
    const rowsSet = new Set<string>();
    const map = new Map<string, any>();
    const uniqueValues = new Set<string>();

    // 1) Eixos (linhas/colunas) vêm do domínio (sem filtro)
    for (const r of domain) {
      const rowKey = String(r[rowColumn] || "(vazio)");
      const colKey = String(r[colColumn] || "(vazio)");
      colsSet.add(colKey);
      rowsSet.add(rowKey);
    }

    // 2) Valores vêm das linhas filtradas (para respeitar filtros)
    for (const r of rows) {
      const rowKey = String(r[rowColumn] || "(vazio)");
      const colKey = String(r[colColumn] || "(vazio)");
      const value = r[valueColumn];

      const key = `${rowKey}|${colKey}`;
      map.set(key, value);
      uniqueValues.add(String(value || "(vazio)"));
    }

    // Cria mapa de cores
    const colorMap = new Map<string, typeof VALUE_COLORS[0]>();
    Array.from(uniqueValues).forEach((v, idx) => {
      colorMap.set(v, VALUE_COLORS[idx % VALUE_COLORS.length]);
    });

    return {
      cols: Array.from(colsSet).sort(),
      rowKeys: Array.from(rowsSet).sort(),
      valueMap: map,
      colorMap,
    };
  }, [domain, rows, rowColumn, colColumn, valueColumn]);

  // Virtualização
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

  if (cols.length === 0 || rowKeys.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <p className="text-sm">Nenhum dado para matriz</p>
      </div>
    );
  }

  // Limita colunas para performance
  const displayCols = cols.slice(0, 50);

  return (
    <TooltipProvider delayDuration={100}>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b bg-gray-50 shrink-0">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-gray-800">Matriz: {rowColumn} × {colColumn}</h3>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            <span className="font-medium">{rowKeys.length}</span> {rowColumn} • <span className="font-medium">{cols.length}</span> {colColumn}
          </div>
        </div>

        {/* Table container */}
        <div 
          ref={containerRef}
          className="flex-1 overflow-auto"
        >
          <div style={{ height: totalHeight + 48, position: "relative", minWidth: 160 + displayCols.length * 52 }}>
            {/* Sticky Header Row */}
            <div className="sticky top-0 z-20 flex bg-white border-b shadow-sm">
              <div className="sticky left-0 z-30 w-40 min-w-40 px-3 py-2 bg-gray-100 border-r font-semibold text-xs text-gray-700 truncate">
                {rowColumn}
              </div>
              {displayCols.map((col) => (
                <div
                  key={col}
                  className="w-[52px] min-w-[52px] px-1 py-2 text-center text-xs font-medium text-gray-600 bg-gray-50 border-r truncate"
                  title={col}
                >
                  {formatValue(col)}
                </div>
              ))}
            </div>

            {/* Virtualized Rows */}
            <div style={{ transform: `translateY(${offsetTop}px)`, position: "absolute", top: 48, left: 0, right: 0 }}>
              {visibleRows.map((rowKey) => (
                <div
                  key={rowKey}
                  className="flex border-b hover:bg-gray-50/50"
                  style={{ height: ROW_HEIGHT }}
                >
                  {/* Row name - sticky left */}
                  <div className="sticky left-0 z-10 w-40 min-w-40 px-3 flex items-center bg-white border-r">
                    <span className="text-xs font-medium text-gray-800 truncate" title={rowKey}>
                      {rowKey}
                    </span>
                  </div>

                  {/* Value cells */}
                  {displayCols.map((col) => {
                    const key = `${rowKey}|${col}`;
                    const value = valueMap.get(key);
                    const label = getShortLabel(value);
                    const color = colorMap.get(String(value || "(vazio)")) || VALUE_COLORS[VALUE_COLORS.length - 1];

                    return (
                      <Tooltip key={col}>
                        <TooltipTrigger asChild>
                          <div className="w-[52px] min-w-[52px] flex items-center justify-center border-r">
                            <span
                              className={`px-2 py-1 rounded-full text-[10px] font-semibold cursor-default transition-transform hover:scale-110 border ${color.bg} ${color.text} ${color.border}`}
                            >
                              {label}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs bg-gray-900 text-white border-0">
                          <div className="space-y-0.5">
                            <p><span className="text-gray-400">{rowColumn}:</span> {rowKey}</p>
                            <p><span className="text-gray-400">{colColumn}:</span> {col}</p>
                            <p><span className="text-gray-400">{valueColumn}:</span> {value || "(vazio)"}</p>
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
      </div>
    </TooltipProvider>
  );
}
