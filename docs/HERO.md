# Accueil Outlayer

L’accueil reprend la composition de la maquette fournie : navigation sombre et dorée,
paysage fantasy, emblème central, sous-titre, ornements et accès au codex en bas.
Les liens Factions, Bestiaire, Lieux et Objets sélectionnent la catégorie correspondante
et réinitialisent la recherche et l’état pour éviter de masquer leurs résultats.
La recherche, les fiches, la progression, les chroniques et la présentation du codex
restent accessibles. Seul Le Noyau est actuellement connu ; les six autres archives
restent scellées.

## Visuels

- `assets/outlayer-landscape.webp` : paysage de 1983 × 793 pixels.
- `assets/outlayer-landscape-mobile.webp` : variante légère de 1100 pixels de large,
  chargée seule sur les écrans de 720 pixels ou moins.
- `assets/outlayer-crest.svg` : source de l’emblème, utilisant les tracés du logo
  Outlayer existant, une rose des vents géométrique et un relief doré.
- `assets/outlayer-crest.webp` : rendu transparent de cet emblème, 1600 × 800 pixels.
  Le relief est calculé à l’export, sans filtre d’éclairage à exécuter dans la page.
- `assets/outlayer-logo.svg` : logo existant conservé dans la navigation.

Le paysage a été reconstitué avec l’outil intégré de génération d’images à partir de
la maquette de l’utilisateur. Instruction de production : retirer la navigation,
les logos, la rose des vents centrale, les textes et ornements d’interface ; reconstruire
le décor en conservant l’arbre et la bannière à gauche, l’île flottante, la vallée,
le château sur les falaises, les cascades et la grande lune ; garder une illustration
fantasy douce aux tons pierre, charbon et or ancien, sans texte ni nouvelle interface.

## Défilement

Le flou CSS est constant et porté par un sous-élément du décor. Seul le conteneur de
ce décor est déplacé avec `transform`, au maximum de 58 pixels. Le logo et les textes
défilent normalement. Il n’y a ni boucle d’animation permanente ni lecture de géométrie
à chaque frame : les dimensions sont mémorisées lors des redimensionnements.

L’écoute du scroll et `will-change` sont activés uniquement lorsque le hero est visible
et la page active. Le parallaxe est désactivé sur petit écran, avec un pointeur tactile
et lorsque `prefers-reduced-motion: reduce` est demandé. Les hauteurs réelles des sections
sont conservées pour éviter les sauts d’ancre liés aux hauteurs estimées.

## Vérification

Contrôles effectués dans Chrome : chargement des images et absence d’erreurs JavaScript,
7 entrées dont 1 connue et 6 verrouillées, recherche avec accents, résultat vide,
filtres de catégorie et d’état, ouverture/fermeture du Noyau, menu mobile et touche Échap,
ancres sous la navigation, arrêt du parallaxe hors écran, mouvement réduit et chargement
du seul fond mobile. Affichages vérifiés entre 320 et 1983 pixels de large, en portrait
et paysage, ainsi qu’avec le texte agrandi à 200 %.

Le site reste statique : aucune installation ou compilation supplémentaire.
Sur le serveur existant, `git pull` puis un rechargement forcé du navigateur appliquent
la mise à jour.
