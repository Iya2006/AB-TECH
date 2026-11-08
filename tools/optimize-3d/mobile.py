# Versions « téléphone » des textures 3D : apps/web/public/assets/ph -> apps/web/public/assets/ph-m
# Usage : python tools/optimize-3d/mobile.py   (à relancer après textures.py si les textures changent)
#
# Sur iPhone, Safari ferme l'onglet quand la page dépasse sa mémoire : les textures pleine taille de la visite
# (près de 500 Mo une fois décodées) y suffisaient. Le site charge ces versions sur les appareils modestes
# (qualité « low », voir apps/web/src/three/mobileTextures.ts) :
# - couleur (diff) : 512 px au plus ; c'est elle qui se voit ;
# - relief, rugosité, métal, occlusion : 256 px au plus ; sur un écran de téléphone l'écart ne se voit pas.
from pathlib import Path

from PIL import Image

root = Path(__file__).resolve().parents[2] / "apps" / "web" / "public" / "assets"
src = root / "ph"
out = root / "ph-m"

total_in = total_out = 0
for f in sorted(list(src.glob("models/**/*.jpg")) + list(src.glob("tex/**/*.jpg"))):
    dest = out / f.relative_to(src)
    dest.parent.mkdir(parents=True, exist_ok=True)
    color = "diff" in f.stem
    limit = 512 if color else 256
    img = Image.open(f)
    scale = min(1.0, limit / max(img.size))
    if scale < 1:
        img = img.resize((max(1, round(img.width * scale)), max(1, round(img.height * scale))), Image.LANCZOS)
    img.convert("RGB").save(dest, "JPEG", quality=80 if color else 88, optimize=True, progressive=True)
    total_in += f.stat().st_size
    total_out += dest.stat().st_size
    print(f"{str(f.relative_to(src)):<78} {img.width:>4} px  {dest.stat().st_size // 1024:>4} Ko")

print(f"\n{total_in / 1048576:.1f} Mo -> {total_out / 1048576:.1f} Mo")
