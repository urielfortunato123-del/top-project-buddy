import React from "react";
import { cn } from "@/lib/utils";

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  variant?: "default" | "success" | "warning" | "danger" | "info";
  className?: string;
  onClick?: () => void;
}

const variantStyles = {
  default: "border-border",
  success: "border-l-4 border-l-primary",
  warning: "border-l-4 border-l-secondary",
  danger: "border-l-4 border-l-destructive",
  info: "border-l-4 border-l-accent",
};

export function KPICard({
  title,
  value,
  subtitle,
  icon,
  variant = "default",
  className,
  onClick,
}: KPICardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-card rounded-2xl border p-4 shadow-lg animate-fade-in transition-all",
        variantStyles[variant],
        onClick && "cursor-pointer hover:shadow-xl hover:scale-[1.02] hover:border-primary/30 active:scale-[0.98]",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
          <p className="text-3xl font-black text-card-foreground">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-2">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className="p-2 rounded-xl bg-muted/50">{icon}</div>
        )}
      </div>
    </div>
  );
}
