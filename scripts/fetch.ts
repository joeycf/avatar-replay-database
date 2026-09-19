/**
 * Stage 1: walk every tracked channel's uploads playlist through the YouTube
 * Data API v3, dump raw metadata to raw/<intake>.json, and print a per-channel
 * reconnaissance report. The key is LOCAL/CI-ONLY — the site builds from
 * committed JSON and never sees it.
 *
 * Run: npm run data:fetch   (tsx --env-file-if-exists=.env scripts/fetch.ts)
 *
 * Flags:
 *   --only=<ChannelKey>   fetch one channel.
 *   --include-frozen      ALSO fetch frozen channels. The one legitimate use is
 *                         seeding a freeze pin — see FROZEN below.
 *
 * ── WHAT THIS FILE OWNS, AND WHAT IT DELIBERATELY DOES NOT ──────────────────
 * It owns the WALK and the HYDRATION, and nothing that writes to data/. The
 * three guards that protect the archive all read the committed corpus, which is
 * parse's business, so they live one stage later and are named here only so the
 * boundary is visible from the side that spends the quota:
 *
 *   · the DATA-ONLY stale-raw guard      scripts/parse.ts  assertRawIsFresh()
 *   · the COLLAPSE guard                 scripts/parse-finish.ts, step 5
 *   · the FREEZE carry and its pin       scripts/parse-finish.ts, step 2
 *
 * THE COLLAPSE GUARD IS MOSTLY ASLEEP ON THIS CORPUS AND SAYING SO IS PART OF
 * SHIPPING IT (checklist 7b). It refuses a per-intake loss of >10% AND >20
 * records. Counted off the Stage 0 table (scripts/channels.ts), FOUR of the 32
 * YouTube intakes commit more than 20 records — aegisEsports 57, still 34,
 * ndyTv 34, toledoLocals 23 — so on the other 28 the second arm can never fire
 * at all, and on those four it needs a loss of 21, which is 37% of aegisEsports
 * and 91% of toledoLocals: a near-total collapse, not a bad morning. The
 * threshold is still correct and stays. What protects a small channel here is
 * the freeze pin, the freezeWatch rows (types/index.ts FreezeWatch) and the
 * per-channel table in data/report.md, which prints EVERY loss including the
 * ones the guard cannot refuse. A guard believed to be watching, that
 * structurally cannot fire, is the same failure as a gate that cannot fail —
 * and this one is measured awake: reverting the pair-level branch drops
 * aegisEsports 57 → 0 and the guard refuses the run.
 *
 * ── NO GAME GATE HERE ───────────────────────────────────────────────────────
 * raw/ holds everything a channel publishes — 45,992 uploads against 454 marked
 * titles, 0.99% (scripts/channels.ts) — and parse.ts does the filtering. The
 * marked counts printed below are RECON ONLY and gate nothing: they exist so a
 * channel that quietly rebrands to another game is visible the morning it
 * happens rather than three stages later as a collapse.
 *
 * ── QUOTA ───────────────────────────────────────────────────────────────────
 * playlistItems.list costs 1 unit per 50 ids and videos.list 1 unit per 50
 * hydrations. search.list costs 100 and is never called from anywhere in this
 * repo. The key is shared with six production crons, so this file does two
 * things the reference's fetcher does not:
 *
 *   · it applies the per-channel `fetchFrom` date floor DURING THE WALK
 *     (checklist 1b). The uploads playlist is newest-first and
 *     `contentDetails.videoPublishedAt` is on the page already, so the floor is
 *     a stop condition that costs no extra call. Five intakes have playlists far
 *     larger than their Avatar output — unrivaledTournaments 12,975 uploads for
 *     14 records, kmlTournaments 11,605 for 7, superSalemFighters 9,759 for 4,
 *     ndyTv 3,780 for 34, rood 2,334 for 14 — and walking them whole costs about
 *     1,620 units EVERY DAY to harvest 73 marked uploads. With the floor the
 *     first harvest is the same and every later morning is a page or two.
 *   · it ABORTS on the first quotaExceeded / 429 / bot check instead of backing
 *     off and retrying (checklist 10j). The reference's ladder retries a 429
 *     five times, which on a shared key turns one exhausted cron into six. A
 *     transient 5xx and a network error are still retried; a refusal is not.
 *
 * Every run prints the units it spent. That number is the one a reader checks
 * against the crons' budget, so it is counted at the call site rather than
 * estimated from a formula in a comment.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ACTIVE_CHANNELS, CHANNELS, hasAvatarMarker, hasMarkerForChannel } from './channels';
import { buildAliasMatcher, loadCharacters, loadSupports } from './roster';
import type { AliasMatcher } from './roster';
import type { ChannelConfig, RawVideoRecord } from '../types/index';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW_DIR = join(ROOT, 'raw');

// ── the YouTube Data API v3 client ──────────────────────────────────────────
//
// Ported from the reference's scripts/youtube.ts, which every fetcher on the
// platform shares. It lives INSIDE this file rather than in a module of its own
// because this repo has exactly two API consumers and the second one
// (scripts/fetch-theater.ts, the index pull) is a later wave's file: a shared
// module nobody has written yet is a merge conflict waiting to happen, where
// `import { apiGet, fetchVideoMeta } from './fetch'` is not. The entry point is
// isMain-guarded, so importing this module runs nothing.

const API_BASE = 'https://www.googleapis.com/youtube/v3';

/** Units spent by this process, counted at the call site. 1 per request on both
 *  endpoints this file uses; nothing here costs 100. */
