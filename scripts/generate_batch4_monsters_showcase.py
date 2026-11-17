"""
generate_batch4_monsters_showcase.py
Generates an official visual showcase contact sheet of the 10 new monsters (Batch 4: #48 to #57).
Conforms to Rule #7 (< 1,000 lines).
"""

import os
import urllib.request
from PIL import Image, ImageDraw, ImageFont

artifact_dir = r"C:\Users\Dell\.gemini\antigravity\brain\26bb96d4-47cf-47d1-90fd-7e2dc968597f"
output_png = os.path.join(artifact_dir, "ten_batch4_monsters_visual_showcase.png")

monsters = [
    ("monster_48", "Minotauro Dourado Colossal", "creature_100001", "SS", "BEAST", "FIRE", "Selvagem", "#F6AD55"),
    ("monster_49", "Wyvern Alado das Alturas", "creature_200007", "S", "DRAGON", "AIR", "Dracônica", "#63B3ED"),
    ("monster_50", "Rei Cogumelo Tóxico", "creature_200009", "S", "PLANT", "EARTH", "Botânica", "#68D391"),
    ("monster_51", "Lorde Jiangshi das Criptas", "creature_200004", "A", "DEMON", "NEUTRAL", "Demoníaca", "#B794F4"),
    ("monster_52", "Urso Pardo das Estepes", "creature_000025", "A", "BEAST", "EARTH", "Selvagem", "#DD6B20"),
    ("monster_53", "Dragão Encouraçado", "creature_000048", "B", "REPTILIAN", "WATER", "Reptiliana", "#4FD1C5"),
    ("monster_54", "Guardião Feérico Dourado", "creature_200008", "B", "FAIRY", "AIR", "Élfica", "#F6E05E"),
    ("monster_55", "Nautilus Mecânico", "creature_000010", "C", "ROBOTIC", "WATER", "Robótica", "#CBD5E0"),
    ("monster_56", "Querubim das Nuvens", "creature_100003", "C", "CELESTIAL", "AIR", "Angelical", "#E2E8F0"),
    ("monster_57", "Donzela da Nevasca", "creature_000042", "D", "SPIRIT", "WATER", "Espiritual", "#90CDF4")
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

draw.text((30, 20), "ETHERIA CAMPUS - 10 NOVOS MONSTROS (LOTE 4: #48 A #57)", fill=(245, 200, 70, 255), font=font_title)
draw.text((30, 54), "Procedural Balanceado | Ranks SS a D | Habilidade Dedicada | Drop de Essência 80% (1 un)", fill=(180, 190, 205, 255), font=font_sub)

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

    # Rank Badge
    badge_col = (214, 158, 46, 255) if rank in ['SS', 'S'] else (128, 90, 213, 255) if rank == 'A' else (49, 130, 206, 255)
    draw.rectangle([x + card_w - 56, y + 18, x + card_w - 24, y + 36], fill=badge_col)
    draw.text((x + card_w - 50, y + 21), rank, fill=(255, 255, 255, 255), font=font_badge)

    # Name & Info
    draw.text((x + 20, y + 130), m_name[:24], fill=(240, 245, 255, 255), font=font_name)
    draw.text((x + 20, y + 152), f"Raça: {race} • Elem: {elem}", fill=(160, 175, 200, 255), font=font_desc)
    draw.text((x + 20, y + 172), f"Drop: Essência {essence} (80%)", fill=(120, 220, 160, 255), font=font_desc)
    draw.text((x + 20, y + 192), f"ID: {m_code} ({c_key})", fill=(120, 130, 155, 255), font=font_desc)

os.makedirs(artifact_dir, exist_ok=True)
img.save(output_png)
print(f"Showcase saved to: {output_png}")
