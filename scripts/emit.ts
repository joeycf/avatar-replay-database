/**
 * Emit the engine-facing artifacts from the parse substrate.
 *
 * data/videos.json (rich, pipeline-shaped) → data/replays.json + data/players.json
 * + data/stats.json + data/summary.json + data/patchGroups.json (narrow,
 * engine-shaped), plus the public/data/ copies of the two files the client
 * fetches. This is the two-schema boundary the platform runs on, and every
 * contract assertion below is a THROW: a silent schema drift here is invisible
 * until a panel renders wrong.
 *
 * ── THE STAT UNIT IS SIDE APPEARANCES (checklist step 8) ──────────────────
 * Avatar is 1v1, so a side fields one fighter and a mirror adds TWO to that
 * fighter's total. `characterUsage`, `byPatchUsage` and `playerCharacters` share
 * that one denominator, which is what keeps the usage bars, the meta timeline
 * and the player tables from disagreeing with no visible symptom. The
 * alternative — a per-record deduped union — is the right unit for a tag game on
 * a shared roster and the wrong one here. The three sums are asserted below.
 *
 * ── AND A SUPPORT IS NOT A CHARACTER (checklist 13, written by this build) ──
 * Every side of this game picks a FIGHTER and a SUPPORT. The supports ride the
 * record as `supports` — the 2XKO `fuses` precedent (2xko/scripts/emit.ts:73-79)
 * — never inside `Side.characters`, and they are counted in their OWN table
 * (`supportUsage`), never in `characterUsage`. Three assertions below enforce
 * that, and the third one exists because the first two cannot see the failure
 * that matters: `katara` is a launch FIGHTER *and* Avatar Aang's SUPPORT, so a
 * folded index row produces `characters: ['avatar-aang', 'katara']` in which
 * both ids are real fighters, the roster check passes, and the usage sum still
 * balances. Every count reads green while the archive has minted a second
 * fighter on that side. See `assertSupportsAreNotCharacters`.
 *
 * ── summary.json CARRIES THE CODE VERSION (checklist 10i) ─────────────────
 * A pin-only change moves no record and no content hash, so a data-only smoke
 * check matches a deployment that is still building. The engine tag is read out
 * of nuxt.config.ts and written as `engine`; `verify:deployed` reads it back off
 * the deployment and compares it with the tag the repo pins. Nothing is embedded
 * that the check compares against itself (10e): the deployed value comes from
 * the deployment, the expected value from this repo's nuxt.config.ts.
 *
 * ── WHAT THIS FILE DOES NOT WRITE, AND WHY ────────────────────────────────
 *   data/videos.json, data/review-queue.json, data/source-pins.json,
 *   data/theater-cursor.json, data/report.md  — scripts/parse-finish.ts owns all
 *   five (parse-finish.ts:688-695). Emit never re-derives them; a second author
 *   for one file is how two runs flip-flop it.
 *
 *   data/patchBoundaries.json — scripts/patches.ts:701-706 says this file is
 *   emit's to write, and it is deliberately NOT written yet: check-patches.sh
 *   keys its unregistered-game warning on that file EXISTING, so the day it
 *   appears is the day this game must join that script's four lists
 *   (checklist 10g). Adding the write without the workspace registration trades
 *   a missing artifact for a sibling-wide warning. It is an open item, not an
 *   oversight.
 *
 *   OVERRIDES AND EXCLUSIONS. parse.ts:1715 drops `exclude` records and
 *   parse-finish.ts:390 applies hand-authored `sides` before videos.json is
 *   written, so the substrate this file reads is already the published set.
 *   2XKO re-applies exclusions in emit (2xko/scripts/emit.ts applyExclusions)
 *   because its parse does not; re-applying them here would be a second reader
 *   of one verdict.
 *
 * Run: npm run data:emit
 */

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PATCHES,
  SEASONS,
  buildPatchGroups,
  patchWindows,
  seasonForDate,
  seasonToken,
  validate as validatePatches,
} from './patches';
import type {
  CharacterRecord,
  MatchVideo,
  PlayerRecord,
  RecordSupports,
  SupportRecord,
} from '../types/index';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'data');
const PUBLIC_DATA = join(ROOT, 'public', 'data');
const NUXT_CONFIG = join(ROOT, 'nuxt.config.ts');

