# Onboarding de trabalhador via WhatsApp — prompt de implementação

> Ficheiro de trabalho, não faz parte do repo. Apagar depois de usado.

---

Implementa o onboarding de trabalhador por WhatsApp. Mexe em **dois repositórios**:

- `app-magnetic` — `C:\Users\diego\APP MAGNETIC PRODUCAO` (GitHub `diegobarbosa88/atualizacao-app-magnetic-place`)
- `conselheiro` — `C:\Users\diego\CONSELHEIRO-ESTRATEGICO` (agente WhatsApp "Trabalhador Virtual")

## Objetivo

Hoje um trabalhador só consegue fazer o registo de onboarding por um link web
(`https://trabalhador.magneticplace.pt/onboarding/<token>`). Queremos uma **segunda via**: preencher
o formulário dentro do próprio WhatsApp, através de um WhatsApp Flow da Meta.

## Decisões já tomadas — não reabrir

1. **A página web não muda de design.** É a fonte de verdade da lista de campos. Só ganha a
   capacidade de ler um rascunho.
2. **As duas vias de entrada são implementadas**, não uma:
   - trabalhador escreve primeiro, por link `wa.me` com a mensagem `ONBOARD <token>` já escrita
     (abre a janela de 24h da Meta, não precisa de template aprovado);
   - empresa escreve primeiro, por message template aprovado pela Meta.
3. **A assinatura fica sempre na web.** Os Flows da Meta **não têm canvas de desenho** — é
   impossível recolher a assinatura lá. O Flow recolhe os dados; no fim o bot manda o link que abre
   a página já preenchida para ler e assinar. O valor legal não muda.
4. **O rascunho é gravado no convite (`worker_onboarding_invites.draft_data`), não em
   `worker_onboarding_submissions`.** Isto é deliberado e importante: assim nunca existe uma
   submissão sem assinatura à espera de aprovação no painel de admin. A cadeia legal
   (assinatura → hash SHA-256 → PDF → submissão → convite usado) corre exatamente como hoje.

---

# PARTE A — repo `app-magnetic`

## A1. Migração Supabase

Criar `supabase/migrations/20260829_onboarding_invite_draft_whatsapp.sql`:

```sql
-- Onboarding via WhatsApp — rascunho preenchido no Flow, assinatura na web.
--
-- O Flow do WhatsApp recolhe os passos 1-3 do formulário (dados pessoais,
-- situação fiscal, dados financeiros) mas NÃO consegue recolher a assinatura
-- desenhada do compromisso (art. 103.º CT) — os Flows da Meta não têm canvas.
--
-- Por isso o Flow grava aqui, no próprio convite, e não em
-- worker_onboarding_submissions: assim nunca existe uma submissão sem
-- assinatura à espera de aprovação no painel. A página web lê este rascunho,
-- hidrata o formulário e salta para a Revisão (passo 3, onde se aceita o RGPD
-- e se corrigem erros), e a cadeia legal (assinatura -> hash -> PDF -> submissão
-- -> convite usado) corre exatamente como corre hoje para quem preenche tudo no
-- browser.
--
-- tel: número de WhatsApp do trabalhador, para a via em que a empresa escreve
-- primeiro (message template aprovado pela Meta). Nulo na via em que é o
-- trabalhador a escrever primeiro pelo link wa.me.

alter table worker_onboarding_invites
  add column if not exists draft_data jsonb,
  add column if not exists tel text;

comment on column worker_onboarding_invites.draft_data is
  'Rascunho dos passos 1-3 preenchido via WhatsApp Flow. A submissão só nasce quando o trabalhador assina na web.';
comment on column worker_onboarding_invites.tel is
  'Número WhatsApp do trabalhador (E.164, só dígitos), para envio do template Meta.';

notify pgrst, 'reload schema';
```

Aplicar com `supabase db query --linked -f supabase/migrations/20260829_onboarding_invite_draft_whatsapp.sql`.
**Nunca `db push`** — regra do projeto.

> Se as colunas já existirem na base de dados, o `if not exists` torna isto idempotente. Confirma
> antes com uma query ao `information_schema.columns`.

## A2. `src/features/admin/TeamManager.jsx` — link `wa.me` copiável

No modal de gerar convite, além do link web que já existe, mostrar um segundo cartão com o link
`wa.me`. **É um link para o admin copiar e reencaminhar ao trabalhador, não um botão para o admin
clicar** — clicá-lo mandaria a mensagem a partir do telemóvel do próprio admin.

**Estado novo** (junto aos existentes `generatedLink` / `linkCopied`, ~linha 30):

```js
const [generatedWaLink, setGeneratedWaLink] = useState('');
const [waLinkCopied, setWaLinkCopied] = useState(false);
```

