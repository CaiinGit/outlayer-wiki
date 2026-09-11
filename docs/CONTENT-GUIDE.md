# Guide de contenu — Outlayer Wiki

Ce dépôt est public et destiné aux joueurs.

## Règle absolue

Un secret MJ ne doit jamais être ajouté au dépôt public puis masqué avec du CSS, du JavaScript, un flou, une classe `hidden` ou un mot de passe côté navigateur.

Si l'information existe dans le dépôt, un joueur peut potentiellement la lire.

## États des fiches

Chaque entrée de `data.js` possède un champ `status`.

### `locked`

Le joueur sait uniquement qu'une entrée existe.

Exemple :

```js
{
  id: "unknown-person-02",
  category: "Personnages",
  status: "locked",
  title: "???",
  subtitle: "Identité inconnue",
  symbol: "?",
  teaser: "Une silhouette demeure inconnue.",
  summary: "",
  details: [],
  tags: ["inconnu"],
  discoveredLabel: "Inconnu"
}
```

Ne jamais mettre le vrai nom, la vraie image ou la vraie biographie dans cette entrée.

### `glimpsed`

La chose a été entrevue. Quelques indices non sensibles peuvent être affichés.

### `discovered`

L'identité ou la nature de l'entrée est connue. Une fiche peut être consultée.

### `known`

La fiche contient une connaissance relativement complète du point de vue des personnages.

## Débloquer une fiche

Lorsqu'une découverte a lieu pendant la campagne :

1. Modifier l'entrée concernée dans `data.js`.
2. Remplacer `???` par le nom révélé.
3. Passer le statut à `discovered` ou `known`.
4. Ajouter uniquement les informations effectivement apprises en jeu.
5. Commit et push.
6. Sur `serverdecaiin`, exécuter `git pull`.

Le site sera mis à jour sans redémarrer Nginx puisque les fichiers sont montés directement dans le conteneur.

## Contenu MJ

Les notes MJ, vérités du lore, statistiques secrètes, événements futurs et solutions d'énigmes doivent rester dans une source privée distincte.


## Sources narratives exclues du wiki

L'histoire annexe centrée sur **Serge** n'est pas une source de contenu pour le wiki joueur.

Elle peut développer ou illustrer le lore, mais ses scènes, dialogues, rencontres, descriptions narratives et informations propres à cette histoire ne doivent pas être transférés automatiquement dans le codex.

Pour ajouter une information au wiki, elle doit appartenir au lore principal validé ou avoir été découverte pendant la campagne principale.
