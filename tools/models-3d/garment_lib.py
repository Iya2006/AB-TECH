"""
Fabrication des vêtements 3D du site, par simulation de tissu (Blender, hors ligne).

Principe, comme en confection : on dessine le patron à plat (devant, dos), on le place de part et d'autre
d'un buste, on coud les bords, et la simulation laisse tomber le tissu. Le patron à plat sert ensuite de
dépliage UV : le visuel du client s'imprime dessus sans déformation et suit les plis en 3D.

Unités : mètres. Axes Blender : Z vers le haut, le devant du vêtement regarde -Y.
"""
import math

import bmesh
import bpy
from mathutils import Vector
from mathutils.geometry import delaunay_2d_cdt

# --------------------------------------------------------------------------------------
# Scène
# --------------------------------------------------------------------------------------


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    scene.frame_start = 1
    scene.frame_end = 250
    scene.render.fps = 24
    return scene


def new_object(name, mesh):
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def activate(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


# --------------------------------------------------------------------------------------
# Buste (invisible dans le résultat : il donne sa forme au vêtement)
# --------------------------------------------------------------------------------------


def _ring(bm, z, rx, ry, cy=0.0, n=2.4, count=96, cx=0.0):
    """Section horizontale en super-ellipse (n = 2 : ellipse ; plus grand : plus carré)."""
    verts = []
    for i in range(count):
        a = 2 * math.pi * i / count
        c, s = math.cos(a), math.sin(a)
        x = cx + rx * math.copysign(abs(c) ** (2 / n), c)
        y = cy + ry * math.copysign(abs(s) ** (2 / n), s)
        verts.append(bm.verts.new((x, y, z)))
    return verts


def _loft(bm, rings, cap_start=True, cap_end=True):
    for a, b in zip(rings, rings[1:]):
        n = len(a)
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((a[i], a[j], b[j], b[i]))
    if cap_start:
        bm.faces.new(list(reversed(rings[0])))
    if cap_end:
        bm.faces.new(rings[-1])


def _tube(bm, p0, p1, r0, r1, count=48, segments=10):
    """Tube entre deux points (bras, cou), fermé aux deux bouts."""
    p0, p1 = Vector(p0), Vector(p1)
    axis = (p1 - p0).normalized()
    side = axis.cross(Vector((0, 1, 0)))
    if side.length < 1e-4:
        side = Vector((1, 0, 0))
    side.normalize()
    up = side.cross(axis).normalized()
    rings = []
    for k in range(segments + 1):
        t = k / segments
        c = p0.lerp(p1, t)
        r = r0 + (r1 - r0) * t
        rings.append([bm.verts.new(c + side * (r * math.cos(2 * math.pi * i / count)) + up * (r * math.sin(2 * math.pi * i / count))) for i in range(count)])
    _loft(bm, rings)
    # bouts arrondis
    for center, r, sign in ((p0, r0, -1), (p1, r1, 1)):
        bmesh.ops.create_uvsphere(bm, u_segments=40, v_segments=20, radius=r * 0.999, matrix=__import__('mathutils').Matrix.Translation(center))


# Hauteur du point d'épaule (près du cou) du patron, une fois le vêtement posé sur le buste.
SHOULDER_Z = 0.72

# Buste taille M. z = 0 : hanches ; le point d'épaule près du cou est vers z = 0,705.
TORSO = [
    # z, demi-largeur, demi-profondeur, décalage avant/arrière, carrure de la section
    (-0.30, 0.150, 0.105, 0.000, 2.3),
    (-0.12, 0.160, 0.110, 0.000, 2.3),
    (0.00, 0.160, 0.108, 0.000, 2.3),
    (0.12, 0.146, 0.098, -0.004, 2.3),
    (0.24, 0.150, 0.100, -0.008, 2.4),
    (0.36, 0.166, 0.114, -0.014, 2.5),
    (0.45, 0.174, 0.122, -0.016, 2.6),
    (0.53, 0.177, 0.114, -0.010, 2.6),
    (0.60, 0.184, 0.100, -0.002, 2.5),
    (0.640, 0.182, 0.085, 0.004, 2.3),
    (0.668, 0.148, 0.075, 0.008, 2.2),
    (0.690, 0.106, 0.067, 0.010, 2.1),
    (0.704, 0.070, 0.062, 0.010, 2.0),
]


def make_body(arm_angle=38.0, arms=True, name='Buste'):
    """Buste, épaules, bras et cou : un seul objet servant d'obstacle au tissu."""
    bm = bmesh.new()
    rings = [_ring(bm, z, rx, ry, cy, n) for z, rx, ry, cy, n in TORSO]
    _loft(bm, rings)
    # cou
    _tube(bm, (0, 0.012, 0.66), (0, -0.004, 0.86), 0.058, 0.054, segments=4)
    if arms:
        a = math.radians(arm_angle)
        for side in (-1, 1):
            shoulder = Vector((side * 0.196, 0.004, 0.612))
            direction = Vector((side * math.sin(a), 0.0, -math.cos(a)))
            elbow = shoulder + direction * 0.30
            # avant-bras légèrement ramené vers l'avant et vers le corps
            fore = Vector((side * math.sin(a * 0.8), -0.16, -math.cos(a * 0.8))).normalized()
            wrist = elbow + fore * 0.27
            _tube(bm, shoulder, elbow, 0.056, 0.046)
            _tube(bm, elbow, wrist, 0.045, 0.033)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = new_object(name, mesh)
    col = obj.modifiers.new('Collision', 'COLLISION')
    obj.collision.thickness_outer = 0.006
    obj.collision.thickness_inner = 0.02
    obj.collision.cloth_friction = 12.0
    obj.collision.damping = 0.6
    return obj


# --------------------------------------------------------------------------------------
# Patron
# --------------------------------------------------------------------------------------


def resample(points, step):
    """Polyligne rééchantillonnée à pas régulier (les deux extrémités sont gardées)."""
    out = [Vector(points[0])]
    pts = [Vector(p) for p in points]
    total = sum((b - a).length for a, b in zip(pts, pts[1:]))
    n = max(1, round(total / step))
    seg = total / n
    target, acc = seg, 0.0
    for a, b in zip(pts, pts[1:]):
        d = (b - a).length
        while acc + d >= target - 1e-9 and len(out) < n:
            t = (target - acc) / d
            out.append(a.lerp(b, t))
            target += seg
        acc += d
    out.append(pts[-1])
    return out


def arc(p0, p1, bulge_dir, bulge, n=12):
    """Courbe douce de p0 à p1, bombée de `bulge` dans la direction donnée (encolure, bas arrondi)."""
    p0, p1, d = Vector(p0), Vector(p1), Vector(bulge_dir)
    return [p0.lerp(p1, i / n) + d * (bulge * math.sin(math.pi * i / n)) for i in range(n + 1)]


def quarter_ellipse(center_point, side_point, n=14):
    """Encolure : quart d'ellipse du milieu (x = 0) au point d'épaule, tangente horizontale au milieu."""
    cx, cz = center_point
    sx, sz = side_point
    return [Vector((sx * math.sin(math.pi / 2 * i / n), cz + (sz - cz) * (1 - math.cos(math.pi / 2 * i / n)))) for i in range(n + 1)]


def point_in_polygon(p, poly):
    x, y = p
    inside = False
    j = len(poly) - 1
    for i in range(len(poly)):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def dist_to_polygon(p, poly):
    best = 1e9
    px, py = p
    j = len(poly) - 1
    for i in range(len(poly)):
        ax, ay = poly[j]
        bx, by = poly[i]
        dx, dy = bx - ax, by - ay
        L = dx * dx + dy * dy
        t = 0 if L == 0 else max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / L))
        qx, qy = ax + t * dx, ay + t * dy
        best = min(best, math.hypot(px - qx, py - qy))
        j = i
    return best