export const QUOTA = { units: 0, calls: 0 };

let cachedKey: string | undefined;

/** Read YT_API_KEY, or fail loudly naming the command that needed it. Called by
 *  each entry point rather than at import, so importing this module cannot kill
 *  an unrelated script. */
export function requireApiKey(command: string): string {
  if (cachedKey) return cachedKey;
  const raw = process.env.YT_API_KEY;
  if (!raw) {
    console.error(
      [
        `✖ Missing YT_API_KEY (needed by ${command}).`,
        '  Create a .env file in the project root containing:',
        '    YT_API_KEY=your_key_here',
        `  (see .env.example). ${command} loads it via \`tsx --env-file-if-exists=.env\`.`,
      ].join('\n'),
    );
    process.exit(1);
  }
  cachedKey = raw;
  return raw;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * A refusal, as opposed to a hiccup: quotaExceeded, rateLimitExceeded, HTTP 429,
 * or the sign-in-to-confirm-you-are-not-a-bot page. Thrown rather than retried —
 * see the QUOTA note in the header — and named so the caller can print the one
 * sentence that matters instead of a stack.
 */
export class QuotaRefusal extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(
      `YouTube refused the request (HTTP ${status}). This key is shared with six production ` +
        `crons, so the run STOPS here rather than backing off and retrying.\n${body.slice(0, 400)}`,
    );
    this.name = 'QuotaRefusal';
  }
}

const REFUSAL = /quotaExceeded|rateLimitExceeded|userRateLimitExceeded|confirm you're not a bot/i;

/** GET with retry on 5xx and network errors; ABORT on a refusal; fail loudly on
 *  any other 4xx. The key is only ever set on the URL and never logged. */
