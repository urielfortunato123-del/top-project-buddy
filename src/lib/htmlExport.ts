/* HTML Interactive Export utility - Full Dashboard version */
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Dataset, GenericRow } from "./database";

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

function generateHTML(dataset: Dataset, allRows: GenericRow[]): string {
  const catCols = dataset.detectedCategoryColumns ?? [];
  const numCols = dataset.detectedNumericColumns ?? [];
  const textCols = dataset.detectedTextColumns ?? [];
  const dateCol = dataset.detectedDateColumn;
  const allColumns = dataset.columns ?? [];
  
  // Calcula estatísticas genéricas
  const stats: { [col: string]: { [val: string]: number } } = {};
  for (const col of catCols.slice(0, 5)) {
    stats[col] = {};
    for (const r of allRows) {
      const v = String(r[col] || "(vazio)");
      stats[col][v] = (stats[col][v] || 0) + 1;
    }
  }

  // Numeric stats
  const numericStats: { [col: string]: { min: number; max: number; sum: number; avg: number } } = {};
  for (const col of numCols) {
    const values = allRows.map(r => parseFloat(r[col]) || 0);
    if (values.length > 0) {
      numericStats[col] = {
        min: Math.min(...values),
        max: Math.max(...values),
        sum: values.reduce((a, b) => a + b, 0),
        avg: values.reduce((a, b) => a + b, 0) / values.length,
      };
    }
  }
  
  // Serialize data for JS
  const rowsJSON = JSON.stringify(allRows);
  const columnsJSON = JSON.stringify(allColumns.map(c => c.name));
  const catColsJSON = JSON.stringify(catCols);
  const numColsJSON = JSON.stringify(numCols);
  const statsJSON = JSON.stringify(stats);
  const numericStatsJSON = JSON.stringify(numericStats);
  
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard Interativo - ${dataset.name}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #22c55e;
      --primary-light: #4ade80;
      --secondary: #f59e0b;
      --accent: #3b82f6;
      --danger: #ef4444;
      --purple: #8b5cf6;
      --bg: #f8fafc;
      --card: #ffffff;
      --text: #0f172a;
      --text-muted: #64748b;
      --border: #e2e8f0;
      --shadow: 0 4px 20px rgba(0,0,0,0.08);
      --radius: 16px;
    }
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body { 
      font-family: 'Inter', system-ui, -apple-system, sans-serif; 
      background: var(--bg); 
      color: var(--text);
      min-height: 100vh;
      line-height: 1.5;
    }
    
    /* Header */
    .header { 
      background: linear-gradient(135deg, var(--primary), var(--secondary)); 
      color: white; 
      padding: 24px 32px;
      position: sticky;
      top: 0;
      z-index: 100;
      box-shadow: 0 4px 20px rgba(34, 197, 94, 0.3);
    }
    .header-content {
      max-width: 1600px;
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }
    .header h1 { 
      font-size: 24px; 
      font-weight: 800;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .header-meta {
      display: flex;
      gap: 16px;
      align-items: center;
      flex-wrap: wrap;
    }
    .badge {
      background: rgba(255,255,255,0.2);
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
      backdrop-filter: blur(10px);
    }
    
    /* Main Container */
    .container { 
      max-width: 1600px;
      margin: 0 auto;
      padding: 24px; 
    }
    
    /* Tabs */
    .tabs {
      display: flex;
      gap: 8px;
      margin-bottom: 24px;
      background: var(--card);
      padding: 8px;
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      overflow-x: auto;
    }
    .tab {
      padding: 12px 24px;
      border-radius: 12px;
      border: none;
      background: transparent;
      cursor: pointer;
      font-weight: 600;
      font-size: 14px;
      color: var(--text-muted);
      transition: all 0.2s;
      white-space: nowrap;
    }
    .tab:hover { background: var(--bg); color: var(--text); }
    .tab.active { 
      background: var(--primary); 
      color: white;
      box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
    }
    
    /* View Sections */
    .view { display: none; }
    .view.active { display: block; }
    
    /* Filters */
    .filters {
      display: flex;
      gap: 12px;
      margin-bottom: 24px;
      flex-wrap: wrap;
      align-items: center;
    }
    .filter-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .filter-label {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .filter-select {
      padding: 10px 16px;
      border: 2px solid var(--border);
      border-radius: 10px;
      font-size: 14px;
      font-weight: 500;
      background: var(--card);
      min-width: 160px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .filter-select:hover { border-color: var(--primary); }
    .filter-select:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(34,197,94,0.2); }
    
    .btn {
      padding: 10px 20px;
      border-radius: 10px;
      border: none;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .btn-primary {
      background: var(--primary);
      color: white;
    }
    .btn-primary:hover { background: var(--primary-light); transform: translateY(-1px); }
    .btn-outline {
      background: var(--card);
      color: var(--text);
      border: 2px solid var(--border);
    }
    .btn-outline:hover { border-color: var(--primary); color: var(--primary); }
    
    /* KPI Cards */
    .kpi-grid { 
      display: grid; 
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
      gap: 16px; 
      margin-bottom: 24px; 
    }
    .kpi-card { 
      background: var(--card); 
      border-radius: var(--radius); 
      padding: 20px; 
      box-shadow: var(--shadow);
      border-left: 4px solid var(--primary);
      transition: all 0.3s;
      cursor: pointer;
    }
    .kpi-card:hover { 
      transform: translateY(-4px); 
      box-shadow: 0 12px 40px rgba(0,0,0,0.12);
    }
    .kpi-card.warning { border-left-color: var(--secondary); }
    .kpi-card.info { border-left-color: var(--accent); }
    .kpi-card.purple { border-left-color: var(--purple); }
    .kpi-card .title { 
      font-size: 12px; 
      color: var(--text-muted); 
      margin-bottom: 8px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .kpi-card .value { 
      font-size: 32px; 
      font-weight: 900; 
      color: var(--text);
      line-height: 1;
    }
    .kpi-card .subtitle { 
      font-size: 12px; 
      color: var(--text-muted); 
      margin-top: 8px;
    }
    
    /* Charts */
    .charts-grid { 
      display: grid; 
      grid-template-columns: repeat(auto-fit, minmax(450px, 1fr)); 
      gap: 20px; 
      margin-bottom: 24px; 
    }
    .chart-card { 
      background: var(--card); 
      border-radius: var(--radius); 
      padding: 24px; 
      box-shadow: var(--shadow);
    }
    .chart-card h3 { 
      font-size: 16px; 
      font-weight: 700; 
      margin-bottom: 8px; 
      color: var(--text);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .chart-card .subtitle {
      font-size: 13px;
      color: var(--text-muted);
      margin-bottom: 16px;
    }
    .chart-container { height: 300px; position: relative; }
    
    /* Table */
    .table-container {
      background: var(--card);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      overflow: hidden;
    }
    .table-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid var(--border);
      flex-wrap: wrap;
      gap: 12px;
    }
    .table-title {
      font-weight: 700;
      font-size: 16px;
    }
    .table-actions {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .search-input {
      padding: 8px 16px;
      border: 2px solid var(--border);
      border-radius: 8px;
      font-size: 14px;
      min-width: 250px;
    }
    .search-input:focus { outline: none; border-color: var(--primary); }
    
    .table-scroll { overflow-x: auto; }
    table { 
      width: 100%; 
      border-collapse: collapse; 
      font-size: 13px;
    }
    th { 
      background: var(--bg); 
      padding: 14px 16px; 
      text-align: left; 
      font-weight: 700;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
      position: sticky;
      top: 0;
      cursor: pointer;
      user-select: none;
      white-space: nowrap;
    }
    th:hover { background: #e2e8f0; }
    th.sorted { color: var(--primary); }
    td { 
      padding: 12px 16px; 
      border-bottom: 1px solid var(--border);
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    tr:hover td { background: var(--bg); }
    
    .pagination {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-top: 1px solid var(--border);
      flex-wrap: wrap;
      gap: 12px;
    }
    .pagination-info {
      font-size: 13px;
      color: var(--text-muted);
    }
    .pagination-buttons {
      display: flex;
      gap: 4px;
    }
    .page-btn {
      padding: 8px 14px;
      border: 1px solid var(--border);
      background: var(--card);
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      transition: all 0.2s;
    }
    .page-btn:hover { border-color: var(--primary); color: var(--primary); }
    .page-btn.active { background: var(--primary); color: white; border-color: var(--primary); }
    .page-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    
    .per-page-select {
      padding: 8px 12px;
      border: 1px solid var(--border);
      border-radius: 6px;
      font-size: 13px;
    }
    
    /* Stats View */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
      gap: 20px;
    }
    .stats-card {
      background: var(--card);
      border-radius: var(--radius);
      padding: 24px;
      box-shadow: var(--shadow);
    }
    .stats-card h4 {
      font-size: 14px;
      font-weight: 700;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .stat-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 0;
      border-bottom: 1px solid var(--border);
    }
    .stat-row:last-child { border-bottom: none; }
    .stat-label { color: var(--text-muted); font-size: 13px; }
    .stat-value { font-weight: 700; }
    
    .progress-bar {
      height: 8px;
      background: var(--border);
      border-radius: 4px;
      overflow: hidden;
      margin-top: 6px;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--primary), var(--secondary));
      border-radius: 4px;
      transition: width 0.5s ease;
    }
    
    /* Footer */
    .footer {
      text-align: center;
      padding: 32px;
      color: var(--text-muted);
      font-size: 13px;
    }
    .footer a { color: var(--primary); text-decoration: none; font-weight: 600; }
    
    /* Responsive */
    @media (max-width: 768px) {
      .header { padding: 16px; }
      .header h1 { font-size: 18px; }
      .container { padding: 16px; }
      .charts-grid { grid-template-columns: 1fr; }
      .kpi-grid { grid-template-columns: repeat(2, 1fr); }
      .kpi-card .value { font-size: 24px; }
      .table-header { flex-direction: column; align-items: stretch; }
      .search-input { min-width: 100%; }
    }
    
    /* Print styles */
    @media print {
      .header { position: static; }
      .filters, .tabs, .pagination, .table-actions { display: none; }
      .chart-card, .kpi-card, .stats-card { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-content">
      <h1>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 3v18h18"/>
          <path d="m19 9-5 5-4-4-3 3"/>
        </svg>
        ${dataset.name}
      </h1>
      <div class="header-meta">
        <span class="badge">📊 ${allRows.length} registros</span>
        <span class="badge">📅 ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
        <span class="badge">📁 ${allColumns.length} colunas</span>
      </div>
    </div>
  </div>
  
  <div class="container">
    <!-- Tabs -->
    <div class="tabs">
      <button class="tab active" data-view="dashboard">📊 Dashboard</button>
      <button class="tab" data-view="table">📋 Planilha</button>
      <button class="tab" data-view="stats">📈 Estatísticas</button>
      <button class="tab" data-view="charts">🎨 Gráficos</button>
    </div>
    
    <!-- Filters -->
    <div class="filters" id="filters"></div>
    
    <!-- Dashboard View -->
    <div class="view active" id="view-dashboard">
      <div class="kpi-grid" id="kpi-grid"></div>
      <div class="charts-grid" id="charts-grid"></div>
    </div>
    
    <!-- Table View -->
    <div class="view" id="view-table">
      <div class="table-container">
        <div class="table-header">
          <span class="table-title">📋 Dados Completos</span>
          <div class="table-actions">
            <input type="text" class="search-input" id="search-input" placeholder="🔍 Buscar em todos os campos...">
            <select class="per-page-select" id="per-page">
              <option value="25">25 por página</option>
              <option value="50">50 por página</option>
              <option value="100" selected>100 por página</option>
              <option value="250">250 por página</option>
              <option value="all">Todos</option>
            </select>
          </div>
        </div>
        <div class="table-scroll">
          <table id="data-table">
            <thead id="table-head"></thead>
            <tbody id="table-body"></tbody>
          </table>
        </div>
        <div class="pagination" id="pagination"></div>
      </div>
    </div>
    
    <!-- Stats View -->
    <div class="view" id="view-stats">
      <div class="stats-grid" id="stats-grid"></div>
    </div>
    
    <!-- Charts View -->
    <div class="view" id="view-charts">
      <div class="charts-grid" id="extra-charts"></div>
    </div>
  </div>
  
  <div class="footer">
    <p>Dashboard gerado automaticamente por <a href="#">Essencial Sistema</a></p>
    <p style="margin-top:8px;">Desenvolvido por <strong>Uriel da Fonseca Fortunato</strong></p>
  </div>

  <script>
    // Data
    const allRows = ${rowsJSON};
    const columns = ${columnsJSON};
    const catCols = ${catColsJSON};
    const numCols = ${numColsJSON};
    const stats = ${statsJSON};
    const numericStats = ${numericStatsJSON};
    const dateCol = ${dateCol ? `"${dateCol}"` : 'null'};
    
    // State
    let filteredRows = [...allRows];
    let currentPage = 1;
    let perPage = 100;
    let sortColumn = null;
    let sortDir = 'asc';
    let searchTerm = '';
    let filters = {};
    let charts = {};
    
    // Chart colors
    const colors = [
      '#22c55e', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6',
      '#ec4899', '#14b8a6', '#6366f1', '#84cc16', '#f97316'
    ];
    
    // Initialize
    document.addEventListener('DOMContentLoaded', () => {
      initTabs();
      initFilters();
      initSearch();
      initPerPage();
      render();
    });
    
    function initTabs() {
      document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
          document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
          document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
          tab.classList.add('active');
          document.getElementById('view-' + tab.dataset.view).classList.add('active');
          
          // Render charts when switching views
          setTimeout(() => {
            Object.values(charts).forEach(c => c.resize && c.resize());
          }, 100);
        });
      });
    }
    
    function initFilters() {
      const container = document.getElementById('filters');
      let html = '';
      
      catCols.slice(0, 4).forEach((col, idx) => {
        const values = Object.keys(stats[col] || {}).sort();
        html += \`
          <div class="filter-group">
            <label class="filter-label">\${col}</label>
            <select class="filter-select" data-col="\${col}">
              <option value="">Todos</option>
              \${values.map(v => \`<option value="\${v}">\${v} (\${stats[col][v]})</option>\`).join('')}
            </select>
          </div>
        \`;
      });
      
      html += \`
        <button class="btn btn-outline" onclick="clearFilters()">🔄 Limpar</button>
        <button class="btn btn-primary" onclick="window.print()">🖨️ Imprimir</button>
      \`;
      
      container.innerHTML = html;
      
      container.querySelectorAll('.filter-select').forEach(select => {
        select.addEventListener('change', () => {
          filters[select.dataset.col] = select.value;
          applyFilters();
        });
      });
    }
    
    function initSearch() {
      document.getElementById('search-input').addEventListener('input', (e) => {
        searchTerm = e.target.value.toLowerCase();
        currentPage = 1;
        applyFilters();
      });
    }
    
    function initPerPage() {
      document.getElementById('per-page').addEventListener('change', (e) => {
        perPage = e.target.value === 'all' ? filteredRows.length : parseInt(e.target.value);
        currentPage = 1;
        renderTable();
      });
    }
    
    function clearFilters() {
      filters = {};
      searchTerm = '';
      document.getElementById('search-input').value = '';
      document.querySelectorAll('.filter-select').forEach(s => s.value = '');
      applyFilters();
    }
    
    function applyFilters() {
      filteredRows = allRows.filter(row => {
        // Category filters
        for (const col of Object.keys(filters)) {
          if (filters[col] && row[col] !== filters[col]) return false;
        }
        
        // Search
        if (searchTerm) {
          const rowText = columns.map(c => String(row[c] || '')).join(' ').toLowerCase();
          if (!rowText.includes(searchTerm)) return false;
        }
        
        return true;
      });
      
      currentPage = 1;
      render();
    }
    
    function render() {
      renderKPIs();
      renderCharts();
      renderTable();
      renderStats();
      renderExtraCharts();
    }
    
    function renderKPIs() {
      const grid = document.getElementById('kpi-grid');
      let html = '';
      
      // Total records
      html += \`
        <div class="kpi-card">
          <div class="title">Total Registros</div>
          <div class="value">\${filteredRows.length.toLocaleString('pt-BR')}</div>
          <div class="subtitle">de \${allRows.length} no arquivo</div>
        </div>
      \`;
      
      // Numeric columns
      numCols.slice(0, 2).forEach(col => {
        const values = filteredRows.map(r => parseFloat(r[col]) || 0);
        const sum = values.reduce((a,b) => a+b, 0);
        const avg = values.length > 0 ? sum / values.length : 0;
        html += \`
          <div class="kpi-card info">
            <div class="title">Soma \${col}</div>
            <div class="value">\${sum.toLocaleString('pt-BR', {maximumFractionDigits: 2})}</div>
            <div class="subtitle">Média: \${avg.toLocaleString('pt-BR', {maximumFractionDigits: 2})}</div>
          </div>
        \`;
      });
      
      // Category columns
      catCols.slice(0, 3).forEach(col => {
        const counts = {};
        filteredRows.forEach(r => {
          const v = r[col] || '(vazio)';
          counts[v] = (counts[v] || 0) + 1;
        });
        const uniqueCount = Object.keys(counts).length;
        const top = Object.entries(counts).sort((a,b) => b[1] - a[1])[0];
        html += \`
          <div class="kpi-card warning">
            <div class="title">\${col}</div>
            <div class="value">\${uniqueCount}</div>
            <div class="subtitle">Top: \${top ? top[0] + ' (' + top[1] + ')' : '-'}</div>
          </div>
        \`;
      });
      
      grid.innerHTML = html;
    }
    
    function renderCharts() {
      const grid = document.getElementById('charts-grid');
      grid.innerHTML = '';
      
      // Chart 1: Pie for first category
      if (catCols[0]) {
        const counts = {};
        filteredRows.forEach(r => {
          const v = r[catCols[0]] || '(vazio)';
          counts[v] = (counts[v] || 0) + 1;
        });
        const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, 10);
        
        grid.innerHTML += \`
          <div class="chart-card">
            <h3>🥧 Distribuição: \${catCols[0]}</h3>
            <div class="subtitle">Top 10 valores</div>
            <div class="chart-container"><canvas id="chart-pie"></canvas></div>
          </div>
        \`;
        
        setTimeout(() => {
          const ctx = document.getElementById('chart-pie');
          if (ctx) {
            charts.pie = new Chart(ctx, {
              type: 'doughnut',
              data: {
                labels: sorted.map(s => s[0]),
                datasets: [{ data: sorted.map(s => s[1]), backgroundColor: colors }]
              },
              options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
            });
          }
        }, 100);
      }
      
      // Chart 2: Bar for second category or first
      const barCol = catCols[1] || catCols[0];
      if (barCol) {
        const counts = {};
        filteredRows.forEach(r => {
          const v = r[barCol] || '(vazio)';
          counts[v] = (counts[v] || 0) + 1;
        });
        const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, 10);
        
        grid.innerHTML += \`
          <div class="chart-card">
            <h3>📊 Por \${barCol}</h3>
            <div class="subtitle">Top 10 por quantidade</div>
            <div class="chart-container"><canvas id="chart-bar"></canvas></div>
          </div>
        \`;
        
        setTimeout(() => {
          const ctx = document.getElementById('chart-bar');
          if (ctx) {
            charts.bar = new Chart(ctx, {
              type: 'bar',
              data: {
                labels: sorted.map(s => s[0].length > 20 ? s[0].slice(0,20) + '...' : s[0]),
                datasets: [{ label: 'Quantidade', data: sorted.map(s => s[1]), backgroundColor: colors }]
              },
              options: { 
                responsive: true, 
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true } }
              }
            });
          }
        }, 100);
      }
    }
    
    function renderTable() {
      // Sort
      let sorted = [...filteredRows];
      if (sortColumn) {
        sorted.sort((a, b) => {
          let va = a[sortColumn] ?? '';
          let vb = b[sortColumn] ?? '';
          if (typeof va === 'number' && typeof vb === 'number') {
            return sortDir === 'asc' ? va - vb : vb - va;
          }
          return sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
        });
      }
      
      // Paginate
      const start = (currentPage - 1) * perPage;
      const end = Math.min(start + perPage, sorted.length);
      const pageRows = sorted.slice(start, end);
      
      // Header
      const thead = document.getElementById('table-head');
      thead.innerHTML = '<tr>' + columns.map(col => 
        \`<th onclick="sortBy('\${col}')" class="\${sortColumn === col ? 'sorted' : ''}">\${col} \${sortColumn === col ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>\`
      ).join('') + '</tr>';
      
      // Body
      const tbody = document.getElementById('table-body');
      tbody.innerHTML = pageRows.map(row => 
        '<tr>' + columns.map(col => \`<td title="\${row[col] || ''}">\${row[col] || '-'}</td>\`).join('') + '</tr>'
      ).join('');
      
      // Pagination
      const totalPages = Math.ceil(sorted.length / perPage);
      const pagination = document.getElementById('pagination');
      
      let pageButtons = '';
      if (totalPages > 1) {
        pageButtons = \`
          <button class="page-btn" onclick="goToPage(1)" \${currentPage === 1 ? 'disabled' : ''}>«</button>
          <button class="page-btn" onclick="goToPage(\${currentPage - 1})" \${currentPage === 1 ? 'disabled' : ''}>‹</button>
        \`;
        
        for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) {
          pageButtons += \`<button class="page-btn \${i === currentPage ? 'active' : ''}" onclick="goToPage(\${i})">\${i}</button>\`;
        }
        
        pageButtons += \`
          <button class="page-btn" onclick="goToPage(\${currentPage + 1})" \${currentPage === totalPages ? 'disabled' : ''}>›</button>
          <button class="page-btn" onclick="goToPage(\${totalPages})" \${currentPage === totalPages ? 'disabled' : ''}>»</button>
        \`;
      }
      
      pagination.innerHTML = \`
        <span class="pagination-info">Mostrando \${start + 1} - \${end} de \${sorted.length} registros</span>
        <div class="pagination-buttons">\${pageButtons}</div>
      \`;
    }
    
    function sortBy(col) {
      if (sortColumn === col) {
        sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        sortColumn = col;
        sortDir = 'asc';
      }
      renderTable();
    }
    
    function goToPage(page) {
      currentPage = page;
      renderTable();
    }
    
    function renderStats() {
      const grid = document.getElementById('stats-grid');
      let html = '';
      
      // Numeric stats
      numCols.forEach(col => {
        const values = filteredRows.map(r => parseFloat(r[col]) || 0);
        if (values.length === 0) return;
        
        const sum = values.reduce((a,b) => a+b, 0);
        const avg = sum / values.length;
        const min = Math.min(...values);
        const max = Math.max(...values);
        
        html += \`
          <div class="stats-card">
            <h4>📊 \${col}</h4>
            <div class="stat-row">
              <span class="stat-label">Soma</span>
              <span class="stat-value">\${sum.toLocaleString('pt-BR', {maximumFractionDigits: 2})}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Média</span>
              <span class="stat-value">\${avg.toLocaleString('pt-BR', {maximumFractionDigits: 2})}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Mínimo</span>
              <span class="stat-value">\${min.toLocaleString('pt-BR', {maximumFractionDigits: 2})}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Máximo</span>
              <span class="stat-value">\${max.toLocaleString('pt-BR', {maximumFractionDigits: 2})}</span>
            </div>
          </div>
        \`;
      });
      
      // Category distributions
      catCols.slice(0, 4).forEach(col => {
        const counts = {};
        filteredRows.forEach(r => {
          const v = r[col] || '(vazio)';
          counts[v] = (counts[v] || 0) + 1;
        });
        const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, 8);
        const total = sorted.reduce((a, s) => a + s[1], 0);
        
        html += \`
          <div class="stats-card">
            <h4>🏷️ \${col}</h4>
            \${sorted.map(([name, count]) => \`
              <div style="margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; font-size: 13px;">
                  <span>\${name.length > 30 ? name.slice(0,30) + '...' : name}</span>
                  <span style="font-weight: 600;">\${count} (\${((count/total)*100).toFixed(1)}%)</span>
                </div>
                <div class="progress-bar">
                  <div class="progress-fill" style="width: \${(count/total)*100}%"></div>
                </div>
              </div>
            \`).join('')}
          </div>
        \`;
      });
      
      grid.innerHTML = html;
    }
    
    function renderExtraCharts() {
      const grid = document.getElementById('extra-charts');
      grid.innerHTML = '';
      
      // Horizontal bar for third category
      if (catCols[2]) {
        const counts = {};
        filteredRows.forEach(r => {
          const v = r[catCols[2]] || '(vazio)';
          counts[v] = (counts[v] || 0) + 1;
        });
        const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, 15);
        
        grid.innerHTML += \`
          <div class="chart-card">
            <h3>📈 Ranking: \${catCols[2]}</h3>
            <div class="subtitle">Top 15 valores</div>
            <div class="chart-container" style="height: 400px;"><canvas id="chart-hbar"></canvas></div>
          </div>
        \`;
        
        setTimeout(() => {
          const ctx = document.getElementById('chart-hbar');
          if (ctx) {
            new Chart(ctx, {
              type: 'bar',
              data: {
                labels: sorted.map(s => s[0].length > 25 ? s[0].slice(0,25) + '...' : s[0]),
                datasets: [{ data: sorted.map(s => s[1]), backgroundColor: colors }]
              },
              options: { 
                indexAxis: 'y',
                responsive: true, 
                maintainAspectRatio: false,
                plugins: { legend: { display: false } }
              }
            });
          }
        }, 100);
      }
      
      // Line chart if date column exists
      if (dateCol) {
        const byDate = {};
        filteredRows.forEach(r => {
          const d = r[dateCol];
          if (d) {
            byDate[d] = (byDate[d] || 0) + 1;
          }
        });
        const sorted = Object.entries(byDate).sort((a,b) => a[0].localeCompare(b[0]));
        
        if (sorted.length > 1) {
          grid.innerHTML += \`
            <div class="chart-card">
              <h3>📅 Evolução por \${dateCol}</h3>
              <div class="subtitle">Registros ao longo do tempo</div>
              <div class="chart-container"><canvas id="chart-line"></canvas></div>
            </div>
          \`;
          
          setTimeout(() => {
            const ctx = document.getElementById('chart-line');
            if (ctx) {
              new Chart(ctx, {
                type: 'line',
                data: {
                  labels: sorted.map(s => s[0]),
                  datasets: [{
                    label: 'Registros',
                    data: sorted.map(s => s[1]),
                    borderColor: '#22c55e',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    fill: true,
                    tension: 0.4
                  }]
                },
                options: { 
                  responsive: true, 
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } }
                }
              });
            }
          }, 100);
        }
      }
      
      // Polar area for comparison
      if (catCols[0] && numCols[0]) {
        const sums = {};
        filteredRows.forEach(r => {
          const cat = r[catCols[0]] || '(vazio)';
          const val = parseFloat(r[numCols[0]]) || 0;
          sums[cat] = (sums[cat] || 0) + val;
        });
        const sorted = Object.entries(sums).sort((a,b) => b[1] - a[1]).slice(0, 8);
        
        grid.innerHTML += \`
          <div class="chart-card">
            <h3>🎯 \${numCols[0]} por \${catCols[0]}</h3>
            <div class="subtitle">Soma por categoria</div>
            <div class="chart-container"><canvas id="chart-polar"></canvas></div>
          </div>
        \`;
        
        setTimeout(() => {
          const ctx = document.getElementById('chart-polar');
          if (ctx) {
            new Chart(ctx, {
              type: 'polarArea',
              data: {
                labels: sorted.map(s => s[0].length > 15 ? s[0].slice(0,15) + '...' : s[0]),
                datasets: [{ data: sorted.map(s => s[1]), backgroundColor: colors.map(c => c + '99') }]
              },
              options: { 
                responsive: true, 
                maintainAspectRatio: false
              }
            });
          }
        }, 100);
      }
    }
  </script>
</body>
</html>`;
}

export function exportHTML(dataset: Dataset, filters?: any): void {
  const filteredRows = filters ? filterRows(dataset.rows, dataset, filters) : dataset.rows;
  // Export ALL rows, not just filtered - let the HTML handle filtering
  const html = generateHTML(dataset, dataset.rows);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${dataset.name}_dashboard.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function filterRows(rows: GenericRow[], dataset: Dataset, filters: any): GenericRow[] {
  let data = [...rows];
  const catCols = dataset.detectedCategoryColumns ?? [];
  const dateCol = dataset.detectedDateColumn;
  
  if (filters.team && filters.team !== "ALL" && catCols[0]) {
    data = data.filter(r => r[catCols[0]] === filters.team);
  }
  if (filters.person && filters.person !== "ALL" && catCols[1]) {
    data = data.filter(r => r[catCols[1]] === filters.person);
  }
  if (filters.status && filters.status !== "ALL" && catCols[2]) {
    data = data.filter(r => r[catCols[2]] === filters.status);
  }
  if (dateCol && filters.dateFrom) {
    const fromStr = filters.dateFrom.toISOString().slice(0, 10);
    data = data.filter(r => r[dateCol] >= fromStr);
  }
  if (dateCol && filters.dateTo) {
    const toStr = filters.dateTo.toISOString().slice(0, 10);
    data = data.filter(r => r[dateCol] <= toStr);
  }
  
  return data;
}