def triangulate_panel(outline, step):
    """
    Maillage régulier (triangles presque équilatéraux) d'une pièce de patron.
    `outline` : contour fermé, déjà échantillonné. Renvoie (points 2D, triangles) ; les `len(outline)`
    premiers points sont ceux du contour, dans l'ordre.
    """
    pts = [Vector((p[0], p[1])) for p in outline]
    poly = [(p.x, p.y) for p in pts]
    xs = [p[0] for p in poly]
    ys = [p[1] for p in poly]
    h = step * math.sqrt(3) / 2
    row = 0
    y = min(ys) + h * 0.5
    while y < max(ys):
        x = min(xs) + (step * 0.5 if row % 2 else 0.0)
        while x < max(xs):
            if point_in_polygon((x, y), poly) and dist_to_polygon((x, y), poly) > step * 0.55:
                pts.append(Vector((x, y)))
            x += step
        y += h
        row += 1
    n = len(outline)
    edges = [(i, (i + 1) % n) for i in range(n)]
    verts, _, faces, orig_verts, _, _ = delaunay_2d_cdt(pts, edges, [list(range(n))], 1, 1e-6)
    # le triangulateur peut réordonner : on rétablit l'ordre d'entrée
    remap = {}
    for new_index, origin in enumerate(orig_verts):
        if origin:
            remap[new_index] = origin[0]
    if len(remap) != len(verts) or len(verts) != len(pts):
        raise RuntimeError('Triangulation : points fusionnés ou ajoutés (%d → %d)' % (len(pts), len(verts)))
    tris = [tuple(remap[i] for i in f) for f in faces]
    return pts, tris


def bezier2(p0, c, p1, n=8):
    p0, c, p1 = Vector(p0), Vector(c), Vector(p1)
    return [(1 - t) ** 2 * p0 + 2 * (1 - t) * t * c + t ** 2 * p1 for t in (i / n for i in range(n + 1))]


def build_outline(segments, step):
    """
    Contour complet d'une pièce à partir de sa moitié droite (x ≥ 0), décrite du milieu du bas au milieu
    de l'encolure. `segments` : (nom, points, cousu). Renvoie le contour échantillonné et, pour chaque
    bord, les indices de ses points (« nom+ » à droite, « nom- » à gauche), du bas vers le haut : le même
    ordre pour le devant et le dos, ce qui apparie les points à coudre.
    """
    right = [(name, resample(pts, step), sew) for name, pts, sew in segments]
    outline, runs = [], {}
    for name, pts, _ in right:
        first = len(outline) - 1 if outline else 0
        outline.extend(pts[1:] if outline else pts)
        runs[name + '+'] = list(range(first, first + len(pts)))
    for name, pts, _ in reversed(right):
        mirrored = [Vector((-p.x, p.y)) for p in reversed(pts)]
        first = len(outline) - 1
        outline.extend(mirrored[1:])
        runs[name + '-'] = list(reversed(range(first, first + len(mirrored))))
    last = len(outline) - 1  # revenu au point de départ
    outline.pop()
    for key, indices in runs.items():
        runs[key] = [0 if i == last else i for i in indices]
    sewn = {name for name, _, sew in segments if sew}
    return outline, runs, sewn


# Bords libres du vêtement (drapeaux par sommet) : ils reçoivent ensuite un ourlet ou un bord-côte.
EDGE = {'hem': 1, 'cuff': 2, 'neck': 4, 'hood': 8, 'pocket': 16}


