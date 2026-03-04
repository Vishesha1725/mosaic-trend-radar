import math
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Tuple
from xml.etree import ElementTree

import numpy as np
import pandas as pd
import requests
import streamlit as st
from pytrends.request import TrendReq

HEADERS = {"User-Agent": "Mozilla/5.0 (TrendRadarBot/1.0)"}

SEED_KEYWORDS = [
    "ashwagandha",
    "berberine",
    "moringa",
    "saffron gummies",
    "electrolyte drink",
    "protein lassi",
    "gut health",
    "sleep gummies",
    "seed cycling",
    "charcoal toothpaste",
    "collagen peptides",
    "ayurvedic skin barrier",
    "shilajit",
]


@dataclass
class TrendSignal:
    keyword: str
    google_growth: float
    reddit_growth: float
    youtube_growth: float
    research_growth: float
    regulatory_hits: int
    competition_intensity: float
    composite_score: float
    confidence: float
    verdict: str
    opportunity: str


def safe_pct_change(current: float, previous: float) -> float:
    if previous <= 0:
        return 1.0 if current > 0 else 0.0
    return (current - previous) / previous


def clipped(x: float, low: float = -1.0, high: float = 2.5) -> float:
    return float(max(low, min(high, x)))


def google_trends_growth(pytrends: TrendReq, keyword: str) -> Tuple[float, float]:
    pytrends.build_payload([keyword], timeframe="today 12-m", geo="IN")
    frame = pytrends.interest_over_time()
    if frame.empty:
        return 0.0, 0.0
    series = frame[keyword].astype(float)
    recent = series.tail(8).mean()
    past = series.iloc[-16:-8].mean() if len(series) >= 16 else series.head(max(1, len(series) // 2)).mean()
    growth = clipped(safe_pct_change(recent, past))
    velocity = clipped((series.iloc[-1] - series.iloc[-6]) / max(1.0, series.iloc[-6])) if len(series) >= 6 else 0.0
    return growth, velocity


def reddit_growth(keyword: str) -> Tuple[float, float]:
    url = "https://www.reddit.com/search.json"
    q = f"{keyword} (subreddit:IndianSkincareAddicts OR subreddit:india OR subreddit:IndianFood)"
    params = {"q": q, "sort": "new", "t": "year", "limit": 100}
    resp = requests.get(url, headers=HEADERS, params=params, timeout=20)
    resp.raise_for_status()
    posts = resp.json().get("data", {}).get("children", [])
    now = datetime.now(timezone.utc)
    last_30 = 0
    prev_30 = 0
    for p in posts:
        ts = datetime.fromtimestamp(p["data"].get("created_utc", 0), tz=timezone.utc)
        age = (now - ts).days
        if age <= 30:
            last_30 += 1
        elif age <= 60:
            prev_30 += 1
    growth = clipped(safe_pct_change(last_30, prev_30))
    return growth, float(last_30)


def parse_youtube_rss(keyword: str) -> Tuple[float, float]:
    query = keyword.replace(" ", "+") + "+india+wellness"
    url = f"https://www.youtube.com/feeds/videos.xml?search_query={query}"
    resp = requests.get(url, timeout=20)
    resp.raise_for_status()
    root = ElementTree.fromstring(resp.text)
    ns = {"atom": "http://www.w3.org/2005/Atom"}
    now = datetime.now(timezone.utc)
    last_30 = 0
    prev_30 = 0
    for entry in root.findall("atom:entry", ns):
        published = entry.find("atom:published", ns)
        if published is None or not published.text:
            continue
        ts = datetime.fromisoformat(published.text.replace("Z", "+00:00"))
        age = (now - ts).days
        if age <= 30:
            last_30 += 1
        elif age <= 60:
            prev_30 += 1
    growth = clipped(safe_pct_change(last_30, prev_30))
    return growth, float(last_30)


def pubmed_growth(keyword: str) -> Tuple[float, float]:
    base = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
    current_year = datetime.utcnow().year

    def count_for(start_y: int, end_y: int) -> int:
        term = f'({keyword}) AND India[Affiliation] AND ("{start_y}"[DP] : "{end_y}"[DP])'
        params = {"db": "pubmed", "retmode": "json", "term": term}
        r = requests.get(base, params=params, timeout=20)
        r.raise_for_status()
        return int(r.json().get("esearchresult", {}).get("count", 0))

    current = count_for(current_year - 1, current_year)
    previous = count_for(current_year - 3, current_year - 2)
    growth = clipped(safe_pct_change(current, previous))
    return growth, float(current)


def regulatory_hits(keyword: str) -> int:
    q = f"{keyword} site:fssai.gov.in OR site:cdsco.gov.in"
    url = "https://news.google.com/rss/search"
    params = {"q": q, "hl": "en-IN", "gl": "IN", "ceid": "IN:en"}
    r = requests.get(url, params=params, timeout=20)
    r.raise_for_status()
    root = ElementTree.fromstring(r.text)
    items = root.findall("./channel/item")
    return len(items)


def opportunity_brief(keyword: str, verdict: str, market_size_signal: float) -> str:
    size = "₹30Cr+" if market_size_signal > 0.6 else "₹8-25Cr"
    if verdict == "Likely durable trend":
        return (
            f"Position a {keyword}-led D2C line with clinically-backed claims and subscription packs. "
            f"Early demand suggests a {size} 24-month category if brand builds trust moats via education + repeat usage."
        )
    return (
        f"Treat {keyword} as a campaign-led SKU, not a core category. Prioritize low-inventory experiments, "
        "creator seeding, and fast kill metrics before scaling."
    )


def score_trend(keyword: str, pytrends: TrendReq) -> TrendSignal:
    g_growth, g_velocity = google_trends_growth(pytrends, keyword)
    r_growth, r_volume = reddit_growth(keyword)
    y_growth, y_volume = parse_youtube_rss(keyword)
    p_growth, p_volume = pubmed_growth(keyword)
    reg_hits = regulatory_hits(keyword)

    market_size_signal = (max(0, g_growth) + max(0, y_growth) + min(1.0, r_volume / 20.0)) / 3
    competition = min(1.0, (r_volume + y_volume) / 120.0)

    weighted = (
        0.30 * g_growth
        + 0.20 * g_velocity
        + 0.15 * r_growth
        + 0.10 * y_growth
        + 0.15 * p_growth
        + 0.10 * min(1.0, reg_hits / 20)
    )
    confidence = min(1.0, (sum(x > 0 for x in [g_growth, r_growth, y_growth, p_growth]) + (1 if reg_hits > 0 else 0)) / 5)

    verdict = "Likely durable trend" if weighted > 0.28 and confidence >= 0.6 and competition < 0.85 else "Probable fad / early noise"

    return TrendSignal(
        keyword=keyword,
        google_growth=g_growth,
        reddit_growth=r_growth,
        youtube_growth=y_growth,
        research_growth=p_growth,
        regulatory_hits=reg_hits,
        competition_intensity=competition,
        composite_score=weighted,
        confidence=confidence,
        verdict=verdict,
        opportunity=opportunity_brief(keyword, verdict, market_size_signal),
    )


def run_radar(keywords: List[str]) -> pd.DataFrame:
    pytrends = TrendReq(hl="en-US", tz=330)
    rows: List[Dict] = []
    for kw in keywords:
        try:
            s = score_trend(kw, pytrends)
            rows.append(s.__dict__)
        except Exception as exc:
            rows.append(
                {
                    "keyword": kw,
                    "google_growth": np.nan,
                    "reddit_growth": np.nan,
                    "youtube_growth": np.nan,
                    "research_growth": np.nan,
                    "regulatory_hits": np.nan,
                    "competition_intensity": np.nan,
                    "composite_score": -1,
                    "confidence": 0,
                    "verdict": f"Data fetch error: {type(exc).__name__}",
                    "opportunity": "Retry with stable network/API quota.",
                }
            )
    df = pd.DataFrame(rows).sort_values("composite_score", ascending=False).reset_index(drop=True)
    return df


def main() -> None:
    st.set_page_config(page_title="Next Big Product Radar", layout="wide")
    st.title("🇮🇳 Next Big Product Radar — Indian Wellness")
    st.caption("Distinguishes durable trends from fads using live multi-signal evidence and 6-month mainstream likelihood.")

    default_keywords = ", ".join(SEED_KEYWORDS)
    kw_input = st.text_area("Keywords to scan (comma separated)", value=default_keywords, height=110)
    keywords = [k.strip() for k in kw_input.split(",") if k.strip()]

    if st.button("Run live radar"):
        with st.spinner("Fetching live data from Google Trends, Reddit, YouTube, PubMed, and policy/news endpoints..."):
            df = run_radar(keywords)

        top = df.head(10)
        st.subheader("Top opportunity signals")
        st.dataframe(
            top[
                [
                    "keyword",
                    "composite_score",
                    "confidence",
                    "verdict",
                    "google_growth",
                    "reddit_growth",
                    "youtube_growth",
                    "research_growth",
                    "regulatory_hits",
                    "competition_intensity",
                ]
            ],
            use_container_width=True,
        )

        st.subheader("Opportunity briefs")
        for _, row in top.iterrows():
            st.markdown(f"### {row['keyword']} — {row['verdict']}")
            st.write(row["opportunity"])

        st.download_button(
            "Download full radar as CSV",
            df.to_csv(index=False).encode("utf-8"),
            file_name=f"wellness_radar_{datetime.utcnow().date()}.csv",
            mime="text/csv",
        )


if __name__ == "__main__":
    main()
