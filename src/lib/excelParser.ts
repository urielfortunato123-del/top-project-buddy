import * as XLSX from "xlsx";
import type { Dataset, DatasetRow } from "./database";
import { generateId } from "./database";

function toISODate(value: any): string | null {
  if (!value) return null;
  
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  
  if (typeof value === "number") {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + value * 86400000);
    return d.toISOString().slice(0, 10);
  }
  
  const s = String(value).trim();
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function normalizeStatus(s: any): string {
  const v = (s ?? "").toString().trim().toUpperCase();
  if (!v) return "VAZIO";
  if (v.includes("ENTREG")) return "ENTREGUE";
  if (v.includes("FOLGA")) return "FOLGA";
  if (v.includes("BANCO")) return "BANCO DE HORAS";
  if (v.includes("FALTA")) return "FALTA";
  if (v.includes("ATESTADO")) return "ATESTADO";
  if (v.includes("FÉRIAS") || v.includes("FERIAS")) return "FÉRIAS";
  return v;
}

function detectTeamFromHeader(grid: any[][], colIndex: number): string {
  // Look at row 2 (index 1) for team headers like "EQUIPE DE CAMPO"
  const teamRow = grid[1] || [];
  
  // Find the team this column belongs to by looking backwards
  for (let c = colIndex; c >= 0; c--) {
    const cell = String(teamRow[c] || "").trim().toUpperCase();
    if (cell.includes("EQUIPE")) {
      return cell.replace("EQUIPE DE ", "").replace("EQUIPE DO ", "").replace("EQUIPE ", "");
    }
  }
  return "GERAL";
}

export async function parseExcelFile(file: File): Promise<Dataset> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        
        // Find the control sheet
        const sheetName = wb.SheetNames.find(name => 
          name.toUpperCase().includes("CONTROLE")
        ) || wb.SheetNames[0];
        
        const ws = wb.Sheets[sheetName];
        const grid: any[][] = XLSX.utils.sheet_to_json(ws, { 
          header: 1, 
          raw: true, 
          defval: "" 
        }) as any[][];
        
        // Parse structure
        const headerRowIdx = 1; // Row with team headers
        const namesRowIdx = 2;  // Row with person names
        const startDataIdx = 3; // Data starts here
        
        const namesRow = grid[namesRowIdx] || [];
        const people: { col: number; name: string; team: string }[] = [];
        const teamsSet = new Set<string>();
        const statusesSet = new Set<string>();
        
        // Extract people and their teams
        for (let c = 1; c < namesRow.length; c++) {
          const name = String(namesRow[c] ?? "").trim();
          if (name && name.toUpperCase() !== "DATA") {
            const team = detectTeamFromHeader(grid, c);
            people.push({ col: c, name, team });
            teamsSet.add(team);
          }
        }
        
        // Extract data rows
        const rows: DatasetRow[] = [];
        for (let r = startDataIdx; r < grid.length; r++) {
          const row = grid[r] || [];
          const iso = toISODate(row[0]);
          if (!iso) continue;
          
          for (const p of people) {
            const status = normalizeStatus(row[p.col]);
            statusesSet.add(status);
            rows.push({
              date: iso,
              person: p.name,
              status,
              team: p.team,
            });
          }
        }
        
        const dataset: Dataset = {
          id: generateId(),
          name: file.name.replace(/\.[^/.]+$/, ""),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          rawGrid: grid,
          rows,
          teams: Array.from(teamsSet).sort(),
          people: people.map(p => p.name).sort(),
          statuses: Array.from(statusesSet).sort(),
        };
        
        resolve(dataset);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
    reader.readAsArrayBuffer(file);
  });
}
