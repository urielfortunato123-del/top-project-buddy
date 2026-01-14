/* Excel Export utility - Professional styled export with RGB conditional formatting */
import XLSX from "xlsx-js-style";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Dataset } from "./database";

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

// Color definitions for conditional formatting (RGB hex)
const COLORS = {
  ENTREGUE: { bg: "22C55E", fg: "FFFFFF" },     // Green
  FOLGA: { bg: "3B82F6", fg: "FFFFFF" },        // Blue  
  BANCO: { bg: "F59E0B", fg: "000000" },        // Amber
  VAZIO: { bg: "EF4444", fg: "FFFFFF" },        // Red
  HEADER: { bg: "1E293B", fg: "FFFFFF" },       // Slate dark
  TITLE: { bg: "0F172A", fg: "FFFFFF" },        // Slate darker
  EXCELLENT: { bg: "16A34A", fg: "FFFFFF" },    // Green 600
  GOOD: { bg: "2563EB", fg: "FFFFFF" },         // Blue 600
  REGULAR: { bg: "D97706", fg: "FFFFFF" },      // Amber 600
  CRITICAL: { bg: "DC2626", fg: "FFFFFF" },     // Red 600
};

// Cell style type for xlsx
interface CellStyleDef {
  fill?: { fgColor?: { rgb: string } };
  font?: { color?: { rgb: string }; bold?: boolean };
  alignment?: { horizontal?: string; vertical?: string };
  border?: {
    top?: { style: string; color: { rgb: string } };
    bottom?: { style: string; color: { rgb: string } };
    left?: { style: string; color: { rgb: string } };
    right?: { style: string; color: { rgb: string } };
  };
}

// Cell style generator
function createStyle(bgColor: string, fgColor: string, bold = false, center = true): CellStyleDef {
  return {
    fill: { fgColor: { rgb: bgColor } },
    font: { color: { rgb: fgColor }, bold },
    alignment: center ? { horizontal: "center", vertical: "center" } : { vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "E2E8F0" } },
      bottom: { style: "thin", color: { rgb: "E2E8F0" } },
      left: { style: "thin", color: { rgb: "E2E8F0" } },
      right: { style: "thin", color: { rgb: "E2E8F0" } },
    }
  };
}

function getStatusStyle(status: string): CellStyleDef {
  switch (status) {
    case "ENTREGUE": return createStyle(COLORS.ENTREGUE.bg, COLORS.ENTREGUE.fg, true);
    case "FOLGA": return createStyle(COLORS.FOLGA.bg, COLORS.FOLGA.fg, true);
    case "BANCO DE HORAS": return createStyle(COLORS.BANCO.bg, COLORS.BANCO.fg, true);
    default: return createStyle(COLORS.VAZIO.bg, COLORS.VAZIO.fg, true);
  }
}

function getEvaluationStyle(taxa: number): CellStyleDef {
  if (taxa >= 80) return createStyle(COLORS.EXCELLENT.bg, COLORS.EXCELLENT.fg, true);
  if (taxa >= 60) return createStyle(COLORS.GOOD.bg, COLORS.GOOD.fg, true);
  if (taxa >= 40) return createStyle(COLORS.REGULAR.bg, COLORS.REGULAR.fg, true);
  return createStyle(COLORS.CRITICAL.bg, COLORS.CRITICAL.fg, true);
}

function prettyStatus(s: string) {
  if (s === "VAZIO") return "Sem Info";
  return s;
}

function formatDayMonth(dateStr: string): string {
  const [, month, day] = dateStr.split("-");
  return `${day}/${month}`;
}

function statusToChip(status: string): string {
  switch (status) {
    case "ENTREGUE": return "ENT";
    case "FOLGA": return "FOL";
    case "BANCO DE HORAS": return "BAN";
    default: return "-";
  }
}

// Helper to convert column index to Excel letter (0 = A, 1 = B, etc.)
function colToLetter(col: number): string {
  let letter = "";
  while (col >= 0) {
    letter = String.fromCharCode((col % 26) + 65) + letter;
    col = Math.floor(col / 26) - 1;
  }
  return letter;
}

