# Requirements: Modularização e Gestão de Estado

Este documento detalha os requisitos para a refatoração do `app-magnetic` de um monolito para uma arquitetura modular baseada em domínios.

## Infraestrutura de Estado (STATE)

- **STATE-01**: Criar um `AppContext` usando a React Context API para gerenciar o estado global da aplicação.
  - Deve conter: `currentUser`, `systemSettings`, `clients`, `workers`, `schedules`, `logs`, `expenses`, `documents`, `appNotifications`, `correcoesCorrections`, `approvals`, `clientApprovals`.
  - Deve fornecer funções de mutação (`saveToDb`, `handleDelete`).
  - Deve lidar com a inicialização do Supabase e as subscrições real-time.

## Utilitários e Componentes Comuns (UTIL)

- **UTIL-01**: Extrair funções puras e helpers para `/src/utils`.
  - Exemplos: `calculateDuration`, `formatHours`, `formatDocDate`, `toISODateLocal`, etc.
- **UTIL-02**: Extrair componentes de UI compartilhados para `/src/components/common`.
  - Exemplos: `CompanyLogo`, `EntryForm`, `FinancialReportOverlay`.

## Funcionalidades Admin (ADMIN)

- **ADMIN-01 (Geral)**: Módulo de visão geral com estatísticas e cards de resumo.
- **ADMIN-02 (Equipa)**: Módulo de gestão de trabalhadores (CRUD).
- **ADMIN-03 (Clientes)**: Módulo de gestão de clientes (CRUD).
- **ADMIN-04 (Portal Validação)**: Módulo central de validação de horas e envio de e-mails.
- **ADMIN-05 (Relatórios)**: Módulo de geração de PDFs e exportação ZIP.
- **ADMIN-06 (Documentos)**: Módulo de upload e gestão de documentos administrativos.
- **ADMIN-07 (Notificações)**: Módulo de criação e gestão de banners de aviso.
- **ADMIN-08 (Correções)**: Integração com o portal de correções já existente.

## Funcionalidades Worker (WORKER)

- **WORKER-01 (Dashboard)**: Tela principal do trabalhador com resumo de horas e metas.
- **WORKER-02 (Registo)**: Interface de inserção e edição de horas (histórico mensal).
- **WORKER-03 (Documentos)**: Interface de visualização e assinatura digital de documentos.

## Qualidade e Limpeza (CLEANUP)

- **CLEANUP-01**: O arquivo `app.jsx` deve conter apenas a lógica de roteamento (`view` state) e os Providers de contexto.
- **CLEANUP-02**: Eliminar duplicidade de estilos inlining, movendo o máximo possível para `App.css` ou arquivos CSS específicos de módulo.
- **CLEANUP-03**: Garantir que a performance não seja degradada (uso de `useMemo` e `useCallback` no Contexto).

## Relatórios de Custo (COST)

- **COST-01**: Relatório de custo por trabalhador.
  - Calcular: soma das horas registadas em `logs` × `valorHora` do worker.
  - Mostrar: lista de trabalhadores com total em euros.
  - Filtros: período (mês/ano), trabalhador específico.

- **COST-02**: Relatório de custo por cliente.
  - Calcular: soma das horas aprovadas em `approvals` × `valorHora` do cliente.
  - Mostrar: lista de clientes com total em euros.
  - Filtros: período (mês/ano), cliente específico.

- **COST-03**: Interface de visualização no Admin Dashboard.
  - Separar tabs ou secções para Workers vs Clientes.
  - Exportar para PDF ou CSV (opcional).