def make_garment(name, front_segments, back_segments, step=0.012, y_front=-0.16, y_back=0.135, z0=0.0, shape=None):
    """
    Les deux pièces à plat, de part et d'autre du buste, reliées par leurs fils de couture.
    Chaque sommet garde sa position dans le patron (couches « px », « pz », « piece ») pour le dépliage UV.
    """
    bm = bmesh.new()
    lpx = bm.verts.layers.float.new('px')
    lpz = bm.verts.layers.float.new('pz')
    lpiece = bm.verts.layers.int.new('piece')
    ledge = bm.verts.layers.int.new('edge')
    pieces = []
    outlines = []
    for piece, (segments, y) in enumerate(((front_segments, y_front), (back_segments, y_back))):
        outline, runs, sewn = build_outline(segments, step)
        pts, tris = triangulate_panel(outline, step)
        verts = []
        for p in pts:
            # `shape` : écart initial entre les deux pièces selon x (sac : bords déjà réunis, milieu entrouvert)
            v = bm.verts.new((p.x, y * shape(p.x, p.y) if shape else y, p.y + z0))
            v[lpx], v[lpz], v[lpiece] = p.x, p.y, piece
            verts.append(v)
        for key, indices in runs.items():
            flag = EDGE.get(key[:-1], 0)
            for i in indices:
                verts[i][ledge] |= flag
        for a, b, c in tris:
            f = bm.faces.new((verts[a], verts[b], verts[c]))
            f.smooth = True
        pieces.append((verts, runs, sewn))
        outlines.append([(p.x, p.y) for p in outline])
    # normales vers l'extérieur du vêtement (devant : -Y, dos : +Y)
    bm.normal_update()
    for f in bm.faces:
        front = f.verts[0][lpiece] == 0
        if (f.normal.y > 0) == front:
            f.normal_flip()
    # dépliage UV = le patron : devant dans la moitié gauche de la texture (2:1), dos dans la moitié droite,
    # retourné pour qu'un texte s'y lise à l'endroit. Même échelle partout : W mètres par demi-texture.
    xs = [abs(x) for o in outlines for x, _ in o]
    zs = [z for o in outlines for _, z in o]
    zmin = min(zs)
    W = math.ceil(max(2 * max(xs) / 0.94, (max(zs) - zmin) / 0.90) * 20) / 20
    luv = bm.loops.layers.uv.new('UVMap')
    for f in bm.faces:
        for loop in f.loops:
            v = loop.vert
            u = 0.25 + v[lpx] / (2 * W) if v[lpiece] == 0 else 0.75 - v[lpx] / (2 * W)
            loop[luv].uv = (u, 0.05 + (v[lpz] - zmin) / W)
    # fils de couture : arêtes libres entre les points correspondants du devant et du dos
    (fv, fr, fsewn), (bv, br, _) = pieces
    bm.verts.index_update()
    pairs = []
    for key, indices in fr.items():
        if key[:-1] not in fsewn:
            continue
        other = br[key]
        if len(other) != len(indices):
            raise RuntimeError('Couture %s : %d points devant, %d au dos' % (key, len(indices), len(other)))
        for i, j in zip(indices, other):
            a, b = fv[i], bv[j]
            if bm.edges.get((a, b)) is None:
                bm.edges.new((a, b))
            pairs.append((a.index, b.index))
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = new_object(name, mesh)
    obj['seam_pairs'] = [i for pair in pairs for i in pair]
    obj['outline_front'] = [c for p in outlines[0] for c in p]
    obj['outline_back'] = [c for p in outlines[1] for c in p]
    obj['uv_w'] = W
    obj['uv_zmin'] = zmin
    # bords du patron (moitié droite), pour dessiner coutures et surpiqûres dans la carte d'occlusion
    import json
    obj['runs'] = json.dumps([
        {name: [[round(c, 4) for c in p] for p in resample(pts, step)] for name, pts, _ in segments}
        for segments in (front_segments, back_segments)
    ])
    return obj


def pattern_uv(obj, x, z, back=False):
    """Coordonnées UV d'un point du patron (devant ou dos)."""
    W = obj['uv_w']
    return ((0.75 - x / (2 * W)) if back else (0.25 + x / (2 * W)), 0.05 + (z - obj['uv_zmin']) / W)


# --------------------------------------------------------------------------------------
# Simulation
# --------------------------------------------------------------------------------------

FABRICS = {
    # jersey de coton (T-shirt, polo) : souple, plis fins
    'jersey': dict(mass=0.22, tension=18, compression=18, shear=6, bending=0.35, damping=6),
    # molleton (sweat, pull) : plus lourd, plis larges
    'molleton': dict(mass=0.34, tension=30, compression=30, shear=12, bending=2.2, damping=8),
    # toile (tote bag) : raide
    'toile': dict(mass=0.4, tension=60, compression=60, shear=30, bending=12, damping=10),
}


def pin_edges(obj, flag, name='pin'):
    """Groupe de sommets des bords portant le drapeau donné : ils restent en place pendant la simulation."""
    group = obj.vertex_groups.new(name=name)
    layer = obj.data.attributes['edge'].data
    group.add([i for i in range(len(obj.data.vertices)) if layer[i].value & flag], 1.0, 'REPLACE')
    return name


def add_cloth(obj, fabric='jersey', sewing_force=6.0, self_collision=False, quality=10, pin=None, pressure=0.0, slack=0.0):
    f = FABRICS[fabric]
    mod = obj.modifiers.new('Tissu', 'CLOTH')
    s = mod.settings
    s.quality = quality
    s.mass = f['mass']
    s.tension_stiffness = f['tension']
    s.compression_stiffness = f['compression']
    s.shear_stiffness = f['shear']
    s.bending_stiffness = f['bending']
    s.tension_damping = f['damping']
    s.compression_damping = f['damping']
    s.shear_damping = f['damping']
    s.bending_damping = 0.5
    s.air_damping = 1.5
    s.use_sewing_springs = True
    s.sewing_force_max = sewing_force
    if pin:
        s.vertex_group_mass = pin
        s.pin_stiffness = 1.0
    if slack:
        # un peu d'aisance : le tissu, plus grand que son cadre, se détend en plis souples
        s.shrink_min = -slack
    if pressure:
        # léger gonflant : le sac a du volume, comme s'il était garni
        s.use_pressure = True
        s.uniform_pressure_force = pressure
    c = mod.collision_settings
    c.use_collision = True
    c.collision_quality = 4
    c.distance_min = 0.005
    c.friction = 12
    c.use_self_collision = self_collision
    c.self_distance_min = 0.004
    c.self_friction = 5
    return mod


def simulate(obj, frames, gravity_from=10, gravity_full=28, log=None):
    """
    Avance la simulation image par image. La pesanteur est animée (courbe, et non réglage modifié en cours
    de route : cela viderait le cache) : elle n'arrive qu'une fois les coutures fermées.
    """
    scene = bpy.context.scene
    mod = obj.modifiers['Tissu']
    w = mod.settings.effector_weights
    mod.point_cache.frame_start = 1
    mod.point_cache.frame_end = frames
    if gravity_full > 1:
        w.gravity = 0.0
        w.keyframe_insert('gravity', frame=1)
        w.keyframe_insert('gravity', frame=gravity_from)
        w.gravity = 1.0
        w.keyframe_insert('gravity', frame=gravity_full)
    for frame in range(1, frames + 1):
        scene.frame_set(frame)
        if log and frame % 20 == 0:
            log(frame)
    return scene.frame_current


def freeze(obj):
    """Fige le résultat de la simulation dans le maillage et retire le modificateur."""
    deps = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(deps)
    coords = [v.co.copy() for v in evaluated.data.vertices]
    obj.modifiers.remove(obj.modifiers['Tissu'])
    for v, co in zip(obj.data.vertices, coords):
        v.co = co
    obj.data.update()


