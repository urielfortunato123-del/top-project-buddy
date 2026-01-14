import React, { useMemo, useRef, useEffect, useState } from "react";
import type { DatasetRow } from "@/lib/database";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface MatrixTableProps {
  rows: DatasetRow[];
}

const STATUS_CHIPS: Record<string, { label: string; bg: string; text: string; border: string }> = {
  "ENTREGUE": { 
    label: "ENT", 
    bg: "bg-green-100", 
    text: "text-green-700", 
    border: "border-green-300" 
  },
  "FOLGA": { 
    label: "FOL", 
    bg: "bg-orange-100", 
    text: "text-orange-700", 
    border: "border-orange-300" 
  },
  "BANCO DE HORAS": { 
    label: "BAN", 
    bg: "bg-blue-100", 
    text: "text-blue-700", 
    border: "border-blue-300" 
  },
  "VAZIO": { 
    label: "-", 
    bg: "bg-gray-100", 
    text: "text-gray-500", 
    border: "border-gray-200" 
  },
};

function formatDayMonth(dateStr: string): string {
  const [, month, day] = dateStr.split("-");
  return `${day}/${month}`;
}

export function MatrixTable({ rows }: MatrixTableProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 30 });
  
  // Get unique sorted dates and people
  const { days, people, statusMap } = useMemo(() => {
    const daysSet = new Set<string>();
    const peopleSet = new Set<string>();
    const map = new Map<string, { status: string; team: string }>();
    
    for (const r of rows) {
      daysSet.add(r.date);
      peopleSet.add(r.person);
      const key = `${r.person}|${r.date}`;
      map.set(key, { status: r.status, team: r.team || "GERAL" });
    }
    
    return {
      days: Array.from(daysSet).sort(),
      people: Array.from(peopleSet).sort(),
      statusMap: map,
    };
  }, [rows]);

  // Virtualization for people (rows)
  const ROW_HEIGHT = 40;
  const VISIBLE_BUFFER = 5;
  
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const containerHeight = container.clientHeight;
      const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - VISIBLE_BUFFER);
      const end = Math.min(people.length, Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + VISIBLE_BUFFER);
      setVisibleRange({ start, end });
    };
    
    handleScroll();
    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [people.length]);

  const visiblePeople = people.slice(visibleRange.start, visibleRange.end);
  const totalHeight = people.length * ROW_HEIGHT;
  const offsetTop = visibleRange.start * ROW_HEIGHT;

  if (days.length === 0 || people.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <p className="text-sm">Nenhum dado para exibir</p>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={100}>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b bg-gray-50 shrink-0">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-gray-800">Matriz Pessoa × Dia</h3>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1">
                <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-green-100 text-green-700 border border-green-300">ENT</span>
                <span className="text-gray-500">Entregue</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-700 border border-orange-300">FOL</span>
                <span className="text-gray-500">Folga</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700 border border-blue-300">BAN</span>
                <span className="text-gray-500">Banco</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-500 border border-gray-200">-</span>
                <span className="text-gray-500">Sem Info</span>
              </span>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            <span className="font-medium">{people.length}</span> pessoas • <span className="font-medium">{days.length}</span> dias • <span className="font-medium">{rows.length}</span> registros
          </div>
        </div>

        {/* Table container */}
        <div 
          ref={containerRef}
          className="flex-1 overflow-auto"
        >
          <div style={{ height: totalHeight + 48, position: "relative", minWidth: 160 + days.length * 52 }}>
            {/* Sticky Header Row */}
            <div className="sticky top-0 z-20 flex bg-white border-b shadow-sm">
              <div className="sticky left-0 z-30 w-40 min-w-40 px-3 py-2 bg-gray-100 border-r font-semibold text-xs text-gray-700">
                Colaborador
              </div>
              {days.map((day) => (
                <div
                  key={day}
                  className="w-[52px] min-w-[52px] px-1 py-2 text-center text-xs font-medium text-gray-600 bg-gray-50 border-r"
                >
                  {formatDayMonth(day)}
                </div>
              ))}
            </div>

            {/* Virtualized Rows */}
            <div style={{ transform: `translateY(${offsetTop}px)`, position: "absolute", top: 48, left: 0, right: 0 }}>
              {visiblePeople.map((person) => (
                <div
                  key={person}
                  className="flex border-b hover:bg-gray-50/50"
                  style={{ height: ROW_HEIGHT }}
                >
                  {/* Person name - sticky left */}
                  <div className="sticky left-0 z-10 w-40 min-w-40 px-3 flex items-center bg-white border-r">
                    <span className="text-xs font-medium text-gray-800 truncate" title={person}>
                      {person}
                    </span>
                  </div>

                  {/* Status cells */}
                  {days.map((day) => {
                    const key = `${person}|${day}`;
                    const data = statusMap.get(key);
                    const status = data?.status || "VAZIO";
                    const team = data?.team || "-";
                    const chip = STATUS_CHIPS[status] || STATUS_CHIPS["VAZIO"];

                    return (
                      <Tooltip key={day}>
                        <TooltipTrigger asChild>
                          <div className="w-[52px] min-w-[52px] flex items-center justify-center border-r">
                            <span
                              className={`px-2 py-1 rounded-full text-[10px] font-semibold cursor-default transition-transform hover:scale-110 border ${chip.bg} ${chip.text} ${chip.border}`}
                            >
                              {chip.label}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs bg-gray-900 text-white border-0">
                          <div className="space-y-0.5">
                            <p><span className="text-gray-400">Pessoa:</span> {person}</p>
                            <p><span className="text-gray-400">Data:</span> {formatDayMonth(day)}</p>
                            <p><span className="text-gray-400">Status:</span> {status === "VAZIO" ? "Sem Info" : status}</p>
                            <p><span className="text-gray-400">Equipe:</span> {team}</p>
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
