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
*Last updated: 2026-05-06 - Modularization Refactor Start*

