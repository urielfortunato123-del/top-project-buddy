import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface ViewTabsProps {
  value: "dashboard" | "planilha";
  onChange: (v: "dashboard" | "planilha") => void;
}

export const ViewTabs = forwardRef<HTMLDivElement, ViewTabsProps>(
  function ViewTabs({ value, onChange }, ref) {
    return (
      <div ref={ref} className="bg-card border shadow-sm rounded-2xl p-1 flex items-center gap-1">
        <button
          onClick={() => onChange("dashboard")}
          className={cn(
            "px-3 py-2 rounded-xl text-sm font-semibold transition-all",
            value === "dashboard"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          Dashboard
        </button>
        <button
          onClick={() => onChange("planilha")}
          className={cn(
            "px-3 py-2 rounded-xl text-sm font-semibold transition-all",
            value === "planilha"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          Planilha
        </button>
      </div>
    );
  }
);
