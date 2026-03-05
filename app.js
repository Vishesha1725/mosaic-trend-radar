const state = {
  timeline: '90D',
  trends: [],
  query: '',
  category: 'all',
  sortBy: 'fast',
};

const el = {
  trendGrid: document.getElementById('trendGrid'),
  searchInput: document.getElementById('searchInput'),
  categoryFilter: document.getElementById('categoryFilter'),
  sortBy: document.getElementById('sortBy'),
  refreshBtn: document.getElementById('refreshBtn'),
  statusText: document.getElementById('statusText'),
  timelineBtns: document.getElementById('timelineBtns'),
  emptyState: document.getElementById('emptyState'),
};

function sparkline(values = []) {
  if (!values.length) return '';
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => `${(i / (values.length - 1 || 1)) * 100},${45 - (v / max) * 40}`).join(' ');
  return `<svg viewBox="0 0 100 50" preserveAspectRatio="none"><polyline points="${pts}" /></svg>`;
}

function trendWhyBullets(trend) {
  return trend.why.map((line) => `<li>${line}</li>`).join('');
}

function cardHtml(trend) {
  const badgeClass = trend.label === 'REAL' ? 'real' : 'fad';
  return `
    <article class="card trend-card">
      <div class="row">
        <span class="badge ${badgeClass}">${trend.label}</span>
        <span class="chip">${trend.category}</span>
      </div>
      <h3>${trend.keyword}</h3>
      <p class="sub">${state.timeline} • ${trend.youtubeVideos || 0} videos • ${trend.redditMentions || 0} reddit posts</p>

      <div class="metrics">
        <div><span>How fast it’s growing</span><strong>${trend.howFast}/100</strong></div>
        <div><span>Will it last?</span><strong>${trend.willLast}/100</strong></div>
        <div><span>Proof</span><strong>${trend.proof}/100</strong></div>
        <div><span>How crowded is it?</span><strong>${trend.crowded}/100</strong></div>
        <div><span>Money potential (₹)</span><strong>₹${trend.money} Cr</strong></div>
        <div><span>Risk</span><strong>${trend.risk}/100</strong></div>
      </div>

      <div class="chart">${sparkline(trend.series)}</div>

      <p class="why-title">Why we called it ${trend.label}:</p>
      <ul class="why-list">${trendWhyBullets(trend)}</ul>

      <a class="brief-link" href="brief.html?keyword=${encodeURIComponent(trend.keyword)}&timeline=${state.timeline}">View full brief</a>
    </article>
  `;
}

function visibleTrends() {
  return [...state.trends]
    .filter((t) => state.category === 'all' || t.category === state.category)
    .filter((t) => `${t.keyword} ${t.category}`.toLowerCase().includes(state.query.toLowerCase()))
    .sort((a, b) => {
      if (state.sortBy === 'money') return b.money - a.money;
      if (state.sortBy === 'risk') return a.risk - b.risk;
      if (state.sortBy === 'last') return b.willLast - a.willLast;
      return b.howFast - a.howFast;
    });
}

function render() {
  const rows = visibleTrends();
  el.trendGrid.innerHTML = rows.map(cardHtml).join('');
  const isEmpty = rows.length === 0;
  el.emptyState.classList.toggle('hidden', !isEmpty);
}

async function loadTrends() {
  el.statusText.textContent = `Pulling live data for ${state.timeline}...`;
  const res = await fetch(`/api/trends?timeline=${state.timeline}`);
  if (!res.ok) throw new Error('Could not load trends');
  const json = await res.json();
  state.trends = json.trends || [];
  el.statusText.textContent = `Updated now • timeline ${state.timeline} • ${state.trends.length} trends`;
  render();
}

function setActiveTimelineButton() {
  [...el.timelineBtns.querySelectorAll('button')].forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.timeline === state.timeline);
  });
}

function bind() {
  el.searchInput.addEventListener('input', (e) => {
    state.query = e.target.value.trim();
    render();
  });

  el.categoryFilter.addEventListener('change', (e) => {
    state.category = e.target.value;
    render();
  });

  el.sortBy.addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    render();
  });

  el.refreshBtn.addEventListener('click', () => loadTrends().catch((err) => {
    el.statusText.textContent = `Oops, could not refresh: ${err.message}`;
  }));

  el.timelineBtns.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-timeline]');
    if (!btn) return;
    state.timeline = btn.dataset.timeline;
    setActiveTimelineButton();
    loadTrends().catch((err) => {
      el.statusText.textContent = `Oops, timeline switch failed: ${err.message}`;
    });
  });
}

bind();
setActiveTimelineButton();
loadTrends().catch((err) => {
  el.statusText.textContent = `Could not load live data: ${err.message}`;
});
