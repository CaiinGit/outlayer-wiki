const { readCatalog, escapeHTML: escape, normalize } = window.OutlayerCatalog;
let entries = [];
let entriesById = new Map();
const categories = ["Tous", ...window.OutlayerCatalog.TYPES];
let pageNumber = 1, pageCount = 1, totalEntries = 0;
let catalogController, detailController, searchTimer, catalogSequence = 0, detailSequence = 0;
let progress = [], recentEntries = [];
const previewId = new URLSearchParams(location.search).get("preview");

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
        ${!entry.image || entry.image === window.OutlayerCatalog.UNKNOWN_IMAGE ? `<div class="entry-symbol" aria-hidden="true">${entry.symbol || "?"}</div>` : ""}
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

function render() { pageNumber = 1; loadCatalog(); }
function updatePager(loading = false) {
  document.getElementById("previousPage").disabled = loading || pageNumber <= 1;
  document.getElementById("nextPage").disabled = loading || pageNumber >= pageCount;
  document.getElementById("pageNumber").textContent = "Page " + pageNumber + " sur " + pageCount;
  document.getElementById("pagination").hidden = totalEntries === 0 || !!previewId;
}
function turnPage(direction) {
  pageNumber = Math.max(1, Math.min(pageCount, pageNumber + direction));
  loadCatalog(true);
}
document.getElementById("previousPage").addEventListener("click", () => turnPage(-1));
document.getElementById("nextPage").addEventListener("click", () => turnPage(1));
document.getElementById("sortSelect").addEventListener("change", render);
document.getElementById("resetFilters").addEventListener("click", () => {
  document.getElementById("sortSelect").value = "recent";
  selectCategory("Tous", true);
});

grid.addEventListener("click", event => {
  const button = event.target.closest(".entry-open:not([disabled])");
  if (button) openEntry(button.closest("[data-entry-id]").dataset.entryId);
});
grid.addEventListener("dblclick", event => {
  const card = event.target.closest(".codex-card:not(.status-locked)");
  if (card) openEntry(card.dataset.entryId);
});
// Failed images leave the decorative background in place.
document.addEventListener("error", event => {
  if (event.target.matches?.(".card-image, .dialog-image")) event.target.hidden = true;
}, true);

async function fetchJSON(url, signal) {
  const response = await fetch(url, {cache: "no-store", signal});
  if (!response.ok) throw Error("Archive indisponible");
  return response.json();
}
async function loadCatalog(moveFocus = false) {
  clearTimeout(searchTimer);
  catalogController?.abort();
  const controller = catalogController = new AbortController();
  const sequence = ++catalogSequence;
  const timer = setTimeout(() => controller.abort(), 15000);
  document.getElementById("catalogError").hidden = true;
  grid.setAttribute("aria-busy", "true");
  resultCount.textContent = "Recherche dans les archives…";
  updatePager(true);
  try {
    const params = new URLSearchParams({page: pageNumber, q: searchInput.value.trim(), state: statusSelect.value, sort: document.getElementById("sortSelect").value});
    if (activeCategory !== "Tous") params.set("type", activeCategory);
    let data;
    if (previewId) {
      const detail = await fetchJSON("/api/admin/preview/" + encodeURIComponent(previewId), controller.signal);
      data = {version:1, entries:[detail.entry], total:1, page:1, pages:1, progress:[], recent:[]};
    } else data = await fetchJSON("/api/catalog?" + params, controller.signal);
    if (sequence !== catalogSequence) return;
    entries = readCatalog(data);
    totalEntries = data.total; pageNumber = data.page; pageCount = data.pages;
    progress = data.progress; recentEntries = readCatalog({version:1, entries:data.recent});
    grid.innerHTML = entries.map(cardTemplate).join("");
    emptyState.hidden = totalEntries !== 0;
    resultCount.textContent = totalEntries ? ((pageNumber-1)*24+1) + "–" + ((pageNumber-1)*24+entries.length) + " sur " + totalEntries + " archives" : "Aucune archive";
    buildProgress(); buildDiscoveries();
    if (!previewId) {
      params.set("page", pageNumber);
      history.replaceState(null, "", "?" + params + location.hash);
    }
    if (moveFocus) { grid.tabIndex = -1; grid.focus({preventScroll:true}); grid.scrollIntoView({block:"start",behavior:"instant"}); }
    if (previewId && !dialog.open) openEntry(previewId);
  } catch (error) {
    if (sequence !== catalogSequence) return;
    grid.replaceChildren(); emptyState.hidden = true;
    document.getElementById("catalogError").hidden = false;
    resultCount.textContent = "Archives indisponibles · réessayez";
  } finally {
    clearTimeout(timer);
    if (sequence === catalogSequence) { grid.setAttribute("aria-busy", "false"); updatePager(); }
  }
}
document.getElementById("retryCatalog").addEventListener("click", () => loadCatalog());

