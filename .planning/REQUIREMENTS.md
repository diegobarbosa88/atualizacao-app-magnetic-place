# Requirements: app-magnetic

**Defined:** 2026-05-05
**Core Value:** Profissionais podem dedicar mais tempo ao trabalho billable porque a gestão de horas, geração de relatórios e comunicação com clientes é automatizada e sem atritos.

## v1 Requirements

### Security

- [ ] **SEC-01**: API keys movidas para environment variables (VITE_GEMINI_API_KEY, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_CLIENT_PORTAL_URL)
- [ ] **SEC-02**: EmailJS credentials movidas para environment variables
- [ ] **SEC-03**: pdf.co API key movida para environment variable
- [ ] **SEC-04**: Gemini API key removida de query string, usar Authorization header

### Error Handling

- [ ] **ERR-01**: handleAiPolish com try/catch/finally guarantee
- [ ] **ERR-02**: Mensagens de erro específicas por código (401, 429, 500, network error)
- [ ] **ERR-03**: Validação de NaN em todas as operações reduce com parseFloat

### Data Integrity

- [ ] **DATA-01**: Supabase subscription com dependency array completo (supabase, initialClientId)
- [ ] **DATA-02**: Validação de clientId em filtros de base de dados antes de interpolar
- [ ] **DATA-03**: Verificação de undefined antes de acessar .length em arrays

## v2 Requirements

### Notifications

- **NOTF-01**: Notificação push para clientes quando relatório é gerado
- **NOTF-02**: Notificação ao admin quando cliente reporta divergência

### Portal

- **PORTAL-01**: Histórico de reportes por cliente
- **PORTAL-02**: Filtros avançados no portal admin (por data, status, cliente)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Faturação/pagamentos | Não faz parte do scope atual |
| Aplicação móvel | Web-first, mobile later |
| Integração com Slack/Teams | Não solicitado pelo utilizador |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEC-01 | Phase 1 | Pending |
| SEC-02 | Phase 1 | Pending |
| SEC-03 | Phase 1 | Pending |
| SEC-04 | Phase 1 | Pending |
| ERR-01 | Phase 1 | Pending |
| ERR-02 | Phase 1 | Pending |
| ERR-03 | Phase 1 | Pending |
| DATA-01 | Phase 1 | Pending |
| DATA-02 | Phase 1 | Pending |
| DATA-03 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 10 total
- Mapped to phases: 10
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-05*
*Last updated: 2026-05-05 after initial requirements definition*
