/* Excel Export utility */
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Dataset, DatasetRow } from "./database";

interface ExportExcelOptions {
  dataset: Dataset;
  filters: {
    team: string;
    person: string;
    status: string;
    dateFrom?: Date;
    dateTo?: Date;
  };
}

function prettyStatus(s: string) {
  if (s === "VAZIO") return "Sem Info";
  return s;
}

export function exportToExcel(options: ExportExcelOptions): void {
  const { dataset, filters } = options;
  
  // Apply filters
  let rows = dataset.rows;
  if (filters.dateFrom) {
    const fromStr = filters.dateFrom.toISOString().slice(0, 10);
    rows = rows.filter(r => r.date >= fromStr);
  }
  if (filters.dateTo) {
    const toStr = filters.dateTo.toISOString().slice(0, 10);
    rows = rows.filter(r => r.date <= toStr);
  }
  if (filters.team !== "ALL") rows = rows.filter(r => r.team === filters.team);
  if (filters.person !== "ALL") rows = rows.filter(r => r.person === filters.person);
  if (filters.status !== "ALL") rows = rows.filter(r => r.status === filters.status);
  
  // Calculate KPIs
  const total = rows.length;
  const entregue = rows.filter(r => r.status === "ENTREGUE").length;
  const folga = rows.filter(r => r.status === "FOLGA").length;
  const banco = rows.filter(r => r.status === "BANCO DE HORAS").length;
  const vazio = rows.filter(r => r.status === "VAZIO").length;
  const taxa = total ? Math.round((entregue / total) * 100) : 0;
  const pessoas = new Set(rows.map(r => r.person)).size;
  
  // Create workbook
  const wb = XLSX.utils.book_new();
  
  // === Sheet 1: Resumo (Dashboard KPIs) ===
  const resumoData = [
    ["DASHBOARD - RESUMO"],
    [""],
    ["Dataset:", dataset.name],
    ["Gerado em:", format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })],
    ["Total de registros:", total],
    [""],
    ["FILTROS APLICADOS"],
    ["Equipe:", filters.team === "ALL" ? "Todas" : filters.team],
    ["Pessoa:", filters.person === "ALL" ? "Todas" : filters.person],
    ["Status:", filters.status === "ALL" ? "Todos" : filters.status],
    ["Período:", filters.dateFrom ? format(filters.dateFrom, "dd/MM/yyyy") : "Início", "até", filters.dateTo ? format(filters.dateTo, "dd/MM/yyyy") : "Fim"],
    [""],
    ["INDICADORES (KPIs)"],
    ["Métrica", "Valor", "Descrição"],
    ["Taxa de Entrega", `${taxa}%`, `${entregue} de ${total} registros`],
    ["Total Entregue", entregue, "Marcados como ENTREGUE"],
    ["Pendências", vazio, "Sem informação lançada"],
    ["Folgas", folga, "Dias de folga"],
    ["Banco de Horas", banco, "Compensações"],
    ["Colaboradores", pessoas, "Pessoas únicas"],
  ];
  
  const wsResumo = XLSX.utils.aoa_to_sheet(resumoData);
  
  // Style columns width
  wsResumo["!cols"] = [{ wch: 20 }, { wch: 15 }, { wch: 30 }];
  
  XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");
  
  // === Sheet 2: Dados Filtrados ===
  const dadosHeader = ["Data", "Pessoa", "Equipe", "Status"];
  const dadosRows = rows.map(r => [
    r.date,
    r.person,
    r.team || "-",
    prettyStatus(r.status)
  ]);
  
  const wsDados = XLSX.utils.aoa_to_sheet([dadosHeader, ...dadosRows]);
  wsDados["!cols"] = [{ wch: 12 }, { wch: 25 }, { wch: 20 }, { wch: 15 }];
  
  XLSX.utils.book_append_sheet(wb, wsDados, "Dados Filtrados");
  
  // === Sheet 3: Por Pessoa ===
  const byPerson = new Map<string, { total: number; entregue: number }>();
  for (const r of rows) {
    const cur = byPerson.get(r.person) || { total: 0, entregue: 0 };
    cur.total++;
    if (r.status === "ENTREGUE") cur.entregue++;
    byPerson.set(r.person, cur);
  }
  
  const pessoaHeader = ["Pessoa", "Total", "Entregas", "Taxa (%)"];
  const pessoaRows = Array.from(byPerson.entries())
    .sort((a, b) => b[1].entregue - a[1].entregue)
    .map(([pessoa, data]) => [
      pessoa,
      data.total,
      data.entregue,
      data.total > 0 ? Math.round((data.entregue / data.total) * 100) : 0
    ]);
  
  const wsPessoa = XLSX.utils.aoa_to_sheet([pessoaHeader, ...pessoaRows]);
  wsPessoa["!cols"] = [{ wch: 25 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
  
  XLSX.utils.book_append_sheet(wb, wsPessoa, "Por Pessoa");
  
  // === Sheet 4: Por Equipe ===
  const byTeam = new Map<string, { total: number; entregue: number }>();
  for (const r of rows) {
    const team = r.team || "GERAL";
    const cur = byTeam.get(team) || { total: 0, entregue: 0 };
    cur.total++;
    if (r.status === "ENTREGUE") cur.entregue++;
    byTeam.set(team, cur);
  }
  
  const equipeHeader = ["Equipe", "Total", "Entregas", "Taxa (%)"];
  const equipeRows = Array.from(byTeam.entries())
    .sort((a, b) => b[1].entregue - a[1].entregue)
    .map(([equipe, data]) => [
      equipe,
      data.total,
      data.entregue,
      data.total > 0 ? Math.round((data.entregue / data.total) * 100) : 0
    ]);
  
  const wsEquipe = XLSX.utils.aoa_to_sheet([equipeHeader, ...equipeRows]);
  wsEquipe["!cols"] = [{ wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
  
  XLSX.utils.book_append_sheet(wb, wsEquipe, "Por Equipe");
  
  // === Sheet 5: Por Status ===
  const byStatus = new Map<string, number>();
  for (const r of rows) {
    byStatus.set(r.status, (byStatus.get(r.status) || 0) + 1);
  }
  
  const statusHeader = ["Status", "Quantidade", "Percentual (%)"];
  const statusRows = Array.from(byStatus.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([status, qtd]) => [
      prettyStatus(status),
      qtd,
      total > 0 ? Math.round((qtd / total) * 100) : 0
    ]);
  
  const wsStatus = XLSX.utils.aoa_to_sheet([statusHeader, ...statusRows]);
  wsStatus["!cols"] = [{ wch: 20 }, { wch: 12 }, { wch: 15 }];
  
  XLSX.utils.book_append_sheet(wb, wsStatus, "Por Status");
  
  // === Sheet 6: Por Dia ===
  const byDay = new Map<string, { total: number; entregue: number }>();
  for (const r of rows) {
    const cur = byDay.get(r.date) || { total: 0, entregue: 0 };
    cur.total++;
    if (r.status === "ENTREGUE") cur.entregue++;
    byDay.set(r.date, cur);
  }
  
  const diaHeader = ["Data", "Total", "Entregas", "Taxa (%)"];
  const diaRows = Array.from(byDay.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([data, info]) => [
      data,
      info.total,
      info.entregue,
      info.total > 0 ? Math.round((info.entregue / info.total) * 100) : 0
    ]);
  
  const wsDia = XLSX.utils.aoa_to_sheet([diaHeader, ...diaRows]);
  wsDia["!cols"] = [{ wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
  
  XLSX.utils.book_append_sheet(wb, wsDia, "Por Dia");
  
  // Download file
  const fileName = `dashboard_${dataset.name}_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
