# Mettre le site en ligne gratuitement

Objectif : une adresse publique (`https://ab-tech….onrender.com`) à envoyer au client, pour qu'il voie le site,
teste la boutique et prenne en main l'administration. Tout est gratuit.

| Rôle | Service | Pourquoi celui-là |
| --- | --- | --- |
| Site + API (un seul service) | [Render](https://render.com), offre gratuite | serveur Node complet ; site et API à la même adresse (connexion par cookie simple et sûre) |
| Base de données | [Neon](https://neon.com), offre gratuite | Postgres sans date d'expiration (la base gratuite de Render est supprimée au bout de 30 jours) |
| Photos envoyées depuis l'administration | [Cloudinary](https://cloudinary.com), offre gratuite | le disque d'un service Render gratuit est effacé à chaque redémarrage |

Le fichier [`render.yaml`](render.yaml) décrit déjà le service : Render le lit tout seul.

---

## 1. La base de données (Neon) — 3 minutes

1. Ouvrez [neon.com](https://neon.com) → **Sign up** (le plus simple : « Continue with GitHub »).
2. Créez un projet : nom `ab-tech`, version Postgres proposée par défaut,
   région **AWS Europe Central 1 (Frankfurt)** (la même que le site, pour la rapidité).
3. Sur la page du projet, bouton **Connect** → copiez la **chaîne de connexion** complète
   (elle commence par `postgresql://` et se termine par `sslmode=require…`). Gardez-la de côté : c'est un mot de passe.

## 2. Les photos (Cloudinary) — 2 minutes

1. Ouvrez [cloudinary.com](https://cloudinary.com) → **Sign up for free**.
2. Dans le tableau de bord, repérez **API environment variable** (ou **Settings → API Keys**) et copiez la valeur
   qui commence par `cloudinary://` (sans le `CLOUDINARY_URL=` devant). C'est aussi un secret.

## 3. Reprendre le contenu actuel du site (recommandé) — 2 minutes

Le site local (http://localhost:8080) contient déjà votre travail : logo, téléphones, photos de produits, textes,
compte administrateur (avec son mot de passe actuel), et quelques devis, commandes et avis de test.
Pour retrouver tout cela en ligne :

1. Copiez `.env.cloud.example` en **`.env.cloud`** (à la racine du projet ; ce fichier n'est jamais envoyé sur GitHub)
   et collez-y les deux valeurs des étapes 1 et 2.
2. Docker en marche (le site local doit tourner), lancez :

   ```bash
   pnpm cloud:copy
   ```

   Le script vérifie d'abord les accès Cloudinary, puis copie la base dans Neon (sans les sessions ouvertes),
   envoie les photos sur Cloudinary, remplace leurs adresses et compare le résultat. Il ne touche jamais à une base
   en ligne déjà remplie, sauf avec `pnpm cloud:copy --reset` (qui la vide d'abord).

**Partir de zéro à la place ?** Sautez cette étape : le site en ligne démarrera avec les exemples, et l'administrateur
sera créé à partir de `ADMIN_EMAIL` / `ADMIN_PASSWORD` (mot de passe à changer à la première connexion).

> Faites cette étape **avant** l'étape 4 : au premier démarrage, le site remplit une base vide avec les exemples.

## 4. Le site (Render) — 10 minutes, dont la construction

1. Ouvrez [render.com](https://render.com) → **Get Started** → « Sign up with GitHub », et autorisez Render à voir
   le dépôt **Iya2006/AB-TECH**.
2. **New +** → **Blueprint** → choisissez le dépôt `AB-TECH`. Render affiche le service `ab-tech` décrit dans `render.yaml`.
3. Remplissez les valeurs demandées :
   - `DATABASE_URL` : la chaîne de connexion Neon (étape 1) ;
   - `CLOUDINARY_URL` : la valeur Cloudinary (étape 2) ;
   - `ADMIN_EMAIL` et `ADMIN_PASSWORD` : seulement si vous êtes parti de zéro (10 caractères minimum).
     Après la copie de l'étape 3, laissez-les vides : votre compte administrateur existe déjà.
4. **Apply** (ou **Deploy Blueprint**). La première construction prend 5 à 10 minutes ; suivez-la dans **Logs**.
5. L'adresse du site s'affiche en haut de la page du service (`https://ab-tech….onrender.com`). Vérifiez :
   l'accueil, `/connexion`, puis `/admin` avec le compte administrateur.

Chaque `git push` sur la branche `main` redéploie ensuite le site automatiquement (environ 5 minutes).

## 5. Garder le site éveillé (facultatif, conseillé pour la démo)

Un service Render gratuit **s'endort après 15 minutes sans visite** ; la visite suivante attend environ une minute
pendant qu'il se réveille. Pour que le client trouve toujours un site rapide :

1. Créez un compte gratuit sur [UptimeRobot](https://uptimerobot.com).
2. **Add New Monitor** → type **HTTP(s)** → URL : `https://<votre-adresse>.onrender.com/api/ping` → intervalle **5 minutes**.

`/api/ping` répond sans interroger la base : la base Neon peut continuer à s'endormir et économiser ses heures gratuites.
Le service consomme alors environ 744 heures par mois sur les 750 offertes par Render : gardez un seul service gratuit
sur ce compte Render.

---

## Ce que permet l'offre gratuite (à dire au client)

- **Render** : 512 Mo de mémoire, 750 heures par mois, réveil d'environ une minute sans l'étape 5.
  Les envois d'e-mails (SMTP) sont **bloqués** : « Mot de passe oublié » ne peut pas envoyer d'e-mail ;
  l'administrateur crée un lien de réinitialisation depuis **Administration → Comptes clients** et le transmet par WhatsApp.
- **Neon** : 1 Go de données, 100 heures de calcul par mois, mise en veille après 5 minutes (réveil en moins d'une seconde).
- **Cloudinary** : 25 crédits par mois (environ 20 Go de photos ou 25 Go de bande passante).

Pour la vraie mise en service (nom de domaine, e-mails, pas de mise en veille) : un service Render payant
(quelques dollars par mois, même `render.yaml` avec un autre `plan`), ou un serveur (VPS) avec Docker :
`docker compose up -d --build` (voir README).

## Connexion avec Google (plus tard)

Dans la console Google Cloud, déclarez l'adresse de redirection `https://<votre-adresse>.onrender.com/api/auth/google/callback`,
puis ajoutez `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` dans Render (service → **Environment**). L'adresse exacte
s'affiche aussi dans **Administration → Paramètres → Connexion des clients**.

## En cas de problème

| Symptôme | Cause probable |
| --- | --- |
| La construction échoue | voir **Logs** sur Render ; la même commande se lance en local : `pnpm run build:render` |
| « Configuration invalide » au démarrage | une valeur manque ou est mal copiée (`DATABASE_URL`, `ADMIN_PASSWORD` de moins de 10 caractères) |
| Les photos envoyées disparaissent | `CLOUDINARY_URL` absent : le service stocke alors sur son disque, effacé au redémarrage |
| Première page très lente | le service se réveillait : voir l'étape 5 |
