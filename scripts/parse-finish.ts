/**
 * Stage 2, back half: the index merge, hand overrides, dedupe, the collapse
 * guard, the freeze carry, the player registry and its invariant, the match
 * IDENTITY tier, the review queue and data/report.md.
 *
 * Split from scripts/parse.ts for legibility only — there is one parse and it is
 * these two files. EVERYTHING THAT WRITES TO data/ WRITES FROM HERE, so the
 * order of the guards relative to the writes is visible in one place: every
 * guard runs, and only then does anything touch disk. A guard that aborts after
 * a partial write is not a guard, and the reference learned that with a cursor
 * advanced 78 lines before the collapse check that would have refused the run.
 *
 * ── THE COLLAPSE GUARD IS MOSTLY ASLEEP ON THIS CORPUS (checklist 7b) ───────
 * It refuses a per-intake loss of >10% AND >20 records. FOUR of the 33 intakes
 * commit more than 20 (aegisEsports 57, still 34, ndyTv 34, toledoLocals 23 at
 * Stage 0), so on the other 29 the second arm can never fire, and on those four
 * it needs a loss of 21 records — 37% of aegisEsports, 91% of toledoLocals.
 * Both thresholds are still correct and both stay; what the checklist asks for
 * in return is the honest note that the live protection for the other 29 is the
 * FREEZE PIN, the `freezeWatch` rows and the per-channel table this file prints
 * — which is why every loss the guard cannot refuse is printed there too. The
 * guard IS awake where it can be: reverting the pair-level branch in parse.ts
 * drops aegisEsports 57 → 0 and this guard is what refuses the run.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CHANNELS, stripTheaterSponsor } from './channels';
import { dueExpiries, expiryBlock, UNRELEASED } from './expiries';
import { CONFIRMED_CHARACTER_NAMED_PLAYERS, normalizeText, playerId } from './roster';
import { LAUNCH, patchForDate, patchWindows, seasonForDate, seasonToken } from './patches';
import { DURATION_BUCKETS, MIN_MATCH_SEC, isPlaceholderHandle } from './parse';
import type { AliasMatcher, SupportIndex } from './roster';
import type {
  CharacterRecord,
  ChannelKey,
  MatchSide,
  MatchSignature,
  MatchVideo,
  PlayerRecord,
  ReviewQueueItem,
  SlotOrder,
  SourcePins,
  SupportRecord,
  TheaterRawRecord,
  VideoOverride,
} from '../types/index';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = join(ROOT, 'raw');
const DATA = join(ROOT, 'data');

const ALLOW_COLLAPSE = process.argv.includes('--allow-collapse');

const write = (name: string, value: unknown) =>
  writeFile(join(DATA, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');

/** Catch-all fallback is FINE for these — the cursor and the stats file are not
 *  baselines for anything. videos.json is read by parse.ts's readCommitted,
 *  which hard-stops on an unreadable file for the reason given there. */
const readJsonLocal = async <T>(path: string, fallback: T): Promise<T> => {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch {
    return fallback;
  }
};

/** Dedupe precedence = the CHANNELS array order (checklist step 1/2). */
const PRECEDENCE = new Map<ChannelKey, number>(CHANNELS.map((c, i) => [c.id, i]));

const SLOT_ORDERS: SlotOrder[] = [
  'handle-outside',
  'chars-outside',
  'handle-first-bare',
  'pair-chars-outside',
];

/** Per-channel counters parse.ts fills and this file prints. */
export interface ChannelTally {
  raw: number;
  marked: number;
  parsed: number;
  excluded: number;
  /** The duration floor this channel was judged against. */
  floorSec: number;
  /** Its ceiling, or null where none is declared (checklist 5t). */
  ceilSec: number | null;
  misses: Record<string, number>;
  /** Handles refused as placeholders ("Anonymous Player") on this channel. */
  placeholderHandles: number;
  /** Resolved slot order, BOTH sides tallied — 2 per record. */
  slot: Record<SlotOrder, number>;
  /** Sides where both readings resolved and the declared order decided. */
  tieBroken: number;
  /** Spans that resolved in BOTH namespaces beside another character span. */
  overlaps: number;
  /** Sides that ended up with a support, and sides that named one at all. */
  supportsStated: number;
  supportSides: number;
  /** Supports dropped because the side's fighter does not own them. */
  supportOwnerMismatch: number;
  /** Records whose fighters came from the description tier. */
  descriptionRecovered: number;
  /** The played-on date rule, where a channel declares one (checklist 5s). */
  playedOn: { used: number; refused: number; absent: number; maxLagDays: number };
  /** Misses that name a roster character — the reject printer's precise half.
   *  Sampled to ten per channel; `rejectCount` is the whole population. */
  rejects: { id: string; title: string; kind: string }[];
  rejectCount: number;
}

/** Duration buckets (parse.ts DURATION_BUCKETS) → count, three populations. */
export interface DurationHistogram {
  records: Record<string, number>;
  /** Too-short or too-long uploads whose title DID parse as a matchup — the
   *  population a different floor or ceiling would admit. */
  matchShapedMisses: Record<string, number>;
  otherMisses: Record<string, number>;
}

export interface FinishInput {
  built: MatchVideo[];
  /** Records parsed from a FROZEN channel's dump — present only on the
   *  freeze-pin seeding path (`data:fetch --include-frozen`). */
  frozenBuilt: Map<ChannelKey, MatchVideo[]>;
  committed: MatchVideo[];
  overrides: Record<string, VideoOverride>;
  pins: SourcePins;
  residue: Map<string, number>;
  queue: ReviewQueueItem[];
  perChannel: Map<ChannelKey, ChannelTally>;
  /** Every video id any title dump held, pre-gate → which dump. */
  rawSeen: Map<string, string>;
  durations: Map<ChannelKey, DurationHistogram>;
  /** Handle word count → sides. */
  handleWords: Record<string, number>;
  matcher: AliasMatcher;
  supportIndex: SupportIndex;
  characters: CharacterRecord[];
  supports: SupportRecord[];
}

/**
 * raw/.replayTheater.stats.json — what the index pull learned about itself
 * (scripts/fetch-theater.ts, a later wave). THE SHARED CONTRACT: `mode` is
 * LOAD-BEARING. It is how "committed but absent from the dump" is told apart
 * between "vanished upstream" (a full sweep saw the whole catalogue) and "not in
 * the pages we read" (a cursor delta is a few hundred rows off the front of the
 * feed). A reader that keeps only `highestId` can never make that distinction.
 */
export interface TheaterStats {
  mode?: 'cursor' | 'full';
  highestId?: number;
  maxEntryId?: number;
  pagesRead?: number;
  hitCursorBound?: boolean;
  seen?: number;
  records?: number;
  unresolvable?: number;
  unresolvablePct?: number;
  badLinks?: number;
  collisions?: number;
  wrongGame?: number;
}

