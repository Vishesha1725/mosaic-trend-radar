# Next Big Product' Radar (Static Hackathon Build)

A clean, premium static dashboard for spotting **early Indian wellness opportunities** and separating real trend momentum from short-term hype.

## Files
- `index.html` — App layout and modal container.
- `styles.css` — Premium dark UI styling and responsive cards.
- `app.js` — Data loading, weighted Signal Velocity scoring, filters, sort, search, and modal brief rendering.
- `data/sample_trends.json` — 10 India-relevant wellness trend inputs.

## How to run
1. Clone/download the project.
2. Open `index.html` in a browser.

> Note: Some browsers block `fetch()` from local `file://` context. If that happens, run a tiny local server instead:
> ```bash
> python3 -m http.server 8000
> ```
> Then open `http://localhost:8000`.

## Scoring logic (Signal Velocity: 0–100)
Each trend’s Signal Velocity is computed from weighted components:

- **Google Trends Growth score (45%)**
- **Mentions score (35%)** = average of Reddit spike % and YouTube spike %
- **Recency score (20%)** = fresher spikes get higher scores (0 days → 100, 30+ days → 0)

Formula:

`Signal Velocity = (growthScore × 0.45) + (mentionScore × 0.35) + (recencyScore × 0.20)`

The full component breakdown and weights are shown in each trend’s **View Full Brief** modal.

## Dashboard features
- Trend cards with:
  - Trend name
  - Category
  - Signal Velocity (0–100)
  - Google Trends growth %
  - Reddit & YouTube mention spikes
  - Risk score
  - Opportunity size estimate (₹ Cr)
- Filters:
  - Category dropdown
  - Sort by: Signal Velocity / Opportunity / Risk
  - Search bar
- “View Full Brief” modal for detail view and execution notes.

## Founder Action Plan (Template)
Use this structure for each shortlisted trend:

1. **Trend Thesis (1 sentence)**
   - Why this is a durable behavior shift, not a temporary content spike.
2. **Hero Product Hypothesis**
   - SKU format, benefit claim, and target cohort.
3. **90-Day Validation Plan**
   - Week 1–2: landing page + waitlist + creator sampling
   - Week 3–6: first micro-batch launch + retention tracking
   - Week 7–12: optimize CAC/ROAS and reorder rates
4. **Risk Controls**
   - Regulatory/compliance checklist
   - Claim substantiation requirements
   - Kill-switch metrics (e.g., repeat rate below threshold)
5. **Scale Trigger**
   - Conditions to invest in inventory, distribution, and brand campaigns.
