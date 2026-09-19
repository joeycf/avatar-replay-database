/**
 * THE CURSOR DELTA — what a bounded pull is allowed to call "new", and the one
 * completion rule this game's record-id rule forces on top of it.
 *
 * Split out of scripts/fetch-theater.ts for the same reason the reference splits
 * it (ggst/sf6 scripts/theater-delta.ts, byte-identical to each other): the
 * fetcher is a long file and this is the rule the fetcher's reported numbers
 * mean, so it is worth reading on its own and worth exercising on its own.
 *
 * ── 1. newerThanCursor (checklist 12g, ported verbatim in behaviour) ─────────
 * The daily pull walks the feed from page 1 and stops after two clean pages, so
 * the pages it reads always hold the newest hundred-odd entries whether or not
 * any of them is new. Cutting the dump from that whole WINDOW makes the intake's
 * reported figure a function of how far we walked: the reference measured a
 * quiet morning printing "0 of 16 tagged" where the 16 moved with the walk length
 * (10 on a two-page pull an hour earlier). A rebuild of already-committed rows
 * costs nothing under add-only, but it mislabels a quiet morning and prints a
 * window-sized number into a file the cron commits.
 *
 * An entry with NO id is kept: add-only makes a spurious rebuild harmless, while
 * a dropped entry would wait for the next full sweep. A full sweep returns
 * everything, exactly as before.
 *
 * ── 2. completeVideos — AVATAR'S ADDITION, AND IT IS NOT A WIDENING ──────────
 * On this game the record id is not a property of a ROW. scripts/parse-finish.ts
 * (:1222-1273) derives it from (videoId, startSeconds, durationSec, ROWS-PER-VIDEO
 * IN THE DUMP): on a video the catalogue lists once, an offset under
 * `segmentOffsetMinShare` is an intro skip and the row is the WHOLE video; on a
 * video it lists more than once, every row is a segment, t=0 included. The
 * fetcher writes `id` by the same rule so the two agree (the wave-2 intake
 * contract says so in as many words).
 *
 * That makes the id a function of how many of a video's rows are in the dump —
 * and the cursor gate above can cut a video's rows in half. The failure is
 * concrete and has a specimen in the live catalogue:
 *
 *   YR7NJYlYKi4 — PrincessSlim's 1,722s FT10, which the catalogue splits into
 *   TWO rows at a support change (#496172 @0 Ghazan, #496173 @259 Ming-Hua, the
 *   same two players; Stage 0 recon §5). With both rows present, rows=2 and both
 *   are segments: `YR7NJYlYKi4@0` and `YR7NJYlYKi4@259`. With a cursor at
 *   496172, the delta holds ONLY #496173: rows=1, 259/1722 = 15.0%, which is
 *   under the 20% floor — so the row becomes the BARE video id and the whole
 *   1,722s upload publishes as one record, beside the `@0` segment already
 *   committed from the run before. One video, two records, one of them claiming
 *   to be the set the other is a clip of.
 *
 * So: when the delta touches a video, it takes every row of that video the read
 * WINDOW holds. That is bounded by the data (a video's rows, not a page count),
 * it is a no-op on a morning where nothing is new — no video is touched, no
 * companion is added — and the companions are counted separately so the "new
 * entries" figure 12g protects stays honest.
 *
 * WHAT IT CANNOT PROMISE, stated rather than hidden: if a video's other rows sit
 * BEYOND the pages this run read, they are not in the window and cannot be
 * completed. The catalogue's rows for one video are contiguous in entry id and
 * adjacent in the feed (all 15 multi-row videos at the 2026-09-16 sweep have
 * contiguous id blocks), so the case needs a video's block to straddle the
 * walk's own bound — which is reported as `hitCursorBound`, and which a `--full`
 * sweep fixes. Under add-only that is late, never lost.
 */

/** In cursor mode, only entries above the committed cursor. */
export function newerThanCursor<T extends { id?: number | null }>(
  entries: T[],
  cursorMode: boolean,
  cursorAt: number,
): T[] {
  if (!cursorMode) return entries;
  return entries.filter((e) => typeof e.id !== 'number' || e.id > cursorAt);
}

export interface Completion<T> {
  /** The delta plus every window row belonging to a video the delta touched. */
  entries: T[];
  /** How many rows that added. Reported separately so the "newer than the
   *  cursor" figure keeps meaning what 12g says it means. */
  companions: number;
  /** Videos whose row set the completion actually changed. */
  videos: number;
}

/**
 * Take every row of every video the delta touches, out of the pages this run
 * read. See the header: the record id is a function of rows-per-video, so a
 * half-delivered video mints the wrong id shape.
 *
 * `videoIdOf` returns undefined for a row whose link yields no video id — those
 * are dropped by the fetcher's link gate anyway and cannot join a group here.
 *
 * Order is irrelevant to the caller (the fetcher sorts by entry id immediately
 * afterwards, so a resumed sweep and a clean one process identical sequences),
 * but it is made deterministic anyway: window order, which is entry-id order.
 */
export function completeVideos<T extends { id?: number | null }>(
  delta: T[],
  window: T[],
  videoIdOf: (e: T) => string | undefined,
): Completion<T> {
  const touched = new Set<string>();
  for (const e of delta) {
    const v = videoIdOf(e);
    if (v) touched.add(v);
  }
  if (touched.size === 0) return { entries: delta, companions: 0, videos: 0 };

  const have = new Set(delta.map((e) => e.id).filter((id): id is number => typeof id === 'number'));
  const added: T[] = [];
  const grew = new Set<string>();
  for (const e of window) {
    const v = videoIdOf(e);
    if (!v || !touched.has(v)) continue;
    // An entry with no id cannot be told apart from one already in the delta, so
    // it is never added as a companion — the same posture newerThanCursor takes
    // in the other direction, and for the same reason: a duplicate rebuild is
    // free, an invented one is not.
    if (typeof e.id !== 'number' || have.has(e.id)) continue;
    have.add(e.id);
    added.push(e);
    grew.add(v);
  }
  return {
    entries: added.length ? [...delta, ...added] : delta,
    companions: added.length,
    videos: grew.size,
  };
}