export async function writeReportAndData(input: FinishInput): Promise<void> {
  const {
    built,
    frozenBuilt,
    committed,
    overrides,
    pins,
    residue,
    queue,
    perChannel,
    rawSeen,
    matcher,
    supportIndex,
    durations,
    handleWords,
  } = input;
  const notes: string[] = [];
  const windows = patchWindows();
  let records = [...built];

  // ── 1. the INDEX intake ──────────────────────────────────────────────────
  const idx = CHANNELS.find((c) => c.index);
  const statsFile = join(RAW, '.replayTheater.stats.json');
  const dumpFile = join(RAW, 'replayTheater.json');
  const theaterStats = await readJsonLocal<TheaterStats | null>(statsFile, null);
  /** Present only when the pull COMPLETED: fetch-theater removes both files
   *  before it fetches and writes them last, so their presence is the pull's own
   *  receipt rather than yesterday's leftovers. */
  const pullRan = theaterStats !== null && existsSync(dumpFile);
  let theater: TheaterMerge | null = null;
  let theaterCarried: number | null = null;
  if (idx?.index) {
    const dump = existsSync(dumpFile) ? await readJsonLocal<TheaterRawRecord[]>(dumpFile, []) : [];
    if (dump.length > 0) {
      const build = buildTheaterRecords(dump, {
        records,
        committed,
        overrides,
        rawSeen,
        matcher,
        supportIndex,
        index: idx.index,
        floor: idx.preReleaseFrom ?? LAUNCH,
        floorSec: idx.minDurationSec ?? MIN_MATCH_SEC,
        windows,
      });
      // ── ADD-ONLY MERGE (checklist 12d) ───────────────────────────────────
      // The daily path reads a bounded cursor window, so the dump is
      // deliberately a recent slice of the catalogue rather than the whole
      // thing. Rebuilding from it alone would drop every older record on every
      // cron run. So: take what this run built, then carry every committed
      // record of this intake the dump did not reproduce. What "did not
      // reproduce" MEANS depends on the mode, and conflating the two would be
      // the most misleading number in report.md — after a FULL sweep it is "no
      // longer rebuilds from the catalogue", after a CURSOR run it is every
      // record older than the pages read and means nothing.
      const byRecordId = new Map(build.built.map((r) => [r.id, r]));
      const survivors: MatchVideo[] = [];
      for (const v of committed) {
        if (v.intake !== 'replayTheater') continue;
        if (byRecordId.has(v.id)) continue;
        byRecordId.set(v.id, v);
        survivors.push(v);
      }
      const absorbed = survivors.filter((v) => build.known.has(v.videoId ?? v.id)).length;
      const theaterRecords = [...byRecordId.values()];
      records = records.concat(theaterRecords);
      theater = {
        ...build,
        floorSec: idx.minDurationSec ?? MIN_MATCH_SEC,
        mode: theaterStats?.mode ?? 'unknown',
        dumped: dump.length,
        carried: survivors.length,
        absorbed,
        vanished: survivors.length - absorbed,
        total: theaterRecords.length,
      };
      // THE PIN ONLY EVER GROWS ON THE REBUILD PATH (`<`), and is asserted
      // EXACTLY on the carry path (`!==`). That asymmetry is deliberate: a
      // rebuild that falls below the pin dropped records inside the run, while a
      // carry that differs from the pin means the committed file moved on its
      // own.
      const before = pins.replayTheater ?? 0;
      if (theaterRecords.length < before) {
        throw new Error(
          `Replay Theater built ${theaterRecords.length} record(s) but the pin says ${before}. ` +
            `This intake is add-only, so a falling count means records were dropped inside the ` +
            `run. Nothing written. Investigate, then edit data/source-pins.json deliberately.`,
        );
      }
      pins.replayTheater = theaterRecords.length;
    } else {
      // CARRY. The cron works from a fresh checkout and raw/ is gitignored, so a
      // run whose pull failed has no dump — and the pipeline must not publish
      // that as a deletion. An EMPTY dump is the same case by design
      // (types/index.ts cronFetchedWithCarry).
      const carried = committed.filter((v) => v.intake === 'replayTheater');
      const pin = pins.replayTheater;
      if (pin === undefined && carried.length > 0) {
        throw new Error(
          `Replay Theater carried ${carried.length} committed record(s) but ` +
            `data/source-pins.json has no pin for it. "No expectation" is the exact state the ` +
            `pin exists to prevent. Run \`npm run data:theater\` then \`npm run data:parse\` to ` +
            `rebuild and pin. Nothing written.`,
        );
      }
      if (pin !== undefined && carried.length !== pin) {
        throw new Error(
          `Replay Theater carry expected ${pin} committed record(s), found ${carried.length}. ` +
            `The committed file is both the source and the target of this carry, so one bad run ` +
            `would poison every later run silently. Nothing written.`,
        );
      }
      if (carried.length > 0) pins.replayTheater = carried.length;
      records = records.concat(carried);
      theaterCarried = carried.length;
    }
  }

  // ── the cursor value: COMPUTED here, WRITTEN in step 10 (checklist 12e) ───
  // Written by parse on the PULL, never by the fetcher: a fetcher that wrote it
  // would advance the cursor for a pull whose records parse then refused, and
  // the next run would skip those pages forever. FORWARD-ONLY, because a bounded
  // cursor read sees a lower highest-id than a full sweep did. And keyed on the
  // pull having HAPPENED (stats + dump present), not on the dump holding rows —
  // the common carry path rebuilds nothing and a cursor keyed on rebuilds never
  // advances at all.
  //
  // The value is the stats file's `maxEntryId` — the highest entry id the pull
  // OBSERVED, pre-game-gate — never the highest id among the records it BUILT: a
  // gated-out entry still has to advance the cursor, or the next morning re-reads
  // it forever.
  const cursorPath = join(DATA, 'theater-cursor.json');
  const cursorFile = await readJsonLocal<Record<string, number>>(cursorPath, {});
  const cursorPrev = typeof cursorFile.replayTheater === 'number' ? cursorFile.replayTheater : null;
  const cursorSeen = pullRan
    ? Number(theaterStats?.maxEntryId ?? theaterStats?.highestId ?? 0) || 0
    : 0;
  const cursorNext = Math.max(cursorPrev ?? 0, cursorSeen);
  // Seeded at 0 when the file is absent: the commit guard names this path in its
  // `git add` list, and a path that does not exist fails that step under
  // `set -e`. 0 is what the fetcher reads an absent file as, so seeding it
  // changes nothing the fetcher does.
  const cursorWrite = cursorPrev === null || cursorNext > cursorPrev ? cursorNext : null;

  // ── 2. frozen channels: carry byte-stable, assert the pin ────────────────
  // THIS BRANCH HAS A CONSUMER ON DAY ONE: drewShoto ships frozen with
  // `records: -1`, a sentinel no carried count can ever equal, so the assert
  // throws on the first parse until a human has seeded the pin through the
  // ritual below. The alternative — an empty freeze that looks like a working
  // one — is the failure the sentinel exists to prevent.
  for (const ch of CHANNELS) {
    if (!ch.frozen) continue;
    const pin = ch.frozen.records;
    const fromDump = frozenBuilt.get(ch.id);
    const ritual = [
      `  The pin is seeded ONCE, with the freeze lifted for one fetch:`,
      `    1. npm run data:fetch -- --only=${ch.id} --include-frozen`,
      `    2. npm run data:parse -- --seed-freeze-pins      (prints the count, writes nothing)`,
      `    3. set frozen.records on ${ch.id} in scripts/channels.ts to that count`,
      `    4. npm run data:parse                            (asserts the parse against the pin`,
      `                                                      and writes the records)`,
      `  Every later run carries the committed records and re-asserts the pin.`,
    ];
    if (fromDump) {
      if (pin < 0) {
        throw new Error(
          [
            `${ch.id} is frozen with the placeholder pin ${pin} and raw/${ch.id}.json parsed to ` +
              `${fromDump.length} record(s). The pin must be set before anything is written.`,
            ...ritual,
            `  You are at step 3: set frozen.records: ${fromDump.length}. Nothing written.`,
          ].join('\n'),
        );
      }
      if (fromDump.length !== pin) {
        throw new Error(
          `${ch.id} is frozen at ${pin} record(s) but its dump parsed to ${fromDump.length}. A ` +
            `frozen dump that parses to a different count than the pin means either the pin was ` +
            `seeded from a different parse or the parser changed under it. Re-run ` +
            `\`npm run data:parse -- --seed-freeze-pins\` and set the pin deliberately. Nothing written.`,
        );
      }
      records = records.concat(fromDump);
      notes.push(
        `${ch.id}: frozen since ${ch.frozen.since}; ${fromDump.length} record(s) parsed from a ` +
          `frozen dump (the seeding path) and asserted against the pin.`,
      );
      continue;
    }
    const carried = committed.filter((v) => v.intake === ch.id);
    if (pin < 0) {
      throw new Error(
        [
          `${ch.id} is frozen with the placeholder pin ${pin}, which no carried count can equal ` +
            `(${carried.length} committed). This is deliberate: it stops an unseeded freeze ` +
            `shipping an empty channel that looks like a working one.`,
          ...ritual,
          `  Nothing written.`,
        ].join('\n'),
      );
    }
    if (carried.length !== pin) {
      throw new Error(
        `${ch.id} is frozen at ${pin} record(s) but the committed file holds ${carried.length}. ` +
          `Editing the pin IS the deliberate-prune mechanism; a mismatch nobody edited means the ` +
          `archive moved on its own. Nothing written.`,
      );
    }
    records = records.concat(carried);
    notes.push(`${ch.id}: frozen since ${ch.frozen.since}, ${carried.length} record(s) carried.`);
  }

  // ── 3. hand overrides ────────────────────────────────────────────────────
  // A hand verdict beats every automatic tier, and it is applied AFTER the
  // intakes have produced their candidates so it can correct any of them.
  for (const r of records) {
    const ov = overrides[r.id];
    if (!ov) continue;
    if (ov.sides) r.sides = ov.sides as [MatchSide, MatchSide];
    if (ov.supports) r.supports = ov.supports;
    if (ov.channel) r.channel = ov.channel;
    // A CORRECTED DATE RE-DERIVES THE ERA AND THE PATCH. The three fields are
    // separately overridable (types/index.ts VideoOverride) because a reviewer
    // may need to pin any one of them, but a date moved across a boundary and
    // left with its old patch token is a record filed under a balance state it
    // was not played in — which renders, filters and passes every count
    // assertion. So the date is re-derived by default and only an EXPLICIT
    // era/patch override wins over the table.
    if (ov.date) {
      r.date = ov.date;
      r.era = seasonToken(seasonForDate(ov.date));
      r.patch = patchForDate(ov.date, windows).version;
    }
    if (ov.era) r.era = ov.era;
    if (ov.patch) r.patch = ov.patch;
  }

  // ── 4. dedupe on the INTAKE key ──────────────────────────────────────────
  // Checklist step 2: precedence is the CHANNELS array order, and ONLY a
  // hand-authored `sides` override protects a record. Testing for the mere
  // presence of `sides` would make every override-bearing record win, which
  // inverts declared precedence silently.
  //
  // THE KEY CANNOT SEE THIS GAME'S REAL DUPLICATE, and step 7 below is the
  // answer rather than a widening of this one.
  const byId = new Map<string, MatchVideo>();
  let dropped = 0;
  const protectedBy = (v: MatchVideo) => overrides[v.id]?.resolvedBy === 'human';
  for (const r of records) {
    const prev = byId.get(r.id);
    if (!prev) {
      byId.set(r.id, r);
      continue;
    }
    const winner =
      protectedBy(r) && !protectedBy(prev)
        ? r
        : protectedBy(prev) && !protectedBy(r)
          ? prev
          : (PRECEDENCE.get(r.intake) ?? 99) < (PRECEDENCE.get(prev.intake) ?? 99)
            ? r
            : prev;
    byId.set(r.id, winner);
    dropped++;
  }
  records = [...byId.values()];
  records.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));

  // ── 5. THE COLLAPSE GUARD — before any write ─────────────────────────────
  // Parsed-vs-committed, per intake. >10% AND >20 records lost. See the header:
  // on this corpus it cannot fire, and that is stated rather than hoped for.
  const beforeByIntake = new Map<ChannelKey, number>();
  for (const v of committed) beforeByIntake.set(v.intake, (beforeByIntake.get(v.intake) ?? 0) + 1);
  const afterByIntake = new Map<ChannelKey, number>();
  for (const v of records) afterByIntake.set(v.intake, (afterByIntake.get(v.intake) ?? 0) + 1);

  const collapses: string[] = [];
  const shrunk: string[] = [];
  for (const [intake, before] of beforeByIntake) {
    if (before === 0) continue;
    const after = afterByIntake.get(intake) ?? 0;
    const lost = before - after;
    if (lost <= 0) continue;
    if (lost > 20 && lost / before > 0.1) {
      collapses.push(
        `  ${intake}: ${before} → ${after} (lost ${lost}, ${((lost / before) * 100).toFixed(1)}%)`,
      );
    } else {
      // EVERY loss the guard cannot refuse is still PRINTED, because on this
      // corpus that is every loss there is. A silent -3 on a 7-record channel is
      // exactly what the guard would catch at scale and exactly what it cannot
      // catch here.
      shrunk.push(
        `${intake} ${before} → ${after} (lost ${lost}, ${((lost / before) * 100).toFixed(1)}%)`,
      );
    }
  }
  if (collapses.length && !ALLOW_COLLAPSE) {
    throw new Error(
      [
        `✖ COLLAPSE GUARD: ${collapses.length} intake(s) lost more than 10% AND more than 20 records.`,
        ...collapses,
        ``,
        `  Nothing has been written — not videos.json, not the pins, not the theater cursor. A`,
        `  channel collapses because it was deleted, renamed, made private, or rebranded to`,
        `  another game and unlisted its back catalogue — all observed on this platform. If this`,
        `  loss is REAL and intended, re-run with --allow-collapse.`,
      ].join('\n'),
    );
  }

  // ── 5b. THE NAMESPACE ASSERTION — a support may never be a character ─────
  //
  // CHECKLIST 13, ASSERTED RATHER THAN HOPED FOR, over EVERY record from every
  // source: the title arm, the index arm, the freeze carry and the hand
  // overrides. `Side.characters` holds fighter ids and nothing else. If a
  // support ever reaches it the stat unit doubles the roster, the prerender set
  // grows 34 pages nobody asked for, and every fighter's usage share halves —
  // with every count green, which is why this is a throw and not a column.
  //
  // IT TESTS MEMBERSHIP OF THE FIGHTER REGISTRY, NOT DISJOINTNESS OF THE TWO ID
  // SPACES, and the difference is the whole design: `katara` is a fighter id AND
  // a support id, and types/index.ts SupportRecord says in as many words that
  // this is not an error. A rule written as "no character id may also be a
  // support id" would delete the game's most-played fighter.
  const fighterIds = new Set(input.characters.map((c) => c.id));
  const supportIds = new Set(input.supports.map((s) => s.id));
  const strays: string[] = [];
  for (const r of records) {
    for (const [i, s] of r.sides.entries()) {
      for (const c of s.characters) {
        if (fighterIds.has(c)) continue;
        strays.push(
          `  ${r.id} side ${i}: "${c}" is not in data/characters.json` +
            (supportIds.has(c) ? ' — it is a SUPPORT id' : ''),
        );
      }
      if (s.support && !supportIds.has(s.support)) {
        strays.push(`  ${r.id} side ${i}: support "${s.support}" is not in data/supports.json`);
      }
    }
  }
  if (strays.length) {
    throw new Error(
      [
        `✖ NAMESPACE INVARIANT: ${strays.length} side(s) carry an id from the wrong registry.`,
        ...strays.slice(0, 20),
        ...(strays.length > 20 ? [`  … and ${strays.length - 20} more`] : []),
        ``,
        `  Side.characters holds data/characters.json ids and Side.support holds a`,
        `  data/supports.json id. A support in the character list doubles the roster, prerenders`,
        `  pages nobody asked for and halves every usage share — silently. Nothing written.`,
      ].join('\n'),
    );
  }

  // ── 6. players: vote the casing, then the REGISTRY INVARIANT ─────────────
  // playerId() already folds case to ONE id; what is decided here is the DISPLAY
  // spelling, by vote over side appearances, with the tie broken toward mixed
  // case — ALL-CAPS is a styling choice, not how a player writes their own name.
  // The corpus needs it: 'XCali'/'XCaliburBladez'/'XCaliburbladez' on one
  // channel, 'Solid Pajahands'/'Solid PajaHands' on another, 'STiLL'/'STILL'
  // between a channel and the catalogue. The losing spellings are kept as
  // aliases so search still finds them.
  const spellings = new Map<string, Map<string, number>>();
  const evidence = new Map<string, string>();
  for (const r of records) {
    for (const s of r.sides) {
      const m = spellings.get(s.player) ?? new Map<string, number>();
      m.set(s.handle, (m.get(s.handle) ?? 0) + 1);
      spellings.set(s.player, m);
      if (!evidence.has(s.player)) evidence.set(s.player, r.id);
    }
  }
  const casingRank = (h: string): number => {
    const up = h.toUpperCase();
    const lo = h.toLowerCase();
    if (up === lo) return 1; // no case (symbols, digits)
    if (h === up) return 2; // ALL-CAPS
    if (h === lo) return 1; // all-lower
    return 0; // mixed — the spelling a person most likely typed
  };
  const players = new Map<string, PlayerRecord>();
  let multiSpelling = 0;
  for (const [id, m] of spellings) {
    const ranked = [...m.entries()].sort(
      (a, b) => b[1] - a[1] || casingRank(a[0]) - casingRank(b[0]) || a[0].localeCompare(b[0]),
    );
    const [handle] = ranked[0] as [string, number];
    const aliases = ranked.slice(1).map(([h]) => h);
    if (aliases.length) multiSpelling++;
    players.set(id, { id, handle, ...(aliases.length ? { extra: { aliases } } : {}) });
  }

  // THE REGISTRY INVARIANT (checklist 5n), AT PARSE TIME, THROUGH THE MATCHER,
  // OVER BOTH NAMESPACES. No player-registry entry may resolve to a roster
  // FIGHTER or to a SUPPORT unless a human has vouched for it with a video id
  // (roster.ts CONFIRMED_CHARACTER_NAMED_PLAYERS).
  //
  // THE SUPPORT HALF IS THIS GAME'S AND EVERY SIBLING'S GUARD IS BLIND TO IT:
  // takeANappa's PGUYXwHR_x8 and mGiMDzaWAIk extract "Sozin" as a HANDLE
  // whenever the support namespace is absent, and a fighters-only comparison
  // passes it silently because 'Sozin' resolves to no fighter. Same for 'Suki'
  // on phoenixWrong and 'Kanna'/'Pakku' on STiLL.
  //
  // A HARD STOP, with the evidence a human needs to add the row: the id, the
  // handle, what it resolves to, and a record it appears in. All offenders are
  // printed at once — one stop per handle would be a bad morning.
  const confirmedById = new Map(CONFIRMED_CHARACTER_NAMED_PLAYERS.map((p) => [p.id, p]));
  const collisions: string[] = [];
  const confirmedSeen: string[] = [];
  for (const p of players.values()) {
    const spans = matcher.find(p.handle);
    const hits = spans.filter((s) => s.fighter || s.support);
    if (hits.length === 0) continue;
    if (confirmedById.has(p.id)) {
      confirmedSeen.push(p.id);
      continue;
    }
    const seen = spellings.get(p.id);
    const n = seen ? [...seen.values()].reduce((a, b) => a + b, 0) : 0;
    const what = hits
      .map((s) => `${s.fighter ?? s.support}${s.fighter ? '' : ' (support)'}`)
      .join(', ');
    collisions.push(
      `  ${p.id.padEnd(24)} "${p.handle}" → ${what}  (${n} side(s), e.g. ${evidence.get(p.id) ?? '?'})`,
    );
  }
  if (collisions.length) {
    throw new Error(
      [
        `✖ REGISTRY INVARIANT: ${collisions.length} player handle(s) resolve to a roster fighter`,
        `  or support and are not on CONFIRMED_CHARACTER_NAMED_PLAYERS (scripts/roster.ts).`,
        ...collisions,
        ``,
        `  Each line is either a character filed as a person (a slot-order or namespace defect —`,
        `  fix the parse) or a person named after one (watch the video, then add the row WITH its`,
        `  id as evidence). Nothing is written until every line is one or the other.`,
      ].join('\n'),
    );
  }
  const confirmedUnseen = CONFIRMED_CHARACTER_NAMED_PLAYERS.filter((p) => !players.has(p.id));
  const confirmedNoEvidence = CONFIRMED_CHARACTER_NAMED_PLAYERS.filter((p) => p.video === null);

  // ── 7. MATCH IDENTITY — REPORT ONLY, NEVER A DROP KEY (checklist 2b) ─────
  // The intake key cannot see the duplicate that matters once an organiser posts
  // BOTH a full VOD and per-match cuts: the index source segments the VOD, the
  // channel arm ingests the cut, and the two records collide on nothing.
  // Measured here at 10 of 47 index segments on one organiser's VODs, 70% on the
  // single VOD it fully re-cut, with one pairing reaching five candidate records
  // across three intakes and five distinct video ids.
  //
  // AND IT IS NOT A KEY, BECAUSE THE RUNBACK IS A LEGITIMATE COLLISION: the same
  // two players on the same two fighters on the same day is what a winners final
  // followed by a grand final looks like. Dropping on it deletes the grand final
  // of the corpus's biggest event. So it is computed, reported, and routed to a
  // human — and the records STAY PUBLISHED, which makes 'duplicate-candidate'
  // the one queue kind whose subject is not withheld (see step 8).
  const signatures = new Map<string, { sig: MatchSignature; ids: MatchVideo[] }>();
  for (const r of records) {
    const chars = r.sides.map((s) => s.characters[0]);
    if (!chars[0] || !chars[1]) continue;
    const sig: MatchSignature = {
      players: [r.sides[0].player, r.sides[1].player].sort() as [string, string],
      characters: [chars[0], chars[1]].sort() as [string, string],
      playedOn: r.date,
    };
    const key = `${sig.players.join('|')}~${sig.characters.join('|')}~${sig.playedOn}`;
    const group = signatures.get(key) ?? { sig, ids: [] };
    group.ids.push(r);
    signatures.set(key, group);
  }
  const dupGroups = [...signatures.values()].filter((g) => g.ids.length > 1);
  const dupRecords = dupGroups.reduce((n, g) => n + g.ids.length, 0);
  const crossIntakeGroups = dupGroups.filter(
    (g) => new Set(g.ids.map((r) => r.intake)).size > 1,
  ).length;
  for (const g of dupGroups) {
    const head = g.ids[0]!;
    queue.push({
      id: head.id,
      kind: 'duplicate-candidate',
      channel: head.intake,
      title: head.title,
      publishedAt: head.publishedAt,
      durationSec: head.durationSec,
      handles: [head.sides[0].handle, head.sides[1].handle],
      duplicates: { signature: g.sig, ids: g.ids.map((r) => r.id) },
    });
  }

  // ── 8. review queue — regenerated, and pending items never ship ──────────
  // Resolutions live solely in overrides.json, so the queue self-clears as
  // verdicts land. A published id normally means the item is stale — EXCEPT for
  // 'duplicate-candidate', whose whole point is that both records are published
  // and a human has to say whether they are one match (step 7).
  const publishedIds = new Set(records.map((r) => r.id));
  const pending = queue.filter(
    (q) => !overrides[q.id] && (q.kind === 'duplicate-candidate' || !publishedIds.has(q.id)),
  );

  // ── 9. residue, and the unreleased-fighter early warning ─────────────────
  // The residue gate is also how an UNRELEASED fighter announces themselves:
  // uploaders put the name in titles the day they ship, long before anybody here
  // reads an announcement. On this game it is also the only automatic detector
  // for the two supports nobody has evidenced yet, because the vendor has
  // published no date for anything.
  const residueRows = [...residue.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
  const unreleasedHits = UNRELEASED.filter((u) => {
    const needle = (u.name || u.id.replace(/-/g, ' ')).toLowerCase();
    return needle ? residueRows.some(([text]) => text.toLowerCase().includes(needle)) : false;
  });

  // ── 10. WRITE (everything above passed) ──────────────────────────────────
  await write('videos.json', records);
  await write(
    'players.json',
    [...players.values()].sort((a, b) => a.id.localeCompare(b.id)),
  );
  await write('review-queue.json', pending);
  await write('source-pins.json', pins);
  if (cursorWrite !== null) await write('theater-cursor.json', { replayTheater: cursorWrite });

  // ── the report ───────────────────────────────────────────────────────────
  const pct = (n: number, d: number) => (d === 0 ? '—' : `${((n / d) * 100).toFixed(1)}%`);
  /** Intakes big enough for the guard's second arm to be reachable at all. */
  const guardAwake = [...afterByIntake.values()].filter((n) => n > 20).length;
  const mirrors = records.filter((r) =>
    r.sides[0].characters.some((c) => r.sides[1].characters.includes(c)),
  ).length;
  const withSupport = records.filter((r) => r.supports?.some(Boolean)).length;
  const missKinds = [
    'no-marker',
    'before-floor',
    'live',
    'too-short',
    'too-long',
    'no-vs',
    'vs-count',
    'no-char',
    'no-handle',
    'matchup-only',
    'slot-ambiguous',
    'support-overlap',
  ];
  const titleChannels = CHANNELS.filter((c) => !c.index);

  const due = await dueExpiries();
  const lines: string[] = [];
  if (due.length) lines.push(...expiryBlock(due), '');
  if (unreleasedHits.length) {
    lines.push(
      '## ⚠ AN UNRELEASED FIGHTER MAY HAVE SHIPPED',
      '',
      ...unreleasedHits.map(
        (u) => `- **${u.id}** appears in parser residue. Promote it — see scripts/expiries.ts.`,
      ),
      '',
    );
  }
  lines.push(
    '# Avatar Legends pipeline report',
    '',
    `- **${records.length}** published record(s) · **${players.size}** player(s) · ` +
      `**${input.characters.length}** fighter(s) · **${input.supports.length}** support(s)`,
    `- **${withSupport}** record(s) state at least one support (${pct(withSupport, records.length)}) — ` +
      'the support is a SECOND NAMESPACE and never enters `Side.characters` (checklist 13)',
    `- **${mirrors}** mirror match(es) (${pct(mirrors, records.length)})`,
    `- **${pending.length}** pending review item(s) — absent from the site, never guessed`,
    `- **${dropped}** duplicate id(s) resolved by intake precedence`,
    `- **${confirmedSeen.length}** of ${CONFIRMED_CHARACTER_NAMED_PLAYERS.length} confirmed ` +
      'character-named player(s) present; every other handle resolves to no fighter and no support',
    '',
    '## Per intake',
    '',
    'The corpus unit is the SET, not the game: durations run 184s to 7,112s and the whole-video',
    'records on these channels are sets. `too-short` is judged against the floor in brackets and',
    '`too-long` against the ceiling — set on aegisEsports alone, where six whole-tournament VODs',
    'of 4,840-7,112s would each become ONE record standing for a whole bracket (checklist 5t).',
    '',
    '| intake | source | raw | marked | parsed | published | too-short (floor) | too-long (ceil) | live | rejects naming a character |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...CHANNELS.map((c) => {
      const pub = afterByIntake.get(c.id) ?? 0;
      if (c.index) {
        const mode = theater ? theater.mode : theaterCarried !== null ? 'carried' : '—';
        const parsed = theater && theater.mode === 'full' ? String(theater.built.length) : '—';
        return `| ${c.id} _(index, ${mode})_ | ${c.source} | — | — | ${parsed} | ${pub} | — | — | — | — |`;
      }
      const p = perChannel.get(c.id);
      const tag = c.frozen ? ' _(frozen)_' : c.freezeWatch ? ' _(watch)_' : '';
      if (!p) return `| ${c.id}${tag} | ${c.source} | — | — | — | ${pub} | — | — | — | — |`;
      return (
        `| ${c.id}${tag} | ${c.source} | ${p.raw} | ${p.marked} | ${p.parsed} | ${pub} | ` +
        `${p.misses['too-short'] ?? 0} (${p.floorSec}s) | ${p.misses['too-long'] ?? 0} ` +
        `(${p.ceilSec === null ? '—' : `${p.ceilSec}s`}) | ${p.misses['live'] ?? 0} | ${p.rejectCount} |`
      );
    }),
    '',
    `_The collapse guard needs a per-intake loss of >10% AND >20 records. ${guardAwake} of ` +
      `${afterByIntake.size} intake(s)_`,
    `_with records commit more than 20, so on the other ${Math.max(0, afterByIntake.size - guardAwake)} its second arm cannot fire at all_`,
    '_(checklist 7b). For those the live protection is the freeze pin, the freezeWatch rows and_',
    '_this table — so every loss the guard cannot refuse is printed below._',
    '',
    shrunk.length
      ? `⚠ intakes that lost records this run, none of them large enough for the guard: ${shrunk.join(' · ')}`
      : '✓ no intake lost a record this run.',
    '',
  );

  // ── the index intake ─────────────────────────────────────────────────────
  lines.push(
    '### Index intake — Replay Theater',
    '',
    'Fetched by the daily cron and ADD-ONLY: a committed record is carried whether or not the',
    'catalogue still lists it, so this count can only rise. The cron does not depend on the pull',
    'succeeding — on any failure there is no dump, the committed records are carried against the',
    'pin, and the run stays green (checklist 12d, 9c).',
    '',
  );
  if (theater) {
    const t = theater;
    if (t.mode === 'full') {
      lines.push(
        `Rebuilt from a **full sweep** of ${theaterStats?.pagesRead ?? '—'} page(s): ${t.dumped} row(s) ` +
          `dumped, ${t.knownCount} already known here (${pct(t.knownCount, t.dumped)}), ` +
          `${t.built.length} built, ${t.carried} carried (add-only), **${t.total}** total; pin ` +
          `${pins.replayTheater}.`,
        '',
        `Of the carried, **${t.vanished}** no longer rebuild from the catalogue and **${t.absorbed}** ` +
          `are now known from a tracked channel. Sweep hygiene: ${theaterStats?.unresolvable ?? '—'} ` +
          `unresolvable video(s) (${theaterStats?.unresolvablePct ?? '—'}% — RE-MEASURED, never ` +
          `inherited: this catalogue read 0.00% dead at Stage 0 where two siblings read 32% and ` +
          `9.2%), ${theaterStats?.badLinks ?? '—'} unusable link(s), ${theaterStats?.collisions ?? '—'} ` +
          `record-id collision(s), ${theaterStats?.wrongGame ?? '—'} wrong-game row(s).`,
        '',
      );
    } else {
      // PER-RUN WINDOW NUMBERS ARE WITHHELD ON A CURSOR MORNING: dumped/skipped
      // describe this morning's window, not the corpus, and printing them makes
      // report.md differ daily whether or not a record changed — which retires
      // the cron's no-change-no-commit rule.
      lines.push(
        `Rebuilt from a **cursor delta**: ${t.built.length} built this run, ${t.carried} carried ` +
          `(add-only), **${t.total}** total; pin ${pins.replayTheater}. "Not in this pull" is ` +
          'withheld: on a cursor morning it is every record older than the pages read and means ' +
          'nothing.',
        '',
      );
    }
    lines.push(
      `Rows the build refused, counted never guessed: ${t.placeholder} placeholder handle(s), ` +
        `${t.beforeFloor} before the ${idx?.preReleaseFrom ?? LAUNCH} floor, ${t.live} live, ` +
        `${t.tooShort} whole-video row(s) under ${t.floorSec}s, ${t.excluded} excluded by hand, ` +
        `${t.dupIds} duplicate record id(s) inside the dump. Rows whose own game label is not ` +
        `this game's are refused one stage earlier, by the fetcher, and counted as ` +
        `${theaterStats?.wrongGame ?? '—'} above (checklist 12a).`,
      '',
      `Segment ids: **${t.segments}** row(s) took a \`videoId@startSeconds\` id and **${t.wholeVideos}** ` +
        `took the bare YouTube id. The boundary is \`segmentOffsetMinShare\` on a SINGLE-row video ` +
        `(types/index.ts: 26 of 29 single-row offsets are 5-51s intro skips, and the two real ` +
        `segments sit at 50% and 56% of their VOD) and "every row" on a multi-row one, where a ` +
        `t=0 first segment is still a segment.`,
      ...(t.unresolvedChars.size
        ? [
            '',
            'Character or support strings the roster could not resolve EXACTLY (an alias-table',
            'candidate, or a name the vendor has shipped since):',
            ...[...t.unresolvedChars.entries()]
              .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
              .slice(0, 20)
              .map(([s, n]) => `- ${n}× \`${s}\``),
          ]
        : []),
      '',
    );
  } else if (theaterCarried !== null) {
    lines.push(
      pullRan
        ? `The pull ran and found nothing newer than the cursor, so the committed catalogue was ` +
            `carried unchanged: **${theaterCarried}** record(s), pin ${pins.replayTheater ?? 0}. A ` +
            'quiet morning is the ordinary case here, not a failed one.'
        : `No pull produced a dump this run, so the committed catalogue was carried against its ` +
            `pin: **${theaterCarried}** record(s). That is the designed fallback, not a failure of ` +
            'this run; `npm run data:theater` refreshes it.',
      '',
    );
  }
  if (theaterStats?.hitCursorBound) {
    lines.push(
      '_⚠ The cursor hit its page bound this run — entries may be unreached._',
      '_Nothing is lost (add-only); `npm run data:theater -- --full` reconciles._',
      '',
    );
  }

  // ── match identity ───────────────────────────────────────────────────────
  lines.push(
    '## Match identity — a REPORT-ONLY tier (checklist 2b)',
    '',
    'A signature is normalized handle pair × fighter pair × played-on day. It is a HYPOTHESIS',
    'about footage identity, not a verdict: the RUNBACK is a legitimate collision — same two',
    'players, same two fighters, same day, winners final then grand final — so nothing is dropped',
    'on it. Composite segment ids stay the mechanism for index-within-VOD.',
    '',
    `- **${dupGroups.length}** signature(s) cover more than one record, **${dupRecords}** record(s) in all ` +
      `(${pct(dupRecords, records.length)} of the archive)`,
    `- **${crossIntakeGroups}** of those span more than one intake — the case the intake key cannot see`,
    `- every one is queued as \`duplicate-candidate\` and every one is still published`,
    '',
    ...dupGroups
      .slice(0, 12)
      .map(
        (g) =>
          `- \`${g.sig.players.join(' vs ')}\` on \`${g.sig.characters.join(' / ')}\`, ${g.sig.playedOn}: ` +
          g.ids.map((r) => `\`${r.id}\` (${r.intake})`).join(', '),
      ),
    dupGroups.length > 12 ? `- … ${dupGroups.length - 12} more` : '',
    '',
  );

  // ── misses, per channel ──────────────────────────────────────────────────
  lines.push(
    '## Misses, per intake',
    '',
    'Most of the miss rate is the gate working: 45,992 uploads carry 454 marked titles, so',
    '`no-marker` is the whole of the other 45,538 and is correct on every one. The columns that',
    'name a PARSER problem are `no-char`, `no-handle`, `slot-ambiguous` and `support-overlap`.',
    '`matchup-only` is checklist 5r: both sides named a fighter and NEITHER named a person, which',
    'is CPU or arcade footage rather than a match — it is refused, never queued, because there is',
    'no player to complete.',
    '',
    `| intake | ${missKinds.join(' | ')} | excluded |`,
    `| --- | ${missKinds.map(() => '---:').join(' | ')} | ---: |`,
    ...titleChannels.flatMap((c) => {
      const p = perChannel.get(c.id);
      if (!p) return [];
      return [
        `| ${c.id} | ${missKinds.map((k) => p.misses[k] ?? 0).join(' | ')} | ${p.excluded} |`,
      ];
    }),
    '',
  );

  // ── slot order ───────────────────────────────────────────────────────────
  lines.push(
    '## Slot order, per intake — both sides tallied',
    '',
    'The parser resolves by roster membership and only RECORDS which slot held the fighter',
    '(types/index.ts SlotOrder). `tie-broken` is the one branch where the declared order decided:',
    'both readings of a bracketed side resolved. Stage 0 measured that branch at ZERO sides after',
    'the decoration strips and FIVE before them, so a rising rate means the strips have stopped',
    'covering a channel — which is why this is printed rather than merely collected.',
    '',
    `| intake | declared | ${SLOT_ORDERS.join(' | ')} | tie-broken | overlap | sides |`,
    `| --- | --- | ${SLOT_ORDERS.map(() => '---:').join(' | ')} | ---: | ---: | ---: |`,
    ...titleChannels.flatMap((c) => {
      const p = perChannel.get(c.id);
      if (!p) return [];
      const sides = SLOT_ORDERS.reduce((n, k) => n + p.slot[k], 0);
      const top = [...SLOT_ORDERS].sort((a, b) => p.slot[b] - p.slot[a])[0] ?? c.slotOrder;
      const bracketed = c.slotOrder === 'handle-outside' || c.slotOrder === 'chars-outside';
      const drift = sides > 0 && bracketed && top !== c.slotOrder ? ` ⚠ resolves ${top}` : '';
      return [
        `| ${c.id} | ${c.slotOrder}${drift} | ${SLOT_ORDERS.map((k) => p.slot[k]).join(' | ')} | ` +
          `${p.tieBroken} (${pct(p.tieBroken, sides)}) | ${p.overlaps} | ${sides} |`,
      ];
    }),
    '',
    '_A `chars-outside` share on a channel declared `handle-first-bare` is that channel reading its_',
    '_own inconsistency rather than the parser guessing — schoolBus flips orientation inside one_',
    '_title and the tally is where that shows._',
    '',
  );

  // ── the support namespace ────────────────────────────────────────────────
  lines.push(
    '## The support namespace (checklist 13)',
    '',
    'A support is not a second character: it has no page, no usage share and no presence in',
    '`Side.characters`. The two vocabularies OVERLAP — `Katara` is a launch fighter AND Avatar',
    "Aang's support — so a span that resolves in both beside another character span is queued as",
    '`support-overlap` and never guessed. `owner mismatch` is the partition invariant firing: every',
    'attested support appears under exactly one fighter across all 516 catalogue sides, so a',
    'support on a side whose fighter does not own it is a parse error, and the support is dropped',
    'while the record is kept.',
    '',
    '| intake | sides with a support | kept | owner mismatch | overlaps queued | description-tier records |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
    ...titleChannels.flatMap((c) => {
      const p = perChannel.get(c.id);
      if (!p || (p.supportSides === 0 && p.overlaps === 0 && p.descriptionRecovered === 0))
        return [];
      return [
        `| ${c.id} | ${p.supportSides} | ${p.supportsStated} | ${p.supportOwnerMismatch} | ` +
          `${p.overlaps} | ${p.descriptionRecovered} |`,
      ];
    }),
    '',
  );

  // ── played-on dates ──────────────────────────────────────────────────────
  const playedRows = titleChannels.filter((c) => (perChannel.get(c.id)?.playedOn.used ?? 0) > 0);
  if (playedRows.length) {
    lines.push(
      '## Played-on dates (checklist 5s)',
      '',
      'Where a channel titles a set with the day it was PLAYED, that day is the record date and',
      "`publishedAt` is kept beside it. Keyed on publishedAt instead, that channel's whole corpus",
      'is misdated AND its backlog is credited to the weeks it was uploaded in — which is how a',
      'corpus looks like it is accelerating while ambient volume is flat.',
      '',
      ...playedRows.map((c) => {
        const p = perChannel.get(c.id)!;
        return (
          `- **${c.id}**: ${p.playedOn.used} marked upload(s) dated from the title, ` +
          `${p.playedOn.refused} token(s) refused as outside the ` +
          `${c.playedOnDateFrom?.maxLagDays ?? 0}-day bound, ${p.playedOn.absent} carrying no ` +
          `token at all; largest lag used ${p.playedOn.maxLagDays} day(s)`
        );
      }),
      '',
    );
  }

  // ── duration histogram ───────────────────────────────────────────────────
  const bucketNames = DURATION_BUCKETS.map(([name]) => name);
  lines.push(
    '## Duration histogram, per intake',
    '',
    `Both edges are re-derived from this table rather than from a comment: the floor (${MIN_MATCH_SEC}s`,
    'default) and the ceiling (declared on one channel). `match-shaped misses` are uploads whose',
    'TITLE parsed as a matchup and whose duration refused them — the population a different floor',
    'or ceiling would admit.',
    '',
    `| intake · population | ${bucketNames.join(' | ')} |`,
    `| --- | ${bucketNames.map(() => '---:').join(' | ')} |`,
    ...titleChannels.flatMap((c) => {
      const h = durations.get(c.id);
      if (!h) return [];
      const row = (label: string, m: Record<string, number>) =>
        `| ${c.id} · ${label} | ${bucketNames.map((b) => m[b] ?? 0).join(' | ')} |`;
      return [
        row('records', h.records),
        row('match-shaped misses', h.matchShapedMisses),
        row('other misses', h.otherMisses),
      ];
    }),
    '',
  );

  // ── handles ──────────────────────────────────────────────────────────────
  const placeholderTitles = [...perChannel.values()].reduce((n, p) => n + p.placeholderHandles, 0);
  lines.push(
    '## Handles',
    '',
    `- word count per side: ${Object.entries(handleWords)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([k, n]) => `${k} → ${n}`)
      .join(' · ')} — the cap is ${5} words (parse.ts MAX_HANDLE_WORDS). The real 4- and 5-word` +
      ' handles measured here are "OneDrive Isnt Signed In" and "Data Xigbar In Real Life"; a bump' +
      ' at 5 is where decoration leaks show first.',
    `- ${multiSpelling} player(s) seen under more than one spelling; the display casing is the` +
      ' majority spelling, tie-broken toward mixed case, and the rest are kept as aliases',
    `- placeholder handles refused: ${placeholderTitles} on the channels, ${theater?.placeholder ?? 0}` +
      ' in the catalogue. The predicate refuses by NAME only — `♱` (U+2671) is a REAL handle on' +
      ' arinKarin and in the catalogue, and the shared all-punctuation rule would delete it' +
      ' (checklist 12k).',
    '',
  );

  // ── registry invariant ───────────────────────────────────────────────────
  lines.push(
    '## Registry invariant — no player is a fighter OR a support',
    '',
    `Every handle in players.json was resolved through the roster matcher at parse time, across ` +
      `BOTH namespaces. ${confirmedSeen.length} resolve to a character and are on the confirmed ` +
      `list (scripts/roster.ts): ` +
      (confirmedSeen.length ? confirmedSeen.map((id) => `\`${id}\``).join(', ') : '—') +
      '.',
    ...(confirmedUnseen.length
      ? [
          `Confirmed rows NOT present in this registry (stale, or a spelling the parser now reads ` +
            `differently): ${confirmedUnseen.map((p) => `\`${p.id}\``).join(', ')}.`,
        ]
      : []),
    ...(confirmedNoEvidence.length
      ? [
          `⚠ Rows still carrying \`video: null\` — a guess wearing an allow-list's clothes: ` +
            `${confirmedNoEvidence.map((p) => `\`${p.id}\``).join(', ')}.`,
        ]
      : []),
    '',
  );

  // ── rejects (checklist 5e) ───────────────────────────────────────────────
  lines.push(
    '## Rejects — titles that name a character but did not parse, per intake',
    '',
    'Grammar variants are found by reading REJECTS, not successes (checklist 5e). Ten samples per',
    'intake; the count is the whole population. A `matchup-only` refusal is excluded by',
    'construction — it names two fighters by definition and would drown the table.',
    '',
    ...titleChannels.flatMap((c) => {
      const p = perChannel.get(c.id);
      if (!p || p.rejectCount === 0) return [];
      return [
        `**${c.id}** — ${p.rejectCount}`,
        '',
        ...p.rejects.map((r) => `- \`${r.id}\` ${r.kind}: ${r.title.slice(0, 110)}`),
        '',
      ];
    }),
  );

  // ── residue ──────────────────────────────────────────────────────────────
  lines.push(
    '## Residue — text no roster span covered',
    '',
    'A new nickname, a DLC fighter, an unverified support or an uploader typo surfaces here as a',
    'counted line with its literal text instead of vanishing into a silently shorter side. Two',
    'names are known to be waiting in it: `Hakoda` (twice on one channel, in no catalogue row) and',
    '`Grappler` (once), neither of which may be added to data/supports.json without footage — a',
    'support nobody has verified is a support nobody should be able to parse into a record.',
    '',
    ...residueRows.slice(0, 40).map(([text, n]) => `- ${n}× \`${text}\``),
    ...(residueRows.length > 40 ? [`- … ${residueRows.length - 40} more`] : []),
    '',
    ...notes.map((n) => `> ${n}`),
    '',
    `_Generated ${new Date().toISOString()}_`,
  );
  // `l !== undefined`, NOT `l !== ''`: the empty strings in this array are the
  // blank lines between Markdown blocks, and dropping them glues every heading
  // to the paragraph above it.
  await writeFile(join(DATA, 'report.md'), `${lines.filter((l) => l !== undefined).join('\n')}\n`);

  console.log(
    `✓ ${records.length} record(s) · ${players.size} player(s) · ${pending.length} pending · ` +
      `${residueRows.length} residue line(s) · ${dupGroups.length} duplicate signature(s) · ` +
      `${mirrors} mirror(s)` +
      (cursorWrite !== null ? ` · theater cursor → ${cursorWrite}` : ''),
  );
  if (due.length) {
    console.error(
      `\n⚠ ${due.length} expiry(s) due — see the ACTION REQUIRED block in data/report.md`,
    );
  }
}

