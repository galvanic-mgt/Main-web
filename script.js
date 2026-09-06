const projects = Array.isArray(window.portfolioProjects) ? window.portfolioProjects : [];
const categories = Array.isArray(window.portfolioCategories) ? window.portfolioCategories : [];
let motionObserver;

const moleBoard = document.getElementById("moleBoard");
if (moleBoard) {
  const scoreEl = document.getElementById("moleScore");
  const timerEl = document.getElementById("moleTimer");
  const streakEl = document.getElementById("moleStreak");
  const startButton = document.getElementById("startMoleGame");
  const playerName = document.getElementById("playerName");
  const leaderboardList = document.getElementById("leaderboardList");
  const clearLeaderboard = document.getElementById("clearLeaderboard");
  const leaderboardKey = "galvanicWhackLeaderboard";
  const roundSeconds = 25;
  const holes = [];
  const activeMoles = new Map();
  const timers = new Set();
  let score = 0;
  let streak = 0;
  let timeLeft = roundSeconds;
  let playing = false;
  let popTimer;
  let roundTimer;

  for (let index = 0; index < 9; index += 1) {
    const hole = document.createElement("button");
    hole.className = "mole-hole";
    hole.type = "button";
    hole.setAttribute("aria-label", `Whack hole ${index + 1}`);
    hole.innerHTML = '<span class="mole">G</span>';
    moleBoard.appendChild(hole);
    holes.push(hole);
  }

  function leaderboard() {
    try {
      return JSON.parse(localStorage.getItem(leaderboardKey)) || [];
    } catch {
      return [];
    }
  }

  function saveLeaderboard(rows) {
    localStorage.setItem(leaderboardKey, JSON.stringify(rows.slice(0, 5)));
  }

  function renderLeaderboard() {
    const rows = leaderboard();
    leaderboardList.innerHTML = rows.length
      ? rows.map((row) => `<li><strong>${row.name}</strong> ${row.score}</li>`).join("")
      : "<li>No scores yet. Be first.</li>";
  }

  function updateMoleStats() {
    scoreEl.textContent = score;
    timerEl.textContent = timeLeft;
    streakEl.textContent = streak;
  }

  function trackTimer(timer) {
    timers.add(timer);
    return timer;
  }

  function clearTrackedTimers() {
    timers.forEach((timer) => window.clearTimeout(timer));
    timers.clear();
  }

  function setButtonLabel() {
    startButton.innerHTML = '<span aria-hidden="true">&#9658;</span> Start round';
  }

  function burst(hole, text, bad = false) {
    const marker = document.createElement("span");
    marker.className = `mole-burst ${bad ? "bad" : ""}`;
    marker.textContent = text;
    marker.style.left = `${hole.offsetLeft + hole.offsetWidth / 2}px`;
    marker.style.top = `${hole.offsetTop + hole.offsetHeight * 0.45}px`;
    moleBoard.appendChild(marker);
    window.setTimeout(() => marker.remove(), 650);
  }

  function shakeCabinet() {
    const cabinet = moleBoard.closest(".mole-cabinet");
    cabinet?.classList.remove("is-shaking");
    window.setTimeout(() => cabinet?.classList.add("is-shaking"), 0);
    window.setTimeout(() => cabinet?.classList.remove("is-shaking"), 220);
  }

  function clearHole(index) {
    const hole = holes[index];
    if (!hole) return;
    const active = activeMoles.get(index);
    if (active?.timer) window.clearTimeout(active.timer);
    activeMoles.delete(index);
    const mole = hole.querySelector(".mole");
    if (mole) mole.textContent = "G";
    hole.classList.remove("is-up", "is-bonus", "is-decoy", "is-hit", "is-miss");
  }

  function hideMoles(resetStreak = false) {
    [...activeMoles.keys()].forEach(clearHole);
    if (resetStreak) streak = 0;
  }

  function difficulty() {
    if (score > 70 || timeLeft < 8) return 4;
    if (score > 36 || timeLeft < 14) return 3;
    if (score > 14 || timeLeft < 20) return 2;
    return 1;
  }

  function chooseType() {
    const level = difficulty();
    const roll = Math.random();
    if (roll < 0.08 + level * 0.045) return "decoy";
    if (roll > 0.82 - level * 0.025) return "bonus";
    return "normal";
  }

  function showMole(index, type) {
    const hole = holes[index];
    clearHole(index);
    const mole = hole.querySelector(".mole");
    if (mole) mole.textContent = type === "bonus" ? "5" : type === "decoy" ? "!" : "G";
    hole.classList.add("is-up");
    hole.classList.toggle("is-bonus", type === "bonus");
    hole.classList.toggle("is-decoy", type === "decoy");
    const life = Math.max(300, 860 - score * 9 - difficulty() * 95 - streak * 8);
    const timer = trackTimer(
      window.setTimeout(() => {
        if (activeMoles.has(index)) {
          if (type !== "decoy") streak = 0;
          clearHole(index);
          updateMoleStats();
        }
      }, life),
    );
    activeMoles.set(index, { type, timer });
  }

  function popMole() {
    if (!playing) return;
    const level = difficulty();
    const pressure = timeLeft < 12 ? 1 : 0;
    const count = Math.min(5, 1 + level + pressure + (Math.random() > 0.66 ? 1 : 0));
    const available = holes.map((_, index) => index).filter((index) => !activeMoles.has(index));
    for (let i = 0; i < count && available.length; i += 1) {
      const pick = Math.floor(Math.random() * available.length);
      const index = available.splice(pick, 1)[0];
      showMole(index, chooseType());
    }
    const speed = Math.max(240, 690 - score * 5 - level * 78 - streak * 4);
    popTimer = trackTimer(window.setTimeout(popMole, speed));
  }

  function endRound() {
    playing = false;
    window.clearTimeout(popTimer);
    window.clearInterval(roundTimer);
    clearTrackedTimers();
    hideMoles();
    startButton.disabled = false;
    setButtonLabel();
    const name = (playerName.value || "Guest").trim().slice(0, 12) || "Guest";
    const rows = leaderboard();
    rows.push({ name, score, at: Date.now() });
    rows.sort((a, b) => b.score - a.score || a.at - b.at);
    saveLeaderboard(rows);
    renderLeaderboard();
  }

  function startRound() {
    score = 0;
    streak = 0;
    timeLeft = roundSeconds;
    playing = true;
    startButton.disabled = true;
    startButton.textContent = "Round live";
    clearTrackedTimers();
    hideMoles();
    updateMoleStats();
    popMole();
    roundTimer = window.setInterval(() => {
      timeLeft -= 1;
      updateMoleStats();
      if (timeLeft <= 0) endRound();
    }, 1000);
  }

  moleBoard.addEventListener("click", (event) => {
    const hole = event.target.closest(".mole-hole");
    if (!hole || !playing) return;
    const index = holes.indexOf(hole);
    const active = activeMoles.get(index);
    if (!active) {
      streak = 0;
      score = Math.max(0, score - 1);
      hole.classList.add("is-miss");
      burst(hole, "-1", true);
      shakeCabinet();
      window.setTimeout(() => hole.classList.remove("is-miss"), 200);
      updateMoleStats();
      return;
    }

    if (active.type === "decoy") {
      score = Math.max(0, score - 3);
      streak = 0;
      burst(hole, "-3", true);
      shakeCabinet();
      clearHole(index);
      updateMoleStats();
      return;
    }

    streak += 1;
    const points = active.type === "bonus" ? 5 : 1;
    score += points;
    if (streak > 0 && streak % 5 === 0) {
      score += 3;
      burst(hole, `+${points + 3} combo`);
    } else {
      burst(hole, `+${points}`);
    }
    hole.classList.add("is-hit");
    clearHole(index);
    updateMoleStats();
  });

  startButton.addEventListener("click", startRound);
  clearLeaderboard.addEventListener("click", () => {
    localStorage.removeItem(leaderboardKey);
    renderLeaderboard();
  });
  updateMoleStats();
  renderLeaderboard();
  setButtonLabel();
}

