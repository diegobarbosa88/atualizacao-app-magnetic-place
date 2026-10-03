"""
Caixa do terminal de ponto NFC — Freenove ESP32-S3 3,5" (FNK0104N) + PN532.

Gera dois ficheiros para impressão 3D:
  caixa_frente.stl  — imprime com a face da frente na base (sem suportes)
  caixa_tras.stl    — tampa de trás com 2 furos tipo "buraco de fechadura" para a parede

Vista de frente, horizontal: a placa fica em cima, o PN532 por baixo dela,
atrás de uma zona marcada "aproxima aqui". O cabo USB-C sai por baixo, à direita.

Medidas da placa tiradas do desenho LCDwiki/QDtech ES3C35P (que parece ser a mesma
placa da Freenove — CONFIRMAR COM PAQUÍMETRO antes da impressão final):
  placa 101,5 x 54,5; furos M3 a 3,5 mm das bordas laterais e 3,3 das de cima/baixo;
  área visível 74,44 x 49,96 centrada; vidro 4,2 mm acima da placa; 4,7 mm de
  componentes atrás.

Requer: pip install manifold3d trimesh numpy
Uso:    python3 gerar_caixa.py
"""
import numpy as np
import trimesh
from manifold3d import CrossSection, JoinType, Manifold

# ---------------- parâmetros (mm) ----------------
PLACA_W, PLACA_H = 101.5, 54.5
FURO_DX, FURO_DY = 3.5, 3.3            # centro do furo em relação às bordas da placa
VISIVEL_W, VISIVEL_H = 74.44, 49.96    # área visível do ecrã (centrada na placa)
FOLGA_JANELA = 0.5                     # folga à volta da janela do ecrã
ALTURA_VIDRO = 4.2                     # da face da placa até à frente do vidro
PCB_T = 1.6

PN532_W, PN532_H, PN532_T = 42.7, 40.4, 4.0

PAREDE = 2.4          # paredes laterais
FRENTE = 2.0          # espessura da frente (o PN532 lê através dela; não passar de 3 mm)
TRAS = 3.0            # espessura da tampa de trás
RAIO = 6.0            # raio dos cantos exteriores

MARGEM = 2.0          # folga à volta da placa e do PN532
ESPACO_USB = 16.0     # espaço à direita da placa para a ficha USB-C (cotovelo recomendado)
ESPACO_CABOS = 10.0   # entre a placa e o PN532 (fichas de 1,25 mm na borda de baixo)
ESPACO_TRAS = 10.0    # atrás da placa: componentes (4,7) + fichas e cabos

M3_AUTOROSCA = 2.6    # furo para parafuso M3 entrar a rosquear no plástico
M3_PASSANTE = 3.4

# ---------------- medidas derivadas ----------------
INT_W = MARGEM + PLACA_W + ESPACO_USB
INT_H = MARGEM + PN532_H + ESPACO_CABOS + PLACA_H + MARGEM
EXT_W = INT_W + 2 * PAREDE
EXT_H = INT_H + 2 * PAREDE
PROF_FRENTE = FRENTE + ALTURA_VIDRO + PCB_T + ESPACO_TRAS   # profundidade da peça da frente

# origem: canto inferior esquerdo EXTERIOR, z=0 na face da frente (lado da impressão)
PLACA_X0 = PAREDE + MARGEM
PLACA_Y0 = PAREDE + MARGEM + PN532_H + ESPACO_CABOS
PN532_X0 = PLACA_X0 + (PLACA_W - PN532_W) / 2
PN532_Y0 = PAREDE + MARGEM


def caixa(x, y, z, w, h, d):
    return Manifold.cube([w, h, d]).translate([x, y, z])


def ret_arredondado(w, h, r):
    """Retângulo w x h com cantos de raio r, canto inferior esquerdo em (0,0)."""
    return CrossSection.square([w - 2 * r, h - 2 * r]).offset(r, JoinType.Round).translate([r, r])


def cilindro(x, y, z, d, h):
    return Manifold.cylinder(h, d / 2, d / 2, 48).translate([x, y, z])


def furos_placa():
    xs = (PLACA_X0 + FURO_DX, PLACA_X0 + PLACA_W - FURO_DX)
    ys = (PLACA_Y0 + FURO_DY, PLACA_Y0 + PLACA_H - FURO_DY)
    return [(x, y) for x in xs for y in ys]


def cantos_tampa():
    # O canto de cima à esquerda está ocupado pela placa: esse pilar desce para a
    # parede esquerda, no espaço entre a placa e o PN532.
    m = PAREDE + 4.0
    y_meio = PN532_Y0 + PN532_H + ESPACO_CABOS / 2
    return [(m, m), (EXT_W - m, m), (m, y_meio), (EXT_W - m, EXT_H - m)]


SAIDA_CABO_X = PLACA_X0 + PLACA_W - 8.0   # centro da ranhura do cabo (parede de baixo)


