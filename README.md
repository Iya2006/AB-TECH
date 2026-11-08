# AB-TECH — site vitrine 3D et boutique (MVP)

Site « Printing & Branding » en 3D. Le visiteur arrive devant l'atelier AB-TECH, pousse la porte
et visite les postes au scroll : création, impression, textile, objets, événementiel, puis la
boutique tech (informatique) et le pôle sécurité. Les cadres et les produits de l'atelier sont
cliquables. Le site comprend aussi une boutique en ligne avec panier, un Studio où l'on essaie sa marque
sur de vrais vêtements portés par de vraies personnes, des avis clients et un espace pro complet (`/admin`).

## Ce que fait le site

| Côté visiteur | Côté espace pro (`/admin`) |
| --- | --- |
| Visite 3D au scroll, **jour ou nuit selon l'heure du visiteur** (bouton soleil/lune pour changer) | Tableau de bord : chiffres clés et activité sur 14 jours |
| Accueil animé : lumières qui s'allument, compteurs, savoir-faire qui défilent | Devis : demandes avec la maquette du Studio, le logo, le modèle (type de casquette, réf. de carte) |
| **Portant de vêtements qui défile** (T-shirts, polos, sweats, pulls) et **rangée de casquettes** : vraies photos, flèches, glisser, clic | Commandes : paniers validés, suivi des statuts |
| **Section « Le portant »** : cintres qui se balancent, pièce qui pivote au survol, décrochée pour voir le dos, puis panier | (alimentée par les produits textiles de l'espace pro) |
| Produits en vraies photos sur les étagères, étiquettes nom + prix nettes | Produits : photos (avec **détourage automatique** sur fond uni), prix, stock, forme, couleur |
| Fiche produit : photos, **vue portée homme / femme**, panier, WhatsApp, avis | Réalisations : nombre illimité, plusieurs photos chacune, poste où elles sont accrochées |
| Cadres au mur → galerie photos animée · catalogue complet | Textes de l'atelier : sur-titre, titre, texte et mots-clés de chaque poste |
| **Studio** : T-shirt, polo, sweat, casquette (3 types) portés par de **vraies personnes**, mug, tote bag ; le marquage suit les plis. Logo, texte sur deux lignes, 4 polices, visuel à **déplacer et agrandir** sur la zone d'impression, emplacements (cœur, centre, grand format), zoom, technique (sérigraphie, broderie…), **quantités par taille**, aperçu téléchargeable | Avis : modération (publier, masquer, supprimer) |
| **Cartes de visite** : 6 styles référencés (CV-01 à CV-06) qu'on fait défiler, recto/verso, coordonnées personnalisées | Paramètres : nom, coordonnées, WhatsApp, devise, réseaux, mot de passe |
| | **Apparence du site**, chaque réglage avec son **aperçu en direct** : logo, nom et signature, accueil de la façade, message de bienvenue, photo de la vraie enseigne, écran de vitrine, grandes affiches et kakémonos, fond du photocall |
| | Fiche produit avec l'aperçu de la carte boutique ; textes des postes avec l'aperçu du panneau de la visite |
| Boutique et panier → commande · avis clients · devis gratuit · contact | |

## Stack

| Partie | Technologies |
| --- | --- |
| Site | React 19, TypeScript, Vite, Tailwind CSS 4 |
| 3D | Three.js, React Three Fiber, Drei, postprocessing (bloom, occlusion ambiante) |
| Réalisme | Éclairages HDRI, textures PBR et modèles 3D **CC0 de Poly Haven** (libres de droits, usage commercial) |
| Animations | GSAP, Lenis (défilement fluide), animations CSS |
| API | Node 22, Fastify 5, Zod (validation partagée avec le site), Drizzle ORM |
| Données | PostgreSQL 17 (Docker) |
| Images | Cloudinary (optionnel ; sinon stockage sur le serveur) |
| Déploiement | Docker Compose : `db` + `api` + `web` (nginx) |

## Démarrer en local

Prérequis : Node 22+, pnpm 10, Docker Desktop.

```bash
pnpm install
cp .env.example .env        # renseigner ADMIN_EMAIL, ADMIN_PASSWORD, SESSION_SECRET, mot de passe Postgres
pnpm db:up                  # PostgreSQL dans Docker
pnpm dev                    # API sur :4000 + site sur http://localhost:5173
```

Au premier démarrage, l'API applique les migrations, puis crée l'administrateur initial
(`ADMIN_EMAIL` / `ADMIN_PASSWORD`) et quelques produits et réalisations de démonstration,
à remplacer depuis l'administration.

## Comptes, connexion et administration

Une seule application, un seul domaine, une seule connexion ; les accès dépendent du **rôle** du compte.

| Adresse | Pour qui | Contenu |
| --- | --- | --- |
| `/` | tout le monde | visite 3D, prestations, boutique, réalisations, avis |
| `/connexion`, `/inscription` | visiteurs | « Continuer avec Google », ou e-mail + mot de passe |
| `/mot-de-passe-oublie`, `/reinitialiser` | visiteurs | lien temporaire (1 h, usage unique), jamais l'ancien mot de passe |
| `/compte` | comptes connectés | profil et photo, devis (avec leur avancement), commandes, fichiers, avis, sécurité |
| `/admin` | rôle `admin` | tableau de bord, devis, commandes, avis, **clients**, catalogue, contenus, paramètres |

- **Rôles** : `client` (attribué à toute inscription, par e-mail ou par Google) et `admin`
  (jamais automatique : administrateur initial créé depuis `.env`, puis nommé par un administrateur dans **Clients**).
- **Données rattachées au compte** : demander un devis, commander, publier un avis ou envoyer un fichier exige
  d'être connecté. Le visiteur remplit son formulaire ; une fenêtre de connexion s'ouvre à l'envoi, sans perdre sa saisie
  (y compris la maquette du Studio, même après un aller-retour chez Google). Les devis et commandes envoyés avant
  l'ouverture des comptes sont rattachés au compte dès que la propriété de l'adresse est prouvée (Google ou lien e-mail).
- **Administrateur initial** : son mot de passe est temporaire. À la première connexion, il doit en choisir un ;
  l'administration reste bloquée côté serveur tant que ce n'est pas fait. Tant qu'un compte administrateur s'ouvre encore
  avec le mot de passe de `.env`, le changement est redemandé au démarrage : le développeur ne garde pas d'accès.
- **Google** : créer un « ID client OAuth » (Application Web) dans la console Google Cloud, déclarer l'URI de redirection
  `<adresse du site>/api/auth/google/callback`, puis renseigner `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET`.
  Sans eux, le bouton n'est pas affiché. L'état est visible dans **Administration → Paramètres**.
- **E-mails** : `SMTP_URL` (+ `MAIL_FROM`) pour envoyer les liens « mot de passe oublié ». Sans SMTP, l'administrateur
  crée un lien (24 h) depuis la fiche du client dans **Clients** et le lui transmet (bouton WhatsApp).

## Qualité 3D

La qualité s'adapte à l'appareil et baisse automatiquement si l'affichage ralentit.
Pour comparer : ajouter `?q=low`, `?q=medium` ou `?q=high` à l'adresse.

Pour rester fluide, même sur un ordinateur portable :
- au chargement, seule la façade est attendue (environ 1,5 Mo de ressources 3D) ; l'intérieur se charge ensuite, en arrière-plan,
  et ses matériaux sont préparés par la carte graphique sans figer l'image ;
- les modèles 3D, éclairages et textures sont allégés une fois pour toutes par `tools/optimize-3d`
  (`node tools/optimize-3d/optimize.mjs` puis `python tools/optimize-3d/textures.py` ; originaux dans `tools/optimize-3d/src`),
  et le serveur les envoie compressés ;
- les puces graphiques intégrées (la plupart des portables) démarrent en qualité moyenne ;
- seuls les postes proches de la caméra sont dessinés ;
- les photos de l'atelier sont réduites à la taille utile, puis envoyées à la carte graphique une par une, en tâche de fond ;
- les panneaux de texte n'utilisent pas de flou d'arrière-plan.

Si la carte graphique « décroche » (contexte WebGL perdu), la scène redémarre seule en qualité basse au lieu de rester noire.

## Cloudinary (optionnel)

1. Renseigner `CLOUDINARY_URL` (`cloudinary://clé:secret@nom-du-cloud`) et `VITE_CLOUDINARY_CLOUD_NAME` dans `.env`.
2. `pnpm media:upload` envoie les photos du site sur Cloudinary.

Les photos ajoutées dans l'espace pro y sont alors stockées et servies optimisées (format et taille
automatiques). Sans Cloudinary, elles sont stockées dans le volume Docker `uploads`.

