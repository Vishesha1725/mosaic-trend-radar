/*
  Next Big Product Radar (Live Data)
  - Pulls live signals from Google Trends RSS, Reddit, YouTube RSS, and PubMed
  - Computes explainable scores: Velocity, Durability, Intent, Evidence, Competition, TQS
  - Labels REAL vs FAD based on rule thresholds
*/

const PROXY = "https://api.allorigins.win/raw?url=";
const REDDIT_PROXY = "https://r.jina.ai/http://www.reddit.com/search.json";
const PUBMED_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi";
const CACHE_MS = 10 * 60 * 1000;

const SEED_TRENDS = [
  { keyword: "metabolic flexibility india", category: "Metabolic" },
  { keyword: "magnesium glycinate sleep", category: "Sleep" },
  { keyword: "mouth taping sleep", category: "Sleep" },
  { keyword: "nasal breathing strip", category: "Sleep" },
  { keyword: "electrolyte hydration india", category: "Hydration" },
  { keyword: "postbiotic supplement india", category: "Gut" },
  { keyword: "phgg fiber india", category: "Gut" },
  { keyword: "adaptogen stress patch", category: "Mental" },
  { keyword: "ceramide supplement india", category: "Skin" },
  { keyword: "plant collagen peptide", category: "Skin" },
  { keyword: "pcos nutrition kit", category: "Women" },
  { keyword: "cycle sync nutrition", category: "Women" },
  { keyword: "creatine for women india", category: "Longevity" },
  { keyword: "protein compliance sachet", category: "Fitness" },
  { keyword: "blue light eye gummies", category: "Mental" },
  { keyword: "ashwagandha sleep strips", category: "Sleep" },
  { keyword: "berberine glucose support", category: "Metabolic" },
  { keyword: "shilajit gummies", category: "Energy" },
  { keyword: "l theanine india", category: "Mental" },
  { keyword: "hrv stress tracking", category: "Mental" },
  { keyword: "gut barrier support", category: "Gut" },
  { keyword: "electrolyte nimbu sachet", category: "Hydration" },
  { keyword: "heat recovery drink", category: "Hydration" },
  { keyword: "women longevity stack", category: "Longevity" },
  { keyword: "recovery magnesium spray", category: "Fitness" },
  { keyword: "sleep gummies india", category: "Sleep" },
  { keyword: "ayurvedic skin barrier", category: "Skin" },
  { keyword: "post meal glucose walk", category: "Metabolic" },
  { keyword: "charcoal toothpaste", category: "Oral" },
  { keyword: "probiotic lassi", category: "Gut" },
];

const state = { trends: [], query: "", category: "all", sortBy: "tqs", cache: new Map() };
const el = {
  trendGrid: document.getElementById("trendGrid"),
  summaryGrid: document.getElementById("summaryGrid"),
  categoryFilter: document.getElementById("categoryFilter"),
  searchInput: document.getElementById("searchInput"),
  sortBy: document.getElementById("sortBy"),
  modal: document.getElementById("briefModal"),
  modalContent: document.getElementById("modalContent"),
  closeModal: document.getElementById("closeModal"),
  refreshBtn: document.getElementById("refreshBtn"),
  statusText: document.getElementById("statusText"),
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const daysBetween = (date) => Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
const fromCache = (k) => {
  const hit = state.cache.get(k);
  return hit && Date.now() - hit.ts < CACHE_MS ? hit.value : null;
};
const setCache = (k, value) => state.cache.set(k, { ts: Date.now(), value });

async function safeFetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

function parseGoogleRssItems(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, "text/xml");
  return [...doc.querySelectorAll("item")].map((item) => ({
    title: item.querySelector("title")?.textContent?.toLowerCase() || "",
    pubDate: new Date(item.querySelector("pubDate")?.textContent || Date.now()),
  }));
}

