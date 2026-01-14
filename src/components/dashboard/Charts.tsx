import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";
import { cn } from "@/lib/utils";

const COLORS = [
  "hsl(142, 71%, 45%)",   // primary/success - emerald
  "hsl(37, 91%, 55%)",    // secondary/warning - amber
  "hsl(217, 91%, 60%)",   // accent/info - blue
  "hsl(271, 81%, 56%)",   // purple
  "hsl(0, 84%, 60%)",     // destructive - red
  "hsl(190, 90%, 50%)",   // cyan
  "hsl(330, 80%, 60%)",   // pink
  "hsl(215, 16%, 47%)",   // muted
];

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}

export function ChartCard({ title, subtitle, children, className, action }: ChartCardProps) {
  return (
    <div className={cn(
      "group bg-card rounded-2xl border shadow-lg overflow-hidden animate-fade-in transition-all duration-300 hover:shadow-xl",
      className
    )}>
      {/* Header */}
      <div className="px-5 py-4 border-b border-border/50 bg-gradient-to-r from-muted/30 to-transparent">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-card-foreground">{title}</h3>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>
          {action}
        </div>
      </div>
      
      {/* Content */}
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}

// Gráfico de linha genérico
interface GenericLineData {
  date: string;
  value1: number;
  value2?: number;
  label1?: string;
  label2?: string;
}

export function GenericLineChart({ data }: { data: GenericLineData[] }) {
  const hasSecondValue = data.some(d => d.value2 !== undefined);
  
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="colorValue1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.4} />
            <stop offset="100%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.05} />
          </linearGradient>
          <linearGradient id="colorValue2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
        <XAxis 
          dataKey="date" 
          tick={{ fontSize: 11, fontWeight: 500 }} 
          tickFormatter={(v) => v.slice(5)}
          className="text-muted-foreground [&_.recharts-cartesian-axis-tick-value]:fill-muted-foreground"
          axisLine={false}
          tickLine={false}
        />
        <YAxis 
          allowDecimals={false} 
          tick={{ fontSize: 11, fontWeight: 500 }} 
          className="[&_.recharts-cartesian-axis-tick-value]:fill-muted-foreground"
          axisLine={false}
          tickLine={false}
        />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: "hsl(var(--card))", 
            color: "hsl(var(--card-foreground))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "12px",
            boxShadow: "0 10px 40px -10px rgba(0,0,0,0.3)",
            fontSize: "12px",
            fontWeight: 500,
          }} 
        />
        <Area 
          type="monotone" 
          dataKey="value1" 
          stroke="hsl(142, 71%, 45%)" 
          strokeWidth={3}
          fill="url(#colorValue1)"
          name={data[0]?.label1 || "Valor"}
        />
        {hasSecondValue && (
          <Area 
            type="monotone" 
            dataKey="value2" 
            stroke="hsl(217, 91%, 60%)" 
            strokeWidth={2}
            fill="url(#colorValue2)"
            name={data[0]?.label2 || "Valor 2"}
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}

// Gráfico de barras vertical genérico
interface GenericBarData {
  category: string;
  count: number;
  sum?: number;
}

export function GenericBarChart({ data }: { data: GenericBarData[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data}>
        <defs>
          <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(142, 71%, 50%)" />
            <stop offset="100%" stopColor="hsl(142, 71%, 35%)" />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
        <XAxis 
          dataKey="category" 
          tick={{ fontSize: 10, fontWeight: 500 }}
          className="[&_.recharts-cartesian-axis-tick-value]:fill-muted-foreground"
          interval={0}
          angle={-25}
          textAnchor="end"
          height={60}
          axisLine={false}
          tickLine={false}
        />
        <YAxis 
          tick={{ fontSize: 11 }} 
          className="[&_.recharts-cartesian-axis-tick-value]:fill-muted-foreground"
          axisLine={false} 
          tickLine={false} 
        />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: "hsl(var(--card))", 
            color: "hsl(var(--card-foreground))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "12px",
            boxShadow: "0 10px 40px -10px rgba(0,0,0,0.3)",
            fontSize: "12px",
          }} 
        />
        <Bar dataKey="count" fill="url(#barGradient)" radius={[6, 6, 0, 0]} name="Quantidade" />
      </BarChart>
    </ResponsiveContainer>
  );
}

// Gráfico de barras horizontal genérico
interface GenericHorizontalBarData {
  name: string;
  value: number;
}

export function GenericHorizontalBarChart({ data }: { data: GenericHorizontalBarData[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical" barGap={0}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={true} vertical={false} />
        <XAxis 
          type="number" 
          tick={{ fontSize: 11 }} 
          className="[&_.recharts-cartesian-axis-tick-value]:fill-muted-foreground"
          axisLine={false} 
          tickLine={false} 
        />
        <YAxis 
          type="category" 
          dataKey="name" 
          tick={{ fontSize: 11, fontWeight: 500 }} 
          width={100}
          className="[&_.recharts-cartesian-axis-tick-value]:fill-muted-foreground"
          axisLine={false}
          tickLine={false}
        />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: "hsl(var(--card))", 
            color: "hsl(var(--card-foreground))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "12px",
            boxShadow: "0 10px 40px -10px rgba(0,0,0,0.3)",
            fontSize: "12px",
          }} 
        />
        <Bar dataKey="value" fill="hsl(142, 71%, 45%)" radius={[0, 6, 6, 0]} name="Quantidade" />
      </BarChart>
    </ResponsiveContainer>
  );
}

