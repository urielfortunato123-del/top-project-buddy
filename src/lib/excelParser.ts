import * as XLSX from "xlsx";
import type { Dataset, GenericRow, ColumnMetadata, ColumnType, DatasetSummary } from "./database";
import { generateId } from "./database";

export type ParsedKind = "table" | "rda_matrix";

export type ParsedResult = {
  kind: ParsedKind;
  sheetName: string;
  rows: Record<string, any>[];
  meta: {
    detected: ParsedKind;
    columns?: string[];
    peopleCount?: number;
    teamsFound?: string[];
    dateRange?: { min?: string; max?: string };
  };
};

/** ===== Helpers básicos ===== */
function upper(v: any) {
  return String(v ?? "").trim().toUpperCase();
}

function isNonEmptyString(v: any) {
  return typeof v === "string" && v.trim().length > 0;
}

function looksLikeName(v: any) {
  if (!isNonEmptyString(v)) return false;
  const t = v.trim();
  if (t.length < 3) return false;
  const u = upper(t);
  if (u.includes("DATA")) return false;
  if (u.includes("EQUIPE")) return false;
  return true;
}

function isDateLike(v: any) {
  if (v instanceof Date) return true;
  if (typeof v === "number") return true;
  if (typeof v === "string") {
    const s = v.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return true;
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s)) return true;
  }
  return false;
}

function normalizeDate(v: any): string | null {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d || !d.y || !d.m || !d.d) return null;
    const dt = new Date(Date.UTC(d.y, d.m - 1, d.d));
    return dt.toISOString().slice(0, 10);
  }
  if (typeof v === "string") {
    const s = v.trim();
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (m) {
      const dd = Number(m[1]);
      const mm = Number(m[2]);
      let yy = Number(m[3]);
      if (m[3].length === 2) yy = Number(`20${m[3]}`);
      const dt = new Date(Date.UTC(yy, mm - 1, dd));
      return dt.toISOString().slice(0, 10);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  }
  return null;
}

function getCell(ws: XLSX.WorkSheet, r: number, c: number) {
  const addr = XLSX.utils.encode_cell({ r, c });
  return ws[addr]?.v;
}

function getRange(ws: XLSX.WorkSheet) {
  const ref = ws["!ref"];
  if (!ref) return null;
  return XLSX.utils.decode_range(ref);
}

/** ===== Detecta se a aba parece RDA em matriz ===== */
export function detectRdaMatrix(ws: XLSX.WorkSheet): boolean {
  const range = getRange(ws);
  if (!range) return false;

  const A2 = getCell(ws, 1, 0);
  const B3 = getCell(ws, 2, 1);
  const A4 = getCell(ws, 3, 0);

  const hasDataLabel = upper(A2).includes("DATA");
  const hasPeopleRow = looksLikeName(B3);
  const hasFirstDate = isDateLike(A4);

  return hasDataLabel && hasPeopleRow && hasFirstDate;
}

