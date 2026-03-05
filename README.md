# 📊 Essencial - Dashboard Inteligente de Controle de Entregas

**Sistema web completo para importação, visualização e análise de planilhas Excel/CSV com dashboards interativos, inteligência artificial e exportação profissional.**

> Desenvolvido por **Uriel da Fonseca Fortunato**

---

## 🎯 O que o sistema faz

O **Essencial** é uma aplicação web (PWA) que transforma planilhas Excel e CSV em dashboards interativos com análise de dados automatizada por IA. O sistema é focado em **controle de entregas (RDA)**, mas funciona com **qualquer tipo de planilha**.

### Fluxo principal:
1. **Importar** → Faça upload de qualquer arquivo `.xlsx`, `.xls` ou `.csv`
2. **Analisar** → O sistema detecta automaticamente o tipo de dados e gera dashboards
3. **Interagir** → Filtre por equipe, pessoa, status e período
4. **Perguntar** → Use o chatbot IA para fazer perguntas sobre os dados
5. **Exportar** → Gere relatórios em Excel, PDF ou HTML interativo

---

## ✨ Funcionalidades Completas

### 📥 Importação Inteligente de Dados
- Suporta **Excel (.xlsx/.xls)** e **CSV**
- **Detecção automática de formato**: identifica se a planilha é uma tabela simples ou uma matriz RDA (pessoa × dia)
- **Parser de matriz RDA**: converte planilhas no formato equipe/pessoa/data em dados normalizados
- **Forward-fill de equipes**: preenche automaticamente o campo de equipe quando está mesclado
- **Normalização de datas**: aceita formatos `dd/MM/yyyy`, `yyyy-MM-dd` e seriais do Excel
- **Detecção de tipos de colunas**: classifica colunas como `date`, `number`, `category`, `text` ou `id`
- **Diálogo de formato**: permite escolher entre importação automática, tabela longa ou matriz
- **Armazenamento local via IndexedDB**: dados persistem entre sessões sem necessidade de backend

### 📊 Dashboard com KPIs Dinâmicos
- **KPIs específicos para RDA**: Taxa de Entrega, Total Entregue, Pendências, Folgas, Banco de Horas, Pessoas
- **KPIs genéricos**: Total de registros, somas/médias numéricas, distribuição de categorias, período
- **Cards clicáveis**: ao clicar em um KPI, abre modal com lista detalhada (ex: nomes dos colaboradores)
- **Avaliação automática**: classifica colaboradores como Excelente (≥80%), Bom (≥60%), Regular (≥40%), Crítico (<40%)
- **Cores semânticas**: verde para sucesso, âmbar para atenção, vermelho para crítico

### 📈 Gráficos Interativos (Recharts)
- **Gráfico de Linha/Área**: evolução temporal (entregas por dia ou registros por período)
- **Gráfico de Pizza**: distribuição por status ou categoria principal
- **Gráfico de Barras Horizontal**: ranking de colaboradores por entregas
- **Gráfico de Barras Vertical**: análise por equipe
- **Progress Ring (SVG)**: visualização circular da taxa de entrega
- **Tooltips interativos** e **responsividade** em todos os gráficos

### 🔍 Filtros Avançados
- **Filtro por Equipe**: dropdown com todas as equipes detectadas
- **Filtro por Pessoa**: dropdown com todos os colaboradores
- **Filtro por Status**: dropdown com todos os status encontrados
- **Filtro por Período**: calendário com seleção de intervalo de datas (date range picker)
- **Detecção inteligente de colunas**: o sistema identifica automaticamente qual coluna é pessoa, status, equipe e data
- **Contador de registros** atualizado em tempo real conforme filtros são aplicados
- **Botão "Limpar Filtros"** para resetar todos os filtros de uma vez

### 🗂️ Tabela Matriz (Pessoa × Dia)
- **Visualização cruzada**: linhas = pessoas, colunas = datas, células = status
- **Chips coloridos**: ENT (verde), FOL (azul), BAN (âmbar), FAL (vermelho), ATE (roxo), FER (ciano)
- **Colunas configuráveis**: dropdowns para trocar qual coluna vira linha, coluna e valor
- **Persistência de configuração**: a escolha de colunas é salva no dataset
- **Scroll sincronizado**: cabeçalhos fixos com scroll horizontal e vertical
- **Tooltips** ao passar o mouse sobre cada célula

