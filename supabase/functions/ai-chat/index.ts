import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

function buildClassificationFallbackJson() {
  return JSON.stringify({
    type: "GENERIC",
    confidence: 0.35,
    domain: "Genérico",
    service: "Análise Geral",
    semanticMap: {
      date: null,
      person: null,
      team: null,
      status: null,
      observation: null,
      initial: null,
      final: null,
      km: null,
      side: null,
    },
    labels: {
      primaryRateLabel: "Indicador Principal",
      totalLabel: "Total de Registros",
      pendingLabel: null,
      peopleLabel: null,
    },
    kpiProfile: {
      primaryRate: "none",
      include: ["total_records", "top_categories", "date_range"],
    },
    reason: ["Fallback aplicado por indisponibilidade temporária da IA"],
  });
}

function buildFallbackText(messages: ChatMessage[]) {
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const isClassification = /OUTPUT JSON|classificador de planilhas|schema\)/i.test(lastUser);
  if (isClassification) return buildClassificationFallbackJson();
  return "No momento estou com indisponibilidade temporária de IA. A heurística local continuará funcionando normalmente.";
}

function sseDoneResponse(text: string) {
  const payload = `data: ${JSON.stringify({ token: text })}\n\ndata: [DONE]\n\n`;
  return new Response(payload, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

function buildSystemPrompt(dataContext?: string) {
  return `Você é um assistente de análise de dados especializado em produtividade e classificação de planilhas.
Responda sempre em português brasileiro. Seja conciso e direto.

${dataContext ? `Contexto dos dados atuais:\n${dataContext}` : "Nenhum dado carregado no momento."}

Você pode:
- Analisar tendências nos dados
- Fazer resumos e insights
- Responder perguntas sobre produtividade
- Sugerir melhorias baseadas nos dados
- Fazer análises preditivas simples
- Classificar planilhas por domínio/serviço quando solicitado`;
}

function toOpenAIMessages(messages: ChatMessage[], dataContext?: string) {
  return [
    { role: "system", content: buildSystemPrompt(dataContext) },
    ...messages.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    })),
  ];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { messages = [], dataContext = "", stream: wantStream = false } = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "messages inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload = {
      model: "google/gemini-2.5-flash",
      messages: toOpenAIMessages(messages, dataContext),
      temperature: 0.4,
      stream: Boolean(wantStream),
      response_format: { type: "text" },
    };

    // Streaming mode (SSE)
    if (wantStream) {
      const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
        },
        body: JSON.stringify(payload),
      });

      if (!upstream.ok || !upstream.body) {
        const err = await upstream.text();
        console.error("Lovable AI gateway stream error:", upstream.status, err);
        return sseDoneResponse(buildFallbackText(messages));
      }

      const reader = upstream.body.getReader();
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();

      const readable = new ReadableStream({
        async start(controller) {
          let buffer = "";
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });

              let newlineIdx: number;
              while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
                const line = buffer.slice(0, newlineIdx).trim();
                buffer = buffer.slice(newlineIdx + 1);

                if (!line.startsWith("data:")) continue;
                const jsonStr = line.replace(/^data:\s*/, "");
                if (jsonStr === "[DONE]") continue;

                try {
                  const parsed = JSON.parse(jsonStr);
                  const token = parsed?.choices?.[0]?.delta?.content ?? "";
                  if (token) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token })}\n\n`));
                  }
                } catch {
                  // ignore partial chunks
                }
              }
            }
          } catch (err) {
            console.error("Stream processing error:", err);
          } finally {
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          }
        },
      });

      return new Response(readable, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // Non-stream mode (used by hybrid classification)
    const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!upstream.ok) {
      const err = await upstream.text();
      console.error("Lovable AI gateway error:", upstream.status, err);
      return new Response(
        JSON.stringify({ response: buildFallbackText(messages), fallback: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await upstream.json();
    const text = data?.choices?.[0]?.message?.content || "Sem resposta do modelo.";

    return new Response(
      JSON.stringify({ response: text }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("ai-chat error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
