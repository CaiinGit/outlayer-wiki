# Outlayer Wiki

Codex joueur et atelier privé du MJ pour **Outlayer**, l’univers de Valentin Brizard.
Le catalogue initial contient sept archives, dont seul **Le Noyau** est découvert.

## Installer cette version

Dans la connexion SSH au serveur :

```bash
cd /srv/docker/outlayer-wiki
git pull
docker compose up -d --build --force-recreate
```

Le compte **mj** reprend automatiquement le mot de passe MJ existant. Les anciennes sessions
sont fermées : reconnectez-vous sur `/account/`. Les archives restent intactes.
Sur une installation neuve uniquement, créer le compte MJ avec
`docker compose exec api python -m server.manage set-password` (12 caractères minimum).
Cette commande permet aussi de récupérer un accès MJ oublié.
Actualisez avec Ctrl + F5 après la mise à jour. La recréation des conteneurs renouvelle
les fichiers montés par Nginx et conserve les volumes de données.

**[Installation, utilisation et sauvegardes](docs/ADMIN.md)**

## Fonctions

- Chronologie sur `/chronologie/` : frise verticale animée, recherche, ères et événements.
- Compétences sur `/competences/` : choix d’Affinité, arbres interactifs, fiches détaillées et simulation locale des prérequis.
- Grimoire à feuilleter : une Affinité par feuillet, puis trois voies illustrées avec leurs propres arbres, configurables dans l’atelier.
- Atelier Compétences : glisser-déposer, liens dirigés, règles « tous » ou « au moins un », icônes et fonds personnalisés, brouillons et publication indépendante.
- Atelier Chronologie : dates négatives ou inconnues, récits, ordre, import JSON privé et révélation aux joueurs.

- Journal de campagne sur `/sessions/` : Fables → Arcs → Sessions, récits et dates.
- Gestion depuis **Atelier → Sessions** : création, modification, ordre, visibilité et suppression.
- Fable **I**, **Arc 1** (renommable), **Session 1** et **Session 2** initialisés une seule fois, sans récit inventé.

- Comptes MJ, joueur et invité ; inscription puis validation par le MJ.
- Accueil ouvert, codex réservé aux joueurs validés et au MJ.
- Gestion des comptes paginée, désactivation et réinitialisation des mots de passe.
- Brouillons privés et notes MJ séparés des versions publiées.
- Import d’images, conversion WebP et contrôle de leur accès.
- Illustrations précalculées très floutées pour les archives scellées, sans transmettre l’original privé.
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
