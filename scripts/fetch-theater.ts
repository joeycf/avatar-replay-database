/**
 * Stage 1 for the INDEX intake: pull Replay Theater's Avatar Legends catalogue,
 * join every entry to the YouTube metadata of the VOD it points at (or IS), and
 * dump the result to raw/replayTheater.json for scripts/parse-finish.ts to build
 * records from.
 *
 * Run: npm run data:theater   (and every morning, from the cron)
 *      npm run data:theater -- --full            whole-catalogue reconcile;
 *                                                resumes a cached partial sweep
 *      npm run data:theater -- --fresh           the same, discarding the cache
 *      npm run data:theater -- --full --limit=N  read at most N pages and CACHE
 *                                                — no dump — so a sweep can be
 *                                                driven in pieces
 *      npm run data:theater -- --full --allow-shrink
 *                                                accept a full sweep that falls
 *                                                under the committed record pin
 *
 * ── THE BASE, AND WHAT THIS FILE OWNS ───────────────────────────────────────
 * SF6's fetcher with Fatal Fury's additions, as ggst carries them
 * (ggst-replay-database/scripts/fetch-theater.ts, read end to end): the
 * cursor-gated dump, the HARD refusal on a cursor ahead of the catalogue, the
 * byte-identical partial-resume cache with its self-poisoning check, the
 * offset-past-the-end refusal, the non-fatal collision counter, the full-sweep
 * record floor and the witness envelope. Everything below that the reference
 * does NOT do is measured on THIS catalogue and named where it happens.
 *
 * It writes raw/ only. Every data/ write belongs to parse (checklist 12e): the
 * cursor this run reaches is REPORTED here in the stats file and WRITTEN there,
 * because a fetcher that advanced the cursor itself would advance it for a pull
 * whose records parse then refused, and the next morning would skip those pages
 * forever.
 *
 * ── WHAT THIS CATALOGUE IS ──────────────────────────────────────────────────
 * The platform's SMALLEST catalogue for a game and its RICHEST per row. 244 rows
 * over 93 videos at the 2026-09-18 contract sweep; 231 over 91 two days earlier;
 * 258 over 95 when this file was written, later the same day. IT MOVES, so
 * nothing here pins the count — the floor below is relative to the committed pin
 * and nothing else. Five to six pages of 50, which is why the daily cursor path
 * is in practice a full read today and `hitCursorBound` cannot fire until the
 * catalogue passes ten pages.
 *
 * What makes it load-bearing at that size is the SUPPORT column: `p*_char2` is
 * filled on 100% of rows and no title channel on this game states the support on
 * more than a handful of uploads.
 *
 * ── THE SIX PORT BREAKS, EVERY ONE MEASURED ─────────────────────────────────
 * None of these is present in any sibling, and each one is a defect in the
 * shipped reference when it is pointed at this catalogue.
 *
 * 1. `p*_char2` IS A SUPPORT, NOT A COUNTER-PICK (checklist 13). The reference's
 *    `chars()` (ggst fetch-theater.ts:293-297) folds `p*_char`..`p*_char4` into
 *    one list per side. Here `char3`/`char4` are null on 258 of 258 rows and
 *    `char2` is the support on 258 of 258, so that fold adds a second FIGHTER to
 *    every side, prints a 100% counter-pick rate through the reference's own
 *    recon line (:1128-1147), and mints `Katara` as a second fighter on the one
 *    row where a support name is also a fighter name. Fighters and supports are
 *    read from the columns that declare them, into the two typed tuples
 *    TheaterRawRecord carries (types/index.ts:686-696).
 *
 * 2. `t=` IS h/m/s HERE. The reference's START_VALUE is `/^(\d+)s?$/`
 *    (ggst:253), and 18 of 258 rows (7.0%) write `26m55s`, `35m`, `1h11m20s`,
 *    `2h41m` — all on one dekillsage VOD. Every one reads as an unreadable `t=`
 *    and the ROW IS DROPPED as a bad link. Re-measured live 2026-09-18: with the
 *    seconds-only pattern 18 rows drop; with the h/m/s grammar 258 of 258 parse.
 *    The grammar is read off `ChannelIndex.offsetGrammar`, not hardcoded, because
 *    it is a property of the catalogue and the next one this platform ports will
 *    have its own answer.
 *
 * 3. A `t=0` INSIDE A MULTI-ROW VIDEO IS A SEGMENT. The reference collapses a
 *    zero offset to "no offset at all" (ggst:277-279 `secs > 0 ? … : {}`), which
 *    strips `startSeconds` from the row and hands parse a whole-video entry. Five
 *    multi-row VODs here open at zero, and published that way each one is a
 *    single record standing for an entire 1,722-11,139s tournament. `startSeconds`
 *    is kept AT ZERO when the link states it, and the segment decision is made
 *    below where the rows-per-video count exists.
 *
 * 4. AN OFFSET IS NOT AUTOMATICALLY A SEGMENT (checklist 12k). 26 single-row
 *    videos carry 5-51s INTRO-SKIP offsets on whole per-set uploads, one more
 *    sits at 97s of 738s (13.1%), and only two single-row offsets are real
 *    segments — 5262s of 9381s (56%) and 2576s of 5171s (50%). The populations do
 *    not touch, and `ChannelIndex.segmentOffsetMinShare` (0.2) sits in the gap.
 *    Below it the row is the WHOLE video and takes the bare YouTube id; above it,
 *    or on any video the catalogue lists more than once, it is a segment and
 *    takes `${videoId}@${startSeconds}`.
 *
 * 5. THE LINKS ARE MALFORMED AND `new URL()` MUST NEVER SEE THEM. 51 of 258 are
 *    `https://youtu.be/<id>&t=Ns` — a PATH with no query string — plus `&&t=`,
 *    `&t&t=20s` and one scheme-less `www.youtube.com/watch?v=`. The id is matched
 *    by SHAPE and anything else is refused rather than guessed.
 *
 * 6. LIVENESS IS 0.00% HERE AND MUST BE RE-MEASURED, NEVER INHERITED
 *    (checklist 12h). All 93 videos resolved at the 2026-09-18 sweep, in every
 *    upload month, where CotW measured 32.1% and Strive 9.20%. The catalogue is
 *    nine weeks old and that is the whole explanation. The rate is computed from
 *    this run's own join and written to the stats file; no number is carried in.
 *
 * ── POLITENESS AND QUOTA ────────────────────────────────────────────────────
 * replaytheater.app/robots.txt, read 2026-09-18, is `User-agent: * / Disallow:`
 * — nothing disallowed. Requests carry a contactable user-agent and
 * `ChannelIndex.pacingMs` (1600) between pages; that is politeness to a
 * collaborator, not rate-limit avoidance. The catalogue itself costs no YouTube
 * quota.
 *
 * The join does: one `videos.list` unit per 50 distinct videos, so a whole sweep
 * of this catalogue is TWO units. The planned cost is printed before the call and
 * the spent total after it, because that number is what a reader checks against
 * the six production crons sharing the key. `apiGet` ABORTS on the first
 * quotaExceeded / 429 / bot check instead of retrying (scripts/fetch.ts) and this
 * file lets that abort end the run: on any failure there is simply no dump, parse
 * carries its committed records exactly as on a day this never ran, and the cron
 * stays green (checklist 12d).
 */

import { existsSync, writeFileSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CHANNEL_BY_ID, stripTheaterSponsor } from './channels';
import { QUOTA, QuotaRefusal, fetchVideoMeta, requireApiKey, sleep } from './fetch';
import { isPlaceholderHandle } from './parse';
import { LAUNCH } from './patches';
import { aliasKey } from './roster';
import { completeVideos, newerThanCursor } from './theater-delta';
import type { ChannelConfig, ChannelIndex, TheaterRawRecord } from '../types/index';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW_DIR = join(ROOT, 'raw');
/** THE INTAKE. parse-finish builds one record per row of this file. */
const OUT = join(RAW_DIR, 'replayTheater.json');
/** What the pull learned about ITSELF, beside the dump. parse-finish reads it
 *  (its exported `TheaterStats` is the contract) and `mode` is LOAD-BEARING
 *  there: it is how "committed but absent from the dump" is told apart between
 *  "vanished upstream" (a full sweep saw the whole catalogue) and "not in the
 *  pages we read" (a cursor delta is a few hundred rows off the front). The
 *  PULL'S RECEIPT is both files present — parse keys the cursor advance on that,
 *  never on the dump holding rows. */
const STATS = join(RAW_DIR, '.replayTheater.stats.json');
/** EVERY entry of the read window that passed the per-entry game gate, tagged
 *  and untagged, NOT cursor-gated, plus the VOD metadata the split needs. This
 *  file is the WITNESS: scripts/crosscheck.ts reads it and builds nothing. */
const WITNESS = join(RAW_DIR, 'replayTheater.witness.json');
/** The cursor's committed state — `{ replayTheater: <highest id observed> }`,
 *  keyed by channel id. Written by parse on the pull, only ever forward, and
 *  READ here. */
const CURSOR = join(ROOT, 'data', 'theater-cursor.json');
/** Resume cache for a FULL sweep. See PARTIAL RESUME below. */
const PARTIAL = join(RAW_DIR, '.replayTheater.partial.json');

const found = CHANNEL_BY_ID.get('replayTheater');
if (!found?.index) throw new Error('replayTheater is not registered as an index channel');
// Re-bound as non-optional so the narrowing survives into main() and the signal
// handler — a closure cannot see a top-level type guard.
const CH: ChannelConfig = found;
const INDEX: ChannelIndex = found.index;

