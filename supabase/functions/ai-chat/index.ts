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
      date: null, person: null, team: null, status: null,
      observation: null, initial: null, final: null, km: null, side: null,
    },
    labels: {
      primaryRateLabel: "Indicador Principal",
      totalLabel: "Total de Registros",
      pendingLabel: null, peopleLabel: null,
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

// ── Google AI Studio (Gemini) ──

function toGeminiContents(messages: ChatMessage[], dataContext?: string) {
  const contents: { role: string; parts: { text: string }[] }[] = [];
  // System instruction is passed separately in Gemini API
  for (const m of messages) {
    contents.push({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    });
  }
  return contents;
}

async function callGemini(messages: ChatMessage[], dataContext?: string) {
  const apiKey = Deno.env.get("GOOGLE_AI_STUDIO_API_KEY");
  if (!apiKey) return null;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const body = {
    system_instruction: { parts: [{ text: buildSystemPrompt(dataContext) }] },
    contents: toGeminiContents(messages, dataContext),
    generationConfig: { temperature: 0.4 },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Google AI Studio error:", res.status, err);
    return null;
  }

  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

async function callGeminiStream(messages: ChatMessage[], dataContext?: string) {
  const apiKey = Deno.env.get("GOOGLE_AI_STUDIO_API_KEY");
  if (!apiKey) return null;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${apiKey}`;
  const body = {
    system_instruction: { parts: [{ text: buildSystemPrompt(dataContext) }] },
    contents: toGeminiContents(messages, dataContext),
    generationConfig: { temperature: 0.4 },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Google AI Studio stream error:", res.status, err);
    return null;
  }

  return res;
}

// ── Lovable AI Gateway (fallback) ──

async function callLovable(messages: ChatMessage[], dataContext?: string) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return null;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: buildSystemPrompt(dataContext) },
        ...messages.map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content })),
      ],
      temperature: 0.4,
      stream: false,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Lovable AI gateway error:", res.status, err);
    return null;
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content || null;
}

// ── Main handler ──

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { messages = [], dataContext = "", stream: wantStream = false } = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "messages inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Streaming mode ──
    if (wantStream) {
      const geminiRes = await callGeminiStream(messages, dataContext);

      if (geminiRes && geminiRes.body) {
        // Transform Gemini SSE to our SSE format
        const reader = geminiRes.body.getReader();
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
                    const token = parsed?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
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

      // Fallback: return static response
      return sseDoneResponse(buildFallbackText(messages));
    }

    // ── Non-stream mode ──
    // Try Google AI Studio first
    const geminiText = await callGemini(messages, dataContext);
    if (geminiText) {
      return new Response(
        JSON.stringify({ response: geminiText }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fallback to Lovable AI
    const lovableText = await callLovable(messages, dataContext);
    if (lovableText) {
      return new Response(
        JSON.stringify({ response: lovableText }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // All providers failed
    return new Response(
      JSON.stringify({ response: buildFallbackText(messages), fallback: true }),
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
