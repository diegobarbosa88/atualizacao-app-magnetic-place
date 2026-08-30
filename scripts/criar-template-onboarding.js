// Cria (submete para aprovação da Meta) o Message Template
// "mp_convite_onboarding" -- usado quando é a EMPRESA a escrever primeiro a
// um número novo (nunca falou com o WhatsApp da Magnetic Place antes),
// convidando-o a preencher o registo de admissão. Fora da janela de 24h de
// conversa, mensagens iniciadas pela empresa só podem ir por template
// aprovado -- daí não dar para reaproveitar o link wa.me/texto livre já
// existente em TeamManager.jsx (esse depende do TRABALHADOR escrever
// primeiro, o que abre a janela de 24h sem precisar de template nenhum).
//
// O botão é do tipo URL com sufixo dinâmico: o link base
// "https://app-magnetic.vercel.app/onboarding/" fica fixo no template, e o
// token do convite (gerado por trabalhador em TeamManager.jsx) é o único
// parâmetro do botão no envio -- ver enviarGraphApiTemplateOnboarding em
// api/salarios/exportar-sepa.js.
//
// Corre uma vez, manualmente, com as credenciais reais (não correr em CI
// nem commitar as credenciais em lado nenhum):
//
//   WHATSAPP_TOKEN=xxx WHATSAPP_BUSINESS_ACCOUNT_ID=xxx node scripts/criar-template-onboarding.js
//
// Depois de aprovado pela Meta (normalmente minutos a poucas horas -- ver o
// estado em WhatsApp Manager -> Contas -> Modelos de mensagem), define
// WHATSAPP_TEMPLATE_ONBOARDING=mp_convite_onboarding na Vercel (projeto
// app-magnetic). Só depois disso o botão "Enviar convite agora por
// WhatsApp" em TeamManager.jsx passa a funcionar -- sem o template
// aprovado, essa chamada falha com "não configurado".

const TOKEN = process.env.WHATSAPP_TOKEN;
const WABA_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
const GRAPH_API_VERSION = 'v25.0';
const NOME_TEMPLATE = 'mp_convite_onboarding';
const URL_BASE = 'https://app-magnetic.vercel.app/onboarding/';

if (!TOKEN || !WABA_ID) {
  console.error('Faltam WHATSAPP_TOKEN e/ou WHATSAPP_BUSINESS_ACCOUNT_ID no ambiente.');
  process.exit(1);
}

const payload = {
  name: NOME_TEMPLATE,
  language: 'pt_PT',
  category: 'UTILITY',
  components: [
    {
      type: 'BODY',
      text: 'Olá {{1}}! A Magnetic Place convida-te a preencher o teu registo de admissão. Carrega no botão abaixo para começares.',
      example: { body_text: [['Ana']] },
    },
    {
      type: 'BUTTONS',
      buttons: [
        { type: 'URL', text: 'Preencher registo', url: `${URL_BASE}{{1}}`, example: [`${URL_BASE}abc123def456`] },
      ],
    },
  ],
};

const resposta = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${WABA_ID}/message_templates`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
const dados = await resposta.json();

if (!resposta.ok) {
  console.error('Falha ao criar template:', JSON.stringify(dados, null, 2));
  process.exit(1);
}

console.log('Template submetido para aprovação:', JSON.stringify(dados, null, 2));
console.log('Acompanha o estado em WhatsApp Manager -> Contas -> Modelos de mensagem.');