/** ===== Parser para RDA matriz: converte para tabela longa ===== */
export function parseRdaMatrix(ws: XLSX.WorkSheet, sheetName: string): ParsedResult {
  const range = getRange(ws);
  if (!range) {
    return { kind: "rda_matrix", sheetName, rows: [], meta: { detected: "rda_matrix" } };
  }

  const rowTeams = 1;
  const rowPeople = 2;
  const startDataRow = 3;
  const dateCol = 0;

  // 1) Lê equipes por coluna (forward-fill)
  const teamByCol = new Map<number, string>();
  let currentTeam = "";
  for (let c = 1; c <= range.e.c; c++) {
    const v = getCell(ws, rowTeams, c);
    const txt = String(v ?? "").trim();
    const up = upper(txt);
    if (txt && up.includes("EQUIPE")) {
      currentTeam = txt;
    }
    teamByCol.set(c, currentTeam);
  }

  const teamsFound = Array.from(new Set([...teamByCol.values()].filter(Boolean)));

  // 2) Lê pessoas por coluna (linha 3)
  const people: { col: number; name: string; team: string }[] = [];
  for (let c = 1; c <= range.e.c; c++) {
    const nameCell = getCell(ws, rowPeople, c);
    if (looksLikeName(nameCell)) {
      people.push({
        col: c,
        name: String(nameCell).trim(),
        team: (teamByCol.get(c) ?? "").trim(),
      });
    }
  }

  // 3) Varre linhas de datas e coleta status
  const out: Record<string, any>[] = [];
  let minDate: string | undefined;
  let maxDate: string | undefined;

  for (let r = startDataRow; r <= range.e.r; r++) {
    const rawDate = getCell(ws, r, dateCol);
    const date = normalizeDate(rawDate);
    if (!date) continue;

    if (!minDate || date < minDate) minDate = date;
    if (!maxDate || date > maxDate) maxDate = date;

    for (const p of people) {
      const status = getCell(ws, r, p.col);
      if (status === undefined || status === null || String(status).trim() === "") continue;

      out.push({
        data: date,
        equipe: p.team || null,
        pessoa: p.name,
        status: String(status).trim(),
        origem_aba: sheetName,
      });
    }
  }

  return {
    kind: "rda_matrix",
    sheetName,
    rows: out,
    meta: {
      detected: "rda_matrix",
      peopleCount: people.length,
      teamsFound,
      dateRange: { min: minDate, max: maxDate },
    },
  };
}

/** ===== Parser para tabela normal ===== */
export function parseTable(ws: XLSX.WorkSheet, sheetName: string): ParsedResult {
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null }) as Record<string, any>[];
  const columns = rows.length > 0 ? Array.from(new Set(Object.keys(rows[0] ?? {}))) : [];

  return {
    kind: "table",
    sheetName,
    rows,
    meta: { detected: "table", columns },
  };
}

/** ===== Parser geral do workbook ===== */
export function parseWorkbook(
  arrayBuffer: ArrayBuffer,
  opts?: { preferredSheetName?: string }
): ParsedResult {
  const wb = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
  const sheetNames = wb.SheetNames;

  if (!sheetNames.length) {
    return { kind: "table", sheetName: "(none)", rows: [], meta: { detected: "table" } };
  }

  const chosen =
    opts?.preferredSheetName && sheetNames.includes(opts.preferredSheetName)
      ? opts.preferredSheetName
      : sheetNames[0];

  const ws = wb.Sheets[chosen];
  if (!ws) {
    return { kind: "table", sheetName: chosen, rows: [], meta: { detected: "table" } };
  }

  if (detectRdaMatrix(ws)) {
    return parseRdaMatrix(ws, chosen);
  }

  return parseTable(ws, chosen);
}

// ===== Conversão de ParsedResult para Dataset (para compatibilidade) =====

function detectColumnType(values: any[]): ColumnType {
  const nonEmpty = values.filter(v => v != null && String(v).trim() !== "");
  if (nonEmpty.length === 0) return "text";

  const dateCount = nonEmpty.filter(v => isDateLike(v) || (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v))).length;
  if (dateCount / nonEmpty.length > 0.7) return "date";

  const numCount = nonEmpty.filter(v => typeof v === "number" || !isNaN(parseFloat(String(v).replace(",", ".")))).length;
  if (numCount / nonEmpty.length > 0.7) return "number";

  const uniqueValues = new Set(nonEmpty.map(v => String(v).trim().toUpperCase()));
  if (uniqueValues.size <= Math.min(50, nonEmpty.length * 0.3)) return "category";

  if (uniqueValues.size === nonEmpty.length && nonEmpty.length > 5) return "id";

  return "text";
}

function toNumber(value: any): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return parseFloat(value.replace(",", ".")) || 0;
  return 0;
}

