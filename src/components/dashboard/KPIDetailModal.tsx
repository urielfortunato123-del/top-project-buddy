import React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import * as XLSX from "xlsx";
import type { DatasetRow } from "@/lib/database";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

export type KPIType = "taxa" | "entregue" | "pendencias" | "folgas" | "banco" | "pessoas";

interface KPIDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: KPIType;
  data: DatasetRow[];
  kpis: {
    total: number;
    entregue: number;
    folga: number;
    banco: number;
    vazio: number;
    entreguesPct: number;
    uniquePeople: number;
  };
}

const titles: Record<KPIType, string> = {
  taxa: "Taxa de Entrega - Detalhes",
  entregue: "Registros Entregues",
  pendencias: "Pendências (Sem Informação)",
  folgas: "Dias de Folga",
  banco: "Banco de Horas",
  pessoas: "Colaboradores",
};

const fileNames: Record<KPIType, string> = {
  taxa: "taxa_entrega",
  entregue: "registros_entregues",
  pendencias: "pendencias",
  folgas: "folgas",
  banco: "banco_horas",
  pessoas: "colaboradores",
};

function getFilteredData(type: KPIType, data: DatasetRow[]): DatasetRow[] {
  switch (type) {
    case "entregue":
      return data.filter(r => r.status === "ENTREGUE");
    case "pendencias":
      return data.filter(r => r.status === "VAZIO");
    case "folgas":
      return data.filter(r => r.status === "FOLGA");
    case "banco":
      return data.filter(r => r.status === "BANCO DE HORAS");
    default:
      return data;
  }
}

