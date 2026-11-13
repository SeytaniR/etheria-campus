"""
Script de processamento e recorte de alta precisão para os novos assets oficiais da HUD do Etheria Campus.
Processa:
1. menu_shop.png (Loja)
2. menu_pets.png (Pets)
3. menu_character.png (Personagem)
4. menu_inventory.png (Mochila / Inventário)
5. menu_quests.png (Missões / Quests)
6. menu_events.png (Eventos com confetes)
7. settings_gear_icon.png (Engrenagem de Configurações)
8. minimap_frame.png (Moldura do Mini Mapa com bússola e centro transparente)
9. player_avatar_frame.png (Moldura de Perfil do Jogador com asas e centro transparente)
"""

import os
from collections import deque
import numpy as np
from PIL import Image
from scipy.ndimage import binary_dilation

IMG1_PATH = r"C:\Users\Dell\.gemini\antigravity\brain\26bb96d4-47cf-47d1-90fd-7e2dc968597f\.user_uploaded\media_1794587354286_e7e3e630.jpg"
IMG2_PATH = r"C:\Users\Dell\.gemini\antigravity\brain\26bb96d4-47cf-47d1-90fd-7e2dc968597f\.user_uploaded\media_1794587355904_97ef9782.jpg"
DEST_DIR = r"C:\Users\Dell\.gemini\antigravity\scratch\etheria-campus\apps\server\public\play\assets\hud"

os.makedirs(DEST_DIR, exist_ok=True)


def process_icon(img_arr, bbox, out_name, square_pad=True, target_size=256):
    """Recorta um ícone sólido, remove fundo branco exterior via BFS e defringe bordas."""
    x1, y1, x2, y2 = bbox
    crop = img_arr[y1:y2, x1:x2].copy()
    h, w, _ = crop.shape

    # Distância do branco puro
    diff_from_white = 255 - np.min(crop, axis=2)

    # Flood fill exterior a partir das 4 bordas
    is_bg = np.zeros((h, w), dtype=bool)
    queue = deque()

    for x in range(w):
        if diff_from_white[0, x] <= 10:
            is_bg[0, x] = True
            queue.append((0, x))
        if diff_from_white[h - 1, x] <= 10:
            is_bg[h - 1, x] = True
            queue.append((h - 1, x))
    for y in range(h):
        if diff_from_white[y, 0] <= 10:
            is_bg[y, 0] = True
            queue.append((y, 0))
        if diff_from_white[y, w - 1] <= 10:
            is_bg[y, w - 1] = True
            queue.append((y, w - 1))

    while queue:
        cy, cx = queue.popleft()
        for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            ny, nx = cy + dy, cx + dx
            if 0 <= ny < h and 0 <= nx < w and not is_bg[ny, nx]:
                if diff_from_white[ny, nx] <= 32:
                    is_bg[ny, nx] = True
                    queue.append((ny, nx))

    # Transição suave / Antialiasing na fronteira externa
    bg_dilated = binary_dilation(is_bg, iterations=2)
    transition = bg_dilated & (~is_bg)

    alpha = np.ones((h, w), dtype=np.float32)
    alpha[is_bg] = 0.0

    for y, x in zip(*np.where(transition)):
        d = diff_from_white[y, x]
        a = np.clip((d - 4.0) / 45.0, 0.05, 1.0)
        alpha[y, x] = min(alpha[y, x], a)

    # Defringe RGB em pixels semitransparentes
    unpremult_rgb = crop.astype(np.float32)
    semi = (alpha > 0.01) & (alpha < 0.99)
    for c in range(3):
        unpremult_rgb[semi, c] = np.clip(
            (crop[semi, c] - 255.0 * (1.0 - alpha[semi])) / alpha[semi], 0, 255
        )

    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    rgba[:, :, :3] = unpremult_rgb.astype(np.uint8)
    rgba[:, :, 3] = (alpha * 255).astype(np.uint8)

    img_res = Image.fromarray(rgba, "RGBA")

    # Enquadrar em canvas quadrado centralizado
    if square_pad:
        max_dim = max(w, h)
        padded = Image.new("RGBA", (max_dim, max_dim), (0, 0, 0, 0))
        ox = (max_dim - w) // 2
        oy = (max_dim - h) // 2
        padded.paste(img_res, (ox, oy), img_res)
        img_res = padded

    if target_size and img_res.size[0] != target_size:
        img_res = img_res.resize((target_size, target_size), Image.Resampling.LANCZOS)

    out_path = os.path.join(DEST_DIR, out_name)
    img_res.save(out_path, "PNG", optimize=True)
    print(f"[OK] {out_name} salvo ({img_res.size[0]}x{img_res.size[1]}) em {out_path}")
    return img_res


