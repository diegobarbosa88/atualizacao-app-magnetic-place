# Phase 18: Reconciliação Bancária Automática - Context

**Gathered:** 2026-05-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Criar um módulo de Reconciliação Bancária no painel Admin que permite ao gestor fazer upload de um extrato bancário (CSV ou OFX), cruzar automaticamente as transações com as faturas e recibos pendentes da base de dados, visualizar os resultados em 3 secções, e confirmar pagamentos por linha (o que atualiza o status na BD). Os resultados de cada run ficam guardados em histórico.

</domain>

<decisions>
## Implementation Decisions

### Upload e Parsing
- **D-01:** Formatos aceites: CSV e OFX. Ficheiros PDF rejeitados com mensagem de erro explícita.
- **D-02:** Parser CSV usa **auto-detect por cabeçalho** — tenta identificar colunas por nome (`Data`, `Data Valor`, `Valor`, `Descrição`, `Débito`, `Crédito`). Se não reconhecer as colunas, mostra erro claro com as colunas detectadas para o admin perceber o problema.
- **D-03:** Output padronizado do parser: array de `Transacao[]` com campos `{ data: string (YYYY-MM-DD), descricao: string, valor: number, tipo: 'credito'|'debito' }`.

### Matching Engine
- **D-04:** **Regra 1 — Exata:** procurar faturas/recibos com `status === 'PENDENTE'` e `valor === transacao.valor` (correspondência numérica exata).
- **D-05:** **Regra 2 — Verificação por descrição:** quando existem múltiplos documentos com o mesmo valor, usar a `descricao` da transação bancária para fazer matching parcial — procurar nome do trabalhador, nome do cliente ou NIF na string de descrição (case-insensitive, substring match).
- **D-06:** Uma transação pode ter 3 estados: `matched` (1 match encontrado), `ambiguous` (múltiplos candidatos, Regra 2 não resolveu), `orphan_bank` (nenhum documento encontrado).
- **D-07:** Um documento pode ter 3 estados: `matched`, `orphan_system` (nenhuma transação encontrada), ou `pending` (aguarda nova run).

### Workflow de Confirmação
- **D-08:** A reconciliação é **não-destrutiva por defeito** — apenas *mostra* os matches, não altera a BD imediatamente.
- **D-09:** Na secção "Reconciliados com Sucesso", o admin vê um botão **"Confirmar Pagamento"** por linha. Ao clicar, o campo `status` da fatura/recibo passa de `PENDENTE` para `PAGO` na tabela `faturas`.
- **D-10:** Confirmação é individual por linha (não bulk), para o admin poder rever antes de atualizar.

### Persistência
- **D-11:** Cada import cria um registo na tabela **`reconciliation_runs`** com: `{ id, created_at, filename, transaction_count, matched_count, orphan_bank_count, orphan_system_count, transactions_json, results_json }`.
- **D-12:** O admin pode aceder ao histórico de runs anteriores (lista simples com data, ficheiro e contagens). Ao clicar num run anterior, pode rever os resultados mas **não** refazer confirmações.

### Base de Dados — Nova Tabela `faturas`
- **D-13:** Criar nova tabela `faturas` com migração Supabase: `{ id uuid, created_at timestamptz, tipo: 'fatura'|'recibo', valor numeric, data_documento date, descricao text, entidade text (nome do trabalhador/cliente/NIF), status: 'PENDENTE'|'PAGO', fonte: 'gmail'|'toc'|'manual', ficheiro_url text }`.
- **D-14:** Esta tabela serve de fonte de dados para o matching engine. É populada pelo módulo Gmail (Phase 17), integração TOConline futura, ou entrada manual pelo admin.
- **D-15:** Para MVP da Phase 18, o admin pode inserir faturas manualmente via formulário simples na view de Reconciliação.

### UI — Nova Tab "Reconciliação"
- **D-16:** Nova tab de topo no AdminDashboard (ao lado de "Documentos"), com ícone `Landmark` ou `ArrowLeftRight` do lucide-react.
- **D-17:** Layout da view:
  1. **Zona de upload** — Drag & Drop + botão "Escolher Ficheiro". Mostra nome do ficheiro selecionado e botão "Processar".
  2. **Sub-tabs de resultados** (aparecem após processamento): "Reconciliados (N)" | "Órfãos Banco (N)" | "Órfãos Sistema (N)".
  3. **Histórico** — secção colapsável abaixo com os runs anteriores.
