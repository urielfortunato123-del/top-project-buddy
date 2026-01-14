/* HTML Interactive Export utility - Generic version */
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

function generateHTML(dataset: Dataset, filteredRows: GenericRow[]): string {
  const catCols = dataset.detectedCategoryColumns;
  const numCols = dataset.detectedNumericColumns;
  const dateCol = dataset.detectedDateColumn;
  
  // Calcula estatísticas genéricas
  const stats: { [col: string]: { [val: string]: number } } = {};
  for (const col of catCols.slice(0, 3)) {
    stats[col] = {};
    for (const r of filteredRows) {
      const v = String(r[col] || "(vazio)");
      stats[col][v] = (stats[col][v] || 0) + 1;
    }
  }
  
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
    }
    .header h1 { font-size: 24px; }
    .container { padding: 20px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 20px; }
    .kpi-card { 
      background: white; 
      border-radius: 16px; 
      padding: 16px; 
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
      border-left: 4px solid #22c55e;
    }
    .kpi-card .title { font-size: 12px; color: #6b7280; margin-bottom: 4px; }
    .kpi-card .value { font-size: 28px; font-weight: 800; color: #1a1a2e; }
    .kpi-card .subtitle { font-size: 11px; color: #9ca3af; margin-top: 8px; }
    .charts-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 16px; margin-bottom: 20px; }
    .chart-card { 
      background: white; 
      border-radius: 16px; 
      padding: 20px; 
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
    }
    .chart-card h3 { font-size: 14px; font-weight: 600; margin-bottom: 16px; color: #374151; }
    .chart-container { height: 250px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; background: white; border-radius: 16px; overflow: hidden; }
    th { background: #f9fafb; padding: 12px 16px; text-align: left; font-weight: 600; }
    td { padding: 10px 16px; border-bottom: 1px solid #f3f4f6; }
    tr:hover td { background: #f9fafb; }
  </style>
</head>
<body>
  <div class="header">
    <h1>📊 ${dataset.name}</h1>
    <div style="font-size: 14px; opacity: 0.9;">Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} • ${filteredRows.length} registros</div>
  </div>
  
  <div class="container">
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="title">Total Registros</div>
        <div class="value">${filteredRows.length}</div>
        <div class="subtitle">de ${dataset.totalRows} no arquivo</div>
      </div>
      ${catCols.slice(0, 3).map(col => {
        const uniqueCount = Object.keys(stats[col] || {}).length;
        return `<div class="kpi-card">
          <div class="title">${col}</div>
          <div class="value">${uniqueCount}</div>
          <div class="subtitle">valores únicos</div>
        </div>`;
      }).join('')}
      ${numCols.slice(0, 2).map(col => {
        const numStats = dataset.summary.numericStats[col];
        return numStats ? `<div class="kpi-card">
          <div class="title">Soma ${col}</div>
          <div class="value">${numStats.sum.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</div>
          <div class="subtitle">Média: ${numStats.avg.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</div>
        </div>` : '';
      }).join('')}
    </div>
    
    <div class="charts-grid">
      ${catCols.slice(0, 2).map((col, idx) => `
        <div class="chart-card">
          <h3>📊 Distribuição: ${col}</h3>
          <div class="chart-container"><canvas id="chart${idx}"></canvas></div>
        </div>
      `).join('')}
    </div>
    
    <table>
      <thead>
        <tr>
          ${dataset.columns.slice(0, 6).map(col => `<th>${col.name}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${filteredRows.slice(0, 100).map(row => `
          <tr>
            ${dataset.columns.slice(0, 6).map(col => `<td>${row[col.name] || '-'}</td>`).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>
    ${filteredRows.length > 100 ? `<p style="text-align: center; padding: 20px; color: #6b7280;">Mostrando 100 de ${filteredRows.length} registros</p>` : ''}
  </div>
  
  <script>
    const colors = ['#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#6b7280', '#ec4899', '#14b8a6'];
    ${catCols.slice(0, 2).map((col, idx) => {
      const data = stats[col] || {};
      return `
        new Chart(document.getElementById('chart${idx}'), {
          type: ${idx === 0 ? "'doughnut'" : "'bar'"},
          data: {
            labels: ${JSON.stringify(Object.keys(data).slice(0, 10))},
            datasets: [{
              data: ${JSON.stringify(Object.values(data).slice(0, 10))},
              backgroundColor: colors
            }]
          },
          options: { responsive: true, maintainAspectRatio: false }
        });
      `;
    }).join('')}
  </script>
</body>
</html>`;
}

export function exportHTML(dataset: Dataset, filters?: any): void {
  const filteredRows = filters ? filterRows(dataset.rows, dataset, filters) : dataset.rows;
  const html = generateHTML(dataset, filteredRows);
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
  const catCols = dataset.detectedCategoryColumns;
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
