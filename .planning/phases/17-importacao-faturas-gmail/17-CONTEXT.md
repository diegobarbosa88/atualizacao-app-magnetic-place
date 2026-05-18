# Phase 17: Importação Automática de Faturas via Gmail - Context

**Gathered:** 2026-05-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Criar um módulo Node.js que expõe um endpoint REST. Quando chamado pelo admin (via botão no painel), conecta à Gmail API usando uma Service Account, pesquisa emails não lidos com anexos de fatura (PDF/XML), descarrega os anexos, guarda-os no Supabase Storage (bucket `faturas`) e marca os emails como lidos.

</domain>

<decisions>
## Implementation Decisions

### Execução e Trigger
- **D-01:** O módulo é acionado por um **endpoint REST manual** — não há cron job automático. O admin clica "Importar Faturas do Gmail" no painel e o endpoint é chamado.
- **D-02:** O endpoint responde com um resumo: quantos emails processados, quantos ficheiros guardados, erros parciais.

### Autenticação
- **D-03:** Autenticação **server-to-server** via Google Cloud Service Account (`GoogleAuth` do pacote `googleapis`).
- **D-04:** Scope obrigatório: `https://www.googleapis.com/auth/gmail.modify`.
- **D-05:** O ficheiro de credenciais `credentials.json` deve estar no `.gitignore` e ser referenciado por variável de ambiente.

### Pesquisa de Emails
- **D-06:** Query: `is:unread has:attachment {subject:fatura subject:invoice subject:FT}`.
- **D-07:** Chamar `gmail.users.messages.list` com a query, iterar resultados com `gmail.users.messages.get` para aceder ao payload completo.

### Download de Anexos
- **D-08:** Filtrar partes com `mimeType` `application/pdf` ou `application/xml` para obter `attachmentId`.
- **D-09:** Descarregar via `gmail.users.messages.attachments.get` e converter a string **Base64Url** devolvida para `Buffer` nativo Node.js usando `Buffer.from(data, 'base64url')`.

### Armazenamento
- **D-10:** Guardar os ficheiros no **Supabase Storage**, bucket `faturas`, com path `faturas/{messageId}/{filename}`.
- **D-11:** Registar a URL pública de cada ficheiro (para acesso no painel admin).

### Gestão de Erros (fail-partial)
- **D-12:** Se um anexo falhar (erro de rede, timeout), continuar com os restantes anexos do mesmo email e com os outros emails.
- **D-13:** O email **é marcado como lido** mesmo com falhas parciais. Os erros são devolvidos no response da API para o admin ver.
- **D-14:** Cada download de anexo deve ter o seu próprio `try/catch` para garantir isolamento de falhas.

### Marcar como Lido
- **D-15:** Após processar todos os anexos de um email, chamar `gmail.users.messages.modify` com `{ removeLabelIds: ['UNREAD'] }`.
- **D-16:** Objetivo: garantir que o email não é reprocessado em execuções futuras.

### UI
- **D-17:** Adicionar botão **"Importar Faturas do Gmail"** na tab `Documentos` do painel admin (componente `DocumentsAdmin.jsx`).
- **D-18:** O botão mostra estado de loading durante a operação e exibe o resultado (N emails, N ficheiros, erros).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Projeto — Infra Existente
- `.planning/ROADMAP.md` §Phase 17 — Goal, requirements, success criteria
- `.planning/REQUIREMENTS.md` — Requisitos gerais do projeto
- `src/utils/separarRecibosTOConline.js` — Padrão de upload ao Supabase Storage (`documentos` bucket) — reutilizar lógica de `upload` + `getPublicUrl`

### Supabase Storage (padrão existente)
- `src/utils/separarRecibosTOConline.js` — Função `associarDocumentoAoTrabalhador` mostra o padrão: upload com `upsert: true`, `getPublicUrl`, inserção em tabela `documents`

### UI — Tab Documentos
- `src/features/admin/DocumentsAdmin.jsx` — Componente a modificar para adicionar o botão de import

### Segurança
- `.gitignore` — Garantir que `credentials.json` está excluído

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `window.supabaseInstance` (via AppContext): cliente Supabase já autenticado — usar para upload ao Storage e inserção na BD
- `src/utils/separarRecibosTOConline.js → associarDocumentoAoTrabalhador`: padrão de upload PDF + `getPublicUrl` + insert em `documents` — adaptar para faturas

### Established Patterns
- Upload ao Storage: `supabase.storage.from('bucket').upload(path, blob, { upsert: true })` → `getPublicUrl`
- Inserção em BD: `supabase.from('documents').insert({...})` com campos `id`, `tipo`, `nomeFicheiro`, `url`, `status`, `dataEmissao`
- Error handling: `try/catch` por operação, erro logado mas execução continua (padrão já usado em `handleGuardarNoPortal`)

### Integration Points
- Novo endpoint REST (ex: `/api/gmail/import-faturas`) — a definir onde vive na arquitectura (Supabase Edge Function vs servidor Node.js separado)
- `DocumentsAdmin.jsx` → botão "Importar Faturas do Gmail" → chama o endpoint → mostra resultado

</code_context>

<specifics>
## Specific Ideas

- Query Gmail: `is:unread has:attachment {subject:fatura subject:invoice subject:FT}` — configurável
- Base64Url → Buffer: `Buffer.from(attachmentData.data, 'base64url')`
- Path no Storage: `faturas/{messageId}/{filename}`
- Resposta do endpoint: `{ processados: N, ficheiros: N, erros: [...] }`

</specifics>

<deferred>
## Deferred Ideas

- Processamento automático/OCR das faturas após download — fase posterior
- Scheduler automático (cron) — o trigger manual cobre o MVP; automação pode ser Phase 18
- Filtros avançados por remetente ou data na query Gmail

</deferred>

---

*Phase: 17-importacao-faturas-gmail*
*Context gathered: 2026-05-18*
