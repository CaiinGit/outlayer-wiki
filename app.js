const { readCatalog, escapeHTML: escape, normalize } = window.OutlayerCatalog;
let entries = [];
let entriesById = new Map();
const categories = ["Tous", ...window.OutlayerCatalog.TYPES];
const PAGE_SIZE = 24;
let shownCount = PAGE_SIZE;
let catalogReady = false;
let catalogLoading = false;

const grid = document.getElementById("codexGrid");
const searchInput = document.getElementById("searchInput");
const categoryFilters = document.getElementById("categoryFilters");
const statusSelect = document.getElementById("statusSelect");
const resultCount = document.getElementById("resultCount");
const emptyState = document.getElementById("emptyState");
const progressGrid = document.getElementById("progressGrid");
const dialog = document.getElementById("entryDialog");
const dialogContent = document.getElementById("dialogContent");
const dialogClose = document.getElementById("dialogClose");
const menuToggle = document.querySelector(".menu-toggle");
const mainNav = document.querySelector(".main-nav");

let activeCategory = "Tous";

const statusMeta = {
  known: { label: "Connu", icon: "◆" },
  locked: { label: "Inconnu", icon: "◇" }
};


function buildCategoryFilters() {
  categoryFilters.innerHTML = "";
  categories.forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "filter-button";
    button.textContent = category;
    button.dataset.category = category;
    button.classList.toggle("active", category === activeCategory);
    button.setAttribute("aria-pressed", String(category === activeCategory));
    button.addEventListener("click", () => selectCategory(category));
    categoryFilters.appendChild(button);
  });
}

function selectCategory(category, reset = false) {
  if (!categories.includes(category)) return;
  activeCategory = category;
  if (reset) {
    searchInput.value = "";
    statusSelect.value = "all";
  }
  categoryFilters.querySelectorAll(".filter-button").forEach((button) => {
    const active = button.dataset.category === category;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  render();
  setCurrentNavigation("codex");
}

function setCurrentNavigation(section) {
  mainNav.querySelectorAll("a").forEach((link) => {
    const current = section === "codex"
      ? link.dataset.category === activeCategory
      : link.dataset.section === section;
    if (current) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });
}

function filteredEntries() {
  const query = normalize(searchInput.value.trim());
  const status = statusSelect.value;

  return entries.filter((entry) => {
    const categoryMatch = activeCategory === "Tous" || entry.category === activeCategory;
    const statusMatch = status === "all" || entry.status === status;

    const searchMatch = !query || entry.searchText.includes(query);
    return categoryMatch && statusMatch && searchMatch;
  });
}

function cardTemplate(entry) {
  entry = { ...entry, ...Object.fromEntries(["id", "title", "subtitle", "teaser", "category", "symbol"].map(key => [key, escape(entry[key])])) };
  const meta = statusMeta[entry.status] ?? statusMeta.locked;
  const locked = entry.status === "locked";
  const canOpen = !locked;

  return `
    <article
      class="codex-card status-${entry.status} reveal visible"
      data-entry-id="${entry.id}"
    >
      <div class="card-visual ${locked ? "is-obscured" : ""}">
        ${entry.image ? `<img class="card-image" src="${escape(entry.image)}" alt="" width="800" height="400" loading="lazy" decoding="async">` : ""}
        <div class="visual-runes" aria-hidden="true">✦ · ◇ · ✧</div>
        ${locked || !entry.image ? `<div class="entry-symbol" aria-hidden="true">${entry.symbol || "?"}</div>` : ""}
        <span class="status-badge">${meta.icon} ${meta.label}</span>
      </div>

      <div class="card-content">
        <div class="card-meta">
          <span>${entry.category}</span>
          <span>#${entry.id.replace(/[^a-z0-9]/gi, "").slice(-6).toUpperCase()}</span>
        </div>
        <h3>${entry.title}</h3>
        <p class="card-subtitle">${entry.subtitle}</p>
        <p class="card-teaser">${entry.teaser}</p>

        <div class="card-footer">
          <span>${canOpen ? "Consulter l’archive" : "Archive scellée"}</span>
          <button
            type="button"
            class="entry-open"
            ${canOpen ? "" : "disabled"}
            aria-label="${canOpen ? "Ouvrir " + entry.title : "Archive verrouillée"}"
          >${canOpen ? "↗" : "⌁"}</button>
        </div>
      </div>
    </article>
  `;
}

function render(reset = true) {
  if (!catalogReady) return;
  if (reset) shownCount = PAGE_SIZE;
  const matches = filteredEntries();
  if (reset) grid.innerHTML = matches.slice(0, shownCount).map(cardTemplate).join("");
  else grid.insertAdjacentHTML("beforeend", matches.slice(grid.children.length, shownCount).map(cardTemplate).join(""));
  emptyState.hidden = matches.length !== 0;
  const count = Math.min(shownCount, matches.length);
  resultCount.textContent = count < matches.length ? count + " sur " + matches.length + " entrées" : matches.length + " " + (matches.length > 1 ? "entrées" : "entrée");
  document.getElementById("loadMore").hidden = count >= matches.length;
}

grid.addEventListener("click", event => {
  const button = event.target.closest(".entry-open:not([disabled])");
  if (button) openEntry(button.closest("[data-entry-id]").dataset.entryId);
});
grid.addEventListener("dblclick", event => {
  const card = event.target.closest(".codex-card:not(.status-locked)");
  if (card) openEntry(card.dataset.entryId);
});
document.getElementById("loadMore").addEventListener("click", () => {
  const previous = Math.min(shownCount, filteredEntries().length);
  shownCount += PAGE_SIZE;
  render(false);
  const next = grid.children[previous];
  if (next) { next.tabIndex = -1; next.focus({ preventScroll: true }); }
});
// Failed images leave the decorative background in place.
document.addEventListener("error", event => {
  if (event.target.matches?.(".card-image, .dialog-image")) event.target.hidden = true;
}, true);

async function loadCatalog() {
  if (catalogLoading) return;
  catalogLoading = true;
  document.getElementById("catalogError").hidden = true;
  grid.setAttribute("aria-busy", "true");
  resultCount.textContent = "Chargement des archives…";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const previewId = new URLSearchParams(location.search).get("preview");
    const endpoint = previewId ? "/api/admin/preview/" + encodeURIComponent(previewId) : "/api/catalog";
    const response = await fetch(endpoint, { cache: "no-store", signal: controller.signal });
    if (!response.ok) throw Error("Catalogue indisponible");
    entries = readCatalog(await response.json());
    entriesById = new Map(entries.map(entry => [entry.id, entry]));
    catalogReady = true;
    buildProgress();
    buildDiscoveries();
    render();
    if (previewId) openEntry(previewId);
  } catch {
    document.getElementById("catalogError").hidden = false;
    resultCount.textContent = "Archives indisponibles";
  } finally {
    clearTimeout(timeout);
    catalogLoading = false;
    grid.setAttribute("aria-busy", "false");
  }
}
document.getElementById("retryCatalog").addEventListener("click", loadCatalog);

function openEntry(id) {
  const entry = entriesById.get(id);
  if (!entry || entry.status !== "known") return;
  dialogContent.innerHTML = window.outlayerEntryView(entry, entriesById);
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
}
dialogContent.addEventListener("click", event => {
  const link = event.target.closest("[data-related]");
  if (link) { openEntry(link.dataset.related); dialogClose.focus({preventScroll: true}); }
});
function buildDiscoveries() {
  const recent = entries.filter(e => e.status === "known" && e.revealedAt)
    .sort((a, b) => Date.parse(b.revealedAt) - Date.parse(a.revealedAt)).slice(0, 5);
  const list = document.getElementById("recentDiscoveries");
  list.replaceChildren();
  document.getElementById("noDiscoveries").hidden = recent.length !== 0;
  for (const entry of recent) {
    const button = document.createElement("button");
    button.type = "button"; button.className = "discovery-link";
    const title = document.createElement("strong"); title.textContent = entry.title;
    const date = document.createElement("span");
    date.textContent = entry.category + " · " + new Date(entry.revealedAt).toLocaleDateString("fr-FR");
    button.append(title, date); button.addEventListener("click", () => openEntry(entry.id));
    list.append(button);
  }
}

function buildProgress() {
  progressGrid.innerHTML = "";

  const trackedCategories = categories.filter((category) => category !== "Tous");

  trackedCategories.forEach((category) => {
    const categoryEntries = entries.filter((entry) => entry.category === category);
    if (!categoryEntries.length) return;

    const unlocked = categoryEntries.filter((entry) => entry.status !== "locked").length;
    const ratio = Math.round((unlocked / categoryEntries.length) * 100);

    const card = document.createElement("article");
    card.className = "progress-card";
    card.innerHTML = `
      <div class="progress-card-head">
        <span>${category}</span>
        <strong>${unlocked}/${categoryEntries.length}</strong>
      </div>
      <div class="progress-track" aria-label="${ratio}% découvert">
        <span style="width:${ratio}%"></span>
      </div>
      <small>${ratio}% des archives révélées</small>
    `;
    progressGrid.appendChild(card);
  });

}

function closeMenu() {
  mainNav.classList.remove("open");
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "Ouvrir le menu");
}

