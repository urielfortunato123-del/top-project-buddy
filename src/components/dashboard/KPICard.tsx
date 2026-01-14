import React from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  variant?: "default" | "success" | "warning" | "danger" | "info" | "purple";
  size?: "sm" | "md" | "lg";
  className?: string;
  onClick?: () => void;
}

const variantStyles = {
  default: {
    border: "border-border",
    gradient: "from-slate-500/10 to-slate-600/5",
    iconBg: "bg-slate-100 dark:bg-slate-800",
    accent: "text-slate-600",
  },
  success: {
    border: "border-l-4 border-l-primary",
    gradient: "from-emerald-500/10 to-emerald-600/5",
    iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
    accent: "text-primary",
  },
  warning: {
    border: "border-l-4 border-l-secondary",
    gradient: "from-amber-500/10 to-amber-600/5",
    iconBg: "bg-amber-100 dark:bg-amber-900/30",
    accent: "text-secondary",
  },
  danger: {
    border: "border-l-4 border-l-destructive",
    gradient: "from-red-500/10 to-red-600/5",
    iconBg: "bg-red-100 dark:bg-red-900/30",
    accent: "text-destructive",
  },
  info: {
    border: "border-l-4 border-l-accent",
    gradient: "from-blue-500/10 to-blue-600/5",
    iconBg: "bg-blue-100 dark:bg-blue-900/30",
    accent: "text-accent",
  },
  purple: {
    border: "border-l-4 border-l-violet-500",
    gradient: "from-violet-500/10 to-violet-600/5",
    iconBg: "bg-violet-100 dark:bg-violet-900/30",
    accent: "text-violet-600",
  },
};

const sizeStyles = {
  sm: {
    card: "p-3",
    title: "text-xs",
    value: "text-2xl",
    subtitle: "text-[10px]",
    icon: "p-1.5",
  },
  md: {
    card: "p-4 md:p-5",
    title: "text-xs md:text-sm",
    value: "text-3xl md:text-4xl",
    subtitle: "text-[10px] md:text-xs",
    icon: "p-2 md:p-3",
  },
  lg: {
    card: "p-5 md:p-6",
    title: "text-sm md:text-base",
    value: "text-4xl md:text-5xl",
    subtitle: "text-xs md:text-sm",
    icon: "p-3 md:p-4",
  },
};

export function KPICard({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendValue,
  variant = "default",
  size = "md",
  className,
  onClick,
}: KPICardProps) {
  const styles = variantStyles[variant];
  const sizes = sizeStyles[size];

  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative bg-card rounded-2xl border overflow-hidden shadow-lg animate-fade-in transition-all duration-300 h-full flex flex-col",
        styles.border,
        onClick && "cursor-pointer hover:shadow-2xl hover:scale-[1.02] hover:-translate-y-1 active:scale-[0.98]",
        sizes.card,
        className
      )}
    >
      {/* Gradient overlay */}
      <div className={cn(
        "absolute inset-0 bg-gradient-to-br opacity-60 group-hover:opacity-100 transition-opacity",
        styles.gradient
      )} />
      
      {/* Content */}
      <div className="relative z-10 flex flex-col h-full min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={cn("font-semibold text-muted-foreground uppercase tracking-wide break-words hyphens-auto", sizes.title)}>
            {title}
          </p>
          {icon && (
            <div className={cn(
              "rounded-xl shrink-0 shadow-sm transition-transform group-hover:scale-110",
              styles.iconBg,
              sizes.icon
            )}>
              {icon}
            </div>
          )}
        </div>
        
        <div className="flex items-end gap-3 mt-2 flex-wrap">
          <p className={cn("font-black text-card-foreground tracking-tight leading-none", sizes.value)}>
            {value}
          </p>
          {trend && trendValue && (
            <div className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold",
              trend === "up" && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
              trend === "down" && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
              trend === "neutral" && "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
            )}>
              <TrendIcon className="w-3 h-3" />
              {trendValue}
            </div>
          )}
        </div>
        
        {subtitle && (
          <p className={cn("text-muted-foreground mt-auto pt-2", sizes.subtitle)} title={subtitle}>
            {subtitle}
          </p>
        )}
      </div>
      
      {/* Hover accent line */}
      <div className={cn(
        "absolute bottom-0 left-0 right-0 h-1 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left",
        variant === "success" && "bg-primary",
        variant === "warning" && "bg-secondary",
        variant === "danger" && "bg-destructive",
        variant === "info" && "bg-accent",
        variant === "purple" && "bg-violet-500",
        variant === "default" && "bg-slate-400"
      )} />
    </div>
  );
}
