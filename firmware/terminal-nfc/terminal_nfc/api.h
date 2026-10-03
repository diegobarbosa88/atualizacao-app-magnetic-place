// Cliente dos endpoints /api/ponto/terminal-* (os mesmos do piloto Android).
// Contrato em api/formacao/index.js (handlePontoTerminal*).
#pragma once
#include <Arduino.h>

struct ApiResposta {
  int status = 0;        // HTTP status; 0 = sem ligação / timeout
  String erro;           // campo "error" da resposta (mensagem já em PT para mostrar)
  String codigo;         // campo "code" (terminal_revogado, cartao_desconhecido, repetido, ...)
};

struct Identificacao : ApiResposta {
  String resultado;      // identificado | concluido | associado
  String nome;           // worker.name
  String validas[4];     // entrada | inicio_pausa | fim_pausa | saida
  int nValidas = 0;
  String hora;           // HH:MM do servidor
  String entrada;        // hoje.startTime (pode vir vazio)
};

struct Registo : ApiResposta {
  String tipo;
  String hora;
  String nome;
};

struct EstadoTerminal : ApiResposta {
  String nomeTerminal;
  String nomeCliente;
  bool associacaoPendente = false;
  String associacaoNome;
};

void api_set_token(const String &token);
bool api_tem_token();

// Troca o código de ativação (8 caracteres, do admin) pelo token do dispositivo.
ApiResposta api_ativar(const String &codigo, String &tokenOut);
EstadoTerminal api_estado();
Identificacao api_identificar(const String &uid);
Registo api_registar(const String &uid, const String &tipo);

const char *rotulo_tipo(const String &tipo);  // "Entrada", "Início de pausa", ...
