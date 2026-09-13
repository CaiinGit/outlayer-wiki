# Guide de contenu — Outlayer

Le contenu de campagne se gère désormais dans **l’espace MJ**, accessible à `/admin/`.
Voir le [guide complet](ADMIN.md) pour l’installation et la publication.

## Champs d’une fiche

- **Type** : Lieux, Personnages, Factions, Bestiaire, Artefacts, Utilitaires ou Divinités.
- **Nom**, **sous-titre**, **texte de carte**, **description**, détails et mots-clés.
- **Illustration** et symbole de remplacement.
- **Archives liées** : liens vers d’autres fiches du codex.
- **Notes privées du MJ** : jamais publiées.

Les monstres et créatures vont dans Bestiaire ; les règles et aides de jeu dans Utilitaires.
L’illustration du Noyau est un emblème décoratif, pas une carte géographique canonique.

## Brouillon et publication

Enregistrer le brouillon conserve votre travail sans modifier la fiche des joueurs.
Prévisualiser affiche les champs destinés aux joueurs ; révéler en publie une copie.
Sceller affiche uniquement la catégorie, un nom `???` et une copie très floutée de l’image
importée. Sans image compatible, un sceau générique est affiché. L’original privé reste protégé.
Retirer masque totalement l’archive côté joueur. Le brouillon reste disponible dans les deux cas.

Les descriptions publiques doivent contenir uniquement ce que les personnages ont appris.
Les notes privées peuvent contenir les secrets de campagne. Elles restent dans SQLite,
hors du dépôt et du site public. Le fichier `data/codex.json` sert seulement au premier import :
ne pas y ajouter de secrets ou essayer de l’utiliser pour modifier une base déjà initialisée.

Une information déjà révélée ne peut pas être effacée de la mémoire ou des copies des joueurs.
Les images précédemment présentes dans le dossier public `assets/` restent publiques.
Pour une nouvelle illustration privée, utiliser l’import de l’espace MJ.

## Source narrative

Seul Le Noyau est découvert au démarrage. L’histoire annexe centrée sur **Serge** n’est pas
une source automatique pour le codex joueur. Ajouter uniquement le lore principal validé
ou les informations découvertes pendant la campagne principale. Cette règle vaut aussi
pour les chroniques et tous les autres textes publics du site.