async function fetchGoogleSignal(keyword) {
  const key = `google:${keyword}`;
  const cached = fromCache(key);
  if (cached) return cached;

  const rssUrl = `${PROXY}${encodeURIComponent("https://trends.google.com/trending/rss?geo=IN")}`;
  const text = await safeFetchText(rssUrl);
  const items = parseGoogleRssItems(text);

  const related = items.filter((it) => it.title.includes(keyword.split(" ")[0]));
  const recent7 = related.filter((it) => daysBetween(it.pubDate) <= 7).length;
  const recent30 = related.filter((it) => daysBetween(it.pubDate) <= 30).length;
  const recent90 = related.filter((it) => daysBetween(it.pubDate) <= 90).length;

  const growth = clamp((recent30 * 22) + recent7 * 10, 0, 100);
  const slope = clamp((recent7 - (recent30 - recent7) / 3) * 20 + 50, 0, 100);
  const spikeiness = clamp((recent7 > 0 && recent30 <= recent7 ? 85 : 25) + (recent90 > recent30 * 2 ? 15 : 0), 0, 100);

  const out = {
    googleGrowthPct: growth,
    sparkline: [clamp(recent90 * 8, 1, 60), clamp(recent30 * 18, 1, 85), clamp(recent7 * 28, 1, 100)],
    slope,
    spikeiness,
  };
  setCache(key, out);
  return out;
}

async function fetchRedditSignal(keyword) {
  const key = `reddit:${keyword}`;
  const cached = fromCache(key);
  if (cached) return cached;

  const params = new URLSearchParams({ q: `${keyword} india wellness`, sort: "new", t: "month", limit: "25" });
  const text = await safeFetchText(`${REDDIT_PROXY}?${params.toString()}`);
  const parsed = JSON.parse(text);
  const posts = parsed?.data?.children || [];
  const mentionCount = posts.length;
  const avgScore = mentionCount ? posts.reduce((s, p) => s + (p.data.score || 0), 0) / mentionCount : 0;

  const out = {
    redditSpikePct: clamp(mentionCount * 8 + avgScore, 0, 100),
    redditMentions: mentionCount,
    redditCrowd: clamp(mentionCount * 5, 0, 100),
  };
  setCache(key, out);
  return out;
}

async function fetchYouTubeSignal(keyword) {
  const key = `youtube:${keyword}`;
  const cached = fromCache(key);
  if (cached) return cached;

  const url = `${PROXY}${encodeURIComponent(`https://www.youtube.com/feeds/videos.xml?search_query=${encodeURIComponent(`${keyword} india wellness`)}`)}`;
  const text = await safeFetchText(url);
  const doc = new DOMParser().parseFromString(text, "text/xml");
  const entries = [...doc.querySelectorAll("entry")];

  let in30 = 0;
  let howTo = 0;
  entries.forEach((entry) => {
    const title = (entry.querySelector("title")?.textContent || "").toLowerCase();
    const published = new Date(entry.querySelector("published")?.textContent || Date.now());
    if (daysBetween(published) <= 30) in30 += 1;
    if (title.includes("how") || title.includes("dosage") || title.includes("benefit")) howTo += 1;
  });

  const out = {
    youtubeSpikePct: clamp(in30 * 7, 0, 100),
    youtubeCount: in30,
    intentHint: entries.length ? clamp((howTo / entries.length) * 100, 0, 100) : 0,
  };
  setCache(key, out);
  return out;
}

async function fetchPubMedSignal(keyword) {
  const key = `pubmed:${keyword}`;
  const cached = fromCache(key);
  if (cached) return cached;

  const year = new Date().getUTCFullYear();
  const countFor = async (start, end) => {
    const term = `(${keyword}) AND India[Affiliation] AND ("${start}"[DP] : "${end}"[DP])`;
    const url = `${PUBMED_URL}?db=pubmed&retmode=json&term=${encodeURIComponent(term)}`;
    const text = await safeFetchText(`${PROXY}${encodeURIComponent(url)}`);
    const json = JSON.parse(text);
    return Number(json?.esearchresult?.count || 0);
  };

  const current = await countFor(year - 1, year);
  const previous = await countFor(year - 3, year - 2);
  const growth = previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : 0;

  const out = {
    pubmedGrowthPct: clamp(growth, 0, 100),
    pubmedCount: current,
    evidenceHint: clamp(current * 8, 0, 100),
  };
  setCache(key, out);
  return out;
}

