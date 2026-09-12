(function (root) {
  "use strict";
  const TYPES = ["Lieux", "Personnages", "Factions", "Bestiaire", "Artefacts", "Utilitaires", "Divinités"];
  const UNKNOWN_IMAGE = "assets/codex/sealed.svg";
  const escapeHTML = (value) => String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const normalize = (value = "") => value.toLocaleLowerCase("fr").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  function readCatalog(data) {
    if (!data || data.version !== 1 || !Array.isArray(data.entries)) throw Error("Catalogue invalide");
    const ids = new Set();
    return data.entries.map(item => {
      if (!item || typeof item.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id) || ids.has(item.id)) throw Error("Identifiant invalide ou dupliqué");
      ids.add(item.id);
      if (!TYPES.includes(item.type) || typeof item.known !== "boolean" || typeof item.visible !== "boolean") throw Error("Type ou état invalide");
      for (const key of ["name", "description", "subtitle", "teaser", "symbol"]) {
        if (typeof item[key] !== "string") throw Error(`Champ texte invalide : ${key}`);
      }
      if (!item.name.trim()) throw Error("Nom manquant");
      for (const key of ["details", "tags"]) {
        if (!Array.isArray(item[key]) || item[key].some(v => typeof v !== "string")) throw Error(`Liste invalide : ${key}`);
      }
      if (item.image !== null && (typeof item.image !== "string" || !/^assets\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(?:webp|png|jpg|jpeg|avif|svg)$/.test(item.image))) throw Error("Image locale invalide");
      // Unknown records must be public placeholders, never unpublished lore.
      if (!item.known && (item.name !== "???" || item.description || item.details.length || item.tags.some(t => t !== "inconnu") || (item.image !== null && item.image !== UNKNOWN_IMAGE))) throw Error("Une archive inconnue doit rester anonyme");
      return {
        id: item.id, category: item.type, status: item.known ? "known" : "locked",
        title: item.name, subtitle: item.subtitle, teaser: item.teaser, summary: item.description,
        details: item.details, tags: item.tags, symbol: item.symbol,
        image: item.known ? item.image : UNKNOWN_IMAGE, visible: item.visible,
        searchText: normalize([item.name, item.type, item.subtitle, item.teaser, item.description, ...item.tags].join(" "))
      };
    }).filter(item => item.visible);
  }
  const api = { TYPES, UNKNOWN_IMAGE, escapeHTML, normalize, readCatalog };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.OutlayerCatalog = api;
})(globalThis);
