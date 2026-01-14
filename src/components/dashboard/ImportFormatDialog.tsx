import React, { useState } from "react";
import { FileSpreadsheet, TableProperties, ArrowRightLeft, Sparkles, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ImportFormat = "auto" | "long" | "matrix";

interface ImportFormatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  onConfirm: (format: ImportFormat) => void;
  onCancel: () => void;
}

const formats: Array<{
  value: ImportFormat;
  label: string;
  description: string;
  icon: React.ReactNode;
  example: string;
}> = [
  {
    value: "auto",
    label: "Automático",
    description: "Detecta automaticamente o formato da planilha",
    icon: <Sparkles className="w-5 h-5" />,
    example: "Recomendado na maioria dos casos",
  },
  {
    value: "long",
    label: "Formato Longo",
    description: "Cada linha é um registro único",
    icon: <FileSpreadsheet className="w-5 h-5" />,
    example: "DATA | FUNCIONÁRIO | STATUS",
  },
  {
    value: "matrix",
    label: "Formato Matriz",
    description: "Entidades nas colunas, datas nas linhas",
    icon: <TableProperties className="w-5 h-5" />,
    example: "DATA | João | Maria | Pedro",
  },
];

export function ImportFormatDialog({
  open,
  onOpenChange,
  fileName,
  onConfirm,
  onCancel,
}: ImportFormatDialogProps) {
  const [selected, setSelected] = useState<ImportFormat>("auto");

  const handleConfirm = () => {
    onConfirm(selected);
    setSelected("auto");
  };

  const handleCancel = () => {
    onCancel();
    setSelected("auto");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-primary" />
            Formato de Importação
          </DialogTitle>
          <DialogDescription>
            Escolha como interpretar o arquivo <strong className="text-foreground">{fileName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {formats.map((format) => (
            <button
              key={format.value}
              onClick={() => setSelected(format.value)}
              className={cn(
                "w-full flex items-start gap-4 p-4 rounded-xl border-2 transition-all text-left",
                selected === format.value
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border hover:border-primary/50 hover:bg-muted/50"
              )}
            >
              <div
                className={cn(
                  "p-2 rounded-lg shrink-0",
                  selected === format.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {format.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">{format.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {format.description}
                </div>
                <div className="mt-2 px-2 py-1 bg-muted rounded text-xs font-mono text-muted-foreground truncate">
                  {format.example}
                </div>
              </div>
              <div
                className={cn(
                  "w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center",
                  selected === format.value
                    ? "border-primary bg-primary"
                    : "border-muted-foreground/30"
                )}
              >
                {selected === format.value && (
                  <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                )}
              </div>
            </button>
          ))}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleCancel}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} className="gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            Importar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
