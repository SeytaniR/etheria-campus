import os
import math
from PIL import Image, ImageDraw, ImageFilter, ImageOps

OUT_DIR = os.path.abspath("apps/server/public/play/assets/hud")
os.makedirs(OUT_DIR, exist_ok=True)

def supersample_save(img_hi, target_size, filename):
    img = img_hi.resize(target_size, Image.Resampling.LANCZOS)
    path = os.path.join(OUT_DIR, filename)
    img.save(path, "PNG")
    print(f"[OK] Generated {filename} ({target_size[0]}x{target_size[1]})")
    return path

# -------------------------------------------------------------
# 1. player_avatar_frame.png (256x256, rendered at 1024x1024)
# -------------------------------------------------------------
def make_player_avatar_frame():
    S = 1024
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)
    cx, cy = S // 2, S // 2

    # Draw outer shadow
    for i in range(25):
        alpha = int(70 * (1 - i / 25))
        r = 485 + i
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(15, 10, 5, alpha), width=2)

    # Outer bronze/gold rim
    r_outer = 480
    r_inner = 350
    # Gradient rings
    steps = 100
    for s in range(steps):
        t = s / steps
        r = int(r_inner + (r_outer - r_inner) * t)
        # Gold/bronze metallic gradient
        # Highlights at outer and inner edge, darker in groove
        if t < 0.15: # inner gold highlight
            c = (245, 195, 90, 255)
        elif t < 0.35: # dark bevel groove
            c = (55, 35, 18, 255)
        elif t < 0.70: # warm bronze body
            c = (150, 95, 40, 255)
        elif t < 0.90: # bright gold rim
            c = (235, 180, 75, 255)
        else: # outer dark edge
            c = (40, 25, 10, 255)
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=c, width=3)

    # 4 Decorative studs (N, S, E, W)
    for angle_deg in [0, 90, 180, 270]:
        rad = math.radians(angle_deg)
        dist = (r_outer + r_inner) // 2
        sx = cx + int(dist * math.cos(rad))
        sy = cy + int(dist * math.sin(rad))
        # Gold rivet with shiny center
        draw.ellipse([sx - 24, sy - 24, sx + 24, sy + 24], fill=(70, 45, 15, 255), outline=(255, 215, 120, 255), width=4)
        draw.ellipse([sx - 12, sy - 12, sx + 12, sy + 12], fill=(255, 230, 150, 255))
        draw.ellipse([sx - 4, sy - 4, sx + 4, sy + 4], fill=(255, 255, 255, 255))

    # Clear center hole to 100% transparent
    hole_mask = Image.new("L", (S, S), 0)
    h_draw = ImageDraw.Draw(hole_mask)
    h_draw.ellipse([cx - r_inner, cy - r_inner, cx + r_inner, cy + r_inner], fill=255)
    
    # Apply hole cutout
    r, g, b, a = im.split()
    # Mask out alpha inside hole
    a_inv = ImageOps.invert(hole_mask)
    a_final = Image.composite(a, Image.new("L", (S, S), 0), a_inv)
    im.putalpha(a_final)

    supersample_save(im, (256, 256), "player_avatar_frame.png")