// ── the index intake ────────────────────────────────────────────────────────

interface TheaterBuild {
  built: MatchVideo[];
  /** The known-anywhere map the build skipped against — video id → where. */
  known: Map<string, string>;
  knownCount: number;
  placeholder: number;
  beforeFloor: number;
  live: number;
  tooShort: number;
  excluded: number;
  dupIds: number;
  segments: number;
  wholeVideos: number;
  unresolvedChars: Map<string, number>;
}
interface TheaterMerge extends TheaterBuild {
  floorSec: number;
  mode: 'cursor' | 'full' | 'unknown';
  dumped: number;
  carried: number;
  absorbed: number;
  vanished: number;
  total: number;
}

/**
 * Exact resolution of one catalogue string through the roster's own matcher:
 * exactly ONE span, covering the WHOLE normalised string, in the namespace the
 * COLUMN declares.
 *
 * Exact rather than a scan, so "Sol Badguy Player" can never read as a fighter;
 * through the shared matcher rather than a second table, so the witness and the
 * parser cannot disagree about what a name is. The catalogue's spellings are not
 * automatically ours — it writes 'Ming-Hua', 'Master Pakku', 'Ran and Shaw',
 * "P'Li", 'Firelord Sozin' where the brief wrote the short forms — and an
 * unresolved string is COUNTED, never minted.
 */
