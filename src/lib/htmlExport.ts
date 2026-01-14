/* HTML Interactive Export utility */
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Dataset, DatasetRow } from "./database";

interface ExportHTMLOptions {
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

function generateHTML(dataset: Dataset, filteredRows: DatasetRow[]): string {
  const kpis = calculateKPIs(filteredRows);
  const seriesByDay = calculateSeriesByDay(filteredRows);
  const pieByStatus = calculatePieByStatus(filteredRows);
  const barByPerson = calculateBarByPerson(filteredRows);
  const barByTeam = calculateBarByTeam(filteredRows);
  
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard - ${dataset.name}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: system-ui, -apple-system, sans-serif; 
      background: #f0f4f8; 
      color: #1a1a2e;
      min-height: 100vh;
    }
    .header { 
      background: linear-gradient(135deg, #22c55e, #f59e0b); 
      color: white; 
      padding: 20px 30px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .header h1 { font-size: 24px; }
    .header .date { opacity: 0.9; font-size: 14px; }
    .container { display: flex; height: calc(100vh - 70px); }
    .dashboard { flex: 1; padding: 20px; overflow-y: auto; }
    .spreadsheet { flex: 1; background: white; border-left: 1px solid #e5e7eb; overflow: auto; }
    
    .kpi-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 16px; margin-bottom: 20px; }
    @media (max-width: 1200px) { .kpi-grid { grid-template-columns: repeat(3, 1fr); } }
    @media (max-width: 768px) { .kpi-grid { grid-template-columns: repeat(2, 1fr); } }
    
    .kpi-card { 
      background: white; 
      border-radius: 16px; 
      padding: 16px; 
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
      border-left: 4px solid #22c55e;
    }
    .kpi-card.warning { border-left-color: #f59e0b; }
    .kpi-card.info { border-left-color: #3b82f6; }
    .kpi-card.neutral { border-left-color: #6b7280; }
    .kpi-card .title { font-size: 12px; color: #6b7280; margin-bottom: 4px; }
    .kpi-card .value { font-size: 28px; font-weight: 800; color: #1a1a2e; }
    .kpi-card .subtitle { font-size: 11px; color: #9ca3af; margin-top: 8px; }
    
    .charts-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 16px; margin-bottom: 20px; }
    .charts-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    @media (max-width: 1024px) { 
      .charts-grid, .charts-grid-3 { grid-template-columns: 1fr; } 
    }
    
    .chart-card { 
      background: white; 
      border-radius: 16px; 
      padding: 20px; 
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
    }
    .chart-card h3 { font-size: 14px; font-weight: 600; margin-bottom: 16px; color: #374151; }
    .chart-container { height: 250px; position: relative; }
    
    .filters { 
      background: white; 
      padding: 12px 20px; 
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      align-items: center;
    }
    .filters label { font-size: 12px; color: #6b7280; }
    .filters select { 
      padding: 6px 12px; 
      border: 1px solid #d1d5db; 
      border-radius: 8px;
      font-size: 13px;
      outline: none;
    }
    .filters select:focus { border-color: #22c55e; }
    
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { 
      background: #f9fafb; 
      padding: 12px 16px; 
      text-align: left; 
      font-weight: 600;
      position: sticky;
      top: 0;
      border-bottom: 2px solid #e5e7eb;
    }
    td { padding: 10px 16px; border-bottom: 1px solid #f3f4f6; }
    tr:hover td { background: #f9fafb; }
    .status-badge { 
      padding: 4px 10px; 
      border-radius: 20px; 
      font-size: 11px; 
      font-weight: 600;
    }
    .status-ENTREGUE { background: #dcfce7; color: #16a34a; }
    .status-FOLGA { background: #dbeafe; color: #2563eb; }
    .status-BANCO { background: #f3e8ff; color: #9333ea; }
    .status-VAZIO { background: #fef3c7; color: #d97706; }
    
    .toggle-view {
      padding: 8px 16px;
      background: #22c55e;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      font-size: 13px;
    }
    .toggle-view:hover { background: #16a34a; }
    
    .hidden { display: none !important; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Dashboard: ${dataset.name}</h1>
      <div class="date">Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} • ${dataset.rows.length} registros</div>
    </div>
    <button class="toggle-view" onclick="toggleView()">📊 Alternar Vista</button>
  </div>
  
  <div class="filters">
    <div>
      <label>Equipe:</label>
      <select id="filterTeam" onchange="applyFilters()">
        <option value="ALL">Todas</option>
        ${dataset.teams.map(t => `<option value="${t}">${t}</option>`).join('')}
      </select>
    </div>
    <div>
      <label>Pessoa:</label>
      <select id="filterPerson" onchange="applyFilters()">
        <option value="ALL">Todas</option>
        ${dataset.people.map(p => `<option value="${p}">${p}</option>`).join('')}
      </select>
    </div>
    <div>
      <label>Status:</label>
      <select id="filterStatus" onchange="applyFilters()">
        <option value="ALL">Todos</option>
        ${dataset.statuses.map(s => `<option value="${s}">${s}</option>`).join('')}
      </select>
    </div>
    <div style="margin-left: auto; font-size: 12px; color: #6b7280;">
      Mostrando: <strong id="countDisplay">${filteredRows.length}</strong> registros
    </div>
  </div>
  
  <div class="container">
    <div class="dashboard" id="dashboardView">
      <div class="kpi-grid" id="kpiGrid">
        ${generateKPICards(kpis)}
      </div>
      
      <div class="charts-grid">
        <div class="chart-card">
          <h3>📈 Entregas por Dia</h3>
          <div class="chart-container"><canvas id="lineChart"></canvas></div>
        </div>
        <div class="chart-card">
          <h3>🍩 Distribuição por Status</h3>
          <div class="chart-container"><canvas id="pieChart"></canvas></div>
        </div>
      </div>
      
      <div class="charts-grid-3">
        <div class="chart-card">
          <h3>👤 Ranking por Pessoa</h3>
          <div class="chart-container"><canvas id="personChart"></canvas></div>
        </div>
        <div class="chart-card">
          <h3>👥 Entregas por Equipe</h3>
          <div class="chart-container"><canvas id="teamChart"></canvas></div>
        </div>
        <div class="chart-card">
          <h3>📊 Taxa por Equipe (%)</h3>
          <div class="chart-container"><canvas id="teamRateChart"></canvas></div>
        </div>
      </div>
    </div>
    
    <div class="spreadsheet" id="spreadsheetView">
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Pessoa</th>
            <th>Equipe</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody id="tableBody">
          ${generateTableRows(filteredRows)}
        </tbody>
      </table>
    </div>
  </div>
  
  <script>
    const allData = ${JSON.stringify(dataset.rows)};
    let filteredData = [...allData];
    let charts = {};
    let showBoth = true;
    
    function toggleView() {
      const dashboard = document.getElementById('dashboardView');
      const spreadsheet = document.getElementById('spreadsheetView');
      
      if (showBoth) {
        spreadsheet.classList.add('hidden');
        dashboard.style.flex = '1';
      } else {
        spreadsheet.classList.remove('hidden');
        dashboard.style.flex = '1';
      }
      showBoth = !showBoth;
    }
    
    function applyFilters() {
      const team = document.getElementById('filterTeam').value;
      const person = document.getElementById('filterPerson').value;
      const status = document.getElementById('filterStatus').value;
      
      filteredData = allData.filter(row => {
        if (team !== 'ALL' && row.team !== team) return false;
        if (person !== 'ALL' && row.person !== person) return false;
        if (status !== 'ALL' && row.status !== status) return false;
        return true;
      });
      
      document.getElementById('countDisplay').textContent = filteredData.length;
      updateKPIs();
      updateCharts();
      updateTable();
    }
    
    function updateKPIs() {
      const total = filteredData.length;
      const entregue = filteredData.filter(r => r.status === 'ENTREGUE').length;
      const folga = filteredData.filter(r => r.status === 'FOLGA').length;
      const banco = filteredData.filter(r => r.status === 'BANCO DE HORAS').length;
      const vazio = filteredData.filter(r => r.status === 'VAZIO').length;
      const taxa = total ? Math.round((entregue / total) * 100) : 0;
      const pessoas = new Set(filteredData.map(r => r.person)).size;
      
      document.getElementById('kpiGrid').innerHTML = \`
        <div class="kpi-card">
          <div class="title">Taxa de Entrega</div>
          <div class="value">\${taxa}%</div>
          <div class="subtitle">\${entregue} de \${total} registros</div>
        </div>
        <div class="kpi-card">
          <div class="title">Total Entregue</div>
          <div class="value">\${entregue}</div>
          <div class="subtitle">Marcados como ENTREGUE</div>
        </div>
        <div class="kpi-card warning">
          <div class="title">Pendências</div>
          <div class="value">\${vazio}</div>
          <div class="subtitle">Sem informação lançada</div>
        </div>
        <div class="kpi-card info">
          <div class="title">Folgas</div>
          <div class="value">\${folga}</div>
          <div class="subtitle">Dias de folga</div>
        </div>
        <div class="kpi-card neutral">
          <div class="title">Banco de Horas</div>
          <div class="value">\${banco}</div>
          <div class="subtitle">Compensações</div>
        </div>
        <div class="kpi-card neutral">
          <div class="title">Pessoas</div>
          <div class="value">\${pessoas}</div>
          <div class="subtitle">Colaboradores únicos</div>
        </div>
      \`;
    }
    
    function updateCharts() {
      // Line chart - by day
      const byDay = {};
      filteredData.forEach(r => {
        if (!byDay[r.date]) byDay[r.date] = { total: 0, entregue: 0 };
        byDay[r.date].total++;
        if (r.status === 'ENTREGUE') byDay[r.date].entregue++;
      });
      const days = Object.keys(byDay).sort();
      charts.line.data.labels = days.map(d => d.slice(5));
      charts.line.data.datasets[0].data = days.map(d => byDay[d].entregue);
      charts.line.update();
      
      // Pie chart - by status
      const byStatus = {};
      filteredData.forEach(r => {
        const s = r.status === 'VAZIO' ? 'Sem Info' : r.status;
        byStatus[s] = (byStatus[s] || 0) + 1;
      });
      charts.pie.data.labels = Object.keys(byStatus);
      charts.pie.data.datasets[0].data = Object.values(byStatus);
      charts.pie.update();
      
      // Person chart
      const byPerson = {};
      filteredData.forEach(r => {
        if (!byPerson[r.person]) byPerson[r.person] = 0;
        if (r.status === 'ENTREGUE') byPerson[r.person]++;
      });
      const topPeople = Object.entries(byPerson).sort((a,b) => b[1] - a[1]).slice(0, 10);
      charts.person.data.labels = topPeople.map(p => p[0].split(' ')[0]);
      charts.person.data.datasets[0].data = topPeople.map(p => p[1]);
      charts.person.update();
      
      // Team chart
      const byTeam = {};
      filteredData.forEach(r => {
        const t = r.team || 'GERAL';
        if (!byTeam[t]) byTeam[t] = { total: 0, entregue: 0 };
        byTeam[t].total++;
        if (r.status === 'ENTREGUE') byTeam[t].entregue++;
      });
      const teams = Object.entries(byTeam).sort((a,b) => b[1].entregue - a[1].entregue);
      charts.team.data.labels = teams.map(t => t[0]);
      charts.team.data.datasets[0].data = teams.map(t => t[1].entregue);
      charts.team.update();
      
      // Team rate chart
      charts.teamRate.data.labels = teams.map(t => t[0]);
      charts.teamRate.data.datasets[0].data = teams.map(t => t[1].total > 0 ? Math.round((t[1].entregue / t[1].total) * 100) : 0);
      charts.teamRate.update();
    }
    
    function updateTable() {
      const tbody = document.getElementById('tableBody');
      tbody.innerHTML = filteredData.map(row => \`
        <tr>
          <td>\${row.date}</td>
          <td>\${row.person}</td>
          <td>\${row.team || '-'}</td>
          <td><span class="status-badge status-\${row.status === 'BANCO DE HORAS' ? 'BANCO' : row.status}">\${row.status === 'VAZIO' ? 'Sem Info' : row.status}</span></td>
        </tr>
      \`).join('');
    }
    
    // Initialize charts
    window.onload = function() {
      const colors = ['#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#6b7280'];
      
      charts.line = new Chart(document.getElementById('lineChart'), {
        type: 'line',
        data: {
          labels: ${JSON.stringify(seriesByDay.map(d => d.date.slice(5)))},
          datasets: [{
            label: 'Entregas',
            data: ${JSON.stringify(seriesByDay.map(d => d.entregue))},
            borderColor: '#22c55e',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            fill: true,
            tension: 0.4
          }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
      });
      
      charts.pie = new Chart(document.getElementById('pieChart'), {
        type: 'doughnut',
        data: {
          labels: ${JSON.stringify(pieByStatus.map(s => s.name))},
          datasets: [{
            data: ${JSON.stringify(pieByStatus.map(s => s.value))},
            backgroundColor: colors
          }]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });
      
      charts.person = new Chart(document.getElementById('personChart'), {
        type: 'bar',
        data: {
          labels: ${JSON.stringify(barByPerson.slice(0, 10).map(p => p.person.split(' ')[0]))},
          datasets: [{
            label: 'Entregas',
            data: ${JSON.stringify(barByPerson.slice(0, 10).map(p => p.entregue))},
            backgroundColor: '#22c55e'
          }]
        },
        options: { 
          responsive: true, 
          maintainAspectRatio: false, 
          indexAxis: 'y',
          plugins: { legend: { display: false } }
        }
      });
      
      charts.team = new Chart(document.getElementById('teamChart'), {
        type: 'bar',
        data: {
          labels: ${JSON.stringify(barByTeam.map(t => t.team))},
          datasets: [{
            label: 'Entregas',
            data: ${JSON.stringify(barByTeam.map(t => t.entregue))},
            backgroundColor: '#3b82f6'
          }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
      });
      
      charts.teamRate = new Chart(document.getElementById('teamRateChart'), {
        type: 'bar',
        data: {
          labels: ${JSON.stringify(barByTeam.map(t => t.team))},
          datasets: [{
            label: 'Taxa %',
            data: ${JSON.stringify(barByTeam.map(t => t.total > 0 ? Math.round((t.entregue / t.total) * 100) : 0))},
            backgroundColor: '#f59e0b'
          }]
        },
        options: { 
          responsive: true, 
          maintainAspectRatio: false, 
          plugins: { legend: { display: false } },
          scales: { y: { max: 100 } }
        }
      });
    };
  </script>
</body>
</html>`;
}

function calculateKPIs(rows: DatasetRow[]) {
  const total = rows.length;
  const entregue = rows.filter(r => r.status === "ENTREGUE").length;
  const folga = rows.filter(r => r.status === "FOLGA").length;
  const banco = rows.filter(r => r.status === "BANCO DE HORAS").length;
  const vazio = rows.filter(r => r.status === "VAZIO").length;
  const taxa = total ? Math.round((entregue / total) * 100) : 0;
  const pessoas = new Set(rows.map(r => r.person)).size;
  return { total, entregue, folga, banco, vazio, taxa, pessoas };
}

function calculateSeriesByDay(rows: DatasetRow[]) {
  const map = new Map<string, { date: string; entregue: number; total: number }>();
  for (const r of rows) {
    const cur = map.get(r.date) || { date: r.date, entregue: 0, total: 0 };
    cur.total += 1;
    if (r.status === "ENTREGUE") cur.entregue += 1;
    map.set(r.date, cur);
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function calculatePieByStatus(rows: DatasetRow[]) {
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.status, (map.get(r.status) || 0) + 1);
  return Array.from(map.entries())
    .map(([status, value]) => ({ name: prettyStatus(status), value }))
    .sort((a, b) => b.value - a.value);
}

function calculateBarByPerson(rows: DatasetRow[]) {
  const map = new Map<string, { person: string; entregue: number; total: number }>();
  for (const r of rows) {
    const cur = map.get(r.person) || { person: r.person, entregue: 0, total: 0 };
    cur.total += 1;
    if (r.status === "ENTREGUE") cur.entregue += 1;
    map.set(r.person, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.entregue - a.entregue);
}

function calculateBarByTeam(rows: DatasetRow[]) {
  const map = new Map<string, { team: string; entregue: number; total: number }>();
  for (const r of rows) {
    const team = r.team || "GERAL";
    const cur = map.get(team) || { team, entregue: 0, total: 0 };
    cur.total += 1;
    if (r.status === "ENTREGUE") cur.entregue += 1;
    map.set(team, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.entregue - a.entregue);
}

function generateKPICards(kpis: ReturnType<typeof calculateKPIs>) {
  return `
    <div class="kpi-card">
      <div class="title">Taxa de Entrega</div>
      <div class="value">${kpis.taxa}%</div>
      <div class="subtitle">${kpis.entregue} de ${kpis.total} registros</div>
    </div>
    <div class="kpi-card">
      <div class="title">Total Entregue</div>
      <div class="value">${kpis.entregue}</div>
      <div class="subtitle">Marcados como ENTREGUE</div>
    </div>
    <div class="kpi-card warning">
      <div class="title">Pendências</div>
      <div class="value">${kpis.vazio}</div>
      <div class="subtitle">Sem informação lançada</div>
    </div>
    <div class="kpi-card info">
      <div class="title">Folgas</div>
      <div class="value">${kpis.folga}</div>
      <div class="subtitle">Dias de folga</div>
    </div>
    <div class="kpi-card neutral">
      <div class="title">Banco de Horas</div>
      <div class="value">${kpis.banco}</div>
      <div class="subtitle">Compensações</div>
    </div>
    <div class="kpi-card neutral">
      <div class="title">Pessoas</div>
      <div class="value">${kpis.pessoas}</div>
      <div class="subtitle">Colaboradores únicos</div>
    </div>
  `;
}

function generateTableRows(rows: DatasetRow[]) {
  return rows.map(row => `
    <tr>
      <td>${row.date}</td>
      <td>${row.person}</td>
      <td>${row.team || '-'}</td>
      <td><span class="status-badge status-${row.status === 'BANCO DE HORAS' ? 'BANCO' : row.status}">${row.status === 'VAZIO' ? 'Sem Info' : row.status}</span></td>
    </tr>
  `).join('');
}

export function exportToInteractiveHTML(options: ExportHTMLOptions): void {
  const { dataset, filters } = options;
  
  // Apply initial filters
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
  
  const html = generateHTML(dataset, rows);
  
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dashboard_${dataset.name}_${format(new Date(), 'yyyy-MM-dd')}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