# -------------------------------------------------------------
# 2. minimap_frame.png (256x256, rendered at 1024x1024)
# -------------------------------------------------------------
def make_minimap_frame():
    S = 1024
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)
    cx, cy = S // 2, S // 2

    # Outer soft drop shadow
    for i in range(25):
        alpha = int(80 * (1 - i / 25))
        r = 485 + i
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(10, 15, 20, alpha), width=2)

    r_outer = 480
    r_inner = 360
    steps = 100
    for s in range(steps):
        t = s / steps
        r = int(r_inner + (r_outer - r_inner) * t)
        if t < 0.12:
            c = (230, 190, 110, 255) # inner rim gold
        elif t < 0.30:
            c = (45, 40, 35, 255) # deep slate groove
        elif t < 0.65:
            c = (120, 110, 95, 255) # metallic steel-bronze body
        elif t < 0.85:
            c = (215, 175, 95, 255) # main outer gold ring
        else:
            c = (35, 30, 25, 255) # outer dark bevel
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=c, width=3)

    # Compass markers / 4 cardinal decorative brackets at N, E, S, W
    for angle_deg in [0, 90, 180, 270]:
        rad = math.radians(angle_deg)
        dist = 445
        sx = cx + int(dist * math.cos(rad))
        sy = cy + int(dist * math.sin(rad))
        # Diamond jewel/rivet
        d_pts = [
            (sx, sy - 30),
            (sx + 24, sy),
            (sx, sy + 30),
            (sx - 24, sy)
        ]
        draw.polygon(d_pts, fill=(255, 220, 120, 255), outline=(60, 40, 15, 255))
        draw.polygon([(sx, sy - 15), (sx + 12, sy), (sx, sy + 15), (sx - 12, sy)], fill=(255, 255, 220, 255))

    # Center hole cutout
    hole_mask = Image.new("L", (S, S), 0)
    h_draw = ImageDraw.Draw(hole_mask)
    h_draw.ellipse([cx - r_inner, cy - r_inner, cx + r_inner, cy + r_inner], fill=255)
    
    r, g, b, a = im.split()
    a_inv = ImageOps.invert(hole_mask)
    a_final = Image.composite(a, Image.new("L", (S, S), 0), a_inv)
    im.putalpha(a_final)

    supersample_save(im, (256, 256), "minimap_frame.png")

# -------------------------------------------------------------
# 3. settings_gear_icon.png (128x128, rendered at 512x512)
# -------------------------------------------------------------
def make_settings_gear():
    S = 512
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)
    cx, cy = S // 2, S // 2

    # Circular base button
    r_btn = 230
    for i in range(15):
        alpha = int(70 * (1 - i / 15))
        draw.ellipse([cx - (r_btn + i), cy - (r_btn + i), cx + (r_btn + i), cy + (r_btn + i)], outline=(10, 10, 15, alpha), width=2)

    # Base disc with bronze/dark rim
    draw.ellipse([cx - r_btn, cy - r_btn, cx + r_btn, cy + r_btn], fill=(45, 40, 38, 255), outline=(190, 150, 85, 255), width=18)
    draw.ellipse([cx - (r_btn - 16), cy - (r_btn - 16), cx + (r_btn - 16), cy + (r_btn - 16)], outline=(70, 60, 55, 255), width=6)

    # 8-Teeth Gear inside
    num_teeth = 8
    outer_tooth_r = 155
    inner_tooth_r = 115
    gear_pts = []
    for i in range(num_teeth):
        angle_base = i * (2 * math.pi / num_teeth)
        step = (2 * math.pi / num_teeth) / 4
        # Root 1
        a1 = angle_base - step * 1.3
        gear_pts.append((cx + inner_tooth_r * math.cos(a1), cy + inner_tooth_r * math.sin(a1)))
        # Tooth Tip 1
        a2 = angle_base - step * 0.7
        gear_pts.append((cx + outer_tooth_r * math.cos(a2), cy + outer_tooth_r * math.sin(a2)))
        # Tooth Tip 2
        a3 = angle_base + step * 0.7
        gear_pts.append((cx + outer_tooth_r * math.cos(a3), cy + outer_tooth_r * math.sin(a3)))
        # Root 2
        a4 = angle_base + step * 1.3
        gear_pts.append((cx + inner_tooth_r * math.cos(a4), cy + inner_tooth_r * math.sin(a4)))

    draw.polygon(gear_pts, fill=(210, 205, 195, 255), outline=(70, 65, 60, 255))
    # Gear body
    draw.ellipse([cx - inner_tooth_r, cy - inner_tooth_r, cx + inner_tooth_r, cy + inner_tooth_r], fill=(225, 220, 210, 255), outline=(80, 75, 70, 255), width=6)
    # Center hole
    draw.ellipse([cx - 50, cy - 50, cx + 50, cy + 50], fill=(45, 40, 38, 255), outline=(90, 80, 70, 255), width=6)
    # Highlight
    draw.arc([cx - 40, cy - 40, cx + 40, cy + 40], start=180, end=300, fill=(255, 255, 255, 200), width=4)

    supersample_save(im, (128, 128), "settings_gear_icon.png")

