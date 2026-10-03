// Ecrãs LVGL do terminal, iguais à maquete aprovada (480x320, horizontal).
#pragma once
#include <Arduino.h>
#include "api.h"

void ui_init();

// Barra de cima: nome do cliente · terminal, ícone de Wi-Fi e hora.
void ui_set_cabecalho(const String &cliente, const String &terminal);
void ui_set_hora(const String &hhmm);
void ui_set_wifi(bool ligado);

void ui_espera(const String &dataPorExtenso, const String &associacaoNome);
void ui_a_ler(const String &texto);   // spinner + "A ler o cartão..." / "A registar..."
// Mostra o trabalhador e as ações. Com 1 ação: botão grande com contagem
// decrescente. Com 2+: um botão por ação.
void ui_identificado(const Identificacao &id);
void ui_contagem(int segundos);             // atualiza "confirma em Ns"
void ui_resultado(bool ok, const String &titulo, const String &linha1, const String &linha2 = "");
// Ecrã de informação (arranque, portal Wi-Fi, ativação, PN532 em falta...).
void ui_info(const char *icone, const String &titulo, const String &linha1, const String &linha2 = "");

// O loop principal recolhe aqui o que o utilizador tocou.
// Devolve true uma vez por toque; tipo = "entrada"/"saida"/... ou "cancelar".
bool ui_acao_escolhida(String &tipo);

// Ícones (FontAwesome, já incluídos na fonte de ícones).
#define ICON_OK      "\xEF\x80\x8C"
#define ICON_ERRO    "\xEF\x80\x8D"
#define ICON_CARTAO  "\xEF\x8B\x81"
#define ICON_NUVEM   "\xEF\x83\xAE"
#define ICON_WIFI    "\xEF\x87\xAB"
#define ICON_PAUSA   "\xEF\x83\xB4"
#define ICON_SAIDA   "\xEF\x8B\xB5"
