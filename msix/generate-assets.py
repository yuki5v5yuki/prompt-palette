"""Generate MSIX Store assets from icon.png"""
from PIL import Image
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SRC_ICON = os.path.join(SCRIPT_DIR, "..", "src-tauri", "icons", "icon.png")
ASSETS_DIR = os.path.join(SCRIPT_DIR, "Assets")

SIZES = {
    "StoreLogo.png": 50,
    "Square44x44Logo.png": 44,
    "Square150x150Logo.png": 150,
    "Wide310x150Logo.png": (310, 150),
    "Square310x310Logo.png": 310,
}

os.makedirs(ASSETS_DIR, exist_ok=True)
img = Image.open(SRC_ICON).convert("RGBA")

for name, size in SIZES.items():
    out = os.path.join(ASSETS_DIR, name)
    if isinstance(size, tuple):
        w, h = size
        # Center the icon on a wide canvas
        s = min(w, h)
        resized = img.resize((s, s), Image.LANCZOS)
        canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        canvas.paste(resized, ((w - s) // 2, 0))
        canvas.save(out)
    else:
        img.resize((size, size), Image.LANCZOS).save(out)
    print(f"  {name} ({size})")

print("Done!")
