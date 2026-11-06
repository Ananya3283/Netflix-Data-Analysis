"""Builds web/src/data/netflix.json from netflix_titles.csv (the file the notebook analyses).

Run from the repo root:  python web/scripts/build_data.py
One compact record per title so the dashboard can filter and count exactly.
"""
import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
df = pd.read_csv(ROOT / "netflix_titles.csv")

df["added"] = pd.to_datetime(df["date_added"].str.strip(), format="mixed", errors="coerce").dt.year
df["genres"] = df["listed_in"].fillna("").str.split(", ")
df["country1"] = df["country"].fillna("Unknown").str.split(",").str[0].str.strip()
# A few rows carry the duration in the rating column (e.g. "74 min"); treat those ratings as unknown
df.loc[df["rating"].fillna("").str.contains("min"), "rating"] = None
df["rating"] = df["rating"].fillna("Unrated")
df["minutes"] = df["duration"].where(df["type"] == "Movie").str.extract(r"(\d+)")[0].astype("float")
df["seasons"] = df["duration"].where(df["type"] == "TV Show").str.extract(r"(\d+)")[0].astype("float")
# Movies whose duration landed in the rating column
mask = df["type"].eq("Movie") & df["minutes"].isna()
df.loc[mask, "minutes"] = pd.read_csv(ROOT / "netflix_titles.csv").loc[mask, "rating"].str.extract(r"(\d+)")[0].astype("float")

genres = sorted({g for gs in df["genres"] for g in gs if g})
countries = sorted(df["country1"].unique())
ratings = sorted(df["rating"].unique())
gi = {g: i for i, g in enumerate(genres)}
ci = {c: i for i, c in enumerate(countries)}
ri = {r: i for i, r in enumerate(ratings)}

rows = []
for t in df.itertuples():
    length = t.minutes if t.type == "Movie" else t.seasons
    rows.append([
        0 if t.type == "Movie" else 1,
        None if pd.isna(t.added) else int(t.added),
        int(t.release_year),
        ri[t.rating],
        ci[t.country1],
        [gi[g] for g in t.genres if g],
        None if pd.isna(length) else int(length),
    ])

out = {"genres": genres, "countries": countries, "ratings": ratings,
       "fields": ["type(0 movie,1 tv)", "yearAdded", "releaseYear", "rating", "country", "genres", "minutesOrSeasons"], "rows": rows}
dest = ROOT / "web" / "src" / "data" / "netflix.json"
dest.parent.mkdir(parents=True, exist_ok=True)
dest.write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
print(f"{len(df):,} titles -> {dest.relative_to(ROOT)} ({dest.stat().st_size/1024:.0f} KB)")
print(df["type"].value_counts().to_dict(), "| added years", int(df.added.min()), "-", int(df.added.max()), "| no date_added:", int(df.added.isna().sum()))
print("movie minutes median", df.minutes.median(), "missing", int(df.minutes.isna().sum() - df.type.eq("TV Show").sum()))
