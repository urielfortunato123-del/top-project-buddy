import { useThemePreset } from "@/contexts/ThemePresetContext";
import { cn } from "@/lib/utils";
import { Palette } from "lucide-react";

export function ThemePresetToggle({ className }: { className?: string }) {
  const { preset, setPreset } = useThemePreset();

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Palette className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <div className="flex rounded-full bg-muted p-0.5 text-[10px] font-semibold">
        <button
          onClick={() => setPreset("saas")}
          className={cn(
            "px-2.5 py-1 rounded-full transition-all",
            preset === "saas"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          SaaS Pro
        </button>
        <button
          onClick={() => setPreset("apple")}
          className={cn(
            "px-2.5 py-1 rounded-full transition-all",
            preset === "apple"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Apple
        </button>
      </div>
    </div>
  );
}
