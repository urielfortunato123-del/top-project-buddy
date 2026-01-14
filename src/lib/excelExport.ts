/* Excel Export utility - Professional styled export with Matrix */
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

function statusToChip(status: string): string {
  switch (status) {
    case "ENTREGUE": return "✅ ENT";
    case "FOLGA": return "🟠 FOL";
    case "BANCO DE HORAS": return "🔵 BAN";
    default: return "⬜ -";
  }
}

function statusToSimpleChip(status: string): string {
  switch (status) {
    case "ENTREGUE": return "ENT";
    case "FOLGA": return "FOL";
    case "BANCO DE HORAS": return "BAN";
    default: return "-";
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
  // SHEET 1: MATRIZ PESSOA × DIA
  // ============================================
  const matrixData: string[][] = [];
  
  // Header info
  matrixData.push(
    ["MATRIZ PESSOA × DIA - CONTROLE DE ENTREGA DE RDA"],
    [`${people.length} pessoas • ${days.length} dias • ${total} registros`],
    [`Período: ${formatDayMonth(dataInicio)} até ${formatDayMonth(dataFim)}`],
    [],
    ["LEGENDA: ✅ ENT = Entregue | 🟠 FOL = Folga | 🔵 BAN = Banco de Horas | ⬜ - = Sem Info"],
    []
  );
  
  // Header row with formatted dates
  const headerRow = ["Colaborador", ...days.map(d => formatDayMonth(d))];
  matrixData.push(headerRow);
  
  // Data rows with colored emoji chips
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
  const matrixCols: XLSX.ColInfo[] = [{ wch: 22 }];
  for (let i = 0; i < days.length; i++) {
    matrixCols.push({ wch: 8 });
  }
  wsMatrix["!cols"] = matrixCols;
  
  // Merge title cells
  wsMatrix["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: Math.min(days.length, 10) } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: Math.min(days.length, 10) } },
    { s: { r: 4, c: 0 }, e: { r: 4, c: Math.min(days.length, 10) } },
  ];
  
  XLSX.utils.book_append_sheet(wb, wsMatrix, "📊 Matriz");
  
  // ============================================
  // SHEET 2: DASHBOARD RESUMO
  // ============================================
  const dashboardData: (string | number)[][] = [
    ["╔═══════════════════════════════════════════════════════════════════════════════════════════╗"],
    ["║                    CONTROLE DE ENTREGA DE RDA - DASHBOARD EXECUTIVO                       ║"],
    ["╚═══════════════════════════════════════════════════════════════════════════════════════════╝"],
    [],
    ["📊 INFORMAÇÕES"],
    ["────────────────────────────────────────────────────────────────────────────────────────────"],
    ["    Dataset:", dataset.name, "", "", "    Gerado em:", format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })],
    ["    Período:", `${formatDayMonth(dataInicio)} até ${formatDayMonth(dataFim)}`, "", "", "    Registros:", total],
    [],
    ["🔍 FILTROS APLICADOS"],
    ["────────────────────────────────────────────────────────────────────────────────────────────"],
    ["    Equipe:", filters.team === "ALL" ? "✓ Todas" : filters.team, "", "    Pessoa:", filters.person === "ALL" ? "✓ Todas" : filters.person],
    ["    Status:", filters.status === "ALL" ? "✓ Todos" : filters.status],
    [],
    [],
    ["📈 KPIs PRINCIPAIS"],
    ["═══════════════════════════════════════════════════════════════════════════════════════════"],
    [],
    ["┌───────────────────┬───────────────────┬───────────────────┬───────────────────┬───────────────────┬───────────────────┐"],
    ["│  ✅ TAXA ENTREGA  │  📦 ENTREGUES     │  ⚠️ PENDÊNCIAS    │  🏖️ FOLGAS        │  ⏰ BANCO HORAS   │  👥 PESSOAS       │"],
    ["├───────────────────┼───────────────────┼───────────────────┼───────────────────┼───────────────────┼───────────────────┤"],
    [`│       ${taxa}%`.padEnd(20) + `│       ${entregue}`.padEnd(20) + `│       ${vazio}`.padEnd(20) + `│       ${folga}`.padEnd(20) + `│       ${banco}`.padEnd(20) + `│       ${pessoas}`.padEnd(20) + "│"],
    ["├───────────────────┼───────────────────┼───────────────────┼───────────────────┼───────────────────┼───────────────────┤"],
    [`│  ${entregue}/${total} reg.`.padEnd(20) + "│  ENTREGUE".padEnd(20) + "│  Sem info".padEnd(20) + "│  Dias folga".padEnd(20) + "│  Compensação".padEnd(20) + "│  Únicos".padEnd(20) + "│"],
    ["└───────────────────┴───────────────────┴───────────────────┴───────────────────┴───────────────────┴───────────────────┘"],
    [],
  ];
  
  // TOP 10 Pessoas
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
    ["👤 TOP 10 COLABORADORES (por entregas)"],
    ["────────────────────────────────────────────────────────────────────────────────────────────"],
    ["    Pos", "Nome", "", "", "Entregas", "Total", "Taxa", "", "Progresso"],
    ["    ───", "─────────────────────────────────────", "", "", "────────", "────────", "────────", "", "────────────────────"],
  );
  
  topPessoas.forEach(([pessoa, data], idx) => {
    const taxaPessoa = data.total > 0 ? Math.round((data.entregue / data.total) * 100) : 0;
    const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `  ${idx + 1}º`;
    const barLen = Math.round(taxaPessoa / 5);
    const bar = "█".repeat(barLen) + "░".repeat(20 - barLen);
    dashboardData.push([`    ${medal}`, pessoa, "", "", data.entregue, data.total, `${taxaPessoa}%`, "", bar]);
  });
  
  // Equipes
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
    ["────────────────────────────────────────────────────────────────────────────────────────────"],
    ["    #", "Equipe", "", "", "Taxa", "Entregas/Total", "", "", "Progresso"],
    ["    ───", "─────────────────────────────────────", "", "", "────────", "──────────────", "", "", "────────────────────"],
  );
  
  equipesData.forEach(([equipe, data], idx) => {
    const taxaEquipe = data.total > 0 ? Math.round((data.entregue / data.total) * 100) : 0;
    const barLen = Math.round(taxaEquipe / 5);
    const bar = "█".repeat(barLen) + "░".repeat(20 - barLen);
    const statusIcon = taxaEquipe >= 80 ? "✅" : taxaEquipe >= 50 ? "🟡" : "🔴";
    dashboardData.push([`    ${statusIcon} #${idx + 1}`, equipe, "", "", `${taxaEquipe}%`, `(${data.entregue}/${data.total})`, "", "", bar]);
  });
  
  // Status Distribution
  const byStatus = new Map<string, number>();
  for (const r of rows) {
    byStatus.set(r.status, (byStatus.get(r.status) || 0) + 1);
  }
  
  dashboardData.push(
    [],
    [],
    ["📊 DISTRIBUIÇÃO POR STATUS"],
    ["────────────────────────────────────────────────────────────────────────────────────────────"],
  );
  
  const statusEmoji: Record<string, string> = {
    "ENTREGUE": "✅",
    "FOLGA": "🟠",
    "BANCO DE HORAS": "🔵",
    "VAZIO": "⬜",
  };
  
  Array.from(byStatus.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([status, qtd]) => {
      const pct = total > 0 ? Math.round((qtd / total) * 100) : 0;
      const emoji = statusEmoji[status] || "📌";
      const barLen = Math.round(pct / 3);
      const bar = "●".repeat(barLen) + "○".repeat(33 - barLen);
      dashboardData.push([`    ${emoji}`, prettyStatus(status), "", "", qtd, `${pct}%`, "", "", bar]);
    });
  
  dashboardData.push(
    [],
    [],
    ["═══════════════════════════════════════════════════════════════════════════════════════════"],
    ["                              Relatório gerado automaticamente                              "],
    ["═══════════════════════════════════════════════════════════════════════════════════════════"],
  );
  
  const wsDashboard = XLSX.utils.aoa_to_sheet(dashboardData);
  wsDashboard["!cols"] = [
    { wch: 10 }, { wch: 35 }, { wch: 5 }, { wch: 5 }, { wch: 10 }, { wch: 14 }, { wch: 10 }, { wch: 3 }, { wch: 22 }
  ];
  
  XLSX.utils.book_append_sheet(wb, wsDashboard, "📈 Dashboard");
  
  // ============================================
  // SHEET 3: DADOS COMPLETOS
  // ============================================
  const dadosHeader = ["#", "Data", "Dia/Mês", "Colaborador", "Equipe", "Status", "Chip"];
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
    [`Período: ${formatDayMonth(dataInicio)} até ${formatDayMonth(dataFim)}`],
    [],
    dadosHeader,
    ...dadosRows
  ]);
  wsDados["!cols"] = [{ wch: 6 }, { wch: 12 }, { wch: 8 }, { wch: 25 }, { wch: 18 }, { wch: 14 }, { wch: 10 }];
  
  XLSX.utils.book_append_sheet(wb, wsDados, "📋 Dados");
  
  // ============================================
  // SHEET 4: POR PESSOA
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
  
  const pessoaHeader = ["#", "Colaborador", "Total", "✅ ENT", "🟠 FOL", "🔵 BAN", "⬜ Pend", "Taxa", "Status"];
  const pessoaRows: (string | number)[][] = [];
  
  Array.from(personStats.entries())
    .sort((a, b) => b[1].entregue - a[1].entregue)
    .forEach(([pessoa, stats], idx) => {
      const taxaP = stats.total > 0 ? Math.round((stats.entregue / stats.total) * 100) : 0;
      const statusIcon = taxaP >= 80 ? "✅ Excelente" : taxaP >= 50 ? "🟡 Regular" : "🔴 Crítico";
      pessoaRows.push([
        idx + 1,
        pessoa,
        stats.total,
        stats.entregue,
        stats.folga,
        stats.banco,
        stats.vazio,
        `${taxaP}%`,
        statusIcon
      ]);
    });
  
  const wsPessoa = XLSX.utils.aoa_to_sheet([
    ["ANÁLISE POR COLABORADOR"],
    [`${Array.from(personStats.keys()).length} colaboradores`],
    [],
    pessoaHeader,
    ...pessoaRows
  ]);
  wsPessoa["!cols"] = [{ wch: 5 }, { wch: 25 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 14 }];
  
  XLSX.utils.book_append_sheet(wb, wsPessoa, "👤 Por Pessoa");
  
  // ============================================
  // SHEET 5: POR EQUIPE
  // ============================================
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
  
  const equipeHeader = ["#", "Equipe", "Total", "✅ ENT", "🟠 FOL", "🔵 BAN", "⬜ Pend", "Taxa", "Status"];
  const equipeRows: (string | number)[][] = [];
  
  Array.from(teamStats.entries())
    .sort((a, b) => b[1].entregue - a[1].entregue)
    .forEach(([equipe, stats], idx) => {
      const taxaEq = stats.total > 0 ? Math.round((stats.entregue / stats.total) * 100) : 0;
      const statusIcon = taxaEq >= 80 ? "✅ Excelente" : taxaEq >= 50 ? "🟡 Regular" : "🔴 Crítico";
      equipeRows.push([
        idx + 1,
        equipe,
        stats.total,
        stats.entregue,
        stats.folga,
        stats.banco,
        stats.vazio,
        `${taxaEq}%`,
        statusIcon
      ]);
    });
  
  const wsEquipe = XLSX.utils.aoa_to_sheet([
    ["ANÁLISE POR EQUIPE"],
    [`${Array.from(teamStats.keys()).length} equipes`],
    [],
    equipeHeader,
    ...equipeRows
  ]);
  wsEquipe["!cols"] = [{ wch: 5 }, { wch: 20 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 14 }];
  
  XLSX.utils.book_append_sheet(wb, wsEquipe, "👥 Por Equipe");
  
  // ============================================
  // SHEET 6: POR DIA
  // ============================================
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
  
  const diaHeader = ["#", "Data", "Dia/Mês", "Total", "✅ ENT", "🟠 FOL", "🔵 BAN", "⬜ Pend", "Taxa"];
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
  wsDia["!cols"] = [{ wch: 5 }, { wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }];
  
  XLSX.utils.book_append_sheet(wb, wsDia, "📅 Por Dia");
  
  // Download file
  const fileName = `dashboard_${dataset.name.replace(/[^a-zA-Z0-9]/g, "_")}_${format(new Date(), "yyyy-MM-dd_HHmm")}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
