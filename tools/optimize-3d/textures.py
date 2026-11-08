# Recompresse les textures : src/ph -> apps/web/public/assets/ph   (Pillow)
# Usage : python tools/optimize-3d/textures.py   (après optimize.mjs, qui copie les textures des modèles)
#
# - Textures PBR (sol, murs, rue) : couleur (diff) en JPEG progressif qualité 72 ; vue en biais et répétée,
#   l'écart avec l'original ne se voit pas. Normales et rugosité : déjà en 512 px et légères, copiées.
# - Textures des modèles : réduites à la taille utile (petits objets vus de loin : 512 px) et recompressées.
#   Les cartes de normales gardent une meilleure qualité (artefacts visibles sinon).
import json
import shutil
from pathlib import Path

from PIL import Image

here = Path(__file__).resolve().parent
src = here / "src" / "ph"
out = here.parents[1] / "apps" / "web" / "public" / "assets" / "ph"

for f in sorted((src / "tex").glob("*/*.jpg")):
    dest = out / "tex" / f.relative_to(src / "tex")
    dest.parent.mkdir(parents=True, exist_ok=True)
    if f.name == "diff.jpg":
        Image.open(f).convert("RGB").save(dest, "JPEG", quality=72, optimize=True, progressive=True, subsampling="4:2:0")
    else:
        shutil.copyfile(f, dest)
    print(f"{str(f.relative_to(src)):<40} {f.stat().st_size // 1024:>4} -> {dest.stat().st_size // 1024:>4} Ko")

# Côté le plus long des textures de chaque modèle (par défaut 1024 : meubles vus de près).
SMALL = 512
MAX_SIZE = {
    "stationery_supplies": SMALL,
    "wall_clock": SMALL,
    "metal_trash_can": SMALL,
    "exterior_aircon_unit": SMALL,
    "utility_box_01": SMALL,
    "planter_box_01": SMALL,
    "potted_plant_04": SMALL,
    "cardboard_box_01": SMALL,
    "hanging_industrial_lamp": SMALL,
    "modular_street_seating": SMALL,
    "standing_picture_frame_01": SMALL,
    "steel_frame_shelves_03": SMALL,
}

total_in = total_out = 0
for gltf_path in sorted((src / "models").glob("*/*.gltf")):
    name = gltf_path.stem
    dest_dir = out / "models" / name
    if not dest_dir.exists():
        continue  # modèle non publié (absent d'optimize.mjs)
    limit = MAX_SIZE.get(name, 1024)
    for image in json.loads(gltf_path.read_text(encoding="utf-8")).get("images", []):
        rel = Path(image["uri"].replace("%20", " "))
        f = gltf_path.parent / rel
        dest = dest_dir / rel
        im = Image.open(f)
        if max(im.size) > limit:
            im = im.resize((limit * im.width // max(im.size), limit * im.height // max(im.size)), Image.LANCZOS)
        if f.suffix.lower() == ".png":
            im.save(dest, "PNG", optimize=True)
        else:
            normal = "nor" in f.stem.lower()
            im.convert("RGB").save(dest, "JPEG", quality=85 if normal else 76, optimize=True, progressive=True)
        total_in += f.stat().st_size
        total_out += dest.stat().st_size
print(f"textures des modèles : {total_in // 1024} -> {total_out // 1024} Ko")
