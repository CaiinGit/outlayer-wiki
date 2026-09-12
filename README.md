# Outlayer Wiki

Codex joueur du JDR **Outlayer**, créé par Valentin Brizard.
Seul **Le Noyau** est actuellement connu ; six archives restent scellées.

## Architecture

Le site reste statique, servi par Nginx. `data/codex.json` contient le catalogue public,
séparé du code d’affichage. `catalog.js` valide et prépare les données ; `app.js` gère
la recherche, les catégories, les fiches et la progression. Aucun paquet n’est nécessaire
pour servir le site.

Le contenu est publié par Git et tous les joueurs consultent les mêmes archives :
ajouter une base et un serveur applicatif ne répondrait pas à un besoin actuel.
Une interface privée d’édition, des comptes ou des révélations par groupe justifieraient
une API et une base SQLite côté serveur. Cette évolution devra garder les données privées
hors de la racine publique de Nginx et ajouter authentification et sauvegardes.

## Codex

- Types : Lieux, Personnages, Factions, Bestiaire, Artefacts, Utilitaires, Divinités.
- État connu/inconnu et option de visibilité indépendants.
- Image nette pour les découvertes ; sceau générique assombri pour les archives inconnues.
- Recherche sans accents, index préparé une seule fois au chargement.
- Affichage limité à 24 cartes initiales, puis bouton pour afficher les suivantes.
- Images chargées à l’approche de l’écran, dimensions réservées et décodage asynchrone.
- Erreur de chargement explicite et bouton pour réessayer.

Le catalogue est revalidé auprès du serveur à chaque visite (`cache: no-cache`). Le hero
conserve son fond déjà flouté et son parallaxe CSS ; aucune boucle JavaScript de scroll
n’est ajoutée. Voir `docs/HERO.md`.

## Modifier les fiches

Voir **[le guide de contenu](docs/CONTENT-GUIDE.md)** pour les champs et un exemple.
Le dépôt est public : aucun secret MJ ne doit y être enregistré, même dans une fiche masquée.
L’ancien `data.js` n’est plus chargé ; toute modification du contenu se fait dans le JSON.

Vérification locale (Node.js, aucune dépendance) :

```bash
node --test tests/catalog.test.cjs
```

## Serveur existant

```bash
cd /srv/docker/outlayer-wiki
git pull
```

Puis Ctrl + F5. L’installation initiale utilise `docker compose up -d`.
Adresse locale : `http://192.168.1.197:8081`. Le port 8080 reste celui du portfolio.
