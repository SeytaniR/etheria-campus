#!/usr/bin/env python3
"""
scripts/crop_character_portraits.py
Recorta com precisão subpixel os 12 avatares oficiais dos personagens do Etheria Campus,
aproveitando o máximo de espaço dentro da moldura dourada alada do jogador.

Ordem oficial (da esquerda para direita, linha por linha):
1. Ladina      (class_2, id: 2)
2. Espadachim  (class_1, id: 1)
3. Mago        (class_9, id: 9)
4. Curandeira  (class_4, id: 4)
5. Caçadora    (class_5, id: 5)
6. Paladino    (class_10, id: 10)
7. Barda       (class_7, id: 7)
8. Necromante  (class_12, id: 12)
9. Atirador    (class_11, id: 11)
10. Assassina  (class_6, id: 6)
11. Guerreira  (class_3, id: 3)
12. Lanceiro   (class_8, id: 8)
"""

import os
from collections import deque
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy.ndimage import binary_dilation

SOURCE_IMG_PATH = r"C:\Users\Dell\.gemini\antigravity\brain\26bb96d4-47cf-47d1-90fd-7e2dc968597f\.user_uploaded\media_1794599311804_9bf67a34.jpg"
FRAME_IMG_PATH = r"C:\Users\Dell\.gemini\antigravity\scratch\etheria-campus\apps\server\public\play\assets\hud\player_avatar_frame.png"
DEST_DIR = r"C:\Users\Dell\.gemini\antigravity\scratch\etheria-campus\apps\server\public\play\assets\hud\avatars"
PREVIEW_DEST = r"C:\Users\Dell\.gemini\antigravity\brain\26bb96d4-47cf-47d1-90fd-7e2dc968597f\avatars_12_framed_preview.png"

os.makedirs(DEST_DIR, exist_ok=True)

# Definição dos 12 personagens: (nome, row, col, class_code, class_id, center_x_hint, center_y_hint, box_size)
CHARACTERS = [
    # Linha 1
    {"name": "ladina", "code": "class_2", "id": 2, "r": 0, "c": 0, "box": (0, 10, 260, 310)},
    {"name": "espadachim", "code": "class_1", "id": 1, "r": 0, "c": 1, "box": (256, 0, 512, 310)},
    {"name": "mago", "code": "class_9", "id": 9, "r": 0, "c": 2, "box": (512, 10, 768, 310)},
    {"name": "curandeira", "code": "class_4", "id": 4, "r": 0, "c": 3, "box": (768, 0, 1024, 310)},
    # Linha 2
    {"name": "caçadora", "code": "class_5", "id": 5, "r": 1, "c": 0, "box": (15, 325, 265, 625)},
    {"name": "paladino", "code": "class_10", "id": 10, "r": 1, "c": 1, "box": (250, 325, 495, 625)},
    {"name": "barda", "code": "class_7", "id": 7, "r": 1, "c": 2, "box": (525, 335, 765, 625)},
    {"name": "necromante", "code": "class_12", "id": 12, "r": 1, "c": 3, "box": (780, 330, 1024, 625)},
    # Linha 3
    {"name": "atirador", "code": "class_11", "id": 11, "r": 2, "c": 0, "box": (10, 645, 260, 955)},
    {"name": "assassina", "code": "class_6", "id": 6, "r": 2, "c": 1, "box": (275, 645, 520, 955)},
    {"name": "guerreira", "code": "class_3", "id": 3, "r": 2, "c": 2, "box": (515, 645, 755, 955)},
    {"name": "lanceiro", "code": "class_8", "id": 8, "r": 2, "c": 3, "box": (785, 645, 1024, 955)},
]