def relax(obj, iterations=4, factor=0.5):
    """Détend le maillage (lissage doux) : efface les petits froissements serrés, garde les grands plis."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    for _ in range(iterations):
        bmesh.ops.smooth_vert(bm, verts=bm.verts, factor=factor, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bm.normal_update()
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()


def weld_seams(obj):
    """Ferme les coutures : chaque paire de points cousus devient un seul point (les UV restent par pièce)."""
    pairs = list(obj['seam_pairs'])
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.verts.ensure_lookup_table()
    target = {}
    for a, b in zip(pairs[0::2], pairs[1::2]):
        va, vb = bm.verts[a], bm.verts[b]
        if va is vb or vb in target or va in target:
            continue
        va.co = (va.co + vb.co) / 2
        target[vb] = va
    welded = set(target.values())
    bmesh.ops.weld_verts(bm, targetmap=target)
    loose = [e for e in bm.edges if not e.link_faces]
    bmesh.ops.delete(bm, geom=loose, context='EDGES')
    # la couture est lissée le long de son fil : plus de dents d'un point au suivant
    welded = [v for v in welded if v.is_valid]
    chain = set(welded)
    for _ in range(4):
        moved = {}
        for v in welded:
            near = [e.other_vert(v) for e in v.link_edges if e.other_vert(v) in chain]
            if len(near) == 2:
                moved[v] = v.co * 0.5 + (near[0].co + near[1].co) * 0.25
        for v, co in moved.items():
            v.co = co
    bm.normal_update()
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()


# --------------------------------------------------------------------------------------
# Finitions : bord-côte de l'encolure, ourlets
# --------------------------------------------------------------------------------------


def _boundary_loops(bm, flag):
    """Boucles fermées de sommets du bord libre portant le drapeau donné, dans l'ordre."""
    ledge = bm.verts.layers.int['edge']
    adj = {}
    for e in bm.edges:
        if len(e.link_faces) == 1 and all(v[ledge] & flag for v in e.verts):
            a, b = e.verts
            adj.setdefault(a, []).append(b)
            adj.setdefault(b, []).append(a)
    loops, seen = [], set()
    for start in list(adj):
        if start in seen:
            continue
        loop, prev, cur = [start], None, start
        seen.add(start)
        while True:
            nxt = [v for v in adj[cur] if v is not prev and v not in seen]
            if not nxt:
                break
            prev, cur = cur, nxt[0]
            loop.append(cur)
            seen.add(cur)
        if len(loop) >= 8:
            loops.append(loop)
    return loops


def _frames(loop):
    """Pour chaque point d'un bord : position, normale du tissu, direction qui prolonge le tissu au-delà du bord."""
    out = []
    n_pts = len(loop)
    for i, v in enumerate(loop):
        prev, nxt = loop[i - 1], loop[(i + 1) % n_pts]
        t = (nxt.co - prev.co).normalized()
        n = v.normal.copy()
        inside = sum((f.calc_center_median() for f in v.link_faces), Vector()) / len(v.link_faces)
        d = v.co - inside
        d -= t * d.dot(t)
        d -= n * d.dot(n)
        if d.length < 1e-6:
            d = n.cross(t)
        out.append((v.co.copy(), n, d.normalized(), t))
    # directions lissées le long du bord (pas de dents d'un sommet à l'autre)
    for _ in range(3):
        sm = []
        for i, (p, n, d, t) in enumerate(out):
            d2 = (out[i - 1][2] + d * 2 + out[(i + 1) % n_pts][2]).normalized()
            n2 = (out[i - 1][1] + n * 2 + out[(i + 1) % n_pts][1]).normalized()
            sm.append((p, n2, d2, t))
        out = sm
    return out


def add_rib(obj, flag, profile, name='Cote', lift=0.0, tile=0.04):
    """
    Bord-côte cousu sur un bord libre (encolure, poignets, bas de sweat) : une bande repliée, avec son épaisseur.
    `profile` : points (le long du prolongement du tissu, en épaisseur) de la face extérieure à la face intérieure.
    Renvoie un nouvel objet, déplié en unités métriques (1 = `tile` m) pour la texture de côtes.
    """
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.normal_update()
    loops = _boundary_loops(bm, flag)
    rib = bmesh.new()
    uv = rib.loops.layers.uv.new('UVMap')
    for loop in loops:
        frames = _frames(loop)
        rows, lengths = [], [0.0]
        for i, (p, n, d, t) in enumerate(frames):
            d2 = (d + Vector((0, 0, lift))).normalized()
            rows.append([rib.verts.new(p + d2 * a + n * b) for a, b in profile])
            if i:
                lengths.append(lengths[-1] + (p - frames[i - 1][0]).length)
        lengths.append(lengths[-1] + (frames[0][0] - frames[-1][0]).length)
        across = [0.0]
        for (a0, b0), (a1, b1) in zip(profile, profile[1:]):
            across.append(across[-1] + math.hypot(a1 - a0, b1 - b0))
        for i in range(len(rows)):
            j = (i + 1) % len(rows)
            for k in range(len(profile) - 1):
                quad = (rows[i][k], rows[j][k], rows[j][k + 1], rows[i][k + 1])
                f = rib.faces.new(quad)
                f.smooth = True
                f.normal_update()
                # la face extérieure regarde du même côté que le tissu
                want = frames[i][1] if k < len(profile) // 2 else -frames[i][1]
                flipped = f.normal.dot(want) < 0
                if flipped:
                    f.normal_flip()
                us = {rows[i][k]: lengths[i], rows[j][k]: lengths[i + 1], rows[j][k + 1]: lengths[i + 1], rows[i][k + 1]: lengths[i]}
                vs = {rows[i][k]: across[k], rows[j][k]: across[k], rows[j][k + 1]: across[k + 1], rows[i][k + 1]: across[k + 1]}
                for l in f.loops:
                    l[uv].uv = (us[l.vert] / tile, vs[l.vert] / tile)
    bm.free()
    mesh = bpy.data.meshes.new(name)
    rib.to_mesh(mesh)
    rib.free()
    return new_object(name, mesh)


