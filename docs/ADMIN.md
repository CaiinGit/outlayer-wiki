# Installer et utiliser l’espace MJ

## Première mise à jour du serveur

Cette version ajoute une API Python, une base SQLite et un service de sauvegarde.
Un simple `git pull` ne suffit donc plus lors de cette migration.

Dans la connexion SSH au serveur :

```bash
cd /srv/docker/outlayer-wiki
git pull
docker compose up -d --build
docker compose exec api python -m server.manage set-password
```

La dernière commande demande votre nouveau mot de passe MJ et sa confirmation.
Utiliser au moins 12 caractères. Rien ne s’affiche pendant la saisie. Il n’existe
aucun compte par défaut, aucun mot de passe partagé dans GitHub et aucune inscription
publique. Cette commande permet également de changer un mot de passe oublié ; elle
ferme toutes les anciennes sessions.

Ouvrir ensuite `http://192.168.1.197:8081/admin/` et saisir ce mot de passe.
Le codex joueur conserve l’adresse habituelle. Actualiser avec Ctrl + F5.

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

**Sceller l’archive** remplace la fiche publique par un nom `???`, sa catégorie et un
sceau générique assombri. **Retirer du codex** retire même cette carte. Les deux actions
conservent le brouillon et permettent une nouvelle révélation ultérieure. Elles ne peuvent
pas effacer une information déjà lue, copiée ou téléchargée par un joueur.

Une image importée est privée tant qu’aucune fiche révélée ne l’utilise. Le serveur vérifie
cette autorisation à chaque téléchargement. Les fichiers sont convertis en WebP, redimensionnés
à 1600 × 1000 pixels maximum, sans métadonnées d’origine. Limites : 10 Mo et 20 millions
de pixels à l’import. Les anciennes images du dossier public `assets/` restent publiques.

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
docker compose up -d --build
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