# -------------------------------------------------------------
# 4. gold_coin_icon.png (128x128, rendered at 512x512)
# -------------------------------------------------------------
def make_gold_coin():
    S = 512
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)
    cx, cy = S // 2, S // 2

    # Drop shadow
    draw.ellipse([cx - 200, cy - 180, cx + 200, cy + 220], fill=(0, 0, 0, 60))

    # Outer coin thickness (3D bevel rim)
    draw.ellipse([cx - 210, cy - 205, cx + 210, cy + 215], fill=(160, 95, 10, 255))
    draw.ellipse([cx - 210, cy - 210, cx + 210, cy + 210], fill=(215, 140, 20, 255))
    draw.ellipse([cx - 200, cy - 200, cx + 200, cy + 200], fill=(255, 195, 35, 255))
    draw.ellipse([cx - 175, cy - 175, cx + 175, cy + 175], fill=(235, 160, 20, 255), outline=(255, 235, 120, 255), width=10)

    # 4-Point Embossed Star in center
    def star_pts(c_x, c_y, r_long, r_short):
        pts = []
        for i in range(8):
            rad = i * (math.pi / 4)
            r = r_long if i % 2 == 0 else r_short
            pts.append((c_x + r * math.cos(rad), c_y + r * math.sin(rad)))
        return pts

    # Shadow star
    draw.polygon(star_pts(cx + 4, cy + 6, 110, 35), fill=(140, 80, 5, 255))
    # Bright gold star
    draw.polygon(star_pts(cx, cy, 110, 35), fill=(255, 245, 150, 255), outline=(190, 110, 10, 255))
    draw.polygon(star_pts(cx, cy, 55, 20), fill=(255, 255, 220, 255))

    # Specular glint arc
    draw.arc([cx - 190, cy - 190, cx + 190, cy + 190], start=200, end=310, fill=(255, 255, 255, 230), width=14)

    supersample_save(im, (128, 128), "gold_coin_icon.png")

# -------------------------------------------------------------
# 5. crystal_gem_icon.png (128x128, rendered at 512x512)
# -------------------------------------------------------------
def make_crystal_gem():
    S = 512
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)
    cx, cy = S // 2, S // 2

    # Diamond coordinates
    top = (cx, cy - 200)
    left = (cx - 170, cy - 50)
    right = (cx + 170, cy - 50)
    bottom = (cx, cy + 210)
    mid_t1 = (cx - 75, cy - 120)
    mid_t2 = (cx + 75, cy - 120)
    mid_c = (cx, cy - 30)

    # Facets
    # Top-Left facet
    draw.polygon([top, left, mid_t1], fill=(120, 235, 255, 255), outline=(255, 255, 255, 200))
    # Top-Center facet
    draw.polygon([top, mid_t1, mid_t2], fill=(200, 250, 255, 255), outline=(255, 255, 255, 240))
    # Top-Right facet
    draw.polygon([top, mid_t2, right], fill=(70, 185, 240, 255), outline=(255, 255, 255, 200))

    # Center-Left facet
    draw.polygon([left, mid_t1, mid_c], fill=(0, 160, 225, 255), outline=(255, 255, 255, 180))
    # Center-Right facet
    draw.polygon([right, mid_t2, mid_c], fill=(0, 120, 195, 255), outline=(255, 255, 255, 180))
    # Center-Upper facet
    draw.polygon([mid_t1, mid_t2, mid_c], fill=(160, 240, 255, 255), outline=(255, 255, 255, 220))

    # Bottom-Left facet
    draw.polygon([left, mid_c, bottom], fill=(0, 140, 210, 255), outline=(255, 255, 255, 200))
    # Bottom-Right facet
    draw.polygon([right, mid_c, bottom], fill=(0, 95, 175, 255), outline=(255, 255, 255, 200))

    # Bright White Glint / Star reflection
    def sparkle(sx, sy, size):
        draw.line([sx - size, sy, sx + size, sy], fill=(255, 255, 255, 255), width=5)
        draw.line([sx, sy - size, sx, sy + size], fill=(255, 255, 255, 255), width=5)
        draw.ellipse([sx - 6, sy - 6, sx + 6, sy + 6], fill=(255, 255, 255, 255))

    sparkle(cx - 30, cy - 90, 45)
    sparkle(cx + 90, cy - 20, 22)

    supersample_save(im, (128, 128), "crystal_gem_icon.png")

