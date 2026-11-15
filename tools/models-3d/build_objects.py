"""
Fabrique les objets 3D du site (mug, gourde…) : volumes modélisés par le calcul, zone d'impression dépliée
autour de l'objet, ombres propres calculées par Blender et rangées dans les sommets.

    blender -b -P tools/models-3d/build_objects.py -- [noms…]        PREVIEW=dossier : rendus de contrôle

Sorties : tools/models-3d/out/<nom>.glb et <nom>.json ; `pack.mjs` les range dans le site.
Matières (par leur nom) : « ceramique », « metal », « bouchon »… le site applique les siennes.
Axes Blender : Z vers le haut, la face avant regarde -Y ; l'angle 0 est la face avant, +90° vers +X.
"""
import json
import math
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import garment_lib as g  # noqa: E402

OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True)
PREVIEW = os.environ.get('PREVIEW')


def fillet(p0, corner, p1, n=5):
    """Arrondi entre deux segments (points intermédiaires d'une courbe de Bézier quadratique)."""
    return [tuple(p) for p in g.bezier2(p0, corner, p1, n)]


def lathe(bm, profile, segments, seam_deg, wall=None):
    """
    Solide de révolution autour de Z. `profile` : points (rayon, hauteur) ; `wall` : indices (début, fin) du
    tronçon qui porte l'impression, déplié en u = tour complet (couture à `seam_deg`), v = hauteur.
    Renvoie les faces créées.
    """
    uv = bm.loops.layers.uv.verify()
    rings = []
    for r, z in profile:
        if r <= 1e-6:
            rings.append([bm.verts.new((0, 0, z))])
        else:
            ring = []
            for i in range(segments):
                a = math.radians(seam_deg) + 2 * math.pi * i / segments
                # angle 0 = face avant (-Y), +90° = +X
                ring.append(bm.verts.new((r * math.sin(a), -r * math.cos(a), z)))
            rings.append(ring)
    faces = []
    z0 = profile[wall[0]][1] if wall else 0
    z1 = profile[wall[1]][1] if wall else 1
    for k, (a, b) in enumerate(zip(rings, rings[1:])):
        printable = wall is not None and wall[0] <= k < wall[1]
        for i in range(segments):
            j = (i + 1) % segments
            if len(a) == 1 and len(b) == 1:
                continue
            if len(a) == 1:
                quad = (a[0], b[j], b[i])
            elif len(b) == 1:
                quad = (a[i], a[j], b[0])
            else:
                quad = (a[i], a[j], b[j], b[i])
            f = bm.faces.new(quad)
            f.smooth = True
            faces.append(f)
            for loop in f.loops:
                if not printable:
                    # hors de la paroi imprimable : jamais dans une zone d'impression
                    loop[uv].uv = (0.0, -1.0)
                    continue
                v = loop.vert
                on_j = v in (a[j] if len(a) > 1 else None, b[j] if len(b) > 1 else None)
                u = ((i + 1) if on_j else i) / segments
                loop[uv].uv = (u, (v.co.z - z0) / (z1 - z0))
    return faces


def sweep(bm, path, section, binormal=Vector((0, 1, 0))):
    """Balaye une section (largeur, épaisseur : demi-axes d'une ellipse) le long d'un chemin plan."""
    uv = bm.loops.layers.uv.verify()
    rings = []
    n = len(path)
    for i, p in enumerate(path):
        p = Vector(p)
        t = (Vector(path[min(i + 1, n - 1)]) - Vector(path[max(i - 1, 0)])).normalized()
        normal = t.cross(binormal).normalized()
        w, h = section(i / (n - 1))
        rings.append([bm.verts.new(p + binormal * (w * math.cos(2 * math.pi * k / 16)) + normal * (h * math.sin(2 * math.pi * k / 16))) for k in range(16)])
    for a, b in zip(rings, rings[1:]):
        for k in range(16):
            j = (k + 1) % 16
            f = bm.faces.new((a[k], a[j], b[j], b[k]))
            f.smooth = True
            for loop in f.loops:
                loop[uv].uv = (0.0, -1.0)
    return rings


