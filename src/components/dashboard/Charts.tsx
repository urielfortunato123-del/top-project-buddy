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
  Legend,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";

const COLORS = [
  "hsl(142, 71%, 45%)",   // primary/success
  "hsl(37, 91%, 55%)",    // secondary/warning
  "hsl(0, 84%, 60%)",     // destructive
  "hsl(217, 91%, 60%)",   // accent/info
  "hsl(271, 81%, 56%)",   // purple
  "hsl(215, 16%, 47%)",   // muted
];

interface ChartCardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function ChartCard({ title, children, className }: ChartCardProps) {
  return (
    <div className={`bg-card rounded-2xl border p-4 shadow-lg animate-fade-in ${className}`}>
      <h3 className="font-bold text-sm mb-4 text-card-foreground">{title}</h3>
      {children}
    </div>
  );
}

interface LineChartData {
  date: string;
  entregue: number;
  total: number;
}

export function DeliveryLineChart({ data }: { data: LineChartData[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="colorEntregue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
        <XAxis 
          dataKey="date" 
          tick={{ fontSize: 10, fill: "hsl(215, 16%, 47%)" }} 
          tickFormatter={(v) => v.slice(5)}
        />
        <YAxis 
          allowDecimals={false} 
          tick={{ fontSize: 10, fill: "hsl(215, 16%, 47%)" }} 
        />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: "hsl(0, 0%, 100%)", 
            border: "1px solid hsl(214, 32%, 91%)",
            borderRadius: "8px",
            fontSize: "12px"
          }} 
        />
        <Area 
          type="monotone" 
          dataKey="entregue" 
          stroke="hsl(142, 71%, 45%)" 
          strokeWidth={3}
          fill="url(#colorEntregue)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

interface BarChartData {
  person: string;
  entregue: number;
  total: number;
}

export function PersonBarChart({ data }: { data: BarChartData[] }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data.slice(0, 10)} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
        <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(215, 16%, 47%)" }} />
        <YAxis 
          type="category" 
          dataKey="person" 
          tick={{ fontSize: 10, fill: "hsl(215, 16%, 47%)" }} 
          width={100}
        />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: "hsl(0, 0%, 100%)", 
            border: "1px solid hsl(214, 32%, 91%)",
            borderRadius: "8px",
            fontSize: "12px"
          }} 
        />
        <Legend wrapperStyle={{ fontSize: "12px" }} />
        <Bar dataKey="entregue" fill="hsl(142, 71%, 45%)" radius={[0, 4, 4, 0]} name="Entregue" />
        <Bar dataKey="total" fill="hsl(217, 91%, 60%)" radius={[0, 4, 4, 0]} name="Total" />
      </BarChart>
    </ResponsiveContainer>
  );
}

interface PieChartData {
  name: string;
  value: number;
}

export function StatusPieChart({ data }: { data: PieChartData[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={70}
          innerRadius={40}
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          labelLine={false}
        >
          {data.map((_, idx) => (
            <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip 
          contentStyle={{ 
            backgroundColor: "hsl(0, 0%, 100%)", 
            border: "1px solid hsl(214, 32%, 91%)",
            borderRadius: "8px",
            fontSize: "12px"
          }} 
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function TeamBarChart({ data }: { data: { team: string; entregue: number; total: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
        <XAxis 
          dataKey="team" 
          tick={{ fontSize: 9, fill: "hsl(215, 16%, 47%)" }}
          interval={0}
          angle={-20}
          textAnchor="end"
          height={50}
        />
        <YAxis tick={{ fontSize: 10, fill: "hsl(215, 16%, 47%)" }} />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: "hsl(0, 0%, 100%)", 
            border: "1px solid hsl(214, 32%, 91%)",
            borderRadius: "8px",
            fontSize: "12px"
          }} 
        />
        <Bar dataKey="entregue" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} name="Entregue" />
      </BarChart>
    </ResponsiveContainer>
  );
}

interface TeamComparisonData {
  team: string;
  entregue: number;
  total: number;
  taxa: number;
}

export function TeamComparisonChart({ data }: { data: TeamComparisonData[] }) {
  // Sort by delivery rate (taxa)
  const sortedData = [...data].sort((a, b) => b.taxa - a.taxa);
  const maxTaxa = Math.max(...sortedData.map(d => d.taxa), 100);

  return (
    <div className="space-y-3">
      {sortedData.map((item, idx) => {
        const isTop = idx === 0;
        const isBottom = idx === sortedData.length - 1 && sortedData.length > 1;
        
        return (
          <div key={item.team} className="relative">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                  isTop ? "bg-primary/20 text-primary" : 
                  isBottom ? "bg-destructive/20 text-destructive" : 
                  "bg-muted text-muted-foreground"
                }`}>
                  #{idx + 1}
                </span>
                <span className="text-sm font-medium truncate max-w-[120px]">{item.team}</span>
              </div>
              <div className="text-right">
                <span className={`text-sm font-bold ${
                  item.taxa >= 80 ? "text-primary" : 
                  item.taxa >= 50 ? "text-secondary" : 
                  "text-destructive"
                }`}>
                  {item.taxa}%
                </span>
                <span className="text-xs text-muted-foreground ml-1">
                  ({item.entregue}/{item.total})
                </span>
              </div>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  item.taxa >= 80 ? "bg-primary" : 
                  item.taxa >= 50 ? "bg-secondary" : 
                  "bg-destructive"
                }`}
                style={{ width: `${(item.taxa / maxTaxa) * 100}%` }}
              />
            </div>
          </div>
        );
      })}
      
      {sortedData.length > 1 && (
        <div className="mt-4 pt-3 border-t border-border">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Diferença entre 1º e último:</span>
            <span className="font-bold text-foreground">
              {sortedData[0].taxa - sortedData[sortedData.length - 1].taxa}pp
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export function ProgressRing({ value, label }: { value: number; label: string }) {
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-24 h-24">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="48"
            cy="48"
            r="40"
            stroke="hsl(214, 32%, 91%)"
            strokeWidth="8"
            fill="none"
          />
          <circle
            cx="48"
            cy="48"
            r="40"
            stroke="hsl(142, 71%, 45%)"
            strokeWidth="8"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-black">{value}%</span>
        </div>
      </div>
      <span className="text-xs text-muted-foreground mt-2">{label}</span>
    </div>
  );
}
