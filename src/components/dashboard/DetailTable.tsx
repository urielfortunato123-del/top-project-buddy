import React, { useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { GenericRow } from "@/lib/database";

interface DetailTableProps {
  rows: GenericRow[];
  dateColumn: string;
  personColumn: string;
  teamColumn: string;
  statusColumn: string;
}

const statusColors: Record<string, { bg: string; text: string }> = {
  ENTREGUE: { bg: "bg-[hsl(var(--status-ent-bg))]", text: "text-[hsl(var(--status-ent-fg))]" },
  ENT: { bg: "bg-[hsl(var(--status-ent-bg))]", text: "text-[hsl(var(--status-ent-fg))]" },
  FOLGA: { bg: "bg-[hsl(var(--status-fol-bg))]", text: "text-[hsl(var(--status-fol-fg))]" },
  FOL: { bg: "bg-[hsl(var(--status-fol-bg))]", text: "text-[hsl(var(--status-fol-fg))]" },
  "BANCO DE HORAS": { bg: "bg-[hsl(var(--status-ban-bg))]", text: "text-[hsl(var(--status-ban-fg))]" },
  BANCO: { bg: "bg-[hsl(var(--status-ban-bg))]", text: "text-[hsl(var(--status-ban-fg))]" },
  BAN: { bg: "bg-[hsl(var(--status-ban-bg))]", text: "text-[hsl(var(--status-ban-fg))]" },
  FALTA: { bg: "bg-[hsl(var(--status-fal-bg))]", text: "text-[hsl(var(--status-fal-fg))]" },
  FAL: { bg: "bg-[hsl(var(--status-fal-bg))]", text: "text-[hsl(var(--status-fal-fg))]" },
  ATESTADO: { bg: "bg-[hsl(var(--status-ate-bg))]", text: "text-[hsl(var(--status-ate-fg))]" },
  ATE: { bg: "bg-[hsl(var(--status-ate-bg))]", text: "text-[hsl(var(--status-ate-fg))]" },
  "FÉRIAS": { bg: "bg-[hsl(var(--status-fer-bg))]", text: "text-[hsl(var(--status-fer-fg))]" },
  FERIAS: { bg: "bg-[hsl(var(--status-fer-bg))]", text: "text-[hsl(var(--status-fer-fg))]" },
  FER: { bg: "bg-[hsl(var(--status-fer-bg))]", text: "text-[hsl(var(--status-fer-fg))]" },
};

function getStatusColor(status: string) {
  const normalized = String(status || "").trim().toUpperCase();
  return statusColors[normalized] || { bg: "bg-[hsl(var(--status-empty-bg))]", text: "text-[hsl(var(--status-empty-fg))]" };
}

function formatDate(value: string): string {
  if (!value) return "-";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [y, m, d] = value.slice(0, 10).split("-");
    return `${d}/${m}`;
  }
  return value;
}

export function DetailTable({ rows, dateColumn, personColumn, teamColumn, statusColumn }: DetailTableProps) {
  const sortedRows = useMemo(() => {
    return [...rows]
      .sort((a, b) => {
        const dateA = String(a[dateColumn] || "");
        const dateB = String(b[dateColumn] || "");
        return dateB.localeCompare(dateA);
      })
      .slice(0, 500);
  }, [rows, dateColumn]);

  if (sortedRows.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        Nenhum registro para exibir
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b bg-muted/50 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Detalhes ({rows.length > 500 ? `500 de ${rows.length}` : rows.length})
        </h3>
      </div>

      <ScrollArea className="flex-1">
        <Table>
          <TableHeader className="sticky top-0 bg-card z-10">
            <TableRow>
              <TableHead className="w-[80px] text-xs">Data</TableHead>
              <TableHead className="text-xs">Pessoa</TableHead>
              <TableHead className="text-xs">Equipe</TableHead>
              <TableHead className="w-[100px] text-xs">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRows.map((row, idx) => {
              const status = String(row[statusColumn] || "-").trim();
              const statusColor = getStatusColor(status);

              return (
                <TableRow 
                  key={row._rowIndex ?? idx} 
                  className={`hover:bg-muted/40 transition-colors ${idx % 2 === 0 ? '' : 'bg-muted/10'}`}
                >
                  <TableCell className="text-xs py-1.5 font-mono">
                    {formatDate(String(row[dateColumn] || ""))}
                  </TableCell>
                  <TableCell className="text-xs py-1.5 font-medium truncate max-w-[120px]">
                    {String(row[personColumn] || "-")}
                  </TableCell>
                  <TableCell className="text-xs py-1.5 text-muted-foreground truncate max-w-[80px]">
                    {String(row[teamColumn] || "-")}
                  </TableCell>
                  <TableCell className="py-1.5">
                    <Badge
                      variant="secondary"
                      className={`text-[10px] px-1.5 py-0 ${statusColor.bg} ${statusColor.text} border-0`}
                    >
                      {status || "-"}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}
