# Photos du Studio et du catalogue de démo

Prépare, une fois pour toutes et hors ligne, les vraies photos utilisées par le site :
personnes qui portent les vêtements (Studio, fiches produit) et produits détourés (atelier 3D, boutique).

| Étape | Commande | Résultat |
| --- | --- | --- |
| 1. Télécharger les photos sources | `npm run fetch` | `orig/*.jpg` (liste et liens dans `credits.json`) |
| 2. Détourer et repérer les vêtements | `npm run seg` | `alpha/` (détourage BiRefNet, licence MIT) et `cloth/` (masque du vêtement, SegFormer) |
| 3. Produire les images du site | `npm run build` | `out/studio`, `out/catalogue`, puis `apps/web/src/lib/mockup/bases.ts` |

Copier ensuite `out/studio/*` et `out/catalogue/*` dans `apps/web/public/media/studio` et `.../catalogue`.

`overrides.json` règle chaque photo : zone d'impression (`print`, coordonnées 0–1), surface cylindrique (`curve`),
variantes de couleur à générer (`variants`), vêtement isolé de son décor (`clothAlpha`, `clipX`),
logo à effacer (`erase`).

Prérequis : Node 22, `npm install` dans ce dossier. Les modèles d'IA (~250 Mo) sont téléchargés au premier lancement
dans `models/`. Rien de tout cela n'est nécessaire pour faire tourner le site : seules les images produites sont publiées.

Pour utiliser les photos de l'atelier (recommandé) : remplacer les photos dans `orig/` en gardant les mêmes noms
(personne de face, vêtement blanc ou clair, fond simple), relancer les étapes 2 et 3, puis ajuster `print` si besoin.