def process_minimap_frame(img2_arr, target_size=512):
    """Processa a Moldura do Mini Mapa com furo central transparente para o canvas."""
    # Bounding box minimap no img2
    x1, y1, x2, y2 = 12, 28, 664, 716
    crop = img2_arr[y1:y2, x1:x2].copy()
    h, w, _ = crop.shape

    diff_from_white = 255 - np.min(crop, axis=2)

    # 1. Flood fill exterior
    is_bg = np.zeros((h, w), dtype=bool)
    queue = deque()
    for x in range(w):
        if diff_from_white[0, x] <= 10:
            is_bg[0, x] = True
            queue.append((0, x))
        if diff_from_white[h - 1, x] <= 10:
            is_bg[h - 1, x] = True
            queue.append((h - 1, x))
    for y in range(h):
        if diff_from_white[y, 0] <= 10:
            is_bg[y, 0] = True
            queue.append((y, 0))
        if diff_from_white[y, w - 1] <= 10:
            is_bg[y, w - 1] = True
            queue.append((y, w - 1))

    while queue:
        cy, cx = queue.popleft()
        for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            ny, nx = cy + dy, cx + dx
            if 0 <= ny < h and 0 <= nx < w and not is_bg[ny, nx]:
                if diff_from_white[ny, nx] <= 32:
                    is_bg[ny, nx] = True
                    queue.append((ny, nx))

    bg_dilated = binary_dilation(is_bg, iterations=2)
    transition_ext = bg_dilated & (~is_bg)

    alpha = np.ones((h, w), dtype=np.float32)
    alpha[is_bg] = 0.0

    for y, x in zip(*np.where(transition_ext)):
        d = diff_from_white[y, x]
        a = np.clip((d - 4.0) / 45.0, 0.05, 1.0)
        alpha[y, x] = min(alpha[y, x], a)

    # 2. Abertura do centro (Círculo interno transparente)
    # Centro na imagem original: (336.5, 384.7)
    cx_in = 336.5 - x1
    cy_in = 384.7 - y1
    r_inner = 204.0

    Y, X = np.ogrid[:h, :w]
    dist = np.sqrt((X - cx_in) ** 2 + (Y - cy_in) ** 2)

    # Círculo interno 100% transparente
    alpha[dist < r_inner] = 0.0

    # Antialiasing na borda interna de ouro
    inner_trans = (dist >= r_inner) & (dist <= r_inner + 4.0)
    for y, x in zip(*np.where(inner_trans)):
        t = (dist[y, x] - r_inner) / 4.0
        alpha[y, x] = min(alpha[y, x], t)

    # Defringe exterior
    unpremult_rgb = crop.astype(np.float32)
    semi_ext = (alpha > 0.01) & (alpha < 0.99) & (~inner_trans)
    for c in range(3):
        unpremult_rgb[semi_ext, c] = np.clip(
            (crop[semi_ext, c] - 255.0 * (1.0 - alpha[semi_ext])) / alpha[semi_ext],
            0,
            255,
        )

    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    rgba[:, :, :3] = unpremult_rgb.astype(np.uint8)
    rgba[:, :, 3] = (alpha * 255).astype(np.uint8)

    img_res = Image.fromarray(rgba, "RGBA")

    # Centralizar o canvas quadrado EXATAMENTE no centro do círculo interno
    # para que o canvas do minimap fique centralizado por padrão
    max_radius = max(cx_in, w - cx_in, cy_in, h - cy_in)
    pad_half = int(np.ceil(max_radius)) + 4
    square_dim = pad_half * 2

    canvas = Image.new("RGBA", (square_dim, square_dim), (0, 0, 0, 0))
    paste_x = int(round(pad_half - cx_in))
    paste_y = int(round(pad_half - cy_in))
    canvas.paste(img_res, (paste_x, paste_y), img_res)

    if target_size and canvas.size[0] != target_size:
        canvas = canvas.resize((target_size, target_size), Image.Resampling.LANCZOS)

    out_path = os.path.join(DEST_DIR, "minimap_frame.png")
    canvas.save(out_path, "PNG", optimize=True)
    print(f"[OK] minimap_frame.png salvo ({canvas.size[0]}x{canvas.size[1]}) em {out_path}")
    return canvas


