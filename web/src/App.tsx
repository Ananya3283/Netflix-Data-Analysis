import NumberFlow from "@number-flow/react"
import { AnimatePresence, motion } from "motion/react"
import { parseAsString, useQueryStates } from "nuqs"
import { useMemo } from "react"
import { OrderedColumns, Panel, RankBars, TrendLine, type Series } from "@/components/charts"
import { Figures } from "@/components/figures"
import { ALL, FilterBar, type Field } from "@/components/filter-bar"
import { PageHeader } from "@/components/page-header"
import { MOVIE_BANDS, RATING_ORDER, SEASON_BANDS, TITLES, YEARS, applyFilters, insights, median, movieBand, options, seasonBand, tally, type Filters } from "@/data/netflix"

// Every slicer lives in the URL, so a filtered view can be shared as a link
const params = {
  type: parseAsString.withDefault(ALL),
  genre: parseAsString.withDefault(ALL),
  country: parseAsString.withDefault(ALL),
  rating: parseAsString.withDefault(ALL),
}

const FIELDS: Field[] = [
  { key: "type", label: "Type", all: "Movies and TV", options: options.type, show: (v) => (v === "Movie" ? "Movies" : "TV shows") },
  { key: "genre", label: "Genre", all: "All genres", options: options.genre },
  { key: "country", label: "Country", all: "All countries", options: options.country },
  { key: "rating", label: "Age rating", all: "All ratings", options: options.rating },
]

const SERIES: Series[] = [
  { key: "Movie", label: "Movies", color: "var(--left)" },
  { key: "TV Show", label: "TV shows", color: "var(--kept)" },
]

export default function App() {
  const [q, setQ] = useQueryStates(params)
  const filters: Filters = { type: q.type, genre: q.genre, country: q.country, rating: q.rating }
  const rows = useMemo(() => applyFilters(TITLES, filters), [q.type, q.genre, q.country, q.rating]) // eslint-disable-line react-hooks/exhaustive-deps

  const movies = rows.filter((t) => t.type === "Movie")
  const shows = rows.filter((t) => t.type === "TV Show")
  const series = SERIES.filter((s) => (s.key === "Movie" ? movies.length : shows.length) > 0)
  const byYear = (list: typeof rows) => tally(list.flatMap((t) => (t.added ? [String(t.added)] : [])), YEARS)
  const movieYears = byYear(movies)
  const showYears = byYear(shows)
  const trend = YEARS.map((y, i) => ({ key: y, Movie: movieYears[i].value, "TV Show": showYears[i].value }))

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 sm:px-8">
      <PageHeader title="Netflix catalogue" dataset="Netflix titles dataset, 8,807 movies and TV shows." repo="https://github.com/Ananya3283/Netflix-Data-Analysis" linkText="Code and notebook on GitHub" />

      <div className="sticky top-0 z-20 -mx-4 mt-6 border-b bg-background/90 px-4 py-4 backdrop-blur sm:-mx-8 sm:px-8">
        <FilterBar fields={FIELDS} value={filters} onChange={(k, v) => setQ({ [k]: v === ALL ? null : v })} />
      </div>

      <main className="mt-10">
        {rows.length === 0 ? (
          <p className="py-24 text-center text-muted-foreground">No titles match these filters. Clear one to see results.</p>
        ) : (
          <div className="space-y-12">
            <section className="grid items-start gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
              <div>
                <h1 className="text-4xl leading-[1.05] font-extrabold tracking-tight text-balance sm:text-5xl">
                  <NumberFlow value={rows.length} /> titles.{" "}
                  <span className="text-leaver">
                    <NumberFlow value={movies.length} /> movies
                  </span>
                  ,{" "}
                  <span className="text-kept">
                    <NumberFlow value={shows.length} /> shows.
                  </span>
                </h1>
                <h2 className="mt-8 text-base font-semibold">What stands out</h2>
                <ul className="mt-2 space-y-2.5">
                  <AnimatePresence mode="popLayout" initial={false}>
                    {insights(rows).map((t) => (
                      <motion.li
                        key={t}
                        layout
                        initial={{ opacity: 0, y: 4, filter: "blur(2px)" }}
                        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                        exit={{ opacity: 0, filter: "blur(2px)", transition: { duration: 0.15 } }}
                        transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
                        className="border-l-2 border-leaver pl-3 leading-snug"
                      >
                        {t}
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              </div>
              <Panel title="Titles added to Netflix each year" note="Hover the lines to read a year. 2021 covers January to September.">
                <TrendLine data={trend} series={series} format="int" height={300} />
              </Panel>
            </section>

            <Figures
              items={[
                { label: "Titles", value: rows.length, format: "int" },
                { label: "Movies", value: movies.length, format: "int", tone: "left" },
                { label: "TV shows", value: shows.length, format: "int", tone: "kept" },
                { label: "Countries", value: new Set(rows.map((t) => t.country).filter((c) => c !== "Unknown")).size, format: "int" },
                { label: "Median movie length", value: median(movies.flatMap((t) => (t.length ? [t.length] : []))), format: "int", suffix: " min" },
                { label: "Genres", value: new Set(rows.flatMap((t) => t.genres)).size, format: "int" },
              ]}
            />

            <div className="grid gap-x-12 gap-y-10 lg:grid-cols-2">
              <Panel title="Top 10 genres" note="A title can sit in more than one genre.">
                <RankBars data={tally(rows.flatMap((t) => t.genres), undefined, 10)} format="int" labelWidth={200} />
              </Panel>
              <Panel title="Top 10 producing countries" note="First country listed for each title.">
                <RankBars data={tally(rows.map((t) => t.country).filter((c) => c !== "Unknown"), undefined, 10)} format="int" labelWidth={120} />
              </Panel>
              <Panel title="Age ratings" note="From the youngest audience to the oldest.">
                <OrderedColumns data={tally(rows.map((t) => t.rating), RATING_ORDER).filter((d) => d.value > 0)} format="int" labels={false} />
              </Panel>
              <div className="grid gap-10 sm:grid-cols-2">
                {movies.length > 0 && (
                  <Panel title="Movie length">
                    <OrderedColumns data={tally(movies.flatMap((t) => (t.length ? [movieBand(t.length)] : [])), MOVIE_BANDS).map((d) => ({ ...d, key: d.key.replace(" min", "") }))} format="int" color="var(--left)" />
                  </Panel>
                )}
                {shows.length > 0 && (
                  <Panel title="TV show seasons">
                    <OrderedColumns data={tally(shows.flatMap((t) => (t.length ? [seasonBand(t.length)] : [])), SEASON_BANDS).map((d) => ({ ...d, key: d.key.replace(/ seasons?/, "") }))} format="int" color="var(--kept)" />
                  </Panel>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