def finish(name, bm, materials, face_material=None):
    """Maillage → objet, normales vers l'extérieur, matières par indice de face."""
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = g.new_object(name, mesh)
    for m in materials:
        obj.data.materials.append(m)
    return obj


def bake_vertex_ao(objs, samples=96, distance=0.12):
    """Occlusion ambiante rangée dans les sommets (couleur « Col ») : creux, intérieur, dessous de l'anse."""
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
        g.activate(obj)
        bpy.ops.object.bake(type='AO', target='VERTEX_COLORS')


def zone(center_deg, width_deg, v0, v1, seam_deg, radius, height):
    """Zone d'impression sur une paroi de révolution : rectangle UV et taille réelle en centimètres."""
    u0 = ((center_deg - width_deg / 2 - seam_deg) % 360) / 360
    w = width_deg / 360
    return dict(uv=[round(u0, 5), round(v0, 5), round(w, 5), round(v1 - v0, 5)], cm=[round(2 * math.pi * radius * width_deg / 360 * 100, 1), round(height * (v1 - v0) * 100, 1)])


def export(name, objs, meta):
    g.activate(objs[0])
    for o in objs[1:]:
        o.select_set(True)
    if len(objs) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    low = min(v.co.z for v in obj.data.vertices)
    for v in obj.data.vertices:
        v.co.z -= low
    meta['height'] = round(max(v.co.z for v in obj.data.vertices), 4)
    obj['abtech'] = json.dumps(meta)
    g.activate(obj)
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(OUT, name + '.glb'),
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_extras=True,
        export_yup=True,
        export_cameras=False,
        export_lights=False,
        export_animations=False,
        export_materials='EXPORT',
        export_colors=True,
    )
    with open(os.path.join(OUT, name + '.json'), 'w') as f:
        json.dump(meta, f, indent=1)
    print(name, ': exporté', meta, flush=True)


def preview(name, look, distance, angles=(25, 200), height=0.12):
    if not PREVIEW:
        return
    for i, a in enumerate(angles):
        g.render_preview(os.path.join(PREVIEW, '%s_%d.png' % (name, i)), look_at=look, distance=distance, angle=a, height=height, samples=64)


# --------------------------------------------------------------------------------------
# Mug en céramique (33 cl) : Ø 8,2 cm, hauteur 9,6 cm, anse à droite
# --------------------------------------------------------------------------------------


def build_mug():
    g.reset_scene()
    R, H, T = 0.041, 0.096, 0.0038
    seam = 90.0  # couture du dépliage sous l'anse
    bm = bmesh.new()
    profile = [(0.0, 0.0016), (R - 0.0085, 0.0016), (R - 0.0065, 0.0), (R - 0.0035, 0.0)]
    profile += fillet((R - 0.0035, 0.0), (R, 0.0), (R, 0.0035))[1:]
    w0 = len(profile) - 1
    rows = 14
    profile += [(R, 0.0035 + (H - 0.0055) * i / rows) for i in range(1, rows + 1)]
    w1 = len(profile) - 1
    # lèvre arrondie, puis l'intérieur
    profile += [(R - 0.0006, H - 0.0008), (R - T / 2, H), (R - T + 0.0006, H - 0.0008), (R - T, H - 0.002)]
    profile += [(R - T, H - 0.002 - (H - 0.012) * i / 10) for i in range(1, 11)]
    profile += fillet((R - T, 0.010), (R - T, 0.0062), (R - T - 0.004, 0.0062))[1:]
    profile += [(R * 0.5, 0.0062), (0.0, 0.0062)]
    lathe(bm, profile, 96, seam, wall=(w0, w1))
    # anse : une oreille en C, section ovale, noyée dans la paroi à ses deux bouts
    path = []
    for i in range(25):
        s = i / 24
        a = math.pi * s
        x = R - 0.003 + 0.031 * math.sin(a) ** 0.85
        z = 0.078 - 0.058 * s + 0.004 * math.sin(a) * (1 - 2 * s)
        path.append((x, 0.0, z))
    sweep(bm, path, lambda s: (0.0066 + 0.0012 * abs(1 - 2 * s), 0.0038 + 0.0016 * abs(1 - 2 * s)))
    mug = finish('mug', bm, [g.fabric_material('ceramique', (0.9, 0.9, 0.88, 1))])
    bake_vertex_ao([mug])
    preview('mug', (0, 0, 0.048), 0.42)
    wall_h = H - 0.0055
    meta = dict(
        model='mug',
        kind='objet',
        zones=dict(front=zone(0, 132, 0.07, 0.93, seam, R, wall_h), back=zone(180, 132, 0.07, 0.93, seam, R, wall_h)),
    )
    export('mug', [mug], meta)


