#!/usr/bin/env node
// Gera um GMAIL_REFRESH_TOKEN novo através do fluxo de consentimento OAuth2 da
// Google — para substituir o atual, marcado "Sensitive" na Vercel e já não
// recuperável. Não escreve em lado nenhum (Vercel, .env, BD) — só imprime o
// refresh_token no terminal; atualizar a variável na Vercel é passo manual.
//
// Uso:
//   node scripts/gerar-gmail-token.js
//   node scripts/gerar-gmail-token.js --redirect-uri http://localhost:3000/oauth2callback
//
// Precisa de GMAIL_CLIENT_ID e GMAIL_CLIENT_SECRET no ambiente (exporta-os no
// shell antes de correr, ou o script tenta carregá-los de .env.local /
// .vercel/.env.*.local se lá estiverem).

import { google } from 'googleapis';
import readline from 'node:readline/promises';
import fs from 'node:fs';
import path from 'node:path';

function carregarEnvDeFicheiro(caminho) {
  if (!fs.existsSync(caminho)) return;
  const conteudo = fs.readFileSync(caminho, 'utf-8');
  for (const linha of conteudo.split('\n')) {
    const match = linha.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, chave, valorBruto] = match;
    if (process.env[chave]) continue; // não sobrescreve o que já está exportado no shell
    const valor = valorBruto.trim().replace(/^"(.*)"$/, '$1');
    if (valor) process.env[chave] = valor;
  }
}

// Preenche a partir dos .env locais conhecidos deste projeto, sem sobrescrever
// nada que já esteja no ambiente do shell.
['.env.local', '.vercel/.env.development.local', '.vercel/.env.preview.local', '.vercel/.env.production.local']
  .forEach(f => carregarEnvDeFicheiro(path.resolve(process.cwd(), f)));

const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;

const redirectUriArgIdx = process.argv.indexOf('--redirect-uri');
const REDIRECT_URI = redirectUriArgIdx !== -1 ? process.argv[redirectUriArgIdx + 1] : 'http://localhost:3000/oauth2callback';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Erro: GMAIL_CLIENT_ID e/ou GMAIL_CLIENT_SECRET não encontrados.\n');
  console.error('Exporta-os no shell antes de correr este script, por exemplo:');
  console.error('  export GMAIL_CLIENT_ID="..." GMAIL_CLIENT_SECRET="..."\n');
  console.error('Encontras estes valores em https://console.cloud.google.com/apis/credentials');
  console.error('(no projeto Google Cloud onde este OAuth Client foi criado — "OAuth 2.0 Client IDs").');
  process.exit(1);
}

// Precisa de cobrir tudo o que a app faz hoje com Gmail: ler mensagens/anexos
// e marcar como lidas (gmail.modify), e enviar respostas (gmail.send, usado
// pela automação de resposta a emails do contador).
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send',
];

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline', // obrigatório para a Google devolver um refresh_token
  prompt: 'consent',      // força a mostrar o ecrã de consentimento mesmo se esta conta já tiver autorizado esta app antes — sem isto a Google pode não devolver refresh_token
  scope: SCOPES,
});

console.log('\n=== Gerar novo GMAIL_REFRESH_TOKEN ===\n');
console.log('1. Abre este URL num browser onde tenhas sessão iniciada na conta Gmail CERTA');
console.log('   (a conta que a app já usa hoje para ler/enviar email):\n');
console.log(authUrl);
console.log('\n2. Autoriza os pedidos de acesso mostrados pela Google.');
console.log('\n3. Depois de autorizar, o browser tenta abrir um endereço local');
console.log(`   (${REDIRECT_URI}?code=...) que provavelmente vai dar erro de ligação —`);
console.log('   isso é esperado, não há nada a correr nesse endereço.');
console.log('\n   Se em vez disso vires "Erro 400: redirect_uri_mismatch" na PRÓPRIA página');
console.log('   da Google (antes de conseguires autorizar), o redirect URI acima não está');
console.log('   registado nas credenciais OAuth no Google Cloud Console. Ou adicionas');
console.log(`   "${REDIRECT_URI}" como Authorized redirect URI em`);
console.log('   console.cloud.google.com/apis/credentials (na credencial deste Client ID),');
console.log('   ou corres de novo com --redirect-uri apontando a um já registado.');
console.log('\n4. Copia o valor do parâmetro "code=" da barra de endereço (ou cola o URL');
console.log('   completo — o script extrai o código sozinho) e cola abaixo.\n');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const respostaBruta = (await rl.question('Código de autorização (ou URL completo): ')).trim();
rl.close();

let code = respostaBruta;
if (respostaBruta.includes('code=')) {
  try {
    const url = new URL(respostaBruta.startsWith('http') ? respostaBruta : `${REDIRECT_URI}?${respostaBruta.replace(/^\?/, '')}`);
    code = url.searchParams.get('code') || respostaBruta;
  } catch {
    const match = respostaBruta.match(/[?&]code=([^&]+)/);
    if (match) code = decodeURIComponent(match[1]);
  }
}

try {
  const { tokens } = await oauth2Client.getToken(code);
  if (!tokens.refresh_token) {
    console.error('\nA Google não devolveu um refresh_token nesta troca.');
    console.error('Isto costuma acontecer quando esta conta já tinha autorizado esta app');
    console.error('antes e o consentimento não foi realmente re-mostrado. Revoga o acesso');
    console.error('em https://myaccount.google.com/permissions (procura a app pelo nome do');
    console.error('OAuth Client) e corre este script outra vez.');
    process.exit(1);
  }

  console.log('\n✅ Novo GMAIL_REFRESH_TOKEN gerado:\n');
  console.log(tokens.refresh_token);
  console.log('\nEste script NÃO escreveu isto em lado nenhum. Próximo passo manual:');
  console.log('atualizar a variável GMAIL_REFRESH_TOKEN na Vercel (Production e Preview),');
  console.log('substituindo o valor atual.');
} catch (e) {
  console.error('\nErro ao trocar o código por tokens:', e.message);
  process.exit(1);
}
