"""
Textures de relief des tissus (cartes de normales répétables), dessinées par le calcul.
    python3 tools/models-3d/fabric_textures.py            → apps/web/public/assets/models3d/tex/

- jersey  : maille de T-shirt (colonnes de « V »), 3,2 cm par répétition
- cote    : bord-côte (col, poignets), 4 cm par répétition
- toile   : armure toile (tote bag, casquette), 2 cm par répétition
- molleton: maille plus grosse et plus irrégulière (sweat, pull), 4 cm par répétition
"""
import os

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '../../apps/web/public/assets/models3d/tex')
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)


def tile_noise(size, cells, seed):
    """Bruit lisse répétable : grille aléatoire périodique, interpolée."""
    r = np.random.default_rng(seed)
    g = r.random((cells, cells))
    idx = np.arange(size) * cells / size
    i0 = np.floor(idx).astype(int)
    f = idx - i0
    f = f * f * (3 - 2 * f)
    i1 = (i0 + 1) % cells
    rows = g[i0][:, i0] * (1 - f)[None, :] + g[i0][:, i1] * f[None, :]
    rows1 = g[i1][:, i0] * (1 - f)[None, :] + g[i1][:, i1] * f[None, :]
    return rows * (1 - f)[:, None] + rows1 * f[:, None]


def to_normal(height, strength):
    """Carte de normales (OpenGL, +Y vers le haut) à partir d'un relief répétable."""
    dx = (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) * 0.5
    dy = (np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)) * 0.5
    nx, ny, nz = -dx * strength, dy * strength, np.ones_like(height)
    length = np.sqrt(nx * nx + ny * ny + nz * nz)
    rgb = np.stack([nx / length, ny / length, nz / length], axis=-1) * 0.5 + 0.5
    return Image.fromarray((rgb * 255).round().astype(np.uint8), 'RGB')


def save(img, name, quality=88):
    path = os.path.join(OUT, name + '.webp')
    img.save(path, 'WEBP', quality=quality, method=6)
    print(name, img.size, round(os.path.getsize(path) / 1024, 1), 'Ko')


def knit(size, columns, rows, wobble, fuzz, seed):
    """Maille jersey : colonnes de mailles en V, légèrement irrégulières."""
    y, x = np.mgrid[0:size, 0:size] / size
    col = x * columns
    fx = col - np.floor(col)
    # chaque colonne a sa petite dérive, chaque rangée la sienne
    drift = (tile_noise(size, columns, seed) - 0.5) * wobble
    s = y * rows + np.abs(fx - 0.5) * 0.9 + drift
    v = 0.5 + 0.5 * np.cos(2 * np.pi * s)
    # creux entre deux colonnes, fil arrondi
    column = np.sin(np.pi * fx) ** 0.6
    h = (v ** 1.4) * column
    h += (tile_noise(size, size // 3, seed + 1) - 0.5) * fuzz  # fibres
    h += (tile_noise(size, 6, seed + 2) - 0.5) * 0.25  # ondulation du tricot
    return h


def rib(width, height, ribs, seed):
    y, x = np.mgrid[0:height, 0:width]
    fx = (x / width * ribs) % 1.0
    ridge = np.sin(np.pi * fx) ** 0.75  # côtes arrondies
    stitches = 0.5 + 0.5 * np.cos(2 * np.pi * (y / height * 10 + np.abs(fx - 0.5) * 0.8))
    h = ridge * 1.0 + stitches * ridge * 0.18
    n = np.random.default_rng(seed).random((height, width))
    return h + (n - 0.5) * 0.04


def weave(size, threads, seed):
    """Armure toile : chaîne et trame passent l'une sur l'autre, un fil sur deux."""
    y, x = np.mgrid[0:size, 0:size] / size
    u, v = x * threads, y * threads
    iu, iv = np.floor(u).astype(int), np.floor(v).astype(int)
    fu, fv = u - iu, v - iv
    over = ((iu + iv) % 2) == 0
    warp = np.sin(np.pi * fu) ** 0.8 * (0.55 + 0.45 * np.cos(np.pi * (fv - 0.5)))
    weft = np.sin(np.pi * fv) ** 0.8 * (0.55 + 0.45 * np.cos(np.pi * (fu - 0.5)))
    h = np.where(over, warp, weft)
    h += (tile_noise(size, size // 4, seed) - 0.5) * 0.12
    h += (tile_noise(size, 8, seed + 1) - 0.5) * 0.2
    return h


save(to_normal(knit(512, 28, 34, 0.35, 0.22, 11), 3.2), 'jersey-n')
save(to_normal(knit(512, 20, 22, 0.6, 0.45, 23), 3.6), 'molleton-n')
save(to_normal(rib(512, 128, 12, 5), 5.0), 'cote-n')
save(to_normal(weave(512, 32, 31), 3.0), 'toile-n')
