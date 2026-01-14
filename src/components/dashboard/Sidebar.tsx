import React, { useRef } from "react";
import { LayoutDashboard, FileSpreadsheet, Upload, Database, Settings, ChevronDown, Trash2 } from "lucide-react";
import type { Dataset } from "@/lib/database";
import { cn } from "@/lib/utils";

interface SidebarProps {
  datasets: Dataset[];
  currentDataset: Dataset | null;
  onImport: (file: File) => void;
  onSelectDataset: (id: string) => void;
  onDeleteDataset: (id: string) => void;
  personFilter: string;
  setPersonFilter: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  teamFilter: string;
  setTeamFilter: (v: string) => void;
  peopleList: string[];
  statusList: string[];
  teamList: string[];
}

export function Sidebar({
  datasets,
  currentDataset,
  onImport,
  onSelectDataset,
  onDeleteDataset,
  personFilter,
  setPersonFilter,
  statusFilter,
  setStatusFilter,
  teamFilter,
  setTeamFilter,
  peopleList,
  statusList,
  teamList,
}: SidebarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImport(file);
      e.target.value = "";
    }
  };

  return (
    <aside className="w-64 bg-sidebar-background text-sidebar-foreground flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg">
            <LayoutDashboard className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-wide">DASHBOARD</h1>
            <p className="text-xs text-sidebar-muted">Excel → Interativo</p>
          </div>
        </div>
      </div>

      {/* Import Button */}
      <div className="p-4 border-b border-sidebar-border">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/20 hover:bg-primary/30 border border-primary/40 transition-all text-sm font-semibold"
        >
          <Upload className="w-4 h-4" />
          Importar Excel/CSV
        </button>
      </div>

      {/* Datasets List */}
      <div className="p-4 border-b border-sidebar-border flex-1 overflow-auto">
        <div className="flex items-center gap-2 text-xs text-sidebar-muted mb-3">
          <Database className="w-3 h-3" />
          <span>ARQUIVOS SALVOS</span>
        </div>
        
        {datasets.length === 0 ? (
          <p className="text-xs text-sidebar-muted italic">Nenhum arquivo importado</p>
        ) : (
          <div className="space-y-2">
            {datasets.map((ds) => (
              <div
                key={ds.id}
                className={cn(
                  "group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all text-sm",
                  currentDataset?.id === ds.id
                    ? "bg-primary/20 border border-primary/40"
                    : "hover:bg-sidebar-accent border border-transparent"
                )}
                onClick={() => onSelectDataset(ds.id)}
              >
                <div className="flex items-center gap-2 truncate">
                  <FileSpreadsheet className="w-4 h-4 shrink-0" />
                  <span className="truncate">{ds.name}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteDataset(ds.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/20 rounded transition-all"
                >
                  <Trash2 className="w-3 h-3 text-destructive" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filters */}
      {currentDataset && (
        <div className="p-4 border-b border-sidebar-border space-y-3">
          <div className="flex items-center gap-2 text-xs text-sidebar-muted mb-2">
            <Settings className="w-3 h-3" />
            <span>FILTROS</span>
          </div>

          <div>
            <label className="text-xs text-sidebar-muted block mb-1">Equipe</label>
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-sidebar-accent border border-sidebar-border text-sm outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="ALL">Todas</option>
              {teamList.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-sidebar-muted block mb-1">Pessoa</label>
            <select
              value={personFilter}
              onChange={(e) => setPersonFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-sidebar-accent border border-sidebar-border text-sm outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="ALL">Todas</option>
              {peopleList.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-sidebar-muted block mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-sidebar-accent border border-sidebar-border text-sm outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="ALL">Todos</option>
              {statusList.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="p-4 text-xs text-sidebar-muted">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span>PWA Offline Ready</span>
        </div>
      </div>
    </aside>
  );
}