def extract_character_cutout(img_arr, box):
    """
    Recorta a região da imagem e executa BFS flood-fill a partir das bordas externas
    para remover o fundo branco sem erodir cabelos brancos ou reflexos internos.
    """
    x1, y1, x2, y2 = box
    x1 = max(0, x1)
    y1 = max(0, y1)
    x2 = min(img_arr.shape[1], x2)
    y2 = min(img_arr.shape[0], y2)

    crop = img_arr[y1:y2, x1:x2].copy()
    h, w, _ = crop.shape

    # 1. BFS a partir de todas as bordas para identificar o fundo branco contínuo
    is_bg = np.zeros((h, w), dtype=bool)
    queue = deque()

    # Limiar para considerar fundo branco (238 a 255)
    bg_thresh = 236

    for x in range(w):
        if np.all(crop[0, x] >= bg_thresh):
            is_bg[0, x] = True
            queue.append((0, x))
        if np.all(crop[h - 1, x] >= bg_thresh):
            is_bg[h - 1, x] = True
            queue.append((h - 1, x))
    for y in range(h):
        if np.all(crop[y, 0] >= bg_thresh):
            is_bg[y, 0] = True
            queue.append((y, 0))
        if np.all(crop[y, w - 1] >= bg_thresh):
            is_bg[y, w - 1] = True
            queue.append((y, w - 1))

    while queue:
        cy, cx = queue.popleft()
        for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            ny, nx = cy + dy, cx + dx
            if 0 <= ny < h and 0 <= nx < w and not is_bg[ny, nx]:
                if np.all(crop[ny, nx] >= bg_thresh):
                    is_bg[ny, nx] = True
                    queue.append((ny, nx))

    # 2. Defringe / Alpha feathered nas bordas de transição
    # Apenas os pixels adjacentes ao fundo recebem transição suave de transparência
    fg_mask = ~is_bg
    boundary = binary_dilation(is_bg, iterations=2) & fg_mask

    alpha = np.zeros((h, w), dtype=np.float32)
    alpha[fg_mask] = 1.0

    # Ajusta transição na borda de 2 pixels
    if np.any(boundary):
        brightness = np.mean(crop[boundary].astype(np.float32), axis=-1)
        soft_a = np.clip((255.0 - brightness) / 35.0, 0.05, 1.0)
        alpha[boundary] = soft_a

    # 3. Unmultiply white halo nas bordas
    crop_f = crop.astype(np.float32)
    clean_rgb = crop_f.copy()
    b_idx = boundary & (alpha > 0.05) & (alpha < 0.98)
    if np.any(b_idx):
        a_b = alpha[b_idx, None]
        clean_rgb[b_idx] = np.clip((crop_f[b_idx] - (1.0 - a_b) * 255.0) / a_b, 0, 255)

    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    rgba[:, :, :3] = clean_rgb.astype(np.uint8)
    rgba[:, :, 3] = (alpha * 255.0).astype(np.uint8)

    return Image.fromarray(rgba, "RGBA")


def create_circular_backdrop(size=256):
    """
    Cria uma base circular com gradiente radial escuro e luxuoso (estilo Etheria HUD)
    para realçar o contraste do personagem contra a moldura dourada.
    """
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)

    cx, cy = size / 2.0, size / 2.0
    r_max = size / 2.0 - 2.0

    # Gradiente concêntrico do centro para a borda
    steps = 64
    for i in range(steps):
        t = i / float(steps)
        r = r_max * (1.0 - t * 0.96)
        # De azul ardósia profundo (#1f2c42) no centro para preto meia-noite (#070b14)
        red = int(31 * (1.0 - t) + 7 * t)
        green = int(44 * (1.0 - t) + 11 * t)
        blue = int(66 * (1.0 - t) + 20 * t)
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(red, green, blue, 255))

    return im


def generate_optimized_avatar(cutout_img, target_size=256):
    """
    Posiciona e escala o recorte do personagem maximizando o espaço dentro da moldura circular:
    - O rosto, olhos e detalhes de cabeça ficam em escala proeminente.
    - O busto é ancorado de modo a preencher o círculo concêntrico.
    """
    # 1. Encontra a caixa delimitadora real dos pixels opacos do cutout
    alpha = np.array(cutout_img.split()[-1])
    ys, xs = np.where(alpha > 30)
    if len(xs) == 0:
        return cutout_img.resize((target_size, target_size), Image.Resampling.LANCZOS)

    bx1, bx2 = np.min(xs), np.max(xs)
    by1, by2 = np.min(ys), np.max(ys)
    bw = bx2 - bx1
    bh = by2 - by1

    # Foco na cabeça e busto superior (ignora cintura inferior para maximizar o rosto no círculo)
    # Altura do foco: ~85% da altura total do busto
    focus_h = min(bh, int(bw * 1.08))
    focus_crop = cutout_img.crop((bx1, by1, bx2, by1 + focus_h))

    # 2. Escala o foco para ocupar ~94% do diâmetro útil do círculo (256px)
    target_dim = int(target_size * 0.94)
    # Mantém proporção
    scale = target_dim / float(max(focus_crop.width, focus_crop.height))
    new_w = int(focus_crop.width * scale)
    new_h = int(focus_crop.height * scale)
    scaled_focus = focus_crop.resize((new_w, new_h), Image.Resampling.LANCZOS)

    # 3. Cria a base circular escura
    backdrop = create_circular_backdrop(target_size)

    # 4. Centraliza horizontalmente e alinha para a base/centro
    paste_x = (target_size - new_w) // 2
    paste_y = (target_size - new_h) // 2 - 2  # leve elevação óptica

    backdrop.alpha_composite(scaled_focus, (paste_x, paste_y))

    # 5. Aplica máscara circular estrita para vedação total contra arestas
    mask = Image.new("L", (target_size, target_size), 0)
    draw_mask = ImageDraw.Draw(mask)
    draw_mask.ellipse([2, 2, target_size - 3, target_size - 3], fill=255)
    # Suaviza a borda da máscara com anti-aliasing
    mask = mask.filter(ImageFilter.GaussianBlur(radius=0.5))

    final_avatar = Image.new("RGBA", (target_size, target_size), (0, 0, 0, 0))
    final_avatar.paste(backdrop, (0, 0), mask)

    return final_avatar