// ── flags ───────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const FRESH = argv.includes('--fresh');
/** THE DAILY PATH is the cursor. `--full` forces the whole-catalogue sweep,
 *  which is what a periodic reconcile wants and what the first run ever must be:
 *  a cursor run against an empty cursor reads its page bound, dumps that window
 *  and reports the bound. */
const FULL = argv.includes('--full') || FRESH;
const CURSOR_MODE = !FULL;
const ALLOW_SHRINK = argv.includes('--allow-shrink');
/**
 * Two clean pages, not one.
 *
 * THE REFERENCE'S REASON DOES NOT HOLD HERE AND THE RULE SURVIVES ANYWAY.
 * ggst fetch-theater.ts:139-142 argues the bound from the catalogue ordering
 * `upload_date DESC, id ASC`. Stage 0 measured that claim on this game's feed
 * and the second half is FALSE: upload_date DESC holds (0 inversions over 230
 * adjacent pairs) but within one date the ids are not ascending — 22 of 188
 * same-date adjacent pairs step DOWN. types/index.ts:668-672 records the same
 * finding. So a day's submissions straddling a page boundary is not the only way
 * a new id hides behind a clean page; an out-of-order id on the SAME page is
 * another. Two pages is the right bound for a stronger reason than the one the
 * reference gives, and a cursor simulation over every id in the catalogue
 * (Stage 0, §1) confirms no cursor value misses a row.
 */
const CLEAN_PAGES_TO_STOP = 2;
/** A hard ceiling on the daily path, so a catalogue-side reordering can never
 *  turn the cron into a sweep. The catalogue is 6 pages today, so this bound is
 *  above the whole thing and cannot fire; it is kept at the reference's value
 *  because it is the number that starts mattering the week the catalogue passes
 *  ten pages, and hitting it is reported (`hitCursorBound`), not silent. Under
 *  add-only nothing is lost, only late — the reconcile is `--full`. */
const CURSOR_MAX_PAGES = 10;
/** How often a full sweep checkpoints its cache. An interrupt flushes regardless
 *  of this. */
const CACHE_EVERY_PAGES = 5;

/** `--limit=N` or `--limit N`: the highest page number this run may read. A flag
 *  that is present must carry a usable number or stop the run — `Number(undefined)`
 *  is NaN, `Math.min(pages, NaN)` is NaN, and the walk would then silently read
 *  page 1 alone. */
const LIMIT = ((): number => {
  const eq = argv.find((a) => a.startsWith('--limit='));
  const bare = argv.indexOf('--limit');
  if (!eq && bare === -1) return Infinity;
  const raw = eq ? eq.slice('--limit='.length) : argv[bare + 1];
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    console.error(`✖ --limit needs a positive integer (got ${JSON.stringify(raw)}).`);
    process.exit(1);
  }
  return n;
})();

/** THE TEST SEAM. The endpoint is committed config (scripts/channels.ts) and the
 *  live catalogue moves — 231 rows on 2026-09-16, 244 on 2026-09-18, 258 later
 *  the same day — so a positive control that needs two pulls to be byte-identical
 *  cannot be run against it. A gate serves a frozen fixture and points this here.
 *  Logged loudly whenever it is in effect, so a stray shell variable cannot
 *  quietly turn the cron into a fixture read. */
const ENDPOINT = process.env.REPLAY_THEATER_ENDPOINT ?? INDEX.endpoint;

const UA = 'replay-database/avatar (+https://github.com/joeycf) data:theater';

const pct = (n: number, total: number) => (total === 0 ? '0.0' : ((n / total) * 100).toFixed(1));

// ── the index API ───────────────────────────────────────────────────────────

/** One entry exactly as the catalogue publishes it. Everything is nullable: this
 *  is someone else's schema and we do not get to assume. The four character
 *  columns are all declared even though this game fills two, because a column
 *  that silently starts arriving is a fact about the catalogue and the recon
 *  below counts it. */
export interface TheaterEntry {
  id?: number;
  game?: string | null;
  video_link?: string | null;
  tag?: string | null;
  upload_date?: string | null;
  p1_name?: string | null;
  p2_name?: string | null;
  p1_char?: string | null;
  p1_char2?: string | null;
  p1_char3?: string | null;
  p1_char4?: string | null;
  p2_char?: string | null;
  p2_char2?: string | null;
  p2_char3?: string | null;
  p2_char4?: string | null;
}
interface TheaterPage {
  matches?: TheaterEntry[];
  total_count?: number | string;
}

async function getPage(page: number, retries = 4): Promise<TheaterPage> {
  const url = `${ENDPOINT}?game=${encodeURIComponent(INDEX.slug)}&page=${page}`;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { accept: 'application/json', 'user-agent': UA } });
      if (res.ok) return (await res.json()) as TheaterPage;
      if (res.status >= 500 || res.status === 429) throw new Error(`HTTP ${res.status}`);
      throw new Error(`HTTP ${res.status} (not retryable)\n${await res.text().catch(() => '')}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt >= retries || msg.includes('not retryable')) {
        throw new Error(`Replay Theater page ${page} failed: ${msg}`, { cause: err });
      }
      const wait = Math.min(1500 * 2 ** (attempt - 1), 10_000);
      console.warn(
        `  ⚠ page ${page} (attempt ${attempt}/${retries}): ${msg}; retrying in ${wait}ms`,
      );
      await sleep(wait);
    }
  }
  throw new Error(`Exhausted retries for page ${page}`);
}

// ── video link → (videoId, startSeconds?) ───────────────────────────────────
//
// THE LINKS ARE CONCATENATED, NOT BUILT. The submission form does
// `video_link = base + "&t=" + t + "s"` regardless of what `base` looks like, so
// a youtu.be submission produces `https://youtu.be/<id>&t=554s` — a PATH with no
// query string at all. 51 of 258 links are that shape here. A URL-parsing
// extractor reads the id as `abcdefghijk&t=554s`; this matches the id SHAPE and
// refuses anything else rather than guessing.
export const VIDEO_ID =
  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/(?:live|shorts|embed)\/)([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])/;