## Mettre en ligne

**Gratuitement, pour un essai** : Render crée la base Postgres et le site (site + API en un seul service), reliés
automatiquement ; Cloudinary (facultatif) garde les photos envoyées. Mode d'emploi pas à pas : [DEPLOIEMENT.md](DEPLOIEMENT.md).
Tout est décrit dans [`render.yaml`](render.yaml) ; `pnpm cloud:copy` reprend le contenu du site local (base et photos).
La base gratuite de Render expire au bout de 30 jours : au-delà, Neon (gratuit) ou un hébergement payant.
L'API sert alors aussi le site construit (`WEB_DIST`), avec des fichiers précompressés (`tools/precompress.mjs`).

Sur un serveur (VPS) avec Docker :

```bash
cp .env.example .env    # valeurs de production : ADMIN_*, SESSION_SECRET long, POSTGRES_PASSWORD, PUBLIC_ORIGIN (+ GOOGLE_*, SMTP_URL)
docker compose up -d --build
```

Le site écoute sur `WEB_PORT` (8080 par défaut). Placez devant un proxy HTTPS (Caddy, Traefik ou nginx
avec Let's Encrypt). Le cookie de session passe automatiquement en mode « Secure » en HTTPS.

## Sécurité

- Validation stricte des données (schémas Zod partagés entre le site et l'API).
- Mots de passe hachés (scrypt, sel aléatoire) ; durée de vérification identique que le compte existe ou non.
- Sessions côté serveur : cookie `HttpOnly`, `SameSite=Lax`, `Secure` en HTTPS, limité à `/api` ; la base ne garde que
  l'empreinte du jeton. Déconnexion, changement ou réinitialisation du mot de passe : sessions réellement fermées.
  Durée : 30 jours (client), 7 jours (administrateur).
- Autorisations vérifiées par le serveur à chaque requête : `/api/admin/*` répond 401 sans session, 403 à un client
  (et à un administrateur qui n'a pas encore remplacé son mot de passe initial). Masquer un bouton ne protège rien : c'est le serveur qui décide.
- Google : OAuth 2.0 avec code d'autorisation, PKCE, `state` et `nonce` ; adresse vérifiée exigée ; retour après connexion
  limité aux pages du site. Un compte e-mail jamais vérifié relié à Google perd son mot de passe (protection contre le pré-détournement de compte).
- Liens de réinitialisation : aléatoires (256 bits), stockés sous forme d'empreinte, à usage unique, 1 h (24 h s'ils sont créés par l'administrateur).
- Limitation des essais : connexion (10 / 5 min), inscription, mot de passe oublié, réinitialisation.
- Prix des commandes recalculés côté serveur (jamais ceux envoyés par le navigateur).
- Fichiers vérifiés par leur contenu réel (PNG, JPG, WEBP) ; champ piège anti-robots ; limitation des requêtes.
- Avis publiés seulement après modération.

## Photos réelles (Studio, atelier, démo)

Les vêtements, casquettes et objets de l'atelier sont de **vraies photos** détourées. Dans le Studio et les fiches
produit, la couleur du tissu est recalculée à partir de la photo (plis et ombres conservés) et le visuel du client
est « imprimé » sur la zone prévue. Les photos sont préparées une fois pour toutes, hors ligne : voir
[tools/studio-assets](tools/studio-assets/README.md). Pour un rendu 100 % maison, remplacez-les par des photos de
l'atelier (personnes de face en vêtement clair, produits sur fond uni).

Dans l'espace pro, une photo produit prise sur fond uni peut être **détourée** d'un clic (aperçu avant validation).
Un produit sans photo s'affiche avec une vraie photo du même modèle, à la couleur choisie.

## Composants externes (`apps/web/src/components/ui`)

Les composants récupérés sur [21st.dev](https://21st.dev) ou via shadcn sont rangés dans
`apps/web/src/components/ui/`, l'emplacement standard de shadcn. Les futurs `npx shadcn add …` y arrivent
directement, et le code externe reste séparé de nos composants (`src/ui`). Les couleurs qu'ils attendent
(`background`, `foreground`, `muted-foreground`, `card`, `border`, `ring`…) sont déclarées dans
`src/styles/index.css`, reliées à la palette AB-TECH. Comme dans un projet shadcn, l'import `@/…` désigne `src/…`
et `cn` (clsx + tailwind-merge) est dans `src/lib/utils.ts` : le code collé depuis 21st.dev fonctionne sans retouche.

- `product-rail-gallery.tsx` : portant de vêtements (DHxWhy, licence MIT). Ajout local : la prop `detailAction`.
  Ses photos (vêtement seul, toile 200 × 310) sont produites par `tools/studio-assets/rail.mjs`.
  Les photos détourées de l'espace pro sont recadrées automatiquement dans le navigateur.
- `marquee.tsx` : bandeau qui défile en continu (dérivé de Magic UI, MIT), utilisé pour les **avis clients** :
  une rangée, deux en sens opposés à partir de 6 avis, pause au survol. Ses animations sont dans `index.css`.
- `beam-wordmark-footer.tsx` : pied de page bleu nuit traversé d'un rayon de lumière, avec le nom AB-TECH en
  lettres géantes (Kedhar, 21st.dev). Coordonnées et réseaux viennent des **Paramètres** de l'espace pro
  (Facebook, Instagram et TikTok apparaissent dès qu'un lien `https://…` est saisi).
- `glass-icon-reveal.tsx` : **Glass Reveal** (21st.dev, porté de zanwei/glass-icon-reveal, MIT), une seule passe WebGL2.
  Adaptations locales : TypeScript strict, composant exporté, `cueAt`/`onCue` (instant précis de l'animation),
  `onStart`/`onEnd` (aussi appelés en mouvement réduit, sans WebGL2 ou si le contexte graphique est perdu),
  logo de secours à la taille finale du logo.

## Écran d'arrivée

`src/ui/Preloader.tsx` : le logo apparaît derrière une plaque de verre qui le plie en couleurs dans les angles, puis le
relâche ; le nom et la signature montent ; enfin la façade s'ouvre depuis le centre, par une ouverture ronde qui s'élargit
(comme si l'on traversait le verre). La sortie attend que la façade 3D soit prête **et** que la révélation soit finie.

- Logo : celui de l'espace pro (gardé en mémoire pour la visite suivante), sinon le symbole AB-TECH.
- Déjà vue dans l'onglet : la révélation passe 1,5 fois plus vite.
- Mouvement réduit : image fixe, puis fondu. Sans WebGL2 : logo fixe, aucune attente.
- Le verre ne retient jamais le site : contexte graphique perdu, logo illisible ou 9 s écoulées, la suite se fait.
- L'aperçu se règle dans **Apparence du site → Logo & identité** (le vrai verre, en boucle, avec le logo en cours de réglage).

## Administration : mise en page

Cadre bleu nuit (barre latérale repliable + barre du haut) autour d'une feuille claire ; menu par groupes
(vue d'ensemble, ventes & demandes, clients, catalogue, design du site, entreprise) avec compteurs ; notifications et
menu du profil en haut à droite. Tableau de bord : « Mise en route » (réglages vérifiés sur les vraies données),
indicateurs avec leur courbe des 14 derniers jours, activité, derniers devis et commandes. Les pages de réglages
(`Designer` + `Section` dans `admin/ui.tsx`) sont des blocs dépliables, avec **un seul aperçu en direct**, à droite,
qui dit si les modifications sont déjà sur le site. La disposition s'inspire de l'éditeur de
[Hi.Events](https://github.com/HiEventsDev/Hi.Events) ; aucun code n'en est repris (Hi.Events est sous licence AGPL).

## Crédits

- Modèles 3D, textures et éclairages : [Poly Haven](https://polyhaven.com) (licence CC0 : usage commercial libre, sans
  attribution obligatoire). Showroom : caisse, tabourets, canapé, table basse, fauteuils, suspensions, jardinières, banc,
  poubelle, climatiseur, coffret électrique, plante, papeterie, horloge, étagères, cartons, caisson, cadre — téléchargés par
  `tools/optimize-3d/fetch.mjs`, puis allégés par `optimize.mjs` et `textures.py`.
- Photos de personnes et de produits : [Unsplash](https://unsplash.com/license) (licence Unsplash, usage commercial
  libre) — liens de chaque photo dans [tools/studio-assets/credits.json](tools/studio-assets/credits.json).
- Détourage et segmentation hors ligne : BiRefNet (MIT) et SegFormer « clothes » (MIT), via Transformers.js.
- Portant de vêtements : [Product Rail Gallery](https://21st.dev/@dhxwhy/components/product-rail-gallery) par DHxWhy (licence MIT).
- Pied de page : Beam Wordmark Footer par [Kedhar](https://21st.dev/@kedhareswer) (21st.dev).
- Bandeau des avis : Marquee (21st.dev), d'après [Magic UI](https://magicui.design) (licence MIT).
- Écran d'arrivée : Glass Reveal (21st.dev), shader et ressorts de [zanwei/glass-icon-reveal](https://github.com/zanwei/glass-icon-reveal) (licence MIT).
- Mise en page de l'administration : inspirée de [Hi.Events](https://github.com/HiEventsDev/Hi.Events) (idées de disposition seulement, aucun code repris).
