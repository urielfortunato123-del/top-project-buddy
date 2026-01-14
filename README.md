# Dashboard RDA - Controle de Entregas

Sistema de controle de entregas offline desenvolvido em React + TypeScript. Importa planilhas Excel e gera dashboards interativos com gráficos, KPIs e exportação.

---

## 🎯 Objetivo do Projeto

Aplicação web que permite:
1. **Importar** planilhas Excel com dados de controle de entregas (RDA)
2. **Visualizar** dashboards com KPIs, gráficos e matriz pessoa × dia
3. **Filtrar** por equipe, pessoa, status e período
4. **Exportar** para PDF e Excel com formatação profissional

---

## 🛠️ Stack Tecnológica

| Tecnologia | Versão | Uso |
|------------|--------|-----|
| React | 18.3.1 | Framework UI |
| TypeScript | - | Tipagem estática |
| Vite | 5.x | Build tool |
| Tailwind CSS | 3.x | Estilização |
| Recharts | 2.15.4 | Gráficos |
| SheetJS (xlsx) | 0.18.5 | Parser de Excel |
| xlsx-js-style | 1.2.0 | Excel com estilos |
| jsPDF | 4.0.0 | Geração de PDF |
| html2canvas | 1.4.1 | Screenshot para PDF |
| idb-keyval | 6.2.2 | Storage local (IndexedDB) |
| date-fns | 3.6.0 | Manipulação de datas |
| shadcn/ui | - | Componentes UI |

---

## 📁 Estrutura do Projeto

```
src/
├── components/
│   ├── dashboard/
│   │   ├── Charts.tsx          # Gráficos (Line, Bar, Pie, Progress Ring)
│   │   ├── DashboardView.tsx   # Tela principal do dashboard
│   │   ├── KPICard.tsx         # Cards de indicadores
│   │   ├── KPIDetailModal.tsx  # Modal com detalhes dos KPIs
│   │   ├── MatrixTable.tsx     # Tabela matriz pessoa × dia
│   │   ├── Sidebar.tsx         # Barra lateral com filtros
│   │   └── SpreadsheetView.tsx # Visão tabular dos dados
│   └── ui/                     # Componentes shadcn/ui
├── hooks/
│   └── useDatasets.ts          # Hook para gerenciar datasets
├── lib/
│   ├── database.ts             # Storage com IndexedDB
│   ├── excelParser.ts          # Parser de Excel para Dataset
│   ├── excelExport.ts          # ⚠️ EXPORTAÇÃO EXCEL (PRECISA AJUDA)
│   ├── pdfExport.ts            # Exportação PDF
│   ├── htmlExport.ts           # Exportação HTML
│   └── utils.ts                # Utilitários gerais
├── pages/
│   └── Index.tsx               # Página principal
└── main.tsx                    # Entry point
```

---

## 📊 Modelo de Dados

### Interface `Dataset`
```typescript
interface Dataset {
  id: string;                    // ID único gerado
  name: string;                  // Nome do arquivo
  createdAt: string;             // Data criação (ISO)
  updatedAt: string;             // Data atualização (ISO)
  rawGrid: any[][];              // Grid original do Excel
  rows: DatasetRow[];            // Dados normalizados
  teams: string[];               // Lista de equipes
  people: string[];              // Lista de pessoas
  statuses: string[];            // Lista de status
}
```

### Interface `DatasetRow`
```typescript
interface DatasetRow {
  date: string;    // Data no formato YYYY-MM-DD
  person: string;  // Nome do colaborador
  status: string;  // Status: ENTREGUE, FOLGA, BANCO DE HORAS, VAZIO
  team?: string;   // Equipe (opcional)
}
```

### Status Possíveis
| Status | Descrição |
|--------|-----------|
| `ENTREGUE` | RDA entregue |
| `FOLGA` | Dia de folga |
| `BANCO DE HORAS` | Compensação |
| `VAZIO` | Sem informação |
| `FALTA` | Faltou |
| `ATESTADO` | Atestado médico |
| `FÉRIAS` | Em férias |

---

## 📥 Formato do Excel de Entrada

O sistema espera planilhas Excel no seguinte formato:

```
| Linha | A (Data)   | B          | C          | D          | ...
|-------|------------|------------|------------|------------|----
| 1     | TITULO     | ...        | ...        | ...        |
| 2     | (vazio)    | EQUIPE CAMPO | EQUIPE CAMPO | EQUIPE ESCRITORIO |
| 3     | DATA       | João Silva | Maria      | Pedro      |
| 4     | 01/01/2026 | ENTREGUE   | FOLGA      | ENTREGUE   |
| 5     | 02/01/2026 | ENTREGUE   | ENTREGUE   | BANCO      |
| ...   | ...        | ...        | ...        | ...        |
```

**Regras de Parser (`excelParser.ts`):**
- **Linha 2**: Headers de equipe (detecta "EQUIPE")
- **Linha 3**: Nomes dos colaboradores
- **Linha 4+**: Dados (coluna A = data, demais = status)

---

## 📤 Exportação Excel Atual

### Arquivo: `src/lib/excelExport.ts`

Atualmente gera 7 abas:
1. **Matriz** - Pessoa × Dia com chips (ENT/FOL/BAN/-)
2. **KPIs** - Indicadores principais
3. **Ranking** - Colaboradores ordenados por entrega
4. **Equipes** - Análise por equipe
5. **Por Dia** - Evolução diária
6. **Dados** - Registros completos
7. **PowerBI** - Formato flat para Pivot

### ⚠️ PROBLEMA ATUAL