// Apply styles to a cell
function applyCellStyle(ws: XLSX.WorkSheet, row: number, col: number, style: CellStyleDef): void {
  const cellRef = colToLetter(col) + (row + 1);
  if (ws[cellRef]) {
    ws[cellRef].s = style;
  }
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
  
  // Build matrix data
  const daysSet = new Set<string>();
  const peopleSet = new Set<string>();
  const statusMap = new Map<string, string>();
  
  for (const r of rows) {
    daysSet.add(r.date);
    peopleSet.add(r.person);
    statusMap.set(`${r.person}|${r.date}`, r.status);
  }
  
  const days = Array.from(daysSet).sort();
  const people = Array.from(peopleSet).sort();
  
  const dataInicio = days[0] || "-";
  const dataFim = days[days.length - 1] || "-";
  
  // Create workbook
  const wb = XLSX.utils.book_new();
  
  // ============================================
  // SHEET 1: MATRIZ PESSOA × DIA (Visual Matrix with RGB Colors)
  // ============================================
  const matrixData: string[][] = [];
  
  // Track status for each cell to apply colors later
  const matrixStatusGrid: string[][] = [];
  
  // Title
  matrixData.push([`CONTROLE DE ENTREGA - ${dataset.name}`]);
  matrixData.push([`${people.length} colaboradores × ${days.length} dias = ${total} registros`]);
  matrixData.push([`Período: ${formatDayMonth(dataInicio)} a ${formatDayMonth(dataFim)} | Gerado: ${format(new Date(), "dd/MM/yyyy HH:mm")}`]);
  matrixData.push([]);
  
  // Header row with dates
  const headerRow = ["COLABORADOR", ...days.map(d => formatDayMonth(d))];
  matrixData.push(headerRow);
  
  // Data rows with status chips
  for (const person of people) {
    const row: string[] = [person];
    const statusRow: string[] = [""];
    for (const day of days) {
      const key = `${person}|${day}`;
      const status = statusMap.get(key) || "VAZIO";
      row.push(statusToChip(status));
      statusRow.push(status);
    }
    matrixData.push(row);
    matrixStatusGrid.push(statusRow);
  }
  
  // Legend row
  matrixData.push([]);
  matrixData.push(["LEGENDA:", "ENT = Entregue", "FOL = Folga", "BAN = Banco de Horas", "- = Sem Info"]);
  
  const wsMatrix = XLSX.utils.aoa_to_sheet(matrixData);
  
  // Apply RGB conditional formatting to matrix cells
  const HEADER_ROW = 4; // 0-indexed row where header is (row 5 in Excel = index 4)
  const DATA_START_ROW = 5; // Data starts at row 6 (index 5)
  
  // Style title rows
  for (let col = 0; col <= days.length; col++) {
    applyCellStyle(wsMatrix, 0, col, createStyle(COLORS.TITLE.bg, COLORS.TITLE.fg, true, false));
    applyCellStyle(wsMatrix, 1, col, createStyle("1E293B", "94A3B8", false, false));
    applyCellStyle(wsMatrix, 2, col, createStyle("1E293B", "94A3B8", false, false));
  }
  
  // Style header row
  for (let col = 0; col <= days.length; col++) {
    applyCellStyle(wsMatrix, HEADER_ROW, col, createStyle(COLORS.HEADER.bg, COLORS.HEADER.fg, true));
  }
  
  // Apply colors to each status cell
  for (let personIdx = 0; personIdx < people.length; personIdx++) {
    const excelRow = DATA_START_ROW + personIdx;
    
    // Style person name column
    applyCellStyle(wsMatrix, excelRow, 0, createStyle("F1F5F9", "1E293B", true, false));
    
    // Style each day cell with status color
    for (let dayIdx = 0; dayIdx < days.length; dayIdx++) {
      const status = matrixStatusGrid[personIdx][dayIdx + 1];
      const style = getStatusStyle(status);
      applyCellStyle(wsMatrix, excelRow, dayIdx + 1, style);
    }
  }
  
  // Style legend row
  const legendRow = DATA_START_ROW + people.length + 1;
  applyCellStyle(wsMatrix, legendRow, 0, createStyle("334155", "FFFFFF", true, false));
  applyCellStyle(wsMatrix, legendRow, 1, createStyle(COLORS.ENTREGUE.bg, COLORS.ENTREGUE.fg, true));
  applyCellStyle(wsMatrix, legendRow, 2, createStyle(COLORS.FOLGA.bg, COLORS.FOLGA.fg, true));
  applyCellStyle(wsMatrix, legendRow, 3, createStyle(COLORS.BANCO.bg, COLORS.BANCO.fg, true));
  applyCellStyle(wsMatrix, legendRow, 4, createStyle(COLORS.VAZIO.bg, COLORS.VAZIO.fg, true));
  
  // Column widths
  const matrixCols: XLSX.ColInfo[] = [{ wch: 24 }];
  for (let i = 0; i < days.length; i++) {
    matrixCols.push({ wch: 7 });
  }
  wsMatrix["!cols"] = matrixCols;
  
  // Row heights
  wsMatrix["!rows"] = [
    { hpt: 24 }, // Title
    { hpt: 16 }, // Subtitle
    { hpt: 16 }, // Period
    { hpt: 8 },  // Empty
    { hpt: 22 }, // Header
  ];
  
  XLSX.utils.book_append_sheet(wb, wsMatrix, "Matriz");
  
  // ============================================
  // SHEET 2: KPIs DASHBOARD (with styling)
  // ============================================
  const kpiData: (string | number)[][] = [
    ["DASHBOARD EXECUTIVO"],
    [`Dataset: ${dataset.name}`],
    [`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`],
    [],
    [],
    ["INDICADORES PRINCIPAIS"],
    [],
    ["Indicador", "Valor", "Detalhe"],
    ["Taxa de Entrega", `${taxa}%`, `${entregue} de ${total} registros`],
    ["Entregas Realizadas", entregue, "Status: ENTREGUE"],
    ["Pendências", vazio, "Sem informação registrada"],
    ["Dias de Folga", folga, "Status: FOLGA"],
    ["Banco de Horas", banco, "Status: BANCO DE HORAS"],
    ["Colaboradores Únicos", pessoas, "Total de pessoas"],
    [],
    [],
    ["FILTROS APLICADOS"],
    [],
    ["Filtro", "Valor"],
    ["Equipe", filters.team === "ALL" ? "Todas" : filters.team],
    ["Colaborador", filters.person === "ALL" ? "Todos" : filters.person],
    ["Status", filters.status === "ALL" ? "Todos" : filters.status],
    ["Período", `${formatDayMonth(dataInicio)} até ${formatDayMonth(dataFim)}`],
  ];
  
  const wsKPI = XLSX.utils.aoa_to_sheet(kpiData);
  wsKPI["!cols"] = [{ wch: 22 }, { wch: 15 }, { wch: 30 }];
  
  // Style KPI sheet
  // Title
  for (let col = 0; col < 3; col++) {
    applyCellStyle(wsKPI, 0, col, createStyle(COLORS.TITLE.bg, COLORS.TITLE.fg, true, false));
  }
  // Section headers
  applyCellStyle(wsKPI, 5, 0, createStyle(COLORS.HEADER.bg, COLORS.HEADER.fg, true, false));
  applyCellStyle(wsKPI, 14, 0, createStyle(COLORS.HEADER.bg, COLORS.HEADER.fg, true, false));
  
  // Table headers
  for (let col = 0; col < 3; col++) {
    applyCellStyle(wsKPI, 7, col, createStyle("334155", "FFFFFF", true));
    applyCellStyle(wsKPI, 16, col, createStyle("334155", "FFFFFF", true));
  }
  
  // Taxa de entrega with conditional color
  applyCellStyle(wsKPI, 8, 1, getEvaluationStyle(taxa));
  
  XLSX.utils.book_append_sheet(wb, wsKPI, "KPIs");
  
  // ============================================
  // SHEET 3: RANKING COLABORADORES
  // ============================================
  const personStats = new Map<string, { total: number; entregue: number; folga: number; banco: number; vazio: number }>();
  for (const r of rows) {
    const cur = personStats.get(r.person) || { total: 0, entregue: 0, folga: 0, banco: 0, vazio: 0 };
    cur.total++;
    if (r.status === "ENTREGUE") cur.entregue++;
    if (r.status === "FOLGA") cur.folga++;
    if (r.status === "BANCO DE HORAS") cur.banco++;
    if (r.status === "VAZIO") cur.vazio++;
    personStats.set(r.person, cur);
  }
  
  const rankingData: (string | number)[][] = [
    ["RANKING DE COLABORADORES"],
    [`${personStats.size} colaboradores | Ordenado por entregas`],
    [],
    ["#", "Colaborador", "Entregas", "Folgas", "Banco", "Pendente", "Total", "Taxa %", "Avaliação"],
  ];
  
  // Store taxa values for conditional formatting
  const rankingTaxas: number[] = [];
  
  Array.from(personStats.entries())
    .sort((a, b) => b[1].entregue - a[1].entregue)
    .forEach(([pessoa, stats], idx) => {
      const taxaP = stats.total > 0 ? Math.round((stats.entregue / stats.total) * 100) : 0;
      const avaliacao = taxaP >= 80 ? "Excelente" : taxaP >= 60 ? "Bom" : taxaP >= 40 ? "Regular" : "Crítico";
      rankingTaxas.push(taxaP);
      rankingData.push([
        idx + 1,
        pessoa,
        stats.entregue,
        stats.folga,
        stats.banco,
        stats.vazio,
        stats.total,
        taxaP,
        avaliacao
      ]);
    });
  
  const wsRanking = XLSX.utils.aoa_to_sheet(rankingData);
  wsRanking["!cols"] = [
    { wch: 4 }, { wch: 24 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 12 }
  ];
  
  // Style Ranking sheet
  // Title
  for (let col = 0; col < 9; col++) {
    applyCellStyle(wsRanking, 0, col, createStyle(COLORS.TITLE.bg, COLORS.TITLE.fg, true, false));
  }
  // Header row
  for (let col = 0; col < 9; col++) {
    applyCellStyle(wsRanking, 3, col, createStyle(COLORS.HEADER.bg, COLORS.HEADER.fg, true));
  }
  // Apply conditional formatting to Taxa % and Avaliação columns
  rankingTaxas.forEach((taxaP, idx) => {
    const rowIdx = 4 + idx;
    // Taxa % column (index 7)
    applyCellStyle(wsRanking, rowIdx, 7, getEvaluationStyle(taxaP));
    // Avaliação column (index 8)
    applyCellStyle(wsRanking, rowIdx, 8, getEvaluationStyle(taxaP));
  });
  
  XLSX.utils.book_append_sheet(wb, wsRanking, "Ranking");
  
  // ============================================
  // SHEET 4: ANÁLISE POR EQUIPE
  // ============================================
  const teamStats = new Map<string, { total: number; entregue: number; folga: number; banco: number; vazio: number; pessoas: Set<string> }>();
  for (const r of rows) {
    const team = r.team || "GERAL";
    const cur = teamStats.get(team) || { total: 0, entregue: 0, folga: 0, banco: 0, vazio: 0, pessoas: new Set() };
    cur.total++;
    cur.pessoas.add(r.person);
    if (r.status === "ENTREGUE") cur.entregue++;
    if (r.status === "FOLGA") cur.folga++;
    if (r.status === "BANCO DE HORAS") cur.banco++;
    if (r.status === "VAZIO") cur.vazio++;
    teamStats.set(team, cur);
  }
  
  const teamData: (string | number)[][] = [
    ["ANÁLISE POR EQUIPE"],
    [`${teamStats.size} equipes`],
    [],
    ["#", "Equipe", "Pessoas", "Entregas", "Folgas", "Banco", "Pendente", "Total", "Taxa %", "Status"],
  ];
  
  // Store taxa values for conditional formatting
  const teamTaxas: number[] = [];
  
  Array.from(teamStats.entries())
    .sort((a, b) => b[1].entregue - a[1].entregue)
    .forEach(([equipe, stats], idx) => {
      const taxaEq = stats.total > 0 ? Math.round((stats.entregue / stats.total) * 100) : 0;
      const status = taxaEq >= 80 ? "OK" : taxaEq >= 50 ? "Atenção" : "Crítico";
      teamTaxas.push(taxaEq);
      teamData.push([
        idx + 1,
        equipe,
        stats.pessoas.size,
        stats.entregue,
        stats.folga,
        stats.banco,
        stats.vazio,
        stats.total,
        taxaEq,
        status
      ]);
    });
  
  const wsTeam = XLSX.utils.aoa_to_sheet(teamData);
  wsTeam["!cols"] = [
    { wch: 4 }, { wch: 20 }, { wch: 9 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 10 }
  ];
  
  // Style Team sheet
  // Title
  for (let col = 0; col < 10; col++) {
    applyCellStyle(wsTeam, 0, col, createStyle(COLORS.TITLE.bg, COLORS.TITLE.fg, true, false));
  }
  // Header row
  for (let col = 0; col < 10; col++) {
    applyCellStyle(wsTeam, 3, col, createStyle(COLORS.HEADER.bg, COLORS.HEADER.fg, true));
  }
  // Apply conditional formatting to Taxa % and Status columns
  teamTaxas.forEach((taxaEq, idx) => {
    const rowIdx = 4 + idx;
    // Taxa % column (index 8)
    applyCellStyle(wsTeam, rowIdx, 8, getEvaluationStyle(taxaEq));
    // Status column (index 9)
    applyCellStyle(wsTeam, rowIdx, 9, getEvaluationStyle(taxaEq));
  });
  
  XLSX.utils.book_append_sheet(wb, wsTeam, "Equipes");
  
  // ============================================
  // SHEET 5: EVOLUÇÃO DIÁRIA
  // ============================================
  const dayStats = new Map<string, { total: number; entregue: number; folga: number; banco: number; vazio: number }>();
  for (const r of rows) {
    const cur = dayStats.get(r.date) || { total: 0, entregue: 0, folga: 0, banco: 0, vazio: 0 };
    cur.total++;
    if (r.status === "ENTREGUE") cur.entregue++;
    if (r.status === "FOLGA") cur.folga++;
    if (r.status === "BANCO DE HORAS") cur.banco++;
    if (r.status === "VAZIO") cur.vazio++;
    dayStats.set(r.date, cur);
  }
  
  const dayData: (string | number)[][] = [
    ["EVOLUÇÃO DIÁRIA"],
    [`${days.length} dias | Use estes dados para criar gráficos`],
    [],
    ["Data", "Dia/Mês", "Entregas", "Folgas", "Banco", "Pendente", "Total", "Taxa %"],
  ];
  
  days.forEach(day => {
    const stats = dayStats.get(day) || { total: 0, entregue: 0, folga: 0, banco: 0, vazio: 0 };
    const taxaD = stats.total > 0 ? Math.round((stats.entregue / stats.total) * 100) : 0;
    dayData.push([
      day,
      formatDayMonth(day),
      stats.entregue,
      stats.folga,
      stats.banco,
      stats.vazio,
      stats.total,
      taxaD
    ]);
  });
  
  const wsDay = XLSX.utils.aoa_to_sheet(dayData);
  wsDay["!cols"] = [
    { wch: 12 }, { wch: 8 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 8 }, { wch: 8 }
  ];
  
  XLSX.utils.book_append_sheet(wb, wsDay, "Por Dia");
  
  // ============================================
  // SHEET 6: DADOS BRUTOS
  // ============================================
  const dadosHeader = ["#", "Data", "Dia/Mês", "Colaborador", "Equipe", "Status"];
  const dadosRows = rows.map((r, idx) => [
    idx + 1,
    r.date,
    formatDayMonth(r.date),
    r.person,
    r.team || "GERAL",
    prettyStatus(r.status)
  ]);
  
  const wsDados = XLSX.utils.aoa_to_sheet([
    ["DADOS COMPLETOS"],
    [`${total} registros`],
    [],
    dadosHeader,
    ...dadosRows
  ]);
  wsDados["!cols"] = [{ wch: 6 }, { wch: 12 }, { wch: 8 }, { wch: 24 }, { wch: 18 }, { wch: 14 }];
  
  XLSX.utils.book_append_sheet(wb, wsDados, "Dados");
  
  // ============================================
  // SHEET 7: RESUMO PARA POWER BI
  // ============================================
  const pbiData: (string | number)[][] = [
    ["DADOS PARA POWER BI / EXCEL PIVOT"],
    ["Use esta aba para criar dashboards dinâmicos"],
    [],
    ["Data", "Colaborador", "Equipe", "Status", "Valor"],
  ];
  
  rows.forEach(r => {
    pbiData.push([
      r.date,
      r.person,
      r.team || "GERAL",
      r.status,
      1
    ]);
  });
  
  const wsPBI = XLSX.utils.aoa_to_sheet(pbiData);
  wsPBI["!cols"] = [{ wch: 12 }, { wch: 24 }, { wch: 18 }, { wch: 16 }, { wch: 8 }];
  
  XLSX.utils.book_append_sheet(wb, wsPBI, "PowerBI");
  
  // Download
  const fileName = `dashboard_${dataset.name.replace(/[^a-zA-Z0-9]/g, "_")}_${format(new Date(), "yyyy-MM-dd_HHmm")}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
