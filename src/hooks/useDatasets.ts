import { useState, useEffect, useCallback } from "react";
import type { Dataset } from "@/lib/database";
import {
  getAllDatasets,
  getDataset,
  saveDataset,
  deleteDataset,
  getCurrentDatasetId,
  setCurrentDatasetId,
} from "@/lib/database";
import { parseExcelFile, type ImportFormat } from "@/lib/excelParser";

export function useDatasets() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [currentDataset, setCurrentDataset] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDatasets = useCallback(async () => {
    try {
      setLoading(true);
      const all = await getAllDatasets();
      setDatasets(all);

      const currentId = await getCurrentDatasetId();
      if (currentId) {
        const current = await getDataset(currentId);
        if (current) {
          setCurrentDataset(current);
        } else if (all.length > 0) {
          setCurrentDataset(all[0]);
          await setCurrentDatasetId(all[0].id);
        }
      } else if (all.length > 0) {
        setCurrentDataset(all[0]);
        await setCurrentDatasetId(all[0].id);
      }
    } catch (err) {
      setError("Erro ao carregar dados");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDatasets();
  }, [loadDatasets]);

  const importFile = useCallback(async (file: File, format: ImportFormat = "auto") => {
    try {
      setLoading(true);
      setError(null);
      const dataset = await parseExcelFile(file, format);
      await saveDataset(dataset);
      await setCurrentDatasetId(dataset.id);
      setCurrentDataset(dataset);
      setDatasets((prev) => [dataset, ...prev]);
      return dataset;
    } catch (err) {
      setError("Erro ao importar arquivo");
      console.error(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const selectDataset = useCallback(async (id: string) => {
    const dataset = await getDataset(id);
    if (dataset) {
      setCurrentDataset(dataset);
      await setCurrentDatasetId(id);
    }
  }, []);

  const removeDataset = useCallback(async (id: string) => {
    await deleteDataset(id);
    setDatasets((prev) => prev.filter((d) => d.id !== id));
    if (currentDataset?.id === id) {
      const remaining = datasets.filter((d) => d.id !== id);
      if (remaining.length > 0) {
        setCurrentDataset(remaining[0]);
        await setCurrentDatasetId(remaining[0].id);
      } else {
        setCurrentDataset(null);
      }
    }
  }, [currentDataset, datasets]);

  const updateDataset = useCallback((updatedDataset: Dataset) => {
    setCurrentDataset(updatedDataset);
    setDatasets((prev) => 
      prev.map((d) => (d.id === updatedDataset.id ? updatedDataset : d))
    );
  }, []);

  return {
    datasets,
    currentDataset,
    loading,
    error,
    importFile,
    selectDataset,
    removeDataset,
    updateDataset,
    refresh: loadDatasets,
  };
}