function inferOpportunityCr(tqs, competition, category) {
  const categoryFactor = {
    Metabolic: 1.25,
    Sleep: 1.2,
    Gut: 1.15,
    Women: 1.2,
    Hydration: 1.1,
    Longevity: 1.3,
    Skin: 1.05,
    Fitness: 1.1,
    Mental: 1.0,
    Energy: 1.0,
    Oral: 0.7,
  }[category] || 1;
  const estimate = (8 + tqs * 0.55 + (100 - competition) * 0.18) * categoryFactor;
  return Math.round(clamp(estimate, 8, 95));
}

function computeScores(base) {
  const mentionsAvg = (base.redditSpikePct + base.youtubeSpikePct) / 2;
  const velocity = clamp(0.5 * base.googleGrowthPct + 0.25 * base.redditSpikePct + 0.25 * base.youtubeSpikePct, 0, 100);
  const durability = clamp(0.55 * base.googleSlope + 0.45 * (100 - base.spikeiness), 0, 100);
  const intent = clamp(0.45 * base.intentHint + 0.35 * base.queryIntent + 0.2 * mentionsAvg, 0, 100);
  const evidence = clamp(0.7 * base.evidenceHint + 0.3 * base.pubmedGrowthPct, 0, 100);
  const competition = clamp(0.5 * base.redditCrowd + 0.5 * clamp(base.youtubeCount * 6, 0, 100), 0, 100);

  const tqs = clamp(
    0.3 * durability + 0.25 * velocity + 0.2 * intent + 0.15 * evidence + 0.1 * (100 - competition),
    0,
    100,
  );

  const fadTrigger = base.spikeiness > 75 || durability < 35 || evidence < 20;
  const label = !fadTrigger && tqs >= 60 ? "REAL" : "FAD";
  const risk = clamp(Math.round(100 - durability * 0.45 - evidence * 0.25 - intent * 0.2 + competition * 0.2), 10, 95);
  const ttmMonths = clamp(Math.round(9 - tqs / 18), 2, 12);

  return {
    velocity: Math.round(velocity),
    durability: Math.round(durability),
    intent: Math.round(intent),
    evidence: Math.round(evidence),
    competition: Math.round(competition),
    tqs: Math.round(tqs),
    label,
    risk,
    timeToMainstreamMonths: ttmMonths,
    opportunityCr: inferOpportunityCr(tqs, competition, base.category),
  };
}

function queryIntentScore(keyword) {
  const intentTerms = ["buy", "dosage", "best", "side effects", "price", "near me", "how to use"];
  const lower = keyword.toLowerCase();
  return intentTerms.some((t) => lower.includes(t)) ? 70 : 40;
}

async function hydrateTrend(seed) {
  const base = {
    name: seed.keyword,
    category: seed.category,
    queryIntent: queryIntentScore(seed.keyword),
  };

  try {
    const [g, r, y, p] = await Promise.all([
      fetchGoogleSignal(seed.keyword),
      fetchRedditSignal(seed.keyword),
      fetchYouTubeSignal(seed.keyword),
      fetchPubMedSignal(seed.keyword),
    ]);

    const merged = {
      ...base,
      ...g,
      ...r,
      ...y,
      ...p,
      googleSlope: g.slope,
      evidenceHint: p.evidenceHint,
    };

    const scores = computeScores(merged);

    return {
      id: seed.keyword.replace(/\s+/g, "-"),
      ...merged,
      ...scores,
      whyNow: `${seed.keyword} shows cross-signal movement across search, content, and discussion channels in India.`,
      wedge: `Launch a focused ${seed.keyword} SKU with education-led positioning, compliant claims, and 30-day repeat tracking.`,
      riskNotes: scores.label === "FAD"
        ? "High spikeiness / weak durability. Use low-inventory experiments and strict kill metrics."
        : "Monitor claim compliance and competitive crowding while scaling repeat cohorts.",
    };
  } catch (error) {
    return {
      id: seed.keyword.replace(/\s+/g, "-"),
      name: seed.keyword,
      category: seed.category,
      googleGrowthPct: 0,
      redditSpikePct: 0,
      youtubeSpikePct: 0,
      pubmedGrowthPct: 0,
      pubmedCount: 0,
      sparkline: [0, 0, 0],
      velocity: 0,
      durability: 0,
      intent: 0,
      evidence: 0,
      competition: 0,
      tqs: 0,
      label: "FAD",
      risk: 85,
      timeToMainstreamMonths: 12,
      opportunityCr: 8,
      whyNow: `Live fetch failed for this keyword (${error.message}).`,
      wedge: "Retry run; continue with available trends.",
      riskNotes: "Data unavailable; treat as unverified signal.",
      redditMentions: 0,
      youtubeCount: 0,
      spikeiness: 100,
      googleSlope: 0,
      intentHint: 0,
      evidenceHint: 0,
      queryIntent: 0,
    };
  }
}

