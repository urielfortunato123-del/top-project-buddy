import * as XLSX from "xlsx";
import type { Dataset, GenericRow, ColumnMetadata, ColumnType, DatasetSummary } from "./database";
import { generateId } from "./database";

// Detecta se um valor é uma data válida
function isDateValue(value: any): boolean {
  if (!value) return false;
  
  // Se for um Date object
  if (value instanceof Date && !isNaN(value.getTime())) return true;
  
  // Se for um número Excel (serial date)
  if (typeof value === "number" && value > 25000 && value < 60000) return true;
  
  // Se for uma string que parece data
  if (typeof value === "string") {
    const s = value.trim();
    // Formatos comuns: YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY
    if (/^\d{4}-\d{2}-\d{2}/.test(s) || /^\d{2}\/\d{2}\/\d{4}/.test(s)) {
      const d = new Date(s);
      return !isNaN(d.getTime());
    }
  }
  
  return false;
}

function toISODate(value: any): string | null {
  if (!value) return null;
  
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  
  if (typeof value === "number") {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + value * 86400000);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  
  const s = String(value).trim();
  // Try different date formats
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  
  // Try DD/MM/YYYY format
  const parts = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (parts) {
    const [, day, month, year] = parts;
    const d2 = new Date(`${year}-${month}-${day}`);
    if (!isNaN(d2.getTime())) return d2.toISOString().slice(0, 10);
  }
  
  return null;
}

function isNumericValue(value: any): boolean {
  if (typeof value === "number") return true;
  if (typeof value === "string") {
    const n = parseFloat(value.replace(",", "."));
    return !isNaN(n);
  }
  return false;
}

function toNumber(value: any): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return parseFloat(value.replace(",", ".")) || 0;
  return 0;
}

function detectColumnType(values: any[]): ColumnType {
  const nonEmpty = values.filter(v => v != null && String(v).trim() !== "");
  if (nonEmpty.length === 0) return "text";
  
  // Verifica se são datas
  const dateCount = nonEmpty.filter(isDateValue).length;
  if (dateCount / nonEmpty.length > 0.7) return "date";
  
  // Verifica se são números
  const numCount = nonEmpty.filter(isNumericValue).length;
  if (numCount / nonEmpty.length > 0.7) return "number";
  
  // Se tem poucos valores únicos, é categoria
  const uniqueValues = new Set(nonEmpty.map(v => String(v).trim().toUpperCase()));
  if (uniqueValues.size <= Math.min(50, nonEmpty.length * 0.3)) return "category";
  
  // Se parece ID (números sequenciais ou códigos únicos)
  if (uniqueValues.size === nonEmpty.length && nonEmpty.length > 5) return "id";
  
  return "text";
}

function findHeaderRow(grid: any[][]): number {
  // Procura a primeira linha que parece ser um cabeçalho
  for (let i = 0; i < Math.min(10, grid.length); i++) {
    const row = grid[i] || [];
    const nonEmptyCells = row.filter(cell => cell != null && String(cell).trim() !== "");
    
    // Se tem pelo menos 2 células não vazias e parecem ser texto (não números)
    if (nonEmptyCells.length >= 2) {
      const textCells = nonEmptyCells.filter(cell => {
        const s = String(cell).trim();
        return isNaN(parseFloat(s)) && !isDateValue(cell);
      });
      
      // Se a maioria são texto, provavelmente é o cabeçalho
      if (textCells.length / nonEmptyCells.length > 0.5) {
        return i;
      }
    }
  }
  return 0;
}

function normalizeColumnName(name: any, index: number): string {
  const s = String(name ?? "").trim();
  if (!s || s.toUpperCase() === "NULL" || s.toUpperCase() === "UNDEFINED") {
    return `Coluna_${index + 1}`;
  }
  // Limpa caracteres especiais e normaliza
  return s.replace(/[\r\n]+/g, " ").trim();
}

function parseCSV(text: string): any[][] {
  const lines = text.split(/\r?\n/).filter(Boolean);
  // Detecta separador (vírgula ou ponto-e-vírgula)
  const firstLine = lines[0] || "";
  const separator = firstLine.includes(";") ? ";" : ",";
  return lines.map(l => l.split(separator).map(x => x.trim()));
}

