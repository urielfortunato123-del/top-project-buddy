/**
 * Excel Export utility - Professional styled export
 * Uses dynamic import to avoid bloating the main bundle
 */
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
    case "ENTREGUE": return "✓ ENT";
    case "FOLGA": return "◆ FOL";
    case "BANCO DE HORAS": return "● BAN";
    default: return "✗ ---";
  }
}

export async function exportToExcel(options: ExportExcelOptions): Promise<void> {
  const { dataset, filters } = options;
  
  // Dynamic import to avoid bloating main bundle - use standard xlsx
  const XLSX = await import("xlsx");
  
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
  // SHEET 1: MATRIZ PESSOA × DIA
  // ============================================
  const matrixData: string[][] = [];
  
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
    for (const day of days) {
      const key = `${person}|${day}`;
      const status = statusMap.get(key) || "VAZIO";
      row.push(statusToChip(status));
    }
    matrixData.push(row);
  }
  
  // Legend row
  matrixData.push([]);
  matrixData.push(["LEGENDA:", "✓ ENT = Entregue", "◆ FOL = Folga", "● BAN = Banco de Horas", "✗ = Sem Info"]);
  
  const wsMatrix = XLSX.utils.aoa_to_sheet(matrixData);
  wsMatrix["!cols"] = [{ wch: 24 }, ...days.map(() => ({ wch: 10 }))];
  XLSX.utils.book_append_sheet(wb, wsMatrix, "Matriz");
  
  // ============================================
  // SHEET 2: KPIs DASHBOARD
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
  
  Array.from(personStats.entries())
    .sort((a, b) => b[1].entregue - a[1].entregue)
    .forEach(([pessoa, stats], idx) => {
      const taxaP = stats.total > 0 ? Math.round((stats.entregue / stats.total) * 100) : 0;
      const avaliacao = taxaP >= 80 ? "★ Excelente" : taxaP >= 60 ? "● Bom" : taxaP >= 40 ? "◆ Regular" : "✗ Crítico";
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
    { wch: 4 }, { wch: 24 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 14 }
  ];
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
  
  Array.from(teamStats.entries())
    .sort((a, b) => b[1].entregue - a[1].entregue)
    .forEach(([equipe, stats], idx) => {
      const taxaEq = stats.total > 0 ? Math.round((stats.entregue / stats.total) * 100) : 0;
      const status = taxaEq >= 80 ? "★ OK" : taxaEq >= 50 ? "◆ Atenção" : "✗ Crítico";
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
    { wch: 4 }, { wch: 20 }, { wch: 9 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 12 }
  ];
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
    { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 8 }, { wch: 10 }
  ];
  XLSX.utils.book_append_sheet(wb, wsDay, "Evolução");
  
  // ============================================
  // SHEET 6: DADOS BRUTOS
  // ============================================
  const rawData: (string | number)[][] = [
    ["DADOS BRUTOS"],
    [`${rows.length} registros`],
    [],
    ["Data", "Equipe", "Colaborador", "Status"],
    ...rows.map(r => [r.date, r.team || "GERAL", r.person, prettyStatus(r.status)])
  ];
  
  const wsRaw = XLSX.utils.aoa_to_sheet(rawData);
  wsRaw["!cols"] = [{ wch: 12 }, { wch: 16 }, { wch: 24 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, wsRaw, "Dados");
  
  // ============================================
  // SHEET 7: RESUMO ESTATÍSTICO
  // ============================================
  const summaryData: (string | number)[][] = [
    ["RESUMO ESTATÍSTICO"],
    [],
    ["Métrica", "Valor"],
    ["Total de Registros", total],
    ["Colaboradores", pessoas],
    ["Dias Analisados", days.length],
    ["Equipes", teamStats.size],
    [],
    ["DISTRIBUIÇÃO POR STATUS"],
    [],
    ["Status", "Quantidade", "%"],
    ["Entregue", entregue, Math.round((entregue / total) * 100) || 0],
    ["Folga", folga, Math.round((folga / total) * 100) || 0],
    ["Banco de Horas", banco, Math.round((banco / total) * 100) || 0],
    ["Sem Info", vazio, Math.round((vazio / total) * 100) || 0],
  ];
  
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  wsSummary["!cols"] = [{ wch: 20 }, { wch: 15 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, "Resumo");
  
  // Generate file
  const fileName = `dashboard_${dataset.name.replace(/\s+/g, "_")}_${format(new Date(), "yyyy-MM-dd_HH-mm")}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
