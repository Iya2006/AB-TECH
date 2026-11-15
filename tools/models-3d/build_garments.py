"""
Fabrique les vêtements 3D du site (T-shirt, polo, pull…) par simulation de tissu.

    blender -b -P tools/models-3d/build_garments.py -- [noms…]        # tous par défaut
    PREVIEW=dossier  : rendus de contrôle     FORCE=1 : refaire la simulation     STEP=0.018 : essai rapide

Sorties : tools/models-3d/out/<nom>.glb (brut), <nom>-ao.webp, <nom>.json ; `pack.mjs` les range dans le site.
"""
import json
import math
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bpy  # noqa: E402
import garment_lib as g  # noqa: E402

OUT = os.path.join(HERE, 'out')
CACHE = os.path.join(HERE, 'cache')
os.makedirs(OUT, exist_ok=True)
os.makedirs(CACHE, exist_ok=True)
PREVIEW = os.environ.get('PREVIEW')
FORCE = os.environ.get('FORCE') == '1'

# Bords-côtes : profils (le long du prolongement du tissu, en épaisseur), de la face extérieure à l'intérieure.
CREW_RIB = [(0.000, 0.0012), (0.004, 0.0030), (0.010, 0.0034), (0.016, 0.0030), (0.0195, 0.0018), (0.0205, 0.0), (0.0195, -0.0016), (0.010, -0.0022), (0.001, -0.0022)]
CREW_RIB_WIDE = [(0.000, 0.0014), (0.005, 0.0036), (0.013, 0.0040), (0.021, 0.0034), (0.0255, 0.0020), (0.027, 0.0), (0.0255, -0.0018), (0.013, -0.0026), (0.001, -0.0026)]
POLO_CUFF = [(0.000, 0.0012), (0.003, 0.0026), (0.011, 0.0028), (0.019, 0.0022), (0.022, 0.0), (0.019, -0.0016), (0.001, -0.0020)]
LONG_RIB = [(0.000, 0.0016), (0.005, 0.0036), (0.020, 0.0034), (0.042, 0.0030), (0.055, 0.0022), (0.058, 0.0), (0.055, -0.0018), (0.020, -0.0026), (0.001, -0.0026)]


def short_sleeve(length, drop, neck=0.092, sleeve=0.21, chest=0.265, hem=0.262):
    """Patron à manches courtes (T-shirt, polo). `length` : hauteur du point d'épaule au-dessus du bas."""
    under = length - 0.245
    a = math.radians(20.3)
    tip = (neck + 0.333 - (0.333 - 0.138), length - 0.045)  # pointe d'épaule
    top = (0.092 + 0.333 * (sleeve + 0.145) / 0.355, length - 0.122 * (sleeve + 0.145) / 0.355)
    cuff_top = top
    cuff_low = (cuff_top[0] - 0.18 * math.sin(a) - 0.003, cuff_top[1] - 0.18 * math.cos(a) + 0.003)
    corner = g.bezier2((chest, under - 0.06), (chest, under), (chest + 0.045, under - 0.02))
    side = [(hem, 0.0), (chest, under - 0.06)] + [tuple(p) for p in corner][1:] + [cuff_low]
    return [
        ('hem', [(0.0, 0.0), (hem, 0.0)], False),
        ('side', side, True),
        ('cuff', [cuff_low, cuff_top], False),
        ('shoulder', [cuff_top, (neck, length)], True),
        ('neck', [tuple(p) for p in reversed(g.quarter_ellipse((0.0, length - drop), (neck, length)))], False),
    ]