# --------------------------------------------------------------------------------------
# Gourde en métal (50 cl) : Ø 7,2 cm, bouchon à anse
# --------------------------------------------------------------------------------------


def build_gourde():
    g.reset_scene()
    R = 0.036
    seam = 180.0  # couture du dépliage au dos
    bm = bmesh.new()
    profile = [(0.0, 0.002), (R - 0.008, 0.002), (R - 0.005, 0.0)]
    profile += fillet((R - 0.005, 0.0), (R, 0.0), (R, 0.006))[1:]
    w0 = len(profile) - 1
    rows = 16
    body_top = 0.178
    profile += [(R, 0.006 + (body_top - 0.006) * i / rows) for i in range(1, rows + 1)]
    w1 = len(profile) - 1
    # épaule arrondie vers le goulot
    for i in range(1, 11):
        a = math.pi / 2 * i / 10
        profile.append((0.0225 + (R - 0.0225) * math.cos(a) ** 1.3, body_top + 0.034 * math.sin(a)))
    profile += [(0.0225, 0.219), (0.0, 0.219)]
    lathe(bm, profile, 80, seam, wall=(w0, w1))
    body = finish('gourde', bm, [g.fabric_material('metal', (0.85, 0.86, 0.88, 1))])

    cap = bmesh.new()
    cr = 0.0255
    cprofile = [(0.0, 0.214), (cr - 0.001, 0.214), (cr, 0.2155)]
    cprofile += [(cr, 0.2155 + 0.031 * i / 6) for i in range(1, 7)]
    cprofile += fillet((cr, 0.2465), (cr, 0.2515), (cr - 0.005, 0.2515))[1:]
    cprofile += [(0.0, 0.2515)]
    lathe(cap, cprofile, 64, 0.0)
    # anse du bouchon : un arceau
    path = [(0.019 * math.cos(math.pi * i / 20), 0.0, 0.2495 + 0.021 * math.sin(math.pi * i / 20)) for i in range(21)]
    sweep(cap, path, lambda s: (0.0052, 0.0026))
    cap_obj = finish('bouchon', cap, [g.fabric_material('bouchon', (0.12, 0.12, 0.13, 1))])
    bake_vertex_ao([body, cap_obj])
    preview('gourde', (0, 0, 0.13), 0.75)
    wall_h = body_top - 0.006
    meta = dict(model='gourde', kind='objet', zones=dict(front=zone(0, 120, 0.2, 0.86, seam, R, wall_h), back=zone(180, 120, 0.2, 0.86, 0.0, R, wall_h)))
    # la couture est au dos : la zone « dos » se replie sur 0…1 autrement — on la déclare de l'autre côté de la couture
    meta['zones'].pop('back')
    export('gourde', [body, cap_obj], meta)


# --------------------------------------------------------------------------------------
# Casquettes : classique (6 panneaux, visière courbe), visière plate (snapback), trucker (dos en filet)
# --------------------------------------------------------------------------------------

CAP_A, CAP_B = 0.088, 0.098  # demi-largeur et demi-longueur du tour de tête (58,5 cm)


def crown_point(phi, t, height, e_front, e_back):
    """Point de la calotte : phi autour de la tête (0 = devant), t de 0 (bord) à 1 (sommet)."""
    wf = (0.5 + 0.5 * math.cos(phi)) ** 1.5
    e = e_back + (e_front - e_back) * wf
    ang = t * math.pi / 2
    r = math.cos(ang) ** e
    return Vector((CAP_A * r * math.sin(phi), -CAP_B * r * math.cos(phi), height * math.sin(ang) ** 0.92))


