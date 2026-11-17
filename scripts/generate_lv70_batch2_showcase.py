"""
generate_lv70_batch2_showcase.py
Generates a visual showcase contact sheet of the 12 Level 70 (Rank SS) Batch 2 Equipment Sets (144 pieces).
Conforms to Rule #7 (< 1,000 lines).
"""

import json
import os
import urllib.request
from PIL import Image, ImageDraw, ImageFont

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
batch2_json_path = os.path.join(project_root, 'scripts', 'twelve_level70_batch2_equipment_sets.json')
cache_dir = os.path.join(project_root, 'apps', 'server', 'cache', 'mcrework')
artifact_dir = r"C:\Users\Dell\.gemini\antigravity\brain\26bb96d4-47cf-47d1-90fd-7e2dc968597f"
output_png = os.path.join(artifact_dir, "lv70_batch2_12_sets_visual_showcase.png")

with open(batch2_json_path, 'r', encoding='utf-8') as f:
    items = json.load(f)

raw_base_url = "https://raw.githubusercontent.com/SeytaniR/mcrework/main/web"

# 1. Download any missing icons
for it in items:
    rel_path = it['icon']
    full_path = os.path.join(cache_dir, rel_path)
    if not os.path.exists(full_path):
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        url = f"{raw_base_url}/{rel_path}"
        try:
            urllib.request.urlretrieve(url, full_path)
            print(f"Downloaded: {rel_path}")
        except Exception as e:
            print(f"Failed to download {rel_path}: {e}")

# 2. Group by set (12 sets x 12 slots)
slots_order = ['HEAD', 'SHOULDER', 'CHEST', 'BELT', 'LEGS', 'FEET', 'WEAPON_1', 'WEAPON_2', 'RING', 'NECKLACE', 'ORNAMENT_1', 'ORNAMENT_2']

# Map prefix to set details
set_info = [
    ("set_lv70_solardawn", "Alvorada Solar Ígnea", "Espadachim", "#E5A823"),
    ("set_lv70_nightstalker", "Rastreador das Sombras", "Ladina", "#48BB78"),
    ("set_lv70_crimsontitan", "Titã Carmesim Esmagador", "Guerreira", "#E53E3E"),
    ("set_lv70_emeraldgenesis", "Guardiã da Gênese Esmeralda", "Curandeira", "#38A169"),
    ("set_lv70_windrunner", "Corredora dos Ventos", "Caçadora", "#319795"),
    ("set_lv70_voideclipse", "Executora do Eclipse do Vazio", "Assassina", "#805AD5"),
    ("set_lv70_royalsymphony", "Maestro da Sinfonia Real", "Barda", "#D69E2E"),
    ("set_lv70_glacialdragoon", "Lanceiro do Dragão Glacial", "Lanceiro", "#3182CE"),
    ("set_lv70_crystalarchon", "Arconte do Cristal Astral", "Mago", "#6B46C1"),
    ("set_lv70_divinearchon", "Arconte Sagrado Imortal", "Paladino", "#ECC94B"),
    ("set_lv70_siegemarksman", "Franco-Atirador do Cerco", "Atirador", "#DD6B20"),
    ("set_lv70_bloodlich", "Grão-Lich do Sangue Carmesim", "Necromante", "#9B2C2C")
]

# Grid dimensions
canvas_w = 1200
row_h = 70
header_h = 100
canvas_h = header_h + len(set_info) * row_h + 30

img = Image.new('RGBA', (canvas_w, canvas_h), (18, 20, 28, 255))
draw = ImageDraw.Draw(img)

# Title
try:
    font_title = ImageFont.truetype("arial.ttf", 26)
    font_sub = ImageFont.truetype("arial.ttf", 14)
    font_set = ImageFont.truetype("arial.ttf", 13)
    font_class = ImageFont.truetype("arial.ttf", 11)
    font_slot = ImageFont.truetype("arial.ttf", 10)
except Exception:
    font_title = ImageFont.load_default()
    font_sub = font_title
    font_set = font_title
    font_class = font_title
    font_slot = font_title

draw.text((30, 20), "ETHERIA CAMPUS - 12 CONJUNTOS DE NÍVEL 70 (RANK SS) - COLEÇÃO B (144 PEÇAS)", fill=(245, 200, 70, 255), font=font_title)
draw.text((30, 56), "1 Conjunto Especializado para cada uma das 12 Classes | 100% Ícones Exclusivos Sem Repetição | Balanceamento SS", fill=(180, 190, 205, 255), font=font_sub)

# Slot labels above grid
slot_labels = ["Elmo", "Ombro", "Peito", "Cinto", "Perna", "Bota", "Arma 1", "Arma 2", "Anel", "Colar", "Orn 1", "Orn 2"]
start_x = 340
cell_pitch = 70

for col_idx, label in enumerate(slot_labels):
    cx = start_x + col_idx * cell_pitch
    draw.text((cx + 10, 76), label, fill=(140, 150, 170, 255), font=font_slot)

# Draw sets
for row_idx, (set_code, set_name, class_name, theme_col) in enumerate(set_info):
    y = header_h + row_idx * row_h
    # Alternating row background
    bg_col = (26, 30, 42, 255) if row_idx % 2 == 0 else (22, 25, 36, 255)
    draw.rectangle([20, y, canvas_w - 20, y + row_h - 6], fill=bg_col, outline=(45, 50, 70, 255))

    # Left color bar
    draw.rectangle([20, y, 26, y + row_h - 6], fill=theme_col)

    # Set name & class badge
    draw.text((38, y + 12), set_name, fill=(240, 240, 250, 255), font=font_set)
    draw.text((38, y + 36), f"Classe: {class_name} • Lv.70 SS", fill=(160, 175, 200, 255), font=font_class)

    # 12 piece icons
    for col_idx, slot in enumerate(slots_order):
        cx = start_x + col_idx * cell_pitch
        # find matching item
        match_item = next((it for it in items if it['code'].startswith(set_code.replace('set_', 'equip_')) and it['slot'] == slot), None)
        
        # Icon slot box
        draw.rectangle([cx, y + 8, cx + 48, y + 56], fill=(14, 16, 24, 255), outline=(60, 68, 95, 255))

        if match_item:
            icon_file = os.path.join(cache_dir, match_item['icon'])
            if os.path.exists(icon_file):
                try:
                    p_img = Image.open(icon_file).convert('RGBA')
                    p_img = p_img.resize((40, 40), Image.Resampling.NEAREST)
                    img.paste(p_img, (cx + 4, y + 12), p_img)
                except Exception as e:
                    pass

os.makedirs(artifact_dir, exist_ok=True)
img.save(output_png)
print(f"Visual showcase saved to: {output_png}")