function formatDate(iso: string) {
  try {
    return format(new Date(iso), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return iso;
  }
}

function downloadFile(content: string, fileName: string, mimeType: string) {
  const blob = new Blob(["\uFEFF" + content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function KPIDetailModal({ open, onOpenChange, type, data, kpis }: KPIDetailModalProps) {
  const filteredData = getFilteredData(type, data);

  // Group by person for "pessoas" type
  const peopleStats = React.useMemo(() => {
    if (type !== "pessoas") return [];
    const map = new Map<string, { person: string; team: string; entregue: number; total: number }>();
    for (const r of data) {
      const cur = map.get(r.person) || { person: r.person, team: r.team || "GERAL", entregue: 0, total: 0 };
      cur.total += 1;
      if (r.status === "ENTREGUE") cur.entregue += 1;
      map.set(r.person, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.entregue - a.entregue);
  }, [data, type]);

  // Group by date for "taxa" type
  const taxaByDate = React.useMemo(() => {
    if (type !== "taxa") return [];
    const map = new Map<string, { date: string; entregue: number; total: number }>();
    for (const r of data) {
      const cur = map.get(r.date) || { date: r.date, entregue: 0, total: 0 };
      cur.total += 1;
      if (r.status === "ENTREGUE") cur.entregue += 1;
      map.set(r.date, cur);
    }
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [data, type]);

  const getExportData = () => {
    if (type === "taxa") {
      return taxaByDate.map(item => ({
        Data: formatDate(item.date),
        Entregues: item.entregue,
        Total: item.total,
        "Taxa (%)": item.total > 0 ? Math.round((item.entregue / item.total) * 100) : 0
      }));
    }
    if (type === "pessoas") {
      return peopleStats.map((item, idx) => ({
        Ranking: idx + 1,
        Pessoa: item.person,
        Equipe: item.team,
        Entregues: item.entregue,
        Total: item.total,
        "Taxa (%)": item.total > 0 ? Math.round((item.entregue / item.total) * 100) : 0
      }));
    }
    return filteredData.map(row => ({
      Data: formatDate(row.date),
      Pessoa: row.person,
      Equipe: row.team || "GERAL",
      Status: row.status === "VAZIO" ? "Sem info" : row.status
    }));
  };

  const exportToCSV = () => {
    const exportData = getExportData();
    if (exportData.length === 0) {
      toast({ title: "Sem dados para exportar", variant: "destructive" });
      return;
    }

    const headers = Object.keys(exportData[0]);
    const csvRows = [
      headers.join(";"),
      ...exportData.map(row => headers.map(h => (row as any)[h]).join(";"))
    ];
    const csvContent = csvRows.join("\n");
    
    downloadFile(csvContent, `${fileNames[type]}_${format(new Date(), "yyyy-MM-dd")}.csv`, "text/csv;charset=utf-8");
    toast({ title: "CSV exportado com sucesso!" });
  };

  const exportToExcel = () => {
    const exportData = getExportData();
    if (exportData.length === 0) {
      toast({ title: "Sem dados para exportar", variant: "destructive" });
      return;
    }

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, titles[type].slice(0, 31));
    XLSX.writeFile(wb, `${fileNames[type]}_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    toast({ title: "Excel exportado com sucesso!" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-bold">{titles[type]}</DialogTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={exportToCSV}
                className="gap-2"
              >
                <FileText className="w-4 h-4" />
                CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportToExcel}
                className="gap-2"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Excel
              </Button>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="h-[60vh] pr-4">
          {type === "taxa" && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-xl">
                <div className="text-center">
                  <p className="text-3xl font-black text-primary">{kpis.entreguesPct}%</p>
                  <p className="text-xs text-muted-foreground">Taxa Geral</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{kpis.entregue}</p>
                  <p className="text-xs text-muted-foreground">Entregues</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{kpis.total}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>

              <h4 className="font-semibold text-sm">Taxa por Dia</h4>
              <div className="space-y-2">
                {taxaByDate.map((item) => {
                  const taxa = item.total > 0 ? Math.round((item.entregue / item.total) * 100) : 0;
                  return (
                    <div key={item.date} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                      <span className="text-sm font-medium w-24">{formatDate(item.date)}</span>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${taxa >= 80 ? "bg-primary" : taxa >= 50 ? "bg-secondary" : "bg-destructive"}`}
                          style={{ width: `${taxa}%` }}
                        />
                      </div>
                      <span className={`text-sm font-bold w-12 text-right ${taxa >= 80 ? "text-primary" : taxa >= 50 ? "text-secondary" : "text-destructive"}`}>
                        {taxa}%
                      </span>
                      <span className="text-xs text-muted-foreground w-16 text-right">
                        {item.entregue}/{item.total}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {type === "pessoas" && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-xl text-center">
                <p className="text-3xl font-black">{kpis.uniquePeople}</p>
                <p className="text-sm text-muted-foreground">Colaboradores únicos</p>
              </div>

              <h4 className="font-semibold text-sm">Detalhes por Pessoa</h4>
              <div className="space-y-2">
                {peopleStats.map((item, idx) => {
                  const taxa = item.total > 0 ? Math.round((item.entregue / item.total) * 100) : 0;
                  return (
                    <div key={item.person} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 border">
                      <span className="text-xs font-bold text-muted-foreground w-6">#{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.person}</p>
                        <p className="text-xs text-muted-foreground">{item.team}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${taxa >= 80 ? "text-primary" : taxa >= 50 ? "text-secondary" : "text-destructive"}`}>
                          {taxa}%
                        </p>
                        <p className="text-xs text-muted-foreground">{item.entregue}/{item.total}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(type === "entregue" || type === "pendencias" || type === "folgas" || type === "banco") && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-xl text-center">
                <p className="text-3xl font-black">{filteredData.length}</p>
                <p className="text-sm text-muted-foreground">registros encontrados</p>
              </div>

              <h4 className="font-semibold text-sm">Lista de Registros</h4>
              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-3 font-semibold">Data</th>
                      <th className="text-left p-3 font-semibold">Pessoa</th>
                      <th className="text-left p-3 font-semibold">Equipe</th>
                      <th className="text-left p-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.slice(0, 100).map((row, idx) => (
                      <tr key={idx} className="border-t hover:bg-muted/30">
                        <td className="p-3">{formatDate(row.date)}</td>
                        <td className="p-3 font-medium">{row.person}</td>
                        <td className="p-3 text-muted-foreground">{row.team || "GERAL"}</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            row.status === "ENTREGUE" ? "bg-primary/20 text-primary" :
                            row.status === "VAZIO" ? "bg-muted text-muted-foreground" :
                            row.status === "FOLGA" ? "bg-secondary/20 text-secondary" :
                            row.status === "BANCO DE HORAS" ? "bg-purple-500/20 text-purple-600" :
                            "bg-muted"
                          }`}>
                            {row.status === "VAZIO" ? "Sem info" : row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredData.length > 100 && (
                  <div className="p-3 text-center text-sm text-muted-foreground bg-muted/50">
                    Mostrando 100 de {filteredData.length} registros (export inclui todos)
                  </div>
                )}
              </div>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}