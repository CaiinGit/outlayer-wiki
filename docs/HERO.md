# Accueil Outlayer

L’accueil reprend la composition de la maquette fournie : navigation sombre et dorée,
paysage fantasy, emblème central, sous-titre, ornements et accès au codex en bas.
Les liens Factions, Bestiaire, Lieux et Objets sélectionnent la catégorie correspondante
et réinitialisent la recherche et l’état pour éviter de masquer leurs résultats.
La recherche, les fiches, la progression, les chroniques et la présentation du codex
restent accessibles. Seul Le Noyau est actuellement connu ; les six autres archives
restent scellées.

## Visuels

- `assets/outlayer-landscape-soft.webp` : décor flouté exporté, 1983 × 793 pixels.
- `assets/outlayer-landscape-mobile-soft.webp` : variante légère de 1100 pixels de large,
  chargée seule sur les écrans de 720 pixels ou moins.
- Les versions `outlayer-landscape.webp` et `outlayer-landscape-mobile.webp` sont
  conservées comme sources ; la page charge uniquement les versions `soft`.
- `assets/outlayer-lifecraft-crest.webp` : emblème transparent du hero, 1600 × 800 pixels.
- `assets/outlayer-lifecraft-nav.webp` : version du lettrage pour la navigation,
  520 × 163 pixels, sans rose des vents.
- `assets/outlayer-lifecraft-wordmark.webp` : lettrage 3D seul, transparent.
- `assets/outlayer-lifecraft-outline.svg` : tracés exacts des glyphes LifeCraft utilisés.
- `assets/outlayer-lifecraft-crest.svg` : composition source, avec le lettrage rendu
  et la rose des vents existante.

Le mot OUTLAYER utilise **LifeCraft_Font.ttf** (famille interne « LifeCraft », nom complet
« LifeCraftRegular »), par **Eliot Truelove**, téléchargée depuis
[la page de l’auteur sur DaFont](https://www.dafont.com/lifecraft.font), qui la présente
comme donationware. Le fichier de police n’est pas chargé par le site.

Les contours de la police ont été convertis en géométrie 3D : faces dorées légèrement
texturées, biseaux francs, tranche bronze et éclairage de studio. L’espacement a été
ajusté pour laisser de la place aux biseaux. La rose des vents garde ses tracés et
sa position d’origine. Le rendu et les ombres sont calculés une fois à l’export.
Le navigateur affiche uniquement les images WebP : aucun moteur 3D, shader, chargement
de police ou filtre de relief n’est ajouté à la page. Les optimisations du scroll
restent inchangées.

Le paysage a été reconstitué avec l’outil intégré de génération d’images à partir de
la maquette de l’utilisateur. Instruction de production : retirer la navigation,
les logos, la rose des vents centrale, les textes et ornements d’interface ; reconstruire
le décor en conservant l’arbre et la bannière à gauche, l’île flottante, la vallée,
le château sur les falaises, les cascades et la grande lune ; garder une illustration
fantasy douce aux tons pierre, charbon et or ancien, sans texte ni nouvelle interface.

## Défilement

Le décor flouté est exporté une fois à partir du rendu CSS existant. La page n’applique
plus de `filter: blur()` à une surface plein écran et n’utilise plus de pseudo-élément
intermédiaire pour le fond. Les fichiers affichés pèsent environ 85 Kio sur ordinateur
et 33 Kio sur mobile.

Le parallaxe utilise `animation-timeline` et la plage `exit` du hero : seul le fond est
déplacé de 0 à 32 pixels. Il n’y a aucun gestionnaire JavaScript de scroll, aucune boucle
`requestAnimationFrame` et aucune écriture de style JavaScript pendant le mouvement.
Le logo et les textes défilent normalement. Le navigateur prépare une seule couche
mobile via `will-change: transform` lorsque le parallaxe est applicable.

Le mouvement dépend uniquement de la position du défilement : il reste stable au repos
et après la sortie du hero. Le fond reste statique sur petit écran, sur écran tactile,
avec `prefers-reduced-motion: reduce` et sur les navigateurs ne prenant pas en charge
les animations liées au scroll. Les hauteurs réelles des sections sont conservées
pour éviter les sauts d’ancre liés aux hauteurs estimées.

Approche documentée par [Chrome for Developers](https://developer.chrome.com/blog/scroll-animation-performance-case-study/).

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

Après correction des ralentissements du hero : sur un parcours identique de 40 positions
de défilement à 1920 × 1080 et densité 2, les appels applicatifs à `requestAnimationFrame`
passent de 40 à 0, les inscriptions à l’événement `scroll` de 1 à 0, et le filtre calculé
du fond devient `none`. Aucun calcul de disposition n’est déclenché pendant ce parcours.
Ces mesures locales ne constituent pas une mesure des FPS sur la machine du joueur.
Les cas mouvement réduit, tablette tactile et absence de prise en charge de la timeline
ont également été vérifiés.
