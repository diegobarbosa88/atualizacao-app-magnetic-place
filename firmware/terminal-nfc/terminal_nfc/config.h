// Configuração do terminal de ponto NFC (Freenove FNK0104N 3,5" + PN532).
// Única coisa a editar antes de gravar: API_BASE_URL e, se for preciso, o
// certificado raiz (ROOT_CA). Wi-Fi e código de ativação são pedidos no
// próprio terminal (portal "Ponto-XXXX"), não ficam no código.
#pragma once

// URL da app (sem barra no fim). O terminal chama ${API_BASE_URL}/api/ponto/...
// — os mesmos endpoints que o piloto Android já usa.
#define API_BASE_URL "https://SUBSTITUIR.vercel.app"

// Certificado raiz do domínio acima, em PEM. Ver o guia do projeto
// ("Firmware → certificado") para o exportar do browser. Deixar vazio
// ("") desliga a verificação TLS — só aceitável em bancada, NUNCA em obra.
static const char ROOT_CA[] = "";

// --- Pinos da placa (confirmados no esquemático da Freenove) ---
#define PIN_I2C_SDA 38   // conector P4, partilhado com o táctil (0x55) e o codec (0x18)
#define PIN_I2C_SCL 39
#define PIN_LED_WS2812 40   // WS2812B
#define I2C_FREQ_HZ 100000

// --- Ecrã ---
// 1 = horizontal (480x320), como na maquete aprovada. Se o toque ficar
// desalinhado, experimentar 3 (horizontal invertido).
#define SCREEN_ROTATION 1
#define SCREEN_W 480
#define SCREEN_H 320

// --- Tempos (ms) ---
#define NFC_POLL_INTERVAL   150   // intervalo entre leituras do PN532
#define NFC_READ_TIMEOUT     40   // quanto tempo cada leitura espera por um cartão
#define MESMO_CARTAO_IGNORA 4000  // o mesmo cartão parado em cima do leitor não dispara de novo
#define AUTO_CONFIRMA_MS    3000  // só quando há UMA ação válida (igual à app)
#define ESCOLHA_TIMEOUT_MS 15000  // sem escolha → volta à espera
#define RESULTADO_MS        3500  // tempo do ecrã verde/vermelho
#define ESTADO_POLL_MS     30000  // pergunta ao servidor pelo estado do terminal
#define ESTADO_POLL_ASSOC   3000  // ... mais depressa quando há associação pendente
#define HTTP_TIMEOUT_MS     8000
