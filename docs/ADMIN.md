# Installer et utiliser l’espace MJ

## Première mise à jour du serveur

Cette version ajoute une API Python, une base SQLite et un service de sauvegarde.
Un simple `git pull` ne suffit donc plus lors de cette migration.

Dans la connexion SSH au serveur :

```bash
cd /srv/docker/outlayer-wiki
git pull
docker compose up -d --build --force-recreate
```

Le compte **mj** reprend le mot de passe MJ existant. Il suffit de se reconnecter :
la migration ferme les anciennes sessions, sans modifier les archives ni les images.
Ouvrir `/account/` (ou `/admin/`) et saisir l’identifiant **mj** avec ce mot de passe.
Actualiser avec Ctrl + F5 après le déploiement.

Sur une installation neuve, ou pour récupérer le compte MJ :

```bash
docker compose exec api python -m server.manage set-password
```

Cette commande crée ou réactive **mj** avec les droits MJ. Elle demande un mot de passe
de 12 caractères minimum et sa confirmation, puis ferme toutes les sessions.
Aucun mot de passe n’est fourni par défaut ou enregistré dans GitHub.

## Comptes et accès

| Profil | Accès |
| --- | --- |
| Visiteur sans compte | Accueil et inscription |
| Invité connecté | Accueil et gestion de son mot de passe |
| Joueur validé | Codex, fiches révélées et aperçus floutés des archives scellées |
| MJ | Codex, atelier, brouillons, images privées et gestion des comptes |

1. Le joueur ouvre **Connexion → Créer mon compte**. Son compte reçoit toujours le rôle
   **Invité**, même si une requête tente d’imposer un autre rôle.
2. Le MJ ouvre **Atelier → Comptes**, recherche l’identifiant et sélectionne **Joueur**,
   puis **Enregistrer**. La liste affiche 20 comptes par page.
3. Le joueur se reconnecte pour entrer dans le codex. Les changements de rôle, désactivations
   et réinitialisations de mot de passe ferment les sessions du compte concerné.

Le MJ peut créer des comptes, changer leur rôle, désactiver leur accès ou définir un nouveau
mot de passe. Attribuer le rôle MJ donne tous les droits ; l’interface demande confirmation.
Le dernier compte MJ actif ne peut pas être désactivé ou rétrogradé. Chaque utilisateur peut
changer son mot de passe depuis **Mon compte**, en fournissant son mot de passe actuel.
Les comptes ne sont pas supprimés : désactiver un compte conserve la possibilité de le réactiver.

Les rôles sont vérifiés par l’API sur chaque requête, y compris les images du codex.
Les mots de passe sont hachés ; les cookies de session sont HttpOnly et les modifications
exigent un jeton CSRF. Les inscriptions sont limitées à 5 par heure par adresse vue par l’API,
et les connexions à 8 échecs par tranche de 15 minutes. Derrière le proxy actuel, ces limites
peuvent être partagées par les visiteurs. Les comptes sont inclus dans les sauvegardes SQLite
(schéma 3) ; les sauvegardes des schémas 1 et 2 restent restaurables et sont migrées au démarrage.

## Conservation du contenu

Le premier démarrage importe les sept archives de `data/codex.json`, avec seulement
Le Noyau révélé. Les démarrages suivants utilisent exclusivement la base existante :
une mise à jour Git ne réimporte pas le catalogue et ne remplace pas vos brouillons.
Ce fichier JSON reste uniquement la source d’initialisation d’une nouvelle installation.

Vérification du démarrage :

```bash
docker compose ps
docker compose logs --tail=50 api backup
```

Le service `api` doit être sain et `backup` annoncer une sauvegarde. La compilation
Docker n’a pas pu être exécutée sur le poste de développement Windows dépourvu de Docker ;
les parcours ont été testés localement avec le même serveur Waitress et les dépendances
Python fixées dans `requirements.txt`.

## Préparer et publier

La liste MJ charge 30 résumés par page. La recherche et les filtres (type, visibilité, ordre)
portent sur toute la base. Les descriptions et notes privées sont téléchargées seulement
à l’ouverture d’une fiche. La recherche de liens affiche 10 résultats par page ; les liens
sélectionnés restent conservés quand on change de recherche ou de page (50 liens maximum).
Chercher dans la liste ne remplace pas le brouillon actuellement ouvert.