**Dentro de `gerarConvite()`**, logo a seguir a `setGeneratedLink(link);`:

```js
// Segunda via: o trabalhador abre este link no telemóvel dele e envia a
// mensagem já escrita ao número da empresa. Isso abre a janela de 24h da
// Meta, e o Trabalhador Virtual responde com o Flow de registo — sem
// precisar de um template aprovado. Fica vazio se o número não estiver
// configurado; a via web continua a funcionar na mesma.
const numeroEmpresa = (import.meta.env.VITE_WHATSAPP_NUMERO || '').replace(/[^\d]/g, '');
setGeneratedWaLink(numeroEmpresa ? `https://wa.me/${numeroEmpresa}?text=${encodeURIComponent(`ONBOARD ${token}`)}` : '');
setWaLinkCopied(false);
```

**Nova função**, a espelhar a `copyLink()` existente:

```js
const copyWaLink = () => {
  navigator.clipboard.writeText(generatedWaLink).then(() => {
    setWaLinkCopied(true);
    setTimeout(() => setWaLinkCopied(false), 2000);
  });
};
```

**JSX**, imediatamente a seguir ao cartão teal do "Link gerado com sucesso" e antes do botão "Gerar
novo link":

```jsx
{generatedWaLink && (
  <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100 space-y-3">
    <p className={`${SCALE.text.statLabel} text-emerald-700`}>Ou preencher pelo WhatsApp</p>
    <div className="bg-white rounded-lg border border-emerald-200 px-3 py-2.5">
      <p className="text-xs font-mono text-emerald-800 break-all select-all leading-relaxed">{generatedWaLink}</p>
    </div>
    <button
      onClick={copyWaLink}
      className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-black uppercase transition-all ${waLinkCopied ? 'bg-emerald-600 text-white' : 'bg-emerald-700 text-white hover:bg-emerald-800'}`}
    >
      {waLinkCopied ? <Check size={13} /> : <Copy size={13} />}
      {waLinkCopied ? 'Copiado!' : 'Copiar link WhatsApp'}
    </button>
    <p className={`text-emerald-600 ${SCALE.text.meta}`}>
      O trabalhador abre este link no telemóvel e envia a mensagem já escrita. O Trabalhador Virtual responde com o formulário. A assinatura é sempre feita no link acima.
    </p>
  </div>
)}
```

O botão **"Gerar novo link"** também tem de limpar o estado novo — acrescentar
`setGeneratedWaLink('');` ao `onClick` que já faz `setGeneratedLink('')`.

## A3. `src/features/public/OnboardingForm.jsx` — hidratar o rascunho

No `useEffect` de validação do token, dentro do ramo `else` onde já se faz `setInvite(data)`, antes
de `setPageState('form')`:

```js
// Rascunho preenchido pelo trabalhador no WhatsApp (Flow): hidrata os
// passos 1-3 e abre já na Revisão. Não saltamos direto ao Compromisso
// de propósito — é na Revisão que se aceita o RGPD e que se corrige um
// NIF/IBAN mal digitado, e o Flow não tem forma de mostrar erros de
// validação campo a campo como o formulário web mostra.
if (data.draft_data && typeof data.draft_data === 'object') {
  setForm(prev => ({ ...prev, ...data.draft_data }));
  setStep(3);
}
```

**Porquê o passo 3 e não o 4:** `validateStep(3)` exige a checkbox `rgpd`. Saltar para o 4 seria
aceitar um consentimento de proteção de dados em nome do trabalhador — degradação legal, não
conveniência. O passo 3 é também onde ele corrige um NIF/IBAN que o Flow não conseguiu validar
interativamente.

**Não alterar mais nada neste ficheiro.** Em particular, não tocar em `EMPTY_FORM`,
`ESTADO_CIVIL_OPTIONS`, nas tabelas de IRS, nem no fluxo de assinatura.

---

# PARTE B — repo `conselheiro`

## B1. `api/whatsapp/onboardingTrabalhador.js` (ficheiro NOVO)

Este é o núcleo. Criar exatamente assim:

```js
// Onboarding de trabalhador pelo WhatsApp — caminho ISOLADO.
//
// ⚠ SEGURANÇA — ler antes de mexer.
// Este é o único caminho do webhook que corre para números FORA da whitelist
// (WHATSAPP_NUMEROS_AUTORIZADOS). Um trabalhador novo não está, e não pode
// estar, nessa lista. Em troca, este caminho é deliberadamente burro:
//
//   - NÃO chama a Anthropic API, não tem loop de tools, não vê as TOOLS.
//     Se caísse no loop do webhook, um número desconhecido ganhava acesso a
//     editar contratos, comunicar à Segurança Social e ler dados financeiros.
//   - NÃO lê nem escreve o histórico de conversas do Diego.
//   - Só sabe fazer duas coisas, ambas amarradas a um token de convite:
//     validar o convite e gravar um rascunho nesse mesmo convite.
//
// A chave de acesso é o token do convite (UUID v4) — quem não tiver um token
// válido, por criar e não expirado, não consegue fazer nada aqui.
//
// O que este módulo NÃO faz: criar a submissão. O Flow recolhe os passos 1-3;
// a assinatura do compromisso (art. 103.º CT) fica na web, porque os Flows da
// Meta não têm canvas de desenho. Ver a migração
// 20260829_onboarding_invite_draft_whatsapp.sql no repo app-magnetic.

import { getMagneticSupabase, enviarWhatsApp, enviarFlow } from '../_whatsappShared.js';

const BASE_ONBOARDING = 'https://trabalhador.magneticplace.pt/onboarding';

// O trabalhador chega por um link wa.me com esta mensagem já escrita. Aceita
// espaços a mais e maiúsculas/minúsculas, porque o link pode ser reencaminhado
// e reescrito à mão. O token é um UUID v4 gerado por crypto.randomUUID().
const PADRAO_ONBOARD = /^onboard\s+([0-9a-f-]{36})$/i;

// Prefixo do flow_token, para correlacionar a resposta do Flow (nfm_reply) com
// o convite. O enviarFlow gera um token aleatório por omissão e ninguém o lê —
// aqui precisamos dele para saber a que convite pertence o formulário que
// chegou, já que o Flow não tem forma de nos devolver o token do convite.
const PREFIXO_FLOW_TOKEN = 'onb:';

// ─── Validadores ──────────────────────────────────────────────────
// Cópia literal de src/features/public/OnboardingForm.jsx:37-57 (app-magnetic).
// O Flow da Meta não corre o JS do formulário web, por isso a validação tem de
// existir também aqui — senão o WhatsApp seria uma porta para gravar um NIF ou
// IBAN inválido que o browser recusaria.

function validarNIF(nif) {
  if (!/^\d{9}$/.test(nif)) return false;
  const d = nif.split('').map(Number);
  let sum = 0;
  for (let i = 0; i < 8; i++) sum += d[i] * (9 - i);
  const rem = sum % 11;
  return d[8] === (rem < 2 ? 0 : 11 - rem);
}

function validarIBAN(raw) {
  const iban = raw.replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/.test(iban)) return false;
  const num = (iban.slice(4) + iban.slice(0, 4)).split('').map(c => isNaN(c) ? c.charCodeAt(0) - 55 : c).join('');
  let rem = 0;
  for (const c of num) rem = (rem * 10 + parseInt(c)) % 97;
  return rem === 1;
}

function validarNIS(nis) {
  return /^\d{11}$/.test(nis);
}

// O DatePicker dos Flows devolve epoch em MILISSEGUNDOS em string
// ("631152000000"), não "YYYY-MM-DD" — e é "YYYY-MM-DD" que o <input type=
// "date"> da página web precisa para mostrar a data hidratada. Sem esta
// conversão o campo chegava preenchido com lixo e o browser esvaziava-o sem
// dizer nada. Aceita também o formato já correto, caso um dia o Flow mude para
// TextInput. Devolve null se não conseguir interpretar — o normalizador
// descarta, e o trabalhador preenche a data na Revisão.
function normalizarData(valor) {
  const texto = String(valor).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;
  if (/^\d{10,}$/.test(texto)) {
    const d = new Date(Number(texto));
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return null;
}

// ─── Convite ──────────────────────────────────────────────────────

// Mesmo critério do formulário web (OnboardingForm.jsx:260): tem de existir,
// estar 'pending' e não estar expirado. Devolve null em qualquer outro caso —
// nunca distinguimos "não existe" de "expirado" na mensagem ao utilizador, para
// não confirmar a existência de tokens a quem esteja a adivinhar.
async function obterConviteValido(magneticDb, token) {
  const { data, error } = await magneticDb
    .from('worker_onboarding_invites')
    .select('id, token, status, expires_at, draft_data')
    .eq('token', token)
    .maybeSingle();
  if (error || !data) return null;
  if (data.status !== 'pending') return null;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null;
  return data;
}

// ─── Campos aceites do Flow ───────────────────────────────────────
// Lista fechada, espelhando EMPTY_FORM em OnboardingForm.jsx:67-71. Só estes
// passam para draft_data — um campo extra que apareça no response_json (por
// engano no Flow Builder, ou injetado) é descartado em silêncio, não gravado.
const CAMPOS_ACEITES = [
  'nome', 'profissao', 'profissao_cnp', 'data_nascimento', 'tel', 'email',
  'dni', 'documento_validade', 'estado_civil', 'address',
  'tabela_irs', 'n_dependentes',
  'nis', 'nif', 'iban',
];

const TABELA_IRS_VALIDAS = ['tabelaI', 'tabelaII', 'tabelaIII'];
const ESTADO_CIVIL_VALIDOS = ['solteiro', 'casado', 'uniao_de_facto', 'divorciado', 'viuvo'];

// Filtra, normaliza e valida o que veio do Flow. Devolve { dados, erros }.
// Os campos são todos opcionais no formulário web (só o nome é obrigatório, e
// só ao avançar do passo 1), por isso um campo vazio não é erro — mas um campo
// preenchido com valor inválido é, e nesse caso não gravamos nada.
function normalizarRespostaFlow(bruto) {
  const dados = {};
  for (const campo of CAMPOS_ACEITES) {
    const valor = bruto[campo];
    if (valor === undefined || valor === null || valor === '') continue;
    dados[campo] = typeof valor === 'string' ? valor.trim() : valor;
  }

  const erros = [];
  if (!dados.nome) erros.push('o nome');
  if (dados.nif && !validarNIF(dados.nif)) erros.push('o NIF (9 dígitos, com dígito de controlo válido)');
  if (dados.nis && !validarNIS(dados.nis)) erros.push('o NISS (11 dígitos)');
  if (dados.iban && !validarIBAN(dados.iban)) erros.push('o IBAN');
  if (dados.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email)) erros.push('o email');

  // Campos de escolha: se vierem fora da lista, descartamos em vez de gravar
  // lixo — a página web usa o default (tabelaI) e o trabalhador corrige na
  // Revisão, que é onde vai aterrar de qualquer forma.
  if (dados.tabela_irs && !TABELA_IRS_VALIDAS.includes(dados.tabela_irs)) delete dados.tabela_irs;
  if (dados.estado_civil && !ESTADO_CIVIL_VALIDOS.includes(dados.estado_civil)) delete dados.estado_civil;

  if (dados.iban) dados.iban = dados.iban.replace(/\s/g, '').toUpperCase();
  if (dados.n_dependentes !== undefined) dados.n_dependentes = Number(dados.n_dependentes) || 0;

  for (const campo of ['data_nascimento', 'documento_validade']) {
    if (!dados[campo]) continue;
    const iso = normalizarData(dados[campo]);
    if (iso) dados[campo] = iso; else delete dados[campo];
  }

  return { dados, erros };
}

// ─── Entrada ──────────────────────────────────────────────────────

// Chamado pelo webhook ANTES da whitelist. Devolve true se tratou a mensagem
// (e o webhook deve terminar sem passar ao Claude), false se não é com ele.
export async function tratarOnboardingTrabalhador({ de, numeroReceptor, texto, nfmReply }) {
  // Caso 1 — resposta a um Flow de onboarding. Identificado pelo flow_token que
  // nós próprios pusemos ao enviar; qualquer outro Flow (menu, convite) tem
  // outro prefixo e não é nosso.
  //
  // A Meta devolve o flow_token DENTRO do response_json (que é uma string), não
  // ao lado dele — é por isso que o webhook.js:125,130 o filtra do objeto já
  // parseado, junto com os campos do formulário. Parseamos aqui, e voltamos a
  // passar o objeto já parseado para não desperdiçar o trabalho.
  if (nfmReply) {
    let bruto;
    try {
      bruto = JSON.parse(nfmReply.response_json || '{}');
    } catch {
      return false;
    }
    const flowToken = typeof bruto.flow_token === 'string' ? bruto.flow_token : '';
    if (!flowToken.startsWith(PREFIXO_FLOW_TOKEN)) return false;
    await tratarRespostaFlow({ de, numeroReceptor, flowToken, bruto });
    return true;
  }

  // Caso 2 — primeira mensagem, vinda do link wa.me.
  const match = PADRAO_ONBOARD.exec((texto || '').trim());
  if (!match) return false;
  await tratarPedidoInicial({ de, numeroReceptor, token: match[1].toLowerCase() });
  return true;
}

async function tratarPedidoInicial({ de, numeroReceptor, token }) {
  const magneticDb = getMagneticSupabase();
  const convite = await obterConviteValido(magneticDb, token);

  if (!convite) {
    await enviarWhatsApp(
      de,
      'Este link de registo já não é válido — pode ter expirado (são válidos 7 dias) ou já ter sido usado.\n\nFale com a Magnetic Place para receber um link novo.',
      numeroReceptor,
    );
    return;
  }

  const flowId = process.env.WHATSAPP_FLOW_ONBOARD_ID;
  if (!flowId) {
    // Falha de configuração nossa, não do trabalhador — damos-lhe na mesma uma
    // saída que funciona, em vez de um beco sem saída.
    await enviarWhatsApp(
      de,
      `Bem-vindo à Magnetic Place. Preencha o seu registo aqui:\n\n${BASE_ONBOARDING}/${convite.token}`,
      numeroReceptor,
    );
    console.error('[onboarding] WHATSAPP_FLOW_ONBOARD_ID não configurado — enviado link web em alternativa.');
    return;
  }

  await enviarFlow(de, numeroReceptor, {
    header: 'Registo de trabalhador',
    corpo: 'Bem-vindo à Magnetic Place.\n\nVamos recolher os seus dados em 3 passos. No fim receberá um link para ler e assinar o compromisso.',
    footer: 'Os seus dados são protegidos (RGPD)',
    flowId,
    flowCta: 'Começar',
    screen: 'DADOS_PESSOAIS',
    flowToken: `${PREFIXO_FLOW_TOKEN}${convite.token}`,
  });
}

async function tratarRespostaFlow({ de, numeroReceptor, flowToken, bruto }) {
  const token = flowToken.slice(PREFIXO_FLOW_TOKEN.length);
  const magneticDb = getMagneticSupabase();

  // Revalidar o convite agora, não confiar em ter sido válido quando o Flow foi
  // enviado — pode ter expirado ou sido usado entretanto.
  const convite = await obterConviteValido(magneticDb, token);
  if (!convite) {
    await enviarWhatsApp(
      de,
      'O seu link de registo expirou entretanto. Fale com a Magnetic Place para receber um novo — os dados que preencheu não foram perdidos, basta indicá-los outra vez no link novo.',
      numeroReceptor,
    );
    return;
  }

  const { dados, erros } = normalizarRespostaFlow(bruto);

  if (erros.length) {
    await enviarWhatsApp(
      de,
      `Não consegui aceitar ${erros.join(', ')}.\n\nPode corrigir diretamente na página do registo:\n${BASE_ONBOARDING}/${convite.token}`,
      numeroReceptor,
    );
    return;
  }

  const { error } = await magneticDb
    .from('worker_onboarding_invites')
    .update({ draft_data: dados, tel: (dados.tel || de).replace(/[^\d]/g, '') })
    .eq('token', convite.token)
    .eq('status', 'pending');

  if (error) {
    console.error('[onboarding] erro ao gravar rascunho:', error);
    await enviarWhatsApp(
      de,
      `Houve um problema a guardar os seus dados. Pode preencher diretamente na página:\n${BASE_ONBOARDING}/${convite.token}`,
      numeroReceptor,
    );
    return;
  }

  const primeiroNome = String(dados.nome).trim().split(/\s+/)[0];
  await enviarWhatsApp(
    de,
    `Obrigado, ${primeiroNome}. Os seus dados ficaram guardados.\n\nFalta o último passo, que tem de ser feito na página por exigir a sua assinatura:\n\n${BASE_ONBOARDING}/${convite.token}\n\nAbra o link, confirme os dados e assine o compromisso. Demora menos de um minuto.`,
    numeroReceptor,
  );
}
```

## B2. `api/whatsapp/webhook.js` — ligar o ramo ANTES da whitelist

Acrescentar o import:

```js
import { tratarOnboardingTrabalhador } from './onboardingTrabalhador.js';
```

Depois, **subir** as declarações de `de` e `numeroReceptor` para cima da whitelist (hoje `de` está
imediatamente antes dela e `numeroReceptor` logo a seguir) e inserir o ramo do onboarding entre as
duas coisas. O bloco fica assim, substituindo o comentário `// 2. Whitelist`:

```js
const de = mensagemRecebida.from;
// Phone Number ID que recebeu a mensagem. Responder sempre pelo mesmo
// número que recebeu, nunca um valor fixo.
const numeroReceptor = value.metadata.phone_number_id;

// 2. Onboarding de trabalhador — ANTES da whitelist, de propósito.
// Um trabalhador novo não está (nem pode estar) na whitelist, mas tem de
// conseguir preencher o registo pelo WhatsApp. Este caminho é fechado:
// só reage a "ONBOARD <token>" ou à resposta do Flow de onboarding, e
// termina aqui com return — nunca chega ao Claude nem às TOOLS. Ver o
// cabeçalho de onboardingTrabalhador.js para o raciocínio de segurança.
const tratado = await tratarOnboardingTrabalhador({
  de,
  numeroReceptor,
  texto: mensagemRecebida.text?.body || '',
  nfmReply: interactive?.nfm_reply || null,
});
if (tratado) return res.status(200).send('');

// 3. Whitelist — só números autorizados falam com o agente. A Meta
// devolve o número só com dígitos (sem "+"), por isso normalizamos os
// dois lados antes de comparar.
const autorizados = getNumerosAutorizados().map((n) => n.replace(/[^\d]/g, ''));
if (!autorizados.includes(de.replace(/[^\d]/g, ''))) {
  return res.status(200).send('');
}
```

Remover a declaração duplicada de `numeroReceptor` que ficava logo abaixo da whitelist, e renumerar
os comentários seguintes: `// 3. Histórico` → `// 4.`, `// 4. Chamar a Anthropic API` → `// 5.`,
`// 5. Enviar via Graph API` → `// 6.`.

**A ordem importa e não é negociável.** Se o ramo ficar depois da whitelist, um trabalhador novo
nunca é atendido. Se ficar antes mas sem o `return`, um número desconhecido cai no loop de tools do
Claude — que tem acesso a contratos, Segurança Social e dados financeiros. Depois de editar,
confirma por leitura que as duas únicas saídas antes do `anthropic.messages.create` são o `return`
do onboarding e o `return` da whitelist.

## B3. `api/_whatsappShared.js` — `enviarFlow` aceita `flowToken`

Hoje a função gera sempre um `flow_token` aleatório. Precisa de aceitar um opcional, mantendo o
aleatório como fallback (os dois Flows existentes não passam nada e têm de continuar a funcionar):

```js
// flowToken é opcional: por omissão gera-se um valor aleatório que ninguém lê
// (os Flows do Claude não precisam de correlação — a conversa dá o contexto).
// O onboarding do trabalhador passa um token próprio ("onb:<token do convite>")
// porque a resposta chega fora de qualquer conversa, e é a única forma de saber
// a que convite pertence o formulário preenchido. A Meta devolve-o dentro do
// response_json do nfm_reply.
export async function enviarFlow(to, phoneNumberId, { header, corpo, footer, flowId, flowCta, screen, flowToken }) {
```

e dentro de `parameters`:

```js
flow_token: flowToken || `tok_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
```

## B4. `flows/onboarding-trabalhador.json` (ficheiro NOVO)

Flow JSON v5.1, **4 ecrãs**. Os ids dos ecrãs e os nomes dos campos têm de bater exatamente com o
código acima — em particular o ecrã de entrada chama-se `DADOS_PESSOAIS` (é o que o `screen` do
`enviarFlow` envia) e os ids das opções dos dropdowns são os valores literais que a página web
espera (`solteiro`/`casado`/`uniao_de_facto`/`divorciado`/`viuvo`, `tabelaI`/`tabelaII`/`tabelaIII`).

```json
{
  "version": "5.1",
  "screens": [
    {
      "id": "DADOS_PESSOAIS",
      "title": "Identificação",
      "data": {},
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "Form",
            "name": "form_pessoais",
            "children": [
              { "type": "TextSubheading", "text": "Passo 1 de 4" },
              { "type": "TextInput", "name": "nome", "label": "Nome completo", "input-type": "text", "required": true },
              { "type": "DatePicker", "name": "data_nascimento", "label": "Data de nascimento", "required": false },
              {
                "type": "Dropdown",
                "name": "estado_civil",
                "label": "Estado civil",
                "required": false,
                "data-source": [
                  { "id": "solteiro", "title": "Solteiro(a)" },
                  { "id": "casado", "title": "Casado(a)" },
                  { "id": "uniao_de_facto", "title": "União de facto" },
                  { "id": "divorciado", "title": "Divorciado(a)" },
                  { "id": "viuvo", "title": "Viúvo(a)" }
                ]
              },
              { "type": "TextInput", "name": "dni", "label": "Nº do Cartão de Cidadão / DNI", "input-type": "text", "required": false },
              { "type": "DatePicker", "name": "documento_validade", "label": "Validade do documento", "required": false },
              {
                "type": "Footer",
                "label": "Continuar",
                "on-click-action": {
                  "name": "navigate",
                  "next": { "type": "screen", "name": "CONTACTO" },
                  "payload": {
                    "nome": "${form.nome}",
                    "data_nascimento": "${form.data_nascimento}",
                    "estado_civil": "${form.estado_civil}",
                    "dni": "${form.dni}",
                    "documento_validade": "${form.documento_validade}"
                  }
                }
              }
            ]
          }
        ]
      }
    },
    {
      "id": "CONTACTO",
      "title": "Contacto",
      "data": {
        "nome": { "type": "string", "__example__": "Maria Silva" },
        "data_nascimento": { "type": "string", "__example__": "631152000000" },
        "estado_civil": { "type": "string", "__example__": "solteiro" },
        "dni": { "type": "string", "__example__": "12345678" },
        "documento_validade": { "type": "string", "__example__": "1893456000000" }
      },
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "Form",
            "name": "form_contacto",
            "children": [
              { "type": "TextSubheading", "text": "Passo 2 de 4" },
              { "type": "TextInput", "name": "tel", "label": "Telemóvel", "input-type": "phone", "required": false },
              { "type": "TextInput", "name": "email", "label": "Email", "input-type": "email", "required": false },
              { "type": "TextInput", "name": "address", "label": "Morada completa", "input-type": "text", "required": false },
              { "type": "TextInput", "name": "profissao", "label": "Profissão", "input-type": "text", "required": false },
              {
                "type": "Footer",
                "label": "Continuar",
                "on-click-action": {
                  "name": "navigate",
                  "next": { "type": "screen", "name": "SITUACAO_FISCAL" },
                  "payload": {
                    "nome": "${data.nome}",
                    "data_nascimento": "${data.data_nascimento}",
                    "estado_civil": "${data.estado_civil}",
                    "dni": "${data.dni}",
                    "documento_validade": "${data.documento_validade}",
                    "tel": "${form.tel}",
                    "email": "${form.email}",
                    "address": "${form.address}",
                    "profissao": "${form.profissao}"
                  }
                }
              }
            ]
          }
        ]
      }
    },
    {
      "id": "SITUACAO_FISCAL",
      "title": "Situação fiscal",
      "data": {
        "nome": { "type": "string", "__example__": "Maria Silva" },
        "data_nascimento": { "type": "string", "__example__": "631152000000" },
        "estado_civil": { "type": "string", "__example__": "solteiro" },
        "dni": { "type": "string", "__example__": "12345678" },
        "documento_validade": { "type": "string", "__example__": "1893456000000" },
        "tel": { "type": "string", "__example__": "912345678" },
        "email": { "type": "string", "__example__": "maria@exemplo.pt" },
        "address": { "type": "string", "__example__": "Rua Exemplo, 1, Trofa" },
        "profissao": { "type": "string", "__example__": "Serralheiro" }
      },
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "Form",
            "name": "form_fiscal",
            "children": [
              { "type": "TextSubheading", "text": "Passo 3 de 4" },
              { "type": "TextBody", "text": "A tabela de retenção de IRS depende do seu estado civil e de quem declara os rendimentos." },
              {
                "type": "Dropdown",
                "name": "tabela_irs",
                "label": "Tabela de IRS",
                "required": false,
                "data-source": [
                  { "id": "tabelaI", "title": "I — Não casado / Casado, dois titulares" },
                  { "id": "tabelaII", "title": "II — Não casado, com dependentes" },
                  { "id": "tabelaIII", "title": "III — Casado, único titular" }
                ]
              },
              { "type": "TextInput", "name": "n_dependentes", "label": "Nº de dependentes", "input-type": "number", "required": false },
              {
                "type": "Footer",
                "label": "Continuar",
                "on-click-action": {
                  "name": "navigate",
                  "next": { "type": "screen", "name": "DADOS_FINANCEIROS" },
                  "payload": {
                    "nome": "${data.nome}",
                    "data_nascimento": "${data.data_nascimento}",
                    "estado_civil": "${data.estado_civil}",
                    "dni": "${data.dni}",
                    "documento_validade": "${data.documento_validade}",
                    "tel": "${data.tel}",
                    "email": "${data.email}",
                    "address": "${data.address}",
                    "profissao": "${data.profissao}",
                    "tabela_irs": "${form.tabela_irs}",
                    "n_dependentes": "${form.n_dependentes}"
                  }
                }
              }
            ]
          }
        ]
      }
    },
    {
      "id": "DADOS_FINANCEIROS",
      "title": "Dados financeiros",
      "terminal": true,
      "data": {
        "nome": { "type": "string", "__example__": "Maria Silva" },
        "data_nascimento": { "type": "string", "__example__": "631152000000" },
        "estado_civil": { "type": "string", "__example__": "solteiro" },
        "dni": { "type": "string", "__example__": "12345678" },
        "documento_validade": { "type": "string", "__example__": "1893456000000" },
        "tel": { "type": "string", "__example__": "912345678" },
        "email": { "type": "string", "__example__": "maria@exemplo.pt" },
        "address": { "type": "string", "__example__": "Rua Exemplo, 1, Trofa" },
        "profissao": { "type": "string", "__example__": "Serralheiro" },
        "tabela_irs": { "type": "string", "__example__": "tabelaI" },
        "n_dependentes": { "type": "string", "__example__": "0" }
      },
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "Form",
            "name": "form_financeiro",
            "children": [
              { "type": "TextSubheading", "text": "Passo 4 de 4" },
              { "type": "TextInput", "name": "nis", "label": "NISS (11 dígitos)", "input-type": "number", "required": false },
              { "type": "TextInput", "name": "nif", "label": "NIF (9 dígitos)", "input-type": "number", "required": false },
              { "type": "TextInput", "name": "iban", "label": "IBAN", "input-type": "text", "required": false },
              { "type": "TextCaption", "text": "A seguir receberá um link para confirmar os dados e assinar o compromisso. Os seus dados são tratados ao abrigo do RGPD." },
              {
                "type": "Footer",
                "label": "Concluir",
                "on-click-action": {
                  "name": "complete",
                  "payload": {
                    "nome": "${data.nome}",
                    "data_nascimento": "${data.data_nascimento}",
                    "estado_civil": "${data.estado_civil}",
                    "dni": "${data.dni}",
                    "documento_validade": "${data.documento_validade}",
                    "tel": "${data.tel}",
                    "email": "${data.email}",
                    "address": "${data.address}",
                    "profissao": "${data.profissao}",
                    "tabela_irs": "${data.tabela_irs}",
                    "n_dependentes": "${data.n_dependentes}",
                    "nis": "${form.nis}",
                    "nif": "${form.nif}",
                    "iban": "${form.iban}"
                  }
                }
              }
            ]
          }
        ]
      }
    }
  ]
}
```

Notas sobre este Flow, para não as redescobrires:

- **`profissao_cnp` está deliberadamente de fora.** Um trabalhador não sabe o código CNP da profissão
  dele. Fica vazio e preenche-se na revisão web.
- **São 4 ecrãs e não 3** por precaução quanto ao limite de componentes por ecrã da Meta. Um toque
  extra custa menos do que um Flow que falha validação no Flow Builder. Se validar com 3, podes
  fundir — mas mantém o id `DADOS_PESSOAIS` no primeiro.
- **É um Flow estático** — sem endpoint de data-exchange, logo sem encriptação a configurar.

## B5. Template Meta para a via "empresa escreve primeiro" — POR FAZER

Esta é a única parte que ainda não está escrita. O padrão a seguir é o `enviarWhatsAppTemplate` que
já existe em `api/_whatsappShared.js:196`, mas atenção a duas diferenças:

- a função atual tem o `WHATSAPP_PHONE_NUMBER_ID` fixo e uma só variável de corpo — para o
  onboarding precisas de passar o token do convite, portanto ou generalizas ou escreves uma irmã;
- o nome do template vai numa env var nova, `WHATSAPP_TEMPLATE_ONBOARD`, e o código tem de degradar
  com elegância enquanto ela não existir (a aprovação da Meta demora dias). Segue o mesmo padrão do
  `WHATSAPP_FLOW_ONBOARD_ID` acima: sem a var, cai para o link web em vez de rebentar.

O template em si tem de ser submetido à Meta manualmente, categoria `UTILITY`, língua `pt_PT`.

---

# Configuração (não é código)

| Variável | Onde | O que é |
|---|---|---|
| `VITE_WHATSAPP_NUMERO` | Vercel, projeto app-magnetic | Número WhatsApp da empresa, só dígitos. Sem ela o cartão verde não aparece e a via web continua igual. |
| `WHATSAPP_FLOW_ONBOARD_ID` | Vercel, projeto conselheiro | Sai da publicação do Flow no Flow Builder da Meta. Sem ela o bot responde com o link web. |
| `WHATSAPP_TEMPLATE_ONBOARD` | Vercel, projeto conselheiro | Só depois da aprovação da Meta (B5). |

---

# Verificação

1. `node --check` nos três ficheiros JS do conselheiro e `JSON.parse` no Flow.
2. No app-magnetic: `npx eslint .` e `npx vite build`. Atenção — no `TeamManager.jsx` há um warning
   pré-existente (`'navigate' is assigned a value but never used`, linha 25) que **já existe em
   `HEAD`**; não é regressão e não é para corrigir neste trabalho.
3. Confirmar por leitura que no `webhook.js` não existe nenhum caminho de um número fora da
   whitelist até `anthropic.messages.create`.
4. **Checkpoint visual no browser** para o cartão verde do `TeamManager.jsx` — `npx vite build`
   passar não prova nada sobre UI (regra do projeto). Precisa da `VITE_WHATSAPP_NUMERO` definida
   localmente, e o cartão só aparece depois de clicar "Gerar convite", **que escreve um registo real
   em `worker_onboarding_invites`**. Pedir autorização ao Diego antes dessa escrita.
5. Teste ponta a ponta no número do Diego, depois de o Flow estar publicado.

# Regras de deploy — ler antes de fazer o que quer que seja

- **app-magnetic: `git push` dispara deploy automático para produção.** Nunca fazer push sem
  confirmação explícita do Diego.
- **conselheiro: precisa de `vercel deploy --prod` manual**, é um deploy separado.
- Migrações Supabase: `supabase db query --linked -f <ficheiro>`, **nunca** `db push`.