export async function apiGet<T>(
  endpoint: string,
  params: Record<string, string>,
  retries = 5,
): Promise<T> {
  const url = new URL(`${API_BASE}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('key', requireApiKey(endpoint));

  for (let attempt = 1; attempt <= retries; attempt++) {
    QUOTA.units += 1;
    QUOTA.calls += 1;
    let res: Response;
    try {
      res = await fetch(url);
    } catch (err) {
      if (attempt >= retries) throw err;
      const wait = Math.min(1000 * 2 ** (attempt - 1), 8000);
      console.warn(
        `  ⚠ network error on ${endpoint} (attempt ${attempt}/${retries}); retrying in ${wait}ms`,
      );
      await sleep(wait);
      continue;
    }

    if (res.ok) return (await res.json()) as T;

    const body = await res.text().catch(() => '');
    if (res.status === 429 || REFUSAL.test(body)) throw new QuotaRefusal(res.status, body);

    if (res.status >= 500 && attempt < retries) {
      const wait = Math.min(1000 * 2 ** (attempt - 1), 8000);
      console.warn(
        `  ⚠ HTTP ${res.status} on ${endpoint} ${JSON.stringify(params)} ` +
          `(attempt ${attempt}/${retries}); retrying in ${wait}ms`,
      );
      await sleep(wait);
      continue;
    }
    throw new Error(
      `YouTube API error: HTTP ${res.status} on ${endpoint} ${JSON.stringify(params)}\n${body}`,
    );
  }
  throw new Error('unreachable');
}

/** ISO8601 duration (PT#H#M#S) → seconds. 0 = live/upcoming/unknown. */
export function parseDuration(iso: string | undefined): number {
  if (!iso) return 0;
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return 0;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

export interface VideoMeta {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  durationSec: number;
  viewCount?: number;
  liveBroadcastContent: string;
  /** The uploading channel's display name. An index source's VODs belong to
   *  thirty different organisers, so this is per video, not per intake. */
  uploader: string;
  tags?: string[];
}

interface VideosResponse {
  items: {
    id: string;
    snippet: {
      title: string;
      description: string;
      publishedAt: string;
      liveBroadcastContent: string;
      channelTitle?: string;
      tags?: string[];
    };
    contentDetails: { duration?: string };
    statistics?: { viewCount?: string };
  }[];
}

/**
 * Hydrate arbitrary video ids, 50 per call. Returns a Map so the caller can diff
 * for ids that did not come back — a video gone private or deleted is a fact
 * about the corpus, not noise to swallow. scripts/fetch-theater.ts needs exactly
 * this to resolve the catalogue's VODs; it is exported for that.
 */
export async function fetchVideoMeta(ids: string[]): Promise<Map<string, VideoMeta>> {
  const out = new Map<string, VideoMeta>();
  for (let i = 0; i < ids.length; i += 50) {
    const res: VideosResponse = await apiGet('videos', {
      part: 'snippet,contentDetails,statistics',
      id: ids.slice(i, i + 50).join(','),
      maxResults: '50',
    });
    for (const v of res.items) {
      out.set(v.id, {
        id: v.id,
        title: v.snippet.title,
        description: v.snippet.description,
        publishedAt: v.snippet.publishedAt,
        durationSec: parseDuration(v.contentDetails.duration),
        ...(v.statistics?.viewCount ? { viewCount: Number(v.statistics.viewCount) } : {}),
        liveBroadcastContent: v.snippet.liveBroadcastContent,
        uploader: v.snippet.channelTitle ?? '',
        ...(v.snippet.tags ? { tags: v.snippet.tags } : {}),
      });
    }
  }
  return out;
}

// ── the walk ────────────────────────────────────────────────────────────────

interface PlaylistItemsResponse {
  items: { contentDetails: { videoId: string; videoPublishedAt?: string } }[];
  nextPageToken?: string;
}

interface ChannelFetch {
  records: RawVideoRecord[];
  /** Ids the playlist listed and videos.list did not return — private, deleted
   *  or region-blocked between the two calls. Reported, never swallowed. */
  unhydrated: number;
  /** Pages the walk read, and where it stopped. */
  pages: number;
  stoppedAtFloor: boolean;
}

async function fetchChannel(ch: ChannelConfig): Promise<ChannelFetch> {
  // An index source has no channel and no playlist; it is pulled by
  // `npm run data:theater` and skipped by the caller. Asserted rather than
  // assumed, because reaching here with one would page YouTube for
  // `playlistId=undefined` and return an empty dump that looks like a dead
  // channel — the exact shape the collapse guard exists to refuse, arriving
  // from our own bug rather than the channel's.
  if (!ch.uploadsPlaylist) {
    throw new Error(
      `${ch.id} has no uploadsPlaylist — an index source must be skipped before fetchChannel.`,
    );
  }

  // 1) videoIds from the uploads playlist, newest first, 50/page, 1 unit each.
  //
  // THE `fetchFrom` FLOOR IS A STOP CONDITION, NOT A FILTER (checklist 1b).
  // `contentDetails.videoPublishedAt` rides on the page we already paid for, so
  // the floor costs nothing to apply and saves every page below it. The walk
  // stops after the first page whose NEWEST item is already below the floor —
  // one page of slack, because an uploads playlist is newest-first by publish
  // time and a manual re-upload can put a single old id out of order.
  const floor = ch.fetchFrom;
  const ids: string[] = [];
  let pageToken: string | undefined;
  let pages = 0;
  let stoppedAtFloor = false;
  do {
    const page: PlaylistItemsResponse = await apiGet('playlistItems', {
      part: 'contentDetails',
      playlistId: ch.uploadsPlaylist,
      maxResults: '50',
      ...(pageToken ? { pageToken } : {}),
    });
    pages++;
    let newestOnPage = '';
    for (const it of page.items) {
      const at = it.contentDetails.videoPublishedAt ?? '';
      if (at > newestOnPage) newestOnPage = at;
      if (floor && at && at.slice(0, 10) < floor) continue;
      ids.push(it.contentDetails.videoId);
    }
    if (floor && newestOnPage && newestOnPage.slice(0, 10) < floor) {
      stoppedAtFloor = true;
      break;
    }
    pageToken = page.nextPageToken;
  } while (pageToken);

  // 2) hydrate 50 at a time. This is the ONLY place duration,
  //    liveBroadcastContent and tags are read for the whole title arm, and
  //    checklist 5o is why it is not optional: a parse rate computed from titles
  //    alone omits every miss class that needs a duration. On this game the
  //    duration is also what the maxDurationSec ceiling reads (types/index.ts) —
  //    six whole-tournament VODs on one channel that pass every other gate.
  const records: RawVideoRecord[] = [];
  const meta = await fetchVideoMeta(ids);
  for (const id of ids) {
    const v = meta.get(id);
    if (!v) continue;
    records.push({
      id: v.id,
      channel: ch.id,
      title: v.title,
      description: v.description,
      publishedAt: v.publishedAt,
      durationSec: v.durationSec,
      ...(v.viewCount ? { viewCount: v.viewCount } : {}),
      liveBroadcastContent: v.liveBroadcastContent,
      ...(v.tags ? { tags: v.tags } : {}),
    });
  }

  // A playlist that listed ids but hydrated to nothing is a bug, not a quiet
  // day. Reported here rather than left for the collapse guard, because the
  // guard runs on PARSED counts and this failure happens two stages earlier —
  // and because on this corpus the guard cannot fire at all.
  if (ids.length > 0 && records.length === 0) {
    throw new Error(`${ch.id}: playlist listed ${ids.length} ids but videos.list returned none`);
  }
  return { records, unhydrated: ids.length - records.length, pages, stoppedAtFloor };
}

// ── THE RECON / REJECT PRINTER (checklist 5e) ───────────────────────────────
//
// Console only, and deliberately NOT a gate. Its job is to make a grammar drift
// visible the DAY it lands rather than the week someone notices the counts
// sagging. An approximate regex that REJECTS a real title is a silent data loss;
// the same regex printing a line a human reads is free. The precise version —
// misses that name a roster character, per channel, straight from the real
// parser — is in data/report.md (parse-finish.ts).
//
// THE EXPECTED SHAPE IS PER SLOT ORDER, NOT PER GAME, and this game has five
// shapes rather than the reference's four (types/index.ts SlotOrder):
//   · pair-chars-outside  ONE bracket group holding a `vs`, and a `vs` outside
//     it. aegisEsports's 57 records and, mirrored, avianZebra's one combined-
//     bracket title. A "bracket on each side of vs" test scores 0 of 57 here.
//   · handle-outside / chars-outside  a bracket group on each side of the
//     top-level `vs`. Groups are matched BY TYPE (round, square, fullwidth)
//     because natsuXenoblade nests a SQUARE support slot inside a ROUND fighter
//     slot — "Natsu (Zuko [Mai])" — and a generic "any bracket" class reads the
//     inner square as the slot.
//   · handle-first-bare  no bracket needed: a top-level `vs` with a roster
//     FIGHTER span on each side, read through the same matcher the parser uses.
//
// The matcher is the typed one (scripts/roster.ts), so `matcher.fighters()` here
// cannot be satisfied by a support name — which is exactly the trap on the two
// channels that write "(Fighter/Support)".

const VS_TOKEN = /(?<![\p{L}\p{N}])(?:v\.?s\.?|versus|×)(?![\p{L}\p{N}])/giu;
const GROUP = /\((?:[^()[\]]|\[[^[\]]*\]|\([^()]*\))*\)|（[^（）]*）|\[(?:[^[\]]|\([^()]*\))*\]/gu;

const countVs = (s: string): number => {
  VS_TOKEN.lastIndex = 0;
  return (s.match(VS_TOKEN) ?? []).length;
};

function matchesShape(ch: ChannelConfig, title: string, matcher: AliasMatcher): boolean {
  const t = title.normalize('NFC');
  GROUP.lastIndex = 0;
  const groups = t.match(GROUP) ?? [];
  const outside = t.replace(GROUP, ' ');
  if (ch.slotOrder === 'pair-chars-outside') {
    return groups.some((g) => countVs(g) >= 1) && countVs(outside) >= 1;
  }
  if (ch.slotOrder === 'handle-outside' || ch.slotOrder === 'chars-outside') {
    const halves = outside.split(VS_TOKEN);
    return groups.length >= 2 && halves.length === 2;
  }
  const halves = t.split(VS_TOKEN);
  return halves.length === 2 && halves.every((h) => matcher.fighters(h).length > 0);
}

function recon(ch: ChannelConfig, records: RawVideoRecord[], matcher: AliasMatcher): void {
  // The DESCRIPTION arm is counted only where the channel declares it
  // (types/index.ts GateMode). Counting it everywhere would overstate the
  // marked set on 31 of 32 intakes — saxxiefone has one description-only upload
  // the parse correctly never sees — and a recon figure that is not the gate's
  // figure is worse than no figure.
  const wide = ch.gateMode === 'titleOrDescription';
  const marked = records.filter(
    (r) =>
      hasMarkerForChannel(r.title, ch.gateMode) || (wide && hasAvatarMarker(r.description ?? '')),
  );
  const titleMarked = records.filter((r) => hasMarkerForChannel(r.title, ch.gateMode)).length;
  const shaped = marked.filter((r) => matchesShape(ch, r.title, matcher));
  // A title that names a fighter but does NOT match the shape is the signal that
  // matters: it is match-shaped content the parser may drop, or — worse — read
  // with the slots swapped.
  const suspicious = marked.filter(
    (r) => !matchesShape(ch, r.title, matcher) && matcher.fighters(r.title).length > 0,
  );
  const supportOnly = marked.filter(
    (r) => matcher.fighters(r.title).length === 0 && matcher.supports(r.title).length > 0,
  ).length;
  console.log(
    `    recon: ${shaped.length}/${marked.length} marked title(s) match the ${ch.slotOrder} shape` +
      (marked.length > titleMarked ? `  (${marked.length - titleMarked} description-only)` : '') +
      (supportOnly ? `  · ${supportOnly} name a SUPPORT and no fighter` : ''),
  );
  if (suspicious.length) {
    console.log(`           ⚠ ${suspicious.length} title(s) name a fighter but miss the shape:`);
    for (const r of suspicious.slice(0, 8))
      console.log(`             · [${r.id}] ${r.title.slice(0, 96)}`);
    if (suspicious.length > 8) console.log(`             … and ${suspicious.length - 8} more`);
  }
}

async function main(): Promise<void> {
  await mkdir(RAW_DIR, { recursive: true });
  requireApiKey('data:fetch');
  const only = process.argv.find((a) => a.startsWith('--only='))?.slice('--only='.length);
  const includeFrozen = process.argv.includes('--include-frozen');

  // FROZEN CHANNELS ARE SKIPPED — their committed records are carried forward
  // byte-stable by parse against a pinned count (types/index.ts FreezePin), so
  // fetching them would spend quota to produce a dump nothing reads.
  //
  // `--include-frozen` is the ONE exception and it exists for ONE job: seeding
  // the pin. drewShoto ships with `frozen.records: -1`, a sentinel no carry can
  // ever equal, so parse throws on the first run until a human has measured the
  // real count. The ritual, in order:
  //   1. npm run data:fetch -- --only=drewShoto --include-frozen
  //   2. npm run data:parse -- --seed-freeze-pins    (prints the count, writes nothing)
  //   3. set frozen.records on drewShoto in scripts/channels.ts to that count
  //   4. npm run data:parse                          (asserts the parse against the
  //                                                   pin and writes the records)
  // Every later run carries the committed records and re-asserts the pin. There
  // is no other legitimate use of this flag and it must never appear in the cron.
  const pool = includeFrozen ? CHANNELS.filter((c) => !c.index) : ACTIVE_CHANNELS;
  const targets = only ? pool.filter((c) => c.id === only) : pool;
  if (only && targets.length === 0) {
    console.error(
      `✖ --only=${only} matches no ${includeFrozen ? 'YouTube' : 'active'} channel` +
        (CHANNELS.some((c) => c.id === only && c.frozen)
          ? ` — ${only} is frozen; add --include-frozen if you are seeding its pin`
          : ''),
    );
    process.exit(1);
  }

  // The matcher is used ONLY by the reject printer above. It reads
  // data/characters.json and data/supports.json — local files, no quota.
  const matcher = buildAliasMatcher(await loadCharacters(), await loadSupports());

  console.log(
    `▶ Fetching ${targets.length} channel(s)` +
      (includeFrozen ? ' (--include-frozen: seeding a freeze pin)' : '') +
      '…\n',
  );
  const rows: { total: number; marked: number }[] = [];
  for (const ch of targets) {
    const before = QUOTA.units;
    const out = await fetchChannel(ch);
    await writeFile(join(RAW_DIR, `${ch.id}.json`), JSON.stringify(out.records));
    // Title only here, on every channel: the description widening two intakes
    // declare (types/index.ts GateMode) is parse's business, and this line is
    // recon. EXPECT IT TO READ BELOW THE RECON TABLE'S per-channel figures on
    // takeANappa, whose marked count includes description and structural hits.
    const marked = out.records.filter((r) => hasMarkerForChannel(r.title, ch.gateMode)).length;
    const newest = out.records.reduce((a, v) => (v.publishedAt > a ? v.publishedAt : a), '');
    rows.push({ total: out.records.length, marked });
    console.log(
      `  ${ch.id.padEnd(21)} ${String(out.records.length).padStart(6)} upload(s)  ` +
        `${String(marked).padStart(4)} marked ` +
        `(${((marked / Math.max(1, out.records.length)) * 100).toFixed(1)}%)  ` +
        `newest ${newest.slice(0, 10) || '—'}  ` +
        `${String(QUOTA.units - before).padStart(3)} unit(s), ${out.pages} page(s)` +
        (out.stoppedAtFloor ? ` [stopped at fetchFrom ${ch.fetchFrom}]` : '') +
        (out.unhydrated ? `  ⚠ ${out.unhydrated} id(s) did not hydrate` : '') +
        (ch.frozen ? '  [FROZEN — seeding]' : ''),
    );
    recon(ch, out.records, matcher);
  }

  const frozen = CHANNELS.filter((c) => c.frozen && !targets.includes(c));
  const index = CHANNELS.filter((c) => c.index);
  console.log(
    `\n✓ raw/ written — ${rows.reduce((n, r) => n + r.total, 0)} upload(s), ` +
      `${rows.reduce((n, r) => n + r.marked, 0)} marked across ${rows.length} channel(s)` +
      `${frozen.length ? `; ${frozen.length} frozen channel(s) skipped` : ''}` +
      `${index.length ? `; ${index.length} index source(s) pulled by \`npm run data:theater\`` : ''}` +
      `\n  quota: ${QUOTA.units} unit(s) over ${QUOTA.calls} call(s) — shared with six production crons`,
  );
}

// isMain, not a bare call: apiGet/fetchVideoMeta are exported for the index
// fetcher, and importing them must not start a walk.
const entry = process.argv[1];
const isMain = !!entry && import.meta.url.endsWith(entry.split('/').pop() ?? '');
if (isMain) {
  main().catch((err: unknown) => {
    if (err instanceof QuotaRefusal) {
      console.error(`\n✖ ${err.message}\n  Nothing else was fetched. Try again after the reset.`);
      process.exit(1);
    }
    throw err;
  });
}
