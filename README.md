# Outlayer Wiki

Codex joueur évolutif du JDR **Outlayer**, créé par Valentin Brizard.

## Principe

Le site est conçu comme une encyclopédie de campagne qui se débloque progressivement.

Les entrées peuvent être :

- **Inconnu** — teaser minimal, aucun spoiler réel présent dans le dépôt.
- **Entrevue** — quelques indices accessibles aux joueurs.
- **Découvert** — identité et fiche consultables.
- **Connu** — fiche plus complète du point de vue des personnages.

Le site calcule automatiquement la progression par catégorie.

## Catégories

- Lieux
- Personnages
- Factions
- Bestiaire
- Artefacts
- Divinités

## Sécurité anti-spoiler

Ce dépôt est public.

Les informations réservées au MJ ne doivent **jamais** être placées dans le HTML, le JavaScript, les commentaires, les images ou les fichiers du dépôt en pensant qu'un flou ou une classe CSS suffira à les cacher.

Une entrée verrouillée contient uniquement un teaser sans information secrète.

Voir le guide détaillé : `docs/CONTENT-GUIDE.md`.

## Structure

```text
outlayer-wiki/
├── index.html
├── styles.css
├── data.js
├── app.js
├── compose.yaml
├── docs/
│   └── CONTENT-GUIDE.md
└── README.md
```

## Ajouter ou débloquer du contenu

Le contenu du codex se trouve dans `data.js`.

Après une modification sur GitHub :

```bash
cd /srv/docker/outlayer-wiki
git pull
```

Les changements sont immédiatement servis par Nginx.

## Hébergement sur serverdecaiin

Le site est prévu pour fonctionner sur le serveur Ubuntu personnel `serverdecaiin`.

```bash
docker compose up -d
```

Adresse locale prévue :

```text
http://192.168.1.197:8081
```

Le portfolio CV utilise déjà le port 8080, Outlayer utilise donc 8081.
