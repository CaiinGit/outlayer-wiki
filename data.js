/*
  OUTLAYER — Données publiques du codex joueur

  RÈGLE DE SÉCURITÉ :
  Ne jamais ajouter ici un vrai secret MJ en le "cachant" avec du CSS ou du JS.
  Une entrée locked/glimpsed doit seulement contenir ce que les joueurs peuvent
  réellement voir ou savoir à ce stade de la campagne.

  États :
  - locked      : inconnu, teaser minimal
  - glimpsed    : entrevu, quelques indices
  - discovered  : découvert, fiche accessible
  - known       : connu, fiche plus complète
*/

window.OUTLAYER_ENTRIES = [
  {
    id: "valor",
    category: "Lieux",
    status: "known",
    title: "Valor",
    subtitle: "La capitale blanche",
    symbol: "V",
    teaser: "Une cité claire aux grandes avenues, dominée par le Château Blanc.",
    summary: "Valor est l’une des cités les plus connues du Noyau. Ses avenues, ses ateliers et ses marchés attirent voyageurs, artisans et membres de la Garde des Ombres.",
    details: [
      "La ville est reconnaissable à son architecture claire et à la silhouette du Château Blanc.",
      "Ses rues commerçantes accueillent de nombreux ateliers, tandis que ses grandes places servent de points de rassemblement.",
      "La présence de la Garde des Ombres y est familière."
    ],
    tags: ["capitale", "cité", "garde des ombres"],
    discoveredLabel: "Connu"
  },
  {
    id: "garde-des-ombres",
    category: "Factions",
    status: "known",
    title: "Garde des Ombres",
    subtitle: "Ordre voué à la lutte contre les Engeances",
    symbol: "G",
    teaser: "Un ordre ancien dont le nom accompagne chaque récit d’Enclin.",
    summary: "La Garde des Ombres combat les Engeances et intervient lorsque leur menace dépasse les capacités des forces ordinaires.",
    details: [
      "Ses membres bénéficient de privilèges particuliers mais acceptent en retour des risques considérables.",
      "Le Droit de Conscription permet à la Garde de recruter lorsqu’elle l’estime nécessaire.",
      "Blessures, mutilations et mort font partie des risques ouvertement associés à l’engagement."
    ],
    tags: ["ordre", "engeance", "enclin"],
    discoveredLabel: "Connu"
  },
  {
    id: "solara",
    category: "Divinités",
    status: "known",
    title: "Solara",
    subtitle: "Déesse du Soleil",
    symbol: "☼",
    teaser: "Son nom appartient aux prières, aux récits anciens et à la mémoire de la Guerre Solaire.",
    summary: "Solara est associée au Soleil et occupe une place majeure dans les traditions et les récits du monde.",
    details: [
      "Son culte et son influence appartiennent à l’histoire connue de nombreuses populations.",
      "De nombreux récits anciens évoquent ses dons, ses symboles ou les traces laissées par son intervention."
    ],
    tags: ["soleil", "déesse", "religion"],
    discoveredLabel: "Connu"
  },
  {
    id: "engeances",
    category: "Bestiaire",
    status: "known",
    title: "Engeances",
    subtitle: "Créatures corrompues",
    symbol: "✧",
    teaser: "Une menace dont les apparitions accompagnent les heures les plus sombres.",
    summary: "Les Engeances sont des créatures corrompues connues pour se rassembler en hordes lors des Enclins.",
    details: [
      "Leur nombre et leur violence en font une menace militaire autant qu’une terreur populaire.",
      "Les récits d’Enclin associent presque toujours leur progression à l’intervention de la Garde des Ombres."
    ],
    tags: ["créature", "corruption", "enclin"],
    discoveredLabel: "Connu"
  },
  {
    id: "lanvara",
    category: "Lieux",
    status: "discovered",
    title: "Lanvara",
    subtitle: "Les falaises au-delà de Valor",
    symbol: "Λ",
    teaser: "Un territoire dont le nom marque déjà une frontière dans les récits.",
    summary: "La Lanvara désigne une région de falaises et d’horizons abrupts, connue des voyageurs quittant les terres familières de Valor.",
    details: [
      "Ses reliefs imposants participent à sa réputation.",
      "Pour beaucoup, franchir la Lanvara revient à quitter le confort des routes connues."
    ],
    tags: ["falaises", "région", "voyage"],
    discoveredLabel: "Découvert"
  },
  {
    id: "reminthor",
    category: "Personnages",
    status: "discovered",
    title: "Reminthor",
    subtitle: "Le dragon azur",
    symbol: "R",
    teaser: "Un immense dragon bleu azur dont le retour suffit à faire taire une place entière.",
    summary: "Reminthor est un dragon ancien, reconnaissable à ses écailles bleu azur et à leurs reflets d’or.",
    details: [
      "Sa présence inspire un respect presque immédiat parmi ceux qui le reconnaissent.",
      "Les récits publics le présentent comme un ancien protecteur lié à l’histoire de Valor.",
      "Son existence est associée, dans la tradition, à un don de Solara."
    ],
    tags: ["dragon", "valor", "solara"],
    discoveredLabel: "Découvert"
  },

  /* Teasers sûrs : aucune information secrète réelle n’est présente ici. */
  {
    id: "unknown-person-01",
    category: "Personnages",
    status: "locked",
    title: "???",
    subtitle: "Identité inconnue",
    symbol: "?",
    teaser: "Une silhouette demeure absente des chroniques accessibles.",
    summary: "",
    details: [],
    tags: ["inconnu"],
    discoveredLabel: "Inconnu"
  },
  {
    id: "unknown-creature-01",
    category: "Bestiaire",
    status: "locked",
    title: "???",
    subtitle: "Créature inconnue",
    symbol: "?",
    teaser: "Quelque chose existe au-delà de ce que le codex peut encore nommer.",
    summary: "",
    details: [],
    tags: ["inconnu"],
    discoveredLabel: "Inconnu"
  },
  {
    id: "unknown-artifact-01",
    category: "Artefacts",
    status: "glimpsed",
    title: "???",
    subtitle: "Objet entrevu",
    symbol: "◇",
    teaser: "Un objet a été aperçu, mais sa nature reste indéterminée.",
    summary: "Le groupe sait seulement qu’un objet d’importance existe. Rien de plus n’est confirmé.",
    details: [],
    tags: ["objet", "mystère"],
    discoveredLabel: "Entrevue"
  },
  {
    id: "unknown-place-01",
    category: "Lieux",
    status: "locked",
    title: "???",
    subtitle: "Lieu non découvert",
    symbol: "?",
    teaser: "Une destination existe sur les marges du savoir accessible.",
    summary: "",
    details: [],
    tags: ["inconnu"],
    discoveredLabel: "Inconnu"
  },
  {
    id: "unknown-faction-01",
    category: "Factions",
    status: "locked",
    title: "???",
    subtitle: "Affiliation inconnue",
    symbol: "?",
    teaser: "Un emblème n’a pas encore livré son nom.",
    summary: "",
    details: [],
    tags: ["inconnu"],
    discoveredLabel: "Inconnu"
  }
];

window.OUTLAYER_CATEGORIES = [
  "Tous",
  "Lieux",
  "Personnages",
  "Factions",
  "Bestiaire",
  "Artefacts",
  "Divinités"
];
