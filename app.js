const entries = window.OUTLAYER_ENTRIES ?? [];
const categories = window.OUTLAYER_CATEGORIES ?? ["Tous"];

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
  discovered: { label: "Découvert", icon: "✦" },
  glimpsed: { label: "Entrevue", icon: "◐" },
  locked: { label: "Inconnu", icon: "◇" }
};

function normalize(value = "") {
  return value
    .toLocaleLowerCase("fr")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

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

    const haystack = normalize([
      entry.title,
      entry.subtitle,
      entry.teaser,
      entry.summary,
      ...(entry.tags || [])
    ].join(" "));

    const searchMatch = !query || haystack.includes(query);
    return categoryMatch && statusMatch && searchMatch;
  });
}

function cardTemplate(entry, index) {
  const meta = statusMeta[entry.status] ?? statusMeta.locked;
  const locked = entry.status === "locked";
  const glimpsed = entry.status === "glimpsed";
  const canOpen = !locked;

  return `
    <article
      class="codex-card status-${entry.status} reveal visible"
      data-entry-id="${entry.id}"
      style="--delay: ${Math.min(index * 35, 280)}ms"
    >
      <div class="card-visual ${locked ? "is-obscured" : ""} ${glimpsed ? "is-glimpsed" : ""}">
        <div class="visual-runes" aria-hidden="true">✦ · ◇ · ✧</div>
        <div class="entry-symbol" aria-hidden="true">${entry.symbol || "?"}</div>
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

function render() {
  const visibleEntries = filteredEntries();
  grid.innerHTML = visibleEntries.map(cardTemplate).join("");
  emptyState.hidden = visibleEntries.length !== 0;
  resultCount.textContent = `${visibleEntries.length} ${visibleEntries.length > 1 ? "entrées" : "entrée"}`;

  grid.querySelectorAll(".entry-open:not([disabled])").forEach((button) => {
    button.addEventListener("click", (event) => {
      const card = event.currentTarget.closest("[data-entry-id]");
      openEntry(card.dataset.entryId);
    });
  });

  grid.querySelectorAll(".codex-card:not(.status-locked)").forEach((card) => {
    card.addEventListener("dblclick", () => openEntry(card.dataset.entryId));
  });
}

function openEntry(id) {
  const entry = entries.find((item) => item.id === id);
  if (!entry || entry.status === "locked") return;

  const meta = statusMeta[entry.status];
  const details = (entry.details || [])
    .map((detail) => `<li>${detail}</li>`)
    .join("");

  const tags = (entry.tags || [])
    .map((tag) => `<span>${tag}</span>`)
    .join("");

  dialogContent.innerHTML = `
    <div class="dialog-hero status-${entry.status}">
      <span class="dialog-symbol" aria-hidden="true">${entry.symbol || "?"}</span>
      <p class="dialog-category">${entry.category} · ${meta.label}</p>
      <h2 id="entryTitle">${entry.title}</h2>
      <p class="dialog-subtitle">${entry.subtitle}</p>
    </div>
    <div class="dialog-body">
      <p class="dialog-summary">${entry.summary || entry.teaser}</p>
      ${details ? `<ul class="dialog-details">${details}</ul>` : ""}
      ${tags ? `<div class="dialog-tags">${tags}</div>` : ""}
      <p class="dialog-note">
        Cette fiche contient uniquement des informations accessibles aux joueurs.
      </p>
    </div>
  `;

  dialog.showModal();
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
buildProgress();
render();
function setupNavigationTracking() {
  const observer = new IntersectionObserver((records) => {
    records.forEach((record) => {
      if (record.isIntersecting) setCurrentNavigation(record.target.id);
    });
  }, { rootMargin: "-15% 0px -70% 0px" });
  document.querySelectorAll("main > section[id]").forEach((section) => observer.observe(section));
}

setupNavigationTracking();
