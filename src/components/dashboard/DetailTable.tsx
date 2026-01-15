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
  ENTREGUE: { bg: "bg-primary/20", text: "text-primary" },
  ENT: { bg: "bg-primary/20", text: "text-primary" },
  FOLGA: { bg: "bg-red-100", text: "text-red-700" },
  FOL: { bg: "bg-red-100", text: "text-red-700" },
  "BANCO DE HORAS": { bg: "bg-blue-100", text: "text-blue-700" },
  BANCO: { bg: "bg-blue-100", text: "text-blue-700" },
  BAN: { bg: "bg-blue-100", text: "text-blue-700" },
  FALTA: { bg: "bg-orange-100", text: "text-orange-700" },
  FAL: { bg: "bg-orange-100", text: "text-orange-700" },
  ATESTADO: { bg: "bg-purple-100", text: "text-purple-700" },
  ATE: { bg: "bg-purple-100", text: "text-purple-700" },
  FÉRIAS: { bg: "bg-cyan-100", text: "text-cyan-700" },
  FERIAS: { bg: "bg-cyan-100", text: "text-cyan-700" },
  FER: { bg: "bg-cyan-100", text: "text-cyan-700" },
};

function getStatusColor(status: string) {
  const normalized = String(status || "").trim().toUpperCase();
  return statusColors[normalized] || { bg: "bg-gray-100", text: "text-gray-600" };
}

function formatDate(value: string): string {
  if (!value) return "-";
  // Se já está no formato YYYY-MM-DD, converte para DD/MM
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [y, m, d] = value.slice(0, 10).split("-");
    return `${d}/${m}`;
  }
  return value;
}

export function DetailTable({ rows, dateColumn, personColumn, teamColumn, statusColumn }: DetailTableProps) {
  // Ordena por data (mais recente primeiro) e limita a 500 linhas para performance
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
      <div className="px-3 py-2 border-b bg-gray-50 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
          Detalhes ({rows.length > 500 ? `500 de ${rows.length}` : rows.length})
        </h3>
      </div>

      <ScrollArea className="flex-1">
        <Table>
          <TableHeader className="sticky top-0 bg-white z-10">
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
                <TableRow key={row._rowIndex ?? idx} className="hover:bg-muted/30">
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
