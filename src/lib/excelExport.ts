/* Excel Export utility - Professional styled export */
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
  
  // Get date range from data
  const dates = rows.map(r => r.date).sort();
  const dataInicio = dates[0] || "-";
  const dataFim = dates[dates.length - 1] || "-";
  
  // Create workbook
  const wb = XLSX.utils.book_new();
  
  // === Sheet 1: Dashboard Completo ===
  const dashboardData: (string | number)[][] = [
    // Header section
    ["╔════════════════════════════════════════════════════════════════════════════════════════════════════════════════╗"],
    ["║                                            RELATÓRIO DO DASHBOARD                                              ║"],
    ["╚════════════════════════════════════════════════════════════════════════════════════════════════════════════════╝"],
    [],
    ["📊 INFORMAÇÕES DO RELATÓRIO"],
    ["────────────────────────────────────────────────────────────────────────────────────────────────────────────────"],
    ["    Dataset:", dataset.name, "", "", "    Gerado em:", format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })],
    ["    Período dos dados:", `${dataInicio} até ${dataFim}`, "", "", "    Total de registros:", total],
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
    ["│   TAXA DE ENTREGA   │   TOTAL ENTREGUE    │     PENDÊNCIAS      │       FOLGAS        │   BANCO DE HORAS    │    COLABORADORES    │"],
    ["├─────────────────────┼─────────────────────┼─────────────────────┼─────────────────────┼─────────────────────┼─────────────────────┤"],
    [`│        ${taxa}%`.padEnd(22) + `│        ${entregue}`.padEnd(22) + `│        ${vazio}`.padEnd(22) + `│        ${folga}`.padEnd(22) + `│        ${banco}`.padEnd(22) + `│        ${pessoas}`.padEnd(22) + "│"],
    ["├─────────────────────┼─────────────────────┼─────────────────────┼─────────────────────┼─────────────────────┼─────────────────────┤"],
    [`│  ${entregue} de ${total} reg.`.padEnd(22) + "│  Marcados ENTREGUE".padEnd(22) + "│  Sem informação".padEnd(22) + "│  Dias de folga".padEnd(22) + "│  Compensações".padEnd(22) + "│  Pessoas únicas".padEnd(22) + "│"],
    ["└─────────────────────┴─────────────────────┴─────────────────────┴─────────────────────┴─────────────────────┴─────────────────────┘"],
    [],
    [],
  ];
  
  // === Add TOP 10 Pessoas ===
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
    ["👤 TOP 10 COLABORADORES (por entregas)"],
    ["────────────────────────────────────────────────────────────────────────────────────────────────────────────────"],
    ["    #", "Nome", "", "Entregas", "Total", "Taxa (%)"],
    ["    ──", "────────────────────────────────────", "", "────────", "────────", "────────"],
  );
  
  topPessoas.forEach(([pessoa, data], idx) => {
    const taxaPessoa = data.total > 0 ? Math.round((data.entregue / data.total) * 100) : 0;
    const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : "  ";
    dashboardData.push([`    ${medal} ${idx + 1}º`, pessoa, "", data.entregue, data.total, `${taxaPessoa}%`]);
  });
  
  dashboardData.push([], []);
  
  // === Add Equipes ===
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
    ["👥 DESEMPENHO POR EQUIPE"],
    ["────────────────────────────────────────────────────────────────────────────────────────────────────────────────"],
    ["    #", "Equipe", "", "Entregas", "Total", "Taxa (%)", "", "Barra de Progresso"],
    ["    ──", "────────────────────────────────────", "", "────────", "────────", "────────", "", "────────────────────────────────────"],
  );
  
  equipesData.forEach(([equipe, data], idx) => {
    const taxaEquipe = data.total > 0 ? Math.round((data.entregue / data.total) * 100) : 0;
    const barLength = Math.round(taxaEquipe / 5);
    const bar = "█".repeat(barLength) + "░".repeat(20 - barLength);
    const statusIcon = taxaEquipe >= 80 ? "✅" : taxaEquipe >= 50 ? "⚠️" : "❌";
    dashboardData.push([`    ${statusIcon} ${idx + 1}º`, equipe, "", data.entregue, data.total, `${taxaEquipe}%`, "", bar]);
  });
  
  dashboardData.push([], []);
  
  // === Add Status Distribution ===
  const byStatus = new Map<string, number>();
  for (const r of rows) {
    byStatus.set(r.status, (byStatus.get(r.status) || 0) + 1);
  }
  
  dashboardData.push(
    ["📊 DISTRIBUIÇÃO POR STATUS"],
    ["────────────────────────────────────────────────────────────────────────────────────────────────────────────────"],
    ["    Status", "", "Quantidade", "Percentual", "", "Representação Visual"],
    ["    ────────────────────────────────────", "", "──────────", "──────────", "", "────────────────────────────────────"],
  );
  
  const statusIcons: Record<string, string> = {
    "ENTREGUE": "✅",
    "FOLGA": "🏖️",
    "BANCO DE HORAS": "⏰",
    "VAZIO": "⚠️",
  };
  
  Array.from(byStatus.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([status, qtd]) => {
      const pct = total > 0 ? Math.round((qtd / total) * 100) : 0;
      const barLen = Math.round(pct / 3);
      const bar = "●".repeat(barLen) + "○".repeat(Math.max(0, 33 - barLen));
      const icon = statusIcons[status] || "📌";
      dashboardData.push([`    ${icon} ${prettyStatus(status)}`, "", qtd, `${pct}%`, "", bar]);
    });
  
  dashboardData.push(
    [],
    [],
    ["════════════════════════════════════════════════════════════════════════════════════════════════════════════════"],
    ["                                     Relatório gerado automaticamente pelo sistema                               "],
    ["════════════════════════════════════════════════════════════════════════════════════════════════════════════════"],
  );
  
  const wsDashboard = XLSX.utils.aoa_to_sheet(dashboardData);
  wsDashboard["!cols"] = [
    { wch: 8 }, { wch: 40 }, { wch: 5 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 3 }, { wch: 40 }
  ];
  
  XLSX.utils.book_append_sheet(wb, wsDashboard, "📊 Dashboard");
  
  // === Sheet 2: Dados Completos ===
  const dadosHeader = ["#", "Data", "Colaborador", "Equipe", "Status"];
  const dadosRows = rows.map((r, idx) => [
    idx + 1,
    r.date,
    r.person,
    r.team || "GERAL",
    prettyStatus(r.status)
  ]);
  
  const wsDados = XLSX.utils.aoa_to_sheet([
    ["DADOS FILTRADOS - " + total + " registros"],
    [],
    dadosHeader,
    ...dadosRows
  ]);
  wsDados["!cols"] = [{ wch: 6 }, { wch: 12 }, { wch: 30 }, { wch: 20 }, { wch: 18 }];
  
  XLSX.utils.book_append_sheet(wb, wsDados, "📋 Dados");
  
  // === Sheet 3: Análise por Pessoa ===
  const pessoaHeader = ["#", "Colaborador", "Total Registros", "Entregas", "Folgas", "Pendências", "Taxa Entrega (%)"];
  const pessoaRows: (string | number)[][] = [];
  
  const personStats = new Map<string, { total: number; entregue: number; folga: number; vazio: number }>();
  for (const r of rows) {
    const cur = personStats.get(r.person) || { total: 0, entregue: 0, folga: 0, vazio: 0 };
    cur.total++;
    if (r.status === "ENTREGUE") cur.entregue++;
    if (r.status === "FOLGA") cur.folga++;
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
        stats.vazio,
        stats.total > 0 ? `${Math.round((stats.entregue / stats.total) * 100)}%` : "0%"
      ]);
    });
  
  const wsPessoa = XLSX.utils.aoa_to_sheet([
    ["ANÁLISE POR COLABORADOR"],
    [],
    pessoaHeader,
    ...pessoaRows
  ]);
  wsPessoa["!cols"] = [{ wch: 5 }, { wch: 30 }, { wch: 15 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 18 }];
  
  XLSX.utils.book_append_sheet(wb, wsPessoa, "👤 Por Pessoa");
  
  // === Sheet 4: Análise por Equipe ===
  const equipeHeader = ["#", "Equipe", "Total Registros", "Entregas", "Folgas", "Pendências", "Taxa Entrega (%)", "Status"];
  const equipeRows: (string | number)[][] = [];
  
  const teamStats = new Map<string, { total: number; entregue: number; folga: number; vazio: number }>();
  for (const r of rows) {
    const team = r.team || "GERAL";
    const cur = teamStats.get(team) || { total: 0, entregue: 0, folga: 0, vazio: 0 };
    cur.total++;
    if (r.status === "ENTREGUE") cur.entregue++;
    if (r.status === "FOLGA") cur.folga++;
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
        stats.vazio,
        `${taxaEq}%`,
        statusLabel
      ]);
    });
  
  const wsEquipe = XLSX.utils.aoa_to_sheet([
    ["ANÁLISE POR EQUIPE"],
    [],
    equipeHeader,
    ...equipeRows
  ]);
  wsEquipe["!cols"] = [{ wch: 5 }, { wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 18 }, { wch: 15 }];
  
  XLSX.utils.book_append_sheet(wb, wsEquipe, "👥 Por Equipe");
  
  // === Sheet 5: Análise por Dia ===
  const byDay = new Map<string, { total: number; entregue: number; folga: number; vazio: number }>();
  for (const r of rows) {
    const cur = byDay.get(r.date) || { total: 0, entregue: 0, folga: 0, vazio: 0 };
    cur.total++;
    if (r.status === "ENTREGUE") cur.entregue++;
    if (r.status === "FOLGA") cur.folga++;
    if (r.status === "VAZIO") cur.vazio++;
    byDay.set(r.date, cur);
  }
  
  const diaHeader = ["#", "Data", "Total", "Entregas", "Folgas", "Pendências", "Taxa (%)"];
  const diaRows: (string | number)[][] = [];
  
  Array.from(byDay.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([data, stats], idx) => {
      diaRows.push([
        idx + 1,
        data,
        stats.total,
        stats.entregue,
        stats.folga,
        stats.vazio,
        stats.total > 0 ? `${Math.round((stats.entregue / stats.total) * 100)}%` : "0%"
      ]);
    });
  
  const wsDia = XLSX.utils.aoa_to_sheet([
    ["EVOLUÇÃO DIÁRIA"],
    [],
    diaHeader,
    ...diaRows
  ]);
  wsDia["!cols"] = [{ wch: 5 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 }];
  
  XLSX.utils.book_append_sheet(wb, wsDia, "📅 Por Dia");
  
  // Download file
  const fileName = `dashboard_${dataset.name.replace(/[^a-zA-Z0-9]/g, "_")}_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
