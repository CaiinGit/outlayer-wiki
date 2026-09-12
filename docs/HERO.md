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
- `assets/outlayer-logo-original.png` : image transparente fournie par l’utilisateur,
  1024 × 397 pixels, conservée à l’identique et affichée dans la navigation.
- `assets/outlayer-logo-hero.svg` : composition du hero, avec la rose des vents existante
  et cette même image intégrée, sans modification des lettres, des couleurs ou du relief.
- Les anciennes variantes `outlayer-lifecraft-*` restent archivées mais ne sont plus chargées.

Le logo affiché est exactement le visuel approuvé par l’utilisateur. Son relief doré
est déjà présent dans l’image : aucun filtre, moteur 3D ou chargement de police
n’est nécessaire. Le SVG conserve les proportions du PNG et ne contient aucun filtre.
Les optimisations du défilement restent inchangées.

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

Le hero reste servi comme des fichiers statiques. Le codex utilise désormais l’API
et la base SQLite de l’espace MJ : suivre [le guide d’installation](ADMIN.md) pour
reconstruire les services Docker et configurer le compte privé.

Après correction des ralentissements du hero : sur un parcours identique de 40 positions
de défilement à 1920 × 1080 et densité 2, les appels applicatifs à `requestAnimationFrame`
passent de 40 à 0, les inscriptions à l’événement `scroll` de 1 à 0, et le filtre calculé
du fond devient `none`. Aucun calcul de disposition n’est déclenché pendant ce parcours.
Ces mesures locales ne constituent pas une mesure des FPS sur la machine du joueur.
Les cas mouvement réduit, tablette tactile et absence de prise en charge de la timeline
ont également été vérifiés.
