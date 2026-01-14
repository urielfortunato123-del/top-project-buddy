import { get, set, del, keys, clear } from "idb-keyval";

// Tipos de dados detectados automaticamente
export type ColumnType = "date" | "number" | "category" | "text" | "id";

export interface ColumnMetadata {
  name: string;
  originalIndex: number;
  type: ColumnType;
  uniqueValues: string[];
  sampleValues: any[];
  isNumeric: boolean;
  isDate: boolean;
  isEmpty: boolean;
}

export interface GenericRow {
  [key: string]: any;
  _rowIndex: number;
}

export interface MatrixConfig {
  rowColumn: string;
  colColumn: string;
  valueColumn: string;
}

export interface Dataset {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  rawGrid: any[][];
  
  // Estrutura genérica
  columns: ColumnMetadata[];
  rows: GenericRow[];
  
  // Campos detectados automaticamente (podem não existir)
  detectedDateColumn?: string;
  detectedCategoryColumns: string[];
  detectedNumericColumns: string[];
  detectedTextColumns: string[];
  
  // Estatísticas gerais
  totalRows: number;
  summary: DatasetSummary;
  
  // Configuração persistida da matriz
  matrixConfig?: MatrixConfig;
}

export interface DatasetSummary {
  totalRecords: number;
  dateRange?: { from: string; to: string };
  categoryCounts: { [column: string]: { [value: string]: number } };
  numericStats: { [column: string]: { min: number; max: number; avg: number; sum: number } };
}

const DATASETS_PREFIX = "dataset_";
const CURRENT_DATASET_KEY = "current_dataset_id";

export async function saveDataset(dataset: Dataset): Promise<void> {
  await set(`${DATASETS_PREFIX}${dataset.id}`, dataset);
}

export async function getDataset(id: string): Promise<Dataset | undefined> {
  return await get(`${DATASETS_PREFIX}${id}`);
}

export async function deleteDataset(id: string): Promise<void> {
  await del(`${DATASETS_PREFIX}${id}`);
}

export async function getAllDatasets(): Promise<Dataset[]> {
  const allKeys = await keys();
  const datasetKeys = allKeys.filter(
    (key) => typeof key === "string" && key.startsWith(DATASETS_PREFIX)
  );
  
  const datasets: Dataset[] = [];
  for (const key of datasetKeys) {
    const dataset = await get(key as string);
    if (dataset) datasets.push(dataset as Dataset);
  }
  
  return datasets.sort((a, b) => 
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export async function setCurrentDatasetId(id: string): Promise<void> {
  await set(CURRENT_DATASET_KEY, id);
}

export async function getCurrentDatasetId(): Promise<string | undefined> {
  return await get(CURRENT_DATASET_KEY);
}

export async function clearAllData(): Promise<void> {
  await clear();
}

export function generateId(): string {
  return `ds_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
