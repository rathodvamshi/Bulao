import math
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

def create_bulao_icons(output_dir="mobile/assets/images"):
    os.makedirs(output_dir, exist_ok=True)
    SIZE = 1024

    # 1. Background radial gradient
    # Deep, premium dark emerald / forest green
    center_color = (9, 74, 54)     # #094A36 - rich vibrant emerald core
    edge_color = (3, 34, 25)       # #032219 - deep luxurious dark green edge
    
    bg = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    center_x, center_y = SIZE / 2, SIZE / 2 * 0.96  # slightly raised optical center
    max_dist = math.sqrt((SIZE / 2) ** 2 + (SIZE / 2) ** 2)

    pixels = []
    for y in range(SIZE):
        for x in range(SIZE):
            dist = math.sqrt((x - center_x) ** 2 + (y - center_y) ** 2)
            t = min(1.0, dist / max_dist)
            # Smooth quadratic falloff
            t = t * (1.1 - 0.1 * t)
            t = min(1.0, max(0.0, t))
            r = int(center_color[0] * (1 - t) + edge_color[0] * t)
            g = int(center_color[1] * (1 - t) + edge_color[1] * t)
            b = int(center_color[2] * (1 - t) + edge_color[2] * t)
            pixels.append((r, g, b, 255))
    bg.putdata(pixels)

    # Subtle inner top-edge glass illumination
    highlight = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    hdraw = ImageDraw.Draw(highlight)
    hdraw.ellipse([-SIZE * 0.2, -SIZE * 0.6, SIZE * 1.2, SIZE * 0.45], fill=(255, 255, 255, 14))
    highlight = highlight.filter(ImageFilter.GaussianBlur(radius=40))
    bg = Image.alpha_composite(bg, highlight)

    # 2. Typography: Clean bold 'B'
    font_path = "mobile/assets/fonts/Inter-Bold.ttf"
    font_size = 650
    font = ImageFont.truetype(font_path, font_size)

    # Temp image to measure
    temp_img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw_temp = ImageDraw.Draw(temp_img)
    bbox = draw_temp.textbbox((0, 0), "B", font=font)
    glyph_w = bbox[2] - bbox[0]
    glyph_h = bbox[3] - bbox[1]

    # Center mathematically & optically
    pos_x = (SIZE - glyph_w) / 2 - bbox[0]
    pos_y = (SIZE - glyph_h) / 2 - bbox[1] - 4  # micro optical adjustment

    # 3. Ambient Occlusion & Deep Drop Shadow
    shadow_layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow_layer)
    # Deep ambient drop shadow
    sdraw.text((pos_x, pos_y + 18), "B", font=font, fill=(0, 16, 11, 150))
    shadow_deep = shadow_layer.filter(ImageFilter.GaussianBlur(radius=28))

    # Crisp contact shadow
    contact_layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    cdraw = ImageDraw.Draw(contact_layer)
    cdraw.text((pos_x, pos_y + 6), "B", font=font, fill=(0, 14, 9, 130))
    shadow_contact = contact_layer.filter(ImageFilter.GaussianBlur(radius=8))

    # 4. Foreground Letter 'B' Layer
    b_layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    bdraw = ImageDraw.Draw(b_layer)
    # Pure white with slight warm sheen
    bdraw.text((pos_x, pos_y), "B", font=font, fill=(255, 255, 255, 255))

    # 5. Composite Full App Icon (icon.png)
    full_icon = Image.alpha_composite(bg, shadow_deep)
    full_icon = Image.alpha_composite(full_icon, shadow_contact)
    full_icon = Image.alpha_composite(full_icon, b_layer)

    # 6. Composite Adaptive Foreground (adaptive-icon.png)
    # Transparent background with shadows + 'B'
    adaptive_fg = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    adaptive_fg = Image.alpha_composite(adaptive_fg, shadow_deep)
    adaptive_fg = Image.alpha_composite(adaptive_fg, shadow_contact)
    adaptive_fg = Image.alpha_composite(adaptive_fg, b_layer)

    # Save files
    icon_path = os.path.join(output_dir, "icon.png")
    adaptive_path = os.path.join(output_dir, "adaptive-icon.png")
    splash_path = os.path.join(output_dir, "splash-icon.png")
    favicon_path = os.path.join(output_dir, "favicon.png")

    full_icon.save(icon_path, "PNG", optimize=True)
    adaptive_fg.save(adaptive_path, "PNG", optimize=True)
    full_icon.resize((512, 512), Image.Resampling.LANCZOS).save(splash_path, "PNG", optimize=True)
    full_icon.resize((192, 192), Image.Resampling.LANCZOS).save(favicon_path, "PNG", optimize=True)

    print(f"Generated {icon_path} (1024x1024)")
    print(f"Generated {adaptive_path} (1024x1024)")
    print(f"Generated {splash_path} (512x512)")
    print(f"Generated {favicon_path} (192x192)")

if __name__ == "__main__":
    create_bulao_icons()