# -------------------------------------------------------------
# 6. joystick_center_interact.png (160x160, rendered at 640x640)
# -------------------------------------------------------------
def make_joystick_center():
    S = 640
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)
    cx, cy = S // 2, S // 2

    # Drop shadow
    draw.ellipse([cx - 260, cy - 240, cx + 260, cy + 280], fill=(10, 20, 30, 90))

    # Outer ornate gold button bezel
    r_outer = 270
    draw.ellipse([cx - r_outer, cy - r_outer, cx + r_outer, cy + r_outer], fill=(120, 75, 15, 255))
    draw.ellipse([cx - (r_outer - 12), cy - (r_outer - 12), cx + (r_outer - 12), cy + (r_outer - 12)], fill=(245, 185, 55, 255))
    draw.ellipse([cx - (r_outer - 28), cy - (r_outer - 28), cx + (r_outer - 28), cy + (r_outer - 28)], fill=(160, 95, 15, 255))

    # Inner rich amber/orange radial face
    r_inner = r_outer - 38
    for i in range(r_inner, 0, -3):
        t = i / r_inner
        red = int(255 * (1 - 0.2 * t))
        green = int(195 * (1 - 0.4 * t))
        blue = int(40 * (1 - 0.7 * t))
        draw.ellipse([cx - i, cy - i, cx + i, cy + i], fill=(red, green, blue, 255))

    # Speech bubble icon in center
    bw = 140
    bh = 100
    bx = cx - bw // 2
    by = cy - bh // 2 - 10
    # Rounded bubble rect
    draw.rounded_rectangle([bx, by, bx + bw, by + bh], radius=28, fill=(255, 250, 235, 255), outline=(130, 70, 5, 255), width=8)
    # Speech tail pointing bottom-left
    tail_pts = [
        (bx + 25, by + bh - 5),
        (bx + 5, by + bh + 32),
        (bx + 55, by + bh - 5)
    ]
    draw.polygon(tail_pts, fill=(255, 250, 235, 255))
    draw.line([(bx + 25, by + bh - 5), (bx + 5, by + bh + 32), (bx + 55, by + bh - 5)], fill=(130, 70, 5, 255), width=8)

    # 3 dots inside speech bubble
    dot_r = 10
    for offset in [-35, 0, 35]:
        dx = cx + offset
        dy = by + bh // 2
        draw.ellipse([dx - dot_r, dy - dot_r, dx + dot_r, dy + dot_r], fill=(185, 115, 25, 255))

    supersample_save(im, (160, 160), "joystick_center_interact.png")

# -------------------------------------------------------------
# 7. joystick_outer_ring.png (256x256, rendered at 1024x1024)
# -------------------------------------------------------------
def make_joystick_outer_ring():
    S = 1024
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)
    cx, cy = S // 2, S // 2

    # Dial rings
    r1 = 440
    r2 = 330
    draw.ellipse([cx - r1, cy - r1, cx + r1, cy + r1], outline=(100, 180, 230, 90), width=8)
    draw.ellipse([cx - r2, cy - r2, cx + r2, cy + r2], outline=(100, 180, 230, 110), width=6)

    # Shaded band
    for r in range(r2, r1, 4):
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(30, 70, 110, 25), width=2)

    # 8 Directional Chevrons
    for i in range(8):
        angle = i * (math.pi / 4)
        dist = 385
        px = cx + int(dist * math.cos(angle))
        py = cy + int(dist * math.sin(angle))
        
        # Chevron points pointing outwards
        tip_x = cx + int((dist + 38) * math.cos(angle))
        tip_y = cy + int((dist + 38) * math.sin(angle))
        
        orth_x = -math.sin(angle)
        orth_y = math.cos(angle)
        
        b1_x = px + int(orth_x * 24)
        b1_y = py + int(orth_y * 24)
        b2_x = px - int(orth_x * 24)
        b2_y = py - int(orth_y * 24)
        
        draw.polygon([(tip_x, tip_y), (b1_x, b1_y), (px, py), (b2_x, b2_y)], fill=(120, 210, 255, 180), outline=(200, 240, 255, 230))

    supersample_save(im, (256, 256), "joystick_outer_ring.png")