def add_hems(obj, flag, depth=0.012, thickness=0.0022):
    """Ourlet : le bord se replie vers l'intérieur (bord arrondi, épaisseur visible dans les ouvertures)."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.normal_update()
    luv = bm.loops.layers.uv['UVMap']
    for loop in _boundary_loops(bm, flag):
        frames = _frames(loop)
        profile = [(0.0010, -thickness * 0.5), (-0.0015, -thickness), (-depth, -thickness)]
        rows = [[v] + [bm.verts.new(p + d * a + n * b) for a, b in profile] for v, (p, n, d, t) in zip(loop, frames)]
        for i in range(len(rows)):
            j = (i + 1) % len(rows)
            edge = bm.edges.get((rows[i][0], rows[j][0]))
            src = edge.link_faces[0] if edge and edge.link_faces else None
            uvs = {}
            if src:
                for l in src.loops:
                    uvs[l.vert] = l[luv].uv.copy()
            for k in range(len(profile)):
                f = bm.faces.new((rows[i][k], rows[j][k], rows[j][k + 1], rows[i][k + 1]))
                f.smooth = True
                f.normal_update()
                # le repli regarde vers l'intérieur du vêtement
                if f.normal.dot(frames[i][1]) > 0 and k > 0:
                    f.normal_flip()
                for l in f.loops:
                    base = rows[i][0] if l.vert in rows[i] else rows[j][0]
                    l[luv].uv = uvs.get(base, (0.0, 0.0))
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()


# --------------------------------------------------------------------------------------
# Accessoires posés sur le tissu drapé (patte de boutonnage, col, poche…)
# --------------------------------------------------------------------------------------


class Surface:
    """Retrouve, pour un point du patron, sa position 3D et sa normale sur le vêtement simulé."""

    def __init__(self, obj):
        from mathutils.bvhtree import BVHTree

        self.obj = obj
        self.W = obj['uv_w']
        self.zmin = obj['uv_zmin']
        mesh = obj.data
        uv = mesh.uv_layers['UVMap'].data
        self.polys = []
        flat, tris = [], []
        for poly in mesh.polygons:
            if poly.loop_total != 3:
                continue
            base = len(flat)
            for li in poly.loop_indices:
                u, v = uv[li].uv
                flat.append(Vector((u, v, 0.0)))
            tris.append((base, base + 1, base + 2))
            self.polys.append(poly.index)
        self.flat = flat
        self.tris = tris
        self.tree = BVHTree.FromPolygons(flat, tris)

    def uv(self, x, z, back=False):
        return pattern_uv(self.obj, x, z, back)

    def at(self, x, z, back=False):
        """(position, normale) au point (x, z) du patron ; None s'il est hors de la pièce."""
        from mathutils.interpolate import poly_3d_calc

        u, v = self.uv(x, z, back)
        hit = self.tree.ray_cast(Vector((u, v, 1.0)), Vector((0, 0, -1)))
        if hit[0] is None:
            hit = self.tree.find_nearest(Vector((u, v, 0.0)))
            if hit[0] is None or hit[3] > 0.01:
                return None
        loc, _, index, _ = hit
        a, b, c = self.tris[index]
        w = poly_3d_calc([self.flat[a], self.flat[b], self.flat[c]], loc)
        mesh = self.obj.data
        poly = mesh.polygons[self.polys[index]]
        vs = [mesh.vertices[i] for i in poly.vertices]
        pos = sum((v.co * k for v, k in zip(vs, w)), Vector())
        nor = sum((v.normal * k for v, k in zip(vs, w)), Vector()).normalized()
        return pos, nor


def smooth_object(obj, levels=1):
    """Subdivise une pièce rapportée (col, patte) pour arrondir ses facettes."""
    mod = obj.modifiers.new('Lissage', 'SUBSURF')
    mod.levels = levels
    mod.render_levels = levels
    mod.boundary_smooth = 'PRESERVE_CORNERS'
    activate(obj)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj


def _strip_mesh(name, rows, uvs, closed=False, flip=False):
    """Bande de quadrilatères entre des rangées de points (rows[i][k]) ; `uvs` : mêmes dimensions."""
    bm = bmesh.new()
    layer = bm.loops.layers.uv.new('UVMap')
    grid = [[bm.verts.new(p) for p in row] for row in rows]
    lookup = {}
    for row, urow in zip(grid, uvs):
        for v, t in zip(row, urow):
            lookup[v] = t
    n_rows = len(grid)
    for i in range(n_rows if closed else n_rows - 1):
        j = (i + 1) % n_rows
        for k in range(len(grid[i]) - 1):
            quad = (grid[i][k], grid[j][k], grid[j][k + 1], grid[i][k + 1])
            f = bm.faces.new(tuple(reversed(quad)) if flip else quad)
            f.smooth = True
            for l in f.loops:
                l[layer].uv = lookup[l.vert]
    bm.normal_update()
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    return new_object(name, mesh)


def add_placket(obj, surface, top_z, length=0.13, width=0.034, buttons=(0.035, 0.085), name='Patte'):
    """
    Patte de boutonnage du polo : bande en léger relief au milieu du devant, sous l'encolure, et ses boutons.
    Renvoie (patte, boutons) : la patte garde le dépliage du patron (même teinte et mêmes ombres que le tissu).
    """
    cols, n_rows = 7, 16
    rows, uvs = [], []
    for i in range(n_rows + 1):
        z = top_z + 0.004 - (length + 0.004) * i / n_rows
        row, urow = [], []
        for k in range(cols):
            t = k / (cols - 1)
            x = (t - 0.5) * width
            hit = surface.at(x, z)
            if hit is None:
                hit = surface.at(x, top_z - 0.004)
            pos, nor = hit
            # bords biseautés : la bande s'élève de 2 mm au-dessus du tissu
            edge = min(t, 1 - t) * (cols - 1)
            end = min(i, n_rows - i)
            lift = 0.0022 * min(1.0, edge) * (1.0 if end else 0.25) + 0.0003
            row.append(pos + nor * lift)
            urow.append(surface.uv(x, z))
        rows.append(row)
        uvs.append(urow)
    placket = _strip_mesh(name, rows, uvs)
    # la face visible regarde vers l'extérieur du vêtement (sinon le site la traite comme un envers, plus sombre)
    outward = surface.at(0.0, top_z - length / 2)[1]
    if placket.data.polygons[len(placket.data.polygons) // 2].normal.dot(outward) < 0:
        placket.data.flip_normals()
    # boutons : petits disques bombés, posés sur la patte
    bm = bmesh.new()
    for offset in buttons:
        hit = surface.at(0.0, top_z - offset)
        if hit is None:
            continue
        pos, nor = hit
        quat = nor.to_track_quat('Z', 'Y')
        mat = __import__('mathutils').Matrix.Translation(pos + nor * 0.0036) @ quat.to_matrix().to_4x4()
        ring = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=20, radius1=0.0058, radius2=0.0050, depth=0.0022, matrix=mat)
    for f in bm.faces:
        f.smooth = True
    mesh = bpy.data.meshes.new('Boutons')
    bm.to_mesh(mesh)
    bm.free()
    return placket, new_object('Boutons', mesh)


