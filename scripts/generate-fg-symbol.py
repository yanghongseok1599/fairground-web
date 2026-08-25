from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public"

BLUE = (0, 71, 171, 255)
WHITE = (255, 255, 255, 255)

def crop_component(image: Image.Image, bbox: tuple[int, int, int, int]) -> Image.Image:
    crop = image.crop(bbox).convert("RGBA")
    alpha = crop.getchannel("A")
    # Force the real FairGround glyph to pure white while preserving antialiasing.
    white = Image.new("RGBA", crop.size, WHITE)
    white.putalpha(alpha)
    return white


def fit_height(image: Image.Image, height: int) -> Image.Image:
    ratio = height / image.height
    width = int(round(image.width * ratio))
    return image.resize((width, height), Image.Resampling.LANCZOS)


def build_fg_letters(size: int) -> Image.Image:
    logo = Image.open(OUT / "images" / "logo-horizontal.png").convert("RGBA")
    # Connected components from the FairGround wordmark:
    # F = first component, G = fifth component.
    f = crop_component(logo, (121, 135, 339, 630))
    g = crop_component(logo, (1322, 125, 1622, 640))

    letter_height = int(size * 0.52)
    f = fit_height(f, letter_height)
    g = fit_height(g, letter_height)
    gap = int(size * 0.055)
    canvas = Image.new("RGBA", (f.width + gap + g.width, max(f.height, g.height)), (0, 0, 0, 0))
    canvas.alpha_composite(f, (0, canvas.height - f.height))
    canvas.alpha_composite(g, (f.width + gap, canvas.height - g.height))
    return canvas


def make_icon(size: int, maskable: bool = False) -> Image.Image:
    icon = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    circle_mask = Image.new("L", (size, size), 0)
    if maskable:
        circle_mask.paste(255, (0, 0, size, size))
    else:
        circle_mask_draw = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        # Draw at 4x and downsample for a clean circular edge.
        big = Image.new("L", (size * 4, size * 4), 0)
        from PIL import ImageDraw

        draw = ImageDraw.Draw(big)
        inset = 0 if size >= 96 else 1
        draw.ellipse((inset * 4, inset * 4, size * 4 - 1 - inset * 4, size * 4 - 1 - inset * 4), fill=255)
        circle_mask = big.resize((size, size), Image.Resampling.LANCZOS)
        del circle_mask_draw

    blue_layer = Image.new("RGBA", (size, size), BLUE)
    blue_layer.putalpha(circle_mask)
    icon.alpha_composite(blue_layer)

    fg = build_fg_letters(size)
    fg_x = (size - fg.width) // 2
    fg_y = (size - fg.height) // 2
    icon.alpha_composite(fg, (fg_x, fg_y))
    return icon


def save_assets():
    master = make_icon(1024)
    master.save(OUT / "images" / "fg-symbol.png")
    master.save(OUT / "images" / "team-logos" / "fairground-ops-logo.png")
    master.save(OUT / "images" / "team-logos" / "fairground-ops-logo.webp", quality=96, method=6)
    master.save(OUT / "icons" / "icon-1024.png")
    master.resize((512, 512), Image.Resampling.LANCZOS).save(OUT / "icons" / "icon-512.png")
    master.resize((192, 192), Image.Resampling.LANCZOS).save(OUT / "icons" / "icon-192.png")
    master.resize((192, 192), Image.Resampling.LANCZOS).save(OUT / "favicon-192.png")
    master.resize((180, 180), Image.Resampling.LANCZOS).save(OUT / "apple-touch-icon.png")
    master.resize((96, 96), Image.Resampling.LANCZOS).save(OUT / "icons" / "badge-96.png")
    master.resize((32, 32), Image.Resampling.LANCZOS).save(OUT / "favicon-32.png")
    master.resize((16, 16), Image.Resampling.LANCZOS).save(OUT / "favicon-16.png")

    make_icon(512, maskable=True).save(OUT / "icons" / "icon-maskable-512.png")
    icon_sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    master.save(OUT / "favicon.ico", sizes=icon_sizes)
    master.save(ROOT / "src" / "app" / "favicon.ico", sizes=icon_sizes)


if __name__ == "__main__":
    save_assets()
