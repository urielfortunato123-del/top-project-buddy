/* Excel Export utility - Visual dashboard-style export with Matrix */
import * as XLSX from "xlsx";
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

// Status to chip label mapping
function statusToChip(status: string): string {
  switch (status) {
    case "ENTREGUE": return "ENT";
    case "FOLGA": return "FOL";
    case "BANCO DE HORAS": return "BAN";
    default: return "-";
  }
}

// Status to color config (Excel cell colors)
const STATUS_COLORS: Record<string, { fill: string; font: string }> = {
  "ENTREGUE": { fill: "C6EFCE", font: "006100" }, // Green
  "FOLGA": { fill: "FFEB9C", font: "9C5700" }, // Orange/Yellow
  "BANCO DE HORAS": { fill: "BDD7EE", font: "1F4E79" }, // Blue
  "VAZIO": { fill: "F2F2F2", font: "808080" }, // Gray
};

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
  
  // Get unique days and people for matrix
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
  
  // Get date range from data
  const dataInicio = days[0] || "-";
  const dataFim = days[days.length - 1] || "-";
  
  // Create workbook
  const wb = XLSX.utils.book_new();
  
  // === Sheet 1: Matriz Pessoa × Dia (VISUAL PRINCIPAL) ===
  const matrixData: (string | number)[][] = [];
  
  // Title and legend
  matrixData.push(
    ["MATRIZ PESSOA × DIA", "", "", "", "", "", "", "", "LEGENDA:"],
    ["", "", "", "", "", "", "", "", "ENT = Entregue (verde)"],
    [dataset.name, "", "", "", "", "", "", "", "FOL = Folga (laranja)"],
    [`${people.length} pessoas • ${days.length} dias • ${total} registros`, "", "", "", "", "", "", "", "BAN = Banco de Horas (azul)"],
    ["", "", "", "", "", "", "", "", "  -  = Sem informação (cinza)"],
    []
  );
  
  // Header row with days
  const headerRow = ["Colaborador", ...days.map(d => formatDayMonth(d))];
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
  
  const wsMatrix = XLSX.utils.aoa_to_sheet(matrixData);
  
  // Set column widths
  const matrixCols = [{ wch: 25 }]; // First column for names
  for (let i = 0; i < days.length; i++) {
    matrixCols.push({ wch: 6 }); // Compact columns for chips
  }
  wsMatrix["!cols"] = matrixCols;
  
  // Apply cell styles (colors) for status chips
  // Note: xlsx library has limited style support, but we set the data
  // The visual styling will be text-based with the chip labels
  
  XLSX.utils.book_append_sheet(wb, wsMatrix, "Matriz");
  
  // === Sheet 2: Dashboard KPIs ===
  const dashboardData: (string | number)[][] = [
    ["╔════════════════════════════════════════════════════════════════════════════════════════════════════════════════╗"],
    ["║                                      CONTROLE DE ENTREGA DE RDA - DASHBOARD                                    ║"],
    ["╚════════════════════════════════════════════════════════════════════════════════════════════════════════════════╝"],
    [],
    ["📊 INFORMAÇÕES DO RELATÓRIO"],
    ["────────────────────────────────────────────────────────────────────────────────────────────────────────────────"],
    ["    Dataset:", dataset.name, "", "", "    Gerado em:", format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })],
    ["    Período:", `${formatDayMonth(dataInicio)} até ${formatDayMonth(dataFim)}`, "", "", "    Total:", `${total} registros`],
    [],
    ["🔍 FILTROS APLICADOS"],
    ["────────────────────────────────────────────────────────────────────────────────────────────────────────────────"],
    ["    Equipe:", filters.team === "ALL" ? "✓ Todas" : filters.team, "", "    Pessoa:", filters.person === "ALL" ? "✓ Todas" : filters.person],
    ["    Status:", filters.status === "ALL" ? "✓ Todos" : filters.status, "", "    Período:", filters.dateFrom ? format(filters.dateFrom, "dd/MM/yyyy") : "Início", "até", filters.dateTo ? format(filters.dateTo, "dd/MM/yyyy") : "Fim"],
    [],
    [],
    ["📈 INDICADORES PRINCIPAIS (KPIs)"],
    ["════════════════════════════════════════════════════════════════════════════════════════════════════════════════"],
    [],
    ["┌─────────────────────┬─────────────────────┬─────────────────────┬─────────────────────┬─────────────────────┬─────────────────────┐"],
    ["│   TAXA DE ENTREGA   │   TOTAL ENTREGUE    │     PENDÊNCIAS      │       FOLGAS        │   BANCO DE HORAS    │      PESSOAS        │"],
    ["├─────────────────────┼─────────────────────┼─────────────────────┼─────────────────────┼─────────────────────┼─────────────────────┤"],
    [`│        ${taxa}%`.padEnd(22) + `│        ${entregue}`.padEnd(22) + `│        ${vazio}`.padEnd(22) + `│        ${folga}`.padEnd(22) + `│        ${banco}`.padEnd(22) + `│        ${pessoas}`.padEnd(22) + "│"],
    ["├─────────────────────┼─────────────────────┼─────────────────────┼─────────────────────┼─────────────────────┼─────────────────────┤"],
    [`│  ${entregue} de ${total} reg.`.padEnd(22) + "│  Marcados ENTREGUE".padEnd(22) + "│  Sem informação".padEnd(22) + "│  Dias de folga".padEnd(22) + "│  Compensações".padEnd(22) + "│  Colaboradores".padEnd(22) + "│"],
    ["└─────────────────────┴─────────────────────┴─────────────────────┴─────────────────────┴─────────────────────┴─────────────────────┘"],
    [],
  ];
  
  // Add TOP 10 Pessoas
  const byPerson = new Map<string, { total: number; entregue: number }>();
  for (const r of rows) {
    const cur = byPerson.get(r.person) || { total: 0, entregue: 0 };
    cur.total++;
    if (r.status === "ENTREGUE") cur.entregue++;
    byPerson.set(r.person, cur);
  }
  const topPessoas = Array.from(byPerson.entries())
    .sort((a, b) => b[1].entregue - a[1].entregue)
    .slice(0, 10);

  dashboardData.push(
    [],
    ["👤 TOP 10 COLABORADORES"],
    ["────────────────────────────────────────────────────────────────────────────────────────────────────────────────"],
    ["    #", "Nome", "", "", "Entregas", "Total", "Taxa", "", "Barra Visual"],
  );
  
  topPessoas.forEach(([pessoa, data], idx) => {
    const taxaPessoa = data.total > 0 ? Math.round((data.entregue / data.total) * 100) : 0;
    const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : "  ";
    const barLen = Math.round(taxaPessoa / 5);
    const bar = "█".repeat(barLen) + "░".repeat(20 - barLen);
    dashboardData.push([`    ${medal} ${idx + 1}º`, pessoa, "", "", data.entregue, data.total, `${taxaPessoa}%`, "", bar]);
  });
  
  // Add Equipes
  const byTeam = new Map<string, { total: number; entregue: number }>();
  for (const r of rows) {
    const team = r.team || "GERAL";
    const cur = byTeam.get(team) || { total: 0, entregue: 0 };
    cur.total++;
    if (r.status === "ENTREGUE") cur.entregue++;
    byTeam.set(team, cur);
  }
  const equipesData = Array.from(byTeam.entries()).sort((a, b) => b[1].entregue - a[1].entregue);
  
  dashboardData.push(
    [],
    [],
    ["👥 COMPARAÇÃO DE EQUIPES (Taxa %)"],
    ["────────────────────────────────────────────────────────────────────────────────────────────────────────────────"],
  );
  
  equipesData.forEach(([equipe, data], idx) => {
    const taxaEquipe = data.total > 0 ? Math.round((data.entregue / data.total) * 100) : 0;
    const barLen = Math.round(taxaEquipe / 5);
    const bar = "█".repeat(barLen) + "░".repeat(20 - barLen);
    dashboardData.push([`    #${idx + 1}`, equipe, "", "", `${taxaEquipe}%`, `(${data.entregue}/${data.total})`, "", "", bar]);
  });
  
  // Add Status Distribution
  dashboardData.push(
    [],
    [],
    ["📊 DISTRIBUIÇÃO POR STATUS"],
    ["────────────────────────────────────────────────────────────────────────────────────────────────────────────────"],
  );
  
  const byStatus = new Map<string, number>();
  for (const r of rows) {
    byStatus.set(r.status, (byStatus.get(r.status) || 0) + 1);
  }
  
  const statusIcons: Record<string, string> = {
    "ENTREGUE": "🟢",
    "FOLGA": "🟠",
    "BANCO DE HORAS": "🔵",
    "VAZIO": "⚪",
  };
  
  Array.from(byStatus.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([status, qtd]) => {
      const pct = total > 0 ? Math.round((qtd / total) * 100) : 0;
      const icon = statusIcons[status] || "⚪";
      dashboardData.push([`    ${icon}`, prettyStatus(status), "", "", qtd, `${pct}%`]);
    });
  
  dashboardData.push(
    [],
    [],
    ["════════════════════════════════════════════════════════════════════════════════════════════════════════════════"],
    ["                                     Relatório gerado automaticamente                                            "],
    ["════════════════════════════════════════════════════════════════════════════════════════════════════════════════"],
  );
  
  const wsDashboard = XLSX.utils.aoa_to_sheet(dashboardData);
  wsDashboard["!cols"] = [
    { wch: 8 }, { wch: 30 }, { wch: 5 }, { wch: 5 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 3 }, { wch: 25 }
  ];
  
  XLSX.utils.book_append_sheet(wb, wsDashboard, "Dashboard");
  
  // === Sheet 3: Dados Completos ===
  const dadosHeader = ["#", "Data", "Dia/Mês", "Colaborador", "Equipe", "Status", "Status (Chip)"];
  const dadosRows = rows.map((r, idx) => [
    idx + 1,
    r.date,
    formatDayMonth(r.date),
    r.person,
    r.team || "GERAL",
    prettyStatus(r.status),
    statusToChip(r.status)
  ]);
  
  const wsDados = XLSX.utils.aoa_to_sheet([
    ["DADOS FILTRADOS - " + total + " registros"],
    ["Período: " + formatDayMonth(dataInicio) + " até " + formatDayMonth(dataFim)],
    [],
    dadosHeader,
    ...dadosRows
  ]);
  wsDados["!cols"] = [{ wch: 6 }, { wch: 12 }, { wch: 8 }, { wch: 25 }, { wch: 18 }, { wch: 15 }, { wch: 8 }];
  
  XLSX.utils.book_append_sheet(wb, wsDados, "Dados");
  
  // === Sheet 4: Análise por Pessoa ===
  const pessoaHeader = ["#", "Colaborador", "Total", "ENT", "FOL", "BAN", "Pend", "Taxa (%)"];
  const pessoaRows: (string | number)[][] = [];
  
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
  
  Array.from(personStats.entries())
    .sort((a, b) => b[1].entregue - a[1].entregue)
    .forEach(([pessoa, stats], idx) => {
      pessoaRows.push([
        idx + 1,
        pessoa,
        stats.total,
        stats.entregue,
        stats.folga,
        stats.banco,
        stats.vazio,
        stats.total > 0 ? `${Math.round((stats.entregue / stats.total) * 100)}%` : "0%"
      ]);
    });
  
  const wsPessoa = XLSX.utils.aoa_to_sheet([
    ["ANÁLISE POR COLABORADOR"],
    [`${Array.from(personStats.keys()).length} colaboradores`],
    [],
    pessoaHeader,
    ...pessoaRows
  ]);
  wsPessoa["!cols"] = [{ wch: 5 }, { wch: 25 }, { wch: 8 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 10 }];
  
  XLSX.utils.book_append_sheet(wb, wsPessoa, "Por Pessoa");
  
  // === Sheet 5: Análise por Equipe ===
  const equipeHeader = ["#", "Equipe", "Total", "ENT", "FOL", "BAN", "Pend", "Taxa (%)", "Status"];
  const equipeRows: (string | number)[][] = [];
  
  const teamStats = new Map<string, { total: number; entregue: number; folga: number; banco: number; vazio: number }>();
  for (const r of rows) {
    const team = r.team || "GERAL";
    const cur = teamStats.get(team) || { total: 0, entregue: 0, folga: 0, banco: 0, vazio: 0 };
    cur.total++;
    if (r.status === "ENTREGUE") cur.entregue++;
    if (r.status === "FOLGA") cur.folga++;
    if (r.status === "BANCO DE HORAS") cur.banco++;
    if (r.status === "VAZIO") cur.vazio++;
    teamStats.set(team, cur);
  }
  
  Array.from(teamStats.entries())
    .sort((a, b) => b[1].entregue - a[1].entregue)
    .forEach(([equipe, stats], idx) => {
      const taxaEq = stats.total > 0 ? Math.round((stats.entregue / stats.total) * 100) : 0;
      const statusLabel = taxaEq >= 80 ? "🟢 Excelente" : taxaEq >= 50 ? "🟡 Regular" : "🔴 Crítico";
      equipeRows.push([
        idx + 1,
        equipe,
        stats.total,
        stats.entregue,
        stats.folga,
        stats.banco,
        stats.vazio,
        `${taxaEq}%`,
        statusLabel
      ]);
    });
  
  const wsEquipe = XLSX.utils.aoa_to_sheet([
    ["ANÁLISE POR EQUIPE"],
    [`${Array.from(teamStats.keys()).length} equipes`],
    [],
    equipeHeader,
    ...equipeRows
  ]);
  wsEquipe["!cols"] = [{ wch: 5 }, { wch: 20 }, { wch: 8 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 10 }, { wch: 12 }];
  
  XLSX.utils.book_append_sheet(wb, wsEquipe, "Por Equipe");
  
  // === Sheet 6: Por Dia ===
  const byDay = new Map<string, { total: number; entregue: number; folga: number; banco: number; vazio: number }>();
  for (const r of rows) {
    const cur = byDay.get(r.date) || { total: 0, entregue: 0, folga: 0, banco: 0, vazio: 0 };
    cur.total++;
    if (r.status === "ENTREGUE") cur.entregue++;
    if (r.status === "FOLGA") cur.folga++;
    if (r.status === "BANCO DE HORAS") cur.banco++;
    if (r.status === "VAZIO") cur.vazio++;
    byDay.set(r.date, cur);
  }
  
  const diaHeader = ["#", "Data", "Dia/Mês", "Total", "ENT", "FOL", "BAN", "Pend", "Taxa (%)"];
  const diaRows: (string | number)[][] = [];
  
  Array.from(byDay.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([data, stats], idx) => {
      diaRows.push([
        idx + 1,
        data,
        formatDayMonth(data),
        stats.total,
        stats.entregue,
        stats.folga,
        stats.banco,
        stats.vazio,
        stats.total > 0 ? `${Math.round((stats.entregue / stats.total) * 100)}%` : "0%"
      ]);
    });
  
  const wsDia = XLSX.utils.aoa_to_sheet([
    ["EVOLUÇÃO DIÁRIA"],
    [`${Array.from(byDay.keys()).length} dias`],
    [],
    diaHeader,
    ...diaRows
  ]);
  wsDia["!cols"] = [{ wch: 5 }, { wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 10 }];
  
  XLSX.utils.book_append_sheet(wb, wsDia, "Por Dia");
  
  // Download file
  const fileName = `dashboard_${dataset.name.replace(/[^a-zA-Z0-9]/g, "_")}_${format(new Date(), "yyyy-MM-dd_HHmm")}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