def add_polo_collar(obj, surface, stand=0.026, fall_back=0.056, fall_front=0.074, gap=0.010, tile=0.04, name='Col'):
    """
    Col de polo : pied de col qui monte le long du cou, puis tombant rabattu sur le vêtement, ouvert devant.
    Le tombant suit le tissu drapé (échantillonné dans le patron), avec ses deux pointes de part et d'autre de la patte.
    """
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.normal_update()
    luv = bm.loops.layers.uv['UVMap']
    loops = _boundary_loops(bm, EDGE['neck'])
    if not loops:
        bm.free()
        return None
    loop = max(loops, key=len)
    frames = _frames(loop)
    W, zmin = obj['uv_w'], obj['uv_zmin']
    # position de chaque point de l'encolure dans le patron (lue dans le dépliage de la face voisine)
    pts = []
    for v in loop:
        face = next(f for e in v.link_edges if len(e.link_faces) == 1 for f in e.link_faces)
        u, vv = next(l[luv].uv for l in face.loops if l.vert is v)
        back = u > 0.5
        x = (0.75 - u) * 2 * W if back else (u - 0.25) * 2 * W
        pts.append((x, (vv - 0.05) * W + zmin, back))
    bm.free()
    n = len(loop)
    # départ au milieu du devant, en tournant vers +x
    start = min(range(n), key=lambda i: (abs(pts[i][0]) + (10 if pts[i][2] else 0)))
    order = [(start + k) % n for k in range(n)]
    if pts[order[1]][0] < pts[order[-1]][0]:
        order = [order[0]] + list(reversed(order[1:]))
    center = Vector((0.0, sum(p[1] for p in pts) / n))
    rows, uvs, length = [], [], 0.0
    prev = None
    for rank, i in enumerate(order + [order[0]]):
        x, z, back = pts[i]
        p, nrm, d, t = frames[i]
        front_tip = (not back) and abs(x) < gap
        if front_tip and 0 < rank < n:
            continue
        # le dernier point referme la boucle au milieu du devant : de l'autre côté de l'ouverture
        side = 1.0 if rank < n / 2 else -1.0
        if front_tip:
            hit = surface.at(side * gap, z)
            if hit:
                p, nrm = hit
            x = side * gap
        if prev is not None:
            length += (p - prev).length
        prev = p
        # direction « vers l'intérieur de la pièce » dans le patron : on s'éloigne du centre de l'encolure
        away = Vector((x, z)) - center
        away.normalize()
        k_front = max(0.0, 1.0 - abs(x) / 0.05) if not back else 0.0
        fall = fall_back + (fall_front - fall_back) * k_front
        up = (Vector((0, 0, 1)) * 0.9 + Vector((d.x, d.y, 0)) * 0.42).normalized()
        # pied de col plus bas devant (il rejoint la patte) que derrière
        rise = stand * (1.0 if back else 0.55 + 0.45 * min(1.0, abs(x) / 0.08))
        row = [p + nrm * 0.0012, p + up * (rise * 0.55) + nrm * 0.002, p + up * rise + nrm * 0.004]
        for frac, lift in ((0.10, 0.011), (0.32, 0.010), (0.62, 0.0065), (0.86, 0.0045), (1.0, 0.0032)):
            q = Vector((x, z)) + away * (fall * frac - 0.004)
            hit = surface.at(q.x, q.y, back)
            if hit is None:
                hit = (p - d * (fall * frac), nrm)
            sp, sn = hit
            row.append(sp + sn * lift + up * (rise * 0.35 * max(0.0, 1 - frac * 2.2)))
        # bord roulé
        row.append(row[-1] - (row[-1] - row[-2]).normalized() * -0.0015 - nrm * 0.0026)
        across = [0.0]
        for a, b in zip(row, row[1:]):
            across.append(across[-1] + (b - a).length)
        rows.append(row)
        uvs.append([(length / tile, a / tile) for a in across])
    return _strip_mesh(name, rows, uvs, closed=False, flip=True)


def _neckline(obj):
    """
    L'encolure du vêtement drapé, dans l'ordre (départ au milieu du devant, vers +x) :
    liste de (x, z, dos ?, position, normale, direction qui prolonge le tissu).
    """
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.normal_update()
    luv = bm.loops.layers.uv['UVMap']
    loops = _boundary_loops(bm, EDGE['neck'])
    if not loops:
        bm.free()
        return []
    loop = max(loops, key=len)
    frames = _frames(loop)
    W, zmin = obj['uv_w'], obj['uv_zmin']
    pts = []
    for v in loop:
        face = next(f for e in v.link_edges if len(e.link_faces) == 1 for f in e.link_faces)
        u, vv = next(l[luv].uv for l in face.loops if l.vert is v)
        back = u > 0.5
        x = (0.75 - u) * 2 * W if back else (u - 0.25) * 2 * W
        pts.append((x, (vv - 0.05) * W + zmin, back))
    bm.free()
    n = len(loop)
    start = min(range(n), key=lambda i: (abs(pts[i][0]) + (10 if pts[i][2] else 0)))
    order = [(start + k) % n for k in range(n)]
    if pts[order[1]][0] < pts[order[-1]][0]:
        order = [order[0]] + list(reversed(order[1:]))
    return [(pts[i][0], pts[i][1], pts[i][2], frames[i][0], frames[i][1], frames[i][2]) for i in order]


