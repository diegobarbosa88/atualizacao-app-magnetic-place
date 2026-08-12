# Plan 006: Criar ficheiro .env.example

> **Instruções ao executor**: Segue este plano passo a passo. Executa cada comando de verificação e confirma o resultado esperado antes de avançar. Se alguma condição STOP ocorrer, para e reporta — não improvises. Quando concluíres, actualiza a linha de estado deste plano em `plans/README.md`.
>
> **Drift check (executar primeiro)**: `git diff --stat 88e51cb..HEAD -- README.md`

## Estado

- **Prioridade**: P2
- **Esforço**: S
- **Risco**: BAIXO
- **Depende de**: plano 004 (para incluir `APP_URL`)
- **Categoria**: dx
- **Planeado em**: commit `88e51cb`, 2026-06-22

## Porquê importa

O README instrui `cp .env.example .env` mas o ficheiro `.env.example` não existe. Um novo developer não consegue saber quais as variáveis de ambiente necessárias sem ler o código-fonte de múltiplos ficheiros. O `.env.example` documenta o contrato de configuração e previne que credenciais reais sejam acidentalmente commitadas (pois o exemplo usa valores placeholder).

## Variáveis identificadas

Obtidas por `grep` nos ficheiros `api/**/*.js` e `src/**/*.{js,jsx}`:

**Frontend (VITE_ — expostas ao browser, OK para anon keys):**
- `VITE_SUPABASE_URL` — URL do projecto Supabase
- `VITE_SUPABASE_ANON_KEY` — chave anon/pública do Supabase (segura para expor)
- `VITE_GEMINI_MODEL` — modelo Gemini a usar (ex: `gemini-2.5-flash`)
- `VITE_CLIENT_PORTAL_URL` — URL pública do portal do cliente
- `VITE_EMAILJS_SERVICE_ID` — ID do serviço EmailJS
- `VITE_EMAILJS_TEMPLATE_ID_NOTIF` — ID do template de notificação
- `VITE_EMAILJS_TEMPLATE_ID_PORTAL` — ID do template do portal
- `VITE_EMAILJS_PUBLIC_KEY` — chave pública EmailJS
- `VITE_GMAIL_IMPORT_SECRET` — segredo partilhado para acionar importação Gmail (usado no header `x-import-secret`)
- `VITE_PDFCO_API_KEY` — (opcional) chave PDF.co para conversão Word→PDF
- `VITE_CLOUDCONVERT_API_KEY` — (opcional) chave CloudConvert
- `VITE_CLOUDCONVERT_BASE_URL` — base URL do CloudConvert
- `VITE_DISABLE_CLIENT_NOTIFICATIONS` — (opcional) `true` para desactivar emails ao cliente

**Backend (process.env — apenas no servidor Vercel, nunca expostas ao browser):**
- `SUPABASE_URL` — URL do projecto Supabase (igual ao VITE_ mas para servidor)
- `SUPABASE_SERVICE_ROLE_KEY` — chave service role (acesso total, NUNCA expor ao cliente)
- `GEMINI_API_KEY` — chave API Google Gemini para uso no servidor
- `GMAIL_CLIENT_ID` — OAuth2 Client ID da Google Cloud Console
- `GMAIL_CLIENT_SECRET` — OAuth2 Client Secret
- `GMAIL_REFRESH_TOKEN` — refresh token OAuth2 do Gmail
- `GMAIL_IMPORT_SECRET` — segredo partilhado (mesmo valor que `VITE_GMAIL_IMPORT_SECRET`)
- `TOCONLINE_CLIENT_ID` — Client ID OAuth TOConline
- `TOCONLINE_CLIENT_SECRET` — Client Secret TOConline
- `TOCONLINE_REDIRECT_URI` — URI de callback OAuth TOConline (ex: `https://trabalhador.magneticplace.pt/api/toconline/callback`)
- `TOCONLINE_API_URL` — (opcional) URL base da API TOConline
- `TOCONLINE_OAUTH_URL` — (opcional) URL do servidor OAuth TOConline
- `SALTEDGE_APP_ID` — (opcional) App ID Salt Edge para pagamentos
- `SALTEDGE_SECRET` — (opcional) Secret Salt Edge
- `SALTEDGE_PROVIDER` — (opcional) código do provider Salt Edge (ex: `novobanco_pt`)
- `SALTEDGE_SANDBOX` — (opcional) `true` para modo sandbox
- `SALTEDGE_USE_MOCK` — (opcional) `true` para usar mock local
- `MINHA_CONTA_IBAN` — IBAN da conta bancária da empresa (para SEPA)
- `MINHA_CONTA_BIC` — BIC/SWIFT da conta bancária da empresa
- `APP_URL` — URL canónico da aplicação (ex: `https://trabalhador.magneticplace.pt`)

## Comandos necessários

| Propósito | Comando | Esperado em sucesso |
|-----------|---------|---------------------|
| Confirmar criação | `ls -la .env.example` | ficheiro existe |
| Confirmar não commitado com dados reais | `git diff --cached .env.example \| grep -v "^[+-]#\|your_\|example_\|<\|optional\|true\|false\|http"` | sem output suspeito |

## Âmbito

**Em âmbito** (único ficheiro a criar):
- `.env.example` (raiz do projecto)