# -------------------------------------------------------------
# 8. pet_avatar_frame.png (128x128, rendered at 512x512)
# -------------------------------------------------------------
def make_pet_avatar_frame():
    S = 512
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)
    cx, cy = S // 2, S // 2

    # Drop shadow
    draw.ellipse([cx - 235, cy - 225, cx + 235, cy + 245], fill=(10, 15, 25, 70))

    r_outer = 230
    r_inner = 175
    steps = 50
    for s in range(steps):
        t = s / steps
        r = int(r_inner + (r_outer - r_inner) * t)
        if t < 0.2:
            c = (235, 185, 75, 255)
        elif t < 0.5:
            c = (65, 45, 25, 255)
        elif t < 0.8:
            c = (175, 115, 45, 255)
        else:
            c = (245, 195, 90, 255)
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=c, width=3)

    # Cutout hole
    hole_mask = Image.new("L", (S, S), 0)
    h_draw = ImageDraw.Draw(hole_mask)
    h_draw.ellipse([cx - r_inner, cy - r_inner, cx + r_inner, cy + r_inner], fill=255)
    r, g, b, a = im.split()
    a_inv = ImageOps.invert(hole_mask)
    a_final = Image.composite(a, Image.new("L", (S, S), 0), a_inv)
    im.putalpha(a_final)

    supersample_save(im, (128, 128), "pet_avatar_frame.png")

# -------------------------------------------------------------
# 9. shortcut_slot_bg.png (128x128, rendered at 512x512)
# -------------------------------------------------------------
def make_shortcut_slot():
    S = 512
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)

    pad = 20
    # Outer dark shadow
    draw.rounded_rectangle([pad - 8, pad - 4, S - pad + 8, S - pad + 12], radius=60, fill=(5, 10, 15, 90))

    # Outer bronze/wood border
    draw.rounded_rectangle([pad, pad, S - pad, S - pad], radius=54, fill=(50, 42, 38, 255), outline=(145, 105, 60, 255), width=16)
    # Inner dark slot
    draw.rounded_rectangle([pad + 20, pad + 20, S - pad - 20, S - pad - 20], radius=38, fill=(22, 20, 24, 255), outline=(35, 30, 32, 255), width=8)

    supersample_save(im, (128, 128), "shortcut_slot_bg.png")

# -------------------------------------------------------------
# 10. Bottom Menu Icons (160x160, rendered at 640x640)
# -------------------------------------------------------------
def make_base_menu_button():
    S = 640
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)

    pad = 30
    # Shadow
    draw.rounded_rectangle([pad - 10, pad, S - pad + 10, S - pad + 20], radius=80, fill=(5, 10, 20, 80))

    # Outer border (slate/blue with metallic gold inner)
    draw.rounded_rectangle([pad, pad, S - pad, S - pad], radius=74, fill=(35, 55, 80, 255), outline=(155, 125, 75, 255), width=18)
    draw.rounded_rectangle([pad + 18, pad + 18, S - pad - 18, S - pad - 18], radius=58, fill=(28, 44, 66, 255), outline=(225, 185, 95, 255), width=8)

    # Soft radial background inside button
    for i in range(180, 0, -4):
        alpha = int(45 * (1 - i / 180))
        draw.ellipse([320 - i, 320 - i, 320 + i, 320 + i], fill=(90, 140, 200, alpha))

    return im

# 10.1 Loja (Shop / Awning)
def make_menu_shop():
    im = make_base_menu_button()
    draw = ImageDraw.Draw(im)
    cx, cy = 320, 320

    # Storefront Awning (Red & White striped)
    ax1, ay1 = cx - 180, cy - 110
    ax2, ay2 = cx + 180, cy + 20

    # Store building roof & walls behind
    draw.rectangle([ax1 + 25, ay2 - 10, ax2 - 25, cy + 140], fill=(225, 195, 150, 255), outline=(90, 60, 30, 255), width=10)
    # Shop door / window
    draw.rounded_rectangle([cx - 50, cy + 10, cx + 50, cy + 140], radius=15, fill=(65, 45, 30, 255))
    draw.rounded_rectangle([cx - 40, cy + 20, cx + 40, cy + 70], radius=8, fill=(130, 205, 255, 255))

    # Wooden counter shelf
    draw.rounded_rectangle([ax1 + 10, cy + 105, ax2 - 10, cy + 155], radius=12, fill=(160, 100, 45, 255), outline=(80, 45, 15, 255), width=8)

    # 5 Stripes Awning
    stripe_w = (ax2 - ax1) // 5
    colors = [(225, 55, 55, 255), (250, 245, 235, 255), (225, 55, 55, 255), (250, 245, 235, 255), (225, 55, 55, 255)]
    for i in range(5):
        sx1 = ax1 + i * stripe_w
        sx2 = sx1 + stripe_w
        # Tilted trapezoid for 3D canopy
        pts = [
            (sx1 + 10, ay1),
            (sx2 - 10, ay1),
            (sx2, ay2),
            (sx1, ay2)
        ]
        draw.polygon(pts, fill=colors[i], outline=(100, 30, 30, 255))
        # Scalloped bottom fringe
        draw.pieslice([sx1, ay2 - 18, sx2, ay2 + 22], start=0, end=180, fill=colors[i], outline=(100, 30, 30, 255))

    supersample_save(im, (160, 160), "menu_shop.png")

