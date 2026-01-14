import * as React from "react";
import type { Dataset } from "@/lib/database";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DatasetSelectProps {
  datasets: Dataset[];
  valueId: string | undefined;
  onChange: (id: string) => void;
}

export function DatasetSelect({ datasets, valueId, onChange }: DatasetSelectProps) {
  const value = valueId && datasets.some((d) => d.id === valueId) ? valueId : undefined;

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-[280px] max-w-[50vw]">
        <SelectValue placeholder="Selecionar arquivo" />
      </SelectTrigger>
      <SelectContent>
        {datasets.map((ds) => (
          <SelectItem key={ds.id} value={ds.id}>
            {ds.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
