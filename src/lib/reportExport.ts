/**
 * Interactive Report Export - Generates interactive HTML dashboard
 */
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Dataset, DatasetRow } from "./database";
import JSZip from "jszip";

export interface ReportFilters {
  team: string;
  person: string;
  status: string;
  dateFrom?: Date;
  dateTo?: Date;
}

function filterRows(rows: DatasetRow[], filters: ReportFilters): DatasetRow[] {
  return rows.filter((row) => {
    if (filters.team && filters.team !== "ALL" && row.team !== filters.team) return false;
    if (filters.person && filters.person !== "ALL" && row.person !== filters.person) return false;
    if (filters.status && filters.status !== "ALL" && row.status !== filters.status) return false;
    if (filters.dateFrom) {
      const rowDate = new Date(row.date);
      if (rowDate < filters.dateFrom) return false;
    }
    if (filters.dateTo) {
      const rowDate = new Date(row.date);
      if (rowDate > filters.dateTo) return false;
    }
    return true;
  });
}

function generateInteractiveHTML(dataset: Dataset, filteredRows: DatasetRow[]): string {
  const now = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  
  const reportData = {
    datasetName: dataset.name,
    generatedAt: now,
    totalRecords: dataset.rows.length,
    teams: dataset.teams,
    people: dataset.people,
    statuses: dataset.statuses,
    rows: filteredRows.map(r => ({
      date: r.date,
      person: r.person,
      status: r.status,
      team: r.team || 'GERAL'
    }))
  };

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Relatório Dashboard - ${dataset.name}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}:root{--primary:#10b981;--warning:#f59e0b;--danger:#ef4444;--info:#3b82f6;--purple:#8b5cf6;--bg:#0f172a;--card:#1e293b;--border:#334155;--text:#f8fafc;--muted:#94a3b8}body{font-family:'Segoe UI',system-ui,sans-serif;background:var(--bg);color:var(--text);min-height:100vh}.header{background:linear-gradient(135deg,#10b981,#3b82f6,#8b5cf6);color:#fff;padding:24px 32px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px}.header h1{font-size:24px;font-weight:700}.filters{background:var(--card);border-bottom:1px solid var(--border);padding:16px 24px;display:flex;gap:20px;flex-wrap:wrap;align-items:flex-end}.filter-group{display:flex;flex-direction:column;gap:6px}.filter-group label{font-size:11px;color:var(--muted);text-transform:uppercase;font-weight:600}.filter-group select,.filter-group input{padding:10px 14px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg);color:var(--text);min-width:160px}.btn{padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;border:none;background:var(--card);color:var(--text)}.container{padding:24px;display:flex;flex-direction:column;gap:24px}.kpi-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:16px}@media(max-width:1200px){.kpi-grid{grid-template-columns:repeat(3,1fr)}}@media(max-width:768px){.kpi-grid{grid-template-columns:repeat(2,1fr)}}.kpi-card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:20px;position:relative}.kpi-card::before{content:'';position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(135deg,var(--primary),#059669);border-radius:16px 16px 0 0}.kpi-card.warning::before{background:linear-gradient(135deg,var(--warning),#d97706)}.kpi-card.info::before{background:linear-gradient(135deg,var(--info),#2563eb)}.kpi-card.purple::before{background:linear-gradient(135deg,var(--purple),#7c3aed)}.kpi-card .title{font-size:12px;color:var(--muted);text-transform:uppercase;font-weight:600}.kpi-card .value{font-size:32px;font-weight:800;color:var(--primary);margin:8px 0}.kpi-card.warning .value{color:var(--warning)}.kpi-card.info .value{color:var(--info)}.kpi-card.purple .value{color:var(--purple)}.kpi-card .subtitle{font-size:11px;color:var(--muted)}.charts-grid{display:grid;grid-template-columns:2fr 1fr;gap:20px}@media(max-width:1024px){.charts-grid{grid-template-columns:1fr}}.chart-card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:20px}.chart-card h3{font-size:14px;font-weight:600;margin-bottom:16px}.chart-container{height:280px;position:relative}.table-section{background:var(--card);border:1px solid var(--border);border-radius:16px;overflow:hidden}.table-header{padding:16px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between}.table-wrapper{max-height:400px;overflow-y:auto}table{width:100%;border-collapse:collapse;font-size:13px}th{background:var(--bg);padding:14px 16px;text-align:left;font-weight:600;position:sticky;top:0;color:var(--muted);text-transform:uppercase;font-size:11px;cursor:pointer}td{padding:12px 16px;border-bottom:1px solid var(--border)}tr:hover td{background:rgba(16,185,129,.05)}.status-badge{padding:4px 12px;border-radius:20px;font-size:11px;font-weight:600}.status-ENTREGUE{background:rgba(16,185,129,.15);color:#10b981}.status-FOLGA{background:rgba(59,130,246,.15);color:#3b82f6}.status-BANCO{background:rgba(139,92,246,.15);color:#8b5cf6}.status-VAZIO{background:rgba(245,158,11,.15);color:#f59e0b}.footer{text-align:center;padding:24px;color:var(--muted);font-size:12px;border-top:1px solid var(--border);margin-top:24px}
  </style>
</head>
<body>
  <script>window.__REPORT_DATA__=${JSON.stringify(reportData)};</script>
  <div class="header"><div><h1>📊 Relatório: ${dataset.name}</h1><div style="font-size:13px;opacity:.9">Gerado em ${now} • ${filteredRows.length} registros</div></div></div>
  <div class="filters">
    <div class="filter-group"><label>Equipe</label><select id="filterTeam" onchange="applyFilters()"><option value="ALL">Todas</option>${dataset.teams.map(t=>`<option value="${t}">${t}</option>`).join('')}</select></div>
    <div class="filter-group"><label>Pessoa</label><select id="filterPerson" onchange="applyFilters()"><option value="ALL">Todas</option>${dataset.people.map(p=>`<option value="${p}">${p}</option>`).join('')}</select></div>
    <div class="filter-group"><label>Status</label><select id="filterStatus" onchange="applyFilters()"><option value="ALL">Todos</option>${dataset.statuses.map(s=>`<option value="${s}">${s==='VAZIO'?'Sem Info':s}</option>`).join('')}</select></div>
    <div class="filter-group"><label>Data Início</label><input type="date" id="filterDateFrom" onchange="applyFilters()"></div>
    <div class="filter-group"><label>Data Fim</label><input type="date" id="filterDateTo" onchange="applyFilters()"></div>
    <button class="btn" onclick="resetFilters()">Limpar</button>
    <div style="margin-left:auto;font-size:13px">Mostrando: <strong id="countDisplay">${filteredRows.length}</strong></div>
  </div>
  <div class="container">
    <div class="kpi-grid" id="kpiGrid"></div>
    <div class="charts-grid"><div class="chart-card"><h3>📈 Entregas por Dia</h3><div class="chart-container"><canvas id="lineChart"></canvas></div></div><div class="chart-card"><h3>🍩 Status</h3><div class="chart-container"><canvas id="pieChart"></canvas></div></div></div>
    <div class="charts-grid"><div class="chart-card"><h3>👤 Top 10 Pessoas</h3><div class="chart-container"><canvas id="personChart"></canvas></div></div><div class="chart-card"><h3>👥 Equipes</h3><div class="chart-container"><canvas id="teamChart"></canvas></div></div></div>
    <div class="table-section"><div class="table-header"><h3>📋 Dados</h3><span id="tableCount"></span></div><div class="table-wrapper"><table><thead><tr><th onclick="sortTable('date')">Data</th><th onclick="sortTable('person')">Pessoa</th><th onclick="sortTable('team')">Equipe</th><th onclick="sortTable('status')">Status</th></tr></thead><tbody id="tableBody"></tbody></table></div></div>
  </div>
  <div class="footer">Relatório gerado automaticamente • ${now}</div>
  <script>
    const DATA=window.__REPORT_DATA__;let filteredData=[...DATA.rows],sortColumn='date',sortAsc=true,charts={};
    function prettyStatus(s){return s==='VAZIO'?'Sem Info':s}
    function resetFilters(){document.getElementById('filterTeam').value='ALL';document.getElementById('filterPerson').value='ALL';document.getElementById('filterStatus').value='ALL';document.getElementById('filterDateFrom').value='';document.getElementById('filterDateTo').value='';applyFilters()}
    function applyFilters(){const team=document.getElementById('filterTeam').value,person=document.getElementById('filterPerson').value,status=document.getElementById('filterStatus').value,dateFrom=document.getElementById('filterDateFrom').value,dateTo=document.getElementById('filterDateTo').value;filteredData=DATA.rows.filter(r=>{if(team!=='ALL'&&r.team!==team)return false;if(person!=='ALL'&&r.person!==person)return false;if(status!=='ALL'&&r.status!==status)return false;if(dateFrom&&r.date<dateFrom)return false;if(dateTo&&r.date>dateTo)return false;return true});document.getElementById('countDisplay').textContent=filteredData.length;updateKPIs();updateCharts();updateTable()}
    function updateKPIs(){const t=filteredData.length,e=filteredData.filter(r=>r.status==='ENTREGUE').length,f=filteredData.filter(r=>r.status==='FOLGA').length,b=filteredData.filter(r=>r.status==='BANCO DE HORAS').length,v=filteredData.filter(r=>r.status==='VAZIO').length,tx=t?Math.round(e/t*100):0,p=new Set(filteredData.map(r=>r.person)).size;document.getElementById('kpiGrid').innerHTML='<div class="kpi-card"><div class="title">Taxa</div><div class="value">'+tx+'%</div><div class="subtitle">'+e+' de '+t+'</div></div><div class="kpi-card"><div class="title">Entregue</div><div class="value">'+e+'</div><div class="subtitle">ENTREGUE</div></div><div class="kpi-card warning"><div class="title">Pendências</div><div class="value">'+v+'</div><div class="subtitle">Sem info</div></div><div class="kpi-card info"><div class="title">Folgas</div><div class="value">'+f+'</div><div class="subtitle">Descanso</div></div><div class="kpi-card purple"><div class="title">Banco</div><div class="value">'+b+'</div><div class="subtitle">Horas</div></div><div class="kpi-card"><div class="title">Pessoas</div><div class="value">'+p+'</div><div class="subtitle">Únicos</div></div>'}
    function updateCharts(){const byDay={};filteredData.forEach(r=>{if(!byDay[r.date])byDay[r.date]={t:0,e:0};byDay[r.date].t++;if(r.status==='ENTREGUE')byDay[r.date].e++});const days=Object.keys(byDay).sort();charts.line.data.labels=days.map(d=>d.slice(5));charts.line.data.datasets[0].data=days.map(d=>byDay[d].e);charts.line.update();const byStatus={};filteredData.forEach(r=>{const s=prettyStatus(r.status);byStatus[s]=(byStatus[s]||0)+1});charts.pie.data.labels=Object.keys(byStatus);charts.pie.data.datasets[0].data=Object.values(byStatus);charts.pie.update();const byPerson={};filteredData.forEach(r=>{if(!byPerson[r.person])byPerson[r.person]=0;if(r.status==='ENTREGUE')byPerson[r.person]++});const top=Object.entries(byPerson).sort((a,b)=>b[1]-a[1]).slice(0,10);charts.person.data.labels=top.map(p=>p[0].split(' ')[0]);charts.person.data.datasets[0].data=top.map(p=>p[1]);charts.person.update();const byTeam={};filteredData.forEach(r=>{const t=r.team||'GERAL';if(!byTeam[t])byTeam[t]=0;if(r.status==='ENTREGUE')byTeam[t]++});const teams=Object.entries(byTeam).sort((a,b)=>b[1]-a[1]);charts.team.data.labels=teams.map(t=>t[0]);charts.team.data.datasets[0].data=teams.map(t=>t[1]);charts.team.update()}
    function sortTable(col){if(sortColumn===col)sortAsc=!sortAsc;else{sortColumn=col;sortAsc=true}updateTable()}
    function updateTable(){const sorted=[...filteredData].sort((a,b)=>{const v=a[sortColumn]||'',w=b[sortColumn]||'';return sortAsc?v.localeCompare(w):-v.localeCompare(w)});document.getElementById('tableBody').innerHTML=sorted.map(r=>'<tr><td>'+r.date+'</td><td>'+r.person+'</td><td>'+(r.team||'-')+'</td><td><span class="status-badge status-'+(r.status==='BANCO DE HORAS'?'BANCO':r.status)+'">'+prettyStatus(r.status)+'</span></td></tr>').join('');document.getElementById('tableCount').textContent=sorted.length+' registros'}
    window.onload=function(){updateKPIs();const byDay={};filteredData.forEach(r=>{if(!byDay[r.date])byDay[r.date]={t:0,e:0};byDay[r.date].t++;if(r.status==='ENTREGUE')byDay[r.date].e++});const days=Object.keys(byDay).sort();const byStatus={};filteredData.forEach(r=>{const s=prettyStatus(r.status);byStatus[s]=(byStatus[s]||0)+1});const byPerson={};filteredData.forEach(r=>{if(!byPerson[r.person])byPerson[r.person]=0;if(r.status==='ENTREGUE')byPerson[r.person]++});const top=Object.entries(byPerson).sort((a,b)=>b[1]-a[1]).slice(0,10);const byTeam={};filteredData.forEach(r=>{const t=r.team||'GERAL';if(!byTeam[t])byTeam[t]=0;if(r.status==='ENTREGUE')byTeam[t]++});const teams=Object.entries(byTeam).sort((a,b)=>b[1]-a[1]);const colors=['#10b981','#f59e0b','#ef4444','#3b82f6','#8b5cf6','#6b7280','#ec4899'];charts.line=new Chart(document.getElementById('lineChart'),{type:'line',data:{labels:days.map(d=>d.slice(5)),datasets:[{data:days.map(d=>byDay[d].e),borderColor:'#10b981',backgroundColor:'rgba(16,185,129,.1)',fill:true,tension:.4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}}}});charts.pie=new Chart(document.getElementById('pieChart'),{type:'doughnut',data:{labels:Object.keys(byStatus),datasets:[{data:Object.values(byStatus),backgroundColor:colors}]},options:{responsive:true,maintainAspectRatio:false}});charts.person=new Chart(document.getElementById('personChart'),{type:'bar',data:{labels:top.map(p=>p[0].split(' ')[0]),datasets:[{data:top.map(p=>p[1]),backgroundColor:'#10b981'}]},options:{responsive:true,maintainAspectRatio:false,indexAxis:'y',plugins:{legend:{display:false}}}});charts.team=new Chart(document.getElementById('teamChart'),{type:'bar',data:{labels:teams.map(t=>t[0]),datasets:[{data:teams.map(t=>t[1]),backgroundColor:'#3b82f6'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}}}});updateTable()};
  </script>
</body>
</html>`;
}

export function exportInteractiveHTML(dataset: Dataset, filters: ReportFilters): void {
  const filteredRows = filterRows(dataset.rows, filters);
  const html = generateInteractiveHTML(dataset, filteredRows);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "RELATORIO_DASHBOARD.html";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function exportInteractiveZIP(dataset: Dataset, filters: ReportFilters): Promise<void> {
  const filteredRows = filterRows(dataset.rows, filters);
  const html = generateInteractiveHTML(dataset, filteredRows);
  const zip = new JSZip();
  zip.file("RELATORIO_DASHBOARD.html", html);
  const content = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(content);
  const link = document.createElement("a");
  link.href = url;
  link.download = "RELATORIO_DASHBOARD.zip";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
