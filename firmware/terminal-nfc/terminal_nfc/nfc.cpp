#include "nfc.h"
#include "config.h"
#include <Wire.h>
#include <Adafruit_PN532.h>

// O conector de 4 pinos não traz IRQ nem RESET: 255 = "sem pino". Em I2C a
// biblioteca (v1.3.x) sabe se o PN532 está pronto lendo o byte de estado.
static Adafruit_PN532 pn532(255, 255, &Wire);

static String ultimoUid;
static uint32_t ultimoVisto = 0;

bool nfc_init() {
  // Wire já foi iniciado pelo táctil (38/39, 100 kHz); begin() aqui não o refaz.
  if (!pn532.begin()) return false;
  uint32_t versao = pn532.getFirmwareVersion();
  if (!versao) return false;
  Serial.printf("[nfc] PN5%02X firmware %u.%u\n", (unsigned)((versao >> 24) & 0xFF),
                (unsigned)((versao >> 16) & 0xFF), (unsigned)((versao >> 8) & 0xFF));
  pn532.SAMConfig();
  return true;
}

bool nfc_poll(String &uidHex) {
  uint8_t uid[10];
  uint8_t len = 0;
  if (!pn532.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &len, NFC_READ_TIMEOUT)) {
    return false;
  }

  char hex[21] = {0};
  for (uint8_t i = 0; i < len && i < 10; i++) sprintf(hex + i * 2, "%02X", uid[i]);
  String atual(hex);

  // Cartão pousado em cima do leitor é lido a cada volta do loop — só conta
  // como toque novo se for outro cartão ou se o mesmo saiu e voltou.
  uint32_t agora = millis();
  bool repetido = (atual == ultimoUid) && (agora - ultimoVisto < MESMO_CARTAO_IGNORA);
  ultimoVisto = agora;
  ultimoUid = atual;
  if (repetido) return false;

  uidHex = atual;
  return true;
}