/** Mirrors app/app.config.ts, which is the authority. The shell's
 *  verify:cutover asserts these two values against its own GAMES table, so a
 *  drift fails at the apex rather than here. */
const GAME_ID = 'avatar';
const GAME_NAME = 'Avatar Legends: The Fighting Game';

/** app/app.config.ts `charactersPerSide`, restated for the pipeline track
 *  (which cannot resolve the Nuxt `@engine` alias). It is a FORMAT, not a
 *  length cap: a set whose loser counter-picked lists every fighter used, and
 *  five such titles are measured across skeet, toledoLocals,
 *  unrivaledTournaments and saltyRecoveryCenter. Nothing below rejects a longer
 *  side; the number is printed so the unit line says what the format is. */
const CHARACTERS_PER_SIDE = 1;

// ── the engine contract, restated locally ───────────────────────────────────
// The pipeline can't resolve the Nuxt `@engine` alias, so the emitted shapes are
// declared here. They must mirror replay-engine/types/replay.ts and
// replay-engine/types/stats.ts.
//
// Note what is NOT here: `handle`, `support` and `provenance`. The substrate's
// MatchSide carries all three and the emitted side carries none of them, which
// is the whole point — the rich pipeline record projects DOWN to the narrow
// public contract. toReplay() builds sides FIELD BY FIELD rather than spreading,
// so nothing can leak by construction; the assertion further down proves it
// anyway, on the serialized bytes, because "cannot happen by construction" is
// exactly what people say before it does.
interface EmittedSide {
  player: string;
  characters: string[];
}

interface EmittedReplay {
  id: string;
  sides: [EmittedSide, EmittedSide];
  date: string;
  patch?: string;
  source: string;
  title: string;
  views?: number;
  durationSec?: number;
  videoId?: string;
  startSeconds?: number;
  /** What the badge prints instead of the source's configured name (engine
   *  v0.13.0): the event first, then the uploader, then neither. */
  event?: string;
  channelName?: string;
  /** THE GAME-LOCAL EXTENSION (checklist 13). Index-aligned with `sides`. The
   *  engine has no field for this and does not need one — it ignores the key,
   *  a GameFacet filters on it and a badge override renders it. */
  supports?: RecordSupports;
}

/** replay-engine/types/stats.ts KnownStats, plus this game's `supportUsage`.
 *  Unknown keys are ignored by the engine, which is what makes a game-local
 *  table free to add. */
interface EmittedStats {
  totals: {
    replays: number;
    characters: number;
    players: number;
    byPatch: Record<string, number>;
    /** The SUPPORT registry size and how many sides named one. Separate
     *  totals, because a support is a different kind of pick. */
    supports: number;
    sidesWithSupport: number;
  };
  characterUsage: Record<string, number>;
  byPatchUsage: Record<string, Record<string, number>>;
  playerCharacters: Record<string, Record<string, number>>;
  /** supportId → side appearances. THE SAME UNIT as characterUsage and a
   *  DIFFERENT TABLE: a support has no page and no usage share on the roster,
   *  so folding it into characterUsage would halve every fighter's share. */
  supportUsage: Record<string, number>;
}

const bump = (m: Record<string, number>, k: string, n = 1): void => {
  m[k] = (m[k] ?? 0) + n;
};

/**
 * THE ENGINE PIN, READ OUT OF nuxt.config.ts (checklist 10i).
 *
 * `extends: [process.env.ENGINE_PATH || ['github:joeycf/replay-engine#vX.Y.Z',
 * …]]` — the literal is the production truth because Vercel leaves ENGINE_PATH
 * unset. Exactly one match is required: a repo that pinned two tags, or none,
 * has a build nobody can reason about, and a summary carrying the wrong one is
 * worse than a summary carrying none because verify:deployed would then compare
 * two numbers that agree and mean nothing.
 */
