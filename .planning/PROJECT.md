# app-magnetic

## What This Is

Sistema de gestão de horas e relatórios para profissionais freelancers e empresas, com portais diferenciados para administrador e clientes. O administrador gere trabalhadores, clientes e relatórios; os clientes recebem, visualizam e reportam divergências nos relatórios mensais.

## Core Value

Profissionais podem dedicar mais tempo ao trabalho billable porque a gestão de horas, geração de relatórios e comunicação com clientes é automatizada e sem atritos.

## Requirements

### Validated

- ✓ Registo de horas por cliente/unidade — existente
- ✓ Geração de relatórios PDF — existente
- ✓ Portal de cliente com visualização de relatórios — existente
- ✓ Notificações por email ao cliente — existente
- ✓ Assinaturas digitais — existente
- ✓ Atualizações realtime via Supabase — existente

### Active

- [ ] Mover secrets de API para environment variables (VITE_*)
- [ ] Corrigir error handling em handleAiPolish (try/catch/finally)
- [ ] Corrigir race condition em Supabase subscription (dependency array)
- [ ] Adicionar validação NaN em reduce operations
- [ ] Melhorar mensagens de erro (específicas por tipo)
- [ ] Adicionar validação de input em filtros de base de dados

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
- API keys hardcoded no código cliente (app.jsx)
- Error handling inconsistente em operações assíncronas
- Mensagens de erro genéricas que ocultam causa raiz

## Constraints

- **Segurança**: Keys de API nunca devem estar no código cliente
- **Performance**: Operações de reduce devem lidar com valores inválidos
- **UX**: Mensagens de erro devem ser específicas e acionáveis

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Supabase para realtime | Necessário para atualização instantânea entre admin e portais | — Pending |
| Environment variables VITE_* | Padrão Vite para variáveis expostas ao cliente | — Pending |
| Mensagens de erro específicas | Melhor UX e debugging mais rápido | — Pending |

---
*Last updated: 2026-05-05 after initial analysis*
