# Next Big Product Radar (Live Data, No Mock Dataset)

A premium static web app that evaluates **real Indian wellness signals** and separates **REAL trends vs FADs** using an explainable Trend Quality Score (TQS).

## Live data sources used
- Google Trends (India trending RSS feed)
- Reddit live search JSON
- YouTube search RSS feed
- PubMed (NCBI E-utilities)

> This build does not rely on local sample trend data files. It fetches live signals at runtime.

## How to run
1. Open `index.html` directly, or
2. Run a local server (recommended for browser fetch compatibility):
   ```bash
   python3 -m http.server 8000
   ```
   Then open `http://localhost:8000`.

## Scoring logic (explainable)
Each candidate trend receives these component scores (0–100):

- **Velocity**: blended growth across Google + Reddit + YouTube
- **Durability**: persistent slope with low spikeiness
- **Intent**: usage/purchase style language + instructional content ratio
- **Evidence**: PubMed momentum and supporting evidence density
- **Competition**: saturation proxy from social/video volume

Final score:

`TQS = 0.30*Durability + 0.25*Velocity + 0.20*Intent + 0.15*Evidence + 0.10*(100-Competition)`

Classification:
- **FAD** if spikeiness is high OR durability is low OR evidence is weak.
- **REAL** when durability + multi-signal breadth + intent pass thresholds.

## What the dashboard shows
- Trend name + category
- REAL/FAD badge
- TQS + Signal Velocity
- Google growth %, Reddit/YT spikes
- Risk score
- Opportunity estimate (₹ Cr)
- Time-to-mainstream estimate
- Sparkline (7/30/90 style momentum proxy)
- “View Opportunity Brief” modal with score breakdown and founder action plan

## Founder Action Plan (Template)
1. **Trend Thesis (1 line)**
2. **Hero SKU Wedge (novel product format)**
3. **90-day validation plan**
4. **Risk controls and kill metrics**
5. **Scale trigger conditions**

## Deployment (live URL)
Deploy this static app on any static host (Vercel/Netlify/GitHub Pages).

### Vercel quick deploy
1. Push repo to GitHub
2. Import project in Vercel
3. Framework preset: `Other` / static
4. Deploy
5. Add your generated live URL here:

`LIVE_URL_HERE`