### 📋 Tabela de Detalhes
- **Lista tabular** com data, pessoa, equipe e status
- **Ordenação** e visualização rápida dos registros filtrados

### 📝 Planilha Editável (SpreadsheetView)
- **Edição inline**: clique duplo em qualquer célula para editar
- **Adicionar/remover linhas e colunas**
- **Copiar células** (Ctrl+C)
- **Filtros por coluna**: busca por conteúdo (contains/equals) em cada coluna
- **Referência estilo Excel**: colunas nomeadas como A, B, C... e linhas numeradas
- **Salvamento automático**: alterações são persistidas no IndexedDB
- **Undo** para desfazer a última alteração

### 🤖 Inteligência Artificial (3 funcionalidades)

#### 1. Chatbot IA (Botão ✨)
- **Botão flutuante** no canto inferior direito
- **Streaming de respostas** (SSE - Server-Sent Events): texto aparece token por token em tempo real
- **Renderização Markdown**: tabelas, listas, negrito, código etc.
- **Contexto dos dados**: envia amostra dos dados, estatísticas e metadados para a IA
- **Sugestões rápidas**: "Faça um resumo dos dados", "Qual a taxa de entrega?", "Quem mais entregou?"
- **Limpar conversa**: botão para resetar o histórico
- **Responsivo**: tela cheia no mobile, painel fixo no desktop

#### 2. Resumo Automático (AutoSummary)
- **Gerado automaticamente** ao importar uma planilha
- **Resumo executivo** com bullet points: visão geral, métricas, destaques
- **Regenerar**: botão para gerar novo resumo
- **Fechar**: pode ser dispensado pelo usuário
- **Modo não-streaming**: usa chamada síncrona para obter o resumo completo

#### 3. Análise Preditiva (PredictiveAnalysis)
- **Gráfico de tendência**: mostra dados reais + previsão futura (linha tracejada)
- **Gradientes**: áreas preenchidas com gradiente para dados reais e previstos
- **Indicador de tendência**: ↑ Alta, ↓ Queda, → Estável com cor semântica
- **Confiança**: percentual de confiança da previsão
- **Insights**: 3-5 frases curtas sobre tendências detectadas
- **Regenerar**: botão para nova análise

### 📤 Exportação de Relatórios

#### Excel (.xlsx) - 7 abas
1. **Matriz**: Pessoa × Dia com chips (✓ ENT, ◆ FOL, ● BAN, ✗ FAL, ⬢ ATE, ★ FER)
2. **KPIs**: Dashboard executivo com indicadores e filtros aplicados
3. **Ranking**: Colaboradores ordenados por entregas com avaliação
4. **Equipes**: Análise por equipe com taxa de entrega
5. **Evolução**: Dados diários para criação de gráficos no Excel
6. **Dados**: Registros brutos completos
7. **Resumo**: Estatísticas consolidadas e distribuição por status

#### PDF
- Captura do dashboard inteiro via html2canvas
- Formatação A4 paisagem com margens

#### HTML Interativo
- Arquivo HTML standalone com CSS embutido
- Dashboard completo com gráficos renderizados
- Pode ser aberto em qualquer navegador sem internet

### 🎨 Interface e Design
- **Tema claro/escuro**: toggle no rodapé da sidebar
- **Design system**: tokens semânticos CSS (HSL) via Tailwind
- **Sidebar retrátil**: menu lateral com logo, importação, datasets e filtros
- **Layout responsivo**: mobile (sidebar overlay), tablet (sem painel lateral), desktop (layout 3 colunas)
- **PWA (Progressive Web App)**: funciona offline, instalável
- **Splash screen**: tela de carregamento inicial
- **Animações suaves**: fade-in, hover effects, transições

### 💾 Persistência de Dados
- **IndexedDB** via `idb-keyval` (sem backend necessário para dados)
- **Múltiplos datasets**: importar e alternar entre vários arquivos
- **Delete**: remover datasets individualmente
- **Dataset atual**: memoriza qual dataset estava selecionado

---

## 🛠️ Stack Tecnológica