def add_hood(obj, surface, drop=0.31, shoulder=0.085, front=0.04, stand=0.05, tile=0.04, name='Capuche'):
    """
    Capuche rabattue dans le dos : elle monte autour du cou comme un grand col souple, se retourne et retombe en
    poche sur le dos (`drop` mètres au milieu), plus courte sur les épaules et devant, où ses deux bords se rejoignent.
    Elle suit le vêtement drapé (échantillonné dans le patron). Dépliage métrique (1 = `tile` m), sans carte d'ombres.
    """
    ring = _neckline(obj)
    if not ring:
        return None
    n = len(ring)
    half = max(abs(x) for x, _, back, *_ in ring if back) or 0.1
    center = Vector((0.0, sum(z for _, z, *_ in ring) / n))
    rows, uvs, length, prev = [], [], 0.0, None
    for rank, (x, z, back, p, nrm, d) in enumerate(ring + [ring[0]]):
        if prev is not None:
            length += (p - prev).length
        prev = p
        away = Vector((x, z)) - center
        away.normalize()
        if back:
            k = 1 - (abs(x) / half) ** 2.6  # 1 au milieu du dos, 0 à la pointe d'épaule
            fall = shoulder + (drop - shoulder) * max(0.0, k)
            # la poche tombe droit dans le dos, sans s'évaser comme le ferait l'éventail des directions
            away = (away * 0.35 + Vector((0.0, -1.0)) * 0.65 * max(0.0, k) + away * 0.65 * (1 - max(0.0, k))).normalized()
            volume = 0.012 + 0.026 * max(0.0, k)
            rise = stand
        else:
            k = min(1.0, abs(x) / 0.09)  # 0 au milieu du devant
            fall = front + (shoulder - front) * k
            volume = 0.008 + 0.004 * k
            rise = stand * (0.45 + 0.55 * k)
        up = (Vector((0, 0, 1)) * 0.85 + Vector((d.x, d.y, 0)) * 0.5).normalized()
        row = [p + nrm * 0.0015, p + up * (rise * 0.5) + nrm * (volume * 0.45), p + up * rise + nrm * (volume * 1.05)]
        steps = 9
        for q in range(1, steps + 1):
            frac = q / steps
            target = Vector((x, z)) + away * (fall * frac)
            hit = surface.at(target.x, target.y, back)
            if hit is None:
                hit = (p - d * (fall * frac), nrm)
            sp, sn = hit
            # épaisseur de la capuche repliée : pleine en haut, elle s'amincit vers le bas et se referme
            lift = volume * (1.0 - 0.55 * frac) * (1.0 if frac < 0.9 else 0.55)
            row.append(sp + sn * lift + up * (rise * 0.55 * max(0.0, 1 - frac * 2.4)))
        # le bas de la poche revient contre le dos
        row.append(row[-1] - nrm * (volume * 0.42) - (row[-1] - row[-2]).normalized() * 0.004)
        across = [0.0]
        for a, b in zip(row, row[1:]):
            across.append(across[-1] + (b - a).length)
        rows.append(row)
        uvs.append([(length / tile, a / tile) for a in across])
    return _strip_mesh(name, rows, uvs, closed=False, flip=True)


