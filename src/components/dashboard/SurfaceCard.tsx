import React from "react";
import { cn } from "@/lib/utils";

interface SurfaceCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export function SurfaceCard({ children, className, hover = false, onClick }: SurfaceCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-card border rounded-2xl shadow-[var(--shadow-card)] overflow-hidden transition-all duration-300",
        hover && "hover:shadow-lg hover:-translate-y-0.5 cursor-pointer",
        onClick && "cursor-pointer",
        className
      )}
      style={{ borderRadius: "var(--radius-card)" }}
    >
      {children}
    </div>
  );
}