def long_sleeve(length, drop, neck=0.095, sleeve=0.58, chest=0.285, hem=0.255, bicep=0.19, cuff=0.105, angle=42.0):
    """Patron à manches longues (pull, sweat), coupé pour des bras légèrement écartés."""
    a = math.radians(angle)
    c, s = math.cos(a), math.sin(a)
    tip = (0.225, length - 0.045)
    cuff_top = (tip[0] + sleeve * c, tip[1] - sleeve * s)
    cuff_low = (cuff_top[0] - cuff * s, cuff_top[1] - cuff * c)
    under = tip[1] + (-bicep - s * (chest - tip[0])) / c
    corner = g.bezier2((chest, under - 0.07), (chest, under), (chest + 0.06 * c, under - 0.06 * s))
    side = [(hem, 0.0), (chest - 0.004, 0.09), (chest, under - 0.07)] + [tuple(p) for p in corner][1:] + [cuff_low]
    return [
        ('hem', [(0.0, 0.0), (hem, 0.0)], False),
        ('side', side, True),
        ('cuff', [cuff_low, cuff_top], False),
        ('shoulder', [cuff_top, tip, (neck, length)], True),
        ('neck', [tuple(p) for p in reversed(g.quarter_ellipse((0.0, length - drop), (neck, length)))], False),
    ]


GARMENTS = {
    'tshirt': dict(
        length=0.72,
        front=lambda: short_sleeve(0.72, 0.095),
        back=lambda: short_sleeve(0.72, 0.022),
        fabric='jersey',
        step=0.011,
        frames=110,
        ribs=[dict(flag='neck', profile=CREW_RIB, lift=0.25)],
        hems=['hem', 'cuff'],
        stitches=[('hem', (0.020, 0.026)), ('cuff', (0.018, 0.024)), ('neck', (0.004,))],
        # zones d'impression, en mètres dans le patron : (centre x, bas z, largeur, hauteur)
        zones=dict(front=(0.0, 0.185, 0.30, 0.40), back=(0.0, 0.24, 0.30, 0.40)),
    ),
    'polo': dict(
        length=0.72,
        front=lambda: short_sleeve(0.72, 0.082, neck=0.086, sleeve=0.195),
        back=lambda: short_sleeve(0.72, 0.020, neck=0.086, sleeve=0.195),
        fabric='jersey',
        step=0.011,
        frames=110,
        ribs=[dict(flag='cuff', profile=POLO_CUFF)],
        hems=['hem'],
        polo=dict(drop=0.082),
        stitches=[('hem', (0.020, 0.026))],
        zones=dict(front=(0.0, 0.185, 0.30, 0.40), back=(0.0, 0.24, 0.30, 0.40)),
    ),
    'pull': dict(
        length=0.68,
        front=lambda: long_sleeve(0.68, 0.088),
        back=lambda: long_sleeve(0.68, 0.024),
        fabric='molleton',
        step=0.012,
        frames=130,
        arm_angle=44,
        ribs=[dict(flag='neck', profile=CREW_RIB_WIDE, lift=0.25), dict(flag='cuff', profile=LONG_RIB), dict(flag='hem', profile=LONG_RIB)],
        hems=[],
        stitches=[('neck', (0.005,))],
        zones=dict(front=(0.0, 0.155, 0.30, 0.40), back=(0.0, 0.21, 0.30, 0.40)),
    ),
}


def log(name, text, t0):
    print('%s : %s (%.0f s)' % (name, text, time.time() - t0), flush=True)


