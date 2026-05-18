# app-magnetic

## What This Is

Sistema de gestão de horas e relatórios para profissionais freelancers e empresas, com portais diferenciados para administrador e clientes. O administrador gere trabalhadores, clientes e relatórios; os clientes recebem, visualizam e reportam divergências nos relatórios mensais.

## Core Value

Modularidade e escalabilidade: a gestão de horas e relatórios é automatizada, com uma arquitetura limpa e sustentável que permite o crescimento rápido de novas funcionalidades sem a dívida técnica de um monolito.

## Requirements

### Validated

- ✓ Registo de horas por cliente/unidade — existente
- ✓ Geração de relatórios PDF — existente
- ✓ Portal de cliente com visualização de relatórios — existente
- ✓ Notificações por email ao cliente — existente
- ✓ Assinaturas digitais — existente
- ✓ Atualizações realtime via Supabase — existente
- ✓ Variáveis de ambiente VITE_* — implementado
- ✓ Error handling robusto — implementado

### Active (Refactoring Milestone)

- [ ] Implementar sistema de gerenciamento de estado (Context API)
- [ ] Extrair componentes utilitários e funções auxiliares para `/src/utils` e `/src/components/common`
- [ ] Modularizar funcionalidades do Admin para `/src/features/admin`
  - Geral, Equipa, Clientes, Portal Validação, Horários, Despesas, Relatórios, Documentos, Notificações, Envios Clientes, Validação Equipa, Correções, Links
- [ ] Modularizar funcionalidades do Worker para `/src/features/worker`
- [ ] Reduzir `app.jsx` a um roteador leve e provedor de contexto

## Current Milestone: v3.0 — Automação de Documentos Contratuais

**Goal:** Criar um sistema de editor de blocos JSON para templates de documentos contratuais, com viewer responsivo e geração de PDF matematicamente perfeita via pdfmake.

**Target features:**
- Editor de blocos JSON (Gestor/HR) — adicionar, remover, reordenar blocos de texto com suporte a variáveis dinâmicas `{{variavel}}`
- Viewer responsivo (Trabalhador) — renderizar HTML de leitura, substituir variáveis com dados reais, botão "Assinar Digitalmente"
- Motor PDF com pdfmake — mapeamento direto de JSON para docDefinition (NÃO HTML→PDF), bloco signature com `unbreakable: true`, margens 50mm esq/dir, 60mm cima/baixo, numeração de página no rodapé

## Requirements

### Active (v3.0 — Automação de Documentos)

- [ ] Sistema de editor de blocos JSON para templates contratuais
- [ ] Viewer responsivo com substituição de variáveis `{{variavel}}`
- [ ] Assinatura digital do trabalhador
- [ ] Motor PDF com pdfmake (não HTML→PDF)
- [ ] Quebras de página perfeitas (bloco signature unbreakable)

### Out of Scope

- Funcionalidades de pagamento/faturação — não faz parte do scope atual
- Aplicação móvel — web-first, mobile later
- Integração com mais serviços de email para além do EmailJS

## Context

**Stack atual:**
- Frontend: React 19 + Vite
- Backend: Supabase (PostgreSQL + Realtime)
- Email: EmailJS
- AI: Google Gemini (polimento de descrições)
- PDF: jsPDF + html2canvas
- Assinaturas: react-signature-canvas
- Deploy: Vercel

**Problemas conhecidos:**
- `app.jsx` monolítico (+5000 linhas)
- Estado concentrado num único componente, causando re-renders desnecessários
- Dificuldade de manutenção e teste de funcionalidades individuais

## Constraints

- **Arquitetura**: Seguir padrão de domínios/funcionalidades
- **Estado**: Usar Context API para estado compartilhado
- **Estilo**: Manter Vanilla CSS (App.css) e estética premium atual

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Context API | Simplicidade e integração nativa para o tamanho atual | — In Progress |
| Modularização por Domínio | Melhora a organização e facilita o trabalho paralelo | — Planned |
| Separação de Lógica (Hooks) | Isolar chamadas de API e lógica de negócio da UI | — Planned |

---

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---

*Last updated: 2026-05-12 after v3.0 milestone start*

