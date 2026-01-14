import React, { useMemo } from "react";
import type { Dataset } from "@/lib/database";
import { cn } from "@/lib/utils";

interface SpreadsheetViewProps {
  dataset: Dataset;
  personFilter: string;
  statusFilter: string;
  teamFilter: string;
}

const STATUS_COLORS: Record<string, string> = {
  ENTREGUE: "bg-primary/20 text-primary",
  FOLGA: "bg-secondary/20 text-secondary",
  "BANCO DE HORAS": "bg-accent/20 text-accent",
  FALTA: "bg-destructive/20 text-destructive",
  ATESTADO: "bg-purple-500/20 text-purple-600",
  FÉRIAS: "bg-blue-500/20 text-blue-600",
  VAZIO: "bg-muted text-muted-foreground",
};

export function SpreadsheetView({ dataset, personFilter, statusFilter, teamFilter }: SpreadsheetViewProps) {
  const { filteredRows, dates, people } = useMemo(() => {
    let filtered = dataset.rows;
    
    if (teamFilter !== "ALL") {
      filtered = filtered.filter((r) => r.team === teamFilter);
    }
    if (personFilter !== "ALL") {
      filtered = filtered.filter((r) => r.person === personFilter);
    }
    if (statusFilter !== "ALL") {
      filtered = filtered.filter((r) => r.status === statusFilter);
    }

    const datesSet = new Set(filtered.map((r) => r.date));
    const peopleSet = new Set(filtered.map((r) => r.person));

    const dates = Array.from(datesSet).sort();
    const people = Array.from(peopleSet).sort();

    return { filteredRows: filtered, dates, people };
  }, [dataset.rows, personFilter, statusFilter, teamFilter]);

  const getStatus = (person: string, date: string) => {
    const row = filteredRows.find((r) => r.person === person && r.date === date);
    return row?.status || "VAZIO";
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  };

  if (dates.length === 0 || people.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Nenhum dado para exibir com os filtros selecionados
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <table className="min-w-full border-collapse text-xs">
        <thead className="sticky top-0 z-10">
          <tr className="bg-muted">
            <th className="sticky left-0 z-20 bg-muted px-3 py-2 text-left font-bold border-b border-r border-border">
              Pessoa
            </th>
            {dates.map((date) => (
              <th
                key={date}
                className="px-2 py-2 text-center font-semibold border-b border-border whitespace-nowrap"
              >
                {formatDate(date)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {people.map((person, idx) => (
            <tr key={person} className={idx % 2 === 0 ? "bg-card" : "bg-muted/30"}>
              <td className="sticky left-0 z-10 bg-inherit px-3 py-2 font-medium border-r border-border whitespace-nowrap">
                {person}
              </td>
              {dates.map((date) => {
                const status = getStatus(person, date);
                return (
                  <td key={date} className="px-1 py-1 text-center border-b border-border">
                    <span
                      className={cn(
                        "inline-block px-2 py-1 rounded text-[10px] font-semibold",
                        STATUS_COLORS[status] || "bg-muted text-muted-foreground"
                      )}
                    >
                      {status === "VAZIO" ? "-" : status.slice(0, 3)}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
