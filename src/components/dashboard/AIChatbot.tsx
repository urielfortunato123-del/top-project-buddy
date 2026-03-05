import React, { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, Loader2, Sparkles, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Dataset } from "@/lib/database";
import { detectServiceProfile, buildServiceProfileContext } from "@/lib/serviceProfile";

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

  // Detect service profile and prepend context
  const profile = detectServiceProfile({
    name: dataset.name,
    columns: dataset.columns?.map(c => ({ name: c.name, uniqueValues: c.uniqueValues })) ?? [],
    rows: dataset.rows,
  });
  if (profile.confidence > 0.35) {
    lines.push(buildServiceProfileContext(profile));
    lines.push("");
  }

  lines.push(`Dataset: ${dataset.name}`);
  lines.push(`Total de linhas: ${rows.length}`);
  if (dataset.summary) {
    const s = dataset.summary;
    lines.push(`Total de registros: ${s.totalRecords}`);
    if (s.dateRange) lines.push(`Período: ${s.dateRange.from} a ${s.dateRange.to}`);
    if (s.categoryCounts) {
      for (const [col, counts] of Object.entries(s.categoryCounts)) {
        const top = Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, 5);
        lines.push(`${col}: ${top.map(([k, v]) => `${k}(${v})`).join(", ")}`);
      }
    }
    if (s.numericStats) {
      for (const [col, stats] of Object.entries(s.numericStats)) {
        lines.push(`${col}: min=${stats.min}, max=${stats.max}, média=${stats.avg.toFixed(1)}, soma=${stats.sum}`);
      }
    }
  }
  if (dataset.columns) {
    lines.push(`Colunas: ${dataset.columns.map((c) => c.name).join(", ")}`);
  }
  const sample = rows.slice(0, 20);
  if (sample.length > 0) {
    lines.push(`\nAmostra dos dados (${Math.min(20, rows.length)} de ${rows.length} linhas):`);
    lines.push(JSON.stringify(sample, null, 2));
  }
  return lines.join("\n");
}

const STREAM_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

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

    let assistantSoFar = "";

    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      const content = assistantSoFar;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content } : m));
        }
        return [...prev, { role: "assistant", content }];
      });
    };

    try {
      const dataContext = buildDataContext(dataset, filtered);
      const resp = await fetch(STREAM_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: newMessages, dataContext, stream: true }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({ error: "Erro desconhecido" }));
        throw new Error(errData.error || `Erro ${resp.status}`);
      }

      if (!resp.body) throw new Error("Sem corpo na resposta");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.token) upsertAssistant(parsed.token);
          } catch {
            // partial JSON, wait for more
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      // Flush remaining
      if (buffer.trim()) {
        for (let raw of buffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.token) upsertAssistant(parsed.token);
          } catch { /* ignore */ }
        }
      }

      if (!assistantSoFar) {
        upsertAssistant("Sem resposta.");
      }
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
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all flex items-center justify-center hover:scale-105"
        >
          <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
      )}

      {open && (
        <div className="fixed inset-4 sm:inset-auto sm:bottom-6 sm:right-6 z-50 sm:w-[380px] sm:h-[520px] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm">Assistente IA</span>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMessages([])} title="Limpar conversa">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

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
                    {["Faça um resumo dos dados", "Qual a taxa de entrega?", "Quem mais entregou?"].map((s) => (
                      <button
                        key={s}
                        onClick={() => setInput(s)}
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
                  "max-w-[85%] px-3 py-2 rounded-xl text-sm",
                  msg.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground whitespace-pre-wrap"
                    : "bg-muted text-foreground"
                )}
              >
                {msg.role === "user" ? (
                  msg.content
                ) : (
                  <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:m-0 [&>ul]:m-0 [&>ol]:m-0 [&>table]:text-xs [&>table]:w-full">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                )}
              </div>
            ))}

            {loading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Pensando...</span>
              </div>
            )}
          </div>

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
              <Button size="icon" className="h-9 w-9 shrink-0" onClick={sendMessage} disabled={loading || !input.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
