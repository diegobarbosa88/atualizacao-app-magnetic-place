# Requirements: app-magnetic — v3.0 Automação de Documentos Contratuais

**Defined:** 2026-05-12
**Core Value:** Modularidade e escalabilidade: a gestão de horas e relatórios é automatizada, com uma arquitetura limpa e sustentável que permite o crescimento rápido de novas funcionalidades sem a dívida técnica de um monolito.

## v1 Requirements (v3.0 Milestone)

Requirements for the Contract Document Automation system. Each maps to roadmap phases.

### Template Management (Editor de Blocos JSON)

- [ ] **DOCS-01**: Gestor/HR pode criar template de documento com blocos de texto ordenáveis
- [ ] **DOCS-02**: Gestor/HR pode inserir variáveis dinâmicas `{{variavel}}` nos blocos de texto
- [ ] **DOCS-03**: Sistema exporta template como array JSON limpo (estrutura: tipo, conteudo, ordem)
- [ ] **DOCS-04**: Gestor/HR pode guardar e editar templates na base de dados Supabase

### Viewer e Assinatura (Trabalhador)

- [ ] **DOCS-05**: Viewer HTML responsivo lê JSON do template e substitui `{{variavel}}` por dados reais
- [ ] **DOCS-06**: Renderização mobile-first (telemóveis) com layout amigável
- [ ] **DOCS-07**: Trabalhador pode clicar "Assinar Digitalmente" — regista timestamp e estado no Supabase
- [ ] **DOCS-08**: Histórico de versões do documento (cada assinatura cria nova versão)

### Motor PDF (pdfmake)

- [ ] **DOCS-09**: Motor PDF mapeia JSON do documento para docDefinition do pdfmake (não HTML→PDF)
- [ ] **DOCS-10**: Bloco signature configurado com `unbreakable: true` (se não couber na página atual, passa inteiro para a próxima)
- [ ] **DOCS-11**: PDF com margens 50mm esquerda/direita, 60mm cima/baixo
- [ ] **DOCS-12**: PDF com numeração de página no rodapé (formato "Página X de Y")
- [ ] **DOCS-13**: Geração de PDF no browser (cliente) sem necessidade de servidor

## Out of Scope

| Feature | Reason |
|---------|--------|
| Assinatura digital qualificada (e.g. EU eIDAS) | Requer certificação e middleware específico — não faz parte do scope v1 |
| Templates com lógica condicional complexa | Variáveis simples `{{variavel}}` são suficientes para v1 |
| Edição de documento pelo trabalhador | Só visualização e assinatura — edição só pelo Gestor/HR |
| Geração de PDF no servidor | Cliente-side com pdfmake é suficiente e mais simples |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DOCS-01 | Phase 14 | Pending |
| DOCS-02 | Phase 14 | Pending |
| DOCS-03 | Phase 14 | Pending |
| DOCS-04 | Phase 14 | Pending |
| DOCS-05 | Phase 15 | Pending |
| DOCS-06 | Phase 15 | Pending |
| DOCS-07 | Phase 15 | Pending |
| DOCS-08 | Phase 15 | Pending |
| DOCS-09 | Phase 16 | Pending |
| DOCS-10 | Phase 16 | Pending |
| DOCS-11 | Phase 16 | Pending |
| DOCS-12 | Phase 16 | Pending |
| DOCS-13 | Phase 16 | Pending |

**Coverage:**
- v1 requirements: 13 total
- Mapped to phases: 13
- Unmapped: 0

---
*Requirements defined: 2026-05-12*
*Last updated: 2026-05-12 after v3.0 milestone initialization*