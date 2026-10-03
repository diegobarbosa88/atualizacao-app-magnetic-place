/*
 * Terminal de ponto NFC — Magnetic Place
 * Placa: Freenove ESP32-S3 Display 3,5" (FNK0104N, ST77922) + PN532 em I2C.
 *
 * Fala com os MESMOS endpoints do piloto Android (/api/ponto/terminal-*):
 *   ativar (código → token) · estado · identificar (UID → trabalhador) · registar.
 * O servidor decide tudo (hora, afetação, máquina de estados, push);
 * o terminal só lê o cartão, mostra e pede.
 *
 * Primeiro arranque: cria a rede Wi-Fi "Ponto-XXXX". Liga o telemóvel a
 * essa rede, escolhe o Wi-Fi da obra e escreve o código de ativação
 * gerado no admin (Ponto QR → Terminais NFC → criar terminal ou Gerar código).
 * Para reconfigurar: manter o botão BOOT carregado 5 s.
 */
#include <WiFi.h>
#include <WiFiManager.h>
#include <Preferences.h>
#include <time.h>
#include "config.h"
#include "display.h"
#include "ui.h"
#include "nfc.h"
#include "api.h"

#define PIN_BOOT 0
#define TZ_PADRAO "WET0WEST,M3.5.0/1,M10.5.0"   // Portugal continental; Espanha: "CET-1CEST,M3.5.0,M10.5.0/3"

Preferences prefs;

enum Estado { ESPERA, IDENTIFICADO, RESULTADO };
static Estado estado = ESPERA;
static uint32_t estadoDesde = 0;

static Identificacao idAtual;
static String uidAtual;
static int ultimaContagem = -1;

static bool nfcOk = false;
static bool associacaoPendente = false;
static String associacaoNome;
static uint32_t ultimoEstado = 0, ultimoNfc = 0, ultimoRelogio = 0, bootDesde = 0;

// ---------- feedback ----------

static void led(uint8_t r, uint8_t g, uint8_t b) { rgbLedWrite(PIN_LED_WS2812, r, g, b); }
static void led_espera() { led(0, 0, 40); }
static void led_laranja() { led(60, 25, 0); }
static void led_verde() { led(0, 60, 0); }
static void led_vermelho() { led(60, 0, 0); }

// Desenha já o ecrã (antes de uma chamada bloqueante de rede).
static void desenhar() {
  lv_timer_handler();
  lv_refr_now(NULL);
}

// ---------- relógio ----------

static const char *DIAS[] = {"Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"};
static const char *MESES[] = {"janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho",
                              "agosto", "setembro", "outubro", "novembro", "dezembro"};

static bool hora_local(struct tm &t) { return getLocalTime(&t, 10) && t.tm_year > 120; }

static String data_extenso() {
  struct tm t;
  if (!hora_local(t)) return "";
  return String(DIAS[t.tm_wday]) + ", " + t.tm_mday + " de " + MESES[t.tm_mon];
}

static void atualizar_relogio() {
  struct tm t;
  char buf[6];
  if (hora_local(t)) {
    snprintf(buf, sizeof buf, "%02d:%02d", t.tm_hour, t.tm_min);
    ui_set_hora(buf);
  }
  ui_set_wifi(WiFi.status() == WL_CONNECTED);
}

// ---------- estados ----------

static void ir_espera() {
  estado = ESPERA;
  estadoDesde = millis();
  led_espera();
  if (!nfcOk) {
    ui_info(ICON_ERRO, "Leitor NFC não responde",
            "Verifica os 4 fios do PN532 e o interruptor em I2C (1=ON, 2=OFF).");
    led_vermelho();
    return;
  }
  ui_espera(data_extenso(), associacaoPendente ? associacaoNome : "");
}

static void mostrar_resultado(bool ok, const String &titulo, const String &l1, const String &l2 = "") {
  estado = RESULTADO;
  estadoDesde = millis();
  ok ? led_verde() : led_vermelho();
  ui_resultado(ok, titulo, l1, l2);
}