def crown_normal(phi, t, height, e_front, e_back):
    d = 1e-3
    p = crown_point(phi, t, height, e_front, e_back)
    du = crown_point(phi + d, t, height, e_front, e_back) - p
    dv = crown_point(phi, min(1, t + d), height, e_front, e_back) - p
    n = du.cross(dv)
    return n.normalized() if n.length > 1e-12 else Vector((0, 0, 1))


def sweep_on_surface(bm, points, normals, half_w, half_h, mat_index=0, sides=12):
    """Bande bombée posée sur une surface (ruban de l'ouverture, patte de serrage)."""
    uv = bm.loops.layers.uv.verify()
    rings = []
    n = len(points)
    for i, (p, nrm) in enumerate(zip(points, normals)):
        t = (points[min(i + 1, n - 1)] - points[max(i - 1, 0)]).normalized()
        side = nrm.cross(t).normalized()
        rings.append([bm.verts.new(p + side * (half_w * math.cos(2 * math.pi * k / sides)) + nrm * (half_h * math.sin(2 * math.pi * k / sides))) for k in range(sides)])
    for a, b in zip(rings, rings[1:]):
        for k in range(sides):
            j = (k + 1) % sides
            f = bm.faces.new((a[k], a[j], b[j], b[k]))
            f.smooth = True
            f.material_index = mat_index
            for loop in f.loops:
                loop[uv].uv = (0.0, -1.0)
    for ring in (rings[0], rings[-1]):
        f = bm.faces.new(ring)
        f.material_index = mat_index
        for loop in f.loops:
            loop[uv].uv = (0.0, -1.0)


def torus(bm, center, normal, R, r, mat_index=0):
    uv = bm.loops.layers.uv.verify()
    quat = normal.to_track_quat('Z', 'Y')
    rings = []
    for i in range(18):
        a = 2 * math.pi * i / 18
        rings.append([center + quat @ Vector(((R + r * math.cos(2 * math.pi * k / 8)) * math.cos(a), (R + r * math.cos(2 * math.pi * k / 8)) * math.sin(a), r * math.sin(2 * math.pi * k / 8))) for k in range(8)])
    verts = [[bm.verts.new(p) for p in ring] for ring in rings]
    for i in range(18):
        a, b = verts[i], verts[(i + 1) % 18]
        for k in range(8):
            j = (k + 1) % 8
            f = bm.faces.new((a[k], a[j], b[j], b[k]))
            f.smooth = True
            f.material_index = mat_index
            for loop in f.loops:
                loop[uv].uv = (0.0, -1.0)


