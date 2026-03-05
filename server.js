const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const CACHE_MS = 10 * 60 * 1000;

const CATEGORIES = {
  Sleep: ['magnesium glycinate sleep', 'mouth taping sleep', 'sleep gummies india', 'nasal breathing strip'],
  Gut: ['postbiotic supplement india', 'phgg fiber india', 'gut barrier support', 'probiotic lassi'],
  Women: ['pcos nutrition kit', 'cycle sync nutrition', 'women longevity stack', 'iron plus vitamin c women'],
  Skin: ['plant collagen peptide', 'ceramide supplement india', 'ayurvedic skin barrier', 'skin hydration sachet'],
  Focus: ['l theanine india', 'blue light eye gummies', 'adaptogen stress patch', 'hrv stress tracking'],
  Longevity: ['creatine for women india', 'berberine glucose support', 'metabolic flexibility india', 'electrolyte hydration india'],
};

const memoryCache = new Map();

function getCache(key) {
  const hit = memoryCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > CACHE_MS) return null;
  return hit.value;
}
function setCache(key, value) {
  memoryCache.set(key, { ts: Date.now(), value });
}

async function fetchText(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function parseJson(text) {
  try { return JSON.parse(text); } catch { return {}; }
}

function pctChange(now, prev) {
  if (prev <= 0) return now > 0 ? 100 : 0;
  return ((now - prev) / prev) * 100;
}

async function fetchGoogleInterest(keyword, timeline = '90D') {
  const cacheKey = `google:${keyword}:${timeline}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const timeframeMap = { '7D': 'now 7-d', '30D': 'today 1-m', '90D': 'today 3-m', '12M': 'today 12-m' };
  const timeframe = timeframeMap[timeline] || 'today 3-m';

  const exploreUrl = new URL('https://trends.google.com/trends/api/explore');
  exploreUrl.searchParams.set('hl', 'en-US');
  exploreUrl.searchParams.set('tz', '330');
  exploreUrl.searchParams.set('req', JSON.stringify({
    comparisonItem: [{ keyword, geo: 'IN', time: timeframe }],
    category: 0,
    property: '',
  }));

  const exploreText = await fetchText(exploreUrl.toString(), {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  const cleanExplore = exploreText.replace(/^\)\]\}',?\n/, '');
  const exploreJson = parseJson(cleanExplore);

  const widget = (exploreJson.widgets || []).find((w) => w.id === 'TIMESERIES');
  if (!widget) throw new Error('No Google Trends timeseries widget');

  const multiUrl = new URL('https://trends.google.com/trends/api/widgetdata/multiline');
  multiUrl.searchParams.set('hl', 'en-US');
  multiUrl.searchParams.set('tz', '330');
  multiUrl.searchParams.set('req', JSON.stringify(widget.request));
  multiUrl.searchParams.set('token', widget.token);

  const multiText = await fetchText(multiUrl.toString(), {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });

  const cleanMulti = multiText.replace(/^\)\]\}',?\n/, '');
  const multiJson = parseJson(cleanMulti);
  const points = (multiJson.default?.timelineData || []).map((p) => Number(p.value?.[0] || 0));

  const half = Math.max(1, Math.floor(points.length / 2));
  const oldAvg = points.slice(0, half).reduce((a, b) => a + b, 0) / half;
  const newAvg = points.slice(half).reduce((a, b) => a + b, 0) / Math.max(1, points.length - half);
  const growth = Math.max(0, Math.min(100, Math.round(pctChange(newAvg, oldAvg))));

  const out = { points: points.slice(-24), growthPct: growth };
  setCache(cacheKey, out);
  return out;
}

async function fetchRedditSignal(keyword, timeline = '90D') {
  const cacheKey = `reddit:${keyword}:${timeline}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const tMap = { '7D': 'week', '30D': 'month', '90D': 'year', '12M': 'year' };
  const t = tMap[timeline] || 'year';
  const url = new URL('https://www.reddit.com/search.json');
  url.searchParams.set('q', `${keyword} india wellness`);
  url.searchParams.set('sort', 'new');
  url.searchParams.set('t', t);
  url.searchParams.set('limit', '50');

  const text = await fetchText(url.toString(), {
    headers: { 'User-Agent': 'Mozilla/5.0 (radar-bot)' },
  });
  const json = parseJson(text);
  const posts = json?.data?.children || [];
  const mentions = posts.length;
  const score = mentions ? posts.reduce((s, p) => s + (p.data.score || 0), 0) / mentions : 0;

  const out = {
    volume: Math.min(100, mentions * 2),
    mentions,
    score: Math.round(score),
  };
  setCache(cacheKey, out);
  return out;
}

async function fetchYouTubeSignal(keyword, timeline = '90D') {
  const cacheKey = `youtube:${keyword}:${timeline}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return { volume: 0, momentum: 0, videos: 0, disabled: true };
  }

  const publishedAfterMap = {
    '7D': 7,
    '30D': 30,
    '90D': 90,
    '12M': 365,
  };
  const days = publishedAfterMap[timeline] || 90;
  const after = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();

  const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
  searchUrl.searchParams.set('part', 'snippet');
  searchUrl.searchParams.set('q', `${keyword} india wellness`);
  searchUrl.searchParams.set('type', 'video');
  searchUrl.searchParams.set('maxResults', '25');
  searchUrl.searchParams.set('publishedAfter', after);
  searchUrl.searchParams.set('key', apiKey);

  const searchJson = parseJson(await fetchText(searchUrl.toString()));
  const ids = (searchJson.items || []).map((it) => it.id?.videoId).filter(Boolean);
  if (!ids.length) return { volume: 0, momentum: 0, videos: 0 };

  const statsUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
  statsUrl.searchParams.set('part', 'statistics,snippet');
  statsUrl.searchParams.set('id', ids.join(','));
  statsUrl.searchParams.set('key', apiKey);

  const statsJson = parseJson(await fetchText(statsUrl.toString()));
  const items = statsJson.items || [];
  const views = items.reduce((s, it) => s + Number(it.statistics?.viewCount || 0), 0);
  const avgViews = items.length ? views / items.length : 0;

  const out = {
    volume: Math.min(100, items.length * 4),
    momentum: Math.min(100, Math.round(avgViews / 2000)),
    videos: items.length,
  };
  setCache(cacheKey, out);
  return out;
}

async function fetchPubmedSignal(keyword) {
  const cacheKey = `pubmed:${keyword}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const y = new Date().getUTCFullYear();
  const q = (start, end) => `${PUBMED_BASE}?db=pubmed&retmode=json&term=${encodeURIComponent(`(${keyword}) AND India[Affiliation] AND ("${start}"[DP] : "${end}"[DP])`)}`;
  const PUBMED_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi';

  const currentJson = parseJson(await fetchText(q(y - 1, y)));
  const previousJson = parseJson(await fetchText(q(y - 3, y - 2)));

  const current = Number(currentJson?.esearchresult?.count || 0);
  const previous = Number(previousJson?.esearchresult?.count || 0);
  const growth = Math.max(0, Math.min(100, Math.round(pctChange(current, previous))));

  const out = { count: current, growthPct: growth };
  setCache(cacheKey, out);
  return out;
}

function amazonStub(keyword) {
  const hasAmazonKeys = Boolean(process.env.AMAZON_API_KEY && process.env.AMAZON_API_SECRET);
  if (!hasAmazonKeys) return { enabled: false, note: 'Amazon provider is off by default.' };
  return { enabled: true, note: `Amazon placeholder ready for ${keyword}` };
}

function scoreTrend(row) {
  const howFast = Math.round((row.googleGrowth + row.youtubeVolume + row.redditVolume) / 3);
  const willLast = Math.round((row.persistence * 0.6) + ((100 - row.spikeiness) * 0.4));
  const proof = Math.round((row.pubmedGrowth * 0.6) + (row.multiSource * 0.4));
  const crowded = Math.min(100, Math.round((row.youtubeVolume + row.redditVolume) / 2));
  const money = Math.round(Math.max(8, Math.min(120, 10 + howFast * 0.5 + willLast * 0.3 + (100 - crowded) * 0.2)));

  const real = willLast >= 50 && row.spikeiness < 70 && row.multiSource >= 45;
  const label = real ? 'REAL' : 'FAD';

  const why = [
    `Search movement is ${row.googleGrowth}% for India in this timeline.`,
    `${row.multiSource >= 45 ? 'More than one source is moving together.' : 'Signals are not broad enough yet.'}`,
    `${row.spikeiness >= 70 ? 'Sharp spike pattern suggests short hype.' : 'No sharp spike pattern right now.'}`,
  ];

  return {
    howFast,
    willLast,
    proof,
    crowded,
    money,
    label,
    risk: Math.max(5, Math.min(95, 100 - willLast + Math.round(crowded * 0.2))),
    why,
  };
}

function persistenceFromPoints(points) {
  if (!points.length) return 0;
  const chunk = Math.max(1, Math.floor(points.length / 3));
  const a = points.slice(0, chunk).reduce((s, v) => s + v, 0) / chunk;
  const b = points.slice(chunk, chunk * 2).reduce((s, v) => s + v, 0) / Math.max(1, chunk);
  const c = points.slice(chunk * 2).reduce((s, v) => s + v, 0) / Math.max(1, points.length - chunk * 2);
  const slope = c - a;
  return Math.max(0, Math.min(100, Math.round(50 + slope)));
}

function spikeinessFromPoints(points) {
  if (!points.length) return 100;
  const max = Math.max(...points);
  const avg = points.reduce((s, v) => s + v, 0) / points.length;
  if (avg === 0) return 100;
  return Math.max(0, Math.min(100, Math.round((max / avg) * 22)));
}

async function buildTrend(keyword, category, timeline) {
  const [google, reddit, youtube, pubmed] = await Promise.all([
    fetchGoogleInterest(keyword, timeline).catch(() => ({ points: [], growthPct: 0 })),
    fetchRedditSignal(keyword, timeline).catch(() => ({ volume: 0, mentions: 0, score: 0 })),
    fetchYouTubeSignal(keyword, timeline).catch(() => ({ volume: 0, momentum: 0, videos: 0 })),
    fetchPubmedSignal(keyword).catch(() => ({ count: 0, growthPct: 0 })),
  ]);

  const persistence = persistenceFromPoints(google.points);
  const spikeiness = spikeinessFromPoints(google.points);

  const multiSource = Math.round((google.growthPct > 10 ? 35 : 0) + (reddit.volume > 10 ? 30 : 0) + (youtube.volume > 10 ? 25 : 0) + (pubmed.growthPct > 5 ? 10 : 0));

  const base = {
    keyword,
    category,
    timeline,
    series: google.points,
    googleGrowth: google.growthPct,
    redditVolume: reddit.volume,
    redditMentions: reddit.mentions,
    youtubeVolume: youtube.volume,
    youtubeMomentum: youtube.momentum,
    youtubeVideos: youtube.videos,
    pubmedGrowth: pubmed.growthPct,
    pubmedCount: pubmed.count,
    persistence,
    spikeiness,
    multiSource,
    amazon: amazonStub(keyword),
  };

  const score = scoreTrend(base);
  return {
    ...base,
    ...score,
    slug: keyword.replace(/\s+/g, '-').toLowerCase(),
    whatsHappening: `${keyword} is getting more attention from Indian search and content channels. People are actively exploring it in ${timeline} view.`,
    ideas: [
      `${keyword} quick-start starter kit with guided plan`,
      `${keyword} smart combo pack with habit tracker`,
      `${keyword} personalised sachet format for easy daily use`,
    ],
    gtm: ['Instagram creators', 'YouTube explainers', 'Quick commerce trial packs', 'Health communities on Reddit'],
    risksAndFixes: [
      'Risk: short hype burst. Fix: track repeat buys before scaling.',
      'Risk: crowded ad space. Fix: narrow audience + stronger hook.',
      'Risk: claim compliance. Fix: simple, safe copy with proof links.',
    ],
    plan90: ['Weeks 1-2: waitlist + landing page', 'Weeks 3-6: pilot launch + creator seeding', 'Weeks 7-12: scale if repeat and CAC are healthy'],
  };
}

function getSeedPairs() {
  const pairs = [];
  Object.entries(CATEGORIES).forEach(([category, keywords]) => {
    keywords.forEach((keyword) => pairs.push({ category, keyword }));
  });
  return pairs;
}

function sendJson(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

function serveStatic(req, res, pathname) {
  const file = pathname === '/' ? '/index.html' : pathname;
  const safe = path.normalize(file).replace(/^\.\./, '');
  const full = path.join(process.cwd(), safe);
  if (!full.startsWith(process.cwd())) return sendJson(res, 403, { error: 'Forbidden' });

  fs.readFile(full, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(full);
    const types = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
    };
    res.writeHead(200, { 'Content-Type': types[ext] || 'text/plain' });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  if (pathname === '/api/health') return sendJson(res, 200, { ok: true });

  if (pathname === '/api/signals/google-trends') {
    const keyword = url.searchParams.get('keyword') || '';
    const timeline = url.searchParams.get('timeline') || '90D';
    if (!keyword) return sendJson(res, 400, { error: 'Missing keyword' });
    try {
      return sendJson(res, 200, await fetchGoogleInterest(keyword, timeline));
    } catch (err) {
      return sendJson(res, 500, { error: String(err.message) });
    }
  }

  if (pathname === '/api/signals/youtube') {
    const keyword = url.searchParams.get('keyword') || '';
    const timeline = url.searchParams.get('timeline') || '90D';
    if (!keyword) return sendJson(res, 400, { error: 'Missing keyword' });
    try {
      return sendJson(res, 200, await fetchYouTubeSignal(keyword, timeline));
    } catch (err) {
      return sendJson(res, 500, { error: String(err.message) });
    }
  }

  if (pathname === '/api/signals/reddit') {
    const keyword = url.searchParams.get('keyword') || '';
    const timeline = url.searchParams.get('timeline') || '90D';
    if (!keyword) return sendJson(res, 400, { error: 'Missing keyword' });
    try {
      return sendJson(res, 200, await fetchRedditSignal(keyword, timeline));
    } catch (err) {
      return sendJson(res, 500, { error: String(err.message) });
    }
  }

  if (pathname === '/api/signals/pubmed') {
    const keyword = url.searchParams.get('keyword') || '';
    if (!keyword) return sendJson(res, 400, { error: 'Missing keyword' });
    try {
      return sendJson(res, 200, await fetchPubmedSignal(keyword));
    } catch (err) {
      return sendJson(res, 500, { error: String(err.message) });
    }
  }

  if (pathname === '/api/signals/amazon') {
    const keyword = url.searchParams.get('keyword') || '';
    return sendJson(res, 200, amazonStub(keyword));
  }

  if (pathname === '/api/trends') {
    const timeline = url.searchParams.get('timeline') || '90D';
    const pairs = getSeedPairs();
    const trends = await Promise.all(pairs.map(({ keyword, category }) => buildTrend(keyword, category, timeline)));
    const top = trends.sort((a, b) => b.howFast + b.willLast + b.proof - (a.howFast + a.willLast + a.proof)).slice(0, 18);
    return sendJson(res, 200, { timeline, count: top.length, trends: top });
  }

  if (pathname === '/api/brief') {
    const keyword = url.searchParams.get('keyword') || '';
    const timeline = url.searchParams.get('timeline') || '90D';
    if (!keyword) return sendJson(res, 400, { error: 'Missing keyword' });
    const category = Object.entries(CATEGORIES).find(([, list]) => list.includes(keyword))?.[0] || 'Focus';
    const trend = await buildTrend(keyword, category, timeline);
    return sendJson(res, 200, trend);
  }

  return serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  console.log(`Radar app running on http://localhost:${PORT}`);
});
