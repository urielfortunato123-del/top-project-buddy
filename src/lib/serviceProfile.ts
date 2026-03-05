/**
 * Service Profile Classifier
 * Detects the service type of a dataset using keyword heuristics,
 * then produces a ServiceProfile with semantic mapping, KPI config, and labels.
 */

import { DOMAIN_TAXONOMY, taxonomyToPromptText } from "./domainTaxonomy";
import { ENGINEERING_KEYWORDS } from "./engineeringKeywords";

// ─── Types ───────────────────────────────────────────────────

export type ServiceType =
  | "RDA_ENTREGAS"
  | "INSPECAO_OBSERVACAO"
  | "CANALETAS"
  | "ENG_RODOVIARIA"
  | "CONTABIL_FISCAL"
  | "EDUCACAO"
  | "SAUDE"
  | "LOGISTICA"
  | "RH_PONTO"
  | "GENERIC";

export interface ServiceProfile {
  type: ServiceType;
  confidence: number; // 0..1
  domain: string;
  service: string;
  signals: {
    matchedKeywords: string[];
    matchedColumns: string[];
    notes: string[];
  };
  semanticMap: {
    date?: string;
    person?: string;
    team?: string;
    status?: string;
    observation?: string;
    initial?: string;
    final?: string;
    km?: string;
    side?: string;
  };
  labels: {
    primaryRateLabel: string;
    totalLabel: string;
    peopleLabel?: string;
    pendingLabel?: string;
  };
  kpiProfile: {
    primaryRate: "delivery_rate" | "conformity_rate" | "non_empty_rate" | "none";
    include: string[];
  };
  matrixDefaults?: { rowKey: string; colKey: string; valueKey: string };
  statusDictionary?: Record<string, string>;
}

type ColumnMetadata = { name: string; uniqueValues?: string[] };

export interface DatasetLike {
  name: string;
  columns: ColumnMetadata[];
  rows?: Record<string, any>[];
}

// ─── Helpers ─────────────────────────────────────────────────