def frente():
    exterior = Manifold.extrude(ret_arredondado(EXT_W, EXT_H, RAIO), PROF_FRENTE)
    interior = Manifold.extrude(ret_arredondado(INT_W, INT_H, RAIO - PAREDE), PROF_FRENTE).translate([PAREDE, PAREDE, FRENTE])
    peca = exterior - interior

    # janela do ecrã (área visível centrada na placa)
    jw, jh = VISIVEL_W + 2 * FOLGA_JANELA, VISIVEL_H + 2 * FOLGA_JANELA
    jx = PLACA_X0 + (PLACA_W - jw) / 2
    jy = PLACA_Y0 + (PLACA_H - jh) / 2
    peca -= caixa(jx, jy, -1, jw, jh, FRENTE + 2)

    # 4 pilares: a placa assenta com o vidro encostado à frente; parafuso M3 por trás
    for (x, y) in furos_placa():
        peca += cilindro(x, y, FRENTE, 6.5, ALTURA_VIDRO)
        peca -= cilindro(x, y, FRENTE - 0.01, M3_AUTOROSCA, ALTURA_VIDRO + 0.02)

    # berço do PN532: 4 cantoneiras que o seguram encostado à frente (fixar com fita dupla face)
    t, alt, perna = 1.2, PN532_T + 1.0, 8.0
    x0, y0, x1, y1 = PN532_X0 - 0.3, PN532_Y0 - 0.3, PN532_X0 + PN532_W + 0.3, PN532_Y0 + PN532_H + 0.3
    for (cx, cy, sx, sy) in [(x0, y0, -1, -1), (x1, y0, 1, -1), (x0, y1, -1, 1), (x1, y1, 1, 1)]:
        bx = cx if sx > 0 else cx - t
        by = cy if sy > 0 else cy - t
        peca += caixa(bx, cy - (perna if sy > 0 else 0), FRENTE, t, perna, alt)  # perna vertical
        peca += caixa(cx - (perna if sx > 0 else 0), by, FRENTE, perna, t, alt)  # perna horizontal

    # marca "aproxima aqui": contorno de cartão gravado 0,6 mm na face da frente
    cw, ch = 34.0, 22.0
    ccx, ccy = PN532_X0 + PN532_W / 2, PN532_Y0 + PN532_H / 2
    contorno = ret_arredondado(cw, ch, 3) - ret_arredondado(cw - 2.4, ch - 2.4, 1.8).translate([1.2, 1.2])
    peca -= Manifold.extrude(contorno, 0.6).translate([ccx - cw / 2, ccy - ch / 2, 0])

    # pilares para os parafusos da tampa de trás
    for (x, y) in cantos_tampa():
        peca += cilindro(x, y, FRENTE, 7.0, PROF_FRENTE - FRENTE)
        peca -= cilindro(x, y, PROF_FRENTE - 12, M3_AUTOROSCA, 12.1)

    # saída do cabo USB-C: ranhura na parede de baixo, à direita, junto à tampa de trás
    peca -= caixa(SAIDA_CABO_X - 5, -1, PROF_FRENTE - 6, 10, PAREDE + 2, 6.1)
    return peca


def tras():
    peca = Manifold.extrude(ret_arredondado(EXT_W, EXT_H, RAIO), TRAS)
    # rebordo que encaixa por dentro das paredes (centra a tampa)
    rebordo = Manifold.extrude(ret_arredondado(INT_W - 0.6, INT_H - 0.6, RAIO - PAREDE), 2.0).translate([PAREDE + 0.3, PAREDE + 0.3, TRAS])
    oco = Manifold.extrude(ret_arredondado(INT_W - 4.2, INT_H - 4.2, RAIO - PAREDE), 2.1).translate([PAREDE + 2.1, PAREDE + 2.1, TRAS])
    peca += rebordo - oco
    for (x, y) in cantos_tampa():
        peca -= cilindro(x, y, -1, M3_PASSANTE, TRAS + 4)
        peca -= cilindro(x, y, -1, 6.2, 1.8 + 1)  # cabeça do parafuso fica embutida
        peca -= cilindro(x, y, TRAS - 0.1, 7.4, 2.2)  # o pilar da frente entra aqui
    # 2 buracos de fechadura para parafusos de parede (cabeça até 8 mm), 70 mm entre eles
    cx = EXT_W / 2
    for cy in (EXT_H / 2 - 35, EXT_H / 2 + 35):
        peca -= cilindro(cx, cy, -1, 8.5, TRAS + 4)
        peca -= caixa(cx - 2.1, cy, -1, 4.2, 9.0, TRAS + 4)
        peca -= cilindro(cx, cy + 9.0, -1, 4.2, TRAS + 4)
    # entalhe para o cabo (alinhado com a ranhura da frente)
    peca -= caixa(SAIDA_CABO_X - 5, -1, TRAS - 1.5, 10, PAREDE + 2.6, 4)
    return peca


def guardar(m, nome):
    mesh = m.to_mesh()
    tri = trimesh.Trimesh(vertices=np.asarray(mesh.vert_properties)[:, :3], faces=np.asarray(mesh.tri_verts), process=False)
    tri.export(nome)
    print(f"{nome}: {tri.bounds[1] - tri.bounds[0]} mm, estanque={tri.is_watertight}, volume={tri.volume / 1000:.1f} cm3")
    return tri


if __name__ == "__main__":
    print(f"Exterior: {EXT_W:.1f} x {EXT_H:.1f} x {PROF_FRENTE + TRAS:.1f} mm")
    guardar(frente(), "caixa_frente.stl")
    guardar(tras(), "caixa_tras.stl")
