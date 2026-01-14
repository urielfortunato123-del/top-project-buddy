/**
 * Interactive Report Export - Generates interactive HTML dashboard (Generic version)
 */
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Dataset, GenericRow } from "./database";
import JSZip from "jszip";

export interface ReportFilters {
  team: string;
  person: string;
  status: string;
  dateFrom?: Date;
  dateTo?: Date;
}

function filterRows(rows: GenericRow[], dataset: Dataset, filters: ReportFilters): GenericRow[] {
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

function generateInteractiveHTML(dataset: Dataset, filteredRows: GenericRow[]): string {
  const now = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  const catCols = dataset.detectedCategoryColumns;
  const numCols = dataset.detectedNumericColumns;
  const dateCol = dataset.detectedDateColumn;
  
  // Prepara listas para filtros
  const filterLists: { [col: string]: string[] } = {};
  for (const col of catCols.slice(0, 3)) {
    const counts = dataset.summary.categoryCounts[col] || {};
    filterLists[col] = Object.keys(counts).sort();
  }
  
  const reportData = {
    datasetName: dataset.name,
    generatedAt: now,
    totalRecords: dataset.totalRows,
    columns: dataset.columns.map(c => c.name),
    catCols,
    numCols,
    dateCol,
    filterLists,
    rows: filteredRows
  };

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Relatório - ${dataset.name}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}:root{--primary:#10b981;--warning:#f59e0b;--danger:#ef4444;--info:#3b82f6;--purple:#8b5cf6;--bg:#0f172a;--card:#1e293b;--border:#334155;--text:#f8fafc;--muted:#94a3b8}body{font-family:'Segoe UI',system-ui,sans-serif;background:var(--bg);color:var(--text);min-height:100vh}.header{background:linear-gradient(135deg,#10b981,#3b82f6,#8b5cf6);color:#fff;padding:24px 32px}.header h1{font-size:24px;font-weight:700}.filters{background:var(--card);border-bottom:1px solid var(--border);padding:16px 24px;display:flex;gap:20px;flex-wrap:wrap;align-items:flex-end}.filter-group{display:flex;flex-direction:column;gap:6px}.filter-group label{font-size:11px;color:var(--muted);text-transform:uppercase;font-weight:600}.filter-group select{padding:10px 14px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg);color:var(--text);min-width:160px}.container{padding:24px;display:flex;flex-direction:column;gap:24px}.kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:16px}.kpi-card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:20px;position:relative}.kpi-card::before{content:'';position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(135deg,var(--primary),#059669);border-radius:16px 16px 0 0}.kpi-card .title{font-size:12px;color:var(--muted);text-transform:uppercase;font-weight:600}.kpi-card .value{font-size:28px;font-weight:800;color:var(--primary);margin:8px 0}.kpi-card .subtitle{font-size:11px;color:var(--muted)}.charts-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(400px,1fr));gap:20px}.chart-card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:20px}.chart-card h3{font-size:14px;font-weight:600;margin-bottom:16px}.chart-container{height:280px}.table-section{background:var(--card);border:1px solid var(--border);border-radius:16px;overflow:hidden}table{width:100%;border-collapse:collapse;font-size:13px}th{background:var(--bg);padding:14px 16px;text-align:left;font-weight:600;position:sticky;top:0;color:var(--muted);text-transform:uppercase;font-size:11px}td{padding:12px 16px;border-bottom:1px solid var(--border)}tr:hover td{background:rgba(16,185,129,.05)}
  </style>
</head>
<body>
  <script>window.__REPORT_DATA__=${JSON.stringify(reportData)};</script>
  <div class="header">
    <h1>📊 ${dataset.name}</h1>
    <div style="font-size:13px;opacity:.9">Gerado em ${now} • ${filteredRows.length} registros</div>
  </div>
  <div class="filters" id="filtersContainer"></div>
  <div class="container">
    <div class="kpi-grid" id="kpiGrid"></div>
    <div class="charts-grid" id="chartsGrid"></div>
    <div class="table-section">
      <div style="padding:16px;border-bottom:1px solid var(--border)"><h3>📋 Dados</h3></div>
      <div style="max-height:400px;overflow:auto"><table><thead id="tableHead"></thead><tbody id="tableBody"></tbody></table></div>
    </div>
  </div>
  <script>
    const DATA=window.__REPORT_DATA__;
    let filteredData=[...DATA.rows];
    let charts={};
    
    function init(){
      // Build filters
      const filtersHtml=DATA.catCols.slice(0,3).map((col,i)=>{
        const options=DATA.filterLists[col]||[];
        return '<div class="filter-group"><label>'+col+'</label><select id="filter'+i+'" onchange="applyFilters()"><option value="ALL">Todos</option>'+options.map(o=>'<option value="'+o+'">'+o+'</option>').join('')+'</select></div>';
      }).join('');
      document.getElementById('filtersContainer').innerHTML=filtersHtml+'<div style="margin-left:auto;font-size:13px">Mostrando: <strong id="countDisplay">'+filteredData.length+'</strong></div>';
      
      updateAll();
      initCharts();
    }
    
    function applyFilters(){
      filteredData=DATA.rows.filter(r=>{
        for(let i=0;i<Math.min(3,DATA.catCols.length);i++){
          const val=document.getElementById('filter'+i)?.value;
          if(val&&val!=='ALL'&&r[DATA.catCols[i]]!==val)return false;
        }
        return true;
      });
      document.getElementById('countDisplay').textContent=filteredData.length;
      updateAll();
      updateCharts();
    }
    
    function updateAll(){
      // KPIs
      let kpiHtml='<div class="kpi-card"><div class="title">Total</div><div class="value">'+filteredData.length+'</div></div>';
      DATA.catCols.slice(0,3).forEach(col=>{
        const unique=new Set(filteredData.map(r=>r[col])).size;
        kpiHtml+='<div class="kpi-card"><div class="title">'+col+'</div><div class="value">'+unique+'</div><div class="subtitle">valores únicos</div></div>';
      });
      DATA.numCols.slice(0,2).forEach(col=>{
        const sum=filteredData.reduce((a,r)=>a+(parseFloat(r[col])||0),0);
        kpiHtml+='<div class="kpi-card"><div class="title">Soma '+col+'</div><div class="value">'+sum.toLocaleString('pt-BR',{maximumFractionDigits:0})+'</div></div>';
      });
      document.getElementById('kpiGrid').innerHTML=kpiHtml;
      
      // Table
      const cols=DATA.columns.slice(0,6);
      document.getElementById('tableHead').innerHTML='<tr>'+cols.map(c=>'<th>'+c+'</th>').join('')+'</tr>';
      document.getElementById('tableBody').innerHTML=filteredData.slice(0,100).map(r=>'<tr>'+cols.map(c=>'<td>'+(r[c]||'-')+'</td>').join('')+'</tr>').join('');
    }
    
    function initCharts(){
      const colors=['#10b981','#f59e0b','#ef4444','#3b82f6','#8b5cf6','#6b7280','#ec4899'];
      let chartsHtml='';
      DATA.catCols.slice(0,2).forEach((col,i)=>{
        chartsHtml+='<div class="chart-card"><h3>📊 '+col+'</h3><div class="chart-container"><canvas id="chart'+i+'"></canvas></div></div>';
      });
      document.getElementById('chartsGrid').innerHTML=chartsHtml;
      
      DATA.catCols.slice(0,2).forEach((col,i)=>{
        const counts={};
        filteredData.forEach(r=>{const v=r[col]||'(vazio)';counts[v]=(counts[v]||0)+1});
        const sorted=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,10);
        charts['chart'+i]=new Chart(document.getElementById('chart'+i),{
          type:i===0?'doughnut':'bar',
          data:{labels:sorted.map(s=>s[0]),datasets:[{data:sorted.map(s=>s[1]),backgroundColor:colors}]},
          options:{responsive:true,maintainAspectRatio:false}
        });
      });
    }
    
    function updateCharts(){
      DATA.catCols.slice(0,2).forEach((col,i)=>{
        const counts={};
        filteredData.forEach(r=>{const v=r[col]||'(vazio)';counts[v]=(counts[v]||0)+1});
        const sorted=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,10);
        if(charts['chart'+i]){
          charts['chart'+i].data.labels=sorted.map(s=>s[0]);
          charts['chart'+i].data.datasets[0].data=sorted.map(s=>s[1]);
          charts['chart'+i].update();
        }
      });
    }
    
    init();
  </script>
</body>
</html>`;
}

export function exportInteractiveHTML(dataset: Dataset, filters: ReportFilters): void {
  const filteredRows = filterRows(dataset.rows, dataset, filters);
  const html = generateInteractiveHTML(dataset, filteredRows);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${dataset.name}_relatorio.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function exportInteractiveZIP(dataset: Dataset, filters: ReportFilters): Promise<void> {
  const filteredRows = filterRows(dataset.rows, dataset, filters);
  const html = generateInteractiveHTML(dataset, filteredRows);
  const zip = new JSZip();
  zip.file(`${dataset.name}_relatorio.html`, html);
  const content = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(content);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${dataset.name}_relatorio.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