async function openEntry(id) {
  detailController?.abort();
  const controller = detailController = new AbortController();
  const sequence = ++detailSequence;
  const timer = setTimeout(() => controller.abort(), 15000);
  dialogContent.innerHTML = '<div class="dialog-body"><h2 id="entryTitle">Ouverture de l’archive…</h2><p role="status">Chargement de la fiche</p></div>';
  if (!dialog.open) dialog.showModal();
  try {
    const endpoint = previewId === id ? "/api/admin/preview/" : "/api/entries/";
    const data = await fetchJSON(endpoint + encodeURIComponent(id), controller.signal);
    if (sequence !== detailSequence || !dialog.open) return;
    const documents = readCatalog({version:1, entries:[data.entry, ...data.related]});
    entriesById = new Map(documents.map(e => [e.id,e]));
    dialogContent.innerHTML = window.outlayerEntryView(entriesById.get(id), entriesById);
    dialog.scrollTop = 0;
  } catch (error) {
    if (sequence !== detailSequence || !dialog.open) return;
    dialogContent.innerHTML = '<div class="dialog-body"><h2 id="entryTitle">Archive indisponible</h2><p>Cette fiche ne peut pas être ouverte pour le moment.</p></div>';
    const retry = document.createElement("button"); retry.type = "button"; retry.className = "filter-button";
    retry.textContent = "Réessayer"; retry.addEventListener("click", () => openEntry(id)); dialogContent.firstChild.append(retry);
  } finally { clearTimeout(timer); }
}
dialog.addEventListener("close", () => { detailSequence++; detailController?.abort(); entriesById.clear(); dialogContent.replaceChildren(); });
dialogContent.addEventListener("click", event => {
  const link = event.target.closest("[data-related]");
  if (link) { openEntry(link.dataset.related); dialogClose.focus({preventScroll: true}); }
});
function buildDiscoveries() {
  const recent = recentEntries;
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
    const stats = progress.find(item => item.category === category);
    if (!stats) return;
    const unlocked = stats.known;
    const ratio = Math.round(unlocked / stats.total * 100);

    const card = document.createElement("article");
    card.className = "progress-card";
    card.innerHTML = `
      <div class="progress-card-head">
        <span>${category}</span>
        <strong>${unlocked}/${stats.total}</strong>
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

searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer); catalogSequence++; catalogController?.abort();
  searchTimer = setTimeout(render, 250);
});
statusSelect.addEventListener("change", render);

dialogClose.addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target !== dialog) return;
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

const initialParams = new URLSearchParams(location.search);
searchInput.value = (initialParams.get("q") || "").slice(0, 200);
activeCategory = categories.includes(initialParams.get("type")) ? initialParams.get("type") : "Tous";
statusSelect.value = ["all","known","locked"].includes(initialParams.get("state")) ? initialParams.get("state") : "all";
document.getElementById("sortSelect").value = ["recent","name","oldest"].includes(initialParams.get("sort")) ? initialParams.get("sort") : "recent";
pageNumber = Math.max(1, Number.parseInt(initialParams.get("page"),10) || 1);
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
