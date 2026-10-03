// Leitor PN532 em I2C (endereço 0x24) no mesmo barramento do táctil.
#pragma once
#include <Arduino.h>

bool nfc_init();                 // false = PN532 não respondeu (ver ligações / interruptor I2C)
bool nfc_poll(String &uidHex);   // true quando há um cartão NOVO; uidHex = "04A23F1BC45D80"
