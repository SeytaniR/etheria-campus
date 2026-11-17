"""
generate_batch5_monsters_showcase.py
Generates an official visual showcase contact sheet of the 10 new monsters (Batch 5: #58 to #67).
Focus on Ranks F & D, and races HUMAN, FAIRY, and CELESTIAL.
Conforms to Rule #7 (< 1,000 lines).
"""

import os
import urllib.request
from PIL import Image, ImageDraw, ImageFont

artifact_dir = r"C:\Users\Dell\.gemini\antigravity\brain\26bb96d4-47cf-47d1-90fd-7e2dc968597f"
output_png = os.path.join(artifact_dir, "ten_batch5_monsters_visual_showcase.png")

monsters = [
    ("monster_58", "Salteador Voador Dunas", "creature_000037", "F", "HUMAN", "AIR", "Humana", "#E2E8F0"),
    ("monster_59", "Vigia Estradas Reais", "creature_000046", "F", "HUMAN", "NEUTRAL", "Humana", "#CBD5E0"),
    ("monster_60", "Clérigo Renegado Areias", "creature_000035", "D", "HUMAN", "EARTH", "Humana", "#ED8936"),
    ("monster_61", "Pixie Fúngico Bosques", "creature_000014", "F", "FAIRY", "EARTH", "Élfica", "#48BB78"),
    ("monster_62", "Gato Feérico Ilusório", "creature_001069", "F", "FAIRY", "AIR", "Élfica", "#38B2AC"),
    ("monster_63", "Fada Borboleta Noturna", "creature_001078", "D", "FAIRY", "NEUTRAL", "Élfica", "#9F7AEA"),
    ("monster_64", "Espírito Silvestre", "creature_100006", "D", "FAIRY", "EARTH", "Élfica", "#68D391"),
    ("monster_65", "Noviço Celestial", "creature_200127", "F", "CELESTIAL", "AIR", "Angelical", "#FAF089"),
    ("monster_66", "Emissário Luz Sagrada", "creature_001106", "D", "CELESTIAL", "AIR", "Angelical", "#ECC94B"),
    ("monster_67", "Espírito Seráfico Alvo", "creature_200005", "D", "CELESTIAL", "NEUTRAL", "Angelical", "#F6E05E")
]

raw_base_url = "https://raw.githubusercontent.com/SeytaniR/mcrework/main/web/assets/monsters"
os.makedirs("temp_monster_thumbs", exist_ok=True)

# Grid layout: 2 rows of 5 monsters
cols = 5
rows = 2
card_w = 230
card_h = 240
canvas_w = cols * card_w + 40
canvas_h = rows * card_h + 110

img = Image.new('RGBA', (canvas_w, canvas_h), (18, 20, 28, 255))
draw = ImageDraw.Draw(img)

try:
    font_title = ImageFont.truetype("arial.ttf", 24)
    font_sub = ImageFont.truetype("arial.ttf", 13)
    font_name = ImageFont.truetype("arial.ttf", 12)
    font_badge = ImageFont.truetype("arial.ttf", 11)
    font_desc = ImageFont.truetype("arial.ttf", 10)
except Exception:
    font_title = ImageFont.load_default()
    font_sub = font_title
    font_name = font_title
    font_badge = font_title
    font_desc = font_title

draw.text((30, 20), "ETHERIA CAMPUS - 10 NOVOS MONSTROS (LOTE 5: #58 A #67)", fill=(245, 200, 70, 255), font=font_title)
draw.text((30, 54), "Foco em Ranks F e D | Raças Humano, Fada e Celestial | Drop de Essência 80% (1 un)", fill=(180, 190, 205, 255), font=font_sub)

for idx, (m_code, m_name, c_key, rank, race, elem, essence, color) in enumerate(monsters):
    r = idx // cols
    c = idx % cols
    x = 20 + c * card_w
    y = 90 + r * card_h
    
    # Outer card
    draw.rectangle([x + 6, y + 6, x + card_w - 6, y + card_h - 6], fill=(26, 30, 42, 255), outline=(50, 60, 80, 255))
    
    # Left accent bar
    draw.rectangle([x + 6, y + 6, x + 12, y + card_h - 6], fill=color)

    # Download thumb if needed
    thumb_path = f"temp_monster_thumbs/{c_key}.webp"
    if not os.path.exists(thumb_path):
        url = f"{raw_base_url}/{c_key}/thumb.webp"
        try:
            urllib.request.urlretrieve(url, thumb_path)
        except Exception:
            pass

    # Sprite Box
    draw.rectangle([x + 22, y + 16, x + card_w - 22, y + 120], fill=(14, 16, 24, 255), outline=(40, 48, 68, 255))
    if os.path.exists(thumb_path):
        try:
            p_img = Image.open(thumb_path).convert('RGBA')
            p_img = p_img.resize((96, 96), Image.Resampling.NEAREST)
            img.paste(p_img, (x + (card_w - 96) // 2, y + 20), p_img)
        except Exception:
            pass

    # Rank Badge (F is grey/silver, D is bronze/cyan)
    badge_col = (113, 128, 150, 255) if rank == 'F' else (49, 151, 149, 255)
    draw.rectangle([x + card_w - 56, y + 18, x + card_w - 24, y + 36], fill=badge_col)
    draw.text((x + card_w - 46, y + 21), rank, fill=(255, 255, 255, 255), font=font_badge)

    # Name & Info
    draw.text((x + 20, y + 130), m_name[:24], fill=(240, 245, 255, 255), font=font_name)
    draw.text((x + 20, y + 152), f"Raça: {race} • Elem: {elem}", fill=(160, 175, 200, 255), font=font_desc)
    draw.text((x + 20, y + 172), f"Drop: Essência {essence} (80%)", fill=(120, 220, 160, 255), font=font_desc)
    draw.text((x + 20, y + 192), f"ID: {m_code} ({c_key})", fill=(120, 130, 155, 255), font=font_desc)

os.makedirs(artifact_dir, exist_ok=True)
img.save(output_png)
print(f"Showcase image successfully generated at: {output_png}")