def build(name):
    spec = GARMENTS[name]
    t0 = time.time()
    cached = os.path.join(CACHE, name + '_sim.blend')
    if os.path.exists(cached) and not FORCE:
        bpy.ops.wm.open_mainfile(filepath=cached)
        obj = bpy.data.objects[name]
        body = bpy.data.objects['Buste']
    else:
        g.reset_scene()
        body = g.make_body(arm_angle=float(os.environ.get('ARM', spec.get('arm_angle', 44))))
        # le point d'épaule du patron est posé à la hauteur des épaules du buste, quelle que soit la longueur
        obj = g.make_garment(name, spec['front'](), spec['back'](), step=float(os.environ.get('STEP', spec['step'])), z0=g.SHOULDER_Z - spec['length'])
        obj.data.materials.append(g.fabric_material('tissu'))
        g.add_cloth(obj, spec['fabric'], self_collision=os.environ.get('SELF', '1') == '1')
        g.simulate(obj, spec['frames'], log=lambda f: print('  image', f, round(time.time() - t0, 1), 's', flush=True))
        g.freeze(obj)
        g.weld_seams(obj)
        bpy.ops.wm.save_as_mainfile(filepath=cached)
    log(name, 'simulation prête, %d sommets' % len(obj.data.vertices), t0)
    body.hide_render = True
    body.hide_viewport = True

    rib_mat = g.fabric_material('cote')
    extras = []
    for r in spec.get('ribs', []):
        rib = g.add_rib(obj, g.EDGE[r['flag']], r['profile'], name='Cote_' + r['flag'], lift=r.get('lift', 0.0))
        rib.data.materials.append(rib_mat)
        extras.append(rib)
    for flag in spec.get('hems', []):
        g.add_hems(obj, g.EDGE[flag])
    late = []  # posés après le calcul des ombres (ils recouvrent le tissu de trop près)
    if spec.get('polo'):
        surface = g.Surface(obj)
        collar = g.smooth_object(g.add_polo_collar(obj, surface))
        collar.data.materials.append(rib_mat)
        extras.append(collar)
        placket, buttons = g.add_placket(obj, surface, top_z=spec['length'] - spec['polo']['drop'])
        g.smooth_object(placket)
        placket.data.materials.append(obj.data.materials[0])
        buttons.data.materials.append(g.fabric_material('bouton', (0.9, 0.9, 0.88, 1)))
        placket.hide_render = buttons.hide_render = True
        late += [placket, buttons]

    png = os.path.join(OUT, name + '-ao.png')
    g.bake_ao(obj, png)
    g.finish_ao(obj, png, os.path.join(OUT, name + '-ao.webp'), stitches=spec.get('stitches', ()))
    os.remove(png)
    log(name, 'ombres des plis calculées', t0)
    for o in late:
        o.hide_render = False

    if PREVIEW:
        top = max(v.co.z for v in obj.data.vertices)
        g.render_preview(os.path.join(PREVIEW, name + '_front.png'), look_at=(0, 0, top * 0.5), angle=20)
        g.render_preview(os.path.join(PREVIEW, name + '_back.png'), look_at=(0, 0, top * 0.5), angle=165)
        g.render_preview(os.path.join(PREVIEW, name + '_col.png'), look_at=(0, 0, top - 0.07), distance=0.8, angle=15, height=0.28)

    # zones d'impression en coordonnées UV : [u min, v min, largeur, hauteur] + taille réelle en cm
    zones = {}
    for key, (cx, z0, w, h) in spec['zones'].items():
        back = key == 'back'
        u0, v0 = g.pattern_uv(obj, cx - w / 2 if not back else cx + w / 2, z0, back)
        u1, v1 = g.pattern_uv(obj, cx + w / 2 if not back else cx - w / 2, z0 + h, back)
        zones[key] = dict(uv=[round(min(u0, u1), 5), round(v0, 5), round(abs(u1 - u0), 5), round(v1 - v0, 5)], cm=[round(w * 100), round(h * 100)])
    top = max(v.co.z for v in obj.data.vertices)
    meta = dict(model=name, fabric=spec['fabric'], metersPerUv=obj['uv_w'], height=round(top, 3), zones=zones)

    for key in list(obj.keys()):
        del obj[key]
    g.activate(obj)
    for o in extras + late:
        o.select_set(True)
    bpy.ops.object.join()
    # le bas du vêtement (bord-côte compris) à la hauteur zéro
    low = min(v.co.z for v in obj.data.vertices)
    for v in obj.data.vertices:
        v.co.z -= low
    meta['height'] = round(top - low, 3)
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
    )
    with open(os.path.join(OUT, name + '.json'), 'w') as f:
        json.dump(meta, f, indent=1)
    log(name, 'exporté', t0)


names = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
for n in names or list(GARMENTS):
    build(n)
