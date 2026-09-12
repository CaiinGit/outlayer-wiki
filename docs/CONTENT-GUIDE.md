# Gérer les archives d’Outlayer

Le contenu se modifie dans `data/codex.json`. Seul **Le Noyau** est actuellement connu.
Le fichier contient `version: 1` et la liste `entries`. Les champs sont obligatoires ;
les listes peuvent être vides et l’image peut valoir `null`.

| Champ | Usage |
| --- | --- |
| `id` | Identifiant unique stable : minuscules, chiffres et tirets |
| `type` | Lieux, Personnages, Factions, Bestiaire, Artefacts, Utilitaires ou Divinités |
| `name` | Nom ; `???` si inconnue |
| `description` | Description publique de la fiche |
| `known` | `true` ouvre la fiche ; `false` affiche une archive scellée |
| `visible` | `false` retire la fiche de la grille, de la recherche et de la progression |
| `image` | Chemin local sous `assets/` ou `null` |
| `subtitle` | Précision sous le nom |
| `teaser` | Texte public affiché sur la carte |
| `symbol` | Symbole utilisé sans image |
| `details` | Liste de paragraphes complémentaires |
| `tags` | Mots-clés utilisés par la recherche |

Les monstres et autres créatures vont dans **Bestiaire**. Les règles et aides de jeu
vont dans **Utilitaires**. Les catégories vides restent disponibles comme filtres.

## Exemple d’archive inconnue

```json
{
  "id": "unknown-person-02",
  "type": "Personnages",
  "name": "???",
  "description": "",
  "known": false,
  "visible": true,
  "image": "assets/codex/sealed.svg",
  "subtitle": "Identité inconnue",
  "teaser": "Une rencontre attend encore d’être consignée.",
  "symbol": "?",
  "details": [],
  "tags": ["inconnu"]
}
```

Pour révéler cette fiche, conserver son identifiant, passer `known` à `true`, puis
remplir son nom, sa description et les seules informations apprises pendant la campagne.
Une image connue s’affiche nette. Une archive inconnue utilise toujours le sceau générique
assombri, sans calcul de flou dans le navigateur. Le visuel du Noyau est un emblème
abstrait décoratif, pas une représentation géographique canonique.

Pour ajouter une image, déposer le fichier dans `assets/codex/`, puis renseigner son chemin.
Préférer un WebP de 800 × 400 pixels sous 150 Ko ; les autres proportions sont recadrées
au centre. Les images ne sont pas automatiquement compressées à l’ajout.
Les SVG doivent être des fichiers de confiance. N’utiliser que des visuels publics.

## Publication et confidentialité

Le dépôt et son catalogue sont publics. `known` et `visible` contrôlent la présentation,
pas l’accès au fichier source. Aucun secret MJ, nom réel inconnu, image secrète ou brouillon
confidentiel ne doit y être ajouté, même avec `visible: false`. Les sous-titres et teasers
doivent eux aussi rester anonymes. Une entrée invalide provoque un message d’erreur
au lieu d’un affichage partiel du catalogue.

Les notes privées restent dans une source privée distincte. L’histoire annexe de **Serge**
n’est pas une source du wiki joueur. Cette règle vaut aussi pour les chroniques du site.

Vérification avec Node.js (aucune dépendance) :

```bash
node --test tests/catalog.test.cjs
```

Le test de progression décrit le début de campagne : mettre à jour son nombre et sa liste
de découvertes lors d’une révélation intentionnelle. Puis publier sur GitHub.
Sur le serveur :

```bash
cd /srv/docker/outlayer-wiki
git pull
```

Recharger avec Ctrl + F5. Aucun redémarrage de Nginx ni changement Docker n’est nécessaire.
