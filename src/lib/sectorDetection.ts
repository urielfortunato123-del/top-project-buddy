/**
 * Sector Detection Engine
 * Detects the business sector of imported spreadsheets based on column names and cell values.
 */

export interface SectorKeywords {
  sector: string;
  label: string;
  icon: string;
  services: string[];
  keywords: string[];
}

export interface SectorDetectionResult {
  sector: string;
  label: string;
  icon: string;
  serviceType: string;
  confidence: number;
  matchedKeywords: string[];
  suggestedKpis: string[];
}

const SECTOR_DATABASE: SectorKeywords[] = [
  {
    sector: "engenharia_civil",
    label: "Engenharia Civil",
    icon: "🏗️",
    services: ["obras", "estacas", "concreto", "estruturas", "terraplenagem", "pavimentação", "drenagem", "defensas metálicas", "canaletas", "taludes"],
    keywords: ["estaca", "km", "trecho", "lado", "inicial", "final", "obra", "pista", "concreto", "reparo", "drenagem", "canaleta", "dissipador", "ala", "largura", "defensa", "talude", "pavimento", "terraplenagem"],
  },
  {
    sector: "engenharia_rodoviaria",
    label: "Engenharia Rodoviária",
    icon: "🛣️",
    services: ["manutenção rodovia", "sinalização", "defensas", "drenagem", "acostamento", "pavimento"],
    keywords: ["rodovia", "km", "faixa", "acostamento", "defensa", "sinalização", "pista", "trecho", "estaca", "canaleta", "dissipador", "drenagem", "lado"],
  },
  {
    sector: "engenharia_eletrica",
    label: "Engenharia Elétrica",
    icon: "⚡",
    services: ["inspeção rede", "manutenção subestação", "transformadores", "medições"],
    keywords: ["tensão", "transformador", "fase", "corrente", "poste", "rede", "subestação", "kv", "kwh", "disjuntor"],
  },
  {
    sector: "engenharia_ambiental",
    label: "Engenharia Ambiental",
    icon: "🌱",
    services: ["análise ambiental", "monitoramento água", "monitoramento solo", "resíduos"],
    keywords: ["coleta", "amostra", "ph", "qualidade", "resíduo", "efluente", "poluição", "monitoramento", "ambiental"],
  },
  {
    sector: "construcao_civil",
    label: "Construção Civil",
    icon: "🏠",
    services: ["controle obra", "cronograma", "medições", "materiais", "produtividade"],
    keywords: ["pedreiro", "obra", "etapa", "concreto", "bloco", "cimento", "metro", "alvenaria", "fundação"],
  },
  {
    sector: "logistica",
    label: "Logística",
    icon: "📦",
    services: ["entregas", "controle frota", "transporte", "rastreamento", "estoque"],
    keywords: ["entrega", "pedido", "cliente", "rota", "motorista", "veículo", "carga", "frete", "rastreamento"],
  },
  {
    sector: "transporte",
    label: "Transporte",
    icon: "🚌",
    services: ["controle motoristas", "horários", "viagens"],
    keywords: ["linha", "ônibus", "motorista", "viagem", "km", "passageiro", "itinerário"],
  },
  {
    sector: "industria",
    label: "Indústria",
    icon: "🏭",
    services: ["produção", "controle qualidade", "manutenção", "estoque"],
    keywords: ["lote", "produção", "peça", "defeito", "linha", "máquina", "turno", "refugo"],
  },
  {
    sector: "agricultura",
    label: "Agricultura",
    icon: "🌾",
    services: ["plantio", "colheita", "insumos", "irrigação"],
    keywords: ["hectare", "plantio", "colheita", "safra", "solo", "irrigação", "talhão", "semente"],
  },
  {
    sector: "pecuaria",
    label: "Pecuária",
    icon: "🐄",
    services: ["controle gado", "vacinação", "reprodução"],
    keywords: ["animal", "peso", "lote", "vaca", "bezerro", "rebanho", "vacinação", "abate"],
  },
  {
    sector: "saude",
    label: "Saúde",
    icon: "🏥",
    services: ["prontuário", "exames", "consultas", "controle pacientes"],
    keywords: ["paciente", "consulta", "exame", "diagnóstico", "médico", "receita", "prontuário"],
  },
  {
    sector: "hospital",
    label: "Hospital",
    icon: "🏨",
    services: ["leitos", "enfermagem", "procedimentos"],
    keywords: ["leito", "enfermagem", "cirurgia", "alta", "internação", "uti", "enfermeiro"],
  },
  {
    sector: "educacao",
    label: "Educação",
    icon: "📚",
    services: ["alunos", "notas", "frequência", "professores"],
    keywords: ["aluno", "nota", "matéria", "turma", "presença", "professor", "disciplina", "frequência"],
  },
  {
    sector: "contabilidade",
    label: "Contabilidade",
    icon: "📊",
    services: ["lançamentos", "balanço", "impostos", "faturamento"],
    keywords: ["receita", "despesa", "imposto", "nota fiscal", "conta", "balanço", "lançamento", "tributo"],
  },
  {
    sector: "financeiro",
    label: "Financeiro",
    icon: "💰",
    services: ["fluxo de caixa", "contas pagar", "contas receber"],
    keywords: ["valor", "pagamento", "recebimento", "saldo", "fluxo", "caixa", "fatura", "boleto"],
  },
  {
    sector: "rh",
    label: "Recursos Humanos",
    icon: "👥",
    services: ["folha pagamento", "presença", "férias", "banco horas"],
    keywords: ["funcionário", "folga", "horas", "salário", "férias", "admissão", "demissão", "ponto"],
  },
  {
    sector: "seguranca_trabalho",
    label: "Segurança do Trabalho",
    icon: "🦺",
    services: ["inspeções", "EPIs", "acidentes"],
    keywords: ["acidente", "risco", "epi", "segurança", "incidente", "nr", "inspeção"],
  },
  {
    sector: "ti",
    label: "Tecnologia / TI",
    icon: "💻",
    services: ["chamados", "suporte", "infraestrutura"],
    keywords: ["ticket", "erro", "servidor", "rede", "sistema", "bug", "deploy", "sprint"],
  },
  {
    sector: "comercio",
    label: "Comércio / Vendas",
    icon: "🛒",
    services: ["vendas", "clientes", "produtos"],
    keywords: ["cliente", "pedido", "produto", "valor", "venda", "estoque", "loja"],
  },
  {
    sector: "atendimento",
    label: "Atendimento / Suporte",
    icon: "🎧",
    services: ["chamados", "tickets", "SLA"],
    keywords: ["ticket", "atendimento", "resolvido", "pendente", "sla", "chamado", "protocolo"],
  },
  {
    sector: "imobiliario",
    label: "Imobiliário",
    icon: "🏢",
    services: ["imóveis", "aluguel", "contratos"],
    keywords: ["imóvel", "contrato", "aluguel", "proprietário", "inquilino", "locação"],
  },
  {
    sector: "governo",
    label: "Governo / Público",
    icon: "🏛️",
    services: ["fiscalização", "obras públicas", "inspeções"],
    keywords: ["processo", "obra", "fiscal", "licitação", "edital", "convênio", "empenho"],
  },
  {
    sector: "auditoria",
    label: "Auditoria",
    icon: "🔍",
    services: ["conformidade", "análise documentos"],
    keywords: ["auditoria", "controle", "irregularidade", "conformidade", "evidência", "parecer"],
  },
];

