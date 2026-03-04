/*
  Next Big Product Radar
  - Loads trend records from JSON
  - Computes weighted Signal Velocity score
  - Supports search/filter/sort
  - Renders full brief in modal
*/

const DATA_URL = "data/sample_trends.json";

const WEIGHTS = {
  growth: 0.45,
  mentions: 0.35,
  recency: 0.2,
};

const state = {
  trends: [],
  query: "",
  category: "all",
  sortBy: "velocity",
};

const el = {
  trendGrid: document.getElementById("trendGrid"),
  summaryGrid: document.getElementById("summaryGrid"),
  categoryFilter: document.getElementById("categoryFilter"),
  searchInput: document.getElementById("searchInput"),
  sortBy: document.getElementById("sortBy"),
  modal: document.getElementById("briefModal"),
  modalContent: document.getElementById("modalContent"),
  closeModal: document.getElementById("closeModal"),
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function computeSignalVelocity(trend) {
  const growthScore = clamp(trend.googleGrowthPct, 0, 100);
  const mentionAvg = (trend.redditSpikePct + trend.youtubeSpikePct) / 2;
  const mentionScore = clamp(mentionAvg, 0, 100);

  // Recency score rewards fresher momentum. 0 days -> 100, 30+ days -> 0.
  const recencyScore = clamp(((30 - trend.recencyDays) / 30) * 100, 0, 100);

  const velocity =
    growthScore * WEIGHTS.growth +
    mentionScore * WEIGHTS.mentions +
    recencyScore * WEIGHTS.recency;

  return {
    signalVelocity: Math.round(velocity),
    breakdown: {
      growthScore: Math.round(growthScore),
      mentionScore: Math.round(mentionScore),
      recencyScore: Math.round(recencyScore),
      weights: WEIGHTS,
    },
  };
}

function enrichTrend(trend) {
  const velocity = computeSignalVelocity(trend);
  return { ...trend, ...velocity };
}

async function loadTrends() {
  const response = await fetch(DATA_URL);
  if (!response.ok) throw new Error("Unable to load trend data");

  const raw = await response.json();
  state.trends = raw.map(enrichTrend);
}

function formatCr(value) {
  return `₹${value} Cr`;
}

function getRiskClass(score) {
  return score >= 55 ? "risk-high" : "risk-low";
}

function renderSummary(trends) {
  if (!trends.length) {
    el.summaryGrid.innerHTML = "";
    return;
  }

  const avgVelocity = Math.round(trends.reduce((sum, t) => sum + t.signalVelocity, 0) / trends.length);
  const avgRisk = Math.round(trends.reduce((sum, t) => sum + t.riskScore, 0) / trends.length);
  const maxOpp = Math.max(...trends.map((t) => t.opportunityCr));

  el.summaryGrid.innerHTML = `
    <article class="summary-tile card-surface">
      <p>Trends visible</p>
      <h3>${trends.length}</h3>
    </article>
    <article class="summary-tile card-surface">
      <p>Avg Signal Velocity</p>
      <h3>${avgVelocity}</h3>
    </article>
    <article class="summary-tile card-surface">
      <p>Avg Risk Score</p>
      <h3>${avgRisk}</h3>
    </article>
    <article class="summary-tile card-surface">
      <p>Top Opportunity</p>
      <h3>${formatCr(maxOpp)}</h3>
    </article>
  `;
}

function renderTrends(trends) {
  if (!trends.length) {
    el.trendGrid.innerHTML = '<p class="meta">No trends match your filters.</p>';
    return;
  }

  el.trendGrid.innerHTML = trends
    .map(
      (trend) => `
      <article class="trend-card card-surface">
        <span class="badge">${trend.category}</span>
        <h3>${trend.name}</h3>
        <p class="meta">${trend.description}</p>

        <div class="metrics">
          <div class="metric"><span>Signal Velocity</span><strong>${trend.signalVelocity}/100</strong></div>
          <div class="metric"><span>Google Growth</span><strong>${trend.googleGrowthPct}%</strong></div>
          <div class="metric"><span>Reddit/YT Spike</span><strong>${trend.redditSpikePct}% / ${trend.youtubeSpikePct}%</strong></div>
          <div class="metric"><span>Opportunity</span><strong>${formatCr(trend.opportunityCr)}</strong></div>
          <div class="metric"><span>Risk Score</span><strong class="${getRiskClass(trend.riskScore)}">${trend.riskScore}/100</strong></div>
          <div class="metric"><span>Recency</span><strong>${trend.recencyDays} days</strong></div>
        </div>

        <div class="progress"><div style="width:${trend.signalVelocity}%"></div></div>

        <div class="card-actions">
          <button data-id="${trend.id}" class="view-brief-btn">View Full Brief</button>
        </div>
      </article>
    `,
    )
    .join("");
}

function openBrief(trendId) {
  const trend = state.trends.find((item) => item.id === trendId);
  if (!trend) return;

  const { breakdown } = trend;
  el.modalContent.innerHTML = `
    <h2 id="modalTitle">${trend.name}</h2>
    <p class="meta">${trend.category} · Opportunity ${formatCr(trend.opportunityCr)} · Risk ${trend.riskScore}/100</p>

    <h3>Signal Velocity Breakdown (${trend.signalVelocity}/100)</h3>
    <section class="breakdown">
      <div class="metric"><span>Google Trends Component</span><strong>${breakdown.growthScore}</strong></div>
      <div class="metric"><span>Mentions Component (Reddit + YouTube)</span><strong>${breakdown.mentionScore}</strong></div>
      <div class="metric"><span>Recency Component</span><strong>${breakdown.recencyScore}</strong></div>
    </section>

    <p class="meta">
      Formula: (${breakdown.growthScore} × ${breakdown.weights.growth}) +
      (${breakdown.mentionScore} × ${breakdown.weights.mentions}) +
      (${breakdown.recencyScore} × ${breakdown.weights.recency})
    </p>

    <h3>Why this trend matters now</h3>
    <p>${trend.consumerSignal}</p>

    <h3>Founder opportunity brief</h3>
    <p>${trend.founderAngle}</p>

    <h3>Execution notes</h3>
    <ul>
      <li>Start with one hero SKU and one proof-driven claim.</li>
      <li>Run 30-day retention and reorder cohort before wide expansion.</li>
      <li>Track risk triggers: regulation changes, ad policy shifts, and creator fatigue.</li>
    </ul>
  `;

  el.modal.classList.remove("hidden");
}

function getVisibleTrends() {
  const filtered = state.trends
    .filter((trend) => {
      const categoryMatch = state.category === "all" || trend.category === state.category;
      const queryMatch = `${trend.name} ${trend.category} ${trend.description}`
        .toLowerCase()
        .includes(state.query.toLowerCase());
      return categoryMatch && queryMatch;
    })
    .sort((a, b) => {
      if (state.sortBy === "opportunity") return b.opportunityCr - a.opportunityCr;
      if (state.sortBy === "risk") return a.riskScore - b.riskScore;
      return b.signalVelocity - a.signalVelocity;
    });

  return filtered;
}

function render() {
  const visible = getVisibleTrends();
  renderSummary(visible);
  renderTrends(visible);
}

function setupFilters() {
  const categories = [...new Set(state.trends.map((trend) => trend.category))].sort();
  el.categoryFilter.insertAdjacentHTML(
    "beforeend",
    categories.map((category) => `<option value="${category}">${category}</option>`).join(""),
  );

  el.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value.trim();
    render();
  });

  el.categoryFilter.addEventListener("change", (event) => {
    state.category = event.target.value;
    render();
  });

  el.sortBy.addEventListener("change", (event) => {
    state.sortBy = event.target.value;
    render();
  });
}

function setupModalEvents() {
  el.trendGrid.addEventListener("click", (event) => {
    const button = event.target.closest(".view-brief-btn");
    if (!button) return;
    openBrief(button.dataset.id);
  });

  el.closeModal.addEventListener("click", () => el.modal.classList.add("hidden"));
  el.modal.addEventListener("click", (event) => {
    if (event.target === el.modal) el.modal.classList.add("hidden");
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") el.modal.classList.add("hidden");
  });
}

async function init() {
  try {
    await loadTrends();
    setupFilters();
    setupModalEvents();
    render();
  } catch (error) {
    el.trendGrid.innerHTML = `<p class="meta">Failed to load data: ${error.message}</p>`;
  }
}

init();
