# Terminal de ponto NFC — firmware e caixa

Terminal fixo para a obra: placa **Freenove ESP32-S3 3,5" (FNK0104N)** + leitor **PN532** em I2C.
Fala com os mesmos endpoints do piloto Android (`/api/ponto/terminal-*`); o servidor não muda.

- `terminal_nfc/` — sketch Arduino (abrir `terminal_nfc.ino`). Só se edita `config.h`.
- `caixa/` — `gerar_caixa.py` gera `caixa_frente.stl` e `caixa_tras.stl` (124 × 114 × 21 mm).
- `ecras.png` — os ecrãs, renderizados a partir do próprio código LVGL.

## Gravar

1. Arduino IDE 2, placa **esp32 (Espressif) 3.2.0**.
2. Bibliotecas da Freenove (`Libraries/FNK0104N` do repositório Freenove_ESP32_S3_Display):
   TFT_eSPI 2.5.43 modificado, lvgl 8.4.0, TFT_eSPI_Setups. Não atualizar.
3. Gestor de bibliotecas: Adafruit PN532 1.3.4, Adafruit BusIO, ArduinoJson 7.x, WiFiManager (tzapu) 2.0.17.
4. `config.h`: `API_BASE_URL` (e `ROOT_CA` antes de ir para obra).
5. Placa "ESP32S3 Dev Module": PSRAM = OPI PSRAM · Flash = 16MB ·
   Partition = **16M Flash (3MB APP/9.9MB FATFS)** · USB CDC On Boot = Enabled.

Compilado sem avisos com o core 3.2.0: 1,54 MB de 3 MB.

## Ligações do PN532 (interruptor: 1 = ON, 2 = OFF)

| Placa (conector P4) | PN532 |
| --- | --- |
| 3.3V | VCC (nunca 5 V) |
| GND | GND |
| IO38 | SDA |
| IO39 | SCL |

## Primeiro arranque

O terminal abre a rede Wi-Fi `Ponto-XXXX`. Ligar o telemóvel, abrir `192.168.4.1`,
escolher o Wi-Fi da obra e escrever o código de ativação do admin. BOOT 5 s = reconfigurar.