function sparklineSvg(values) {
  const max = Math.max(...values, 1);
  const points = values.map((v, i) => `${(i / (values.length - 1)) * 100},${50 - (v / max) * 45}`).join(" ");
  return `<svg viewBox="0 0 100 50" preserveAspectRatio="none"><polyline points="${points}" /></svg>`;
}

function renderSummary(trends) {
  if (!trends.length) return (el.summaryGrid.innerHTML = "");
  const avgTqs = Math.round(trends.reduce((s, t) => s + t.tqs, 0) / trends.length);
  const realCount = trends.filter((t) => t.label === "REAL").length;
  const topOpp = Math.max(...trends.map((t) => t.opportunityCr));
  const avgRisk = Math.round(trends.reduce((s, t) => s + t.risk, 0) / trends.length);

  el.summaryGrid.innerHTML = `
    <article class="summary-tile card-surface"><p>Trends scanned</p><h3>${trends.length}</h3></article>
    <article class="summary-tile card-surface"><p>REAL trends</p><h3>${realCount}</h3></article>
    <article class="summary-tile card-surface"><p>Avg TQS</p><h3>${avgTqs}</h3></article>
    <article class="summary-tile card-surface"><p>Top Opportunity</p><h3>₹${topOpp} Cr</h3></article>
    <article class="summary-tile card-surface"><p>Avg Risk</p><h3>${avgRisk}</h3></article>
  `;
}

function renderTrends(trends) {
  if (!trends.length) {
    el.trendGrid.innerHTML = '<p class="meta">No trends match your filters.</p>';
    return;
  }

  el.trendGrid.innerHTML = trends.map((t) => `
    <article class="trend-card card-surface">
      <div class="badge-row">
        <span class="badge ${t.label === "REAL" ? "real" : "fad"}">${t.label}</span>
        <span class="badge">${t.category}</span>
        <span class="chip live">Live</span>
      </div>
      <h3>${t.name}</h3>
      <p class="meta">TQS ${t.tqs} · Time-to-Mainstream: ${t.timeToMainstreamMonths} months</p>

      <div class="metrics">
        <div class="metric"><span>Signal Velocity</span><strong>${t.velocity}/100</strong></div>
        <div class="metric"><span>Google Growth</span><strong>${t.googleGrowthPct}%</strong></div>
        <div class="metric"><span>Reddit / YT Spikes</span><strong>${t.redditSpikePct}% / ${t.youtubeSpikePct}%</strong></div>
        <div class="metric"><span>Risk Score</span><strong class="${t.risk > 60 ? "risk-high" : "risk-low"}">${t.risk}/100</strong></div>
        <div class="metric"><span>Opportunity</span><strong>₹${t.opportunityCr} Cr</strong></div>
        <div class="metric"><span>Evidence</span><strong>${t.evidence}/100</strong></div>
      </div>

      <div class="sparkline">${sparklineSvg(t.sparkline)}</div>
      <div class="progress"><div style="width:${t.tqs}%"></div></div>

      <div class="card-actions">
        <span class="meta">PubMed: ${t.pubmedCount} · Reddit posts: ${t.redditMentions}</span>
        <button data-id="${t.id}" class="view-brief-btn">View Opportunity Brief</button>
      </div>
    </article>
  `).join("");
}