Côté joueurs, une page contient au plus 24 cartes, remplacées au changement de page.
La recherche couvre les noms, textes, détails et mots-clés des versions publiées uniquement.
Le tri propose les dernières révélations (connues avant les archives scellées), le nom A–Z,
ou l’ordre d’ajout. Les filtres et la page sont conservés dans l’adresse pour retrouver
ou partager une recherche. Les compteurs de progression et les cinq dernières découvertes
restent globaux. Les images restent chargées progressivement ; les fiches complètes et
leurs liens ne sont demandés qu’à l’ouverture.

L’index de recherche est créé automatiquement lors du premier démarrage de cette version,
sans remplacer les données existantes, et actualisé dans la même transaction que chaque
enregistrement ou publication. Une sauvegarde de l’ancienne version reste restaurable :
le redémarrage recrée l’index. La recherche utilise une comparaison de texte normalisé
dans SQLite ; ce n’est pas une promesse de temps constant pour des millions de fiches.

1. Choisir une archive ou cliquer sur **Nouvelle archive**.
2. Renseigner les champs destinés aux joueurs. Les notes MJ restent dans le champ privé.
3. Importer éventuellement une image PNG, JPEG ou WebP, puis choisir les archives liées.
4. **Enregistrer le brouillon** conserve ces données dans l’espace privé.
5. **Prévisualiser côté joueurs** enregistre les changements et ouvre le véritable rendu
   du codex, dans une fenêtre accessible uniquement avec la session MJ.
6. **Révéler aux joueurs** publie une copie des champs publics du brouillon.

Pour une fiche déjà révélée, enregistrer un brouillon ne change pas sa version publique.
Le bouton devient **Publier la mise à jour**. Les notes MJ ne sont jamais copiées dans
la publication. Le mot `???` doit être remplacé avant de révéler une archive.

**Sceller l’archive** remplace la fiche publique par un nom `???`, sa catégorie et une
version très floutée et légèrement assombrie de son illustration. **Retirer du codex** retire même cette carte. Les deux actions
conservent le brouillon et permettent une nouvelle révélation ultérieure. Elles ne peuvent
pas effacer une information déjà lue, copiée ou téléchargée par un joueur.

Une image importée est privée tant qu’aucune fiche révélée ne l’utilise. Le serveur vérifie
cette autorisation à chaque téléchargement. Les fichiers sont convertis en WebP, redimensionnés
à 1600 × 1000 pixels maximum, sans métadonnées d’origine. Limites : 10 Mo et 20 millions
de pixels à l’import. Les anciennes images du dossier public `assets/` restent publiques.

Le teaser est une copie WebP de 800 × 400 pixels : les détails sont réduits puis floutés
côté serveur, sans filtre recalculé pendant le scroll. Seules les couleurs et grandes
masses servent d’indices visuels ; un flou ne garantit pas qu’aucun joueur ne devinera le sujet.
Le navigateur joueur ne reçoit ni l’original privé ni son URL. Sans image raster compatible
(notamment pour un ancien SVG), le sceau générique est conservé : importer une image depuis
l’atelier permet d’obtenir le teaser. Les noms, descriptions et notes restent masqués.

À la première mise à jour, les archives déjà scellées ayant une image compatible reçoivent
automatiquement ce traitement. Ensuite, enregistrer un nouveau brouillon ne change pas
le teaser : cliquer à nouveau sur **Sceller l’archive** pour le mettre à jour. La même source
réutilise la même copie floutée, stockée dans SQLite et incluse dans les sauvegardes.

Les liens sont directionnels. Ils apparaissent côté joueur uniquement lorsque les deux
archives sont révélées. Les cinq dernières révélations apparaissent en tête du codex.
Une simple correction ne change pas leur date ; une nouvelle révélation après retrait
ou scellement obtient une nouvelle date. Le Noyau importé n’a pas de date inventée.

