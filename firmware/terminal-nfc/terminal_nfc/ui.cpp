#include "ui.h"
#include "config.h"
#include <lvgl.h>

// Fontes geradas com lv_font_conv (Barlow Condensed com acentos PT + FontAwesome).
LV_FONT_DECLARE(font_barlow_20);
LV_FONT_DECLARE(font_barlow_28);
LV_FONT_DECLARE(font_barlow_40);
LV_FONT_DECLARE(font_icons_20);
LV_FONT_DECLARE(font_icons_32);
LV_FONT_DECLARE(font_icons_80);

#define COR_FUNDO   lv_color_hex(0x0B1520)
#define COR_BARRA   lv_color_hex(0x081018)
#define COR_LARANJA lv_color_hex(0xEB8D00)
#define COR_VERDE   lv_color_hex(0x1F6B47)
#define COR_VERMELHO lv_color_hex(0xC70036)
#define COR_ARDOSIA lv_color_hex(0x2B3A4A)
#define COR_TEXTO   lv_color_hex(0xFFFFFF)
#define COR_SUAVE   lv_color_hex(0x8A97A6)
#define COR_PRETO   lv_color_hex(0x000000)

static lv_obj_t *barra, *lblCliente, *lblHora, *lblWifi;
static lv_obj_t *corpo;            // área por baixo da barra, limpa a cada ecrã
static lv_obj_t *lblContagem = nullptr;

static String acaoPendente;
static bool temAcao = false;

// ---------- auxiliares ----------

static lv_obj_t *label(lv_obj_t *pai, const String &txt, const lv_font_t *f, lv_color_t cor) {
  lv_obj_t *l = lv_label_create(pai);
  lv_label_set_text(l, txt.c_str());
  lv_obj_set_style_text_font(l, f, 0);
  lv_obj_set_style_text_color(l, cor, 0);
  return l;
}

static lv_obj_t *caixa(lv_obj_t *pai) {
  lv_obj_t *o = lv_obj_create(pai);
  lv_obj_remove_style_all(o);
  lv_obj_clear_flag(o, LV_OBJ_FLAG_SCROLLABLE);
  return o;
}

static void limpar_corpo(bool comBarra = true) {
  lblContagem = nullptr;
  lv_obj_clean(corpo);
  if (comBarra) {
    lv_obj_clear_flag(barra, LV_OBJ_FLAG_HIDDEN);
    lv_obj_set_pos(corpo, 0, 40);
    lv_obj_set_size(corpo, SCREEN_W, SCREEN_H - 40);
  } else {
    lv_obj_add_flag(barra, LV_OBJ_FLAG_HIDDEN);
    lv_obj_set_pos(corpo, 0, 0);
    lv_obj_set_size(corpo, SCREEN_W, SCREEN_H);
  }
  lv_obj_set_style_bg_color(corpo, COR_FUNDO, 0);
}

static void ao_tocar(lv_event_t *e) {
  const char *tipo = (const char *)lv_event_get_user_data(e);
  acaoPendente = tipo;
  temAcao = true;
}

