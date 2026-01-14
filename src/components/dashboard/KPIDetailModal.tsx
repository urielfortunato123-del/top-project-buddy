import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Hash, Tag, Calendar, Database, TrendingUp, BarChart3 } from "lucide-react";

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
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

        <div className="space-y-6 pt-4">
          {/* Main Value */}
          <div className="text-center py-6 bg-muted/50 rounded-xl">
            <p className="text-5xl font-black text-foreground">{kpi.value}</p>
            <p className="text-sm text-muted-foreground mt-2">{kpi.subtitle}</p>
          </div>

          {/* Stats Section for Numeric KPIs */}
          {kpi.stats && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Hash className="w-4 h-4" />
                Estatísticas
              </h4>
              <div className="grid grid-cols-2 gap-3">
                {kpi.stats.min !== undefined && (
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <p className="text-xs text-muted-foreground">Mínimo</p>
                    <p className="text-lg font-bold">{kpi.stats.min.toLocaleString("pt-BR")}</p>
                  </div>
                )}
                {kpi.stats.max !== undefined && (
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <p className="text-xs text-muted-foreground">Máximo</p>
                    <p className="text-lg font-bold">{kpi.stats.max.toLocaleString("pt-BR")}</p>
                  </div>
                )}
                {kpi.stats.avg !== undefined && (
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <p className="text-xs text-muted-foreground">Média</p>
                    <p className="text-lg font-bold">{kpi.stats.avg.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</p>
                  </div>
                )}
                {kpi.stats.sum !== undefined && (
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <p className="text-xs text-muted-foreground">Soma</p>
                    <p className="text-lg font-bold">{kpi.stats.sum.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Distribution Section for Category KPIs */}
          {kpi.distribution && kpi.distribution.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Top Valores
              </h4>
              <div className="space-y-2">
                {kpi.distribution.slice(0, 5).map((item, idx) => {
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
            </div>
          )}

          {/* Percentage indicator */}
          {kpi.percentage !== undefined && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Do total</span>
                <span className="font-bold">{kpi.percentage.toFixed(1)}%</span>
              </div>
              <Progress value={kpi.percentage} className="h-3" />
            </div>
          )}

          {/* Column info */}
          {kpi.columnName && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2 border-t">
              <Tag className="w-4 h-4" />
              <span>Coluna: <strong className="text-foreground">{kpi.columnName}</strong></span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