// Token revogado/inválido no servidor: apaga-o e volta ao portal de ativação.
static void reativar(const String &motivo) {
  prefs.putString("token", "");
  ui_info(ICON_ERRO, "Terminal desativado", motivo, "A reiniciar para nova ativação...");
  led_vermelho();
  desenhar();
  delay(5000);
  ESP.restart();
}

static bool tratar_erro(const ApiResposta &r) {
  if (r.status == 401) {
    reativar(r.erro);
    return true;
  }
  if (r.status == 0) {
    mostrar_resultado(false, "Sem ligação", r.erro, "Tenta outra vez dentro de instantes.");
    return true;
  }
  return false;
}

static String primeiro_nome(const String &nome) {
  int e = nome.indexOf(' ');
  return e > 0 ? nome.substring(0, e) : nome;
}

static void registar(const String &tipo) {
  led_laranja();
  ui_a_ler("A registar...");
  desenhar();
  Registo r = api_registar(uidAtual, tipo);
  if (r.status == 200) {
    mostrar_resultado(true, rotulo_tipo(r.tipo), "Registado às " + r.hora, "Bom trabalho, " + primeiro_nome(r.nome));
    return;
  }
  if (tratar_erro(r)) return;
  mostrar_resultado(false, "Não registado", r.erro);
}

static void cartao_lido(const String &uid) {
  uidAtual = uid;
  Serial.printf("[nfc] cartão %s\n", uid.c_str());
  led_laranja();
  ui_a_ler("A ler o cartão...");
  desenhar();

  idAtual = api_identificar(uid);
  if (idAtual.status != 200) {
    if (tratar_erro(idAtual)) return;
    if (idAtual.codigo == "cartao_desconhecido")
      mostrar_resultado(false, "Cartão não reconhecido", "Fala com o responsável da obra.");
    else
      mostrar_resultado(false, "Não foi possível", idAtual.erro);
    return;
  }
  if (idAtual.resultado == "associado") {
    associacaoPendente = false;
    mostrar_resultado(true, "Cartão associado", idAtual.nome, "Já pode picar o ponto.");
    return;
  }
  if (idAtual.resultado == "concluido" || idAtual.nValidas == 0) {
    mostrar_resultado(true, idAtual.nome, "O registo de hoje já está concluído.");
    return;
  }
  estado = IDENTIFICADO;
  estadoDesde = millis();
  ultimaContagem = -1;
  ui_identificado(idAtual);
}

static void consultar_estado() {
  EstadoTerminal e = api_estado();
  ultimoEstado = millis();
  if (e.status == 401) {
    reativar(e.erro);
    return;
  }
  if (e.status != 200) return;  // sem rede: tenta na próxima volta
  ui_set_cabecalho(e.nomeCliente, e.nomeTerminal);
  bool mudou = (e.associacaoPendente != associacaoPendente) || (e.associacaoNome != associacaoNome);
  associacaoPendente = e.associacaoPendente;
  associacaoNome = e.associacaoNome;
  if (mudou && estado == ESPERA) ir_espera();
}

// ---------- Wi-Fi + ativação ----------