function convertParsedResultToDataset(parsed: ParsedResult, fileName: string): Dataset {
  const rows = parsed.rows;

  if (rows.length === 0) {
    return {
      id: generateId(),
      name: fileName.replace(/\.[^/.]+$/, ""),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      rawGrid: [],
      columns: [],
      rows: [],
      detectedCategoryColumns: [],
      detectedNumericColumns: [],
      detectedTextColumns: [],
      totalRows: 0,
      summary: { totalRecords: 0, categoryCounts: {}, numericStats: {} },
    };
  }

  // Extrai nomes de colunas do primeiro registro
  const columnNames = Object.keys(rows[0]).filter(k => k !== "_rowIndex");

  // Cria metadados das colunas
  const columns: ColumnMetadata[] = columnNames.map((name, index) => {
    const colValues = rows.map(r => r[name]);
    const type = detectColumnType(colValues);
    const uniqueSet = new Set<string>();

    for (const v of colValues) {
      if (v != null && String(v).trim() !== "") {
        uniqueSet.add(String(v).trim());
      }
    }

    return {
      name,
      originalIndex: index,
      type,
      uniqueValues: Array.from(uniqueSet).slice(0, 100),
      sampleValues: colValues.slice(0, 10),
      isNumeric: type === "number",
      isDate: type === "date",
      isEmpty: colValues.every(v => v == null || String(v).trim() === ""),
    };
  });

  // Converte para GenericRow (adiciona _rowIndex)
  const genericRows: GenericRow[] = rows.map((row, idx) => ({
    ...row,
    _rowIndex: idx,
  }));

  // Detecta colunas por tipo
  const dateColumn = columns.find(c => c.type === "date");
  const categoryColumns = columns.filter(c => c.type === "category");
  const numericColumns = columns.filter(c => c.type === "number");
  const textColumns = columns.filter(c => c.type === "text" || c.type === "id");

  // Calcula summary
  const summary: DatasetSummary = {
    totalRecords: genericRows.length,
    categoryCounts: {},
    numericStats: {},
  };

  if (parsed.meta.dateRange?.min && parsed.meta.dateRange?.max) {
    summary.dateRange = { from: parsed.meta.dateRange.min, to: parsed.meta.dateRange.max };
  } else if (dateColumn) {
    const dates = genericRows
      .map(r => r[dateColumn.name])
      .filter(d => d && typeof d === "string")
      .sort();
    if (dates.length > 0) {
      summary.dateRange = { from: dates[0], to: dates[dates.length - 1] };
    }
  }

  for (const col of categoryColumns) {
    const counts: { [value: string]: number } = {};
    for (const row of genericRows) {
      const v = String(row[col.name] || "").trim() || "(vazio)";
      counts[v] = (counts[v] || 0) + 1;
    }
    summary.categoryCounts[col.name] = counts;
  }

  for (const col of numericColumns) {
    const values = genericRows.map(r => toNumber(r[col.name])).filter(n => !isNaN(n));
    if (values.length > 0) {
      summary.numericStats[col.name] = {
        min: Math.min(...values),
        max: Math.max(...values),
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        sum: values.reduce((a, b) => a + b, 0),
      };
    }
  }

  return {
    id: generateId(),
    name: fileName.replace(/\.[^/.]+$/, ""),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    rawGrid: [],
    columns,
    rows: genericRows,
    detectedDateColumn: dateColumn?.name,
    detectedCategoryColumns: categoryColumns.map(c => c.name),
    detectedNumericColumns: numericColumns.map(c => c.name),
    detectedTextColumns: textColumns.map(c => c.name),
    totalRows: genericRows.length,
    summary,
  };
}

// ===== Export type for backwards compatibility =====
export type ImportFormat = "auto" | "long" | "matrix";

/** ===== Função principal de parsing ===== */
export async function parseExcelFile(
  file: File,
  _format: ImportFormat = "auto"
): Promise<Dataset> {
  const buf = await file.arrayBuffer();
  const parsed = parseWorkbook(buf);

  console.log("📊 Tipo detectado:", parsed.kind);
  console.log("📋 Meta:", parsed.meta);
  console.log("📝 Primeiras linhas:", parsed.rows.slice(0, 5));

  return convertParsedResultToDataset(parsed, file.name);
}