# 10.2 Pets (Paw print)
def make_menu_pets():
    im = make_base_menu_button()
    draw = ImageDraw.Draw(im)
    cx, cy = 320, 335

    # Main heart/bean palm pad
    # Warm golden-orange with highlight
    pad_w, pad_h = 170, 130
    draw.ellipse([cx - pad_w//2, cy - pad_h//2 + 30, cx + pad_w//2, cy + pad_h//2 + 30], fill=(245, 155, 35, 255), outline=(135, 75, 10, 255), width=10)
    draw.ellipse([cx - pad_w//2 + 15, cy - pad_h//2 + 35, cx + pad_w//2 - 15, cy + pad_h//2 + 15], fill=(255, 185, 65, 255))

    # 4 Toe Beans
    toes = [
        (cx - 105, cy - 65, 42, 58, -25),
        (cx - 38, cy - 110, 44, 64, -8),
        (cx + 38, cy - 110, 44, 64, 8),
        (cx + 105, cy - 65, 42, 58, 25)
    ]
    for tx, ty, tw, th, rot in toes:
        toe_im = Image.new("RGBA", (150, 150), (0, 0, 0, 0))
        t_draw = ImageDraw.Draw(toe_im)
        t_draw.ellipse([75 - tw, 75 - th, 75 + tw, 75 + th], fill=(245, 155, 35, 255), outline=(135, 75, 10, 255), width=10)
        t_draw.ellipse([75 - tw + 10, 75 - th + 10, 75 + tw - 10, 75 + th - 20], fill=(255, 195, 75, 255))
        rotated = toe_im.rotate(rot, resample=Image.Resampling.BICUBIC)
        im.alpha_composite(rotated, (tx - 75, ty - 75))

    supersample_save(im, (160, 160), "menu_pets.png")

# 10.3 Personagem (Knight Helmet)
def make_menu_character():
    im = make_base_menu_button()
    draw = ImageDraw.Draw(im)
    cx, cy = 320, 320

    # Helmet dome
    draw.ellipse([cx - 120, cy - 145, cx + 120, cy + 95], fill=(195, 205, 215, 255), outline=(60, 75, 90, 255), width=12)
    # Highlight
    draw.arc([cx - 100, cy - 130, cx + 100, cy + 70], start=210, end=330, fill=(255, 255, 255, 220), width=14)

    # Lower cheek/neck guards
    jaw_pts = [
        (cx - 115, cy - 10),
        (cx + 115, cy - 10),
        (cx + 85, cy + 140),
        (cx, cy + 165),
        (cx - 85, cy + 140)
    ]
    draw.polygon(jaw_pts, fill=(170, 180, 195, 255), outline=(60, 75, 90, 255))

    # Visor dark T-slit
    draw.rounded_rectangle([cx - 80, cy - 5, cx + 80, cy + 25], radius=8, fill=(25, 30, 40, 255))
    draw.rounded_rectangle([cx - 14, cy - 5, cx + 14, cy + 90], radius=6, fill=(25, 30, 40, 255))

    # Golden Helmet Crest / Plume
    crest_pts = [
        (cx - 30, cy - 135),
        (cx, cy - 195),
        (cx + 30, cy - 135)
    ]
    draw.polygon(crest_pts, fill=(245, 185, 45, 255), outline=(130, 80, 10, 255))

    supersample_save(im, (160, 160), "menu_character.png")

# 10.4 Inventário (Leather Backpack)
def make_menu_inventory():
    im = make_base_menu_button()
    draw = ImageDraw.Draw(im)
    cx, cy = 320, 325

    # Main backpack body (rich saddle brown leather)
    draw.rounded_rectangle([cx - 135, cy - 90, cx + 135, cy + 145], radius=45, fill=(145, 80, 30, 255), outline=(75, 35, 10, 255), width=12)

    # Rolled top bedroll / flap
    draw.rounded_rectangle([cx - 120, cy - 145, cx + 120, cy - 65], radius=28, fill=(185, 110, 45, 255), outline=(75, 35, 10, 255), width=10)

    # Front main pouch
    draw.rounded_rectangle([cx - 85, cy + 5, cx + 85, cy + 130], radius=22, fill=(165, 95, 35, 255), outline=(75, 35, 10, 255), width=8)

    # 2 Vertical leather straps with brass buckles
    for sx in [cx - 50, cx + 50]:
        draw.rectangle([sx - 10, cy - 140, sx + 10, cy + 140], fill=(100, 50, 15, 255))
        # Golden brass buckle
        draw.rounded_rectangle([sx - 16, cy - 15, sx + 16, cy + 15], radius=5, fill=(245, 195, 65, 255), outline=(110, 70, 10, 255), width=5)
        draw.rectangle([sx - 6, cy - 5, sx + 6, cy + 5], fill=(100, 50, 15, 255))

    supersample_save(im, (160, 160), "menu_inventory.png")

# 10.5 Quests (Parchment Scroll with checks)
def make_menu_quests():
    im = make_base_menu_button()
    draw = ImageDraw.Draw(im)
    cx, cy = 320, 320

    # Parchment clipboard/scroll body
    draw.rounded_rectangle([cx - 105, cy - 140, cx + 105, cy + 150], radius=20, fill=(245, 235, 205, 255), outline=(130, 105, 65, 255), width=10)

    # Top rolled scroll header
    draw.rounded_rectangle([cx - 125, cy - 165, cx + 125, cy - 115], radius=18, fill=(225, 205, 160, 255), outline=(110, 85, 50, 255), width=8)

    # 3 Quest task lines with green checkmarks
    for i, y in enumerate([cy - 65, cy + 5, cy + 75]):
        # Green checkmark
        ck_x, ck_y = cx - 65, y
        draw.line([(ck_x - 14, ck_y), (ck_x - 4, ck_y + 12), (ck_x + 16, ck_y - 14)], fill=(40, 180, 60, 255), width=8)
        # Task text line (gold/brown rule)
        draw.rounded_rectangle([cx - 30, y - 6, cx + 75, y + 6], radius=4, fill=(160, 135, 100, 255))

    supersample_save(im, (160, 160), "menu_quests.png")

# 10.6 Eventos (Gift Box with ribbon)
def make_menu_events():
    im = make_base_menu_button()
    draw = ImageDraw.Draw(im)
    cx, cy = 320, 335

    # Gift box body (festive crimson red)
    bx1, by1 = cx - 120, cy - 55
    bx2, by2 = cx + 120, cy + 135
    draw.rounded_rectangle([bx1, by1, bx2, by2], radius=18, fill=(215, 35, 45, 255), outline=(115, 10, 15, 255), width=10)

    # Gift box lid
    lx1, ly1 = cx - 135, cy - 95
    lx2, ly2 = cx + 135, cy - 45
    draw.rounded_rectangle([lx1, ly1, lx2, ly2], radius=14, fill=(235, 50, 60, 255), outline=(115, 10, 15, 255), width=10)

    # Golden vertical ribbon
    rw = 32
    draw.rectangle([cx - rw//2, ly1, cx + rw//2, by2], fill=(255, 215, 75, 255), outline=(145, 95, 10, 255), width=5)

    # Golden horizontal ribbon on box
    draw.rectangle([bx1, cy + 25 - rw//2, bx2, cy + 25 + rw//2], fill=(255, 215, 75, 255), outline=(145, 95, 10, 255), width=5)

    # Golden bow loops on top
    # Left loop
    draw.ellipse([cx - 95, cy - 165, cx, cy - 80], fill=(255, 215, 75, 255), outline=(145, 95, 10, 255), width=6)
    draw.ellipse([cx - 70, cy - 145, cx - 20, cy - 100], fill=(215, 35, 45, 255))
    # Right loop
    draw.ellipse([cx, cy - 165, cx + 95, cy - 80], fill=(255, 215, 75, 255), outline=(145, 95, 10, 255), width=6)
    draw.ellipse([cx + 20, cy - 145, cx + 70, cy - 100], fill=(215, 35, 45, 255))
    # Center knot
    draw.ellipse([cx - 24, cy - 110, cx + 24, cy - 70], fill=(255, 235, 120, 255), outline=(145, 95, 10, 255), width=6)

    supersample_save(im, (160, 160), "menu_events.png")


def make_potion(color_rgb, filename):
    S = 256
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)
    cx, cy = 128, 140
    # Cork stopper
    draw.rounded_rectangle([cx - 18, cy - 88, cx + 18, cy - 64], radius=4, fill=(160, 110, 60, 255), outline=(75, 45, 20, 255), width=4)
    # Glass neck
    draw.rectangle([cx - 22, cy - 64, cx + 22, cy - 36], fill=(210, 240, 255, 140), outline=(130, 180, 210, 220), width=4)
    # Flask body
    r = 60
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(210, 240, 255, 120), outline=(140, 195, 230, 255), width=6)
    # Liquid
    draw.ellipse([cx - (r - 8), cy - (r - 18), cx + (r - 8), cy + (r - 8)], fill=color_rgb)
    # Specular glint
    draw.arc([cx - r + 14, cy - r + 14, cx + r - 14, cy + r - 14], start=210, end=290, fill=(255, 255, 255, 230), width=6)
    supersample_save(im, (64, 64), filename)

def make_bread(filename):
    S = 256
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)
    cx, cy = 128, 128
    # Loaf body
    draw.ellipse([cx - 85, cy - 48, cx + 85, cy + 48], fill=(215, 145, 55, 255), outline=(115, 65, 15, 255), width=6)
    draw.ellipse([cx - 75, cy - 38, cx + 75, cy + 30], fill=(245, 175, 80, 255))
    # Score marks
    for off in [-40, 0, 40]:
        draw.line([(cx + off - 10, cy - 25), (cx + off + 10, cy + 25)], fill=(120, 65, 15, 255), width=6)
        draw.line([(cx + off - 6, cy - 20), (cx + off + 8, cy + 20)], fill=(255, 230, 180, 255), width=2)
    supersample_save(im, (64, 64), filename)

def make_scroll(filename):
    S = 256
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)
    cx, cy = 128, 128
    # Diagonal rolled parchment
    draw.rounded_rectangle([cx - 65, cy - 50, cx + 65, cy + 50], radius=16, fill=(245, 230, 195, 255), outline=(125, 95, 50, 255), width=6)
    # Red wax ribbon in center
    draw.rectangle([cx - 12, cy - 50, cx + 12, cy + 50], fill=(210, 40, 40, 255))
    draw.ellipse([cx - 18, cy - 18, cx + 18, cy + 18], fill=(180, 25, 25, 255), outline=(245, 185, 40, 255), width=3)
    supersample_save(im, (64, 64), filename)

def main():
    print("Generating HUD Assets for Etheria Campus...")
    make_player_avatar_frame()
    make_minimap_frame()
    make_settings_gear()
    make_gold_coin()
    make_crystal_gem()
    make_joystick_center()
    make_joystick_outer_ring()
    make_pet_avatar_frame()
    make_shortcut_slot()
    make_menu_shop()
    make_menu_pets()
    make_menu_character()
    make_menu_inventory()
    make_menu_quests()
    make_menu_events()
    make_potion((235, 45, 45, 255), 'shortcut_potion_hp.png')
    make_potion((35, 135, 245, 255), 'shortcut_potion_mp.png')
    make_bread('shortcut_food_bread.png')
    make_scroll('shortcut_scroll_teleport.png')
    make_potion((40, 200, 75, 255), 'shortcut_potion_antidote.png')
    make_potion((245, 60, 90, 255), 'shortcut_potion_buff.png')
    print("All HUD Assets Generated Successfully!")

if __name__ == "__main__":
    main()