const KPI_SUGGESTIONS: Record<string, string[]> = {
  engenharia_civil: ["Total de Inspeções", "Conformidade (%)", "Itens Críticos", "Trechos Afetados"],
  engenharia_rodoviaria: ["Total de Inspeções", "Conformidade (%)", "Itens Críticos", "Trechos Afetados"],
  engenharia_eletrica: ["Disponibilidade (%)", "Falhas Registradas", "Manutenções Realizadas", "Carga Média"],
  engenharia_ambiental: ["Amostras Coletadas", "Conformidade (%)", "Parâmetros Fora", "Pontos Monitorados"],
  construcao_civil: ["Avanço Físico (%)", "Etapas Concluídas", "Pendências", "Produtividade"],
  logistica: ["Entregas Realizadas", "Taxa de Entrega (%)", "Atrasos", "Rotas Ativas"],
  transporte: ["Viagens Realizadas", "KM Rodados", "Ocupação Média", "Pontualidade (%)"],
  industria: ["Produção Total", "Taxa de Defeito (%)", "OEE (%)", "Turnos Ativos"],
  agricultura: ["Área Plantada (ha)", "Produtividade (t/ha)", "Insumos Aplicados", "Colheita (%)"],
  pecuaria: ["Cabeças de Gado", "Peso Médio", "Vacinação (%)", "Nascimentos"],
  saude: ["Consultas Realizadas", "Pacientes Atendidos", "Exames Pendentes", "Taxa de Retorno"],
  hospital: ["Leitos Ocupados", "Taxa de Ocupação (%)", "Cirurgias", "Altas"],
  educacao: ["Alunos Matriculados", "Frequência Média (%)", "Aprovação (%)", "Turmas Ativas"],
  contabilidade: ["Receita Total", "Despesa Total", "Resultado", "Notas Emitidas"],
  financeiro: ["Saldo Atual", "Contas a Pagar", "Contas a Receber", "Inadimplência (%)"],
  rh: ["Funcionários Ativos", "Horas Extras", "Absenteísmo (%)", "Turnover (%)"],
  seguranca_trabalho: ["Inspeções Realizadas", "Acidentes", "Atos Inseguros", "Conformidade EPIs (%)"],
  ti: ["Chamados Abertos", "Resolvidos", "SLA Atingido (%)", "Tempo Médio Resolução"],
  comercio: ["Vendas Totais", "Ticket Médio", "Clientes Ativos", "Produtos Vendidos"],
  atendimento: ["Chamados Abertos", "Resolvidos", "SLA (%)", "Satisfação"],
  imobiliario: ["Imóveis Ativos", "Contratos Vigentes", "Inadimplência (%)", "Receita Locação"],
  governo: ["Processos Ativos", "Licitações", "Obras em Andamento", "Fiscalizações"],
  auditoria: ["Auditorias Realizadas", "Conformidade (%)", "Irregularidades", "Pendências"],
};