function openBrief(id) {
  const t = state.trends.find((x) => x.id === id);
  if (!t) return;

  el.modalContent.innerHTML = `
    <h2 id="modalTitle">${t.name}</h2>
    <p class="meta">${t.category} · <strong>TQS ${t.tqs}</strong> · ${t.label} · Opportunity ₹${t.opportunityCr} Cr</p>

    <h3>Why this is ${t.label === "REAL" ? "likely durable" : "likely a fad"}</h3>
    <p>${t.whyNow}</p>

    <section class="breakdown">
      <div class="metric"><span>Velocity</span><strong>${t.velocity}</strong></div>
      <div class="metric"><span>Durability</span><strong>${t.durability}</strong></div>
      <div class="metric"><span>Intent</span><strong>${t.intent}</strong></div>
    </section>
    <section class="breakdown-2">
      <div class="metric"><span>Evidence</span><strong>${t.evidence}</strong></div>
      <div class="metric"><span>Competition</span><strong>${t.competition}</strong></div>
    </section>

    <p class="meta">Formula: 0.30×Durability + 0.25×Velocity + 0.20×Intent + 0.15×Evidence + 0.10×(100−Competition)</p>

    <h3>Evidence chips</h3>
    <p class="meta">Google Growth ${t.googleGrowthPct}% · Reddit ${t.redditSpikePct}% · YouTube ${t.youtubeSpikePct}% · PubMed Growth ${t.pubmedGrowthPct}%</p>

    <h3>Product wedge (novel SKU)</h3>
    <p>${t.wedge}</p>

    <h3>Risk + mitigation</h3>
    <p>${t.riskNotes}</p>

    <h3>90-day Founder Action Plan</h3>
    <ul>
      <li>Weeks 1-2: launch explainer landing page + waitlist + creator seeding.</li>
      <li>Weeks 3-6: release micro-batch hero SKU; measure 30-day reorder and retention.</li>
      <li>Weeks 7-12: scale only if repeat > threshold and CAC payback is acceptable.</li>
    </ul>
  `;

  el.modal.classList.remove("hidden");
}

function getVisibleTrends() {
  return state.trends
    .filter((t) => (state.category === "all" || t.category === state.category))
    .filter((t) => `${t.name} ${t.category}`.toLowerCase().includes(state.query.toLowerCase()))
    .sort((a, b) => {
      if (state.sortBy === "velocity") return b.velocity - a.velocity;
      if (state.sortBy === "opportunity") return b.opportunityCr - a.opportunityCr;
      if (state.sortBy === "risk") return a.risk - b.risk;
      if (state.sortBy === "ttm") return a.timeToMainstreamMonths - b.timeToMainstreamMonths;
      return b.tqs - a.tqs;
    })
    .slice(0, 10);
}

function render() {
  const visible = getVisibleTrends();
  renderSummary(visible);
  renderTrends(visible);
}

function setupFilters() {
  const categories = [...new Set(SEED_TRENDS.map((t) => t.category))].sort();
  el.categoryFilter.insertAdjacentHTML("beforeend", categories.map((c) => `<option value="${c}">${c}</option>`).join(""));

  el.searchInput.addEventListener("input", (e) => { state.query = e.target.value.trim(); render(); });
  el.categoryFilter.addEventListener("change", (e) => { state.category = e.target.value; render(); });
  el.sortBy.addEventListener("change", (e) => { state.sortBy = e.target.value; render(); });
}

function setupModalEvents() {
  el.trendGrid.addEventListener("click", (event) => {
    const button = event.target.closest(".view-brief-btn");
    if (button) openBrief(button.dataset.id);
  });
  el.closeModal.addEventListener("click", () => el.modal.classList.add("hidden"));
  el.modal.addEventListener("click", (event) => { if (event.target === el.modal) el.modal.classList.add("hidden"); });
  window.addEventListener("keydown", (event) => { if (event.key === "Escape") el.modal.classList.add("hidden"); });
}

async function refreshLiveData() {
  el.statusText.textContent = "Fetching live sources…";
  const results = await Promise.all(SEED_TRENDS.map(hydrateTrend));
  state.trends = results;
  render();

  const now = new Date().toLocaleString();
  el.statusText.textContent = `Updated ${now}. Live data with graceful fallbacks.`;
}

async function init() {
  setupFilters();
  setupModalEvents();
  el.refreshBtn.addEventListener("click", refreshLiveData);

  try {
    await refreshLiveData();
  } catch (error) {
    el.statusText.innerHTML = `<span class="warning">Live fetch failed: ${error.message}</span>`;
  }
}

init();