async function enginePin(): Promise<string> {
  const src = await readFile(NUXT_CONFIG, 'utf8');
  const hits = [...src.matchAll(/github:joeycf\/replay-engine#(v\d+\.\d+\.\d+)/g)].map(
    (m) => m[1]!,
  );
  const unique = [...new Set(hits)];
  if (unique.length !== 1) {
    throw new Error(
      `emit: nuxt.config.ts pins ${unique.length} engine tag(s) (${unique.join(', ') || 'none'}) — ` +
        `summary.json carries the deployed CODE version (checklist 10i) and verify:deployed ` +
        `compares it with this pin, so there has to be exactly one. Never track a branch.`,
    );
  }
  return unique[0]!;
}

/**
 * A SUPPORT MAY NEVER RIDE IN `Side.characters` (checklist 13).
 *
 * Three arms, weakest first, and the third is the one that earns its keep.
 *
 *  1. A support id that is NOT also a fighter id inside `characters`. 33 of the
 *     34 attested supports are in this class, and the unknown-character check
 *     further down would catch them too — this arm exists to name the failure
 *     rather than report "unknown character appa".
 *  2. `supports[i]` must be owned by a fighter on side i. The owner partition is
 *     measured (every attested support appears under exactly one fighter across
 *     all 462 index sides) and parse.ts:1889-1900 already drops a mismatch, so
 *     this is the emit-side restatement of an invariant the parser enforces.
 *  3. THE OVERLAP. `katara` is a launch fighter AND Avatar Aang's support, so
 *     `characters: ['avatar-aang', 'katara']` reads as a legal counter-pick:
 *     both ids are on the roster, the roster check passes, the side-appearance
 *     sum still balances, and the archive has silently minted a second fighter.
 *     The tell is the OWNERSHIP relation — a side listing both a fighter and
 *     that fighter's own support is a fold, not a counter-pick. It fires on the
 *     one live case (index row 482155, "Avatar State Aang - Katara") and on no
 *     legitimate data, because a player cannot counter-pick into the support
 *     slot of the character they are already playing.
 */
function assertSupportsAreNotCharacters(
  records: MatchVideo[],
  fighterIds: Set<string>,
  supports: SupportRecord[],
): void {
  const ownerOf = new Map(supports.map((s) => [s.id, s.owner]));
  const supportOnly = new Set(supports.map((s) => s.id).filter((id) => !fighterIds.has(id)));

  for (const v of records) {
    for (const [i, side] of v.sides.entries()) {
      for (const c of side.characters) {
        if (supportOnly.has(c)) {
          throw new Error(
            `emit: ${v.id} side ${i} lists "${c}" in Side.characters and "${c}" is a SUPPORT ` +
              `(data/supports.json, owner ${ownerOf.get(c)}). Supports ride the record's ` +
              `\`supports\` tuple and are counted in supportUsage; putting one in characters ` +
              `doubles the roster, halves every fighter's usage share and prerenders a page ` +
              `nobody asked for (checklist 13).`,
          );
        }
      }
      // Arm 3 — the overlap, which arms 1 and 2 are both blind to.
      for (const c of side.characters) {
        const owner = ownerOf.get(c);
        if (owner !== undefined && owner !== c && side.characters.includes(owner)) {
          throw new Error(
            `emit: ${v.id} side ${i} lists both "${owner}" and "${c}", and "${c}" is ` +
              `"${owner}"'s own SUPPORT. That is an index row folded into the side, not a ` +
              `counter-pick — a player cannot counter-pick into the support slot of the ` +
              `fighter they are already playing. Both ids are real fighters, so the roster ` +
              `check and the side-appearance sum both pass: this is the only assertion that ` +
              `sees it (checklist 13).`,
          );
        }
      }
      const support = v.supports?.[i] ?? side.support ?? null;
      if (support === null) continue;
      const owner = ownerOf.get(support);
      if (owner === undefined) {
        throw new Error(`emit: ${v.id} side ${i} carries unknown support "${support}"`);
      }
      if (!side.characters.includes(owner)) {
        throw new Error(
          `emit: ${v.id} side ${i} carries support "${support}", owned by "${owner}", on a side ` +
            `playing ${JSON.stringify(side.characters)}. The owner partition is strict and ` +
            `measured; a mismatch is a parse error (the wrong span won, or the sides split ` +
            `wrong), not a rare pick.`,
        );
      }
    }
  }
}

/**
 * The substrate record → the public contract, FIELD BY FIELD.
 *
 * `date` IS `MatchVideo.date`, NOT `publishedAt`. They are the same value on 31
 * of 32 intakes and differ by up to 23 measured days on `still`, which titles
 * every set with the day it was PLAYED and uploads it later. Keying the public
 * date on publishedAt misdates that channel's whole corpus and credits a backlog
 * flush to the weeks it was uploaded in (types/index.ts PlayedOnDateRule,
 * checklist 5s). The reference emits `v.publishedAt` here
 * (ggst/scripts/emit.ts:69) because no Strive channel states a played-on date.
 *
 * `videoId` and `startSeconds` are GUARDED TOGETHER (checklist 12b): guarding on
 * `startSeconds` alone strips `videoId` from every offset-zero record, and five
 * multi-row VODs here open at t=0 — a segment at zero is still a segment.
 *
 * AND `startSeconds: 0` IS EMITTED, which reverses this file's first answer.
 * The original guard was `v.startSeconds ? …`, on the reasoning that absent
 * already means zero to the player so the key would say nothing. It says
 * something: the five `@0` records then carried a COMPOSITE id and no offset
 * field, so the published record claimed to be a segment in its id and a whole
 * video in its fields. scripts/e2e.ts caught it as `132 composite ids vs 127
 * segments`. The id and the fields are one statement about what the record IS,
 * and a reader asking "is this a segment" must not get two answers — which is
 * checklist 12b's own failure one level up. A truthiness test on a numeric
 * field that can legitimately be 0 is the bug, not the key.
 */
const toReplay = (v: MatchVideo): EmittedReplay => {
  const supports: RecordSupports = [v.sides[0].support ?? null, v.sides[1].support ?? null];
  return {
    id: v.id,
    sides: [
      { player: v.sides[0].player, characters: v.sides[0].characters },
      { player: v.sides[1].player, characters: v.sides[1].characters },
    ],
    date: v.date,
    patch: v.patch,
    source: v.channel,
    title: v.title,
    ...(v.viewCount ? { views: v.viewCount } : {}),
    ...(v.durationSec ? { durationSec: v.durationSec } : {}),
    ...(v.videoId
      ? {
          videoId: v.videoId,
          ...(v.startSeconds !== undefined ? { startSeconds: v.startSeconds } : {}),
        }
      : {}),
    // Pass-through, not a decision. Whether a label is meaningful is a question
    // only the builder that read it can answer, and parse-finish.ts's theater
    // builder is the only one that sets either field (parse-finish.ts:1394).
    ...(v.event ? { event: v.event } : {}),
    ...(v.channelName ? { channelName: v.channelName } : {}),
    ...(supports[0] || supports[1] ? { supports } : {}),
  };
};

/**
 * data/players.json → the engine's Player, field by field.
 *
 * scripts/parse-finish.ts:689-692 WRITES this file; this is a projection of it,
 * with the same sort (by id) and the same serialization, so on any run that
 * followed a parse the write is byte-identical and the file does not churn. What
 * it buys is that the PUBLIC shape has exactly one author: a hand-edited entry
 * carrying a substrate field cannot ship, and the drop is reported rather than
 * silent.
 */
function toPlayer(p: PlayerRecord, dropped: Map<string, string[]>): PlayerRecord {
  const known = new Set(['id', 'handle', 'featured', 'extra']);
  const extra = Object.keys(p).filter((k) => !known.has(k));
  if (extra.length) dropped.set(p.id, extra);
  return {
    id: p.id,
    handle: p.handle,
    ...(p.featured ? { featured: p.featured } : {}),
    ...(p.extra ? { extra: p.extra } : {}),
  };
}

function buildStats(
  records: MatchVideo[],
  characterIds: string[],
  supportIds: string[],
  patchOrder: string[],
): EmittedStats {
  const characterUsage: Record<string, number> = {};
  const supportUsage: Record<string, number> = {};
  const playerCharacters: Record<string, Record<string, number>> = {};
  const byPatchUsage: Record<string, Record<string, number>> = {};
  const byPatch: Record<string, number> = {};

  // byPatchUsage key ORDER is the meta chart's x-axis — JSON preserves insertion
  // order and the engine reads it as the timeline. Seeded from the patch table
  // (oldest → newest) rather than from record order, so a patch with no replays
  // still holds its slot instead of the chart silently re-ordering when one
  // arrives. Four patches here, all inside one era.
  for (const p of patchOrder) {
    byPatchUsage[p] = {};
    byPatch[p] = 0;
  }

  const players = new Set<string>();
  let sidesWithSupport = 0;
  for (const r of records) {
    if (byPatch[r.patch] === undefined) {
      byPatchUsage[r.patch] = {};
      byPatch[r.patch] = 0;
    }
    byPatch[r.patch]! += 1;
    for (const s of r.sides) {
      players.add(s.player);
      for (const c of s.characters) {
        bump(characterUsage, c);
        bump((playerCharacters[s.player] ??= {}), c);
        bump(byPatchUsage[r.patch]!, c);
      }
      // A DIFFERENT TABLE AND A DIFFERENT DENOMINATOR. Supports are counted in
      // the same unit (side appearances) and never added to any of the three
      // tables above — see the header. 27 of 32 title channels state a fighter
      // and no support, so this total is a fraction of the character total by
      // construction and is not expected to match it.
      if (s.support) {
        bump(supportUsage, s.support);
        sidesWithSupport += 1;
      }
    }
  }

  // Patches with no replays are dropped from the emitted tables: an empty column
  // on the meta chart is noise, and the facet already lists every patch from
  // GameConfig.patchGroups whether or not it has data. Rebuilt rather than
  // deleted from, so INSERTION ORDER survives — `delete` leaves order intact
  // today but that is a property of the engine nobody should have to rely on.
  const used = Object.keys(byPatch).filter((p) => byPatch[p]! > 0);
  const byPatchUsed: Record<string, number> = {};
  const byPatchUsageUsed: Record<string, Record<string, number>> = {};
  for (const p of used) {
    byPatchUsed[p] = byPatch[p]!;
    byPatchUsageUsed[p] = byPatchUsage[p]!;
  }

  return {
    totals: {
      replays: records.length,
      characters: characterIds.length,
      players: players.size,
      byPatch: byPatchUsed,
      supports: supportIds.length,
      sidesWithSupport,
    },
    characterUsage,
    byPatchUsage: byPatchUsageUsed,
    playerCharacters,
    supportUsage,
  };
}

async function main(): Promise<void> {
  await mkdir(PUBLIC_DATA, { recursive: true });

  // The patch table is validated HERE as well as in typecheck, because emit is
  // the step that turns it into a facet and a per-record token. A table that is
  // wrong produces a site that renders and filters and is wrong.
  const patchErrs = validatePatches();
  if (patchErrs.length) {
    throw new Error(`emit: patches.ts is invalid:\n${patchErrs.map((e) => `    ${e}`).join('\n')}`);
  }

  const readJson = async <T>(name: string, fallback: T): Promise<T> =>
    existsSync(join(DATA, name))
      ? (JSON.parse(await readFile(join(DATA, name), 'utf8')) as T)
      : fallback;

  const characters = await readJson<CharacterRecord[]>('characters.json', []);
  const supports = await readJson<SupportRecord[]>('supports.json', []);
  const players = await readJson<PlayerRecord[]>('players.json', []);
  const records = await readJson<MatchVideo[]>('videos.json', []);
  const engine = await enginePin();

  /**
   * EMPTY-CORPUS MODE, AND IT SKIPS VISIBLY.
   *
   * A corpus-independent stage has to be able to build the whole app with no
   * replays at all — that is what a fresh clone does before the first fetch, and
   * on this game it is also the state every wave before the intake wave ships
   * in. The record-shaped assertions have nothing to assert on, so they are
   * SKIPPED AND SAID, never weakened: an assertion that quietly passes on an
   * empty array is indistinguishable from one that passes on real data. The
   * registry, support-namespace and patch assertions still run, and they are
   * the ones that can fail without a corpus.
   */
  const empty = records.length === 0;
  if (empty) {
    console.log(
      '  ⓘ empty-corpus mode: 0 records. Registry, support-namespace and patch assertions\n' +
        '    still run; every record-shaped assertion below is SKIPPED, not weakened.',
    );
  }

  // ── registry assertions — every one a throw ───────────────────────────────
  const charIds = new Set(characters.map((c) => c.id));
  if (charIds.size !== characters.length) throw new Error('emit: duplicate character id');
  if (characters.length === 0) throw new Error('emit: data/characters.json is empty');
  for (const c of characters) {
    if (!/^#[0-9A-F]{6}$/.test(c.accent)) {
      throw new Error(`emit: ${c.id} accent ${c.accent} is not a 6-digit uppercase hex`);
    }
  }

  // THE SECOND NAMESPACE, ASSERTED AS ONE (checklist 13). A support id and a
  // character id may deliberately coincide — `katara` does — so these are
  // separate id spaces and the only thing that has to be unique is each within
  // itself. `owner` is what makes the namespace assertable at all.
  const supportIds = new Set(supports.map((s) => s.id));
  if (supportIds.size !== supports.length) throw new Error('emit: duplicate support id');
  for (const s of supports) {
    if (!charIds.has(s.owner)) {
      throw new Error(`emit: support ${s.id} is owned by "${s.owner}", who is not on the roster`);
    }
  }

  const playerIds = new Set(players.map((p) => p.id));
  if (playerIds.size !== players.length) throw new Error('emit: duplicate player id');
  for (const p of players) {
    if (!p.id) throw new Error(`emit: player "${p.handle}" has an empty id`);
  }

  // ── record assertions ─────────────────────────────────────────────────────
  // THE SUPPORT ARM RUNS FIRST, and the order is load-bearing rather than
  // tidy: 33 of the 34 supports are not fighter ids, so the unknown-character
  // check below would reach them first and report "unknown character appa" —
  // true, useless, and it sends whoever reads it looking for a missing roster
  // row instead of at the namespace fold that actually happened.
  assertSupportsAreNotCharacters(records, charIds, supports);

  const knownPatches = new Set(PATCHES.map((p) => p.version));
  const knownEras = new Set(SEASONS.map((s) => seasonToken(s.season)));
  const ids = new Set<string>();
  for (const v of records) {
    if (ids.has(v.id)) throw new Error(`emit: duplicate record id ${v.id}`);
    ids.add(v.id);
    if (v.sides.length !== 2) throw new Error(`emit: ${v.id} has ${v.sides.length} sides`);
    for (const s of v.sides) {
      // ZERO characters is the only side length the contract does not admit. A
      // side LONGER than charactersPerSide is legal data — a set whose loser
      // counter-picked, measured on five titles here — and is counted, never
      // rejected.
      if (s.characters.length === 0) throw new Error(`emit: ${v.id} has a side with 0 characters`);
      for (const c of s.characters) {
        if (!charIds.has(c)) throw new Error(`emit: ${v.id} references unknown character ${c}`);
      }
      if (!playerIds.has(s.player)) {
        throw new Error(`emit: ${v.id} references unknown player ${s.player}`);
      }
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date)) {
      throw new Error(`emit: ${v.id} carries date "${v.date}", which is not an ISO day`);
    }
    // Every record must file under a patch the table accounts for. Without this,
    // a record admitted by a channel's pre-release floor with no era to land in
    // ships undated and filters to nothing.
    if (!knownPatches.has(v.patch) && !knownEras.has(v.patch)) {
      throw new Error(`emit: ${v.id} carries patch "${v.patch}", which no boundary accounts for`);
    }
    // The era and the patch are derived from the SAME date by the same table, so
    // a record where they disagree has been hand-edited or carried across a
    // table change. The grouped facet's counts depend on the pair agreeing.
    const era = seasonToken(seasonForDate(v.date));
    if (v.era !== era) {
      throw new Error(`emit: ${v.id} carries era "${v.era}" but ${v.date} resolves to "${era}"`);
    }
    // 12b, restated as an assertion rather than trusted to the projection: a
    // record whose id is not its video id MUST publish `videoId`, or every
    // YouTube URL the engine builds (embed, watch link, derived thumbnail)
    // resolves the composite id and 404s.
    if (v.videoId === undefined && v.startSeconds !== undefined) {
      throw new Error(`emit: ${v.id} carries startSeconds with no videoId (checklist 12b)`);
    }
    if (v.videoId === undefined && v.id.includes('@')) {
      throw new Error(`emit: ${v.id} looks like a segment id and publishes no videoId`);
    }
  }

  const replays = records.map(toReplay);

  // NO SUBSTRATE MAY REACH THE PUBLIC CONTRACT. Asserted on the SERIALIZED
  // output rather than on the objects, because that is what actually ships.
  // `supports` is deliberately absent from this list — it is the game-local
  // extension the record is supposed to carry (checklist 13).
  const replaysJson = JSON.stringify(replays);
  for (const leak of [
    'provenance',
    'fromTitle',
    'fromDescription',
    'fromIndex',
    'fromHuman',
    'supportTier',
    'slotOrder',
    'tieBroken',
    'namespaceOverlap',
    'conflict',
    'complete',
    'intake',
    'handle',
    'publishedAt',
    'era',
  ]) {
    if (replaysJson.includes(`"${leak}"`)) {
      throw new Error(`emit: "${leak}" leaked into replays.json — the substrate must project DOWN`);
    }
  }

  const patchOrder = patchWindows()
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((w) => w.version);
  const stats = buildStats(records, [...charIds], [...supportIds], patchOrder);

  // ── THE UNIT ASSERTION (checklist step 8) ─────────────────────────────────
  // The unit is SIDE APPEARANCES, so characterUsage must sum to the total number
  // of (side, character) pairs. That is 2 per record except where a set lists a
  // counter-pick, so it is COMPUTED from the data rather than assumed to be
  // 2×records — assuming would make the assertion fail on legitimate data and
  // teach whoever hits it to delete the check.
  const expectedUsage = records.reduce(
    (n, v) => n + v.sides[0].characters.length + v.sides[1].characters.length,
    0,
  );
  const usageTotal = Object.values(stats.characterUsage).reduce((a, b) => a + b, 0);
  if (!empty && usageTotal !== expectedUsage) {
    throw new Error(
      `emit: characterUsage sums to ${usageTotal}, expected ${expectedUsage} side appearances. ` +
        `The unit is SIDE APPEARANCES (checklist 8), declared in this file's header and in the ` +
        `app README; all three of characterUsage, byPatchUsage and playerCharacters must share ` +
        `it. If this fired because a SUPPORT was counted, the fix is upstream — supports have ` +
        `their own table (supportUsage), not a share of this one.`,
    );
  }
  // The same denominator, proven rather than asserted in prose.
  const playerTotal = Object.values(stats.playerCharacters).reduce(
    (n, m) => n + Object.values(m).reduce((a, b) => a + b, 0),
    0,
  );
  if (!empty && playerTotal !== expectedUsage) {
    throw new Error(
      `emit: playerCharacters sums to ${playerTotal} but characterUsage to ${expectedUsage} — ` +
        `two panels would disagree with no visible symptom`,
    );
  }
  const patchUsageTotal = Object.values(stats.byPatchUsage).reduce(
    (n, m) => n + Object.values(m).reduce((a, b) => a + b, 0),
    0,
  );
  if (!empty && patchUsageTotal !== expectedUsage) {
    throw new Error(
      `emit: byPatchUsage sums to ${patchUsageTotal}, expected ${expectedUsage} — same unit rule`,
    );
  }

  // THE SUPPORT TABLE'S OWN ARITHMETIC, and the assertion that it is a SECOND
  // denominator rather than a share of the first. A support that leaked into
  // characterUsage would inflate `usageTotal` past `expectedUsage` and be caught
  // above; a FIGHTER that leaked into supportUsage is caught here.
  const supportTotal = Object.values(stats.supportUsage).reduce((a, b) => a + b, 0);
  const expectedSupports = records.reduce(
    (n, v) => n + (v.sides[0].support ? 1 : 0) + (v.sides[1].support ? 1 : 0),
    0,
  );
  if (supportTotal !== expectedSupports) {
    throw new Error(
      `emit: supportUsage sums to ${supportTotal}, expected ${expectedSupports} side appearances`,
    );
  }
  for (const id of Object.keys(stats.supportUsage)) {
    if (!supportIds.has(id)) throw new Error(`emit: supportUsage names unknown support "${id}"`);
  }
  for (const id of Object.keys(stats.characterUsage)) {
    if (supportIds.has(id) && !charIds.has(id)) {
      throw new Error(`emit: characterUsage names "${id}", which is a support and not a fighter`);
    }
  }

  // ── patchGroups ───────────────────────────────────────────────────────────
  // Written with the EXACT serialization scripts/patches.ts:712 uses, from the
  // EXACT same buildPatchGroups() call, so the file cannot differ depending on
  // which of the two produced it. patches.ts --emit exists for the fresh-clone
  // path (app/app.config.ts imports this file, so `npm run typecheck` needs it
  // before any corpus exists); emit writes it on every data run.
  const groups = buildPatchGroups();
  const seenGroupIds = new Set<string>();
  for (const g of groups) {
    if (seenGroupIds.has(g.id)) throw new Error(`emit: duplicate patchGroups id ${g.id}`);
    seenGroupIds.add(g.id);
    for (const c of g.children ?? []) {
      if (seenGroupIds.has(c.id)) throw new Error(`emit: duplicate patchGroups id ${c.id}`);
      seenGroupIds.add(c.id);
    }
  }

  // ── players, projected ────────────────────────────────────────────────────
  const dropped = new Map<string, string[]>();
  const emittedPlayers = players
    .map((p) => toPlayer(p, dropped))
    .sort((a, b) => a.id.localeCompare(b.id));
  if (dropped.size) {
    console.log(
      `  ⚠ dropped non-contract key(s) from ${dropped.size} player row(s): ` +
        [...dropped].map(([id, keys]) => `${id} (${keys.join(', ')})`).join(', '),
    );
  }

  // ── write ─────────────────────────────────────────────────────────────────
  // `updated` IS CONTENT-DERIVED — the newest record's own DATE, never the build
  // time. That is a platform requirement rather than a nicety: the cron only
  // commits when a staged file actually changed, so a build-time stamp would
  // make this file differ on EVERY run and put a deploy on the calendar every
  // day forever, whether or not a single new match arrived. Empty corpus falls
  // back to the newest patch, which is still content and still stable.
  const newestDay =
    records.reduce((newest, v) => (v.date > newest ? v.date : newest), '') || PATCHES.at(-1)!.start;

  const summary = {
    // THE KEY IS `game`, NOT `id`. Every live game emits {"game": "<id>", …} and
    // the shell's apex cutover battery asserts `payload.game === <the game's
    // id>`; checklist 10h adds the pre-flip read of
    // <game-host>/<slug>/data/summary.json for exactly this, because
    // verify:deployed reads replays.json and never looks at this file.
    game: GAME_ID,
    name: GAME_NAME,
    replays: records.length,
    players: emittedPlayers.length,
    characters: characters.length,
    updated: newestDay,
    // CHECKLIST 10i, THIS BUILD'S AMENDMENT. The deployed code version, so a
    // pin-only change — which moves no record and no content hash — is still
    // visible to the smoke check. verify:deployed reads this field off the
    // deployment and compares it with the pin in THIS repo's nuxt.config.ts.
    engine,
  };
  if (!/^v\d+\.\d+\.\d+$/.test(summary.engine)) {
    throw new Error(`emit: summary.engine "${summary.engine}" is not a vX.Y.Z tag`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(summary.updated)) {
    throw new Error(`emit: summary.updated is not a record date ("${summary.updated}")`);
  }
  if (summary.characters < 1) throw new Error('emit: summary has an empty roster');
  if (summary.replays !== replays.length) {
    throw new Error(`emit: summary.replays ${summary.replays} !== ${replays.length} emitted`);
  }

  const summaryJson = `${JSON.stringify(summary, null, 2)}\n`;
  await writeFile(join(DATA, 'replays.json'), replaysJson, 'utf8');
  await writeFile(join(PUBLIC_DATA, 'replays.json'), replaysJson, 'utf8');
  await writeFile(join(DATA, 'summary.json'), summaryJson, 'utf8');
  await writeFile(join(PUBLIC_DATA, 'summary.json'), summaryJson, 'utf8');
  await writeFile(join(DATA, 'stats.json'), `${JSON.stringify(stats, null, 2)}\n`, 'utf8');
  await writeFile(join(DATA, 'patchGroups.json'), `${JSON.stringify(groups, null, 2)}\n`, 'utf8');
  await writeFile(
    join(DATA, 'players.json'),
    `${JSON.stringify(emittedPlayers, null, 2)}\n`,
    'utf8',
  );

  const usedPatches = Object.keys(stats.totals.byPatch).length;
  console.log(
    `✓ emit — ${replays.length} replays · ${characters.length} fighters · ` +
      `${emittedPlayers.length} players · ${supports.length} supports\n` +
      `  ${usageTotal} side appearances (unit: SIDE APPEARANCES, charactersPerSide ` +
      `${CHARACTERS_PER_SIDE}); ${supportTotal} support appearance(s) counted separately\n` +
      `  ${groups.length} era(s), ${PATCHES.length} patch(es), ${usedPatches} with replays; ` +
      `engine ${engine}, updated ${newestDay}`,
  );
}

main().catch((e: unknown) => {
  console.error(`\n✖ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
