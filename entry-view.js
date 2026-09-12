(function () {
  const escape = window.OutlayerCatalog.escapeHTML;
  window.outlayerEntryView = (entry, entriesById) => {
    const details = entry.details.map(text => `<li>${escape(text)}</li>`).join('');
    const tags = entry.tags.map(text => `<span>${escape(text)}</span>`).join('');
    const links = (entry.relations || []).map(id => entriesById.get(id)).filter(e => e && e.status === 'known')
      .map(e => `<button class="filter-button" type="button" data-related="${escape(e.id)}">${escape(e.title)} · ${escape(e.category)}</button>`).join('');
    return `<div class="dialog-hero status-known">
      <span class="dialog-symbol" aria-hidden="true">${escape(entry.symbol || '◇')}</span>
      <p class="dialog-category">${escape(entry.category)} · Connu</p>
      <h2 id="entryTitle">${escape(entry.title)}</h2><p class="dialog-subtitle">${escape(entry.subtitle)}</p>
    </div><div class="dialog-body">
      ${entry.image ? `<img class="dialog-image" src="${escape(entry.image)}" alt="Illustration de ${escape(entry.title)}" width="800" height="400" decoding="async">` : ''}
      <p class="dialog-summary">${escape(entry.summary || entry.teaser)}</p>
      ${details ? `<ul class="dialog-details">${details}</ul>` : ''}
      ${tags ? `<div class="dialog-tags">${tags}</div>` : ''}
      ${links ? `<section class="related-entries"><h3>Archives liées</h3><div class="filter-row">${links}</div></section>` : ''}
      <p class="dialog-note">Cette fiche contient uniquement des informations accessibles aux joueurs.</p>
    </div>`;
  };
})();
