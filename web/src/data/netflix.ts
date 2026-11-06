// One record per title from netflix_titles.csv (built by web/scripts/build_data.py).
import raw from "./netflix.json"
import { ALL } from "@/components/filter-bar"

type Raw = { genres: string[]; countries: string[]; ratings: string[]; rows: [number, number | null, number, number, number, number[], number | null][] }
const data = raw as unknown as Raw

export type Title = {
  type: "Movie" | "TV Show"
  added: number | null
  released: number
  rating: string
  country: string
  genres: string[]
  /** Minutes for a movie, seasons for a TV show. */
  length: number | null
}

export const TITLES: Title[] = data.rows.map(([t, added, released, r, c, g, length]) => ({
  type: t === 0 ? "Movie" : "TV Show",
  added,
  released,
  rating: data.ratings[r],
  country: data.countries[c],
  genres: g.map((i) => data.genres[i]),
  length,
}))

// Youngest audience to oldest, then the unrated codes
export const RATING_ORDER = ["TV-Y", "TV-Y7", "TV-Y7-FV", "G", "TV-G", "PG", "TV-PG", "PG-13", "TV-14", "R", "TV-MA", "NC-17", "NR", "UR", "Unrated"]
export const YEARS = Array.from({ length: 2021 - 2008 + 1 }, (_, i) => String(2008 + i))
export const MOVIE_BANDS = ["Under 60 min", "60-89 min", "90-119 min", "120-149 min", "150+ min"]
export const SEASON_BANDS = ["1 season", "2 seasons", "3 seasons", "4 seasons", "5+ seasons"]
export const movieBand = (m: number) => MOVIE_BANDS[m < 60 ? 0 : m < 90 ? 1 : m < 120 ? 2 : m < 150 ? 3 : 4]
export const seasonBand = (s: number) => SEASON_BANDS[Math.min(s, 5) - 1]

const count = <T,>(items: T[]) => {
  const m = new Map<T, number>()
  for (const i of items) m.set(i, (m.get(i) ?? 0) + 1)
  return m
}

// ---------- filters (the slicers)
export type Filters = { type: string; genre: string; country: string; rating: string }
const topCountries = [...count(TITLES.map((t) => t.country))].filter(([c]) => c !== "Unknown").sort((a, b) => b[1] - a[1]).slice(0, 15).map(([c]) => c)
export const options = {
  type: ["Movie", "TV Show"],
  genre: data.genres,
  country: topCountries,
  rating: RATING_ORDER.filter((r) => data.ratings.includes(r)),
}
export const applyFilters = (rows: Title[], f: Filters) =>
  rows.filter(
    (t) =>
      (f.type === ALL || t.type === f.type) &&
      (f.genre === ALL || t.genres.includes(f.genre)) &&
      (f.country === ALL || t.country === f.country) &&
      (f.rating === ALL || t.rating === f.rating),
  )

// ---------- measures
/** Counts per key, in the given order (or highest first when no order is given), as chart data. */
export function tally(keys: string[], order?: string[], top?: number) {
  const m = count(keys)
  const list = order ? order.map((k) => ({ key: k, value: m.get(k) ?? 0 })) : [...m].map(([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value)
  return top ? list.slice(0, top) : list
}

export const median = (xs: number[]) => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/** Plain-language findings that update with the filters. */
export function insights(rows: Title[]): string[] {
  if (!rows.length) return []
  const out: string[] = []
  const movies = rows.filter((t) => t.type === "Movie").length
  if (movies && movies < rows.length) out.push(`${Math.round((movies / rows.length) * 100)}% of these titles are movies and ${Math.round(((rows.length - movies) / rows.length) * 100)}% are TV shows.`)
  const peak = tally(rows.flatMap((t) => (t.added ? [String(t.added)] : [])))[0]
  if (peak) out.push(`The most titles were added in ${peak.key}: ${peak.value.toLocaleString("en-US")}.`)
  const genre = tally(rows.flatMap((t) => t.genres))[0]
  if (genre) out.push(`${genre.key} is the most common genre, on ${genre.value.toLocaleString("en-US")} titles.`)
  const country = tally(rows.map((t) => t.country).filter((c) => c !== "Unknown"))[0]
  if (country) out.push(`${country.key} produced the most, with ${country.value.toLocaleString("en-US")} titles.`)
  const lag = median(rows.flatMap((t) => (t.added ? [t.added - t.released] : [])))
  if (lag != null) out.push(`Half of the titles reached Netflix within ${lag} ${lag === 1 ? "year" : "years"} of release.`)
  return out
}