// Botão grande arredondado com ícone opcional e texto.
static lv_obj_t *botao(lv_obj_t *pai, const char *tipo, const char *icone, const String &txt,
                       lv_color_t fundo, lv_color_t cor) {
  lv_obj_t *b = lv_btn_create(pai);
  lv_obj_set_style_bg_color(b, fundo, 0);
  lv_obj_set_style_radius(b, 14, 0);
  lv_obj_set_style_shadow_width(b, 0, 0);
  lv_obj_set_flex_flow(b, LV_FLEX_FLOW_ROW);
  lv_obj_set_flex_align(b, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
  lv_obj_set_style_pad_left(b, 22, 0);
  lv_obj_set_style_pad_column(b, 14, 0);
  if (icone) label(b, icone, &font_icons_32, cor);
  label(b, txt, &font_barlow_40, cor);
  lv_obj_add_event_cb(b, ao_tocar, LV_EVENT_CLICKED, (void *)tipo);
  return b;
}

static String iniciais(const String &nome) {
  String r;
  int espaco = nome.lastIndexOf(' ');
  if (nome.length()) r += (char)toupper(nome[0]);
  if (espaco > 0 && espaco + 1 < (int)nome.length()) r += (char)toupper(nome[espaco + 1]);
  return r;
}

static lv_obj_t *avatar(lv_obj_t *pai, const String &nome, int tam) {
  lv_obj_t *a = caixa(pai);
  lv_obj_set_size(a, tam, tam);
  lv_obj_set_style_radius(a, LV_RADIUS_CIRCLE, 0);
  lv_obj_set_style_bg_opa(a, LV_OPA_COVER, 0);
  lv_obj_set_style_bg_color(a, COR_LARANJA, 0);
  lv_obj_t *l = label(a, iniciais(nome), &font_barlow_40, COR_PRETO);
  lv_obj_center(l);
  return a;
}

// Os tipos vivem em memória estática: o user_data dos botões aponta para aqui.
static const char *TIPOS[] = {"entrada", "inicio_pausa", "fim_pausa", "saida"};
static const char *tipo_estatico(const String &t) {
  for (const char *s : TIPOS) if (t == s) return s;
  return "entrada";
}
static const char *icone_tipo(const String &t) {
  if (t == "inicio_pausa") return ICON_PAUSA;
  if (t == "saida") return ICON_SAIDA;
  return nullptr;
}

// ---------- API pública ----------

void ui_init() {
  lv_obj_t *scr = lv_scr_act();
  lv_obj_set_style_bg_color(scr, COR_FUNDO, 0);
  lv_obj_clear_flag(scr, LV_OBJ_FLAG_SCROLLABLE);

  barra = caixa(scr);
  lv_obj_set_size(barra, SCREEN_W, 40);
  lv_obj_set_style_bg_opa(barra, LV_OPA_COVER, 0);
  lv_obj_set_style_bg_color(barra, COR_BARRA, 0);
  lblCliente = label(barra, "", &font_barlow_20, COR_TEXTO);
  lv_obj_align(lblCliente, LV_ALIGN_LEFT_MID, 14, 0);
  lv_label_set_long_mode(lblCliente, LV_LABEL_LONG_DOT);
  lv_obj_set_width(lblCliente, 330);
  lblHora = label(barra, "--:--", &font_barlow_28, COR_TEXTO);
  lv_obj_align(lblHora, LV_ALIGN_RIGHT_MID, -14, 0);
  lblWifi = label(barra, ICON_WIFI, &font_icons_20, COR_SUAVE);
  lv_obj_align(lblWifi, LV_ALIGN_RIGHT_MID, -76, 0);

  corpo = caixa(scr);
  lv_obj_set_style_bg_opa(corpo, LV_OPA_COVER, 0);
  limpar_corpo();
}

void ui_set_cabecalho(const String &cliente, const String &terminal) {
  String t = cliente;
  if (terminal.length()) t += "  ·  " + terminal;
  lv_label_set_text(lblCliente, t.c_str());
}

void ui_set_hora(const String &hhmm) { lv_label_set_text(lblHora, hhmm.c_str()); }

void ui_set_wifi(bool ligado) {
  lv_obj_set_style_text_color(lblWifi, ligado ? COR_SUAVE : COR_LARANJA, 0);
}

void ui_espera(const String &data, const String &associacaoNome) {
  limpar_corpo();
  lv_obj_t *anel = caixa(corpo);
  lv_obj_set_size(anel, 160, 160);
  lv_obj_align(anel, LV_ALIGN_LEFT_MID, 28, 0);
  lv_obj_set_style_radius(anel, LV_RADIUS_CIRCLE, 0);
  lv_obj_set_style_border_width(anel, 3, 0);
  lv_obj_set_style_border_color(anel, COR_LARANJA, 0);
  lv_obj_t *ic = label(anel, ICON_CARTAO, &font_icons_80, COR_LARANJA);
  lv_obj_center(ic);

  lv_obj_t *t = label(corpo, "Aproxima\no cartão", &font_barlow_40, COR_TEXTO);
  lv_obj_set_style_text_line_space(t, -4, 0);
  lv_obj_align(t, LV_ALIGN_LEFT_MID, 216, -16);
  lv_obj_t *d = label(corpo, data, &font_barlow_20, COR_SUAVE);
  lv_obj_align_to(d, t, LV_ALIGN_OUT_BOTTOM_LEFT, 0, 8);

  if (associacaoNome.length()) {
    // Pedido de associação feito no admin: o próximo cartão novo fica deste trabalhador.
    lv_obj_t *faixa = caixa(corpo);
    lv_obj_set_size(faixa, SCREEN_W, 40);
    lv_obj_align(faixa, LV_ALIGN_BOTTOM_MID, 0, 0);
    lv_obj_set_style_bg_opa(faixa, LV_OPA_COVER, 0);
    lv_obj_set_style_bg_color(faixa, COR_LARANJA, 0);
    lv_obj_t *l = label(faixa, "A associar cartão novo a " + associacaoNome, &font_barlow_20, COR_PRETO);
    lv_obj_center(l);
  }
}

void ui_a_ler(const String &texto) {
  limpar_corpo();
  lv_obj_t *s = lv_spinner_create(corpo, 1000, 60);
  lv_obj_set_size(s, 90, 90);
  lv_obj_set_style_arc_color(s, COR_LARANJA, LV_PART_INDICATOR);
  lv_obj_align(s, LV_ALIGN_CENTER, 0, -24);
  lv_obj_t *l = label(corpo, texto, &font_barlow_28, COR_TEXTO);
  lv_obj_align(l, LV_ALIGN_CENTER, 0, 56);
}

void ui_identificado(const Identificacao &id) {
  limpar_corpo();
  temAcao = false;

  if (id.nValidas == 1) {
    // Uma só ação: trabalhador em cima, botão grande com contagem em baixo.
    lv_obj_t *av = avatar(corpo, id.nome, 84);
    lv_obj_align(av, LV_ALIGN_TOP_LEFT, 22, 24);
    lv_obj_t *n = label(corpo, id.nome, &font_barlow_40, COR_TEXTO);
    lv_label_set_long_mode(n, LV_LABEL_LONG_DOT);
    lv_obj_set_width(n, 330);
    lv_obj_align_to(n, av, LV_ALIGN_OUT_RIGHT_TOP, 20, 4);
    String sub = id.entrada.length() ? "Entrada " + id.entrada : String("Sem registos hoje");
    lv_obj_t *s = label(corpo, sub, &font_barlow_20, COR_SUAVE);
    lv_obj_align_to(s, n, LV_ALIGN_OUT_BOTTOM_LEFT, 0, 6);

    const char *tipo = tipo_estatico(id.validas[0]);
    lv_obj_t *b = botao(corpo, tipo, icone_tipo(tipo), rotulo_tipo(tipo), COR_LARANJA, COR_PRETO);
    lv_obj_set_size(b, 316, 92);
    lv_obj_align(b, LV_ALIGN_BOTTOM_LEFT, 14, -14);
    lblContagem = label(b, "", &font_barlow_20, COR_PRETO);
    lv_obj_add_flag(lblContagem, LV_OBJ_FLAG_FLOATING);
    lv_obj_align(lblContagem, LV_ALIGN_RIGHT_MID, -14, 0);

    lv_obj_t *c = lv_btn_create(corpo);
    lv_obj_set_size(c, 122, 92);
    lv_obj_align(c, LV_ALIGN_BOTTOM_RIGHT, -14, -14);
    lv_obj_set_style_bg_color(c, COR_ARDOSIA, 0);
    lv_obj_set_style_radius(c, 14, 0);
    lv_obj_set_style_shadow_width(c, 0, 0);
    lv_obj_t *cl = label(c, "Cancelar", &font_barlow_28, COR_TEXTO);
    lv_obj_center(cl);
    lv_obj_add_event_cb(c, ao_tocar, LV_EVENT_CLICKED, (void *)"cancelar");
    return;
  }

  // Várias ações (ex.: Pausa ou Saída): trabalhador à esquerda, botões empilhados à direita.
  lv_obj_t *col = caixa(corpo);
  lv_obj_set_size(col, 150, SCREEN_H - 40);
  lv_obj_align(col, LV_ALIGN_LEFT_MID, 8, 0);
  lv_obj_set_flex_flow(col, LV_FLEX_FLOW_COLUMN);
  lv_obj_set_flex_align(col, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
  lv_obj_set_style_pad_row(col, 8, 0);
  avatar(col, id.nome, 84);
  lv_obj_t *n = label(col, id.nome, &font_barlow_28, COR_TEXTO);
  lv_label_set_long_mode(n, LV_LABEL_LONG_WRAP);
  lv_obj_set_width(n, 146);
  lv_obj_set_style_text_align(n, LV_TEXT_ALIGN_CENTER, 0);
  if (id.entrada.length()) {
    lv_obj_t *s = label(col, "Entrada " + id.entrada, &font_barlow_20, COR_SUAVE);
    lv_obj_set_style_text_align(s, LV_TEXT_ALIGN_CENTER, 0);
  }

  lv_obj_t *botoes = caixa(corpo);
  lv_obj_set_size(botoes, SCREEN_W - 172, SCREEN_H - 40 - 28);
  lv_obj_align(botoes, LV_ALIGN_RIGHT_MID, -14, 0);
  lv_obj_set_flex_flow(botoes, LV_FLEX_FLOW_COLUMN);
  lv_obj_set_style_pad_row(botoes, 12, 0);
  for (int i = 0; i < id.nValidas; i++) {
    const char *tipo = tipo_estatico(id.validas[i]);
    bool principal = (i == 0);
    lv_obj_t *b = botao(botoes, tipo, icone_tipo(tipo), rotulo_tipo(tipo),
                        principal ? COR_LARANJA : COR_ARDOSIA, principal ? COR_PRETO : COR_TEXTO);
    lv_obj_set_width(b, lv_pct(100));
    lv_obj_set_flex_grow(b, 1);
  }
}

void ui_contagem(int segundos) {
  if (!lblContagem) return;
  String t = "confirma em " + String(segundos) + "s";
  lv_label_set_text(lblContagem, t.c_str());
}

void ui_resultado(bool ok, const String &titulo, const String &linha1, const String &linha2) {
  limpar_corpo(false);
  lv_obj_set_style_bg_color(corpo, ok ? COR_VERDE : COR_VERMELHO, 0);
  lv_obj_t *ic = label(corpo, ok ? ICON_OK : ICON_ERRO, &font_icons_80, COR_TEXTO);
  lv_obj_align(ic, LV_ALIGN_LEFT_MID, 40, 0);
  lv_obj_t *t = label(corpo, titulo, &font_barlow_40, COR_TEXTO);
  lv_label_set_long_mode(t, LV_LABEL_LONG_WRAP);
  lv_obj_set_width(t, 300);
  lv_obj_align(t, LV_ALIGN_LEFT_MID, 150, -30);
  lv_obj_t *l1 = label(corpo, linha1, &font_barlow_28, COR_TEXTO);
  lv_label_set_long_mode(l1, LV_LABEL_LONG_WRAP);
  lv_obj_set_width(l1, 300);
  lv_obj_align_to(l1, t, LV_ALIGN_OUT_BOTTOM_LEFT, 0, 6);
  if (linha2.length()) {
    lv_obj_t *l2 = label(corpo, linha2, &font_barlow_20, COR_TEXTO);
    lv_obj_set_style_text_opa(l2, LV_OPA_80, 0);
    lv_obj_align_to(l2, l1, LV_ALIGN_OUT_BOTTOM_LEFT, 0, 6);
  }
}

void ui_info(const char *icone, const String &titulo, const String &linha1, const String &linha2) {
  limpar_corpo();
  lv_obj_t *ic = label(corpo, icone, &font_icons_80, COR_LARANJA);
  lv_obj_align(ic, LV_ALIGN_LEFT_MID, 36, 0);
  lv_obj_t *t = label(corpo, titulo, &font_barlow_40, COR_TEXTO);
  lv_label_set_long_mode(t, LV_LABEL_LONG_WRAP);
  lv_obj_set_width(t, 310);
  lv_obj_align(t, LV_ALIGN_LEFT_MID, 150, -34);
  lv_obj_t *l1 = label(corpo, linha1, &font_barlow_20, lv_color_hex(0xCBD5E1));
  lv_label_set_long_mode(l1, LV_LABEL_LONG_WRAP);
  lv_obj_set_width(l1, 310);
  lv_obj_align_to(l1, t, LV_ALIGN_OUT_BOTTOM_LEFT, 0, 8);
  if (linha2.length()) {
    lv_obj_t *l2 = label(corpo, linha2, &font_barlow_20, COR_SUAVE);
    lv_label_set_long_mode(l2, LV_LABEL_LONG_WRAP);
    lv_obj_set_width(l2, 310);
    lv_obj_align_to(l2, l1, LV_ALIGN_OUT_BOTTOM_LEFT, 0, 6);
  }
}

bool ui_acao_escolhida(String &tipo) {
  if (!temAcao) return false;
  temAcao = false;
  tipo = acaoPendente;
  return true;
}