def add_patch(obj, surface, z0, z1, half_bottom, half_top, shoulder=0.4, lift=0.0026, cols=25, rows_n=15, name='Poche'):
    """
    Pièce rapportée sur le devant (poche kangourou) : large en bas, biaisée vers le haut à partir de `shoulder`
    (part de la hauteur). Elle garde le dépliage du patron : même teinte, mêmes ombres que le tissu.
    """
    rows, uvs = [], []
    for i in range(rows_n + 1):
        t = i / rows_n
        z = z0 + (z1 - z0) * t
        half = half_bottom if t < shoulder else half_bottom + (half_top - half_bottom) * (t - shoulder) / (1 - shoulder)
        row, urow = [], []
        for k in range(cols):
            c = k / (cols - 1)
            x = (c * 2 - 1) * half
            hit = surface.at(x, z)
            if hit is None:
                continue
            pos, nor = hit
            edge = min(min(c, 1 - c) * (cols - 1), min(i, rows_n - i))
            row.append(pos + nor * (lift * min(1.0, edge) + 0.0004))
            urow.append(surface.uv(x, z))
        if len(row) == cols:
            rows.append(row)
            uvs.append(urow)
    patch = _strip_mesh(name, rows, uvs)
    outward = surface.at(0.0, (z0 + z1) / 2)[1]
    if patch.data.polygons[len(patch.data.polygons) // 2].normal.dot(outward) < 0:
        patch.data.flip_normals()
    return patch


def add_cords(obj, surface, top_z, length=0.21, spread=0.028, radius=0.0026, name='Cordons'):
    """Cordons de serrage de la capuche : deux cordons qui tombent du col sur la poitrine, terminés par un nœud."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    for side in (-1, 1):
        path, n = [], 26
        for i in range(n + 1):
            t = i / n
            z = top_z + 0.012 - (length + 0.012) * t
            x = side * (spread + 0.012 * math.sin(t * math.pi * 0.9) + 0.004 * side * math.sin(t * 7))
            hit = surface.at(x, z)
            if hit is None:
                hit = surface.at(x, top_z - 0.004)
            pos, nor = hit
            path.append(pos + nor * (radius + 0.0012 + 0.004 * math.sin(t * math.pi)))
        rings = []
        for i, pnt in enumerate(path):
            tng = (path[min(i + 1, n)] - path[max(i - 1, 0)]).normalized()
            a = tng.cross(Vector((0, 1, 0))).normalized()
            b = tng.cross(a).normalized()
            # nœud au bout du cordon
            r = radius * (1.9 if i >= n - 2 else 1.0)
            rings.append([bm.verts.new(pnt + a * (r * math.cos(2 * math.pi * k / 8)) + b * (r * math.sin(2 * math.pi * k / 8))) for k in range(8)])
        for ra, rb in zip(rings, rings[1:]):
            for k in range(8):
                j = (k + 1) % 8
                f = bm.faces.new((ra[k], ra[j], rb[j], rb[k]))
                f.smooth = True
                for loop in f.loops:
                    loop[uv].uv = (0.0, -1.0)
        for end in (rings[0], rings[-1]):
            f = bm.faces.new(end)
            for loop in f.loops:
                loop[uv].uv = (0.0, -1.0)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    return new_object(name, mesh)


def bake_vertex_ao(objs, samples=96, distance=0.12):
    """Occlusion ambiante rangée dans les sommets (couleur « Col ») : creux, intérieur d'une capuche, dessous d'une anse."""
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = samples
    scene.cycles.use_denoising = False
    world = scene.world or bpy.data.worlds.new('Monde')
    scene.world = world
    world.light_settings.distance = distance
    for obj in objs:
        attr = obj.data.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER')
        obj.data.color_attributes.active_color = attr
        obj.data.color_attributes.render_color_index = 0
        activate(obj)
        bpy.ops.object.bake(type='AO', target='VERTEX_COLORS')


def ensure_white_colors(objs, name='Col'):
    """
    Avant de réunir des pièces : celles qui n'ont pas d'ombres rangées dans leurs sommets reçoivent du blanc.
    (Sans cela, la réunion les remplit de noir, ou l'export abandonne la couche de couleur.)
    """
    for obj in objs:
        if name in obj.data.color_attributes:
            continue
        attr = obj.data.color_attributes.new(name, 'BYTE_COLOR', 'CORNER')
        for item in attr.data:
            item.color = (1.0, 1.0, 1.0, 1.0)


def activate_colors(obj, name='Col'):
    attr = obj.data.color_attributes.get(name)
    if attr:
        obj.data.color_attributes.active_color = attr
        obj.data.color_attributes.render_color_index = list(obj.data.color_attributes).index(attr)


# --------------------------------------------------------------------------------------
# Occlusion ambiante (ombres dans les plis), calculée dans le dépliage du patron
# --------------------------------------------------------------------------------------


def bake_ao(obj, path, width=2048, height=1024, samples=48, distance=0.14):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = samples
    # cette version de Blender n'a pas de débruiteur : le laisser activé annule le calcul
    scene.cycles.use_denoising = False
    world = scene.world or bpy.data.worlds.new('Monde')
    scene.world = world
    world.light_settings.distance = distance
    image = bpy.data.images.new('ao', width, height, alpha=False)
    mat = obj.data.materials[0]
    nodes = mat.node_tree.nodes
    node = nodes.new('ShaderNodeTexImage')
    node.image = image
    nodes.active = node
    activate(obj)
    bpy.ops.object.bake(type='AO', margin=6, use_clear=True)
    image.filepath_raw = path
    image.file_format = 'PNG'
    image.save()
    nodes.remove(node)
    return path


def finish_ao(obj, png_path, webp_path, stitches=(), seams=('side', 'shoulder')):
    """
    Carte d'occlusion finale : fond blanc autour des pièces (aucun liseré sombre aux coutures une fois réduite),
    coutures d'assemblage légèrement marquées, surpiqûres des ourlets.
    `stitches` : (bord, distances en mètres depuis le bord) — ex. ('hem', (0.020, 0.026)).
    """
    import json

    import numpy as np
    from PIL import Image, ImageDraw, ImageFilter

    img = Image.open(png_path).convert('L')
    w, h = img.size
    runs = json.loads(obj['runs'])
    W, zmin = obj['uv_w'], obj['uv_zmin']

    def to_px(x, z, back):
        u = (0.75 - x / (2 * W)) if back else (0.25 + x / (2 * W))
        v = 0.05 + (z - zmin) / W
        return (u * w, (1 - v) * h)

    def polyline(name, piece, mirror):
        pts = runs[piece].get(name, [])
        return [to_px(-x if mirror else x, z, piece == 1) for x, z in pts]

    def outline(piece):
        right = [p for name in runs[piece] for p in runs[piece][name]]
        full = right + [[-x, z] for x, z in reversed(right)]
        return [to_px(x, z, piece == 1) for x, z in full]

    scale = w / (2 * W)  # pixels par mètre
    mask = Image.new('L', (w, h), 0)
    draw = ImageDraw.Draw(mask)
    for piece in (0, 1):
        draw.polygon(outline(piece), fill=255)
    inside = np.asarray(mask) > 0
    grown = np.asarray(mask.filter(ImageFilter.MaxFilter(9))) > 0
    ao = np.asarray(img).astype(np.float32) / 255.0
    ao = np.clip(ao, 0.18, 1.0)

    def band(name, d0, d1):
        """Pixels situés entre d0 et d1 mètres d'un bord, à l'intérieur des pièces."""
        outer = Image.new('L', (w, h), 0)
        inner = Image.new('L', (w, h), 0)
        for piece in (0, 1):
            for mirror in (False, True):
                line = polyline(name, piece, mirror)
                if len(line) < 2:
                    continue
                ImageDraw.Draw(outer).line(line, fill=255, width=max(1, round(2 * d1 * scale)), joint='curve')
                if d0 > 0:
                    ImageDraw.Draw(inner).line(line, fill=255, width=max(1, round(2 * d0 * scale)), joint='curve')
        return (np.asarray(outer) > 0) & ~(np.asarray(inner) > 0) & inside

    shade = np.ones_like(ao)
    for name in seams:
        shade[band(name, 0.0, 0.0022)] *= 0.86
    for name, distances in stitches:
        for d in distances:
            shade[band(name, d - 0.0009, d + 0.0009)] *= 0.84
    shade_img = Image.fromarray((shade * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))
    ao = ao * (np.asarray(shade_img).astype(np.float32) / 255.0)
    ao = np.where(grown, ao, 1.0)
    Image.fromarray((ao * 255).round().astype(np.uint8), 'L').save(webp_path, 'WEBP', quality=86, method=6)
    return webp_path


# --------------------------------------------------------------------------------------
# Rendu de contrôle
# --------------------------------------------------------------------------------------


def fabric_material(name='Tissu', color=(0.42, 0.45, 0.5, 1)):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = color
    bsdf.inputs['Roughness'].default_value = 0.9
    if 'Sheen Weight' in bsdf.inputs:
        bsdf.inputs['Sheen Weight'].default_value = 0.6
        bsdf.inputs['Sheen Roughness'].default_value = 0.6
    return mat


def render_preview(path, look_at=(0, 0, 0.38), distance=1.9, angle=25.0, height=0.5, size=640, samples=48, background=(0.86, 0.88, 0.91)):
    """Rendu Cycles (processeur) : fond de studio, une lumière principale douce et un contre-jour."""
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = samples
    scene.cycles.use_denoising = False
    scene.cycles.max_bounces = 4
    scene.render.resolution_x = size
    scene.render.resolution_y = size
    scene.render.film_transparent = False
    scene.render.image_settings.file_format = 'PNG'
    scene.view_settings.view_transform = 'Standard'
    world = scene.world or bpy.data.worlds.new('Monde')
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes['Background']
    bg.inputs[0].default_value = (*background, 1)
    bg.inputs[1].default_value = 0.35
    for o in [o for o in scene.objects if o.type in ('LIGHT', 'CAMERA')]:
        bpy.data.objects.remove(o)
    target = Vector(look_at)
    a = math.radians(angle)
    cam_data = bpy.data.cameras.new('Camera')
    cam_data.lens = 70
    cam = bpy.data.objects.new('Camera', cam_data)
    scene.collection.objects.link(cam)
    cam.location = target + Vector((math.sin(a) * distance, -math.cos(a) * distance, height))
    cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
    scene.camera = cam

    def area(name, loc, power, size_m, color=(1, 1, 1)):
        data = bpy.data.lights.new(name, 'AREA')
        data.energy = power
        data.size = size_m
        data.color = color
        light = bpy.data.objects.new(name, data)
        scene.collection.objects.link(light)
        light.location = loc
        light.rotation_euler = (target - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()

    area('Cle', (-1.6, -2.0, 1.9), 90, 1.6, (1.0, 0.97, 0.93))
    area('Debouchage', (2.0, -1.4, 0.8), 22, 2.0, (0.93, 0.96, 1.0))
    area('Contre', (0.6, 2.2, 1.6), 60, 1.2)
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