function categoryCard(category, active = false, href = "") {
  const tag = href ? "a" : "button";
  const action = href ? `href="${href}"` : `type="button" data-category="${category.slug}"`;
  return `
    <${tag} class="category-card ${active ? "active" : ""}" ${action}>
      <img src="${category.thumbnail}" alt="" loading="lazy">
      <span>${category.short}</span>
    </${tag}>
  `;
}

const homeCategories = document.getElementById("homeCategories");
if (homeCategories && categories.length) {
  homeCategories.innerHTML = categories
    .map((category) => categoryCard(category, false, `portfolio.html?category=${category.slug}`))
    .join("");
}

document.querySelectorAll(".filter-button").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".filter-button").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    const filter = button.dataset.filter;
    document.querySelectorAll(".case-card").forEach((card) => {
      const show = filter === "all" || card.dataset.type.includes(filter);
      card.classList.toggle("is-hidden", !show);
    });
  });
});

const portfolioCategories = document.getElementById("portfolioCategories");
const projectIndex = document.getElementById("projectIndex");
const activeCategoryKicker = document.getElementById("activeCategoryKicker");
const activeCategoryDescription = document.getElementById("activeCategoryDescription");

function projectCard(project) {
  return `
    <a class="project-tile" href="project.html?project=${project.slug}">
      <img src="${project.cover}" alt="${project.title}" loading="lazy">
      <div class="project-tile-info">
        <p>${project.venue}</p>
        <h3>${project.title}</h3>
        <span>${project.description}</span>
        <div class="project-meta">
          <b>${project.photoCount} photos</b>
          <b>${categories.find((category) => category.slug === project.category)?.short || "Work"}</b>
        </div>
      </div>
    </a>
  `;
}

