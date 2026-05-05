# Architecture — app-magnetic

**Mapeado:** 2026-05-05

## Overview

O app-magnetic é uma aplicação React de gestão de horas/trabalhos com foco em:
- Registo de tempo por cliente
- Geração de relatórios em PDF
- Portal de cliente para visualização
- Integração com IA (Gemini) para polimento de descrições

## Architecture Pattern

**Component-based React architecture** com:
- Single-page application (SPA)
- State management via React hooks (`useState`, `useMemo`, `useEffect`)
- Realtime updates via Supabase subscriptions

## Main Components

| Componente | Responsabilidade |
|------------|------------------|
| `src/app.jsx` | Componente principal, gestão de estado global |
| `src/ClientPortal.jsx` | Portal separado para clientes |
| `src/TestPart.jsx`, `src/TestOnly.jsx` | Placeholder test components |

## Directory Structure

```
src/
├── app.jsx              # Main app (6365+ lines)
├── ClientPortal.jsx     # Client-facing portal (1600+ lines)
├── TestPart.jsx         # Test component (unused)
├── TestOnly.jsx         # Test component (unused)
├── assets/              # Static assets
├── hooks/               # Custom React hooks
├── mocks/                # Mock data for testing
```

## Data Flow

1. **User interaction** → React state update
2. **State change** → Supabase realtime subscription triggers
3. **Database update** → Broadcast to other clients
4. **UI re-render** → Updated data displayed

## External Integrations

| Serviço | Fluxo |
|---------|-------|
| Supabase | Database + Realtime subscriptions |
| Gemini AI | AI-powered description polishing |
| EmailJS | Email notifications |
| Vercel | Deployment |

## Entry Points

| Ficheiro | Uso |
|----------|-----|
| `index.html` | Entry HTML |
| `src/main.jsx` | React mount point |
| `vite.config.js` | Build configuration |
