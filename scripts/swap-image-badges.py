"""Aplica a composição das capas originais com a logo do projeto."""

import hashlib
import json
import sys
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps


def find_badge(image):
    width, height = image.size
    region = image.crop((int(width * 0.55), 0, width, int(height * 0.35))).convert("RGB")
    small = region.resize((max(1, region.width // 4), max(1, region.height // 4)))
    pixels = small.load()
    points = [(x, y) for y in range(small.height) for x in range(small.width) if max(pixels[x, y]) < 50]
    if len(points) < small.width * small.height * 0.02:
        return None
    x0 = int(width * 0.55) + min(x for x, _ in points) * 4
    x1 = int(width * 0.55) + (max(x for x, _ in points) + 1) * 4
    if x1 < width * 0.97:
        return None
    return (x0, min(y for _, y in points) * 4, width, (max(y for _, y in points) + 1) * 4)


def swap_badge(image, logo, box):
    x0, y0, x1, y1 = box
    padding = int((y1 - y0) * 0.10)
    x0, y0, y1 = max(0, x0 - padding), max(0, y0 - padding), min(image.height, y1 + padding)
    panel_height = y1 - y0
    radius = max(8, int(panel_height * 0.18))
    ImageDraw.Draw(image).rounded_rectangle([x0, y0, x1 + radius, y1], radius=radius, fill=(13, 13, 13, 255))
    height = int(panel_height * 0.56)
    width = int(logo.width * height / logo.height)
    max_width = int((x1 - x0) * 0.86)
    if width > max_width:
        width = max_width
        height = int(logo.height * width / logo.width)
    raster = logo.resize((width, height), Image.Resampling.LANCZOS)
    image.alpha_composite(raster, (x0 + (x1 - x0 - width) // 2, y0 + (panel_height - height) // 2))


def details(path):
    data = path.read_bytes()
    with Image.open(path) as image:
        return {"sha256": hashlib.sha256(data).hexdigest(), "width": image.width, "height": image.height, "bytes": len(data)}


def process_image(directory, item, logo):
    original = directory / "originals" / item["filename"]
    with Image.open(original) as source:
        source.load()
        image = source.convert("RGBA")
    box = find_badge(image)
    if box:
        swap_badge(image, logo, box)
    rgb = image.convert("RGB")
    post = rgb.copy()
    if post.width > 800:
        post = post.resize((800, int(post.height * 800 / post.width)), Image.Resampling.LANCZOS)
    post_path = directory / "post" / item["filename"]
    post.save(post_path, optimize=True)
    crop_width = min(rgb.width, int(rgb.height * 300 / 225))
    thumb = rgb.crop((0, 0, crop_width, rgb.height)).resize((300, 225), Image.Resampling.LANCZOS)
    thumb_path = directory / "thumb" / item["filename"]
    thumb.save(thumb_path, optimize=True)
    return {**item, "badge_replaced": box is not None, "badge_box": box, "original": details(original),
            "post": details(post_path), "thumb": details(thumb_path)}


def contact_tile(directory, item, index):
    tile = Image.new("RGB", (432, 258), "#f4f4f4")
    draw = ImageDraw.Draw(tile)
    font = ImageFont.truetype("DejaVuSans.ttf", 14)
    status = "painel substituido" if item["badge_replaced"] else "SEM PAINEL DETECTADO"
    draw.text((8, 5), f"{index:02d} | {status}", fill="#111111", font=font)
    for line, text in enumerate(textwrap.wrap(item["slug"], width=48)[:2]):
        draw.text((8, 25 + line * 17), text, fill="#111111", font=font)
    with Image.open(directory / "post" / item["filename"]) as image:
        crop = image.crop((int(image.width * 0.50), 0, image.width, int(image.height * 0.43)))
        preview = ImageOps.contain(crop, (416, 192), Image.Resampling.LANCZOS)
        tile.paste(preview, (8, 62))
    return tile


def make_contact_sheets(directory, items):
    review = directory / "review"
    review.mkdir(exist_ok=True)
    for start in range(0, len(items), 12):
        sheet = Image.new("RGB", (432 * 3, 258 * 4), "#dedede")
        for offset, item in enumerate(items[start:start + 12]):
            sheet.paste(contact_tile(directory, item, start + offset + 1), ((offset % 3) * 432, (offset // 3) * 258))
        sheet.save(review / f"contact-{start // 12 + 1:02d}.jpg", quality=94)
    missing = [item for item in items if not item["badge_replaced"]]
    (review / "no-badge.json").write_text(json.dumps(missing, indent=2))
    if missing:
        (review / "no-badge").mkdir(exist_ok=True)
        for item in missing:
            with Image.open(directory / "post" / item["filename"]) as image:
                image.save(review / "no-badge" / item["filename"])
    print(json.dumps({"stage": "review", "directory": str(review), "sheets": (len(items) + 11) // 12, "without_badge": len(missing)}), flush=True)


def main():
    if len(sys.argv) != 2:
        raise ValueError("Uso: python3 scripts/swap-image-badges.py <diretório temporário>")
    directory = Path(sys.argv[1])
    items = json.loads((directory / "job.json").read_text())
    for kind in ("post", "thumb"):
        (directory / kind).mkdir(exist_ok=True)
    with Image.open(directory / "logo.png") as source:
        logo = source.convert("RGBA")
    results = []
    for item in items:
        try:
            results.append(process_image(directory, item, logo))
        except Exception as error:
            raise RuntimeError(f"Falha ao processar {item['filename']}: {error}") from error
        if len(results) % 10 == 0 or len(results) == len(items):
            print(json.dumps({"stage": "branding", "completed": len(results), "total": len(items)}), flush=True)
    make_contact_sheets(directory, results)
    (directory / "result.json").write_text(json.dumps(results))


if __name__ == "__main__":
    main()