- **D-18:** Design system consistente com o resto do painel: `rounded-2xl`, `bg-white`, `shadow-sm`, cores `indigo` para ações, `emerald` para matches, `amber` para ambíguos, `rose` para órfãos.

### Arquitetura (Vercel Serverless)
- **D-19:** Não há servidor Node.js separado. O parsing e matching correm numa **Vercel API Route** em `/api/reconciliacao/upload.js`, seguindo o mesmo padrão da Phase 17 (`/api/gmail/import-faturas`).
- **D-20:** O frontend envia o ficheiro via `FormData` para a API route. A route faz o parsing, matching, guarda o run e devolve os resultados estruturados.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Contexto do Projeto
- `.planning/ROADMAP.md` §Phase 18 — Goal, requirements, success criteria
- `.planning/phases/17-importacao-faturas-gmail/17-CONTEXT.md` — Padrão de Vercel API Route, Supabase Storage, tabela `documents` — base para Phase 18

### Padrões de Código Existentes
- `src/context/AppContext.jsx` — Como aceder ao `supabase` client e guardar dados (padrão `saveToDb`)
- `src/features/admin/AdminDashboard.jsx` — Onde adicionar a nova tab "Reconciliação" ao menu de navegação
- `src/features/admin/DocumentsAdmin.jsx` — Referência de UI para componente de upload existente (padrão visual)
- `src/utils/separarRecibosTOConline.js` — Padrão de upload Supabase Storage + insert em tabela

### Bibliotecas a Instalar
- `csv-parser` (npm) — parsing de CSVs linha a linha
- `ofx` (npm) — parsing de ficheiros OFX/QFX bancários

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `saveToDb(table, id, data)` em AppContext: padrão universal para upsert — usar para inserir em `faturas` e `reconciliation_runs`
- `AdminDashboard.jsx` nav array (`['overview', 'team', ...]`): adicionar `'reconciliacao'` ao array para criar a nova tab automaticamente
- Componente de upload em `DocumentsAdmin.jsx`: base visual para o drag & drop (adaptar, não copiar)

### Established Patterns
- **Vercel API Route**: `api/gmail/import-faturas.js` é o modelo — `export default async function handler(req, res)` com `formidable` ou `multer` para file parsing
- **Tabela `documents`**: referência de schema para a nova tabela `faturas` (campos `tipo`, `status`, `url`, `created_at`)
- **Design system**: `rounded-[2.5rem]`, `bg-indigo-600`, `text-[10px] font-black uppercase tracking-widest` — ver TeamManager.jsx como referência de layout admin

### Integration Points
- Nova tab em AdminDashboard → novo componente `ReconciliacaoAdmin.jsx` em `src/features/admin/`
- API Route `/api/reconciliacao/upload.js` → recebe CSV/OFX, parseia, corre matching contra tabela `faturas` no Supabase, guarda run em `reconciliation_runs`, devolve JSON
- Botão "Confirmar Pagamento" → chama `saveToDb('faturas', id, { status: 'PAGO' })` diretamente no frontend

</code_context>

<specifics>
## Specific Ideas

- Matching numérico: comparar `valor` com tolerância de €0.00 (exato) — sem arredondamento fuzzy
- Descrição matching: `descricao.toLowerCase().includes(entidade.toLowerCase())` — simples e eficaz
- Drag & drop: usar HTML5 nativo (`onDragOver`, `onDrop`) sem biblioteca extra — padrão já usado noutros componentes
- Ícone da tab: `Landmark` (lucide-react) — evoca banco/instituição financeira
- Formato da data no CSV português: `DD-MM-YYYY` ou `DD/MM/YYYY` — normalizar para `YYYY-MM-DD` no parser

</specifics>

<deferred>
## Deferred Ideas

- **OCR de faturas PDF** — ler valor/data automaticamente de ficheiros PDF (Phase 19+)
- **Integração direta com API bancária** (Open Banking / MB Way) — importar extratos sem upload manual
- **Reconciliação automática agendada** — cron job que cruza dados sem intervenção do admin
- **Integração TOConline estruturada** — importar recibos TOConline com metadados (valor, data, NIF) automaticamente

</deferred>

---

*Phase: 18-reconciliacao-bancaria*
*Context gathered: 2026-05-19*