static void ligar_e_ativar() {
  WiFiManager wm;
  String token = prefs.getString("token", "");
  String ap = "Ponto-" + String((uint32_t)ESP.getEfuseMac(), HEX).substring(0, 4);
  ap.toUpperCase();

  WiFiManagerParameter pCodigo("codigo", "Código de ativação (8 caracteres, do admin)", "", 10);
  wm.addParameter(&pCodigo);
  wm.setTitle("Terminal de Ponto");
  wm.setConnectTimeout(20);
  wm.setAPCallback([&](WiFiManager *) {
    ui_info(ICON_WIFI, "Configurar terminal",
            "Liga o telemóvel à rede " + ap + " e abre 192.168.4.1",
            "Escolhe o Wi-Fi da obra e escreve o código de ativação.");
    led_laranja();
    desenhar();
  });

  ui_info(ICON_WIFI, "A ligar ao Wi-Fi", "Um momento...");
  desenhar();

  bool ligado = token.length() ? wm.autoConnect(ap.c_str()) : wm.startConfigPortal(ap.c_str());
  if (!ligado) {
    ui_info(ICON_ERRO, "Sem Wi-Fi", "Não foi possível ligar. A reiniciar...");
    desenhar();
    delay(4000);
    ESP.restart();
  }

  if (!token.length()) {
    String codigo = String(pCodigo.getValue());
    codigo.trim();
    ui_info(ICON_CARTAO, "A ativar terminal", "Código " + codigo);
    desenhar();
    String novo;
    ApiResposta r = api_ativar(codigo, novo);
    if (r.status != 200 || novo.length() < 32) {
      ui_info(ICON_ERRO, "Ativação falhou", r.erro.length() ? r.erro : String("Código inválido"),
              "A reabrir a configuração...");
      led_vermelho();
      desenhar();
      delay(6000);
      ESP.restart();
    }
    prefs.putString("token", novo);
    token = novo;
  }
  api_set_token(token);
}

// Manter o BOOT 5 s apaga Wi-Fi e token e reabre a configuração.
static void verificar_boot() {
  if (digitalRead(PIN_BOOT) == LOW) {
    if (!bootDesde) bootDesde = millis();
    if (millis() - bootDesde > 5000) {
      ui_info(ICON_WIFI, "A repor configuração", "Wi-Fi e ativação apagados.");
      desenhar();
      prefs.putString("token", "");
      WiFiManager wm;
      wm.resetSettings();
      delay(2000);
      ESP.restart();
    }
  } else {
    bootDesde = 0;
  }
}

// ---------- Arduino ----------

void setup() {
  Serial.begin(115200);
  pinMode(PIN_BOOT, INPUT_PULLUP);
  prefs.begin("terminal", false);

  display_init();
  ui_init();
  led_laranja();

  ligar_e_ativar();

  configTzTime(TZ_PADRAO, "pool.ntp.org", "time.google.com");
  nfcOk = nfc_init();
  consultar_estado();
  atualizar_relogio();
  ir_espera();
}

void loop() {
  lv_timer_handler();
  verificar_boot();
  uint32_t agora = millis();

  if (agora - ultimoRelogio > 1000) {
    ultimoRelogio = agora;
    atualizar_relogio();
  }

  switch (estado) {
    case ESPERA: {
      if (!nfcOk) {  // tenta de novo de 5 em 5 s, sem precisar de reiniciar
        if (agora - estadoDesde > 5000) {
          nfcOk = nfc_init();
          ir_espera();
        }
        break;
      }
      uint32_t intervalo = associacaoPendente ? ESTADO_POLL_ASSOC : ESTADO_POLL_MS;
      if (agora - ultimoEstado > intervalo) consultar_estado();
      if (agora - ultimoNfc > NFC_POLL_INTERVAL) {
        ultimoNfc = agora;
        String uid;
        if (nfc_poll(uid)) cartao_lido(uid);
      }
      break;
    }

    case IDENTIFICADO: {
      String tipo;
      if (ui_acao_escolhida(tipo)) {
        if (tipo == "cancelar") ir_espera();
        else registar(tipo);
        break;
      }
      uint32_t passou = agora - estadoDesde;
      if (idAtual.nValidas == 1) {
        // Uma só ação possível: confirma sozinho ao fim de 3 s (igual à app).
        int falta = (AUTO_CONFIRMA_MS - (int)passou + 999) / 1000;
        if (falta != ultimaContagem) {
          ultimaContagem = falta;
          ui_contagem(falta > 0 ? falta : 0);
        }
        if (passou >= AUTO_CONFIRMA_MS) registar(idAtual.validas[0]);
      } else if (passou > ESCOLHA_TIMEOUT_MS) {
        ir_espera();
      }
      break;
    }

    case RESULTADO:
      if (agora - estadoDesde > RESULTADO_MS) ir_espera();
      break;
  }
  delay(5);
}
