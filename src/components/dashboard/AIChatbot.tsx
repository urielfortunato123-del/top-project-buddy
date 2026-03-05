import React, { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Loader2, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { Dataset } from "@/lib/database";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AIChatbotProps {
  dataset: Dataset | null;
  filtered?: Record<string, any>[];
}

function buildDataContext(dataset: Dataset | null, filtered?: Record<string, any>[]): string {
  if (!dataset) return "";

  const rows = filtered ?? dataset.rows;
  const lines: string[] = [];
  lines.push(`Dataset: ${dataset.name}`);
  lines.push(`Total de linhas: ${rows.length}`);
  
  if (dataset.summary) {
    const s = dataset.summary;
    lines.push(`Total de registros: ${s.totalRecords}`);
    if (s.dateRange) lines.push(`Período: ${s.dateRange.from} a ${s.dateRange.to}`);
    if (s.categoryCounts) {
      for (const [col, counts] of Object.entries(s.categoryCounts)) {
        const top = Object.entries(counts).sort(([,a],[,b]) => b - a).slice(0, 5);
        lines.push(`${col}: ${top.map(([k,v]) => `${k}(${v})`).join(", ")}`);
      }
    }
    if (s.numericStats) {
      for (const [col, stats] of Object.entries(s.numericStats)) {
        lines.push(`${col}: min=${stats.min}, max=${stats.max}, média=${stats.avg.toFixed(1)}, soma=${stats.sum}`);
      }
    }
  }

  if (dataset.columns) {
    lines.push(`Colunas: ${dataset.columns.map(c => c.name).join(", ")}`);
  }

  // Sample of data (first 20 rows max)
  const sample = rows.slice(0, 20);
  if (sample.length > 0) {
    lines.push(`\nAmostra dos dados (${Math.min(20, rows.length)} de ${rows.length} linhas):`);
    lines.push(JSON.stringify(sample, null, 2));
  }

  return lines.join("\n");
}

export function AIChatbot({ dataset, filtered }: AIChatbotProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const dataContext = buildDataContext(dataset, filtered);
      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: { messages: newMessages, dataContext },
      });

      if (error) throw error;

      const assistantMsg: Message = {
        role: "assistant",
        content: data?.response || "Sem resposta.",
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error("AI Chat error:", err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Erro: ${err.message || "Falha na comunicação com a IA."}` },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, dataset, filtered]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Floating Button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all flex items-center justify-center hover:scale-105"
        >
          <Sparkles className="w-6 h-6" />
        </button>
      )}

      {/* Chat Panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[380px] h-[520px] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm">Assistente IA</span>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setMessages([])}
                title="Limpar conversa"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground text-sm mt-8 space-y-2">
                <Sparkles className="w-8 h-8 mx-auto text-primary/50" />
                <p className="font-medium">Olá! Sou seu assistente de dados.</p>
                <p className="text-xs">
                  {dataset
                    ? `Analisando "${dataset.name}" com ${dataset.totalRows} registros.`
                    : "Importe uma planilha para começar a análise."}
                </p>
                {dataset && (
                  <div className="mt-4 space-y-1.5">
                    <p className="text-xs text-muted-foreground">Sugestões:</p>
                    {[
                      "Faça um resumo dos dados",
                      "Qual a taxa de entrega?",
                      "Quem mais entregou?",
                    ].map((s) => (
                      <button
                        key={s}
                        onClick={() => { setInput(s); }}
                        className="block w-full text-left text-xs px-3 py-1.5 rounded-lg bg-muted hover:bg-accent transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[85%] px-3 py-2 rounded-xl text-sm whitespace-pre-wrap",
                  msg.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                )}
              >
                {msg.content}
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Pensando...</span>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-border">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Pergunte sobre seus dados..."
                className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
                disabled={loading}
              />
              <Button
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={sendMessage}
                disabled={loading || !input.trim()}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
