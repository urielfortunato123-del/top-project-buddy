import { get, set, del, keys, clear } from "idb-keyval";

export interface DatasetRow {
  date: string;
  person: string;
  status: string;
  team?: string;
}

export interface Dataset {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  rawGrid: any[][];
  rows: DatasetRow[];
  teams: string[];
  people: string[];
  statuses: string[];
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
