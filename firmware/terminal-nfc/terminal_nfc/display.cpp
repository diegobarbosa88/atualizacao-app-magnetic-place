#include "display.h"
#include "config.h"
#include <SPI.h>
#include "ST77922.h"
#include "ST77922_Touch.h"

static ST77922 tft;
static ST77922_TOUCH touch;

static lv_disp_draw_buf_t draw_buf;
static lv_color_t buf[SCREEN_W * 40];

// O ST77922 só aceita janelas alinhadas a 4 píxeis (igual ao exemplo da Freenove).
static void rounder_cb(lv_disp_drv_t *, lv_area_t *area) {
  area->x1 &= ~0x3;
  area->y1 &= ~0x3;
  area->x2 |= 0x3;
  area->y2 |= 0x3;
}

static void flush_cb(lv_disp_drv_t *disp, const lv_area_t *area, lv_color_t *color_p) {
  uint32_t w = area->x2 - area->x1 + 1;
  uint32_t h = area->y2 - area->y1 + 1;
  tft.Fill_Colors(area->x1, area->y1, w, h, (uint16_t *)color_p);
  lv_disp_flush_ready(disp);
}

static void touch_cb(lv_indev_drv_t *, lv_indev_data_t *data) {
  if (touch.Get_Touch()) {
    uint16_t x = touch.touch.x[0];
    uint16_t y = touch.touch.y[0];
    if (x < SCREEN_W && y < SCREEN_H) {
      data->state = LV_INDEV_STATE_PR;
      data->point.x = x;
      data->point.y = y;
      return;
    }
  }
  data->state = LV_INDEV_STATE_REL;
}

void display_init() {
  tft.Init();
  tft.Set_Rotation(SCREEN_ROTATION);
  // touch.init() faz Wire.begin(38, 39) a 100 kHz — o PN532 reaproveita o mesmo Wire.
  touch.init();
  touch.Set_Rotation(SCREEN_ROTATION);

  lv_init();
  lv_disp_draw_buf_init(&draw_buf, buf, NULL, SCREEN_W * 40);

  static lv_disp_drv_t disp_drv;
  lv_disp_drv_init(&disp_drv);
  disp_drv.hor_res = SCREEN_W;
  disp_drv.ver_res = SCREEN_H;
  disp_drv.flush_cb = flush_cb;
  disp_drv.rounder_cb = rounder_cb;
  disp_drv.draw_buf = &draw_buf;
  lv_disp_drv_register(&disp_drv);

  static lv_indev_drv_t indev_drv;
  lv_indev_drv_init(&indev_drv);
  indev_drv.type = LV_INDEV_TYPE_POINTER;
  indev_drv.read_cb = touch_cb;
  lv_indev_drv_register(&indev_drv);
}