| Tecnologia | Uso |
|---|---|
| **React 18** | Framework UI com hooks |
| **TypeScript** | Tipagem estática |
| **Vite** | Build tool + HMR |
| **Tailwind CSS** | Estilização com tokens semânticos |
| **shadcn/ui** | Componentes UI (Dialog, Select, Popover, Calendar, Tabs...) |
| **Recharts** | Gráficos (Line, Bar, Pie, Area) |
| **SheetJS (xlsx)** | Parser e exportação de Excel |
| **jsPDF + html2canvas** | Exportação PDF |
| **idb-keyval** | Persistência local (IndexedDB) |
| **date-fns** | Manipulação de datas (pt-BR) |
| **react-markdown** | Renderização de Markdown no chat |
| **Lovable Cloud** | Backend functions (Edge Functions para IA) |
| **Google Gemini 2.0 Flash** | Modelo de IA para chat, resumo e análise preditiva |
| **vite-plugin-pwa** | Service Worker para modo offline |
| **Lucide React** | Ícones |

---

## 📁 Estrutura do Projeto

```
src/
├── pages/
│   ├── Index.tsx                  # Página principal (layout, filtros, detecção de colunas)
│   └── NotFound.tsx               # Página 404
│
├── components/
│   ├── dashboard/
│   │   ├── DashboardView.tsx      # Dashboard com KPIs + gráficos + análise preditiva
│   │   ├── Charts.tsx             # Componentes de gráficos (Line, Bar, Pie, ProgressRing)
│   │   ├── KPICard.tsx            # Card de indicador individual
│   │   ├── KPIDetailModal.tsx     # Modal com lista detalhada ao clicar no KPI
│   │   ├── MatrixTable.tsx        # Tabela matriz pessoa × dia (configurável)
│   │   ├── DetailTable.tsx        # Tabela de detalhes (lista de registros)
│   │   ├── SpreadsheetView.tsx    # Planilha editável estilo Excel
│   │   ├── Sidebar.tsx            # Barra lateral (logo, import, datasets, filtros)
│   │   ├── ViewTabs.tsx           # Tabs: Dashboard / Planilha
│   │   ├── DatasetSelect.tsx      # Dropdown de seleção de dataset
│   │   ├── ImportFormatDialog.tsx # Dialog de escolha de formato de importação
│   │   ├── AIChatbot.tsx          # Chatbot IA com streaming SSE
│   │   ├── AutoSummary.tsx        # Resumo automático IA ao importar
│   │   └── PredictiveAnalysis.tsx # Análise preditiva com gráfico de tendência
│   │
│   ├── ui/                        # Componentes shadcn/ui (40+ componentes)
│   ├── NavLink.tsx                # Link de navegação
│   ├── SplashScreen.tsx           # Tela de splash
│   └── ThemeToggle.tsx            # Toggle tema claro/escuro
│
├── hooks/
│   ├── useDatasets.ts             # Hook para gerenciar datasets (CRUD + importação)
│   ├── use-mobile.tsx             # Detecção de viewport mobile
│   └── use-toast.ts              # Hook de notificações toast
│
├── lib/
│   ├── database.ts                # Interfaces (Dataset, GenericRow, ColumnMetadata) + IndexedDB
│   ├── excelParser.ts             # Parser inteligente de Excel (auto-detecta RDA vs tabela)
│   ├── excelExport.ts             # Exportação Excel com 7 abas
│   ├── pdfExport.ts               # Exportação PDF via html2canvas + jsPDF
│   ├── htmlExport.ts              # Exportação HTML interativo standalone
│   ├── reportExport.ts            # Utilitários de exportação
│   ├── dateRange.ts               # Tipo DateRange
│   └── utils.ts                   # Utilitários gerais (cn, etc.)
│
├── integrations/supabase/
│   ├── client.ts                  # Cliente Supabase (auto-gerado)
│   └── types.ts                   # Tipos do banco (auto-gerado)
│
└── assets/
    └── logo-essencial.png         # Logo da aplicação

supabase/
├── config.toml                    # Configuração do projeto Supabase
└── functions/
    └── ai-chat/
        └── index.ts               # Edge Function: proxy para Google Gemini API
                                   #   - Modo streaming (SSE) para chatbot
                                   #   - Modo síncrono para resumo/preditiva

public/
├── logo-essencial-small.png       # Logo sidebar
├── icon-192.png / icon-512.png    # Ícones PWA
├── favicon.ico                    # Favicon
└── robots.txt                     # SEO
```

---

## 📊 Modelo de Dados