// Gráfico de pizza genérico
interface GenericPieData {
  name: string;
  value: number;
}

export function GenericPieChart({ data }: { data: GenericPieData[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  
  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width="50%" height={220}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={85}
            innerRadius={55}
            paddingAngle={2}
            stroke="hsl(var(--card))"
            strokeWidth={2}
          >
            {data.map((_, idx) => (
              <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ 
              backgroundColor: "hsl(var(--card))", 
              color: "hsl(var(--card-foreground))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "12px",
              boxShadow: "0 10px 40px -10px rgba(0,0,0,0.3)",
              fontSize: "12px",
            }} 
          />
        </PieChart>
      </ResponsiveContainer>
      
      {/* Legend */}
      <div className="flex-1 space-y-2">
        {data.slice(0, 6).map((item, idx) => {
          const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : 0;
          return (
            <div key={item.name} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full shrink-0" 
                style={{ backgroundColor: COLORS[idx % COLORS.length] }}
              />
              <span className="text-xs text-muted-foreground truncate flex-1">{item.name}</span>
              <span className="text-xs font-bold text-card-foreground">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Progress Ring
export function ProgressRing({ value, label, size = "md" }: { value: number; label: string; size?: "sm" | "md" | "lg" }) {
  const dimensions = { sm: 80, md: 100, lg: 120 };
  const dim = dimensions[size];
  const radius = dim / 2 - 10;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (value / 100) * circumference;
  
  const color = value >= 80 ? "hsl(142, 71%, 45%)" : value >= 50 ? "hsl(37, 91%, 55%)" : "hsl(0, 84%, 60%)";

  return (
    <div className="flex flex-col items-center group">
      <div className="relative transition-transform group-hover:scale-110" style={{ width: dim, height: dim }}>
        <svg className="w-full h-full transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={dim / 2}
            cy={dim / 2}
            r={radius}
            className="stroke-muted"
            strokeWidth="10"
            fill="none"
          />
          {/* Progress circle */}
          <circle
            cx={dim / 2}
            cy={dim / 2}
            r={radius}
            stroke={color}
            strokeWidth="10"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
            style={{ filter: `drop-shadow(0 0 8px ${color})` }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-black text-card-foreground">{value}%</span>
        </div>
      </div>
      <span className="text-xs font-semibold text-muted-foreground mt-2 uppercase tracking-wide text-center max-w-[80px] truncate">{label}</span>
    </div>
  );
}

// Export legacy components for compatibility
export { GenericLineChart as DeliveryLineChart };
export { GenericHorizontalBarChart as PersonBarChart };
export { GenericPieChart as StatusPieChart };
export { GenericBarChart as TeamBarChart };

// Legacy team comparison chart
export function TeamComparisonChart({ data }: { data: { team: string; entregue: number; total: number; taxa: number }[] }) {
  const sortedData = [...data].sort((a, b) => b.taxa - a.taxa);
  const maxTaxa = Math.max(...sortedData.map(d => d.taxa), 100);

  return (
    <div className="space-y-4">
      {sortedData.map((item, idx) => {
        const isTop = idx === 0;
        const isBottom = idx === sortedData.length - 1 && sortedData.length > 1;
        
        return (
          <div key={item.team} className="group">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <span className={cn(
                  "text-xs font-black w-6 h-6 rounded-full flex items-center justify-center",
                  isTop ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30" : 
                  isBottom ? "bg-destructive text-destructive-foreground shadow-lg shadow-destructive/30" : 
                  "bg-muted text-muted-foreground"
                )}>
                  {idx + 1}
                </span>
                <span className="text-sm font-semibold truncate max-w-[140px] text-card-foreground">
                  {item.team}
                </span>
              </div>
              <div className="text-right flex items-center gap-2">
                <span className={cn(
                  "text-lg font-black",
                  item.taxa >= 80 ? "text-primary" : 
                  item.taxa >= 50 ? "text-secondary" : 
                  "text-destructive"
                )}>
                  {item.taxa}%
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  ({item.entregue}/{item.total})
                </span>
              </div>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden shadow-inner">
              <div 
                className={cn(
                  "h-full rounded-full transition-all duration-700 ease-out",
                  item.taxa >= 80 ? "bg-gradient-to-r from-primary to-emerald-400" : 
                  item.taxa >= 50 ? "bg-gradient-to-r from-secondary to-amber-400" : 
                  "bg-gradient-to-r from-destructive to-red-400"
                )}
                style={{ width: `${(item.taxa / maxTaxa) * 100}%` }}
              />
            </div>
          </div>
        );
      })}
      
      {sortedData.length > 1 && (
        <div className="mt-5 pt-4 border-t border-border">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground font-medium">Gap entre 1º e último:</span>
            <span className="text-sm font-black text-card-foreground px-3 py-1 bg-muted rounded-full">
              {sortedData[0].taxa - sortedData[sortedData.length - 1].taxa}pp
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
