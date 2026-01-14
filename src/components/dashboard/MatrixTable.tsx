import React, { useMemo, useRef, useEffect, useState } from "react";
import type { DatasetRow } from "@/lib/database";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface MatrixTableProps {
  rows: DatasetRow[];
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  "ENTREGUE": { 
    label: "ENT", 
    className: "bg-primary/20 text-primary border-primary/40 hover:bg-primary/30" 
  },
  "FOLGA": { 
    label: "FOL", 
    className: "bg-secondary/20 text-secondary border-secondary/40 hover:bg-secondary/30" 
  },
  "BANCO DE HORAS": { 
    label: "BAN", 
    className: "bg-accent/20 text-accent border-accent/40 hover:bg-accent/30" 
  },
  "VAZIO": { 
    label: "-", 
    className: "bg-muted/50 text-muted-foreground border-muted hover:bg-muted" 
  },
};

function formatDayMonth(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}`;
}

export function MatrixTable({ rows }: MatrixTableProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 });
  
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
  const ROW_HEIGHT = 36;
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
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>Nenhum dado para exibir na matriz</p>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="h-full flex flex-col bg-card rounded-2xl border shadow-lg overflow-hidden">
        {/* Header with legend */}
        <div className="p-3 border-b bg-muted/30 flex items-center justify-between shrink-0">
          <h3 className="font-semibold text-sm">Matriz Pessoa × Dia</h3>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1">
              <span className="px-2 py-0.5 rounded-full border text-[10px] font-bold bg-primary/20 text-primary border-primary/40">ENT</span>
              <span className="text-muted-foreground">Entregue</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="px-2 py-0.5 rounded-full border text-[10px] font-bold bg-secondary/20 text-secondary border-secondary/40">FOL</span>
              <span className="text-muted-foreground">Folga</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="px-2 py-0.5 rounded-full border text-[10px] font-bold bg-accent/20 text-accent border-accent/40">BAN</span>
              <span className="text-muted-foreground">Banco</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="px-2 py-0.5 rounded-full border text-[10px] font-bold bg-muted/50 text-muted-foreground border-muted">-</span>
              <span className="text-muted-foreground">Sem Info</span>
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div className="px-3 py-2 border-b bg-background text-xs text-muted-foreground flex gap-4 shrink-0">
          <span><strong>{people.length}</strong> pessoas</span>
          <span><strong>{days.length}</strong> dias</span>
          <span><strong>{rows.length}</strong> registros</span>
        </div>

        {/* Table container with virtualization */}
        <div className="flex-1 overflow-hidden flex">
          {/* Fixed names column */}
          <div 
            ref={containerRef}
            className="flex-1 overflow-auto"
          >
            <div style={{ height: totalHeight, position: "relative" }}>
              {/* Header row (sticky) */}
              <div className="sticky top-0 z-20 flex bg-card border-b">
                <div className="sticky left-0 z-30 w-36 min-w-36 px-3 py-2 bg-muted/50 border-r font-semibold text-xs truncate">
                  Colaborador
                </div>
                {days.map((day) => (
                  <div
                    key={day}
                    className="w-12 min-w-12 px-1 py-2 text-center text-xs font-medium bg-muted/50 border-r"
                  >
                    {formatDayMonth(day)}
                  </div>
                ))}
              </div>

              {/* Virtualized rows */}
              <div style={{ transform: `translateY(${offsetTop}px)` }}>
                {visiblePeople.map((person) => (
                  <div
                    key={person}
                    className="flex border-b hover:bg-muted/20 transition-colors"
                    style={{ height: ROW_HEIGHT }}
                  >
                    {/* Fixed person name */}
                    <div className="sticky left-0 z-10 w-36 min-w-36 px-3 flex items-center bg-card border-r">
                      <span className="text-xs font-medium truncate" title={person}>
                        {person}
                      </span>
                    </div>

                    {/* Status cells */}
                    {days.map((day) => {
                      const key = `${person}|${day}`;
                      const data = statusMap.get(key);
                      const status = data?.status || "VAZIO";
                      const team = data?.team || "-";
                      const config = STATUS_CONFIG[status] || STATUS_CONFIG["VAZIO"];

                      return (
                        <Tooltip key={day}>
                          <TooltipTrigger asChild>
                            <div className="w-12 min-w-12 px-0.5 flex items-center justify-center border-r">
                              <span
                                className={cn(
                                  "px-1.5 py-0.5 rounded-full border text-[10px] font-bold cursor-default transition-all",
                                  config.className
                                )}
                              >
                                {config.label}
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            <div className="space-y-1">
                              <p><strong>Pessoa:</strong> {person}</p>
                              <p><strong>Data:</strong> {formatDayMonth(day)}</p>
                              <p><strong>Status:</strong> {status === "VAZIO" ? "Sem Info" : status}</p>
                              <p><strong>Equipe:</strong> {team}</p>
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
      </div>
    </TooltipProvider>
  );
}