def main():
    print(f"📖 Carregando imagem de origem: {SOURCE_IMG_PATH}")
    src_img = Image.open(SOURCE_IMG_PATH).convert("RGB")
    src_arr = np.array(src_img)

    frame_img = None
    if os.path.exists(FRAME_IMG_PATH):
        frame_img = Image.open(FRAME_IMG_PATH).convert("RGBA")
        print(f"🖼️ Moldura dourada carregada ({frame_img.size[0]}x{frame_img.size[1]})")

    preview_grid_cols = 4
    preview_grid_rows = 3
    tile_size = 280
    preview_canvas = Image.new("RGBA", (tile_size * preview_grid_cols, tile_size * preview_grid_rows), (15, 23, 42, 255))
    draw_grid = ImageDraw.Draw(preview_canvas)

    print("\n⚙️ Processando os 12 avatares oficiais...")

    for idx, char in enumerate(CHARACTERS):
        name = char["name"]
        code = char["code"]
        cid = char["id"]
        box = char["box"]

        print(f"  [{idx+1}/12] Processando {name.upper()} ({code}, ID={cid})...")
        cutout = extract_character_cutout(src_arr, box)
        avatar = generate_optimized_avatar(cutout, target_size=256)

        # Salva em apps/server/public/play/assets/hud/avatars/
        # 1. Por código de classe (ex: class_1.png)
        code_path = os.path.join(DEST_DIR, f"{code}.png")
        avatar.save(code_path, "PNG", optimize=True)

        # 2. Por nome da classe (ex: espadachim.png)
        name_clean = name.replace("ç", "c")
        name_path = os.path.join(DEST_DIR, f"{name_clean}.png")
        avatar.save(name_path, "PNG", optimize=True)

        # 3. Monta tile de preview com a moldura dourada oficial
        col = idx % preview_grid_cols
        row = idx // preview_grid_cols
        px = col * tile_size
        py = row * tile_size

        tile = Image.new("RGBA", (tile_size, tile_size), (20, 27, 40, 255))
        # Centraliza o avatar no tile
        av_scaled = avatar.resize((150, 150), Image.Resampling.LANCZOS)
        av_x = (tile_size - 150) // 2
        av_y = (tile_size - 150) // 2 - 8
        tile.alpha_composite(av_scaled, (av_x, av_y))

        # Se houver a moldura, sobrepõe exatamente como na HUD
        if frame_img:
            # Em 96px wrapper, avatar é 52px (escala frame/avatar = 96/52 = 1.846)
            frame_scaled_size = int(150 * (96.0 / 52.0))
            frame_scaled = frame_img.resize((frame_scaled_size, frame_scaled_size), Image.Resampling.LANCZOS)
            fr_x = (tile_size - frame_scaled_size) // 2
            fr_y = (tile_size - frame_scaled_size) // 2 - 8
            tile.alpha_composite(frame_scaled, (fr_x, fr_y))

        # Adiciona legenda com nome e classe
        draw_tile = ImageDraw.Draw(tile)
        label = f"#{idx+1} {name.capitalize()} ({code})"
        draw_tile.text((tile_size // 2, tile_size - 22), label, fill=(254, 240, 138), anchor="mm")

        preview_canvas.alpha_composite(tile, (px, py))

    # Salva preview geral
    preview_canvas.save(PREVIEW_DEST, "PNG", optimize=True)
    print(f"\n✅ Todos os 12 avatares foram recortados e salvos com sucesso em {DEST_DIR}")
    print(f"🖼️ Preview geral gerado em: {PREVIEW_DEST}")


if __name__ == "__main__":
    main()