/**
 * Detects the sector of a dataset by analyzing column names and sample values.
 */
export function detectSector(
  columnNames: string[],
  sampleValues: string[][]
): SectorDetectionResult | null {
  // Normalize all text for matching
  const allText = [
    ...columnNames,
    ...sampleValues.flat(),
  ]
    .map((t) => String(t ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""))
    .join(" ");

  let bestMatch: SectorDetectionResult | null = null;
  let bestScore = 0;

  for (const sector of SECTOR_DATABASE) {
    const matched: string[] = [];

    for (const kw of sector.keywords) {
      const normalizedKw = kw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (allText.includes(normalizedKw)) {
        matched.push(kw);
      }
    }

    if (matched.length === 0) continue;

    // Score = matched keywords / total keywords (weighted)
    const score = matched.length / sector.keywords.length;

    if (score > bestScore) {
      bestScore = score;

      // Determine most likely service type
      const serviceType = sector.services[0] || sector.label;

      bestMatch = {
        sector: sector.sector,
        label: sector.label,
        icon: sector.icon,
        serviceType,
        confidence: Math.min(Math.round(score * 100), 99),
        matchedKeywords: matched,
        suggestedKpis: KPI_SUGGESTIONS[sector.sector] || ["Total Registros", "Análise Principal", "Pendências", "Progresso"],
      };
    }
  }

  // Only return if confidence is reasonable
  if (bestMatch && bestMatch.confidence >= 10) {
    return bestMatch;
  }

  return null;
}

/**
 * Builds a sector context string for AI prompts.
 */
export function buildSectorContext(result: SectorDetectionResult): string {
  return [
    `Setor detectado: ${result.label} (${result.icon})`,
    `Tipo de serviço: ${result.serviceType}`,
    `Confiança: ${result.confidence}%`,
    `Palavras-chave detectadas: ${result.matchedKeywords.join(", ")}`,
    `KPIs sugeridos: ${result.suggestedKpis.join(", ")}`,
  ].join("\n");
}

/**
 * Extract sample values from dataset rows for detection.
 */
export function extractSampleValues(
  rows: Record<string, any>[],
  columns: string[],
  maxRows = 50
): string[][] {
  return rows.slice(0, maxRows).map((row) =>
    columns.map((col) => String(row[col] ?? ""))
  );
}