def build_cap(name, flat=False, trucker=False):
    g.reset_scene()
    H = 0.112 if flat else 0.104
    e_front, e_back = (0.42, 0.72) if flat or trucker else (0.52, 0.78)
    SEG, RINGS = 216, 28
    arch_w, arch_t = math.radians(27), 0.40
    bm = bmesh.new()
    uv = bm.loops.layers.uv.verify()
    # matières : 0 tissu, 1 filet (trucker), 2 intérieur (bandeau), 3 patte de serrage en plastique
    seams = [math.radians(a) for a in ((-60, 60, -120, 120, 180, -180) if trucker else (0, 60, -60, 120, -120, 180, -180))]

    def groove(phi, t):
        """Creux des coutures entre panneaux (et piqûres de part et d'autre)."""
        radius = CAP_A * math.cos(t * math.pi / 2) ** 0.7 + 1e-6
        d = min(abs(phi - sa) for sa in seams) * radius
        return 0.0009 * math.exp(-((d / 0.0016) ** 2)) - 0.00025 * math.exp(-(((d - 0.0042) / 0.0012) ** 2))

    grid = []
    for k in range(RINGS):
        t = k / RINGS
        ring = []
        for i in range(SEG):
            phi = -math.pi + 2 * math.pi * i / SEG
            p = crown_point(phi, t, H, e_front, e_back)
            p -= crown_normal(phi, t, H, e_front, e_back) * groove(phi, t)
            ring.append(bm.verts.new(p))
        grid.append(ring)
    top = bm.verts.new((0, 0, H))

    def in_arch(phi, t):
        d = abs(abs(phi) - math.pi)
        return t < arch_t and d < arch_w * math.sqrt(max(0.0, 1 - (t / arch_t) ** 2))

    for k in range(RINGS):
        for i in range(SEG):
            j = (i + 1) % SEG
            phi_c = -math.pi + 2 * math.pi * (i + 0.5) / SEG
            t_c = (k + 0.5) / RINGS
            if in_arch(phi_c, t_c):
                continue
            if k == RINGS - 1:
                f = bm.faces.new((grid[k][i], grid[k][j], top))
            else:
                f = bm.faces.new((grid[k][i], grid[k][j], grid[k + 1][j], grid[k + 1][i]))
            f.smooth = True
            f.material_index = 1 if trucker and abs(phi_c) > math.radians(60) else 0
            for loop in f.loops:
                v = loop.vert
                if v is top:
                    loop[uv].uv = ((i + 0.5) / SEG, 1.0)
                    continue
                on_next = v in (grid[k][j], grid[min(k + 1, RINGS - 1)][j])
                row = k + 1 if (k < RINGS - 1 and v in grid[k + 1]) else k
                loop[uv].uv = (((i + 1) if on_next else i) / SEG, row / RINGS)

    # ruban qui borde l'ouverture arrière, patte de serrage
    pts, nrm = [], []
    for q in range(41):
        th = math.pi * q / 40
        phi = math.pi + arch_w * math.cos(th)
        t = arch_t * math.sin(th)
        pts.append(crown_point(phi, t, H, e_front, e_back))
        nrm.append(crown_normal(phi, t, H, e_front, e_back))
    sweep_on_surface(bm, pts, nrm, 0.0042, 0.0011)
    pts, nrm = [], []
    for q in range(25):
        phi = math.pi - math.radians(33) + math.radians(66) * q / 24
        n0 = crown_normal(phi, 0.075, H, e_front, e_back)
        pts.append(crown_point(phi, 0.075, H, e_front, e_back) - n0 * 0.0016)
        nrm.append(n0)
    sweep_on_surface(bm, pts, nrm, 0.0085, 0.0011, mat_index=3 if flat or trucker else 0)

    # bandeau intérieur
    band = []
    for k in range(0, 7):
        t = k / RINGS
        row = []
        for i in range(SEG + 1):
            phi = -math.pi + 2 * math.pi * i / SEG
            row.append(bm.verts.new(crown_point(phi, t, H, e_front, e_back) - crown_normal(phi, t, H, e_front, e_back) * 0.0024))
        band.append(row)
    for k in range(len(band) - 1):
        for i in range(SEG):
            phi_c = -math.pi + 2 * math.pi * (i + 0.5) / SEG
            if abs(abs(phi_c) - math.pi) < arch_w * 1.05:
                continue
            f = bm.faces.new((band[k][i], band[k + 1][i], band[k + 1][i + 1], band[k][i + 1]))
            f.smooth = True
            f.material_index = 2
            for loop in f.loops:
                loop[uv].uv = (0.0, -1.0)

    # bouton du sommet, œillets d'aération
    bmesh.ops.create_uvsphere(bm, u_segments=20, v_segments=10, radius=0.0086, matrix=__import__('mathutils').Matrix.Translation((0, 0, H - 0.0005)) @ __import__('mathutils').Matrix.Diagonal((1, 1, 0.5, 1)))
    if not trucker:
        for deg in (30, -30, 90, -90, 150, -150):
            phi = math.radians(deg)
            torus(bm, crown_point(phi, 0.62, H, e_front, e_back), crown_normal(phi, 0.62, H, e_front, e_back), 0.0034, 0.0008)

    # visière : dessus, dessous, chant arrondi ; piqûres concentriques
    NS, NW = 56, 30
    half = math.radians(74)

    def visor_point(s, w):
        phi = s * half
        pin = Vector((CAP_A * 0.992 * math.sin(phi), -CAP_B * 0.992 * math.cos(phi), 0.0016))
        psi = s * (math.pi / 2) * 0.96
        pout = Vector((0.097 * math.sin(psi), -0.028 - (CAP_B + 0.070 - 0.028) * math.cos(psi), 0.0))
        p = pin.lerp(pout, w)
        p.z = 0.0016 - 0.005 * w if flat else 0.0016 - 0.017 * w - 2.0 * p.x * p.x * w
        return p

    def visor_normal(s, w):
        d = 1e-3
        p = visor_point(s, w)
        n = (visor_point(min(1, s + d), w) - p).cross(visor_point(s, min(1, w + d)) - p)
        n.normalize()
        return n if n.z > 0 else -n

    def stitches(w):
        return sum(0.00035 * math.exp(-(((w - w0) * 0.07 / 0.0011) ** 2)) for w0 in (0.2, 0.36, 0.52, 0.68, 0.84))

    layers = []
    for sign, thick in ((1, 0.0017), (-1, 0.0017)):
        rows = []
        for iw in range(NW + 1):
            w = iw / NW
            # le chant : les deux faces se rejoignent au bord
            edge = 1.0 if w < 0.985 else math.sqrt(max(0.0, 1 - ((w - 0.985) / 0.015) ** 2))
            row = []
            for i_s in range(NS + 1):
                s = -1 + 2 * i_s / NS
                side = 1.0 if abs(s) < 0.985 else math.sqrt(max(0.0, 1 - ((abs(s) - 0.985) / 0.015) ** 2))
                n = visor_normal(s, w)
                # les piqûres s'effacent vers les pointes de la visière (les rangs s'y resserrent)
                fade = min(1.0, max(0.0, (1 - abs(s)) / 0.3))
                lift = thick * min(edge, side) - (stitches(w) * fade if sign > 0 else 0)
                row.append(bm.verts.new(visor_point(s, w) + n * (sign * lift)))
            rows.append(row)
        layers.append(rows)
        for iw in range(NW):
            for i_s in range(NS):
                quad = (rows[iw][i_s], rows[iw][i_s + 1], rows[iw + 1][i_s + 1], rows[iw + 1][i_s])
                f = bm.faces.new(quad if sign < 0 else tuple(reversed(quad)))
                f.smooth = True
                for loop in f.loops:
                    loop[uv].uv = (0.0, -1.0)

    mats = [g.fabric_material('tissu', (0.2, 0.22, 0.26, 1)), g.fabric_material('filet', (0.2, 0.22, 0.26, 1)), g.fabric_material('interieur', (0.1, 0.1, 0.11, 1)), g.fabric_material('bouchon', (0.1, 0.1, 0.11, 1))]
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=2e-5)
    bm.normal_update()
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    cap = g.new_object(name, mesh)
    for m in mats:
        cap.data.materials.append(m)
    bake_vertex_ao([cap], samples=64, distance=0.06)
    preview(name, (0, -0.02, 0.05), 0.75, angles=(35, 215, 90), height=0.16)
    meta = dict(
        model=name,
        kind='objet',
        fabric='toile',
        # répétitions de la toile sur le dépliage de la calotte (tour de tête × hauteur développée)
        repeat=[29, 7.5],
        zones=dict(front=dict(uv=[round(0.5 - 38 / 360, 5), 0.2, round(76 / 360, 5), 0.46], cm=[10.5, 5.5])),
    )
    export(name, [cap], meta)


BUILDERS = {
    'mug': build_mug,
    'gourde': build_gourde,
    'casquette': lambda: build_cap('casquette'),
    'snapback': lambda: build_cap('snapback', flat=True),
    'trucker': lambda: build_cap('trucker', trucker=True),
}
names = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
for n in names or list(BUILDERS):
    t0 = time.time()
    BUILDERS[n]()
    print(n, ': %.0f s' % (time.time() - t0), flush=True)