searchInput.addEventListener("input", render);
statusSelect.addEventListener("change", render);

dialogClose.addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  const rect = dialog.getBoundingClientRect();
  const outside =
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom;

  if (outside) dialog.close();
});

menuToggle.addEventListener("click", () => {
  const open = mainNav.classList.toggle("open");
  menuToggle.setAttribute("aria-expanded", String(open));
  menuToggle.setAttribute("aria-label", open ? "Fermer le menu" : "Ouvrir le menu");
});

document.querySelectorAll("a[data-category]").forEach((link) => {
  link.addEventListener("click", () => selectCategory(link.dataset.category, true));
});

document.querySelectorAll('.topbar a, .parallax-cta').forEach((link) => {
  link.addEventListener("click", () => {
    closeMenu();
    if (link.dataset.section) setCurrentNavigation(link.dataset.section);
  });
});

document.querySelector(".nav-search").addEventListener("click", () => {
  selectCategory("Tous", true);
  searchInput.focus({ preventScroll: true });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && mainNav.classList.contains("open")) {
    closeMenu();
    menuToggle.focus();
  }
});
document.addEventListener("click", (event) => {
  if (!event.target.closest(".topbar")) closeMenu();
});
document.querySelector(".topbar").addEventListener("focusout", (event) => {
  if (!event.currentTarget.contains(event.relatedTarget)) closeMenu();
});
window.matchMedia("(max-width: 1080px)").addEventListener("change", closeMenu);

// Account for a taller navigation bar when users enlarge their text.
new ResizeObserver(([record]) => {
  const height = record.borderBoxSize[0]?.blockSize ?? record.target.getBoundingClientRect().height;
  document.documentElement.style.setProperty("--header-size", `${height}px`);
}).observe(document.querySelector(".topbar"));

document.getElementById("year").textContent = new Date().getFullYear();

buildCategoryFilters();
loadCatalog();
function setupNavigationTracking() {
  const observer = new IntersectionObserver((records) => {
    records.forEach((record) => {
      if (record.isIntersecting) setCurrentNavigation(record.target.id);
    });
  }, { rootMargin: "-15% 0px -70% 0px" });
  document.querySelectorAll("main > section[id]").forEach((section) => observer.observe(section));
}

setupNavigationTracking();