def process_player_avatar_frame(img2_arr, target_size=256):
    """Processa a Moldura de Avatar do Jogador com furo central transparente."""
    x1, y1, x2, y2 = 665, 55, 1010, 395
    crop = img2_arr[y1:y2, x1:x2].copy()
    h, w, _ = crop.shape

    diff_from_white = 255 - np.min(crop, axis=2)

    # 1. Flood fill exterior
    is_bg = np.zeros((h, w), dtype=bool)
    queue = deque()
    for x in range(w):
        if diff_from_white[0, x] <= 10:
            is_bg[0, x] = True
            queue.append((0, x))
        if diff_from_white[h - 1, x] <= 10:
            is_bg[h - 1, x] = True
            queue.append((h - 1, x))
    for y in range(h):
        if diff_from_white[y, 0] <= 10:
            is_bg[y, 0] = True
            queue.append((y, 0))
        if diff_from_white[y, w - 1] <= 10:
            is_bg[y, w - 1] = True
            queue.append((y, w - 1))

    while queue:
        cy, cx = queue.popleft()
        for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            ny, nx = cy + dy, cx + dx
            if 0 <= ny < h and 0 <= nx < w and not is_bg[ny, nx]:
                if diff_from_white[ny, nx] <= 32:
                    is_bg[ny, nx] = True
                    queue.append((ny, nx))

    bg_dilated = binary_dilation(is_bg, iterations=2)
    transition_ext = bg_dilated & (~is_bg)

    alpha = np.ones((h, w), dtype=np.float32)
    alpha[is_bg] = 0.0

    for y, x in zip(*np.where(transition_ext)):
        d = diff_from_white[y, x]
        a = np.clip((d - 4.0) / 45.0, 0.05, 1.0)
        alpha[y, x] = min(alpha[y, x], a)

    # 2. Abertura do centro (Círculo da foto de perfil transparente)
    cx_in = 835.9 - x1
    cy_in = 205.9 - y1
    r_inner = 93.0

    Y, X = np.ogrid[:h, :w]
    dist = np.sqrt((X - cx_in) ** 2 + (Y - cy_in) ** 2)

    alpha[dist < r_inner] = 0.0

    # Antialiasing na borda interna
    inner_trans = (dist >= r_inner) & (dist <= r_inner + 3.0)
    for y, x in zip(*np.where(inner_trans)):
        t = (dist[y, x] - r_inner) / 3.0
        alpha[y, x] = min(alpha[y, x], t)

    # Defringe exterior
    unpremult_rgb = crop.astype(np.float32)
    semi_ext = (alpha > 0.01) & (alpha < 0.99) & (~inner_trans)
    for c in range(3):
        unpremult_rgb[semi_ext, c] = np.clip(
            (crop[semi_ext, c] - 255.0 * (1.0 - alpha[semi_ext])) / alpha[semi_ext],
            0,
            255,
        )

    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    rgba[:, :, :3] = unpremult_rgb.astype(np.uint8)
    rgba[:, :, 3] = (alpha * 255).astype(np.uint8)

    img_res = Image.fromarray(rgba, "RGBA")

    # Centralizar no centro do círculo da foto
    max_radius = max(cx_in, w - cx_in, cy_in, h - cy_in)
    pad_half = int(np.ceil(max_radius)) + 4
    square_dim = pad_half * 2

    canvas = Image.new("RGBA", (square_dim, square_dim), (0, 0, 0, 0))
    paste_x = int(round(pad_half - cx_in))
    paste_y = int(round(pad_half - cy_in))
    canvas.paste(img_res, (paste_x, paste_y), img_res)

    if target_size and canvas.size[0] != target_size:
        canvas = canvas.resize((target_size, target_size), Image.Resampling.LANCZOS)

    out_path = os.path.join(DEST_DIR, "player_avatar_frame.png")
    canvas.save(out_path, "PNG", optimize=True)
    print(f"[OK] player_avatar_frame.png salvo ({canvas.size[0]}x{canvas.size[1]}) em {out_path}")
    return canvas


def main():
    print("Iniciando recorte dos assets da HUD...")
    im1 = Image.open(IMG1_PATH).convert("RGB")
    im2 = Image.open(IMG2_PATH).convert("RGB")

    arr1 = np.array(im1)
    arr2 = np.array(im2)

    # 1. Loja (Shop)
    process_icon(arr1, (35, 35, 335, 365), "menu_shop.png", target_size=256)

    # 2. Pets
    process_icon(arr1, (365, 30, 655, 375), "menu_pets.png", target_size=256)

    # 3. Personagem (Character)
    process_icon(arr1, (665, 55, 1005, 345), "menu_character.png", target_size=256)

    # 4. Mochila (Inventory)
    process_icon(arr1, (35, 415, 335, 725), "menu_inventory.png", target_size=256)

    # 5. Missões (Quests)
    process_icon(arr1, (360, 425, 670, 725), "menu_quests.png", target_size=256)

    # 6. Eventos (Events com confetes)
    process_icon(arr1, (690, 410, 1010, 735), "menu_events.png", target_size=256)

    # 7. Engrenagem (Settings Gear)
    process_icon(arr2, (685, 415, 985, 715), "settings_gear_icon.png", target_size=256)

    # 8. Moldura do Mini Mapa
    process_minimap_frame(arr2, target_size=512)

    # 9. Moldura do Jogador
    process_player_avatar_frame(arr2, target_size=256)

    print("\nTodos os 9 assets foram recortados e salvos com sucesso!")


if __name__ == "__main__":
    main()
