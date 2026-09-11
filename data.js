/*
  OUTLAYER — Données publiques du codex joueur

  IMPORTANT — SOURCES :
  Ce wiki ne reprend PAS les informations propres à l'histoire annexe de Serge.
  Cette histoire peut développer l'univers, mais son contenu narratif, ses scènes,
  ses rencontres et ses détails spécifiques ne sont pas une source pour le codex joueur.

  N'ajouter ici que :
  1. le lore principal d'Outlayer validé pour les joueurs ;
  2. les informations réellement apprises pendant la campagne ;
  3. des teasers sans spoiler pour les éléments non découverts.

  RÈGLE DE SÉCURITÉ :
  Ne jamais ajouter ici un vrai secret MJ en le "cachant" avec du CSS ou du JS.

  États :
  - locked      : inconnu, teaser minimal
  - glimpsed    : entrevu, quelques indices
  - discovered  : découvert, fiche accessible
  - known       : connu, fiche plus complète
*/

window.OUTLAYER_ENTRIES = [
  {
    id: "noyau",
    category: "Lieux",
    status: "known",
    title: "Le Noyau",
    subtitle: "Le monde connu",
    symbol: "◉",
    teaser: "Le monde dans lequel prennent place les chroniques d’Outlayer.",
    summary: "Le Noyau est le cadre principal du monde connu des personnages.",
    details: [
      "Ses terres rassemblent différents peuples, cités, croyances et territoires.",
      "Le codex n’affiche que les régions dont l’existence est connue des joueurs."
    ],
    tags: ["monde", "géographie"],
    discoveredLabel: "Connu"
  },
  {
    id: "valor",
    category: "Lieux",
    status: "known",
    title: "Valor",
    subtitle: "Capitale du Noyau",
    symbol: "V",
    teaser: "Une capitale majeure du monde connu.",
    summary: "Valor est une capitale importante du Noyau et un repère connu dans l’univers d’Outlayer.",
    details: [],
    tags: ["capitale", "cité"],
    discoveredLabel: "Connu"
  },
  {
    id: "garde-des-ombres",
    category: "Factions",
    status: "known",
    title: "Garde des Ombres",
    subtitle: "Ordre combattant les Engeances",
    symbol: "G",
    teaser: "Un ordre ancien associé à la lutte contre les Engeances et aux périodes d’Enclin.",
    summary: "La Garde des Ombres est un ordre voué à la lutte contre les Engeances.",
    details: [
      "Son rôle devient particulièrement important lorsque survient un Enclin."
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
    teaser: "Une divinité majeure associée au Soleil et à une histoire ancienne du monde.",
    summary: "Solara est connue comme la Déesse du Soleil.",
    details: [
      "Son nom est lié à la Guerre Solaire dans l’histoire connue d’Outlayer."
    ],
    tags: ["soleil", "déesse", "guerre solaire"],
    discoveredLabel: "Connu"
  },
  {
    id: "engeances",
    category: "Bestiaire",
    status: "known",
    title: "Engeances",
    subtitle: "Créatures corrompues",
    symbol: "✧",
    teaser: "Des créatures corrompues dont les hordes sont associées aux Enclins.",
    summary: "Les Engeances constituent l’une des grandes menaces connues du monde.",
    details: [
      "Lors d’un Enclin, elles peuvent se rassembler en hordes sous la menace d’un Archidémon."
    ],
    tags: ["créature", "corruption", "enclin"],
    discoveredLabel: "Connu"
  },
  {
    id: "lanvara",
    category: "Lieux",
    status: "known",
    title: "Lanvara",
    subtitle: "Région de falaises",
    symbol: "Λ",
    teaser: "Une région du monde connue pour ses falaises.",
    summary: "La Lanvara fait partie de la géographie connue d’Outlayer.",
    details: [],
    tags: ["falaises", "région"],
    discoveredLabel: "Connu"
  },

  /* Teasers sûrs : aucune information secrète réelle n’est présente ici. */
  {
    id: "unknown-person-01",
    category: "Personnages",
    status: "locked",
    title: "???",
    subtitle: "Identité inconnue",
    symbol: "?",
    teaser: "Une présence n’a pas encore été identifiée.",
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
    teaser: "Une créature reste hors de portée des connaissances du groupe.",
    summary: "",
    details: [],
    tags: ["inconnu"],
    discoveredLabel: "Inconnu"
  },
  {
    id: "unknown-artifact-01",
    category: "Artefacts",
    status: "locked",
    title: "???",
    subtitle: "Artefact inconnu",
    symbol: "◇",
    teaser: "Une archive scellée attend encore d’être révélée.",
    summary: "",
    details: [],
    tags: ["inconnu"],
    discoveredLabel: "Inconnu"
  },
  {
    id: "unknown-place-01",
    category: "Lieux",
    status: "locked",
    title: "???",
    subtitle: "Lieu non découvert",
    symbol: "?",
    teaser: "Une partie du monde reste encore inconnue.",
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
    subtitle: "Faction inconnue",
    symbol: "?",
    teaser: "Un groupe demeure absent des connaissances actuelles.",
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
