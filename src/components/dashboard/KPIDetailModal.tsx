import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Hash, Tag, Calendar, Database, TrendingUp, BarChart3, User } from "lucide-react";

interface KPIDetail {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  variant: "default" | "success" | "warning" | "danger" | "info" | "purple";
  // Extended details
  type?: "count" | "numeric" | "category" | "date";
  columnName?: string;
  stats?: {
    min?: number;
    max?: number;
    avg?: number;
    sum?: number;
  };
  distribution?: Array<{ name: string; value: number }>;
  total?: number;
  percentage?: number;
  // Lista de itens detalhados
  detailList?: Array<{ name: string; detail?: string }>;
}

interface KPIDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kpi: KPIDetail | null;
}

const variantColors = {
  default: "bg-slate-500",
  success: "bg-primary",
  warning: "bg-secondary",
  danger: "bg-destructive",
  info: "bg-accent",
  purple: "bg-violet-500",
};

export function KPIDetailModal({ open, onOpenChange, kpi }: KPIDetailModalProps) {
  if (!kpi) return null;

  const bgColor = variantColors[kpi.variant];
  const hasDetails = (kpi.detailList && kpi.detailList.length > 0) || 
                     (kpi.distribution && kpi.distribution.length > 0) ||
                     kpi.stats;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className={`p-3 rounded-xl ${bgColor} text-white`}>
              {kpi.icon}
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">{kpi.title}</DialogTitle>
              <DialogDescription>{kpi.subtitle}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col space-y-4">
          {/* Main Value */}
          <div className="text-center py-4 bg-muted/50 rounded-xl shrink-0">
            <p className="text-4xl font-black text-foreground">{kpi.value}</p>
            <p className="text-sm text-muted-foreground mt-1">{kpi.subtitle}</p>
          </div>

          {/* Stats Section for Numeric KPIs */}
          {kpi.stats && (
            <div className="space-y-2 shrink-0">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Hash className="w-4 h-4" />
                Estatísticas
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {kpi.stats.min !== undefined && (
                  <div className="p-2 bg-muted/30 rounded-lg">
                    <p className="text-xs text-muted-foreground">Mínimo</p>
                    <p className="text-sm font-bold">{kpi.stats.min.toLocaleString("pt-BR")}</p>
                  </div>
                )}
                {kpi.stats.max !== undefined && (
                  <div className="p-2 bg-muted/30 rounded-lg">
                    <p className="text-xs text-muted-foreground">Máximo</p>
                    <p className="text-sm font-bold">{kpi.stats.max.toLocaleString("pt-BR")}</p>
                  </div>
                )}
                {kpi.stats.avg !== undefined && (
                  <div className="p-2 bg-muted/30 rounded-lg">
                    <p className="text-xs text-muted-foreground">Média</p>
                    <p className="text-sm font-bold">{kpi.stats.avg.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</p>
                  </div>
                )}
                {kpi.stats.sum !== undefined && (
                  <div className="p-2 bg-muted/30 rounded-lg">
                    <p className="text-xs text-muted-foreground">Soma</p>
                    <p className="text-sm font-bold">{kpi.stats.sum.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Lista de Detalhes (nomes, pessoas, etc) */}
          {kpi.detailList && kpi.detailList.length > 0 && (
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2 mb-2 shrink-0">
                <User className="w-4 h-4" />
                Lista Detalhada ({kpi.detailList.length})
              </h4>
              <ScrollArea className="flex-1 pr-2">
                <div className="space-y-1">
                  {kpi.detailList.map((item, idx) => (
                    <div 
                      key={idx} 
                      className="flex items-center justify-between p-2 bg-muted/20 rounded-lg hover:bg-muted/40 transition-colors"
                    >
                      <span className="text-sm font-medium truncate max-w-[250px]">
                        {item.name || "(vazio)"}
                      </span>
                      {item.detail && (
                        <span className="text-xs text-muted-foreground ml-2">
                          {item.detail}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Distribution Section for Category KPIs */}
          {kpi.distribution && kpi.distribution.length > 0 && !kpi.detailList?.length && (
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2 mb-2 shrink-0">
                <BarChart3 className="w-4 h-4" />
                Distribuição ({kpi.distribution.length})
              </h4>
              <ScrollArea className="flex-1 pr-2">
                <div className="space-y-2">
                  {kpi.distribution.map((item, idx) => {
                    const total = kpi.distribution!.reduce((acc, i) => acc + i.value, 0);
                    const percentage = total > 0 ? (item.value / total) * 100 : 0;
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium truncate max-w-[200px]">{item.name || "(vazio)"}</span>
                          <span className="text-muted-foreground">
                            {item.value} ({percentage.toFixed(1)}%)
                          </span>
                        </div>
                        <Progress value={percentage} className="h-2" />
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Mensagem quando não há detalhes */}
          {!hasDetails && (
            <div className="flex-1 flex items-center justify-center text-center py-8">
              <p className="text-muted-foreground text-sm">
                Clique nos filtros para ver detalhes específicos
              </p>
            </div>
          )}

          {/* Percentage indicator */}
          {kpi.percentage !== undefined && (
            <div className="space-y-2 shrink-0">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Do total</span>
                <span className="font-bold">{kpi.percentage.toFixed(1)}%</span>
              </div>
              <Progress value={kpi.percentage} className="h-3" />
            </div>
          )}

          {/* Column info */}
          {kpi.columnName && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2 border-t shrink-0">
              <Tag className="w-4 h-4" />
              <span>Coluna: <strong className="text-foreground">{kpi.columnName}</strong></span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}