// GLOBAL, and the LAST match wins. The form appends its own offset last, so an
// earlier `t=` is whatever the submitter's clipboard carried in. Two links here
// carry two (`?t=5262&t=5262s`, `&t=2576&t=2576s`) and last-wins gives the same
// value on both; the rule still matters because it is the only reading that is
// right when they differ.
const START_ALL = /[?&]t=([^&#]*)/g;
/** `ChannelIndex.offsetGrammar === 'seconds'` — the reference's pattern. */
const START_SECONDS = /^(\d+)s?$/;
/** `'hms'` — `26m55s`, `35m`, `1h11m20s`, `2h41m`, and plain seconds. */
const START_HMS = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/;

/**
 * One `t=` value in seconds, or null when it is not readable under the declared
 * grammar. A `t=` we cannot read is NOT the same as no `t=`: falling through to
 * "whole video" would publish a multi-hour VOD as one match and render exactly
 * like a correct record, so the row is dropped instead.
 *
 * The all-optional h/m/s form matches the EMPTY string with every group
 * undefined, which would silently read `t=` as offset 0 — hence the explicit
 * "at least one group" test rather than a bare `if (!m)`.
 */
export function offsetSeconds(
  value: string,
  grammar: ChannelIndex['offsetGrammar'],
): number | null {
  const v = value.trim();
  if (v === '') return null;
  if (grammar === 'seconds') {
    const m = START_SECONDS.exec(v);
    return m ? Number(m[1]) : null;
  }
  const m = START_HMS.exec(v);
  if (!m || (m[1] === undefined && m[2] === undefined && m[3] === undefined)) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

interface Link {
  videoId: string;
  /** Absent when the entry carried no `t=` at all. PRESENT AND ZERO when the link
   *  states `t=0`, which the reference throws away (ggst:277-279) — see port
   *  break 3 in the header: five multi-row VODs here open at zero and a segment
   *  at zero is still a segment. */
  startSeconds?: number;
  /** How many `t=` params the link carried; >1 is worth seeing in recon. */
  tCount: number;
}

export function parseLink(
  link: string,
  grammar: ChannelIndex['offsetGrammar'],
): Link | { error: string } {
  const id = VIDEO_ID.exec(link ?? '');
  if (!id) return { error: 'no extractable YouTube id' };
  const values = [...(link ?? '').matchAll(START_ALL)].map((m) => m[1] ?? '');
  if (values.length === 0) return { videoId: id[1]!, tCount: 0 };
  const last = values[values.length - 1]!;
  const secs = offsetSeconds(last, grammar);
  if (secs === null) return { error: `unreadable t= value ${JSON.stringify(last)}` };
  return { videoId: id[1]!, startSeconds: secs, tCount: values.length };
}

/**
 * IS THIS ROW A SEGMENT? (checklist 12b, with 12k's floor.)
 *
 * THE TWIN OF scripts/parse-finish.ts:1267-1273, AND IT HAS TO STAY ONE. That
 * file derives the record id itself — from (videoId, startSeconds, durationSec,
 * rows-per-video in the dump) rather than trusting `TheaterRawRecord.id` —
 * because the single-row/multi-row distinction is a property of the whole dump.
 * This function exists so the `id` written into the dump agrees with the one
 * parse derives from it; the wave-2 intake contract says so, and the two are
 * asserted against each other by the shape of the dump itself (a dump whose ids
 * disagree would make parse's `seenHere` counter fire).
 *
 * Exported so a gate can exercise both sides of the rule without a pull.
 */
export function isSegmentEntry(
  rowsForVideo: number,
  startSeconds: number | undefined,
  durationSec: number,
  minShare: number,
): boolean {
  if (startSeconds === undefined) return false;
  // EVERY row of a multi-row video is a segment, t=0 INCLUDED.
  if (rowsForVideo > 1) return true;
  if (startSeconds <= 0 || durationSec <= 0) return false;
  return startSeconds / durationSec >= minShare;
}

/** `vid@start` for a segment, the bare video id for a whole video. Both arms are
 *  load-bearing: `vid@0` for a whole video could never dedupe by id against the
 *  same upload arriving from a tracked channel, and a bare id for a segment would
 *  collapse a VOD's fourteen matches into one. */
const recId = (videoId: string, isSegment: boolean, start: number | undefined): string =>
  isSegment ? `${videoId}@${start}` : videoId;

// ── the two character namespaces ────────────────────────────────────────────
//
// ONE COLUMN EACH, NOT A FOLD. See port break 1. `p*_char3`/`p*_char4` are read
// only to COUNT them: they are null on 258 of 258 rows today, and the day one
// fills is the day this game's assumption changed, which is a thing to see rather
// than a thing to silently absorb.
const cell = (e: TheaterEntry, key: string): string => {
  const v = (e as unknown as Record<string, unknown>)[key];
  return typeof v === 'string' ? v.trim() : '';
};
const fighterOf = (e: TheaterEntry, side: 1 | 2): string => cell(e, `p${side}_char`);
const supportOf = (e: TheaterEntry, side: 1 | 2): string => cell(e, `p${side}_char2`);
const spareColumns = (e: TheaterEntry): number =>
  (['p1_char3', 'p1_char4', 'p2_char3', 'p2_char4'] as const).filter((k) => cell(e, k) !== '')
    .length;

// ── chapters, derived from the VOD description ──────────────────────────────
//
// Two consumers, one derivation. (a) the trust measurement this intake was
// admitted on — the catalogue's offsets against the uploaders' own chapter
// markers — re-run on every pull rather than trusted from the day it was first
// taken; and (b) the WITNESS INDEPENDENCE SPLIT, which scripts/crosscheck.ts
// reads out of the witness file: a segment whose chapter already names both
// handles is a near-dependent witness, because the submitter could have
// transcribed it.
//
// Measured at Stage 0 over the 9 chaptered multi-row VODs holding 111 rows: all
// 111 inside a chapter, 74 exact (66.7%), 89 within 30s (80.2%). The misses are
// one VOD where the catalogue sits 58-77s BEFORE the chapter on 18 of 24 rows —
// systematic offset, not drift. 66 rows sit at a chapter that names the matchup
// and both handles agree on 60 of those (90.9%).
//
// The rule YouTube applies: timestamped lines, at least three, the first at 0:00.
// The last test matters — a description that merely mentions a time is not a
// chapter list.
const CHAPTER_LINE =
  /^\s*(?:\[|\()?(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\]|\))?\s*[-–—:|]?\s*(.+?)\s*$/;

export interface Chapter {
  start: number;
  title: string;
}

export function chaptersOf(description: string): Chapter[] {
  const out: Chapter[] = [];
  for (const line of (description ?? '').split('\n')) {
    const m = CHAPTER_LINE.exec(line);
    if (!m) continue;
    const [, a, b, c, title] = m;
    const start = c ? Number(a) * 3600 + Number(b) * 60 + Number(c) : Number(a) * 60 + Number(b);
    if (title?.trim()) out.push({ start, title: title.trim() });
  }
  if (out.length < 3 || out[0]!.start !== 0) return [];
  return out.sort((x, y) => x.start - y.start);
}

// ── PARTIAL RESUME ──────────────────────────────────────────────────────────
//
// A sweep has to be interruptible, and a resumed sweep has to produce THE SAME
// DUMP an uninterrupted one would — byte for byte — or the resume is a second
// source of truth. Three things make that hold:
//
//   1. The cache is the raw pages as served, keyed by entry id and by page
//      number. Resuming re-fetches page 1 (the cursor bound and total_count live
//      there) and then only the pages not yet cached.
//   2. Nothing downstream depends on READ ORDER. The catalogue is sorted by entry
//      id before any processing, every tie-break below is total, and the dump
//      carries no timestamp and no per-process counter.
//   3. `pagesRead` in the stats and the witness is the number of pages the dump
//      is DRAWN FROM (cached + fetched), not the number this process fetched;
//      `pagesFetched` carries the latter for the log.
//
// At six pages this catalogue does not need a resume. It is carried anyway
// because the cost is one file and the failure it prevents is silent: the same
// cache retired on the daily path in one sibling, kept on the full path in
// another, and the difference is only visible on a sweep nobody is watching.
//
// WHAT A PAGE-NUMBER CACHE CANNOT PROMISE, stated rather than hidden. The
// catalogue grows at the FRONT, so between two halves of a sweep every cached
// page shifts down by however many entries arrived; that costs re-reads at the
// seam and loses nothing. A DELETION upstream between the halves shifts entries
// UP, and up to that many can slide from the first unread page onto the last
// cached one, where this run will not look. Under add-only that is late, never
// lost, and `resumed: true` in the stats means a stitched sweep is never mistaken
// for a clean one.
//
// The cache is REFUSED, not merely ignored, when it was cut for a different slug
// or game label: a sibling once resumed a cache left over from an era when the
// endpoint returned everything and wrote another game's rows into this game's
// witness.
interface PartialCache {
  slug: string;
  gameLabel: string;
  /** The newest id on page 1 when the cache was cut — for the log, so the seam's
   *  drift is visible. */
  newestOnPage1: number;
  pages: number[];
  entries: TheaterEntry[];
}

const byTheaterId = new Map<number, TheaterEntry>();
const seenPages = new Set<number>();
let cacheNewestOnPage1 = 0;
let walking = false;

const cacheShape = (): PartialCache => ({
  slug: INDEX.slug,
  gameLabel: INDEX.gameLabel,
  newestOnPage1: cacheNewestOnPage1,
  pages: [...seenPages].sort((a, b) => a - b),
  entries: [...byTheaterId.entries()].sort((a, b) => a[0] - b[0]).map(([, e]) => e),
});

const flushCache = (): void => {
  writeFileSync(PARTIAL, JSON.stringify(cacheShape()), 'utf8');
};

// ── the pull ────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  // BEFORE ANYTHING IS DELETED. The reference calls requireApiKey at module
  // scope (ggst:184), which both kills any script that merely imports the module
  // and — because the removals below run first — destroys a good dump over a
  // missing environment variable. scripts/fetch.ts states the rule this follows:
  // each entry point asks for the key, importing never does.
  requireApiKey('data:theater');

  await mkdir(RAW_DIR, { recursive: true });

  // Flush the resume cache on interrupt, synchronously, then exit with the
  // conventional code. A SIGKILL cannot be caught and loses at most
  // CACHE_EVERY_PAGES - 1 pages. Registered HERE rather than at module scope so
  // importing this file for `chaptersOf` or `isSegmentEntry` does not install
  // signal handlers in somebody else's process.
  for (const sig of ['SIGINT', 'SIGTERM'] as const) {
    process.on(sig, () => {
      if (FULL && walking) {
        flushCache();
        console.error(
          `\n  interrupted by ${sig} — cached ${seenPages.size} page(s), ` +
            `${byTheaterId.size} entr(ies). Resume with: npm run data:theater -- --full`,
        );
      }
      process.exit(sig === 'SIGINT' ? 130 : 143);
    });
  }

  // CLEAR THE PREVIOUS RUN'S ARTIFACTS BEFORE FETCHING ANYTHING. parse reads the
  // stats file to learn what this pull did — its mode, its page count, the cursor
  // it reached — and a file left over from yesterday would answer those questions
  // about the wrong run: a pull that dies on the first request would otherwise
  // leave parse reading "the pull found no new entries" instead of "no pull this
  // run", and re-advancing the cursor off a number this run never observed. The
  // dump goes too, so a failed local pull looks exactly like a failed CI pull
  // (no dump), rather than leaving yesterday's rows beside no stats to describe
  // them. Invisible in CI, where a fresh checkout has no raw/ at all — which is
  // exactly why it is done here.
  await rm(STATS, { force: true });
  await rm(WITNESS, { force: true });
  await rm(OUT, { force: true });

  if (ENDPOINT !== INDEX.endpoint) {
    console.warn(
      `  ⚠ REPLAY_THEATER_ENDPOINT is set — reading ${ENDPOINT}, not the live catalogue`,
    );
  }

  // THE CURSOR. Entry ids increase with submission and the feed is newest-first,
  // so "have I seen everything new?" is answerable from the front of the feed:
  // keep paging until CLEAN_PAGES_TO_STOP consecutive pages offer no id above the
  // cursor.
  //
  // WHY NOT `?since=` OR A REAL CURSOR: there isn't one. Only `game` and `page`
  // are honoured, and `game` is validated — `avatarlegends`, `ava` and `Avatar`
  // all return HTTP 400 "Invalid game" (probed 2026-09-16), so the per-entry game
  // gate below is a second line, not the only one.
  //
  // WHAT THE CURSOR CANNOT SEE, stated rather than hidden: the ordering key is
  // the VIDEO's upload date, not the submission's. Someone submitting a July VOD
  // today lands deep in the feed, behind the bound, and this run will not reach
  // it. It happens here — Stage 0 found 22 rows on pages 2-3 with ids above page
  // 1's lowest, e.g. three August uploads submitted around 09-13. Under add-only
  // that is late, never lost: the entry keeps its id and a `--full` sweep collects
  // it.
  const cursorFile = await readFile(CURSOR, 'utf8')
    .then((t) => JSON.parse(t) as Record<string, number>)
    .catch(() => ({}) as Record<string, number>);
  const cursorAt = Number(cursorFile[CH.id] ?? 0) || 0;

  let resumed = false;
  if (FRESH) {
    await rm(PARTIAL, { force: true });
  } else if (FULL && existsSync(PARTIAL)) {
    const cache = JSON.parse(await readFile(PARTIAL, 'utf8')) as Partial<PartialCache>;
    if (cache.slug !== INDEX.slug || cache.gameLabel !== INDEX.gameLabel) {
      console.warn(
        `  ⚠ ignoring raw/.replayTheater.partial.json: cut for game=${JSON.stringify(cache.slug)} ` +
          `${JSON.stringify(cache.gameLabel)}, this run is game=${INDEX.slug} ` +
          `${JSON.stringify(INDEX.gameLabel)}`,
      );
      await rm(PARTIAL, { force: true });
    } else {
      for (const p of cache.pages ?? []) if (Number.isInteger(p) && p >= 1) seenPages.add(p);
      for (const e of cache.entries ?? []) if (typeof e.id === 'number') byTheaterId.set(e.id, e);
      cacheNewestOnPage1 = Number(cache.newestOnPage1 ?? 0) || 0;
      resumed = seenPages.size > 0;
      if (resumed) {
        console.log(
          `  resuming a partial sweep: ${seenPages.size} page(s), ` +
            `${byTheaterId.size} entr(ies) cached`,
        );
      }
    }
  } else if (CURSOR_MODE && existsSync(PARTIAL)) {
    console.log(
      '  (a partial full-sweep cache is present and untouched by this cursor run; ' +
        '`--full` resumes it, `--fresh` discards it)',
    );
  }

  console.log(`\n▶ Pulling the Replay Theater index (${ENDPOINT}, game=${INDEX.slug})…`);
  const first = await getPage(1);

  // ── THE CURSOR CANNOT BE AHEAD OF THE CATALOGUE (checklist 12f) ───────────
  // Page 1 holds the newest entries, so the highest id ON IT is the highest id
  // the catalogue has. A committed cursor above that is not "nothing new today" —
  // it is impossible, and it is SILENT: every page reads as clean, the stop rule
  // fires after two, and this intake never ingests another entry for as long as
  // the file says so. The cron stays green the whole time.
  //
  // REFUSE RATHER THAN CLAMP, AND RATHER THAN FALL BACK. Warning and full-sweeping
  // instead cannot heal, because parse only writes the cursor when the pull's
  // highest id is ABOVE the committed one and a real sweep's highest id never is —
  // so a poisoned cursor becomes a whole-catalogue sweep every morning forever,
  // traceable only to a console.warn inside a step that is already expected to be
  // yellow. Clamping is just as wrong: it hides which entries were skipped while
  // the cursor was bad. Red until a human fixes the file, on the daily path AND on
  // --full, because --full is exactly the run that would otherwise mask it.
  const newestOnPage1 = (first.matches ?? []).reduce((m, e) => Math.max(m, e.id ?? 0), 0);
  if (cursorAt > 0 && newestOnPage1 > 0 && cursorAt > newestOnPage1) {
    console.error(
      [
        `\n✖ The committed cursor is AHEAD of the catalogue.`,
        ``,
        `  data/theater-cursor.json  ${cursorAt}`,
        `  newest id on page 1       ${newestOnPage1}`,
        ``,
        `  Page 1 is the newest entries, so nothing in the catalogue can be above it.`,
        `  Left alone this is silent: every page reads as already-seen, the pull stops`,
        `  after two, and this intake never ingests again while the file says so.`,
        ``,
        `  Set data/theater-cursor.json to the highest id this repo has actually SEEN`,
        `  — the maxEntryId of its last full sweep — and re-run. If in doubt, 0 is`,
        `  always safe: a full sweep re-reads everything and the intake is add-only.`,
      ].join('\n'),
    );
    process.exit(1);
  }
  if (resumed && cacheNewestOnPage1 > 0 && cacheNewestOnPage1 !== newestOnPage1) {
    console.log(
      `  the catalogue moved since the cache was cut (page-1 newest ${cacheNewestOnPage1} → ` +
        `${newestOnPage1}); pages re-read at the seam, and a deletion in between stays ` +
        `invisible until --fresh`,
    );
  }
  cacheNewestOnPage1 = newestOnPage1;

  const total = Number(first.total_count ?? 0) || 0;
  const fullPages = Math.ceil(total / INDEX.pageSize);
  const pages = CURSOR_MODE
    ? Math.min(CURSOR_MAX_PAGES, fullPages, LIMIT)
    : Math.min(fullPages, LIMIT);
  console.log(
    CURSOR_MODE
      ? `  catalogue reports ${total} match(es) (${fullPages} page(s) of ${INDEX.pageSize}); ` +
          `cursor at entry id ${cursorAt || '—'}, reading at most ${pages}`
      : `  catalogue reports ${total} match(es) → ${pages} of ${fullPages} page(s) of ` +
          `${INDEX.pageSize}`,
  );

  let noId = 0;
  const add = (rows: TheaterEntry[]): void => {
    for (const e of rows) {
      if (typeof e.id === 'number') byTheaterId.set(e.id, e);
      else noId++;
    }
  };
  add(first.matches ?? []);
  seenPages.add(1);

  // cleanRun is SEEDED FROM PAGE 1: a fully quiet morning is two pages, which is
  // the number the stop rule was argued for, not three.
  let cleanRun = (first.matches ?? []).some((e) => (e.id ?? 0) > cursorAt) ? 0 : 1;
  let pagesFetched = 1;
  let stoppedEarly = false;
  walking = true;
  for (let page = 2; page <= pages; page++) {
    if (CURSOR_MODE && cleanRun >= CLEAN_PAGES_TO_STOP) {
      stoppedEarly = true;
      break;
    }
    if (seenPages.has(page)) continue;
    await sleep(INDEX.pacingMs);
    const body = await getPage(page);
    const rows = body.matches ?? [];
    add(rows);
    seenPages.add(page);
    pagesFetched++;
    cleanRun = rows.some((e) => (e.id ?? 0) > cursorAt) ? 0 : cleanRun + 1;
    // An empty page is the end of the catalogue, not a clean page to count.
    if (rows.length === 0) {
      stoppedEarly = true;
      break;
    }
    if (FULL && page % CACHE_EVERY_PAGES === 0) flushCache();
  }
  walking = false;
  if (CURSOR_MODE && cleanRun >= CLEAN_PAGES_TO_STOP) stoppedEarly = true;
  // Checkpoint once more at the END of the walk: the join below spends API units
  // and the signal handler only flushes while walking, so an interrupt or a quota
  // refusal during the join would otherwise resume with up to
  // CACHE_EVERY_PAGES - 1 pages of re-reads. A completed sweep retires the cache
  // at the very end.
  if (FULL) flushCache();

  // ── a PARTIAL sweep stops here, with the cache and without a dump ─────────
  // A truncated full sweep written as a dump would be a lie in either mode label:
  // as `full`, parse would read every committed row it does not contain as
  // vanished upstream; as `cursor`, the delta gate would apply to a window it was
  // never meant for. So --limit on the full path is a checkpoint, not a
  // deliverable. Exit 0: the run did what it was asked.
  if (FULL && pages < fullPages && !stoppedEarly) {
    flushCache();
    console.log(
      `\n  partial sweep: ${seenPages.size} of ${fullPages} page(s) cached ` +
        `(${byTheaterId.size} entr(ies)), no dump written.\n` +
        `  Resume with: npm run data:theater -- --full`,
    );
    return;
  }

  // EVERYTHING BELOW IS ORDER-INDEPENDENT. Sorted by the catalogue's own entry id
  // — a total order that does not depend on which pages were cached and which were
  // fetched — so a resumed sweep and a clean one process identical sequences.
  const catalogue = [...byTheaterId.values()].sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
  /** The highest id THIS RUN observed, PRE-GAME-GATE: the cursor is a position in
   *  the feed and a wrong-game row it passed was still passed. parse writes it
   *  into data/theater-cursor.json when it is above the committed value. */
  const highestId = catalogue.reduce((m, e) => Math.max(m, e.id ?? 0), 0);
  /** Seeded with the committed cursor so a bounded window cannot report a value
   *  below it. This is `TheaterStats.maxEntryId`, the field parse reads. */
  const maxEntryId = Math.max(highestId, cursorAt);
  const hitBound = CURSOR_MODE && !stoppedEarly && pagesFetched >= pages && fullPages > pages;
  console.log(
    CURSOR_MODE
      ? `  read ${pagesFetched} page(s), ${catalogue.length} entr(ies); ` +
          `${catalogue.filter((e) => (e.id ?? 0) > cursorAt).length} newer than the cursor → ` +
          `new cursor ${maxEntryId}`
      : `  ${catalogue.length} unique entr(ies) over ${seenPages.size} page(s)` +
          `${resumed ? ` (${pagesFetched} fetched this run, the rest resumed)` : ''}`,
  );
  if (noId) {
    console.log(
      `  ⚠ ${noId} row(s) carried no entry id and were dropped — not resumable, not cursorable`,
    );
  }
  if (hitBound) {
    console.warn(
      `  ⚠ the cursor hit its ${pages}-page bound without going quiet — entries may be\n` +
        `    unreached this run. Nothing is lost (add-only); run \`npm run data:theater -- --full\`\n` +
        `    to reconcile. Recorded as hitCursorBound in the stats file.`,
    );
  }

  // ── the game gate, PER ENTRY (checklist 12a) ──────────────────────────────
  // `?game=avatar` is a query someone else answers, and an index is a strictly
  // weaker guarantee than a channel: a mistagged submission would arrive looking
  // exactly like a real one. Every entry states its own game, so check that
  // instead of the query — exactly, against the committed label. 258 of 258
  // passed on 2026-09-18.
  //
  // THIS GATE IS THE FETCHER'S ALONE. `TheaterRawRecord` carries no game field
  // (types/index.ts:662-697), so a mistagged row must never reach the dump; its
  // count comes back through `stats.wrongGame` and parse-finish prints it in the
  // sweep-hygiene line. The wave-2 intake contract fixes that division.
  const wrongGame = catalogue.filter((e) => (e.game ?? '').trim() !== INDEX.gameLabel);
  const rightGame = catalogue.filter((e) => (e.game ?? '').trim() === INDEX.gameLabel);
  if (wrongGame.length) {
    console.log(
      `  ⚠ ${wrongGame.length} entr(ies) rejected — entry.game is not ` +
        `${JSON.stringify(INDEX.gameLabel)}:`,
    );
    for (const e of wrongGame.slice(0, 5)) {
      console.log(`      #${e.id} game=${JSON.stringify(e.game)} ${e.video_link ?? ''}`);
    }
    if (wrongGame.length > 5) console.log(`      … ${wrongGame.length - 5} more`);
  }

  // ── scope: IN CURSOR MODE, ONLY WHAT IS NEWER THAN THE CURSOR (12g) ───────
  const delta = newerThanCursor(rightGame, CURSOR_MODE, cursorAt);

  // ── scope: WHICH ARMS ENTER THE INTAKE — read off the config, not assumed ─
  // `admitUntagged` (scripts/channels.ts) decides whether the untagged arm is a
  // SOURCE here or only a witness. It is TRUE on this game and the 34 untagged
  // rows are ordinary whole-video sets from player channels, as real as the
  // tagged ones. It gates what gets BUILT and nothing else — the witness below is
  // written from `rightGame` and holds both arms regardless, because evidence is
  // not the same question as ingestion. What keeps the untagged arm from
  // re-minting our own uploads is parse's known-anywhere ignore, which decides a
  // large share of this intake: 158 of 244 rows at Stage 0 were segments inside
  // VODs whose uploaders are tracked channels here.
  const isTagged = (e: TheaterEntry): boolean => (e.tag ?? '').trim() !== '';
  const armed = INDEX.admitUntagged ? delta : delta.filter(isTagged);

  // ── scope: A VIDEO ARRIVES WHOLE (see scripts/theater-delta.ts) ───────────
  // The record id is a function of rows-per-video IN THE DUMP, so a cursor that
  // splits a video's rows changes what those rows ARE. Live specimen in the
  // header of that file. Counted separately so the 12g figure stays honest.
  const idOf = (e: TheaterEntry): string | undefined =>
    VIDEO_ID.exec(e.video_link ?? '')?.[1] ?? undefined;
  const completion = completeVideos(
    armed,
    INDEX.admitUntagged ? rightGame : rightGame.filter(isTagged),
    idOf,
  );
  const inScope = completion.entries;
  const taggedInDelta = delta.filter(isTagged).length;
  console.log(
    `  ${delta.length} entr(ies)${CURSOR_MODE ? ` newer than the cursor, of ${rightGame.length} read` : ''}: ` +
      `${taggedInDelta} tagged, ${delta.length - taggedInDelta} untagged` +
      (INDEX.admitUntagged
        ? ' — both arms admitted (admitUntagged)'
        : ` — untagged arm is witness only (admitUntagged: false)`),
  );
  if (completion.companions) {
    console.log(
      `  + ${completion.companions} companion row(s) across ${completion.videos} video(s) the ` +
        `delta touched — the record id depends on rows-per-video, so a video arrives whole`,
    );
  }

  // ── links ─────────────────────────────────────────────────────────────────
  // COUNTED, NOT FATAL. SF6 exits on one unusable link, which is right when the
  // catalogue has none and would fail every run of this one. A bad link costs its
  // own row and nothing else; the count is in the stats file and five examples are
  // in the log. 0 of 258 fail today — the malformed shapes are all READ, which is
  // the point of matching the id by shape rather than parsing a URL.
  const linked: Array<{ e: TheaterEntry; link: Link }> = [];
  const badLinks: Array<{ e: TheaterEntry; why: string }> = [];
  for (const e of inScope) {
    const got = parseLink(e.video_link ?? '', INDEX.offsetGrammar);
    if ('error' in got) badLinks.push({ e, why: got.error });
    else linked.push({ e, link: got });
  }
  if (badLinks.length) {
    console.log(
      `  ⚠ ${badLinks.length} entr(ies) have an unusable video link — dropped, not guessed:`,
    );
    for (const u of badLinks.slice(0, 5)) {
      console.log(`      #${u.e.id} ${u.why} — ${JSON.stringify(u.e.video_link)}`);
    }
    if (badLinks.length > 5) console.log(`      … ${badLinks.length - 5} more`);
  }

  // ── join to the VODs (checklist 12h) ──────────────────────────────────────
  // LIVENESS IS THIS JOIN. videos.list silently omits a deleted or private id, so
  // absence from the map IS the dead signal — no HEAD, no oEmbed. An unlisted
  // video resolves and counts, which matters here: one of the catalogue's videos
  // is unlisted and it is a real set.
  //
  // THE RATE IS RE-MEASURED, NEVER INHERITED. 0.00% at Stage 0 across every upload
  // month, against a sibling's 9.20% and another's 32.1%. The direction that makes
  // complacency cheap is exactly this one, so the number is computed here and
  // written to the stats file rather than asserted anywhere.
  const vodIds = [...new Set(linked.map((l) => l.link.videoId))].sort();
  const plannedUnits = Math.ceil(vodIds.length / 50);
  console.log(
    `\n▶ Resolving ${vodIds.length} video(s) on YouTube — ${plannedUnits} quota unit(s) ` +
      `(1 per 50). The key is shared with six production crons.`,
  );
  const vods = await fetchVideoMeta(vodIds);
  const missing = vodIds.filter((id) => !vods.has(id));
  const unresolvablePct = vodIds.length
    ? Number(((missing.length / vodIds.length) * 100).toFixed(1))
    : 0;

  // ── candidates: resolved, and inside their own VOD ────────────────────────
  interface Candidate {
    e: TheaterEntry;
    link: Link;
    vod: NonNullable<ReturnType<typeof vods.get>>;
  }
  const candidates: Candidate[] = [];
  /** Segments whose offset lies past the end of their own VOD — counted and
   *  dropped, reported as a rate, never fatal. */
  const pastEnd: string[] = [];
  for (const { e, link } of linked) {
    const vod = vods.get(link.videoId);
    if (!vod) continue; // unresolvable video — counted above, never built
    // AN OFFSET PAST THE END OF ITS OWN VOD IS NOT A MATCH, and this is the last
    // place both numbers are in scope together for a REFUSAL: the row still
    // carries the VOD's duration downstream, but parse asks no duration floor of
    // a segment, so nothing after this compares them. Without the check the row
    // ships as a real record whose viewer lands past the end.
    //
    // 0 rows fail it here (the smallest margin at Stage 0 was 371s) — and the
    // reason to carry it anyway is that the check only exists in the reference
    // because a live specimen turned up in a 60-row sample of a sibling's
    // catalogue, i.e. it is a standing property of submitted data rather than an
    // incident. It also FAILS SAFE against port break 2: read a `1h11m20s` offset
    // as garbage and you get no offset, read it as `1` and you get an intro skip;
    // read it right and it is 4,280s, which this check is the only thing
    // bounding.
    if (
      link.startSeconds !== undefined &&
      vod.durationSec > 0 &&
      link.startSeconds >= vod.durationSec
    ) {
      pastEnd.push(
        `${link.videoId}@${link.startSeconds} — RT #${e.id}, but the VOD runs ${vod.durationSec}s`,
      );
      continue;
    }
    candidates.push({ e, link, vod });
  }
  if (pastEnd.length) {
    console.log(
      `  ⚠ ${pastEnd.length} segment(s) start past the end of their own VOD — dropped, not published:`,
    );
    for (const l of pastEnd.slice(0, 5)) console.log(`      ${l}`);
    if (pastEnd.length > 5) console.log(`      … ${pastEnd.length - 5} more`);
  }

  // ── the same moment, submitted twice ──────────────────────────────────────
  //
  // THE KEY IS (videoId, startSeconds), NOT THE RECORD ID, AND THAT IS A
  // CONSEQUENCE OF THE SEGMENT RULE. On the reference the record id can be
  // computed from the link alone, so it dedupes on the id and then discovers
  // collisions. Here the id needs the rows-per-video count, which needs the
  // deduplicated set — a circle. Keying on the physical moment breaks it, and it
  // is also the stronger key: two entries at one (video, offset) are the same
  // moment whatever the id rule later calls them, and no two distinct moments can
  // collide on an id afterwards (asserted below).
  //
  // WHAT IS LEFT IS COUNTED, NOT FATAL. A group whose entries describe the same
  // match is a double submission and collapses silently; a group that does not is
  // a genuine upstream data error — two different matches at one moment — and the
  // lower entry id survives. Upstream data errors are a standing condition of a
  // third-party catalogue, and refusing the whole dump over one of them is the
  // wrong trade. 0 groups of either kind exist today.
  const byMoment = new Map<string, Candidate[]>();
  for (const c of candidates) {
    const key = `${c.link.videoId} ${c.link.startSeconds ?? -1}`;
    byMoment.set(key, [...(byMoment.get(key) ?? []), c]);
  }
  const matchKey = (e: TheaterEntry): string =>
    [
      (e.p1_name ?? '').trim(),
      (e.p2_name ?? '').trim(),
      fighterOf(e, 1),
      supportOf(e, 1),
      fighterOf(e, 2),
      supportOf(e, 2),
    ].join(' ');
  const deduped: Candidate[] = [];
  const collapsedTags = new Map<string, number>();
  let collapsed = 0;
  const collisions: string[] = [];
  for (const [key, group] of byMoment) {
    if (group.length === 1) {
      deduped.push(group[0]!);
      continue;
    }
    // Sorted on the tag spelling and then on the ENTRY ID, so the survivor never
    // depends on read order — a resumed sweep must collapse the way a clean one
    // does.
    const sorted = [...group].sort(
      (a, b) =>
        (a.e.tag ?? '').trim().localeCompare((b.e.tag ?? '').trim()) ||
        (a.e.id ?? 0) - (b.e.id ?? 0),
    );
    if (group.every((g) => matchKey(g.e) === matchKey(group[0]!.e))) {
      deduped.push(sorted[0]!);
      collapsed += group.length - 1;
      const pair = [...new Set(group.map((g) => (g.e.tag ?? '').trim()))].sort().join('  ||  ');
      collapsedTags.set(pair, (collapsedTags.get(pair) ?? 0) + group.length - 1);
      continue;
    }
    collisions.push(
      [
        `  ${key.replace(' ', ' @')}`,
        ...sorted.map(
          (g) => `    #${g.e.id}  ${g.e.p1_name} vs ${g.e.p2_name}  [${(g.e.tag ?? '').trim()}]`,
        ),
      ].join('\n'),
    );
    deduped.push([...group].sort((a, b) => (a.e.id ?? 0) - (b.e.id ?? 0))[0]!);
  }
  if (collapsed > 0) {
    console.log(`\n  collapsed ${collapsed} double-submitted entr(ies) — same moment, same match:`);
    for (const [pair, n] of [...collapsedTags].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
      console.log(`      ${n}×  ${pair || '(untagged)'}`);
    }
  }
  if (collisions.length) {
    console.log(
      `\n  ⚠ ${collisions.length} collision(s) the collapse cannot explain — two different ` +
        `matches at one (video, offset); the lower entry id survives, the rest are counted:`,
    );
    console.log(collisions.slice(0, 5).join('\n'));
    if (collisions.length > 5) console.log(`      … ${collisions.length - 5} more`);
  }

  // ── rows per video, and only then the id ──────────────────────────────────
  // Counted over the SURVIVORS — the rows this file is about to write — because
  // that is the set parse-finish counts over when it re-derives the id
  // (parse-finish.ts:1225-1226). Counting before the collapse would let a
  // double-submitted single-row video read as multi-row on this side and
  // single-row on that one, which is exactly the disagreement the shared rule
  // exists to prevent.
  const rowsPerVideo = new Map<string, number>();
  for (const c of deduped) {
    rowsPerVideo.set(c.link.videoId, (rowsPerVideo.get(c.link.videoId) ?? 0) + 1);
  }

  const records: TheaterRawRecord[] = [];
  const seenIds = new Set<string>();
  let spareColumnRows = 0;
  for (const { e, link, vod } of deduped) {
    const rows = rowsPerVideo.get(link.videoId) ?? 1;
    const isSegment = isSegmentEntry(
      rows,
      link.startSeconds,
      vod.durationSec,
      INDEX.segmentOffsetMinShare,
    );
    const id = recId(link.videoId, isSegment, link.startSeconds);
    if (seenIds.has(id)) {
      // Unreachable by construction — the moment key above is unique and the id
      // is a function of it — so this is an invariant, not a counter. If it ever
      // fires, the id rule and the moment key have drifted apart and the dump
      // would silently lose a row inside parse's own `seenHere`.
      throw new Error(
        `Two rows resolved to record id ${JSON.stringify(id)} (entry #${e.id}). The (videoId, ` +
          `startSeconds) key is supposed to make that impossible; the id rule and the dedupe ` +
          `key have drifted. Nothing written.`,
      );
    }
    seenIds.add(id);
    if (spareColumns(e) > 0) spareColumnRows++;

    // TRIMMED, AND OTHERWISE VERBATIM. Handles keep their sponsor prefixes for the
    // parser to strip (scripts/channels.ts stripTheaterSponsor), and a placeholder
    // handle would pass through untouched: dropping one is parse's rule, and a
    // dump that silently strips rows cannot be audited against the catalogue.
    // There are none here — and the predicate that finds them is parse's own
    // (scripts/parse.ts isPlaceholderHandle), which is where `♱` is a REAL player
    // rather than punctuation to delete.
    const tag = String(e.tag ?? '').trim();
    const p1 = String(e.p1_name ?? '').trim();
    const p2 = String(e.p2_name ?? '').trim();
    const f1 = fighterOf(e, 1);
    const f2 = fighterOf(e, 2);
    const s1 = supportOf(e, 1);
    const s2 = supportOf(e, 2);

    records.push({
      id,
      channel: 'replayTheater',
      // SYNTHESIZED — the catalogue carries no title. It follows this corpus's
      // dominant `HANDLE (Fighter/Support)` grammar, which is the shape 29 of the
      // 32 title channels write and the slot order channels.ts declares for this
      // intake, so cards read consistently. `title` is also the engine's search
      // haystack, which is why the catalogue's tag rides in the trailing slot:
      // that placement is what makes "Aegis Esports x ZenMarket #1" findable with
      // no new facet, field or render surface. The tag goes in WHATEVER it is —
      // an event or a set format — because both are things a person searches for;
      // what must never happen is a FORMAT reaching `Replay.event`, and that
      // decision belongs to parse-finish (ChannelIndex.formatTagPattern), not
      // here.
      title:
        `Avatar Legends ▰ ${p1 || '?'} (${[f1, s1].filter(Boolean).join('/')}) vs ` +
        `${p2 || '?'} (${[f2, s2].filter(Boolean).join('/')})` +
        (tag ? ` ▰ ${tag}` : ''),
      // EMPTY, DELIBERATELY. RawVideoRecord.description feeds the description
      // character tier, and an index row parses no title and no description: its
      // characters come from typed columns. Carrying the VOD's description would
      // also give every one of a tournament VOD's fourteen segments the same text,
      // describing thirteen matches that are not this record.
      description: '',
      // The VOD's real publish time. Deliberately NOT offset by startSeconds: that
      // would shift a record by up to three hours and could cross a day-grained
      // patch boundary, which is the authority era and patch are derived from.
      // Segments inside one VOD therefore share a timestamp, which is why the sort
      // below carries a tie-break.
      //
      // NOT `upload_date` EITHER. The catalogue's own date differs from the VOD's
      // publish date on 31 of 231 rows, and on three of them it is the MATCH date
      // read out of the video's title (-9, -11 and -22 days). It is a submitter's
      // field; publishedAt is YouTube's.
      publishedAt: vod.publishedAt,
      // THE VOD'S OWN DURATION, ON EVERY ROW INCLUDING SEGMENTS — which is where
      // this file parts company with the reference (ggst:905 writes 0 for a
      // segment). It is not a claim about the match: it is an INPUT to the record
      // id, because the intro-skip floor is a SHARE of the video and
      // parse-finish.ts:1269 computes it from this field. Write 0 here and a real
      // single-row segment at 56% of its VOD reads as a whole video on that side
      // while this side called it a segment, and the two ids disagree. parse-finish
      // says the same thing at :1297-1303 and asks no duration floor of a segment.
      durationSec: vod.durationSec,
      // NO viewCount, AND THE CONTROL IS WHAT SETTLED IT. `RawVideoRecord` carries
      // the field and a whole-video row's count would genuinely be that record's
      // (a segment's would not — it is the whole VOD's, overstating a two-minute
      // match by a tournament's worth of views). But a view counter MOVES: the
      // partial-resume control ran two pulls of the same frozen fixture ninety
      // seconds apart and the dumps differed on six of 258 rows, every difference a
      // viewCount (`4MvmxEM16yY` 412 → 416, `ScWhOZvriZ8` 4374 → 4364). So the
      // field makes the dump a function of the clock: byte-identical resume becomes
      // unprovable, and parse copies the number into data/videos.json, which the
      // cron then commits and redeploys every single morning with no record having
      // changed. The reference omits it from this intake for the same reason and
      // says nothing; this says it. A view count is not a fact about the MATCH.
      //
      // The VOD's own value, not a constant: an entry pointing at a stream that is
      // still live is footage parse should exclude, and 'none' would hide it.
      liveBroadcastContent: vod.liveBroadcastContent,
      theaterId: e.id!,
      videoId: link.videoId,
      // KEPT AT ZERO when the link states `t=0`. See port break 3.
      ...(link.startSeconds !== undefined ? { startSeconds: link.startSeconds } : {}),
      tag,
      uploader: vod.uploader,
      players: [p1, p2],
      // TWO TUPLES, ONE COLUMN EACH. See port break 1 and types/index.ts:686-696.
      characters: [f1, f2],
      supports: [s1, s2],
    });
  }

  // Stable, TOTAL order: newest VOD first, then by offset within the VOD, then by
  // id. Segments inside one VOD share a publishedAt, so a comparator without the
  // final tie-break would be free to return a different permutation per run — and
  // a resumed sweep that changed nothing would still produce a diff.
  records.sort(
    (a, b) =>
      b.publishedAt.localeCompare(a.publishedAt) ||
      (a.startSeconds ?? 0) - (b.startSeconds ?? 0) ||
      a.id.localeCompare(b.id),
  );

  // ── the floor, on a FULL sweep only ───────────────────────────────────────
  // A cursor run's dump is a DELTA and is legitimately tiny, so "materially
  // smaller than the pin" means nothing there — parse merges it and add-only does
  // the protecting. A FULL sweep is different: it claims to be the whole
  // catalogue, so a collapse in it is a claim that most of the catalogue is gone.
  //
  // The shape this guards against is not hypothetical. `records` is filtered by
  // the per-entry game gate, and that gate compares against a string the catalogue
  // controls: the day "Avatar Legends" is respelled upstream, `rightGame` is 0,
  // `records` is 0, and a fetcher without this check writes `[]` over a good dump
  // without comment. Add-only means nothing is lost downstream — but the CAUSE is
  // never named and the intake is quietly dead. Refuse here, where the cause is
  // visible. The same floor catches a join that stopped resolving, which is the
  // other way a sweep goes to zero.
  if (FULL) {
    const pins = await readFile(join(ROOT, 'data', 'source-pins.json'), 'utf8')
      .then((t) => JSON.parse(t) as Record<string, number>)
      .catch(() => ({}) as Record<string, number>);
    const pinned = Number(pins[CH.id] ?? 0) || 0;
    if (pinned > 0 && records.length < pinned * 0.9) {
      console.error(
        [
          `\n✖ A full sweep produced ${records.length} record(s) against a committed pin of ${pinned}.`,
          `  That is a claim that ${pinned - records.length} matches left the catalogue at once.`,
          ``,
          `  The likeliest cause is not deletion. Every entry is checked against`,
          `  gameLabel ${JSON.stringify(INDEX.gameLabel)}, and ${wrongGame.length} of ${catalogue.length} entr(ies) failed that check`,
          `  this run — if the catalogue respelled the game, every row fails and this`,
          `  file would be overwritten with almost nothing. The other cause is the`,
          `  YouTube join: ${missing.length} of ${vodIds.length} video(s) did not resolve this run.`,
          ``,
          `  Refusing to write. The committed records are untouched and the cron`,
          `  carries them exactly as it does on a day this never ran.`,
          `  If the drop is real: npm run data:theater -- --full --allow-shrink`,
        ].join('\n'),
      );
      if (!ALLOW_SHRINK) process.exit(1);
      console.error('  --allow-shrink given: writing anyway.');
    }
  }

  await writeFile(OUT, JSON.stringify(records) + '\n', 'utf8');

  // ── the witness (checklist 12i) ───────────────────────────────────────────
  // EVERY entry of the read window, tagged and untagged, in the catalogue's own
  // shape — NOT cursor-gated, because the cross-check compares whatever the window
  // holds against whatever we hold and the delta gate is about what gets BUILT.
  //
  // BEHIND THE PER-ENTRY GAME GATE, not the raw catalogue: the gate is this
  // intake's only real defence against a response that is not what was asked for,
  // and the witness has to sit behind it too — it feeds a comparison whose whole
  // claim is that it is reading THIS game.
  //
  // AND WITH THE VOD METADATA, WHICH NO SIBLING'S WITNESS CARRIES. The witness
  // reader on this game has to answer a question the siblings never asked: how
  // much of this catalogue is an INDEPENDENT reading and how much is a
  // transcription of text we also read (checklist 12i's "measure the independence
  // before banking the number"). That needs the VOD's title and its chapter list,
  // which only this file has — the join is here. Chapters are derived once, by
  // `chaptersOf` above, so the fetcher's trust measurement and the cross-check's
  // split cannot disagree about what a chapter is.
  //
  // `videos` covers the videos this run JOINED, i.e. the in-scope rows. On a full
  // sweep that is every row; on a cursor morning it is the new ones, which is why
  // scripts/crosscheck.ts commits its artifact only from a full sweep and prints a
  // cursor run's partial reading to the console instead.
  const witnessVideos: Record<
    string,
    {
      title: string;
      uploader: string;
      publishedAt: string;
      durationSec: number;
      chapters: Chapter[];
    }
  > = {};
  for (const id of vodIds) {
    const v = vods.get(id);
    if (!v) continue;
    witnessVideos[id] = {
      title: v.title,
      uploader: v.uploader,
      publishedAt: v.publishedAt,
      durationSec: v.durationSec,
      chapters: chaptersOf(v.description),
    };
  }
  await writeFile(
    WITNESS,
    JSON.stringify({
      mode: CURSOR_MODE ? 'cursor' : 'full',
      maxEntryId,
      pagesRead: seenPages.size,
      hitBound,
      entries: rightGame,
      videos: witnessVideos,
    }) + '\n',
    'utf8',
  );

  const segments = records.filter((r) => r.startSeconds !== undefined && r.id.includes('@')).length;
  const tagged = records.filter((r) => r.tag !== '').length;
  const formatTagged = records.filter(
    (r) => r.tag !== '' && INDEX.formatTagPattern.test(r.tag),
  ).length;
  const placeholderSides = records.reduce(
    (n, r) => n + r.players.filter((p) => isPlaceholderHandle(p)).length,
    0,
  );
  const preLaunchRows = rightGame.filter((e) => (e.upload_date ?? '') < LAUNCH).length;
  const stats = {
    // ── the shared contract (parse-finish.ts TheaterStats) ──────────────────
    // THE MODE IS LOAD-BEARING, not a diagnostic: parse reads it to decide whether
    // this dump is the whole catalogue or a delta, which decides whether
    // "committed but absent from the dump" means "vanished upstream" or "simply
    // not in the pages we read".
    mode: CURSOR_MODE ? 'cursor' : 'full',
    highestId,
    maxEntryId,
    pagesRead: seenPages.size,
    hitCursorBound: hitBound,
    seen: catalogue.length,
    records: records.length,
    unresolvable: missing.length,
    unresolvablePct,
    badLinks: badLinks.length,
    collisions: collisions.length,
    wrongGame: wrongGame.length,
    // ── beyond the contract: for the log, the report and the gates ──────────
    pastEnd: pastEnd.length,
    cursorAt,
    totalReported: total,
    fullPages,
    pagesFetched,
    resumed,
    noId,
    rightGame: rightGame.length,
    delta: delta.length,
    companions: completion.companions,
    companionVideos: completion.videos,
    admitUntagged: INDEX.admitUntagged,
    inScope: inScope.length,
    videos: vodIds.length,
    quotaUnits: QUOTA.units,
    tagged,
    untagged: records.length - tagged,
    formatTagged,
    eventTagged: tagged - formatTagged,
    segments,
    wholeVideos: records.length - segments,
    collapsed,
    collapsedTags: Object.fromEntries([...collapsedTags].sort((a, b) => a[0].localeCompare(b[0]))),
    placeholderSides,
    spareColumnRows,
    preLaunchRows,
  };
  await writeFile(STATS, JSON.stringify(stats, null, 2) + '\n', 'utf8');

  // A completed FULL sweep retires its cache: the cursor is the daily resume
  // mechanism, and two that disagree would be worse than one. A cursor run leaves
  // a partial cache alone — it belongs to a sweep somebody is driving.
  if (FULL && existsSync(PARTIAL)) await rm(PARTIAL, { force: true });

  console.log(
    `\n✓ raw/replayTheater.json — ${records.length} record(s)${CURSOR_MODE ? ', a delta' : ''} ` +
      `(${tagged} tagged of which ${formatTagged} are set FORMATS, ${records.length - tagged} ` +
      `untagged; ${segments} segment(s), ${records.length - segments} whole video(s))`,
  );
  console.log(
    `  → raw/replayTheater.witness.json (${rightGame.length} of ${catalogue.length} catalogue ` +
      `entr(ies), this game, ${seenPages.size} page(s), ${Object.keys(witnessVideos).length} VOD(s))`,
  );
  console.log(
    `  ${missing.length}/${vodIds.length} video(s) no longer resolve (${unresolvablePct}%) — ` +
      `dropped, not published. RE-MEASURED every pull; Stage 0 read 0.00% and no sibling's rate ` +
      `is carried in.`,
  );
  console.log(
    `  YouTube quota spent by this run: ${QUOTA.units} unit(s) in ${QUOTA.calls} call(s).`,
  );

  // ── reconnaissance ────────────────────────────────────────────────────────
  console.log(`\n${'█'.repeat(72)}`);
  console.log('  RECON — nothing below gates anything; it is what the pull learned.');
  console.log('█'.repeat(72));

  const perVod = new Map<string, TheaterRawRecord[]>();
  for (const r of records) perVod.set(r.videoId, [...(perVod.get(r.videoId) ?? []), r]);
  const counts = [...perVod.values()].map((v) => v.length).sort((a, b) => b - a);
  const shared = records.filter((r) => (perVod.get(r.videoId)?.length ?? 0) > 1).length;
  console.log(`\n  records / source VODs:                 ${records.length} / ${perVod.size}`);
  console.log(
    `  a moment inside a shared VOD:          ${shared} (${pct(shared, records.length)}%), ` +
      `max ${counts[0] ?? 0} per VOD, median ${counts[Math.floor(counts.length / 2)] ?? 0}`,
  );

  // THE SEGMENT DECISION, BROKEN OUT — the number checklist 12k exists for. An
  // offset that is NOT a segment is an intro skip on a whole upload, and reading
  // it as a segment mints a `vid@N` id for a video that is not a clip of itself.
  const introSkips = deduped.filter(
    ({ link, vod }) =>
      (rowsPerVideo.get(link.videoId) ?? 1) === 1 &&
      link.startSeconds !== undefined &&
      link.startSeconds > 0 &&
      !isSegmentEntry(1, link.startSeconds, vod.durationSec, INDEX.segmentOffsetMinShare),
  );
  const zeroInMulti = deduped.filter(
    ({ link }) => (rowsPerVideo.get(link.videoId) ?? 1) > 1 && link.startSeconds === 0,
  ).length;
  console.log(
    `\n  offsets that are INTRO SKIPS:          ${introSkips.length} single-row row(s) under ` +
      `${(INDEX.segmentOffsetMinShare * 100).toFixed(0)}% of their video → the bare video id ` +
      `(26 of 29 at Stage 0)`,
  );
  if (introSkips.length) {
    const shares = introSkips
      .map(({ link, vod }) => (vod.durationSec ? (link.startSeconds! / vod.durationSec) * 100 : 0))
      .sort((a, b) => a - b);
    console.log(
      `    their share of the video:            ${shares[0]!.toFixed(1)}% … ` +
        `${shares[shares.length - 1]!.toFixed(1)}% (the floor is ` +
        `${(INDEX.segmentOffsetMinShare * 100).toFixed(0)}%)`,
    );
  }
  console.log(
    `  t=0 rows inside a MULTI-row video:     ${zeroInMulti} — each one a SEGMENT at zero, not a ` +
      `whole tournament VOD (5 at Stage 0)`,
  );

  const malformed = deduped.filter(({ e }) => {
    const s = e.video_link ?? '';
    if (!s.includes('youtu.be/')) return false;
    const tail = s.split('youtu.be/')[1] ?? '';
    return tail.includes('&t=') && !tail.includes('?');
  }).length;
  const multiT = deduped.filter(({ link }) => link.tCount > 1).length;
  const hmsRows = deduped.filter(({ e }) => {
    const vals = [...(e.video_link ?? '').matchAll(START_ALL)].map((m) => m[1] ?? '');
    const last = vals[vals.length - 1];
    return last !== undefined && last !== '' && !START_SECONDS.test(last.trim());
  }).length;
  console.log(
    `\n  concatenated youtu.be/<id>&t=Ns links: ${malformed} (${pct(malformed, deduped.length)}%) ` +
      `— 51 of 258 on 2026-09-18; read by shape, never by new URL()`,
  );
  console.log(`  links carrying more than one t=:       ${multiT} (last one wins)`);
  console.log(
    `  offsets in h/m/s rather than seconds:  ${hmsRows} — the reference's /^(\\d+)s?$/ drops ` +
      `every one of these as a bad link (18 of 258 on 2026-09-18)`,
  );

  // THE SUPPORT COLUMN, AND THE COUNTER-PICK NUMBER THAT IS NOT ONE. Reading
  // p*_char2 as a second fighter is what makes this print 100%.
  const fighters = new Map<string, number>();
  const supports = new Map<string, number>();
  let sidesWithSupport = 0;
  for (const r of records) {
    for (let i = 0; i < 2; i++) {
      const f = r.characters[i] ?? '';
      const s = r.supports[i] ?? '';
      if (f) fighters.set(f, (fighters.get(f) ?? 0) + 1);
      if (s) {
        supports.set(s, (supports.get(s) ?? 0) + 1);
        sidesWithSupport++;
      }
    }
  }
  console.log(
    `\n  fighter column (p*_char):              ${fighters.size} distinct name(s) over ` +
      `${records.length * 2} side(s)`,
  );
  console.log(
    `  support column (p*_char2):             ${supports.size} distinct, filled on ` +
      `${sidesWithSupport} side(s) (${pct(sidesWithSupport, records.length * 2)}%) — a ROLE, not a ` +
      `counter-pick; 34 distinct on 100% of sides at Stage 0`,
  );
  console.log(
    `  p*_char3 / p*_char4 rows:              ${spareColumnRows} — null on 258 of 258 on ` +
      `2026-09-18. A non-zero number here means this game's shape changed.`,
  );
  console.log(
    `  tags:                                  ${tagged - formatTagged} event(s), ` +
      `${formatTagged} set FORMAT(s) matching ${String(INDEX.formatTagPattern)}, ` +
      `${records.length - tagged} untagged — a format must never reach Replay.event`,
  );
  console.log(
    `  placeholder handles (sides):           ${placeholderSides} of ${records.length * 2} — ` +
      `passed through; parse drops them, and '♱' is a real player rather than one of them`,
  );
  console.log(
    `  rows dated before launch ${LAUNCH}:  ${preLaunchRows} by the catalogue's own ` +
      `upload_date (parse's floor reads publishedAt; 5 at Stage 0)`,
  );

  const dates = records.map((r) => r.publishedAt.slice(0, 10)).sort();
  console.log(
    `  VOD publish dates:                     ${dates[0] ?? '—'} → ${dates[dates.length - 1] ?? '—'}`,
  );

  // ── trust, re-measured every pull ─────────────────────────────────────────
  // TWO CHAPTER RULES, PRINTED SIDE BY SIDE, AND THE GAP BETWEEN THEM IS THE
  // MEASUREMENT. The reference reads "the last chapter whose start is <= the
  // offset" (ggst:1163-1168). That is the right rule for ALIGNMENT — how close the
  // catalogue's offsets sit to the uploader's own markers — and it is the wrong
  // rule for "which chapter is this row about", because this catalogue submits
  // some offsets EARLY. On zD1wAGwENcY (11,139s, 24 rows) the offsets lead their
  // own chapters by 60-75s on 19 of 24 rows, so at-or-before names the PREVIOUS
  // match every time. Printing only the at-or-before agreement turns a systematic
  // 60-second lead into a mysterious drop in trust; printing both says what it is.
  // scripts/crosscheck.ts uses neither of these for its independence split — see
  // the reasoning in classifyNameSource there.
  let inChapter = 0;
  let exact = 0;
  let within30 = 0;
  let vsChapters = 0;
  let agreeAtOrBefore = 0;
  let agreeNearest = 0;
  let leadRows = 0;
  let chaptered = 0;
  const nameKeys = (r: TheaterRawRecord): string[] =>
    r.players.map((p) => aliasKey(stripTheaterSponsor(p))).filter((k) => k.length >= 2);
  const namesBoth = (title: string, keys: string[]): boolean => {
    const t = aliasKey(title);
    return keys.length === 2 && keys.every((k) => t.includes(k));
  };
  for (const [id, meta] of Object.entries(witnessVideos)) {
    if (!meta.chapters.length) continue;
    chaptered++;
    for (const r of perVod.get(id) ?? []) {
      if (r.startSeconds === undefined) continue;
      let hit: Chapter | undefined;
      for (const c of meta.chapters) {
        if (c.start <= r.startSeconds) hit = c;
        else break;
      }
      let near: Chapter | undefined;
      let best = Infinity;
      for (const c of meta.chapters) {
        const d = Math.abs(c.start - r.startSeconds);
        if (d < best) {
          best = d;
          near = c;
        }
      }
      if (!hit) continue;
      inChapter++;
      const d = r.startSeconds - hit.start;
      if (d === 0) exact++;
      if (Math.abs(d) <= 30) within30++;
      if (near && near !== hit) leadRows++;
      // Condition on the chapter naming a MATCHUP, not on a name having already
      // hit: the looser denominator silently excludes total disagreement, which is
      // the one failure that matters.
      if (/\bvs\.?\b/i.test(hit.title)) {
        vsChapters++;
        const keys = nameKeys(r);
        if (namesBoth(hit.title, keys)) agreeAtOrBefore++;
        if (near && namesBoth(near.title, keys)) agreeNearest++;
      }
    }
  }
  console.log(
    `\n  VODs carrying a chapter list: ${chaptered}/${Object.keys(witnessVideos).length}`,
  );
  console.log(
    `  offsets inside a chapter:     ${inChapter} — ${within30} within 30s ` +
      `(${pct(within30, inChapter)}%), ${exact} exact (${pct(exact, inChapter)}%)`,
  );
  console.log(
    `  offsets nearer the NEXT chapter than the one they sit in: ${leadRows} — the catalogue ` +
      `submits these early (60-75s on one 24-row VOD)`,
  );
  console.log(
    `  chapters naming a matchup:    ${vsChapters} — both handles agree ${agreeAtOrBefore} under ` +
      `the reference's at-or-before rule (${pct(agreeAtOrBefore, vsChapters)}%), ${agreeNearest} ` +
      `under nearest-chapter (${pct(agreeNearest, vsChapters)}%)`,
  );
  console.log(`  segments with no chapter to check against: ${segments - inChapter}`);

  const uploaders = new Map<string, number>();
  for (const r of records) uploaders.set(r.uploader, (uploaders.get(r.uploader) ?? 0) + 1);
  console.log(`\n  source VOD uploaders (${uploaders.size}, 30 at Stage 0):`);
  for (const [u, n] of [...uploaders.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    console.log(`      ${String(n).padStart(5)}  ${u}`);
  }

  console.log('\n  Next: npx tsx scripts/crosscheck.ts   then   npm run data:parse');
}

// isMain, not a bare call: `chaptersOf`, `isSegmentEntry`, `parseLink` and
// `offsetSeconds` are exported so a gate can exercise the rules without a pull,
// and importing this module must not start one (scripts/fetch.ts sets the same
// rule for the API client it owns).
const entry = process.argv[1];
const isMain = !!entry && import.meta.url.endsWith(entry.split('/').pop() ?? '');
if (isMain) {
  main().catch((err: unknown) => {
    if (err instanceof QuotaRefusal) {
      // A REFUSAL ENDS THE RUN, it does not start a retry ladder. The key is
      // shared with six production crons and the intake is allowed to fail: no
      // dump, parse carries, the cron stays green.
      console.error(`\n✖ ${err.message}`);
      console.error('  No dump written. parse will carry the committed records unchanged.');
      process.exit(1);
    }
    throw err;
  });
}
