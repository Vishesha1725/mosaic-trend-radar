const params = new URLSearchParams(location.search);
const keyword = params.get('keyword') || '';
const timeline = params.get('timeline') || '90D';
const el = document.getElementById('briefContent');

function section(title, content) {
  return `<section class="brief-block"><h3>${title}</h3>${content}</section>`;
}

function list(items) {
  return `<ul>${items.map((x) => `<li>${x}</li>`).join('')}</ul>`;
}

function chart(values = []) {
  if (!values.length) return '<p>No chart yet.</p>';
  const max = Math.max(...values, 1);
  const points = values.map((v, i) => `${(i / (values.length - 1 || 1)) * 100},${45 - (v / max) * 40}`).join(' ');
  return `<div class="chart"><svg viewBox="0 0 100 50" preserveAspectRatio="none"><polyline points="${points}" /></svg></div>`;
}

async function loadBrief() {
  if (!keyword) {
    el.innerHTML = '<h2>No trend selected</h2><p>Go back and choose a card.</p>';
    return;
  }

  const res = await fetch(`/api/brief?keyword=${encodeURIComponent(keyword)}&timeline=${timeline}`);
  if (!res.ok) throw new Error('Could not load brief');
  const t = await res.json();

  el.innerHTML = `
    <h2>${t.keyword} (${t.label})</h2>
    <p class="sub">${t.category} • Timeline ${timeline} • Money potential: ₹${t.money} Cr</p>

    ${section('What’s happening', `<p>${t.whatsHappening}</p>`) }

    ${section('Proof (charts + numbers)', `
      ${chart(t.series)}
      <div class="metrics">
        <div><span>Google growth</span><strong>${t.googleGrowth}%</strong></div>
        <div><span>Reddit volume</span><strong>${t.redditVolume}</strong></div>
        <div><span>YouTube volume</span><strong>${t.youtubeVolume}</strong></div>
        <div><span>PubMed growth</span><strong>${t.pubmedGrowth}%</strong></div>
      </div>
    `)}

    ${section('Why it is real/fad', list(t.why || []))}
    ${section('3 product ideas (future-ready)', list(t.ideas || []))}
    ${section('Go-to-market (India channels)', list(t.gtm || []))}
    ${section('Risks + fixes', list(t.risksAndFixes || []))}
    ${section('90-day plan', list(t.plan90 || []))}
  `;
}

loadBrief().catch((err) => {
  el.innerHTML = `<h2>Could not load brief</h2><p>${err.message}</p>`;
});
