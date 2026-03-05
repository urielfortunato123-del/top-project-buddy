/**
 * Domain Taxonomy — 100+ service types across 12 business domains.
 * Used by both local heuristic classifier and AI prompt context.
 */

export interface DomainService {
  service: string;
  keywords: string[];
}

export interface Domain {
  domain: string;
  services: DomainService[];
}

export interface DomainTaxonomy {
  version: string;
  domains: Domain[];
}

export const DOMAIN_TAXONOMY: DomainTaxonomy = {
  version: "1.0.0",
  domains: [
    {
      domain: "Engenharia",
      services: [
        {
          service: "Rodoviária / Conservação",
          keywords: ["rodovia","km","estaca","trecho","faixa","acostamento","pista","CCR","DER","conservação","sinalização","defensa","canaleta","drenagem","bueiro","sarjeta","talude","roçada"],
        },
        {
          service: "Pavimentação / Asfalto",
          keywords: ["CBUQ","CAUQ","fresa","recomposição","massa asfáltica","binder","imprimação","tack coat","compactação","usina","CAP","emulsão","paver","rolo","densidade","espessura","m³","tonelada","faixa"],
        },
        {
          service: "Drenagem / OAE",
          keywords: ["drenagem","canaleta","sarjeta","bueiro","galeria","PV","poço de visita","tubo","diâmetro","queda","declividade","assoreamento","limpeza","desobstrução","ala","dissipador","enrocamento"],
        },
        {
          service: "Topografia / Geodésia",
          keywords: ["estação total","GNSS","RTK","base","rover","levantamento","locação","piquete","cota","azimute","poligonal","coordenada","UTM","N","E","Z","nivelamento","perfil","seção"],
        },
        {
          service: "Estruturas / Concreto",
          keywords: ["fck","slump","traço","cimento","brita","areia","aditivo","cura","forma","armação","bitola","estribo","viga","laje","pilar","concreto","moldagem","corpos de prova"],
        },
        {
          service: "Inspeção de Campo",
          keywords: ["inspeção","checklist","conformidade","não conformidade","OK","NOK","SIM","NÃO","observação","registro","evidência","foto","responsável","correção","prazo"],
        },
      ],
    },
    {
      domain: "Logística",
      services: [
        {
          service: "Entregas / Roteirização",
          keywords: ["entrega","pedido","rota","motorista","destino","cliente","remessa","tracking","ocorrência","comprovante","POD","canhoto","status","pendente","entregue","tentativa"],
        },
        {
          service: "Armazém / Estoque",
          keywords: ["estoque","SKU","lote","validade","entrada","saída","inventário","picking","packing","WMS","palete","endereço","separação","conferência"],
        },
        {
          service: "Frota / Manutenção",
          keywords: ["veículo","placa","odômetro","km","abastecimento","manutenção","oficina","pneu","óleo","OS","custo","sinistro","seguro","multas"],
        },
      ],
    },
    {
      domain: "Saúde",
      services: [
        {
          service: "Consultas / Atendimento",
          keywords: ["paciente","consulta","triagem","sintoma","queixa","CID","CRM","especialidade","agenda","retorno"],
        },
        {
          service: "Exames / Laboratório",
          keywords: ["exame","amostra","coleta","resultado","laudo","hemograma","urina","bioquímica","referência","reagente","equipamento"],
        },
        {
          service: "Hospital / Internação",
          keywords: ["leito","enfermagem","plantão","medicação","evolução","alta","internação","procedimento","cirurgia","UTI"],
        },
      ],
    },
    {
      domain: "Educação",
      services: [
        {
          service: "Notas / Avaliações",
          keywords: ["aluno","nota","prova","trabalho","média","bimestre","recuperação","disciplina","turma","professor"],
        },
        {
          service: "Frequência",
          keywords: ["presença","falta","atraso","frequência","aula","chamada","abono"],
        },
        {
          service: "Financeiro Escolar",
          keywords: ["mensalidade","boleto","matrícula","desconto","inadimplência","parcelamento","pagamento"],
        },
      ],
    },
    {
      domain: "Contabilidade e Fiscal",
      services: [
        {
          service: "Contábil",
          keywords: ["plano de contas","débito","crédito","balancete","DRE","razão","ativo","passivo","patrimônio","centro de custo","lançamento"],
        },
        {
          service: "Fiscal / Tributos",
          keywords: ["NF-e","NFS-e","ICMS","ISS","PIS","COFINS","IRPJ","CSLL","DAS","SPED","CFOP","retenção"],
        },
        {
          service: "Folha / RH",
          keywords: ["folha","salário","INSS","FGTS","holerite","admissão","demissão","ponto","férias","13º","banco de horas"],
        },
      ],
    },
    {
      domain: "Vendas e Comercial",
      services: [
        {
          service: "Pipeline / CRM",
          keywords: ["lead","prospect","funil","oportunidade","proposta","follow-up","negociação","fechado","perdido","ticket médio"],
        },
        {
          service: "Pedidos / Faturamento",
          keywords: ["pedido","produto","quantidade","desconto","vendedor","comissão","faturamento","nota fiscal","entrega"],
        },
        {
          service: "Pós-venda / Suporte",
          keywords: ["chamado","ticket","SLA","resolvido","pendente","prioridade","categoria","reincidência"],
        },
      ],
    },
    {
      domain: "Indústria e Qualidade",
      services: [
        {
          service: "Produção",
          keywords: ["ordem de produção","OP","turno","linha","meta","refugo","parada","setup","OEE","capacidade"],
        },
        {
          service: "Qualidade",
          keywords: ["inspeção","amostragem","defeito","não conformidade","RNC","CAPA","5 porquês","Ishikawa","OK","NOK","lote"],
        },
        {
          service: "Manutenção",
          keywords: ["OS","preventiva","corretiva","parada","MTBF","MTTR","equipamento","peça","lubrificação"],
        },
      ],
    },
    {
      domain: "Imobiliário e Condomínios",
      services: [
        {
          service: "Locação",
          keywords: ["aluguel","contrato","inquilino","proprietário","vencimento","reajuste","IPTU","caução"],
        },
        {
          service: "Condomínio",
          keywords: ["condomínio","assembleia","cota","inadimplência","manutenção","portaria","síndico"],
        },
        {
          service: "Obras e Reparos",
          keywords: ["reforma","orçamento","prestador","nota","serviço","cronograma","vistoria"],
        },
      ],
    },
    {
      domain: "TI e Operações",
      services: [
        {
          service: "Suporte / Helpdesk",
          keywords: ["ticket","incidente","SLA","prioridade","categoria","resolvido","fila","atendente","chamado"],
        },
        {
          service: "Infra / Redes",
          keywords: ["servidor","IP","DNS","VPN","firewall","switch","latência","uptime","backup","storage"],
        },
        {
          service: "Segurança",
          keywords: ["acesso","log","auditoria","MFA","incidente","vulnerabilidade","patch","permite","bloqueio"],
        },
      ],
    },
    {
      domain: "Jurídico e Compliance",
      services: [
        {
          service: "Contratos",
          keywords: ["contrato","cláusula","vigência","aditivo","rescisão","multa","partes","assinatura"],
        },
        {
          service: "Processos",
          keywords: ["processo","vara","prazo","petição","audiência","protocolo","movimentação","custas"],
        },
        {
          service: "LGPD / Compliance",
          keywords: ["consentimento","dados pessoais","tratamento","finalidade","incidente","relatório","DPO","conformidade"],
        },
      ],
    },
    {
      domain: "Serviços Públicos",
      services: [
        {
          service: "Obras Públicas",
          keywords: ["licitação","medições","fiscal","obra","contrato","empenho","aditivo","cronograma","RDO"],
        },
        {
          service: "Transparência / Gastos",
          keywords: ["empenho","liquidação","pagamento","dotação","fonte","favorecido","SIAFI","portal"],
        },
        {
          service: "Fiscalização",
          keywords: ["auto","infração","vistoria","prazo","notificação","reincidência","penalidade"],
        },
      ],
    },
    {
      domain: "Recursos Humanos",
      services: [
        {
          service: "Ponto / Escala",
          keywords: ["escala","turno","ponto","presença","falta","atraso","folga","banco de horas"],
        },
        {
          service: "Recrutamento",
          keywords: ["vaga","candidato","currículo","entrevista","triagem","aprovado","reprovado"],
        },
        {
          service: "Treinamento",
          keywords: ["curso","certificado","turma","treinamento","NR","presença","aproveitamento"],
        },
      ],
    },
  ],
};

/**
 * Flatten taxonomy into a single searchable string for AI prompts.
 */
export function taxonomyToPromptText(): string {
  const lines: string[] = [];
  for (const d of DOMAIN_TAXONOMY.domains) {
    lines.push(`\n## ${d.domain}`);
    for (const s of d.services) {
      lines.push(`  - ${s.service}: ${s.keywords.join(", ")}`);
    }
  }
  return lines.join("\n");
}