function parseGridToDataset(grid: any[][], fileName: string): Dataset {
  // Encontra a linha de cabeçalho
  const headerRowIdx = findHeaderRow(grid);
  const headerRow = grid[headerRowIdx] || [];
  
  // Encontra colunas válidas (com cabeçalho)
  const columns: ColumnMetadata[] = [];
  
  for (let c = 0; c < headerRow.length; c++) {
    const name = normalizeColumnName(headerRow[c], c);
    
    // Coleta valores desta coluna
    const colValues: any[] = [];
    for (let r = headerRowIdx + 1; r < grid.length; r++) {
      const row = grid[r] || [];
      if (row.some(cell => cell != null && String(cell).trim() !== "")) {
        colValues.push(row[c]);
      }
    }
    
    const type = detectColumnType(colValues);
    const uniqueSet = new Set<string>();
    
    for (const v of colValues) {
      if (v != null && String(v).trim() !== "") {
        uniqueSet.add(String(v).trim());
      }
    }
    
    columns.push({
      name,
      originalIndex: c,
      type,
      uniqueValues: Array.from(uniqueSet).slice(0, 100), // Limita para performance
      sampleValues: colValues.slice(0, 10),
      isNumeric: type === "number",
      isDate: type === "date",
      isEmpty: colValues.length === 0 || colValues.every(v => v == null || String(v).trim() === ""),
    });
  }
  
  // Filtra colunas vazias
  const validColumns = columns.filter(c => !c.isEmpty);
  
  // Extrai dados como objetos genéricos
  const rows: GenericRow[] = [];
  for (let r = headerRowIdx + 1; r < grid.length; r++) {
    const gridRow = grid[r] || [];
    
    // Pula linhas completamente vazias
    if (gridRow.every(cell => cell == null || String(cell).trim() === "")) continue;
    
    const row: GenericRow = { _rowIndex: r };
    
    for (const col of validColumns) {
      let value = gridRow[col.originalIndex];
      
      // Converte para o tipo apropriado
      if (col.type === "date" && value != null) {
        const iso = toISODate(value);
        value = iso || String(value).trim();
      } else if (col.type === "number" && value != null) {
        value = toNumber(value);
      } else if (value != null) {
        value = String(value).trim();
      } else {
        value = "";
      }
      
      row[col.name] = value;
    }
    
    rows.push(row);
  }
  
  // Detecta colunas principais
  const dateColumn = validColumns.find(c => c.type === "date");
  const categoryColumns = validColumns.filter(c => c.type === "category");
  const numericColumns = validColumns.filter(c => c.type === "number");
  const textColumns = validColumns.filter(c => c.type === "text" || c.type === "id");
  
  // Calcula estatísticas
  const summary = calculateSummary(rows, validColumns, dateColumn?.name);
  
  return {
    id: generateId(),
    name: fileName.replace(/\.[^/.]+$/, ""),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    rawGrid: grid,
    columns: validColumns,
    rows,
    detectedDateColumn: dateColumn?.name,
    detectedCategoryColumns: categoryColumns.map(c => c.name),
    detectedNumericColumns: numericColumns.map(c => c.name),
    detectedTextColumns: textColumns.map(c => c.name),
    totalRows: rows.length,
    summary,
  };
}

function calculateSummary(rows: GenericRow[], columns: ColumnMetadata[], dateColumn?: string): DatasetSummary {
  const summary: DatasetSummary = {
    totalRecords: rows.length,
    categoryCounts: {},
    numericStats: {},
  };
  
  // Date range
  if (dateColumn) {
    const dates = rows.map(r => r[dateColumn]).filter(d => d && typeof d === "string").sort();
    if (dates.length > 0) {
      summary.dateRange = { from: dates[0], to: dates[dates.length - 1] };
    }
  }
  
  // Category counts
  for (const col of columns.filter(c => c.type === "category")) {
    const counts: { [value: string]: number } = {};
    for (const row of rows) {
      const v = String(row[col.name] || "").trim() || "(vazio)";
      counts[v] = (counts[v] || 0) + 1;
    }
    summary.categoryCounts[col.name] = counts;
  }
  
  // Numeric stats
  for (const col of columns.filter(c => c.type === "number")) {
    const values = rows.map(r => toNumber(r[col.name])).filter(n => !isNaN(n));
    if (values.length > 0) {
      summary.numericStats[col.name] = {
        min: Math.min(...values),
        max: Math.max(...values),
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        sum: values.reduce((a, b) => a + b, 0),
      };
    }
  }
  
  return summary;
}

export async function parseExcelFile(file: File): Promise<Dataset> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const isCSV = file.name.toLowerCase().endsWith(".csv");
    
    reader.onload = (e) => {
      try {
        let grid: any[][];
        
        if (isCSV) {
          const text = e.target?.result as string;
          grid = parseCSV(text);
        } else {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: "array", cellDates: true });
          
          // Usa a primeira aba ou uma que tenha mais dados
          let bestSheet = wb.SheetNames[0];
          let bestRowCount = 0;
          
          for (const name of wb.SheetNames) {
            const ws = wb.Sheets[name];
            const tempGrid = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" }) as any[][];
            if (tempGrid.length > bestRowCount) {
              bestRowCount = tempGrid.length;
              bestSheet = name;
            }
          }
          
          const ws = wb.Sheets[bestSheet];
          grid = XLSX.utils.sheet_to_json(ws, { 
            header: 1, 
            raw: true, 
            defval: "" 
          }) as any[][];
        }
        
        const dataset = parseGridToDataset(grid, file.name);
        resolve(dataset);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
    
    if (isCSV) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  });
}
