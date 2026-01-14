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
        "bg-card rounded-2xl border p-3 md:p-4 shadow-lg animate-fade-in transition-all h-full flex flex-col",
        variantStyles[variant],
        onClick && "cursor-pointer hover:shadow-xl hover:scale-[1.02] hover:border-primary/30 active:scale-[0.98]",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs md:text-sm font-medium text-muted-foreground truncate">{title}</p>
        {icon && (
          <div className="p-1.5 md:p-2 rounded-lg md:rounded-xl bg-muted/50 shrink-0">{icon}</div>
        )}
      </div>
      <p className="text-2xl md:text-3xl font-black text-card-foreground mt-1">{value}</p>
      {subtitle && (
        <p className="text-[10px] md:text-xs text-muted-foreground mt-auto pt-1 line-clamp-2">{subtitle}</p>
      )}
    </div>
  );
}
