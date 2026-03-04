# Next Big Product Radar (India Wellness)

A live-data radar that separates durable wellness trends from short-lived fads for Indian D2C founders.

## What it does
- Pulls **live signals** from:
  - Google Trends (India)
  - Reddit search activity
  - YouTube video publication velocity
  - PubMed research momentum (India-affiliated)
  - Policy/regulatory mentions from FSSAI/CDSCO surfaced via Google News RSS
- Scores each keyword on:
  - Velocity / momentum
  - Market size potential
  - Competition intensity
  - Time-to-mainstream confidence
- Produces an **opportunity brief** for immediate product action.

## Run locally
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
streamlit run app.py
```

## Deployment
Deploy directly on Streamlit Community Cloud (or any container host) using:
- Entry file: `app.py`
- Python: 3.11+
- Install command: `pip install -r requirements.txt`

## D2C insight write-up (<=500 words)
Most Indian wellness “trends” are top-of-funnel attention spikes, not category creation opportunities. The core insight behind this radar is that durable D2C categories in India emerge only when **multiple signal layers** move together: intent (search), conversation (community/social), credibility (research), and institutional readiness (regulatory visibility). A single spike in Google Trends can be hype; synchronized movement across these layers is usually a precursor to repeat purchase behavior.

That is why the scoring system intentionally penalizes one-channel popularity and rewards cross-signal agreement. For example, charcoal toothpaste can trend hard on social media but often lacks improving scientific and regulatory context in parallel. Ashwagandha-like categories, on the other hand, historically show sustained search demand, broad educational content expansion, and a growing body of cited research — which creates trust, lowers customer education friction, and improves retention economics.

Design choices were made for founder usability, not dashboard vanity. The output is an “opportunity brief” rather than raw charts, because operators need decisions: launch now, test lightly, or avoid. Competition intensity is explicitly included so a trend with high demand but saturated creator/store density does not get over-prioritized. Similarly, confidence reflects corroboration breadth, which helps teams avoid overreacting to noisy channels.

I learned that “early” in Indian wellness is less about discovering unknown ingredients and more about detecting when a niche behavior is crossing into mainstream purchasing rituals (daily supplementation, sleep routines, gut-health stacks, etc.). The best opportunities appear where awareness is rising faster than incumbent product quality and brand trust. This is where a focused D2C brand can build a moat through education-led positioning, compliant claims, and subscription mechanics.

In short: the radar is built to answer a founder-level question — **is this a real category curve or a temporary content wave?**