**Fora de âmbito** (NÃO tocar):
- `.env` (ficheiro com credenciais reais — nunca modificar)
- `.env.local`
- `.gitignore` (já inclui `.env` correctamente)

## Workflow git

- Branch: `advisor/006-env-example`
- Mensagem de commit estilo: `docs: adicionar .env.example com todas as variáveis de ambiente`

## Passos

### Passo 1: Criar `.env.example` na raiz

Cria o ficheiro `.env.example` com o seguinte conteúdo (usar valores placeholder, NUNCA valores reais):

```env
# =============================================================================
# APP MAGNETIC — Variáveis de Ambiente
# Copia este ficheiro: cp .env.example .env
# Preenche com os teus valores reais (NÃO commites o .env)
# =============================================================================

# --- FRONTEND (VITE_) — expostas ao browser ---
# Supabase: obtém em https://supabase.com/dashboard/project/<id>/settings/api
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Google Gemini (modelo a usar, ex: gemini-2.5-flash)
VITE_GEMINI_MODEL=gemini-2.5-flash

# URL público do portal do cliente
VITE_CLIENT_PORTAL_URL=https://painelcliente.magneticplace.pt

# EmailJS: obtém em https://www.emailjs.com/
VITE_EMAILJS_SERVICE_ID=your_emailjs_service_id
VITE_EMAILJS_TEMPLATE_ID_NOTIF=your_template_id_notif
VITE_EMAILJS_TEMPLATE_ID_PORTAL=your_template_id_portal
VITE_EMAILJS_PUBLIC_KEY=your_emailjs_public_key

# Segredo partilhado para disparar importação Gmail (mesmo valor que GMAIL_IMPORT_SECRET abaixo)
VITE_GMAIL_IMPORT_SECRET=your_gmail_import_secret

# PDF.co: (opcional) para conversão Word→PDF
# VITE_PDFCO_API_KEY=your_pdfco_key

# CloudConvert: (opcional) para conversão de documentos
# VITE_CLOUDCONVERT_API_KEY=your_cloudconvert_key
# VITE_CLOUDCONVERT_BASE_URL=https://api.cloudconvert.com/v2

# Desactivar emails ao cliente (true/false)
# VITE_DISABLE_CLIENT_NOTIFICATIONS=false

# --- BACKEND (process.env) — apenas no servidor Vercel, nunca ao browser ---
# Supabase (service role — acesso total, NUNCA expor ao frontend)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Google Gemini API (para uso em serverless functions)
GEMINI_API_KEY=your_gemini_api_key

# Gmail OAuth2: obtém em https://console.cloud.google.com/
GMAIL_CLIENT_ID=your_gmail_client_id
GMAIL_CLIENT_SECRET=your_gmail_client_secret
GMAIL_REFRESH_TOKEN=your_gmail_refresh_token
GMAIL_IMPORT_SECRET=your_gmail_import_secret

# TOConline OAuth: obtém no portal de developers TOConline
TOCONLINE_CLIENT_ID=your_toconline_client_id
TOCONLINE_CLIENT_SECRET=your_toconline_client_secret
TOCONLINE_REDIRECT_URI=https://trabalhador.magneticplace.pt/api/toconline/callback
# TOCONLINE_API_URL=https://app.toconline.pt/api
# TOCONLINE_OAUTH_URL=https://app.toconline.pt/oauth

# Salt Edge (opcional — para pagamentos automáticos)
# SALTEDGE_APP_ID=your_saltedge_app_id
# SALTEDGE_SECRET=your_saltedge_secret
# SALTEDGE_PROVIDER=novobanco_pt
# SALTEDGE_SANDBOX=false
# SALTEDGE_USE_MOCK=false

# Conta bancária da empresa (para geração SEPA)
MINHA_CONTA_IBAN=PTxx000000000000000000000
MINHA_CONTA_BIC=XXXXXXXXXXXX

# URL canónico da aplicação (usado em callbacks, sem trailing slash)
APP_URL=https://trabalhador.magneticplace.pt
```

**Verificar**: `ls -la .env.example` → ficheiro existe com tamanho > 0

### Passo 2: Confirmar que não há valores reais no ficheiro

**Verificar**: `grep -vE "^#|^$|your_|example|<|PTxx|XXXX|http|false|true|gemini-|=https://trabalhador" .env.example` → sem output (todas as linhas com valores são placeholder ou comentário)

## Critérios de conclusão

- [ ] `.env.example` existe na raiz
- [ ] Não contém nenhum valor real (chaves, tokens, IBANs reais)
- [ ] Inclui todas as variáveis identificadas na secção "Variáveis identificadas"
- [ ] `git status` mostra `.env.example` como novo ficheiro não-staged (confirmar que `.env` continua untracked/ignored)
- [ ] Linha de estado em `plans/README.md` actualizada para DONE

## Condições STOP

Para e reporta se:
- `.env` aparecer em `git status` como staged (NUNCA commitar)
- Dúvidas sobre se algum valor no `.env.example` é real ou placeholder

## Notas de manutenção

- Quando se adicionam novas variáveis de ambiente, actualizar `.env.example` no mesmo PR.
- O `.env.example` deve ser commitado e mantido actualizado — é documentação de contrato.
