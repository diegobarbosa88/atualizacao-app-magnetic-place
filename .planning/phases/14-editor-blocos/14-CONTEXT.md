# Phase 14 Context: Editor de Blocos JSON

**Phase:** 14
**Created:** 2026-05-12
**Domain:** Editor de templates de documentos contratuais para Gestor/HR

---

## Canonical Refs

- `.planning/PROJECT.md` — project context
- `.planning/REQUIREMENTS.md` — DOCS-01 a DOCS-04 requirements
- `.planning/ROADMAP.md` — Phase 14 goal and success criteria

---

## Decisions

### Formato de Armazenamento

- **Estrutura:** Array JSON com objetos `{"type": "title"|"subtitle"|"paragraph"|"signature", "content": "...", "order": N}`
- **Não usar HTML** — o documento é guardado como JSON estruturado, não como HTML livre
- **Variáveis:** Syntax `{{variavel}}` (ex: `{{nome_trabalhador}}`, `{{empresa_nome}}`)

### Editor de Blocos

- **Interface:** Drag-and-drop para adicionar/remover/reordenar blocos
- **Tipos de bloco:**
  - `title` — título do documento
  - `subtitle` — subtítulo
  - `paragraph` — parágrafo de texto (pode conter variáveis `{{variavel}}`)
  - `signature` — bloco de assinatura (sempre no final)
- **Edição inline:** Click para editar conteúdo do bloco
- **Preview:** Botão para visualizar o documento renderizado

### Gestor/HR

- **Criar/Editar templates:** Interface completa para gerir templates
- **Variáveis dinâmicas:** Suporte a `{{variavel}}` com autocomplete das variáveis disponíveis
- **Ordenação:** Drag handles para reordenar blocos
- **Exportar JSON:** Botão para exportar template como JSON limpo

### Stack Técnico

- **Frontend:** React (já no projeto)
- **Estilização:** Tailwind CSS (já no projeto)
- **Ícones:** lucide-react (já no projeto)
- **Base de dados:** Supabase (já no projeto)
- **NÃO usar:** html2canvas, jsPDF (será substituído por pdfmake na Phase 16)

### UI/UX

- **Mobile:** Responsive, funciona em telemóveis
- **Layout:** Cards para cada bloco, drag handles visíveis
- **Feedback:** Animações suaves ao reorderar blocos

---

## Deferred Ideas

- Assinatura digital qualificada (eIDAS) — fase futura
- Lógica condicional complexa nos templates — fase futura

---

## Pending Questions

Nenhuma — todas as decisões foram capturadas diretamente do utilizador.