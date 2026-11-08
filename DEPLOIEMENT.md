# Mettre le site en ligne (essai gratuit sur Render)

Objectif : une adresse publique (`https://ab-tech….onrender.com`) à envoyer au client, pour qu'il voie le site,
crée un compte, teste la boutique et prenne en main l'administration. Tout est gratuit.

Le fichier [`render.yaml`](render.yaml) décrit tout : Render crée **la base de données** et **le site**, et les relie
lui-même. Le site en ligne a donc sa propre base, indépendante de celle de votre ordinateur.

---

## 1. Créer la base et le site — environ 10 minutes

1. Ouvrez [dashboard.render.com](https://dashboard.render.com) et connectez-vous avec **GitHub**.
2. En haut à droite : **+ New** → **Blueprint**.
3. Si le dépôt `AB-TECH` n'apparaît pas : **Configure account** (ou **Connect GitHub**) → sur la page GitHub,
   *Repository access* → *Only select repositories* → `AB-TECH` → **Save**.
4. Choisissez **Iya2006/AB-TECH** → **Connect**. Nom du Blueprint : `ab-tech`, branche : `main`.
5. Render annonce deux éléments, tous deux **Free** :
   - `ab-tech-db` : la base de données Postgres ;
   - `ab-tech` : le site.
6. Remplissez les deux valeurs demandées :
   - **`ADMIN_EMAIL`** : l'adresse e-mail de l'administrateur (celle qui se connectera à `/admin`) ;
   - **`ADMIN_PASSWORD`** : un mot de passe **provisoire** d'au moins **10 caractères**.
7. Cliquez sur **Deploy Blueprint**.
8. Patientez : la base est prête en 1 à 2 minutes, le site se construit en 5 à 10 minutes.
   Pour suivre : service **ab-tech** → **Logs**. C'est prêt quand l'état passe à **Live**.
9. L'adresse du site s'affiche en haut de la page du service **ab-tech** : c'est le lien à envoyer.

## 2. Première connexion de l'administrateur

1. Ouvrez `https://<votre-adresse>.onrender.com/connexion`.
2. Connectez-vous avec `ADMIN_EMAIL` et `ADMIN_PASSWORD`.
3. Le site demande aussitôt de **choisir un nouveau mot de passe** (10 caractères minimum) :
   le mot de passe provisoire ne sert qu'une fois, et seul l'administrateur connaît le nouveau.
4. Personnalisez : **Apparence du site** (logo, accueil, enseigne…), **Paramètres** (téléphones, indicatif WhatsApp,
   devise, réseaux), **Produits**, **Réalisations**.

Le mot de passe du site local (http://localhost:8080) **ne marche pas** en ligne : le site en ligne a sa propre base,
qui démarre avec les exemples. Pour retrouver en ligne le contenu local, voir « Reprendre le contenu du site local ».

## 3. Garder les photos envoyées (conseillé)

Le disque d'un service gratuit est effacé quand il s'endort ou redémarre : sans stockage externe, **les photos envoyées
depuis l'administration (logo, produits, réalisations) disparaissent**. Les textes et réglages, eux, restent dans la base.

1. Créez un compte gratuit sur [cloudinary.com](https://cloudinary.com) ; dans le tableau de bord, copiez la valeur
   **API environment variable** qui commence par `cloudinary://` (sans `CLOUDINARY_URL=` devant).
2. Render → service **ab-tech** → **Environment** → **Add Environment Variable** :
   clé `CLOUDINARY_URL`, valeur collée → **Save, rebuild, and deploy**.

## 4. Garder le site éveillé (facultatif)

Un service gratuit **s'endort après 15 minutes sans visite** ; la visite suivante attend environ une minute.
Pour que le client trouve toujours un site rapide : compte gratuit [UptimeRobot](https://uptimerobot.com) →
**Add New Monitor** → **HTTP(s)** → URL `https://<votre-adresse>.onrender.com/api/ping` → intervalle **5 minutes**.
(Environ 744 heures par mois sur les 750 offertes : gardez un seul service gratuit sur ce compte Render.)

---

## Ce qui marche en version gratuite

- **Clients** : ils créent un compte avec leur e-mail et un mot de passe, puis envoient devis, commandes et avis.
- **E-mails** : Render gratuit bloque leur envoi. « Mot de passe oublié » n'envoie pas d'e-mail ; l'administrateur
  crée un lien de réinitialisation dans **Administration → Comptes clients** et le transmet (bouton WhatsApp).
- **Google** : le bouton « Continuer avec Google » reste caché tant qu'il n'est pas configuré (voir plus bas).

## La base de données : à savoir

- Base Postgres Render gratuite : 1 Go, **expire 30 jours après sa création** ; ensuite 14 jours pour passer à une offre
  payante, puis Render la **supprime** avec toutes ses données. La date s'affiche dans Render → **ab-tech-db** → **Info**.
- Avant cette date : passer au vrai hébergement, ou déplacer la base vers [Neon](https://neon.com) (gratuit, sans
  expiration) en changeant `DATABASE_URL` dans **ab-tech** → **Environment** (les données peuvent être recopiées).
- Les adresses de connexion (**Internal / External Database URL**) sont dans **ab-tech-db** → **Info** → **Connect** :
  ce sont des secrets, à ne jamais publier.

## Reprendre le contenu du site local (facultatif)

Pour retrouver en ligne le contenu de http://localhost:8080 (logo, téléphones, photos de produits, compte administrateur
avec son mot de passe actuel, devis et avis de test) :

1. Copiez `.env.cloud.example` en **`.env.cloud`** (jamais envoyé sur GitHub) et remplissez :
   - `CLOUD_DATABASE_URL` : l'**External Database URL** de **ab-tech-db** ;
   - `CLOUDINARY_URL` : la valeur Cloudinary (les photos locales y sont envoyées).
2. Docker en marche (site local lancé), à la racine du projet :

   ```bash
   pnpm cloud:copy --reset
   ```

   `--reset` vide d'abord la base en ligne (elle contient les exemples créés au premier démarrage), puis le script copie
   la base locale (sans les sessions ouvertes), envoie les photos sur Cloudinary et compare le résultat.
3. Ajoutez `CLOUDINARY_URL` au service (étape 3), puis Render → **ab-tech** → **Manual Deploy** → **Restart service**.

## Mises à jour

Chaque `git push` sur la branche `main` redéploie automatiquement le site (environ 5 minutes). La base n'est pas touchée.

## Connexion avec Google (plus tard)

Dans la console Google Cloud, déclarez l'adresse de redirection
`https://<votre-adresse>.onrender.com/api/auth/google/callback`, puis ajoutez `GOOGLE_CLIENT_ID` et
`GOOGLE_CLIENT_SECRET` dans **ab-tech** → **Environment**. L'adresse exacte s'affiche aussi dans
**Administration → Paramètres → Connexion des clients**.

## En cas de problème

| Symptôme | Cause probable |
| --- | --- |
| La construction échoue | **Logs** du service ; la même commande se lance en local : `pnpm run build:render` |
| « Configuration invalide » au démarrage | `ADMIN_PASSWORD` de moins de 10 caractères, ou `ADMIN_EMAIL` mal écrit : corrigez dans **Environment** |
| Impossible de se connecter à `/admin` | mauvais e-mail ou mot de passe provisoire ; l'administrateur n'est créé que si la base est vide |
| Les photos envoyées disparaissent | `CLOUDINARY_URL` absent (étape 3) |
| Première page très lente | le service se réveillait (étape 4) |

Pour la vraie mise en service (nom de domaine, e-mails, pas de mise en veille, sauvegardes) : offres payantes Render
(même `render.yaml` avec un autre `plan`), ou un serveur (VPS) avec Docker : `docker compose up -d --build` (voir README).