O usuário precisa de **formatação condicional RGB real** nas células do Excel, similar ao que faria no Power BI:

**Requisitos não atendidos:**
1. ❌ Cores RGB aplicadas corretamente nas células (verde para ENTREGUE, azul para FOLGA, etc.)
2. ❌ Formatação condicional dinâmica baseada em valores
3. ❌ Gráficos embutidos no Excel (barras, pizza)
4. ❌ Tabelas dinâmicas pré-configuradas
5. ❌ Compatibilidade total com Power BI

**Tentativa atual:**
- Usa biblioteca `xlsx-js-style` para aplicar estilos
- Cores definidas em objeto `COLORS` com valores hex
- Funções `createStyle()`, `getStatusStyle()`, `getEvaluationStyle()`
- Aplica estilos célula a célula com `applyCellStyle()`

**Erro de build:**
```
Assets exceeding the limit:
- assets/index-CFaIROXZ.js is 2.79 MB
```
A biblioteca `xlsx-js-style` é muito pesada e causa erro no PWA.

---

## 🎨 Sistema de Cores

### Paleta de Status
```typescript
const COLORS = {
  ENTREGUE: { bg: "22C55E", fg: "FFFFFF" },     // Verde
  FOLGA: { bg: "3B82F6", fg: "FFFFFF" },        // Azul  
  BANCO: { bg: "F59E0B", fg: "000000" },        // Âmbar
  VAZIO: { bg: "EF4444", fg: "FFFFFF" },        // Vermelho
  HEADER: { bg: "1E293B", fg: "FFFFFF" },       // Slate escuro
  TITLE: { bg: "0F172A", fg: "FFFFFF" },        // Slate mais escuro
};
```

### Paleta de Avaliação (baseado em %)
```typescript
const EVALUATION = {
  EXCELLENT: { bg: "16A34A", fg: "FFFFFF" },  // >= 80%
  GOOD: { bg: "2563EB", fg: "FFFFFF" },       // >= 60%
  REGULAR: { bg: "D97706", fg: "FFFFFF" },    // >= 40%
  CRITICAL: { bg: "DC2626", fg: "FFFFFF" },   // < 40%
};
```

---

## 🔧 O que precisa ser feito

### 1. Corrigir Exportação Excel com Cores

**Objetivo:** Gerar Excel `.xlsx` com:
- Células coloridas RGB baseado no status
- Headers com estilo (negrito, cor de fundo)
- Formatação condicional para taxa de entrega

**Opções:**
- Usar `xlsx-js-style` corretamente (verificar sintaxe)
- Usar ExcelJS (mais completo mas maior)
- Gerar via template `.xltx`
- Criar API backend para gerar Excel (requer Supabase)

### 2. Adicionar Gráficos ao Excel (Opcional)

A biblioteca `xlsx` padrão não suporta criação de gráficos. Alternativas:
- Usar ExcelJS com charts
- Gerar template com gráficos pré-vinculados
- Criar Excel via backend (Python openpyxl, C# EPPlus)

### 3. Compatibilidade Power BI

A aba "PowerBI" já exporta dados flat. Para melhorar:
- Adicionar metadados de tipo de dados
- Formatar datas como ISO
- Criar relacionamentos sugeridos

---

## 🚀 Como Executar Localmente

```bash
# Instalar dependências
npm install

# Rodar em desenvolvimento
npm run dev

# Build de produção
npm run build

# Preview do build
npm run preview
```

---

## 🧪 Como Testar a Exportação

1. Acesse a aplicação
2. Importe um Excel de controle de entregas
3. Clique em "Exportar Excel"
4. Abra o arquivo `.xlsx` gerado
5. Verifique as abas e formatação

---

## 📋 Arquivos Importantes para Edição

| Arquivo | Função |
|---------|--------|
| `src/lib/excelExport.ts` | **PRINCIPAL** - Lógica de exportação Excel |
| `src/lib/excelParser.ts` | Parser de Excel para Dataset |
| `src/lib/database.ts` | Interfaces e storage |
| `src/components/dashboard/DashboardView.tsx` | Botões de exportação |
| `vite.config.ts` | Config do PWA (limite de cache) |

---

## 🐛 Erros Conhecidos

### 1. Bundle muito grande
```
Assets exceeding the limit: 2.79 MB
```
**Causa:** `xlsx-js-style` é pesado
**Solução:** Usar dynamic import ou remover lib

### 2. Stack overflow no build
```
runtime: goroutine stack exceeds 1000000000-byte limit
```
**Causa:** Erro do TypeScript checker (temporário)
**Solução:** Geralmente resolve ao rebuildar

---

## 🔗 Links Úteis

- **Lovable Docs**: https://docs.lovable.dev
- **xlsx-js-style**: https://github.com/gitbrent/xlsx-js-style
- **ExcelJS** (alternativa): https://github.com/exceljs/exceljs
- **Recharts**: https://recharts.org

---

## 📄 Como Editar o Código

### Via Lovable (recomendado)
Acesse o projeto no Lovable e use o chat para fazer alterações.

### Via IDE Local
```bash
git clone <URL_DO_REPO>
cd <NOME_DO_PROJETO>
npm install
npm run dev
```

### Via GitHub Codespaces
Clique em "Code" > "Codespaces" > "New codespace"

---

## 📞 Suporte

Para funcionalidades avançadas de Excel (gráficos embutidos, VBA, templates complexos), pode ser necessário:
- Desenvolvedor especializado em OpenXML/Excel
- Backend em Python (openpyxl) ou C# (EPPlus) para geração server-side

---

## 📄 Licença

Projeto privado. Todos os direitos reservados.