function renderPortfolio(categorySlug = "all") {
  if (!portfolioCategories || !projectIndex) return;
  const activeCategory = categories.find((category) => category.slug === categorySlug) || categories[0];
  portfolioCategories.innerHTML = categories.map((category) => categoryCard(category, category.slug === categorySlug)).join("");
  activeCategoryKicker.textContent = activeCategory.title;
  activeCategoryDescription.textContent = activeCategory.description;

  const filtered = categorySlug === "all" ? projects : projects.filter((project) => project.category === categorySlug);
  projectIndex.innerHTML = filtered.map(projectCard).join("");
  observeMotion();
}

if (portfolioCategories && projectIndex) {
  const initialCategory = new URLSearchParams(window.location.search).get("category") || "all";
  renderPortfolio(initialCategory);
  portfolioCategories.addEventListener("click", (event) => {
    const button = event.target.closest(".category-card");
    if (!button || !button.dataset.category) return;
    const category = button.dataset.category;
    history.replaceState(null, "", `portfolio.html?category=${category}`);
    renderPortfolio(category);
  });
}

const projectDetail = document.getElementById("projectDetail");
if (projectDetail) {
  const slug = new URLSearchParams(window.location.search).get("project") || projects[0]?.slug;
  const project = projects.find((item) => item.slug === slug) || projects[0];
  if (project) {
    document.title = `${project.title} | Galvanic Project`;
    const category = categories.find((item) => item.slug === project.category);
    const photos = project.images
      .map(
        (src, index) => `
          <button class="archive-photo" type="button" data-src="${src}" aria-label="Open ${project.title} photo ${index + 1}">
            <img src="${src}" alt="${project.title} photo ${index + 1}" loading="lazy">
          </button>
        `,
      )
      .join("");

    projectDetail.innerHTML = `
      <section class="project-detail-hero">
        <div class="project-detail-copy">
          <a class="back-link" href="portfolio.html?category=${project.category}">Back to ${category?.short || "portfolio"}</a>
          <div class="section-kicker">${project.venue}</div>
          <h1>${project.title}</h1>
          <p>${project.description}</p>
          <div class="project-meta">
            <b>${project.photoCount} photos</b>
            <b>${category?.title || "Portfolio"}</b>
          </div>
        </div>
        <img src="${project.cover}" alt="${project.title}">
      </section>
      <section class="project-gallery section-pad">
        <div class="archive-project-head">
          <div>
            <p>Detailed photos</p>
            <h2>Project archive</h2>
          </div>
          <span>These are the deeper build, event, crowd, render and installation photos for this project.</span>
        </div>
        <div class="archive-photos">${photos}</div>
      </section>
    `;
  }
}

const lightbox = document.createElement("div");
lightbox.className = "lightbox";
lightbox.innerHTML = `
  <button type="button" aria-label="Close photo">x</button>
  <img alt="">
`;
document.body.appendChild(lightbox);

const lightboxImage = lightbox.querySelector("img");
const closeLightbox = () => {
  lightbox.classList.remove("is-open");
  lightboxImage.removeAttribute("src");
  lightboxImage.alt = "";
};

document.addEventListener("click", (event) => {
  const button = event.target.closest(".archive-photo");
  if (!button) return;
  const image = button.querySelector("img");
  lightboxImage.src = button.dataset.src;
  lightboxImage.alt = image?.alt || "Portfolio photo";
  lightbox.classList.add("is-open");
});

lightbox.addEventListener("click", (event) => {
  if (event.target === lightbox || event.target.tagName === "BUTTON") closeLightbox();
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeLightbox();
});

motionObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.animate(
          [
            { opacity: 0, transform: "translateY(24px)" },
            { opacity: 1, transform: "translateY(0)" },
          ],
          { duration: 520, easing: "cubic-bezier(.2,.8,.2,1)", fill: "both" },
        );
        motionObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 },
);

function observeMotion() {
  if (!motionObserver) return;
  document
    .querySelectorAll(".case-card, .service-row, .logo-cloud span, .archive-project, .project-tile")
    .forEach((item) => motionObserver.observe(item));
}

observeMotion();