function norm(s: any): string {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function includesAny(hay: string, needles: string[]): boolean {
  const h = norm(hay);
  return needles.some((n) => h.includes(norm(n)));
}

function scoreMatches(
  haystack: string[],
  keywords: string[]
): { score: number; hits: string[] } {
  const hits: string[] = [];
  const hayNorm = new Set(haystack.map(norm));

  for (const k of keywords) {
    const kk = norm(k);
    for (const item of hayNorm) {
      if (item.includes(kk) || kk.includes(item)) {
        hits.push(k);
        break;
      }
    }
  }

  const uniqueHits = Array.from(new Set(hits.map(norm)));
  const divisor = Math.max(8, Math.min(25, keywords.length));
  const score = Math.min(1, uniqueHits.length / divisor);
  return { score, hits: uniqueHits };
}

function detectSemanticMap(
  columns: string[]
): ServiceProfile["semanticMap"] {
  const c = columns.map(norm);

  const pick = (cands: string[]) => {
    const idx = c.findIndex((x) => cands.some((ca) => x.includes(norm(ca))));
    return idx >= 0 ? columns[idx] : undefined;
  };

  return {
    date: pick(["data", "dia", "date"]),
    person: pick([
      "pessoa",
      "colaborador",
      "funcion",
      "motorista",
      "aluno",
      "paciente",
      "responsável",
      "responsavel",
    ]),
    team: pick(["equipe", "time", "setor", "turma", "unidade"]),
    status: pick(["status", "situação", "situacao", "resultado", "conclus", "ok", "nok"]),
    observation: pick([
      "observação",
      "observacao",
      "obs",
      "descrição",
      "descricao",
      "apontamento",
    ]),
    initial: pick(["inicial", "ini", "estaca", "km inicial", "inicio"]),
    final: pick(["final", "fim", "km final"]),
    km: pick(["km", "quilometro"]),
    side: pick(["lado", "sentido", "mão", "mao"]),
  };
}

function guessMatrixDefaults(
  semanticMap: ServiceProfile["semanticMap"],
  colNames: string[],
  _preferRow: string,
  _preferCol: string
): ServiceProfile["matrixDefaults"] | undefined {
  const hasObs = colNames.some((c) => norm(c).includes("observ"));
  const hasIni = colNames.some((c) => norm(c).includes("inicial"));
  const hasStatus =
    colNames.some((c) => norm(c).includes("status")) || !!semanticMap.status;

  if (hasObs && hasIni && hasStatus) {
    return {
      rowKey:
        colNames.find((c) => norm(c).includes("observ")) || _preferRow,
      colKey:
        colNames.find((c) => norm(c).includes("inicial")) || _preferCol,
      valueKey:
        semanticMap.status ||
        colNames.find((c) => norm(c).includes("status")) ||
        "Status",
    };
  }

  if (semanticMap.person && semanticMap.date && semanticMap.status) {
    return {
      rowKey: semanticMap.person,
      colKey: semanticMap.date,
      valueKey: semanticMap.status,
    };
  }

  return undefined;
}

// ─── Keyword Packs ───────────────────────────────────────────

const KW_RDA = [
  "entregue","entrega","folga","banco de horas","atest","férias","ferias",
  "falta","pendente",
];
const KW_INSP = [
  "inspeção","inspecao","observação","observacao","checklist","conformidade",
  "não conformidade","nao conformidade","ok","nok","sim","não","nao",
];
const KW_CANALETAS = [
  "canaleta","canaletas","largura","ala","pista","dissipador","dissipadores",
  "saída na ala","saida na ala","saída lateral","saida lateral","paralela",
];
const KW_CONTABIL = [
  "plano de contas","débito","debito","crédito","credito","dre","balancete",
  "nf","nfe","icms","iss","pis","cofins","cfop","sped","das",
];
const KW_ESCOLA = [
  "aluno","turma","nota","prova","disciplina","frequência","frequencia",
  "presença","presenca",
];
const KW_SAUDE = [
  "paciente","consulta","exame","laudo","cid","crm","leito","medicação","medicacao",
];
const KW_LOG = [
  "entrega","pedido","rota","motorista","placa","frota","coleta","remessa",
  "cliente","destino",
];
const KW_RH = [
  "folha","ponto","escala","funcionário","funcionario","salário","salario",
  "férias","ferias","banco de horas",
];

// ─── Domain matching via taxonomy ────────────────────────────

function findBestDomainService(
  haystack: string[]
): { domain: string; service: string; score: number; hits: string[] } | null {
  let best: { domain: string; service: string; score: number; hits: string[] } | null = null;

  for (const d of DOMAIN_TAXONOMY.domains) {
    for (const s of d.services) {
      const { score, hits } = scoreMatches(haystack, s.keywords);
      if (score > (best?.score ?? 0)) {
        best = { domain: d.domain, service: s.service, score, hits };
      }
    }
  }

  return best;
}

// ─── Main Classifier ─────────────────────────────────────────

export function detectServiceProfile(dataset: DatasetLike): ServiceProfile {
  const colNames = dataset.columns.map((c) => c.name);
  const colNorm = colNames.map(norm);

  const topValues = dataset.columns
    .flatMap((c) => (c.uniqueValues ?? []).slice(0, 25))
    .map(norm);

  const hay = [...colNorm, ...topValues, norm(dataset.name)];

  // Score all keyword packs
  const mRDA = scoreMatches(hay, KW_RDA);
  const mINSP = scoreMatches(hay, KW_INSP);
  const mCANA = scoreMatches(hay, KW_CANALETAS);
  const mCONT = scoreMatches(hay, KW_CONTABIL);
  const mESC = scoreMatches(hay, KW_ESCOLA);
  const mSAU = scoreMatches(hay, KW_SAUDE);
  const mLOG = scoreMatches(hay, KW_LOG);
  const mRH = scoreMatches(hay, KW_RH);

  // Also match against engineering keywords for domain enrichment
  const engMatch = scoreMatches(hay, ENGINEERING_KEYWORDS);

  // Find best domain/service from taxonomy
  const taxonomyMatch = findBestDomainService(hay);

  // ── 1) Canaletas (subtipo inspeção de drenagem) ──
  if (mCANA.score >= 0.25 || norm(dataset.name).includes("canaleta")) {
    const semanticMap = detectSemanticMap(colNames);
    return {
      type: "CANALETAS",
      confidence: Math.min(1, 0.65 + mCANA.score * 0.7),
      domain: "Engenharia",
      service: "Drenagem / OAE",
      signals: {
        matchedKeywords: mCANA.hits,
        matchedColumns: colNames.filter((x) =>
          includesAny(x, ["observ", "inicial", "estaca", "lado", "km", "status"])
        ),
        notes: [
          "Detectado por termos típicos de drenagem/canaletas (largura/ala/dissipador).",
        ],
      },
      semanticMap,
      labels: {
        primaryRateLabel: "% Conformidade (SIM)",
        totalLabel: "Total de Registros",
        peopleLabel: semanticMap.person ? "Pessoas" : undefined,
        pendingLabel: "Não Conformidades",
      },
      kpiProfile: {
        primaryRate: "conformity_rate",
        include: [
          "total_records",
          "conformity_rate",
          "empty_rate",
          "top_observations",
          "top_initials",
          "unique_people",
        ],
      },
      matrixDefaults: guessMatrixDefaults(semanticMap, colNames, "OBSERVAÇÃO", "INICIAL"),
      statusDictionary: {
        sim: "SIM",
        "não": "NAO",
        nao: "NAO",
        ok: "OK",
        nok: "NOK",
        vazio: "VAZIO",
        "": "VAZIO",
        "-": "VAZIO",
      },
    };
  }

  // ── 2) RDA Entregas ──
  if (mRDA.score >= 0.25 && mINSP.score < 0.2) {
    const semanticMap = detectSemanticMap(colNames);
    return {
      type: "RDA_ENTREGAS",
      confidence: Math.min(1, 0.6 + mRDA.score * 0.8),
      domain: taxonomyMatch?.domain || "Logística",
      service: taxonomyMatch?.service || "Entregas / Roteirização",
      signals: {
        matchedKeywords: mRDA.hits,
        matchedColumns: colNames.filter((x) =>
          includesAny(x, ["data", "pessoa", "equipe", "status"])
        ),
        notes: [
          "Detectado por vocabulário típico de entrega (entregue/folga/banco/ferias/falta).",
        ],
      },
      semanticMap,
      labels: {
        primaryRateLabel: "Taxa de Entrega",
        totalLabel: "Total Entregue",
        peopleLabel: "Pessoas",
        pendingLabel: "Pendências",
      },
      kpiProfile: {
        primaryRate: "delivery_rate",
        include: [
          "delivery_rate",
          "delivered_total",
          "pending_total",
          "folga_total",
          "banco_total",
          "unique_people",
        ],
      },
      matrixDefaults: guessMatrixDefaults(semanticMap, colNames, "Pessoa", "Data"),
      statusDictionary: {
        entregue: "ENT",
        entrega: "ENT",
        folga: "FOL",
        "banco de horas": "BAN",
        banco: "BAN",
        falta: "FAL",
        atest: "ATE",
        atestado: "ATE",
        "férias": "FER",
        ferias: "FER",
        "": "-",
      },
    };
  }

  // ── 3) Inspeção / Observação genérica ──
  if (mINSP.score >= 0.2) {
    const semanticMap = detectSemanticMap(colNames);
    return {
      type: "INSPECAO_OBSERVACAO",
      confidence: Math.min(1, 0.55 + mINSP.score * 0.9),
      domain: taxonomyMatch?.domain || "Engenharia",
      service: taxonomyMatch?.service || "Inspeção de Campo",
      signals: {
        matchedKeywords: mINSP.hits,
        matchedColumns: colNames.filter((x) =>
          includesAny(x, ["observ", "inicial", "final", "km", "lado", "status"])
        ),
        notes: [
          "Detectado por vocabulário de inspeção (observação/OK/NOK/SIM/NÃO).",
        ],
      },
      semanticMap,
      labels: {
        primaryRateLabel: "% Conformidade (OK/SIM)",
        totalLabel: "Total de Registros",
        peopleLabel: semanticMap.person ? "Pessoas" : undefined,
        pendingLabel: "Não Conformidades",
      },
      kpiProfile: {
        primaryRate: "conformity_rate",
        include: [
          "total_records",
          "conformity_rate",
          "empty_rate",
          "top_categories",
          "unique_people",
        ],
      },
      matrixDefaults: guessMatrixDefaults(semanticMap, colNames, "OBSERVAÇÃO", "INICIAL"),
      statusDictionary: {
        sim: "SIM",
        "não": "NAO",
        nao: "NAO",
        ok: "OK",
        nok: "NOK",
        "": "VAZIO",
        "-": "VAZIO",
      },
    };
  }

  // ── 4) Engineering domain (high eng keyword match) ──
  if (engMatch.score >= 0.15) {
    const semanticMap = detectSemanticMap(colNames);
    return {
      type: "ENG_RODOVIARIA",
      confidence: Math.min(1, 0.5 + engMatch.score * 0.8),
      domain: taxonomyMatch?.domain || "Engenharia",
      service: taxonomyMatch?.service || "Rodoviária / Conservação",
      signals: {
        matchedKeywords: engMatch.hits.slice(0, 20),
        matchedColumns: colNames,
        notes: [
          `Detectado por ${engMatch.hits.length} termos de engenharia.`,
        ],
      },
      semanticMap,
      labels: {
        primaryRateLabel: "Indicador Principal",
        totalLabel: "Total de Registros",
        peopleLabel: semanticMap.person ? "Pessoas" : undefined,
      },
      kpiProfile: {
        primaryRate: "none",
        include: [
          "total_records",
          "top_categories",
          "date_range",
          "unique_entities",
        ],
      },
      matrixDefaults: guessMatrixDefaults(semanticMap, colNames, "Pessoa", "Data"),
    };
  }

  // ── 5) Other domains ──
  const semanticMap = detectSemanticMap(colNames);
  const candidates: Array<{
    type: ServiceType;
    s: number;
    hits: string[];
    note: string;
  }> = [
    { type: "CONTABIL_FISCAL" as ServiceType, s: mCONT.score, hits: mCONT.hits, note: "Vocabulário contábil/fiscal detectado." },
    { type: "EDUCACAO" as ServiceType, s: mESC.score, hits: mESC.hits, note: "Vocabulário escolar detectado." },
    { type: "SAUDE" as ServiceType, s: mSAU.score, hits: mSAU.hits, note: "Vocabulário de saúde detectado." },
    { type: "LOGISTICA" as ServiceType, s: mLOG.score, hits: mLOG.hits, note: "Vocabulário logístico detectado." },
    { type: "RH_PONTO" as ServiceType, s: mRH.score, hits: mRH.hits, note: "Vocabulário de RH/ponto detectado." },
  ].sort((a, b) => b.s - a.s);

  const best = candidates[0];
  if (best.s >= 0.25) {
    return {
      type: best.type,
      confidence: Math.min(1, 0.5 + best.s * 0.9),
      domain: taxonomyMatch?.domain || best.type,
      service: taxonomyMatch?.service || best.note,
      signals: {
        matchedKeywords: best.hits,
        matchedColumns: colNames,
        notes: [best.note],
      },
      semanticMap,
      labels: {
        primaryRateLabel: "Indicador Principal",
        totalLabel: "Total de Registros",
      },
      kpiProfile: {
        primaryRate: "none",
        include: ["total_records", "top_categories", "date_range", "unique_entities"],
      },
    };
  }

  // ── 6) Fallback: use taxonomy match if available ──
  if (taxonomyMatch && taxonomyMatch.score >= 0.15) {
    return {
      type: "GENERIC",
      confidence: Math.min(0.6, 0.35 + taxonomyMatch.score * 0.5),
      domain: taxonomyMatch.domain,
      service: taxonomyMatch.service,
      signals: {
        matchedKeywords: taxonomyMatch.hits,
        matchedColumns: colNames,
        notes: [`Detectado via taxonomia: ${taxonomyMatch.domain} > ${taxonomyMatch.service}`],
      },
      semanticMap,
      labels: {
        primaryRateLabel: "Indicador Principal",
        totalLabel: "Total de Registros",
      },
      kpiProfile: {
        primaryRate: "none",
        include: ["total_records", "top_categories", "date_range"],
      },
    };
  }

  // ── 7) Pure fallback ──
  return {
    type: "GENERIC",
    confidence: 0.35,
    domain: "Genérico",
    service: "Análise Geral",
    signals: {
      matchedKeywords: [],
      matchedColumns: colNames,
      notes: ["Sem confiança suficiente. Usando modo genérico."],
    },
    semanticMap,
    labels: {
      primaryRateLabel: "Indicador Principal",
      totalLabel: "Total de Registros",
    },
    kpiProfile: {
      primaryRate: "none",
      include: ["total_records", "top_categories", "date_range"],
    },
  };
}

/**
 * Build a context string for AI prompts from a ServiceProfile.
 */
export function buildServiceProfileContext(profile: ServiceProfile): string {
  const lines = [
    `=== PERFIL DE SERVIÇO DETECTADO ===`,
    `Tipo: ${profile.type}`,
    `Domínio: ${profile.domain}`,
    `Serviço: ${profile.service}`,
    `Confiança: ${Math.round(profile.confidence * 100)}%`,
    `Palavras-chave: ${profile.signals.matchedKeywords.join(", ")}`,
    `Notas: ${profile.signals.notes.join("; ")}`,
    `KPI primário: ${profile.labels.primaryRateLabel}`,
    `KPIs incluídos: ${profile.kpiProfile.include.join(", ")}`,
  ];

  if (profile.semanticMap.date) lines.push(`Coluna data: ${profile.semanticMap.date}`);
  if (profile.semanticMap.person) lines.push(`Coluna pessoa: ${profile.semanticMap.person}`);
  if (profile.semanticMap.team) lines.push(`Coluna equipe: ${profile.semanticMap.team}`);
  if (profile.semanticMap.status) lines.push(`Coluna status: ${profile.semanticMap.status}`);
  if (profile.semanticMap.observation) lines.push(`Coluna observação: ${profile.semanticMap.observation}`);

  lines.push(`================================`);
  return lines.join("\n");
}

/**
 * Build the AI classification prompt with taxonomy context.
 */
export function buildClassificationPrompt(
  datasetName: string,
  columns: string[],
  topValuesByColumn: Record<string, string[]>,
  sampleRows?: Record<string, any>[]
): string {
  const taxonomy = taxonomyToPromptText();

  const topValuesStr = Object.entries(topValuesByColumn)
    .map(([col, vals]) => `  ${col}: ${vals.slice(0, 10).join(", ")}`)
    .join("\n");

  const sampleStr = sampleRows
    ? JSON.stringify(sampleRows.slice(0, 20), null, 2)
    : "(não fornecido)";

  return `Você é um classificador de planilhas para um sistema chamado ESSENCIAL.

Tarefa: Classificar o "tipo de serviço" da planilha.

Use como referência a TAXONOMIA abaixo (domínio → serviço → palavras-chave).
Retorne APENAS JSON válido, sem texto extra.

REGRAS:
- Se aparecer "canaleta/canaletas, largura, ala, dissipador, paralela à pista", classifique como type="CANALETAS"
- Se aparecer "entregue/folga/banco de horas/falta/atestado/férias", classifique como type="RDA_ENTREGAS"
- Se aparecer "observação, inicial/final/estaca/km/lado e OK/NOK/SIM/NÃO", classifique como type="INSPECAO_OBSERVACAO"
- Se não tiver confiança, retornar type="GENERIC" com confidence baixa.

OUTPUT JSON (schema):
{
  "type": "RDA_ENTREGAS|INSPECAO_OBSERVACAO|CANALETAS|ENG_RODOVIARIA|CONTABIL_FISCAL|EDUCACAO|SAUDE|LOGISTICA|RH_PONTO|GENERIC",
  "confidence": 0.0,
  "domain": "string",
  "service": "string",
  "semanticMap": {
    "date": "colName|null",
    "person": "colName|null",
    "team": "colName|null",
    "status": "colName|null",
    "observation": "colName|null"
  },
  "labels": {
    "primaryRateLabel": "string",
    "totalLabel": "string",
    "pendingLabel": "string|null",
    "peopleLabel": "string|null"
  },
  "kpiProfile": {
    "primaryRate": "delivery_rate|conformity_rate|non_empty_rate|none",
    "include": ["kpi_key_1","kpi_key_2"]
  },
  "reason": ["bullet 1", "bullet 2"]
}

TAXONOMIA:
${taxonomy}

DADOS DA PLANILHA:
dataset_name: ${datasetName}
columns: ${columns.join(", ")}
top_values_by_column:
${topValuesStr}
sample_rows:
${sampleStr}`;
}
