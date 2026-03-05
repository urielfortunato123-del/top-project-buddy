import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_AI_STUDIO_API_KEY");
    if (!GOOGLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "GOOGLE_AI_STUDIO_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { messages, dataContext } = await req.json();

    // Build the system prompt with data context
    const systemPrompt = `Você é um assistente de análise de dados especializado em entregas e produtividade de equipes. 
Responda sempre em português brasileiro. Seja conciso e direto.

${dataContext ? `Contexto dos dados atuais:\n${dataContext}` : "Nenhum dado carregado no momento."}

Você pode:
- Analisar tendências nos dados
- Fazer resumos e insights
- Responder perguntas sobre produtividade
- Sugerir melhorias baseadas nos dados
- Fazer análises preditivas simples`;

    // Format messages for Gemini API
    const contents = [];
    
    // Add system instruction as first user message context
    contents.push({
      role: "user",
      parts: [{ text: systemPrompt }],
    });
    contents.push({
      role: "model",
      parts: [{ text: "Entendido! Estou pronto para analisar seus dados. Como posso ajudar?" }],
    });

    // Add conversation messages
    for (const msg of messages) {
      contents.push({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }],
      });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.7,
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Google AI Studio error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: `Erro na API do Google AI: ${response.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sem resposta do modelo.";

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
