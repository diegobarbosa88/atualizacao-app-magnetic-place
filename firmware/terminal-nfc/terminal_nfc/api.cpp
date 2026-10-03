#include "api.h"
#include "config.h"
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

static String g_token;

void api_set_token(const String &token) { g_token = token; }
bool api_tem_token() { return g_token.length() >= 32; }

const char *rotulo_tipo(const String &t) {
  if (t == "entrada") return "Entrada";
  if (t == "inicio_pausa") return "Início de pausa";
  if (t == "fim_pausa") return "Fim de pausa";
  if (t == "saida") return "Saída";
  return "Registo";
}

// Um pedido HTTPS com corpo JSON. Preenche status/erro/codigo e devolve o
// documento JSON da resposta em `doc`.
static void pedido(const char *acao, const char *metodo, const String &corpo,
                   ApiResposta &r, JsonDocument &doc) {
  if (WiFi.status() != WL_CONNECTED) {
    r.status = 0;
    r.erro = "Sem ligação à rede";
    return;
  }

  WiFiClientSecure cliente;
  if (strlen(ROOT_CA) > 0) cliente.setCACert(ROOT_CA);
  else cliente.setInsecure();  // só bancada — ver config.h

  HTTPClient http;
  String url = String(API_BASE_URL) + "/api/ponto/" + acao;
  if (!http.begin(cliente, url)) {
    r.status = 0;
    r.erro = "URL inválido";
    return;
  }
  http.setTimeout(HTTP_TIMEOUT_MS);
  http.addHeader("Content-Type", "application/json");
  if (g_token.length()) http.addHeader("x-terminal-token", g_token);

  r.status = (strcmp(metodo, "POST") == 0) ? http.POST(corpo) : http.GET();
  if (r.status <= 0) {
    r.erro = "Servidor não responde";
    r.status = 0;
    http.end();
    return;
  }

  String resposta = http.getString();
  http.end();

  if (deserializeJson(doc, resposta)) {
    if (r.status >= 400) r.erro = "Erro do servidor (" + String(r.status) + ")";
    return;
  }
  if (r.status >= 400) {
    r.erro = doc["error"] | "Erro desconhecido";
    r.codigo = doc["code"] | "";
  }
}

ApiResposta api_ativar(const String &codigo, String &tokenOut) {
  ApiResposta r;
  JsonDocument doc;
  JsonDocument req;
  req["codigo"] = codigo;
  String corpo;
  serializeJson(req, corpo);
  pedido("terminal-ativar", "POST", corpo, r, doc);
  if (r.status == 200) tokenOut = doc["token"] | "";
  return r;
}

EstadoTerminal api_estado() {
  EstadoTerminal r;
  JsonDocument doc;
  pedido("terminal-estado", "GET", "", r, doc);
  if (r.status == 200) {
    r.nomeTerminal = doc["terminal"]["nome"] | "";
    r.nomeCliente = doc["client"]["name"] | "";
    if (!doc["associacao"].isNull()) {
      r.associacaoPendente = true;
      r.associacaoNome = doc["associacao"]["workerName"] | "";
    }
  }
  return r;
}

Identificacao api_identificar(const String &uid) {
  Identificacao r;
  JsonDocument doc;
  JsonDocument req;
  req["uid"] = uid;
  String corpo;
  serializeJson(req, corpo);
  pedido("terminal-identificar", "POST", corpo, r, doc);
  if (r.status == 200) {
    r.resultado = doc["resultado"] | "";
    r.nome = doc["worker"]["name"] | "";
    r.hora = doc["hora"] | "";
    r.entrada = doc["hoje"]["startTime"] | "";
    for (JsonVariant v : doc["validas"].as<JsonArray>()) {
      if (r.nValidas < 4) r.validas[r.nValidas++] = v.as<String>();
    }
  }
  return r;
}

Registo api_registar(const String &uid, const String &tipo) {
  Registo r;
  JsonDocument doc;
  JsonDocument req;
  req["uid"] = uid;
  req["tipo"] = tipo;
  String corpo;
  serializeJson(req, corpo);
  pedido("terminal-registar", "POST", corpo, r, doc);
  if (r.status == 200) {
    r.tipo = doc["tipo"] | tipo;
    r.hora = doc["hora"] | "";
    r.nome = doc["worker"]["name"] | "";
  }
  return r;
}