### Dataset (Interface principal)
```typescript
interface Dataset {
  id: string;                        // ID único (ds_timestamp_random)
  name: string;                      // Nome do arquivo (sem extensão)
  createdAt: string;                 // ISO datetime
  updatedAt: string;                 // ISO datetime
  rawGrid: any[][];                  // Grid original do Excel
  columns: ColumnMetadata[];         // Metadados de cada coluna
  rows: GenericRow[];                // Dados normalizados
  detectedDateColumn?: string;       // Coluna de data detectada
  detectedCategoryColumns: string[]; // Colunas categóricas
  detectedNumericColumns: string[];  // Colunas numéricas
  detectedTextColumns: string[];     // Colunas de texto/id
  totalRows: number;                 // Total de linhas
  summary: DatasetSummary;           // Estatísticas calculadas
  matrixConfig?: MatrixConfig;       // Configuração da visualização matriz
}
```

### ColumnMetadata
```typescript
interface ColumnMetadata {
  name: string;           // Nome da coluna
  originalIndex: number;  // Índice original no Excel
  type: ColumnType;       // "date" | "number" | "category" | "text" | "id"
  uniqueValues: string[]; // Até 100 valores únicos
  sampleValues: any[];    // 10 primeiros valores
  isNumeric: boolean;
  isDate: boolean;
  isEmpty: boolean;
}
```

### GenericRow
```typescript
interface GenericRow {
  [key: string]: any;    // Valores dinâmicos baseados nas colunas
  _rowIndex: number;     // Índice da linha para referência
}
```

---

## 📥 Formato de Planilha RDA (Matriz)

O sistema detecta automaticamente planilhas no formato de controle de entregas:

```
|       | A (Data)   | B          | C          | D          |
|-------|------------|------------|------------|------------|
| Linha 2 | (equipe) | EQUIPE CAMPO | EQUIPE CAMPO | EQUIPE ESC |
| Linha 3 | DATA     | João Silva | Maria      | Pedro      |
| Linha 4 | 01/01/2026 | ENTREGUE | FOLGA      | ENTREGUE   |
| Linha 5 | 02/01/2026 | ENTREGUE | ENTREGUE   | BANCO      |
```

**Detecção automática**: Linha 2 contém "EQUIPE", Linha 3 tem nomes de pessoas, Linha 4+ tem datas na coluna A.

### Status reconhecidos
| Status | Abreviação | Cor |
|---|---|---|
| ENTREGUE | ENT | 🟢 Verde |
| FOLGA | FOL | 🔵 Azul |
| BANCO DE HORAS | BAN | 🟡 Âmbar |
| FALTA | FAL | 🔴 Vermelho |
| ATESTADO | ATE | 🟣 Roxo |
| FÉRIAS | FER | 🔷 Ciano |
| VAZIO / - | - | ⚪ Cinza |

---

## 🤖 Arquitetura da IA

### Edge Function (`ai-chat`)
- **Endpoint**: `POST /functions/v1/ai-chat`
- **Modelo**: Google Gemini 2.0 Flash
- **JWT**: Desabilitado (`verify_jwt = false`)

#### Modos de operação:
1. **Streaming** (`stream: true`): Retorna SSE com tokens incrementais (`data: {"token": "..."}\n\n`)
2. **Síncrono** (`stream: false/undefined`): Retorna JSON com `{ response: "..." }`

#### Payload:
```json
{
  "messages": [{"role": "user", "content": "Pergunta"}],
  "dataContext": "Contexto dos dados...",
  "stream": true
}
```

#### Contexto enviado:
- Nome do dataset
- Total de linhas
- Período (data min/max)
- Top 5 valores por coluna categórica
- Estatísticas numéricas (min, max, média, soma)
- Lista de colunas
- Amostra de 15-30 linhas em JSON

---

## 🚀 Como Executar

```bash
# Instalar dependências
npm install

# Rodar em desenvolvimento
npm run dev

# Build de produção
npm run build

# Preview do build
npm run preview

# Testes
npm run test
```

---

## 🧪 Como Testar

1. Acesse a aplicação no navegador
2. Clique em **"Importar Excel/CSV"** na sidebar
3. Selecione o formato (automático/tabela/matriz)
4. Aguarde o **resumo automático IA** aparecer no topo
5. Navegue entre **Dashboard** e **Planilha** nas tabs
6. Aplique filtros na sidebar (equipe, pessoa, status, período)
7. Clique no botão **✨** para abrir o chatbot IA
8. Exporte via botão de download (Excel/PDF/HTML)

---

## 📄 Licença

Projeto privado. Todos os direitos reservados.