Si deux onglets modifient la même fiche, le second enregistrement est refusé. Copier
les modifications en cours si nécessaire, puis utiliser **Actualiser la liste**.
Les sessions expirent après huit heures ; reconnectez-vous dans un autre onglet pour
conserver un formulaire encore ouvert. Le site public actualise son contenu au rechargement.

## Données et accès

`codex-data` est un volume Docker privé contenant la base, les brouillons, les publications,
les images et le compte MJ. Nginx ne monte pas ce volume et ne sert plus la racine du dépôt.
Les routes privées nécessitent une session ; les mutations vérifient également l’origine
et un jeton CSRF. Les sessions sont stockées côté serveur, avec un cookie HttpOnly et SameSite.
Voir les [considérations de sécurité Flask](https://flask.palletsprojects.com/en/stable/web-security/).

La configuration fournie conserve votre adresse HTTP de réseau local. Le mot de passe
n’est donc pas chiffré pendant son transport sur ce réseau. Pour une exposition à Internet,
configurer d’abord HTTPS et définir dans `.env` :

```text
APP_ORIGIN=https://votre-domaine
COOKIE_SECURE=1
```

`APP_ORIGIN` doit correspondre exactement à l’adresse utilisée dans le navigateur
(protocole, hôte et port). Le fichier `.env` est ignoré par Git. Le port de l’API n’est pas
publié sur le réseau ; les requêtes passent par Nginx. Un seul compte MJ est prévu.

## Sauvegardes

Le service `backup` crée une copie cohérente de SQLite au démarrage puis toutes les 24 heures,
et conserve les 14 dernières copies dans le volume séparé `codex-backups`. Les images sont
dans la base et font partie de chaque sauvegarde. Le programme utilise
[l’API de sauvegarde SQLite](https://sqlite.org/backup.html), compatible avec une base ouverte.

Faire une sauvegarde immédiatement, par exemple après une séance :

```bash
docker compose exec api python -m server.manage backup
```

Exporter les sauvegardes dans un dossier privé du serveur :

```bash
mkdir -p ~/outlayer-backups
chmod 700 ~/outlayer-backups
docker compose cp api:/backups/. ~/outlayer-backups/
```

Conserver aussi une copie hors de ce serveur : les deux volumes Docker se trouvent sur
la même machine. Les copies contiennent des secrets MJ et le compte ; ne pas les placer
dans le dépôt public. Ne pas utiliser `docker compose down -v`, qui supprimerait les volumes.

Pour restaurer une sauvegarde présente dans `/backups`, remplacer le nom ci-dessous :

```bash
docker compose stop api backup
docker compose run --rm --no-deps api python -m server.manage restore outlayer-DATE.sqlite --confirm-services-stopped
docker compose up -d
```

La commande valide le fichier, sauvegarde l’état actuel, puis restaure les données et
ferme les sessions. Le mot de passe redevient celui contenu dans la sauvegarde ; au besoin,
utiliser `set-password`. Toujours arrêter les deux services avant cette opération.

## Mises à jour suivantes

```bash
cd /srv/docker/outlayer-wiki
git pull
docker compose up -d --build --force-recreate
```

## Vérification pour le développement

```bash
python -m pip install -r requirements.txt
python -m unittest discover -s tests -p 'test_*.py' -v
node --test tests/catalog.test.cjs
```

Tests couverts : import unique, conservation des données, brouillons et publications séparés,
prévisualisation privée, liens filtrés, dates de révélation, contrôle des images, sessions,
CSRF, limitation des tentatives, conflits entre onglets, sauvegarde/restauration et fichiers
privés inaccessibles. Les essais Chrome couvrent aussi le formulaire, l’import, l’aperçu,
la publication, le scellement, le retrait, la déconnexion et les écrans mobiles.

Les essais de pagination utilisent un catalogue de 1 008 archives : 24 cartes, 30 lignes MJ
et 10 propositions de liens au maximum. Sur ce jeu de test, la plus grande réponse de liste
publique mesurée dans Chrome était de 7 312 octets. Ce chiffre dépend de la longueur des
résumés et ne mesure pas les FPS du serveur de jeu. Les tests couvrent également les recherches
sur des fiches hors page, les réponses arrivant en retard, les limites de pagination,
les liens conservés entre plusieurs pages et la migration d’une base existante.
