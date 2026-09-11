/*
  OUTLAYER — Données publiques du codex joueur

  État actuel de la campagne :
  les joueurs ne connaissent encore que LE NOYAU.

  Aucun détail de l'histoire annexe de Serge ne doit être utilisé ici comme source.
  Les entrées verrouillées ne doivent contenir aucun secret réel.
*/

window.OUTLAYER_ENTRIES = [
  {
    id: "noyau",
    category: "Lieux",
    status: "known",
    title: "Le Noyau",
    subtitle: "Le monde connu",
    symbol: "◉",
    teaser: "Le seul territoire du monde qu'il est actuellement possible de consulter dans le codex.",
    summary: "Le Noyau constitue le cadre du monde connu des personnages au début de leur aventure.",
    details: [
      "Les connaissances disponibles sont volontairement limitées à ce que les personnages savent réellement.",
      "Les autres régions, personnes, factions, créatures et artefacts seront révélés au fil de la campagne."
    ],
    tags: ["monde", "origine", "géographie"],
    discoveredLabel: "Connu"
  },
  {
    id: "unknown-place-01",
    category: "Lieux",
    status: "locked",
    title: "???",
    subtitle: "Lieu non découvert",
    symbol: "?",
    teaser: "Au-delà du Noyau, le monde demeure encore obscur.",
    summary: "",
    details: [],
    tags: ["inconnu"],
    discoveredLabel: "Inconnu"
  },
  {
    id: "unknown-person-01",
    category: "Personnages",
    status: "locked",
    title: "???",
    subtitle: "Identité inconnue",
    symbol: "?",
    teaser: "Une rencontre future attend encore d'être consignée.",
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
    teaser: "Aucun nom n'est encore accessible dans cette archive.",
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
    teaser: "Le bestiaire reste scellé jusqu'à la première véritable découverte.",
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
    teaser: "Aucun artefact n'a encore été identifié.",
    summary: "",
    details: [],
    tags: ["inconnu"],
    discoveredLabel: "Inconnu"
  },
  {
    id: "unknown-divinity-01",
    category: "Divinités",
    status: "locked",
    title: "???",
    subtitle: "Archive inaccessible",
    symbol: "?",
    teaser: "Cette partie du codex n'est pas encore accessible aux joueurs.",
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
