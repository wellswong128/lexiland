#!/usr/bin/env python3
"""Generate Capacitor Android and iOS app icons from lexi-dragon-mascot.png."""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "lexi-dragon-mascot.png"
RESOURCES = ROOT / "resources"
ANDROID_RES = ROOT / "android" / "app" / "src" / "main" / "res"
IOS_ICON = ROOT / "ios" / "App" / "App" / "Assets.xcassets" / "AppIcon.appiconset" / "AppIcon-512@2x.png"

BACKGROUND = (238, 244, 255, 255)  # #eef4ff
FOREGROUND_SCALE = 0.72

ANDROID_LAUNCHER_SIZES = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}

ANDROID_FOREGROUND_SIZES = {
    "mipmap-mdpi": 108,
    "mipmap-hdpi": 162,
    "mipmap-xhdpi": 216,
    "mipmap-xxhdpi": 324,
    "mipmap-xxxhdpi": 432,
}


def load_mascot() -> Image.Image:
    image = Image.open(SOURCE).convert("RGBA")
    return image


def fit_on_square(image: Image.Image, size: int, scale: float, background=BACKGROUND) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), background)
    max_side = int(size * scale)
    ratio = min(max_side / image.width, max_side / image.height)
    target_w = max(1, int(round(image.width * ratio)))
    target_h = max(1, int(round(image.height * ratio)))
    resized = image.resize((target_w, target_h), Image.Resampling.LANCZOS)
    offset = ((size - target_w) // 2, (size - target_h) // 2)
    canvas.alpha_composite(resized, offset)
    return canvas


def save_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if image.mode == "RGBA":
        image.save(path, format="PNG", optimize=True)
    else:
        image.convert("RGB").save(path, format="PNG", optimize=True)


def main() -> None:
    mascot = load_mascot()

    master = fit_on_square(mascot, 1024, FOREGROUND_SCALE)
    save_png(master, RESOURCES / "icon.png")

    for folder, size in ANDROID_LAUNCHER_SIZES.items():
        icon = fit_on_square(mascot, size, FOREGROUND_SCALE)
        save_png(icon, ANDROID_RES / folder / "ic_launcher.png")
        save_png(icon, ANDROID_RES / folder / "ic_launcher_round.png")

    for folder, size in ANDROID_FOREGROUND_SIZES.items():
        foreground = fit_on_square(mascot, size, FOREGROUND_SCALE, background=(0, 0, 0, 0))
        save_png(foreground, ANDROID_RES / folder / "ic_launcher_foreground.png")

    save_png(master, IOS_ICON)
    print(f"Generated icons from {SOURCE.name}")
    print(f"  resources/icon.png")
    print(f"  iOS AppIcon-512@2x.png")
    print(f"  Android mipmap ic_launcher*, ic_launcher_round*, ic_launcher_foreground*")


if __name__ == "__main__":
    main()
