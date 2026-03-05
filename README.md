# Next Big Product Radar

A simple, premium web app that helps you spot wellness trends in India and decide if each one is **REAL** or **FAD**.

## What this app does
- Shows trends across categories: **Sleep, Gut, Women, Skin, Focus, Longevity**
- Lets you switch timeline: **7D / 30D / 90D / 12M**
- Pulls live data from server routes (no client-side keys)
- Gives clear labels and plain-English reasons
- Opens a full founder brief page for each trend

## Live signal routes
All routes run on the server with 10-minute cache where needed:

- `GET /api/signals/google-trends?keyword=...&timeline=...`
- `GET /api/signals/youtube?keyword=...&timeline=...`
- `GET /api/signals/reddit?keyword=...&timeline=...`
- `GET /api/signals/pubmed?keyword=...`
- `GET /api/signals/amazon?keyword=...` (stub, OFF unless Amazon keys exist)
- `GET /api/trends?timeline=...`
- `GET /api/brief?keyword=...&timeline=...`

## Simple scoring words used in UI
- **How fast it’s growing**
- **Will it last?**
- **Proof**
- **How crowded is it?**
- **Money potential (₹)**

## REAL vs FAD logic (plain version)
A trend is usually **REAL** when:
- It keeps moving up across the selected timeline
- It does not look like one sharp spike
- More than one source is moving (Google + Reddit + YouTube + PubMed)

A trend is **FAD** when:
- It spikes sharply and cools fast
- Only one source moves
- Proof is weak

## Local setup
1. Create `.env.local` in project root.
2. Add keys (example below).
3. Run:
   ```bash
   node server.js
   ```
4. Open: `http://localhost:3000`

## `.env.local` example
```bash
YOUTUBE_API_KEY=your_youtube_key
AMAZON_API_KEY=
AMAZON_API_SECRET=
PORT=3000
```

## Deployment (Vercel)
1. Push this repo to GitHub
2. Import in Vercel
3. Add environment variables in Vercel Project Settings:
   - `YOUTUBE_API_KEY`
   - optional: `AMAZON_API_KEY`, `AMAZON_API_SECRET`
4. Deploy

> Keys are only read on the server. They are not exposed to the browser.