function exactAlias(
  matcher: AliasMatcher,
  text: string,
  ns: 'fighter' | 'support',
): { id?: string; overlap: boolean } {
  const t = normalizeText(text);
  if (t === '') return { overlap: false };
  const spans = matcher.find(t);
  if (spans.length !== 1) return { overlap: false };
  const s = spans[0]!;
  if (s.start !== 0 || s.end !== t.length) return { overlap: false };
  const id = ns === 'fighter' ? s.fighter : s.support;
  return { ...(id ? { id } : {}), overlap: !!s.fighter && !!s.support };
}

export function buildTheaterRecords(
  dump: TheaterRawRecord[],
  ctx: {
    records: MatchVideo[];
    committed: MatchVideo[];
    overrides: Record<string, VideoOverride>;
    rawSeen: Map<string, string>;
    matcher: AliasMatcher;
    supportIndex: SupportIndex;
    index: NonNullable<import('../types/index').ChannelConfig['index']>;
    floor: string;
    floorSec: number;
    windows: ReturnType<typeof patchWindows>;
  },
): TheaterBuild {
  // IGNORE-IF-KNOWN, AND IT RUNS FIRST (checklist 12c). If this repo has already
  // ruled on a video IN ANY CAPACITY, the catalogue entry is ignored — not
  // merged, not preferred, ignored. FOUR ARMS: every id any title dump held
  // (pre-gate, so an upload the marker refused stays refused), every record this
  // run built, every committed record from ANOTHER intake, and every override.
  // It keys on the VIDEO id, not the record id, and it is doing the heavy lifting
  // here rather than catching an edge case: 158 of the catalogue's 244 rows are
  // segments inside VODs whose uploaders are tracked channels.
  //
  // THE INDEX INTAKE'S OWN COMMITTED RECORDS ARE EXCLUDED, and that is not an
  // optimisation: a whole-video row's record id IS the video id, so on run two
  // every one of them would match ITSELF, every candidate would skip as "already
  // known", the run would build ZERO and the add-only pin would throw. An intake
  // that works perfectly on its first run and cannot run twice.
  const known = new Map<string, string>();
  const note = (id: string, where: string) => {
    if (!known.has(id)) known.set(id, where);
  };
  for (const [id, where] of ctx.rawSeen) note(id, where);
  for (const v of ctx.records) note(v.videoId ?? v.id, `this run (${v.intake})`);
  for (const v of ctx.committed) {
    if (v.intake === 'replayTheater') continue;
    note(v.videoId ?? v.id, `videos.json (${v.intake})`);
  }
  for (const [id, ov] of Object.entries(ctx.overrides)) {
    note(id, ov.exclude === true ? 'overrides.json (excluded)' : 'overrides.json');
  }

  // How many rows each video carries, over the WHOLE dump. This is what decides
  // whether an offset is a segment — see below — and it is why the id rule lives
  // here rather than in the fetcher: it is a property of the dump, not of a row.
  const rowsPerVideo = new Map<string, number>();
  for (const r of dump) rowsPerVideo.set(r.videoId, (rowsPerVideo.get(r.videoId) ?? 0) + 1);

  const out: MatchVideo[] = [];
  const seenHere = new Set<string>();
  const unresolvedChars = new Map<string, number>();
  const counts = {
    knownCount: 0,
    placeholder: 0,
    beforeFloor: 0,
    live: 0,
    tooShort: 0,
    excluded: 0,
    dupIds: 0,
    segments: 0,
    wholeVideos: 0,
  };

  // THE PER-ENTRY GAME GATE (checklist 12a) IS THE FETCHER'S, NOT THIS
  // FUNCTION'S, and that is a consequence of the dump's shape rather than a
  // choice: `?game=` is a filter the catalogue answers and every row states its
  // own game label, but TheaterRawRecord (types/index.ts) carries no such field
  // — the row that reaches this file has already been checked against
  // ChannelIndex.gameLabel and a mistagged one never made it into the dump. The
  // count comes back through raw/.replayTheater.stats.json `wrongGame` and is
  // printed in the sweep-hygiene line above, so the gate is still visible from
  // here even though it does not run from here.
  for (const r of dump) {
    if (known.has(r.videoId)) {
      counts.knownCount++;
      continue;
    }

    // A COMPOSITE ID FOLLOWS THE ENTRY (checklist 12b), and "real offset" needs a
    // floor (12k). On a video the catalogue lists ONCE, an offset is a SEGMENT
    // only when it is at least `segmentOffsetMinShare` of the VOD: 26 of the 29
    // single-row offsets here are 5-51s intro skips on whole per-set uploads, one
    // more sits at 13.1%, and the only two real segments sit at 50% and 56%. The
    // populations do not touch. On a video the catalogue lists MORE THAN ONCE
    // every row is a segment, t=0 INCLUDED — five multi-row VODs here open at
    // zero, and publishing that row as the whole 1,722-11,139s video makes one
    // record stand for a whole tournament.
    const rows = rowsPerVideo.get(r.videoId) ?? 1;
    const start = r.startSeconds;
    const share = start !== undefined && r.durationSec > 0 ? start / r.durationSec : 0;
    const isSegment =
      start !== undefined &&
      (rows > 1 ? true : start > 0 && share >= ctx.index.segmentOffsetMinShare);
    const id = isSegment ? `${r.videoId}@${start}` : r.videoId;

    // An override keyed on the RECORD id — a segment's `vid@start` — is not in
    // `known` (that map is keyed by video id), so the exclude verdict is read
    // here as well.
    if (ctx.overrides[id]?.exclude) {
      counts.excluded++;
      continue;
    }
    if (seenHere.has(id)) {
      counts.dupIds++;
      continue;
    }
    seenHere.add(id);

    const day = r.publishedAt.slice(0, 10);
    if (day < ctx.floor) {
      counts.beforeFloor++;
      continue;
    }
    if (r.liveBroadcastContent !== 'none') {
      counts.live++;
      continue;
    }
    // The duration floor applies where a duration is KNOWN: a whole-video row
    // carries the VOD's own, a segment carries the VOD's too but stands for a
    // MATCH inside it, so no floor is asked of a segment.
    if (!isSegment && r.durationSec > 0 && r.durationSec < ctx.floorSec) {
      counts.tooShort++;
      continue;
    }

    // PLACEHOLDER HANDLES NEVER MINT A PLAYER — but `♱` is a REAL one, and the
    // shared all-punctuation predicate would delete it (parse.ts
    // isPlaceholderHandle, checklist 12k).
    const handles = r.players.map((p) => normalizeText(stripTheaterSponsor(p)));
    if (handles.some((h) => !h || isPlaceholderHandle(h))) {
      counts.placeholder++;
      continue;
    }

    // THE SUPPORT COLUMN IS A ROLE, NOT A COUNTER-PICK (checklist 13). char2 is
    // filled on 244 of 244 rows and char3/char4 are null on every one; the
    // reference's reader folds all four into the side as fighters, which on this
    // catalogue prints a 100% counter-pick rate and drowns the residue in support
    // names. Each column resolves in the namespace the COLUMN declares.
    //
    // AN OVERLAP HERE IS RECORDED AND NOT WITHHELD, and the asymmetry with the
    // title arm is deliberate: a typed COLUMN is a statement about this row,
    // where a title slot is only the channel's habit. Row 482155 reads
    // p2_char "Avatar Aang" / p2_char2 "Katara" and the uploader's own title
    // agrees.
    const sides = ([0, 1] as const).map<MatchSide | null>((i) => {
      const fighter = exactAlias(ctx.matcher, r.characters[i] ?? '', 'fighter');
      if (!fighter.id && (r.characters[i] ?? '').trim()) {
        const k = r.characters[i]!;
        unresolvedChars.set(k, (unresolvedChars.get(k) ?? 0) + 1);
      }
      const support = exactAlias(ctx.matcher, r.supports[i] ?? '', 'support');
      if (!support.id && (r.supports[i] ?? '').trim()) {
        const k = r.supports[i]!;
        unresolvedChars.set(k, (unresolvedChars.get(k) ?? 0) + 1);
      }
      const handle = handles[i] ?? '';
      const player = playerId(handle);
      if (!player || !fighter.id) return null;
      // The partition invariant, on the source that measured it: a support whose
      // owner is not this side's fighter is a row to look at, not a pick to file.
      const owner = support.id ? ctx.supportIndex.ownerOf(support.id) : undefined;
      const keepSupport = support.id && owner === fighter.id ? support.id : null;
      return {
        player,
        handle,
        characters: [fighter.id],
        support: keepSupport,
        provenance: {
          tier: 'index',
          tiers: ['index'],
          fromTitle: [],
          fromIndex: [fighter.id],
          ...(keepSupport ? { supportTier: 'index' as const } : {}),
          ...(support.overlap ? { namespaceOverlap: true } : {}),
          complete: true,
        },
      };
    });
    const [s0, s1] = sides;
    if (!s0 || !s1) continue;

    if (isSegment) counts.segments++;
    else counts.wholeVideos++;

    const era = seasonToken(seasonForDate(day));
    const patch = patchForDate(day, ctx.windows).version;
    // THE TAG COLUMN IS MIXED, and half of what is in it is not an event
    // (checklist 12k): 170 rows carry an event name and 40 carry a set FORMAT
    // (FT5..FT30). Emitting any non-empty tag as `event` would print 40 chips
    // reading "FT10" — a tournament that does not exist — on the one field the
    // engine shows INSTEAD of the source name. A format tag falls through to
    // `channelName`, the VOD's own uploader, which is the only other fact that
    // can say where a row came from. BOTH go through normalizeText, like the
    // title, or one event gets two spellings depending on which run ingested it.
    const tag = normalizeText(r.tag ?? '').trim();
    const uploader = normalizeText(r.uploader ?? '').trim();
    const event = tag && !ctx.index.formatTagPattern.test(tag) ? tag : '';

    out.push({
      id,
      channel: 'replayTheater',
      intake: 'replayTheater',
      title: normalizeText(r.title),
      date: day,
      publishedAt: r.publishedAt,
      durationSec: r.durationSec,
      ...(r.viewCount ? { viewCount: r.viewCount } : {}),
      era,
      patch,
      // GUARDED TOGETHER (checklist 12b): guarding on `startSeconds` alone strips
      // `videoId` from every offset-zero record, and a t=0 row inside a multi-row
      // video is a segment.
      ...(isSegment ? { videoId: r.videoId, startSeconds: start } : {}),
      ...(event ? { event } : uploader ? { channelName: uploader } : {}),
      sides: [s0, s1],
      ...(s0.support || s1.support
        ? { supports: [s0.support ?? null, s1.support ?? null] as [string | null, string | null] }
        : {}),
    });
  }
  return { built: out, known, unresolvedChars, ...counts };
}
