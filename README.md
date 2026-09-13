# Outlayer Wiki

Codex joueur et atelier privé du MJ pour **Outlayer**, l’univers de Valentin Brizard.
Le catalogue initial contient sept archives, dont seul **Le Noyau** est découvert.

## Installer cette version

Dans la connexion SSH au serveur :

```bash
cd /srv/docker/outlayer-wiki
git pull
docker compose up -d --build
docker compose exec api python -m server.manage set-password
```

Choisir un mot de passe MJ d’au moins 12 caractères. Ouvrir ensuite
`http://192.168.1.197:8081/admin/`. Aucun mot de passe n’est fourni par défaut.
Le codex joueur garde son adresse habituelle.

**[Installation, utilisation et sauvegardes](docs/ADMIN.md)**

## Fonctions

- Brouillons privés et notes MJ séparés des versions publiées.
- Import d’images, conversion WebP et contrôle de leur accès.
- Prévisualisation avec le même rendu que le site joueur.
- Révéler, mettre à jour, sceller ou retirer une fiche.
- Liens entre archives connues et cinq dernières découvertes.
- Recherche globale sans accents dans SQLite, tri et pagination : 24 cartes côté joueurs,
  30 résumés côté MJ, 10 résultats pour choisir un lien. Fiches complètes chargées à l’ouverture.
- Sauvegarde SQLite quotidienne, 14 copies conservées, restauration en ligne de commande.

## Architecture

Nginx sert uniquement les fichiers publics et transmet les appels API au serveur Flask/Waitress.
SQLite contient les brouillons, publications, images et sessions dans un volume Docker privé.
Un second service sauvegarde la base dans un volume distinct. Le code source reste public ;
aucune donnée privée ne doit être ajoutée au dépôt.

`data/codex.json` initialise uniquement une nouvelle base. Le contenu se gère ensuite dans
l’espace MJ ; les mises à jour Git n’écrasent pas les archives. Les tests de campagne portent
sur le catalogue initial. Voir aussi le [guide de contenu](docs/CONTENT-GUIDE.md).

Le hero conserve le logo approuvé et les optimisations de parallaxe documentées dans
[HERO.md](docs/HERO.md).

## Vérifications

```bash
python -m pip install -r requirements.txt
python -m unittest discover -s tests -p 'test_*.py' -v
node --test tests/catalog.test.cjs
```

Les parcours navigateur ont également été vérifiés sur ordinateur et mobile.
La construction Docker reste à exécuter sur le serveur : Docker n’est pas installé sur
le poste de développement utilisé pour cette modification.
