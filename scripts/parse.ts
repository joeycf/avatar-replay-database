/**
 * Stage 2, front half: turn raw/*.json into the committed substrate
 * data/videos.json, plus data/players.json, data/review-queue.json and
 * data/report.md. The back half — index merge, dedupe, collapse guard, freeze
 * carry, registry invariant, report — is scripts/parse-finish.ts. There is one
 * parse and it is these two files; the split is for legibility only.
 *
 * Run: npm run data:parse
 *
 * Flags:
 *   --seed-freeze-pins   Parse a frozen channel's dump (present only after
 *                        `data:fetch --include-frozen`), print the count to set
 *                        as `frozen.records` in scripts/channels.ts, and REFUSE
 *                        to write anything.
 *   --allow-collapse     Accept a collapse the guard would refuse (parse-finish).
 *
 * ── ONE PARSER, FIVE GRAMMARS, TWO NAMESPACES ───────────────────────────────
 * The parser never CHOOSES a slot order. It asks which span of a segment
 * resolves against which VOCABULARY and takes the remainder as the handle, so
 * "ArinKarin (Ozai)", "Katara / Kanna ( Karma )", "Rood Katara", "Natsu (Zuko
 * [Mai])" and "Toph vs Azula (Plisno vs T0ni)" all read from one code path. The
 * channel's declared `slotOrder` is consulted in exactly two places — the
 * both-resolve tie and the which-reading-first ordering — and both say so.
 *
 * FOUR THINGS HERE HAVE NO COUNTERPART IN THE REFERENCE PARSER, and each one is
 * a measured defect in the port rather than a refinement:
 *
 *   1. THE PAIR-LEVEL BRANCH (checklist 5q). `CharA vs CharB (HandleA vs
 *      HandleB)` carries TWO `vs` tokens, so the reference's global split
 *      returns three parts and refuses `vs-count` — all 57 of the corpus's
 *      largest channel (scripts/channels.ts, aegisEsports: parts === 2 on ZERO
 *      of its 63 marked titles). The branch is MARKER-KEYED, not channel-keyed:
 *      it decides which of the two pairs holds the fighters BY ROSTER
 *      RESOLUTION, because aegisEsports's other game writes the mirror shape
 *      ("Aubrey vs Raeze UNI 2 REPLAY! (Kaguya vs Akatsuki)") and a
 *      channel-scoped reading would file one of the two games backwards on
 *      every record. The same branch reads avianZebra's combined bracket
 *      ("Playtester MrFuk vs AvianZebra (Aang/Momo vs Aang/Gyatso)") the other
 *      way round, from the same evidence.
 *   2. THE TYPED SUPPORT MATCHER (checklist 13). Every side picks a FIGHTER and
 *      a SUPPORT; the two vocabularies OVERLAP ('Katara' is a launch fighter AND
 *      Avatar Aang's support) and the corpus writes them in each other's slots.
 *      A bracket group is SPLIT into parts before anything is resolved, each
 *      part is resolved in its own namespace, and a support can never reach
 *      `Side.characters` — asserted, not hoped for.
 *   3. THE CPU/ARCADE REFUSAL (checklist 5r). "Avatar Legends: The Fighting
 *      Game - Katara vs. Zaheer" passes marker + two fighters + vs and is not a
 *      match. The separating signal is HANDLE RECOVERABILITY: a matchup title is
 *      exhausted by its fighter spans plus mode words, so the residue on each
 *      side is empty, while a real title contains a PERSON that nothing else
 *      explains. Measured on WickDaLine: 32 of 32 sides empty, 16 fabricated
 *      records refused.
 *   4. PLAYED-ON DATES (checklist 5s). One channel titles every set with the day
 *      it was PLAYED and uploads it up to 23 days later. `MatchVideo.date` is
 *      that day where a channel declares the rule; `publishedAt` is kept beside
 *      it so the lag is reported rather than hidden.
 *
 * ── THE ORDER OF THE GATES, AND WHY ─────────────────────────────────────────
 *   · game marker, hashtag-stripped, TITLE first        (checklist 3/3b — channels.ts)
 *   · played-on date, read BEFORE the strips remove it  (checklist 5s)
 *   · date floor, on the RECORD's date                  (LAUNCH; no channel opts out)
 *   · live flag, never liveStreamingDetails             (types/index.ts RawVideoRecord)
 *   · duration floor AND CEILING, per channel           (checklist 5t)
 *   · title parse → residue → review queue, never a guess
 *   · stale-raw, DATA-ONLY                              (checklist 10c, below)
 *   · registry invariant, collapse, freeze              (parse-finish.ts)
 */

import { mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CHANNELS,
  hasAvatarMarker,
  hasMarkerForChannel,
  stripHashtagRun,
  stripTheaterSponsor,
} from './channels';
import { LAUNCH, patchForDate, patchWindows, seasonForDate, seasonToken } from './patches';
import {
  aliasKey,
  buildAliasMatcher,
  buildSupportIndex,
  loadCharacters,
  loadSupports,
  normalizeText,
  playerId,
} from './roster';
// The back half of the same pipeline. Split from this file for legibility only.
import { writeReportAndData } from './parse-finish';
import type { ChannelTally, DurationHistogram } from './parse-finish';
import type {
  AliasMatcher,
  FighterAliasSource,
  NamespaceOverlap,
  SupportAliasSource,
} from './roster';
import type {
  CharacterRecord,
  ChannelConfig,
  ChannelKey,
  CharProvenance,
  MatchSide,
  MatchVideo,
  RawVideoRecord,
  ReviewQueueItem,
  SlotOrder,
  SourcePins,
  SupportRecord,
  VideoOverride,
} from '../types/index';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = join(ROOT, 'raw');
const DATA = join(ROOT, 'data');

const SEED_FREEZE_PINS = process.argv.includes('--seed-freeze-pins');

/**
 * A whole-video record has to be long enough to BE a set. 120 seconds.
 *
 * THE PLATFORM DEFAULT, AND ON THIS CORPUS IT IS INERT — which is a measurement,
 * not an oversight (types/index.ts minDurationSec). The shortest marked upload
 * on any intake channel is 145s; every channel's parse at floor 0 equals its
 * parse at floor 120 with one exception (normalMs, two pre-launch BETA clips of
 * 94s and 96s that the LAUNCH floor removes anyway). It still runs, because
 * several of these uploaders already post 15-30s Shorts of other games and the
 * floor is the guard that is already in place when one of them starts doing it
 * here. report.md prints the per-channel duration histogram so the number stays
 * re-derivable from the corpus rather than from this comment.
 */
export const MIN_MATCH_SEC = 120;

/**
 * A handle is at most MAX_HANDLE_WORDS words.
 *
 * FIVE, INHERITED FROM THE REFERENCE AND RE-CHECKED AGAINST THIS CORPUS RATHER
 * THAN COPIED. The longest real handles measured across the 32 intakes are
 * "Data Xigbar In Real Life" (5 words, toledoLocals), "OneDrive Isnt Signed In"
 * (4, kmlTournaments), "The Painted Lady" and "1999 Honda Civic" (3). The cap is
 * also load-bearing as a failure-SAFE: unrivaledTournaments without its strips
 * hands the picker "Akuadynasty - FGC Meetups 129 GRAND FINALS - Avatar Legends"
 * (six words) and loses 15 records rather than minting 15 wrong ones. It does
 * NOT save every case — redVsFantasy's "Kyoshi Player nobody knows... Click" is
 * exactly five — which is why the decoration vocabulary below carries the weight
 * and report.md prints the word-count distribution every run.
 */
const MAX_HANDLE_WORDS = 5;

// ── decoration ──────────────────────────────────────────────────────────────
//
// The reference ships two GLOBAL decoration arrays because eight channels share
// four vocabularies. Here 32 channels share almost none, so channels.ts carries
// a `strip` block per channel (types/index.ts DecorationStrips) and this file
// carries only what is true of the GAME rather than of an uploader:
//
//   · the MARKER PHRASE. Every admitted title contains it by construction (the
//     gate ran first), it is never part of a handle or a character name, and 21
//     of the 32 channels put it at one end of the title or the other. Stripping
//     it globally is what makes cow, arinKarin, redblade, xcaliburBladez and
//     mysteryRacer21 parse with no per-channel prefix at all — measured on cow,
//     whose committed entry declares no strips: without it the outside of side 2
//     is "Rystek | High Level FT5 | Avatar Legends" and the picker mints the
//     player "High Level FT5 Avatar Legends".
//   · SET-FORMAT tokens (FT5..FT30, "First to 10", "FT10...ish", "BO5"). Eleven
//     channels write one and the catalogue's own `tag` column carries forty
//     (types/index.ts ChannelIndex.formatTagPattern). A format is never an event
//     and never a handle.
//   · the TAIL AFTER THE LAST BRACKET on a two-bracket title — see tailAfterLastGroup().
//
// Everything is applied through strip(), which REFUSES an edit that empties the
// string or removes the last `vs`: a decoration strip that takes the matchup
// with it is a bug by definition, and a silent one.

/** The marker phrase, in the spellings channels.ts measured, as a fragment
 *  reusable at either end. `Leg[a-z]{0,3}nds?` is channels.ts AVATAR_MARKER's
 *  stem; the trailing guard is what refuses drew Shoto's "AVATAR LEGENDSS". */
const MARKER_SRC = String.raw`(?:#\s*)?Avatar\s*[:\-–—|]?\s*Leg[a-z]{0,3}nds?(?![A-Za-z])(?:\s*:?\s*The\s*Fighting\s*Game)?`;

/** Punctuation that can sit between the marker and the matchup. `_` is
 *  normalMs's separator ("The Fighting Game_ NORMAL-MS"), `.` is aegisEsports's
 *  ("Full Tournament VOD. Avatar Legends The Fighting Game."). */
const JOIN = String.raw`[-–—:|｜_.\s]`;

const GLOBAL_PREFIX: RegExp[] = [
  // "Avatar Legends - ", "[Avatar Legends] ", "AVATAR LEGENDS || ",
  // "Avatar Legends: The Fighting Game_BETA ", "Avatar Legends | ",
  // "#AvatarLegends " (superSalemFighters, after the hashtag pass below).
  new RegExp(String.raw`^\s*\[?\s*${MARKER_SRC}\s*\]?${JOIN}*(?:BETA\b${JOIN}*)?`, 'iu'),
  // A leading run of separators, which is what a CHANNEL prefix leaves behind
  // when it stops one character short: normalMs's declared strip ends at
  // "(?:BETA\s*)?" and hands the parser "_ NORMAL-MS (SOKKA) vs …", where the
  // underscore becomes the first character of the handle. A handle never opens
  // with a separator run, so this is safe wherever it fires.
  /^[-–—:|｜_.,!]+\s*/u,
];

const GLOBAL_SUFFIX: RegExp[] = [
  // The marker and everything after it, as long as no bracket group follows —
  // "… | High Level FT5 | Avatar Legends" (cow), "… Avatar Legends The Fighting
  // Game Tournament Replay." (aegisEsports), "… | AVATAR LEGENDS : ParagOnline
  // LADDER MATCH" (still), "… - Avatar Legends" (unrivaledTournaments).
  //
  // THE BRACKET EXCLUSION IS WHAT KEEPS IT AT THE TAIL. A marker that opens the
  // title cannot match here, because the matchup's own parens sit between it and
  // the end. On a BRACKET-LESS title the leftmost match would swallow the
  // matchup — and strip() refuses that edit for dropping the last `vs`, so the
  // prefix pattern above is what handles those.
  new RegExp(String.raw`\s*[-–—|｜:.,!_]*\s*${MARKER_SRC}[^()[\]（）]*$`, 'iu'),
  // Set-format and house-format tails. Every spelling is measured: FT3..FT30
  // (eleven channels), "FT10+1" (avianZebra), "FT10...ish" (schoolBus),
  // "First to 10" (mikeyChiFgc, redVsFantasy), "BO5" (phoenixWrong), "Full Set"
  // (cow), "Long Set" (natsuXenoblade), "Full Run" (skeet), "Round Robin"
  // (saltyRecoveryCenter), "HIGH LEVEL PLAY" (schoolBus), "HIGH LEVEL MATCHES"
  // (takeANappa).
  /\s*[-–—|｜:.,!]*\s*(?:High\s*Level\s*)?(?:FT\s*\d+(?:\s*\+\s*\d+)?(?:\s*\.{0,3}\s*ish)?|First\s*To\s*\d+|BO\s*\d+|Full\s*Set|Long\s*Set|Full\s*Run|Round\s*Robin|High\s*Level(?:\s*(?:Matches?|Play|Gameplay|Set))?)\s*[|｜]?\s*$/iu,
  // A trailing run of separators or decoration glyphs, left behind by the two
  // above. U+FE0F is the emoji variation selector that rides on "▶️"; without it
  // the selector survives and lands in a handle as an invisible last character.
  // WRITTEN THROUGH String.raw AND THE CONSTRUCTOR, NOT AS A LITERAL. Prettier
  // rewrites `\uFE0F` inside a regex literal into the codepoint itself, which
  // puts an INVISIBLE character in the source — the exact failure roster.ts's
  // SPACE_LIKE comment refuses — and ESLint then flags the class as misleading.
  new RegExp(String.raw`\s*(?:[-–—|｜:.,!_]|\uFE0F)+\s*$`, 'u'),
];

/**
 * A hashtag ANYWHERE, once the marker gate has had its look at the raw title.
 *
 * The gate runs first for a reason that is this game's alone (checklist 3b):
 * superSalemFighters writes '#AvatarLegends' MID-TITLE and nothing else, so it
 * is the only marker four records have. channels.ts's stripHashtagRun removes
 * the trailing run only — which is what keeps that marker readable while still
 * refusing redVsFantasy's two Shorts whose only marker is a trailing
 * '#avatarlegendsthefightinggame'. After the gate, a tag never names a player.
 * `#1` / `# 1` starts with a digit and is left alone.
 */
const HASHTAG_TOKEN = /(?<![\p{L}\p{N}])#[\p{L}][\p{L}\p{N}_.]*/gu;

/**
 * A per-character LEADERBOARD POSITION in front of a name (checklist 8c).
 *
 * STRIPPED, NEVER TURNED INTO A RANK. Kept deliberately SHORTER than the
 * reference's, and the two omissions are measured rather than tidied:
 *   · no bare `TOP`. This corpus writes "TOP TIER" only inside redVsFantasy's
 *     clickbait, which that channel's own prefix strip removes, and a bare strip
 *     would eat the first word of any handle beginning "Top…".
 *   · no `Day\s*\d+`. The reference strips it as a rank; on this game
 *     natsuXenoblade's "[VOD] Avatar Legends Day 1!!!!!!!!" and drew Shoto's
 *     "AVATAR LEGENDS DAY 4!!!" are DATE tokens on non-match uploads, and
 *     "Day 1 Bread & Butter Combos" is a combo video. Nothing is gained by
 *     stripping it and a real rank spelling would be invisible behind it.
 * The residue table in report.md is the coverage test: a rank-shaped token no
 * strip caught shows up there as a counted line.
 */
const RANK_PREFIX =
  /^\s*(?:#\s*\d+\s*(?:st|nd|rd|th)?\s*(?:Ranked?(?![\p{L}\p{N}]))?|TOP\s*Ranked?(?![\p{L}\p{N}])|Rank(?:ed)?\s*(?:#?\s*\d+\s*(?:st|nd|rd|th)?|TOP)(?![\p{L}\p{N}])|HIGH\s*RANK(?:ED)?(?![\p{L}\p{N}]))\s*/iu;

/**
 * The `vs` separator, in every spelling this corpus uses.
 *
 * `v\.?s\.?` is the addition and it is not cosmetic: STiLL writes "V.S" and
 * "V.S." on 44 of 44 titles and saxxiefone writes "v.s." on both of its, and the
 * reference's `vs\.?` matches none of them — a verbatim port reads `no-vs` on 46
 * titles across the two channels. A closing bracket is a valid left boundary and
 * a `\svs\s` split would miss it.
 */
const VS = /(?<![\p{L}\p{N}])(?:v\.?s\.?|versus|×)(?![\p{L}\p{N}])/giu;

/**
 * Bracket groups, matched BY TYPE and with ONE level of nesting.
 *
 *   round      ( … )   28 channels. May nest a ROUND group ("MrWigyea
 *                      (Playtester) (Aang/Momo)" is two siblings, but
 *                      "(Tsuku (PS5))" nests) and — the case that matters —
 *                      a SQUARE group: natsuXenoblade writes
 *                      "Natsu (Zuko [Mai])", where the square bracket is a
 *                      typed SUPPORT sub-slot.
 *   fullwidth  （ … ）  belt-and-braces: normalizeText folds U+FF08/09 to ASCII
 *                      before this runs, so the branch is what keeps the parser
 *                      correct if that fold is ever narrowed.
 *   square     [ … ]   STiLL's archive shape ("STiLL [Katara] (5th at CEO
 *                      2026)") and natsuXenoblade's support slot standing alone.
 *
 * THE REFERENCE'S PATTERN BREAKS HERE AND IT WAS VERIFIED IN SESSION
 * (channels.ts, natsuXenoblade): its round alternative's `[^()]` class eats
 * square brackets, so "(Zuko [Mai])" is handed to the matcher as one string. On
 * a fighters-only roster that is harmless; with both namespaces in one table it
 * returns two ids and files the side as a two-fighter counter-pick. The class
 * below excludes `[` and `]` and takes the square group as its own alternative,
 * which is what lets readGroup() type it as the support slot.
 */
const GROUP = /\((?:[^()[\]]|\[[^[\]]*\]|\([^()]*\))*\)|（[^（）]*）|\[(?:[^[\]]|\([^()]*\))*\]/gu;

const countVs = (s: string): number => {
  VS.lastIndex = 0;
  return (s.match(VS) ?? []).length;
};

/** Apply one decoration pattern, REFUSING the edit if it empties the string or
 *  drops the last `vs`. Repeated until stable: a title can end in a glyph AND a
 *  house phrase AND the marker. */
const strip = (s: string, re: RegExp): string => {
  let out = s;
  for (let i = 0; i < 4; i++) {
    const next = out.replace(re, '').trim();
    if (!next || next === out) break;
    if (countVs(out) > 0 && countVs(next) === 0) break;
    out = next;
  }
  return out;
};

const applyStrips = (s: string, patterns: readonly RegExp[]): string =>
  patterns.reduce((acc, re) => strip(acc, re), s);

/**
 * Everything after the LAST bracket group, on a title that has at least TWO.
 *
 * This is the one global strip that is structural rather than lexical, and it is
 * what makes the 32 per-channel suffix blocks a backstop rather than the primary
 * mechanism. On every bracketed grammar in this corpus the shape is
 * `… (slot) <vs> … (slot) TAIL`, and the tail is always decoration: the bracket
 * round and event ("- FGC Meetups 129 GRAND FINALS - Avatar Legends"), the
 * played-on date ("8/09/2026"), the set format ("FT10"), the marker, the house
 * phrase ("HIGH LEVEL PLAY"), the event brand ("- Versus Experience: TE -
 * Winners Finals"), the channel's own series ("- The Toledo Local #102"), the
 * acronym marker ("ALTFG"), "Battle of Firebending", ": Set 1".
 *
 * THE VERSUS FESTIVAL IS WHY IT IS A STRIP AND NOT A HANDLE-PICKER RULE: that
 * channel's event brand is literally "Versus Experience", which the `vs` pattern
 * splits on, so six of its eight titles read `vs-count` unless the tail is gone
 * BEFORE the split. Requiring two groups is what keeps it off the pair-level
 * grammar, whose single bracket holds both handles.
 *
 * Refused, like every other strip, when it would drop the last `vs` — which is
 * what protects "Korra (SchoolBus) vs Azula-Lord", where the second side has no
 * bracket of its own.
 */
function tailAfterLastGroup(s: string): string {
  GROUP.lastIndex = 0;
  const groups = [...s.matchAll(GROUP)];
  if (groups.length < 2) return s;
  const last = groups[groups.length - 1]!;
  const end = last.index + last[0].length;
  const tail = s.slice(end);
  if (!tail.trim()) return s;
  if (/[()[\]（）]/u.test(tail)) return s;
  const next = s.slice(0, end).trim();
  if (!next || (countVs(s) > 0 && countVs(next) === 0)) return s;
  return next;
}

/** Rank prefixes, stripped repeatedly. */
const stripRank = (s: string): string => {
  let out = s.trim();
  for (let i = 0; i < 3; i++) {
    const next = out.replace(RANK_PREFIX, '').trim();
    if (next === out) break;
    out = next;
  }
  return out;
};

/**
 * Words that are decoration wherever they appear. Used for two different jobs
 * that must not be conflated:
 *   · DECOR_WORDS decides "is this candidate ENTIRELY decoration", which is what
 *     refuses "(OLD)", "High Level FT20 Avatar Legends" and "Round Robin" as
 *     handles. Bare numbers belong here.
 *   · TRIM_EDGE removes decoration from the EDGES of an otherwise real
 *     candidate — "BASUAL SETS STiLL" → "STiLL", "High level set XCali" →
 *     "XCali". Bare numbers deliberately do NOT belong here: cow's handle
 *     "1999 Honda Civic" would lose its first word.
 * Every token in TRIM_EDGE is a house phrase read verbatim off a marked title
 * during Stage 0; nothing is there on a hunch.
 */
const DECOR_WORDS =
  /^(?:avatar|legends?|fighting|game|games|gameplay|high|mid|low|level|mega|basual|casual|netplay|ladder|online|offline|tournament|tourney|vod|vods|match|matches|replay|replays|play|set|sets|full|run|long|beta|robin|round|rounds|highlight|highlights|ranked|ranking|rank|playtester|arcade|cpu|mirror|combo|combos|guide|guides|lab|training|season|patch|update|ver|version|new|best|top|tier|pro|player|players|support|supports|winners|losers|grand|final|finals|semi|semis|quarter|quarters|qtrs|pools|bracket|day|part|stream|live|clip|clips|short|shorts|hd|4k|1080p|60fps|ps\d|pc|steam|switch|xbox|vs|and|the|of|a|an|ft\d+|bo\d+|r\d+|no\d*|\d{1,4}|\d+(?:st|nd|rd|th))$/i;

const TRIM_EDGE =
  /^(?:ft\s*\d+|bo\s*\d+|first\s*to\s*\d+|avatar|legends?|fighting|game|gameplay|high|level|mega|basual|casual|netplay|ladder|online|offline|tournament|tourney|vod|vods|matches?|replays?|play|sets?|full|run|long|beta|robin|round|highlights?|ranked|playtester)$/i;

/**
 * True when nothing in `s` could be somebody's name.
 *
 * TWO STRICTNESSES, BECAUSE THE CANDIDATE'S ORIGIN DECIDES WHAT A SHORT TOKEN
 * MEANS. A `structural` candidate came from the slot the grammar reserves for
 * the handle, and there a one-character or all-digit token IS the player — this
 * corpus has "Cow", "RED", "Zee", "GUY", "Fool", "ncv", "Pat". A GAP candidate
 * is whatever a roster span did not cover on a bare side, where a stray letter
 * or number is far more often debris, so it keeps the reference's rule: at least
 * one token of two or more characters that is not decoration.
 */
const isDecorPhrase = (s: string, structural: boolean): boolean => {
  const words = s
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean);
  if (words.length === 0) return true;
  if (structural) {
    if (words.length === 1 && /^\d+$/u.test(words[0] ?? '')) return false;
    return !words.some((w) => !DECOR_WORDS.test(w));
  }
  return !words.some((w) => w.length >= 2 && !DECOR_WORDS.test(w));
};

/** Remove decoration words from BOTH edges of a candidate, repeatedly. */
const trimDecorEdges = (s: string): string => {
  let words = s.split(/\s+/).filter(Boolean);
  const isDecor = (w: string) => TRIM_EDGE.test(w.replace(/[^\p{L}\p{N}]/gu, ''));
  let changed = true;
  while (changed && words.length > 1) {
    changed = false;
    if (isDecor(words[0]!)) {
      words = words.slice(1);
      changed = true;
    }
    if (words.length > 1 && isDecor(words[words.length - 1]!)) {
      words = words.slice(0, -1);
      changed = true;
    }
  }
  return words.join(' ');
};

/** A trailing parenthetical NOTE inside a handle — "Tsuku (PS5)" — dropped when
 *  something is left. "(ノ-_-)ノ" ends in ノ, not ")", and survives. */
const NOTE_TAIL = /\s*\([^()]*\)\s*$/u;

/** Bracket pairs an uploader can leave half-typed. */
const BRACKET_PAIRS: [string, string][] = [
  ['(', ')'],
  ['[', ']'],
  ['「', '」'],
  ['『', '』'],
  ['【', '】'],
];
const countChar = (s: string, c: string): number => s.split(c).length - 1;

/** Drop a bracket at either EDGE of a handle that has no partner inside it —
 *  "Dinotail)" from a split that cut through a group. Only UNMATCHED edge
 *  brackets go: "(ノ-_-)ノ" is balanced and keeps both. */
const stripUnmatchedEdges = (s: string): string => {
  let out = s.trim();
  for (let i = 0; i < 4; i++) {
    const before = out;
    for (const [open, close] of BRACKET_PAIRS) {
      const opens = countChar(out, open);
      const closes = countChar(out, close);
      if (opens > closes && out.endsWith(open)) out = out.slice(0, -1).trim();
      else if (opens > closes && out.startsWith(open)) out = out.slice(1).trim();
      if (closes > opens && out.startsWith(close)) out = out.slice(1).trim();
      else if (closes > opens && out.endsWith(close)) out = out.slice(0, -1).trim();
      if (out.startsWith(open) && out.endsWith(close) && open !== '(' && open !== '[') {
        const inner = out.slice(1, -1).trim();
        if (inner && countChar(inner, open) === 0 && countChar(inner, close) === 0) out = inner;
      }
    }
    if (out.length > 2 && out.startsWith('"') && out.endsWith('"') && countChar(out, '"') === 2) {
      out = out.slice(1, -1).trim();
    }
    if (out === before) break;
  }
  return out;
};

/**
 * Glyphs that are decoration inside a handle.
 *
 * REGIONAL INDICATORS ARE THE ONE THIS GAME ADDED AND THE REFERENCE HAS NO CLASS
 * FOR: ndyTv writes a flag pair immediately before each handle on 33 titles
 * ("🇺🇸 05mario", "🇲🇽 Biscuit"), and left in place it becomes the first grapheme
 * of the player id.
 *
 * `\p{Extended_Pictographic}` IS DELIBERATELY NOT USED, and the reason is one
 * codepoint: U+2122 (™) is Extended_Pictographic, it sits inside saxxiefone's
 * handle "Chris™", and roster.ts PINS the resulting id `christm` as a gate
 * because NFKD expands the sign to the letters TM. A blanket emoji strip would
 * silently move that id. U+2671 (♱) — a REAL handle on arinKarin and in the
 * catalogue — is neither Regional_Indicator nor Extended_Pictographic and
 * survives both classes; it is refused later, loudly, by playerId().
 */
const DECOR_GLYPHS = new RegExp(
  // Same String.raw treatment as GLOBAL_SUFFIX's tail, for the same reason: a
  // literal U+FE0F here is an invisible character in the source and a
  // no-misleading-character-class error in the linter.
  String.raw`\p{Regional_Indicator}|\uFE0F|[▰▶⏺➤✪🔥⭐🌟✨⚡👑🎮]`,
  'gu',
);

/**
 * Clean one handle candidate.
 *
 * Sponsor prefixes ("ASG | ScytheLDN", "SSF|HoldBackToBark", "Digger | OctoZed",
 * "KentFGC | Whim") are stripped by channels.ts's repeated stripTheaterSponsor,
 * never split — '|' is not a duo delimiter on a 1v1 game and there is NO
 * playerSep (channels.ts). ORDER IS MEASURED: the sponsor strip must run BEFORE
 * any blanket '|'→space or "ASG | ScytheLDN" becomes the player "ASG ScytheLDN".
 *
 * '/' is trimmed at the EDGES only: the catalogue carries the handle "Vik/Jagi"
 * on five sides and schoolBus writes "Al Pigone/BodegaCat", both one person.
 */
const EDGE_PUNCT = /^[\s.\-–—:!,/]+|[\s.\-–—:!,/]+$/g;

const cleanHandle = (s: string, rewrite?: Map<string, string>): string => {
  const base = stripUnmatchedEdges(
    stripTheaterSponsor(normalizeText(s))
      .replace(DECOR_GLYPHS, ' ')
      .replace(/[|｜]/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(EDGE_PUNCT, '')
      .trim(),
  )
    // Twice, because stripUnmatchedEdges can expose punctuation the first pass
    // could not reach: "Techno :)" loses its unmatched paren and is left with a
    // trailing colon.
    .replace(EDGE_PUNCT, '')
    .trim();
  const trimmed = trimDecorEdges(base) || base;
  const noted = trimmed.replace(NOTE_TAIL, '').trim() || trimmed;
  // Channel-scoped handle REWRITES (types/index.ts ChannelAliases.handles): a
  // raw spelling one uploader uses for a person the rest of the corpus spells
  // differently — drew Shoto's self-reference "Me" → "Drewski-27", avianZebra's
  // "Avian Zebra" → "AvianZebra". It is a spelling map, never an id map: the id
  // is still derived from the canonical handle by the shared slug rule, so a
  // rewrite cannot invent an id the roster track does not know about.
  return rewrite?.get(aliasKey(noted)) ?? noted;
};

/**
 * A PLACEHOLDER handle — a source that declined to name the player.
 *
 * CHECKLIST 12k IS WHY THIS IS NOT THE REFERENCE'S PREDICATE. That one ends in
 * `[^\p{L}\p{N}]*`, an alternative that matches any all-punctuation string — and
 * the corpus contains `♱` (U+2671) as an ENTIRE handle, written by arinKarin in
 * its own title ("Vs ♱ (Azula)") and echoed by catalogue row 482823. It is a
 * REAL player; the reference would delete the row as junk. So the punctuation
 * alternative is gone and the refusal is by NAME only.
 *
 * The `\s+` before `player` is the second fix and it is also measured:
 * `(?:[\p{L}\p{N}]+\s*)?player` matches normalMs's real handle
 * "LeastMechyPlayer" by backtracking, because the space is optional. Requiring
 * whitespace keeps "Anonymous Player" (natsuXenoblade) and "GG Player" refused
 * and "LeastMechyPlayer" admitted.
 */
const PLACEHOLDER_HANDLE =
  /^(?:(?:[\p{L}\p{N}]+\s+)?player|unknown(?:\s+player)?|none|n\/a|tbd)$/iu;
export const isPlaceholderHandle = (handle: string): boolean =>
  PLACEHOLDER_HANDLE.test(normalizeText(handle));

/**
 * Pick a handle from candidate fragments, IN PRIORITY ORDER — the one place a
 * handle is chosen.
 *
 * The reference takes the LONGEST surviving candidate. That is wrong on this
 * corpus and cow is the counter-example: the outside of its side 2 is
 * "Rystek | High Level FT5 | Avatar Legends", where the longest survivor is the
 * decoration. The caller here hands candidates best-first — the fragment
 * ADJACENT to the character bracket, then the whole slot, then the roster gaps —
 * because on every measured grammar the handle is the text touching the slot and
 * the decoration accumulates outside it.
 *
 * A handle that is entirely decoration is not a handle, and neither is a
 * PLACEHOLDER: `placeholder` is set only when the refusal DECIDED the side, so a
 * placeholder beside a real candidate is not counted as a drop.
 */
const pickHandle = (
  candidates: string[],
  structural: boolean,
  rewrite?: Map<string, string>,
): { handle: string; placeholder: boolean } => {
  const cleaned = candidates.map((c) => cleanHandle(c, rewrite)).filter(Boolean);
  const handle =
    cleaned.find(
      (c) =>
        !isDecorPhrase(c, structural) &&
        !isPlaceholderHandle(c) &&
        c.split(/\s+/).length <= MAX_HANDLE_WORDS,
    ) ?? '';
  return { handle, placeholder: !handle && cleaned.some(isPlaceholderHandle) };
};

/** Close a bracket the uploader opened and never closed, so the extractor can
 *  see the slot. Only a SURPLUS of openers is closed, at the end; a surplus of
 *  closers is left for stripUnmatchedEdges. */
const closeOpenBrackets = (s: string): string => {
  let out = s;
  for (const [open, close] of BRACKET_PAIRS) {
    const surplus = countChar(out, open) - countChar(out, close);
    if (surplus > 0) out += close.repeat(surplus);
  }
  return out;
};

/**
 * The text of `s` that no roster span covers, as fragments — and ONLY the
 * fragments that are separated from their span by whitespace or a separator.
 *
 * THE ADJACENCY TEST IS THIS GAME'S ADDITION AND IT IS ONE MEASURED TITLE'S
 * WORTH OF DEFENCE. schoolBus writes "Korra (SchoolBus) vs Azula-Lord"
 * (xD9XubfCCG0). The matcher's trailing guard is `(?![\p{L}\p{N}])` and a hyphen
 * is neither, so `Azula` matches inside `Azula-Lord` and the gap `-Lord` becomes
 * the player "Lord" — a record invented out of one token. A handle is a separate
 * WORD from the character it stands beside, so a gap glued to its span without
 * whitespace is not a candidate, and the side is an honest `no-handle`.
 */
const gapsAround = (s: string, matcher: AliasMatcher): string[] => {
  const t = normalizeText(s);
  const spans = matcher.find(t);
  const gaps: string[] = [];
  const SEP = /[\s|｜,;:()[\]（）/]/u;
  let prev = 0;
  for (const span of spans) {
    const gap = t.slice(prev, span.start);
    const leftOk = prev === 0 || SEP.test(t[prev] ?? ' ');
    const rightOk = gap.length === 0 || SEP.test(t[span.start - 1] ?? ' ');
    if (gap && leftOk && rightOk) gaps.push(gap);
    prev = span.end;
  }
  const tail = t.slice(prev);
  if (tail && (prev === 0 || SEP.test(t[prev] ?? ' '))) gaps.push(tail);
  return gaps;
};

// ── the typed slot reader ───────────────────────────────────────────────────

/**
 * The delimiters that separate a bracket group's PARTS, split BEFORE anything is
 * resolved (checklist 13).
 *
 * "(Toph/ Boulder)", "(Ozai - Sozin)", "(Zaheer -P'Li)", "(Ozai, Toph)",
 * "(Joo Dee/Ursa)", "(Zuko/June - Aang/Gyatso)". The dash alternative requires
 * WHITESPACE BEFORE IT so that `Ming-Hua` and `Lo and Li` — two support names
 * the corpus writes verbatim — are never cut in half, which is checklist 5c's
 * whole point restated for the second namespace.
 */
const PART_SEP = /\s*\/\s*|\s+-\s*|\s*;\s*|\s*,\s*/;

interface SlotRead {
  fighters: string[];
  supports: string[];
  /** Spans that resolved in BOTH namespaces AND sat beside another character
   *  span. See readParts() for why the "beside" condition is the whole rule. */
  overlaps: NamespaceOverlap[];
  /** Text no span covered, with the decoration vocabulary removed — checklist
   *  5r's signal. */
  residue: string;
}

/**
 * Resolve one slot's text: split into parts, resolve each part in BOTH
 * namespaces, and type every span by the vocabulary it came from rather than by
 * where it sat.
 *
 * THE OVERLAP RULE, WHICH IS THE ONE PLACE THIS FUNCTION DECIDES ANYTHING.
 * `Katara` resolves as a launch FIGHTER and as Avatar Aang's SUPPORT. A span
 * that resolves in both namespaces is read as a FIGHTER when it is the slot's
 * ONLY character span — "(KATARA)" on 34 STiLL records, "(Katara)" on
 * toledoLocals, and every other plain fighter bracket in the corpus — because
 * with nothing beside it there is no second reading to choose between and the
 * slot's own kind settles it. Beside ANOTHER character span the question becomes
 * real ("is this a counter-pick or the support?"), no title states the answer,
 * and the record is handed to a human as `support-overlap` rather than guessed.
 * types/index.ts ReviewQueueItem and roster.ts readSlot both say the same thing:
 * a declared slot is a channel's habit, not evidence about one title.
 */
function readParts(text: string, matcher: AliasMatcher): SlotRead {
  const parts = normalizeText(text)
    .split(PART_SEP)
    .map((p) => p.trim())
    .filter(Boolean);
  const fighters: string[] = [];
  const supports: string[] = [];
  const overlaps: NamespaceOverlap[] = [];
  const ambiguous: NamespaceOverlap[] = [];

  for (const part of parts) {
    for (const span of matcher.find(part)) {
      if (span.fighter && span.support) {
        ambiguous.push({ span: span.literal, fighterId: span.fighter, supportId: span.support });
        continue;
      }
      if (span.fighter) {
        if (!fighters.includes(span.fighter)) fighters.push(span.fighter);
      } else if (span.support) {
        if (!supports.includes(span.support)) supports.push(span.support);
      }
    }
  }
  // An ambiguous span is the slot's FIGHTER unless another FIGHTER resolved
  // beside it. "(KATARA/KANNA)" is Katara plus her support — a support span
  // cannot be the pick, so the ambiguity is not real, and this is what keeps 34
  // of one channel's records and every other plain Katara bracket. "(Avatar
  // Aang/Katara)" has two fighter-capable spans and no title states which is
  // which, so it goes to a human. The order of `ambiguous` does not matter here:
  // a bracket with two ambiguous spans and no plain fighter is not in this
  // corpus, and if one arrives the first wins the slot and the second is queued,
  // which is the same verdict read the other way round.
  for (const a of ambiguous) {
    if (fighters.length === 0) fighters.push(a.fighterId);
    else overlaps.push(a);
  }
  return { fighters, supports, overlaps, residue: matcher.residue(text) };
}

/** One bracket group, read as its typed slots. */
interface GroupRead extends SlotRead {
  /** The group as written, brackets included. */
  raw: string;
  /** Its content, brackets removed, minus any nested square support slot. */
  inner: string;
  start: number;
  end: number;
}

/**
 * Read one bracket group.
 *
 * A NESTED SQUARE BRACKET IS A TYPED SUPPORT SUB-SLOT, not a second fighter:
 * natsuXenoblade writes "Natsu (Zuko [Mai])" on 22 of 22 sides and it is the
 * cleanest statement of the two namespaces in the corpus. The square part is
 * resolved in the SUPPORT namespace alone, so even "[Katara]" — which would
 * resolve in both — cannot add a fighter to the side.
 */
function readGroup(m: RegExpMatchArray, matcher: AliasMatcher): GroupRead {
  const raw = m[0];
  const content = raw.slice(1, -1);
  const nested = /\[([^[\]]*)\]/u.exec(content);
  const inner = nested ? content.replace(nested[0], ' ').trim() : content.trim();
  const base = readParts(inner, matcher);
  if (!nested) {
    return { ...base, raw, inner, start: m.index ?? 0, end: (m.index ?? 0) + raw.length };
  }
  const sub = readParts(nested[1] ?? '', matcher);
  return {
    fighters: base.fighters,
    supports: [...base.supports, ...sub.supports],
    overlaps: base.overlaps,
    residue: [base.residue, sub.residue].filter(Boolean).join(' ').trim(),
    raw,
    inner,
    start: m.index ?? 0,
    end: (m.index ?? 0) + raw.length,
  };
}

/**
 * Two-letter fighter codes filling a WHOLE bracket — "(KO/OZ)", "(ZU/ZA)".
 * saltyRecoveryCenter only, and the scoping is the point: 'KO' is the most
 * common two-letter token in fighting-game titles there is, so these are valid
 * only as an `XX/YY` list that exhausts the slot and only on a channel that
 * declares them (types/index.ts pairCodes). Recovers 2 of that channel's 17.
 */
function readPairCodes(inner: string, codes: Record<string, string>): string[] | null {
  const parts = inner
    .split('/')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;
  const ids: string[] = [];
  for (const p of parts) {
    const id = codes[p.toUpperCase()];
    if (!id || !/^[A-Za-z]{2}$/.test(p)) return null;
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

// ── one side ────────────────────────────────────────────────────────────────

export interface Reading {
  handle: string;
  characters: string[];
  support: string | null;
  slotOrder: SlotOrder;
}

export interface ParsedSide extends Reading {
  /** Both readings resolved and the channel's declared order decided. */
  tieBroken: boolean;
  /** A span resolved in both namespaces beside another character span. */
  overlaps: NamespaceOverlap[];
  /** Text no span and no decoration word covered — checklist 5r. */
  residue: string;
  /** Set when the fighters came from the DESCRIPTION rather than the title, so
   *  the provenance can say which tier produced them (checklist 8b). */
  fromDescription?: string[];
}

export type SideMiss = 'no-char' | 'no-handle' | 'slot-ambiguous' | 'support-overlap';

export type SideOutcome =
  | { ok: ParsedSide }
  /** Both readings resolved and the channel declares no usable order: BOTH
   *  readings, for the review queue. Never guessed. */
  | { ambiguous: Reading[] }
  | {
      miss: SideMiss;
      placeholder?: boolean;
      overlaps?: NamespaceOverlap[];
      /** The fighters this side DID name — a `no-handle` that named a fighter is
       *  the CPU/arcade signal when it happens on both sides (checklist 5r). */
      characters?: string[];
      /** The handle this side DID name, where the grammar identifies the handle
       *  slot structurally. It pre-fills the review queue so a reviewer answers
       *  only the characters — and, more importantly, stops a verdict minting a
       *  second player page under a different spelling (types/index.ts
       *  ReviewQueueItem.handles). Set ONLY from a slot the channel's declared
       *  order names as the handle's; a guess here is worse than a blank field,
       *  because the reviewer can read the title and the form cannot. */
      handle?: string;
      residue?: string;
    };

export interface SideContext {
  matcher: AliasMatcher;
  declared: SlotOrder;
  pairCodes?: Record<string, string>;
  /** Channel-scoped handle rewrites, keyed by aliasKey. */
  handleRewrites?: Map<string, string>;
}

/**
 * The matcher for ONE channel: the roster's own vocabulary plus that channel's
 * scoped alias additions (types/index.ts ChannelAliases).
 *
 * SCOPED IS THE WHOLE POINT. 'Kiyoshi' is a typo three channels make and 8 of
 * one channel's records depend on it; 'Ozain' appears on two titles of one
 * channel and is flagged UNVERIFIED in that channel's entry; 'Gyatt' is one
 * uploader's nickname for Gyatso, confirmed in his own description. None of them
 * belongs in data/characters.json, because the app's search vocabulary and the
 * parser's vocabulary are the same data on this platform and a roster-wide typo
 * would be offered to every reader as a real name.
 *
 * Roster-wide aliases must NOT be duplicated here and are not: the four short
 * spellings every channel writes ('Toph', 'Kyoshi', 'Ozai', 'Avatar Aang') live
 * in data/characters.json, where running one channel with the handoff's display
 * names alone resolves 4 of its 16 sides.
 */
export function channelMatcher(
  ch: ChannelConfig,
  characters: CharacterRecord[],
  supports: SupportRecord[],
): AliasMatcher {
  const extraF = ch.aliases?.fighters;
  const extraS = ch.aliases?.supports;
  if (!extraF && !extraS) return buildAliasMatcher(characters, supports);
  const f: FighterAliasSource[] = characters.map((c) => ({
    id: c.id,
    name: c.name,
    extra: { ...c.extra, aliases: [...(c.extra?.aliases ?? []), ...(extraF?.[c.id] ?? [])] },
  }));
  const sup: SupportAliasSource[] = supports.map((x) => ({
    id: x.id,
    name: x.name,
    aliases: [...x.aliases, ...(extraS?.[x.id] ?? [])],
  }));
  return buildAliasMatcher(f, sup);
}

/** The channel's handle rewrites, keyed through the matcher's own alias key so a
 *  casing or spacing difference cannot make the map miss. */
export function handleRewrites(ch: ChannelConfig): Map<string, string> | undefined {
  const map = ch.aliases?.handles;
  if (!map) return undefined;
  return new Map(Object.entries(map).map(([from, to]) => [aliasKey(from), to]));
}

/**
 * One side segment → handle + fighters + support, with no positional
 * assumption. The channel's declared order is consulted twice and only twice:
 * to break a BOTH-RESOLVE tie, and to order which reading is TRIED first when
 * only one of them can resolve anyway.
 */
export function parseSide(segment: string, ctx: SideContext): SideOutcome {
  const { matcher, declared } = ctx;
  const seg = stripRank(closeOpenBrackets(normalizeText(segment)));
  GROUP.lastIndex = 0;
  const groups = [...seg.matchAll(GROUP)].map((m) => readGroup(m, matcher));

  if (groups.length > 0) {
    const outsideText = seg.replace(GROUP, ' ').replace(/\s+/g, ' ').trim();
    const beforeFirst = seg.slice(0, groups[0]!.start).trim();
    const outside = readParts(outsideText, matcher);

    // Pair codes fill a whole bracket and are read only where declared.
    for (const g of groups) {
      if (g.fighters.length === 0 && ctx.pairCodes) {
        const ids = readPairCodes(g.inner, ctx.pairCodes);
        if (ids) g.fighters = ids;
      }
    }

    const fighterGroups = groups.filter((g) => g.fighters.length > 0);
    const overlaps = [...groups.flatMap((g) => g.overlaps), ...outside.overlaps];
    if (overlaps.length) return { miss: 'support-overlap', overlaps };

    // MORE THAN ONE bracket resolving a fighter is ambiguous — which one names
    // the pick? Never guessed; the caller routes it to the queue.
    if (fighterGroups.length > 1) return { miss: 'slot-ambiguous' };
    const g = fighterGroups[0];

    // The support is whatever resolved in the SUPPORT namespace on this side,
    // outside whichever slot ends up being the handle. Collected from the
    // character slot and from any bracket that holds only supports —
    // saxxiefone's "(June)" beside a bare fighter, natsuXenoblade's "[Mai]".
    const supportOnlyGroups = groups.filter(
      (x) => x.fighters.length === 0 && x.supports.length > 0,
    );
    const groupSupports = [...(g?.supports ?? []), ...supportOnlyGroups.flatMap((x) => x.supports)];

    // The handle candidates for a bracketed slot, best-first: the fragment of
    // the outside text ADJACENT to the first bracket, then the whole outside.
    const outsideCandidates = [lastFragment(beforeFirst), beforeFirst, outsideText].filter(Boolean);

    if (g && outside.fighters.length > 0) {
      // BOTH READINGS RESOLVE. The first resolving span is a coin flip, so the
      // channel's DECLARED order decides — and only here. Measured on the Stage 0
      // corpus this fires on ZERO sides after the decoration strips and on five
      // before them, every one of them because hype prose in the handle position
      // names a fighter ("HIGH LEVEL NORRA PLAY! TestMyLuck(Norra)"). The strips
      // are the fix; this is the backstop, and the per-channel tally in
      // report.md is how a channel that starts drifting becomes visible.
      const outsideHandle = pickHandle(outsideCandidates, true, ctx.handleRewrites);
      const innerHandle = pickHandle(
        groups.filter((x) => x !== g).map((x) => x.inner),
        true,
        ctx.handleRewrites,
      );
      const readings: Reading[] = [
        {
          handle: outsideHandle.handle,
          characters: g.fighters,
          support: groupSupports[0] ?? null,
          slotOrder: 'handle-outside',
        },
        {
          handle: innerHandle.handle,
          characters: outside.fighters,
          support: outside.supports[0] ?? groupSupports[0] ?? null,
          slotOrder: 'chars-outside',
        },
      ];
      const pick =
        declared === 'handle-outside'
          ? readings[0]
          : declared === 'chars-outside'
            ? readings[1]
            : undefined;
      // 'handle-first-bare' and 'pair-chars-outside' say nothing about which SLOT
      // of a bracketed segment holds the fighter, so they cannot break this tie —
      // which is exactly why schoolBus declares one of them (channels.ts).
      if (!pick) return { ambiguous: readings };
      if (!pick.handle) {
        return {
          miss: 'no-handle',
          placeholder: (pick === readings[0] ? outsideHandle : innerHandle).placeholder,
          characters: pick.characters,
          residue: outside.residue,
        };
      }
      return {
        ok: { ...pick, tieBroken: true, overlaps: [], residue: outside.residue },
      };
    }

    if (g) {
      // Exactly the bracket resolves a fighter: the handle is outside it.
      const { handle, placeholder } = pickHandle(outsideCandidates, true, ctx.handleRewrites);
      if (!handle) {
        return {
          miss: 'no-handle',
          placeholder,
          characters: g.fighters,
          residue: outside.residue,
        };
      }
      return {
        ok: {
          handle,
          characters: g.fighters,
          support: groupSupports[0] ?? null,
          slotOrder: 'handle-outside',
          tieBroken: false,
          overlaps: [],
          residue: outside.residue,
        },
      };
    }

    if (outside.fighters.length > 0) {
      // Exactly the outside resolves. On a chars-outside channel the bracket
      // holds the handle ("Katara / Kanna ( Karma )"); on a bare-grammar channel
      // a bracket that does not resolve is a NOTE or a support ("Saxxie Zuko
      // (June)") and the handle is the outside text no span covered. Both are
      // tried; the declared order only decides which is tried FIRST.
      //
      // EXCEPT ON A DECLARED handle-outside CHANNEL WHEN A BRACKET HOLDS A NAME.
      // There the grammar says the bracket IS the pick, so a name-shaped bracket
      // the roster cannot read is a pick the roster cannot read — a typo, or a
      // DLC arrival — and the resolving outside is a fighter-named HANDLE. It is
      // an honest `no-char` that reaches the queue. A bracket that resolves a
      // SUPPORT is excluded from that test: it is typed, not unreadable, which is
      // what lets saxxiefone's "(June)" through. redblade's entry in channels.ts
      // relies on this branch by name.
      const nameShaped = groups.filter(
        (x) => x.supports.length === 0 && !isDecorPhrase(x.inner, true),
      );
      if (declared === 'handle-outside' && nameShaped.length > 0) {
        const named = pickHandle(outsideCandidates, true, ctx.handleRewrites).handle;
        return { miss: 'no-char', residue: outside.residue, ...(named ? { handle: named } : {}) };
      }
      const fromInner = pickHandle(
        groups.map((x) => x.inner),
        true,
        ctx.handleRewrites,
      );
      const fromGaps = pickHandle(gapsAround(outsideText, matcher), false, ctx.handleRewrites);
      const order: [string, SlotOrder][] =
        declared === 'chars-outside'
          ? [
              [fromInner.handle, 'chars-outside'],
              [fromGaps.handle, 'handle-first-bare'],
            ]
          : [
              [fromGaps.handle, 'handle-first-bare'],
              [fromInner.handle, 'chars-outside'],
            ];
      const hit = order.find(([h]) => h);
      if (!hit) {
        return {
          miss: 'no-handle',
          placeholder: fromInner.placeholder || fromGaps.placeholder,
          characters: outside.fighters,
          residue: outside.residue,
        };
      }
      return {
        ok: {
          handle: hit[0],
          characters: outside.fighters,
          support: outside.supports[0] ?? groupSupports[0] ?? null,
          slotOrder: hit[1],
          tieBroken: false,
          overlaps: [],
          residue: outside.residue,
        },
      };
    }

    // No fighter anywhere on the side. If a SUPPORT resolved, the side is not a
    // miss of the ordinary kind — it is STiLL's "Enigmode(Kanna) V.S
    // STiLL(Pakku)", where both brackets hold a support and neither holds a
    // fighter (roster.ts, `crossed`). Its fighter is unknown and its support is
    // stated, so it goes to a human as `character-completion` rather than being
    // resolved either way.
    const named =
      declared === 'chars-outside'
        ? pickHandle(
            groups.map((x) => x.inner),
            true,
            ctx.handleRewrites,
          ).handle
        : pickHandle(outsideCandidates, true, ctx.handleRewrites).handle;
    return { miss: 'no-char', residue: outside.residue, ...(named ? { handle: named } : {}) };
  }

  // BARE: no brackets at all — rood's 2026-08-13 batch ("Rood Katara vs Giga
  // Caras Ozain"), saxxiefone's "Saxxie Zuko", WickDaLine's CPU matchups. The
  // roster spans are the boundary and the gaps are the handle.
  const bare = readParts(seg, matcher);
  if (bare.overlaps.length) return { miss: 'support-overlap', overlaps: bare.overlaps };
  if (bare.fighters.length === 0) return { miss: 'no-char', residue: bare.residue };

  const gaps = gapsAround(seg, matcher);
  const { handle, placeholder } = pickHandle(gaps, false, ctx.handleRewrites);
  if (!handle) {
    return {
      miss: 'no-handle',
      placeholder,
      characters: bare.fighters,
      residue: bare.residue,
    };
  }
  // Which side of the character the handle sat on — telemetry only.
  const spans = matcher.find(normalizeText(seg));
  const order: SlotOrder = (spans[0]?.start ?? 1) === 0 ? 'chars-outside' : 'handle-first-bare';
  return {
    ok: {
      handle,
      characters: bare.fighters,
      support: bare.supports[0] ?? null,
      slotOrder: order,
      tieBroken: false,
      overlaps: [],
      residue: bare.residue,
    },
  };
}

/** The last fragment of a slot's outside text, split on the separators that
 *  divide a title into sections. Spaces are required around the dash so
 *  "An11-_-MO", "Drewski-27" and "Super-X-SIlver" stay whole. */
const FRAGMENT_SEP = /\s*[|｜]\s*|\s+[-–—]\s+|\s*:\s+|\s+@\s+/u;
const lastFragment = (s: string): string => {
  const parts = s
    .split(FRAGMENT_SEP)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length > 1 ? (parts[parts.length - 1] ?? '') : '';
};

// ── one title ───────────────────────────────────────────────────────────────

export type MissKind =
  | 'no-marker'
  | 'before-floor'
  | 'live'
  | 'too-short'
  | 'too-long'
  | 'no-vs'
  | 'vs-count'
  | 'no-char'
  | 'no-handle'
  | 'matchup-only'
  | 'slot-ambiguous'
  | 'support-overlap';

export interface ParseOutcome {
  ok?: [ParsedSide, ParsedSide];
  miss?: MissKind;
  /** For 'slot-ambiguous': the side(s) and their readings, for the queue. */
  ambiguous?: { side: 0 | 1; readings: Reading[] }[];
  /** For 'support-overlap': the spans and the two ids each resolved to. */
  overlaps?: NamespaceOverlap[];
  /** A side was dropped because its only handle candidate was a placeholder. */
  placeholder?: boolean;
  /** Handles the title DID state, for the review queue's pre-fill. */
  handles?: [string, string];
}

/** Top-level `vs` positions — the ones OUTSIDE every bracket group. A `vs`
 *  inside a group is the pair-level grammar's second separator, or schoolBus's
 *  mirror shape, and splitting the title on it produces two halves of one
 *  bracket. */
function topLevelVs(t: string): number[] {
  GROUP.lastIndex = 0;
  const ranges = [...t.matchAll(GROUP)].map((m) => [m.index, m.index + m[0].length] as const);
  VS.lastIndex = 0;
  const out: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = VS.exec(t)) !== null) {
    const i = m.index;
    if (!ranges.some(([a, b]) => i >= a && i < b)) out.push(i);
  }
  return out;
}

const splitAt = (t: string, index: number, length: number): [string, string] => [
  t.slice(0, index).trim(),
  t.slice(index + length).trim(),
];

/**
 * THE PAIR-LEVEL BRANCH (checklist 5q), marker-keyed.
 *
 * `CharA vs CharB (HandleA vs HandleB)` — aegisEsports, 57 records — and its
 * mirror `HandleA vs HandleB (CharA/SupA vs CharB/SupB)` — avianZebra's combined
 * bracket, phoenixWrong's whole grammar. ONE bracket group holds a `vs` and the
 * text outside it holds another, so the pairs are index-aligned across the
 * bracket wall.
 *
 * WHICH PAIR HOLDS THE FIGHTERS IS DECIDED BY ROSTER RESOLUTION, NEVER BY THE
 * CHANNEL. channels.ts states the reason and it is not hypothetical:
 * aegisEsports publishes ~150 Under Night In-Birth uploads in the MIRROR of this
 * shape ("Aubrey vs Raeze UNI 2 REPLAY! (Kaguya vs Akatsuki)"), so a
 * channel-scoped reading would file one of that channel's two games backwards on
 * every record. The marker gate is what guarantees the roster is the right
 * vocabulary to ask; resolution does the rest.
 *
 * `ownerHandle` fills a side the grammar leaves EMPTY, and only there
 * (types/index.ts): phoenixWrong titles are "FT5 vs. <opponent> (<opponent's
 * pick> vs. <own pick>)", so the outside splits to ['', 'Snake Eyez']. The
 * non-empty handle takes the FIRST inner slot because that channel writes the
 * opponent first inside the bracket on 3 of 3 titles, and catalogue row 496966
 * independently names 'PhoenixWrong' on the other side of that exact video. It
 * is never a positional guess: a channel with no ownerHandle and an empty side
 * is a reject, which is the honest fallback.
 */
function parsePair(
  t: string,
  ctx: SideContext,
  ownerHandle: string | undefined,
): ParseOutcome | null {
  GROUP.lastIndex = 0;
  const groups = [...t.matchAll(GROUP)];
  const withVs = groups.filter((m) => countVs(m[0]) >= 1);
  if (withVs.length !== 1) return null;
  const g = withVs[0]!;
  const inner = g[0].slice(1, -1);
  const outsideText = (t.slice(0, g.index) + ' ' + t.slice(g.index + g[0].length)).trim();

  const innerVs = topLevelVs(inner);
  if (innerVs.length !== 1) return null;
  const innerParts = splitAt(inner, innerVs[0]!, matchLengthAt(inner, innerVs[0]!));

  const outerVs = topLevelVs(outsideText);
  if (outerVs.length !== 1) return null;
  const outerRaw = splitAt(outsideText, outerVs[0]!, matchLengthAt(outsideText, outerVs[0]!));
  const outerParts = outerRaw.filter((p) => p.length > 0);

  const innerReads = innerParts.map((p) => readParts(p, ctx.matcher));
  const outerReads = outerRaw.map((p) => readParts(p, ctx.matcher));
  const innerIsChars = innerReads.every((r) => r.fighters.length > 0);
  const outerIsChars = outerReads.every((r) => r.fighters.length > 0);
  if (innerIsChars === outerIsChars) return null; // both or neither — not a pair title

  const overlaps = [...innerReads, ...outerReads].flatMap((r) => r.overlaps);
  if (overlaps.length) return { miss: 'support-overlap', overlaps };

  const charReads = innerIsChars ? innerReads : outerReads;
  const handleTexts = innerIsChars ? outerParts : innerParts;
  const slotOrder: SlotOrder = innerIsChars ? 'handle-outside' : 'pair-chars-outside';

  let handles: string[];
  if (handleTexts.length === 2) {
    handles = handleTexts.map(
      (h) => pickHandle([lastFragment(h), h], true, ctx.handleRewrites).handle,
    );
  } else if (handleTexts.length === 1 && ownerHandle) {
    handles = [
      pickHandle([lastFragment(handleTexts[0]!), handleTexts[0]!], true, ctx.handleRewrites).handle,
      ownerHandle,
    ];
  } else {
    return null;
  }
  if (handles.some((h) => !h)) {
    return { miss: 'no-handle', handles: undefined };
  }

  const sides = charReads.map<ParsedSide>((r, i) => ({
    handle: handles[i]!,
    characters: r.fighters,
    support: r.supports[0] ?? null,
    slotOrder,
    tieBroken: false,
    overlaps: [],
    residue: r.residue,
  }));
  const [a, b] = sides as [ParsedSide, ParsedSide];
  return { ok: [a, b], handles: [a.handle, b.handle] };
}

/** The literal length of the `vs` token at `index`, so a split can remove
 *  exactly what matched ("vs", "V.S.", "versus", "×"). */
function matchLengthAt(t: string, index: number): number {
  VS.lastIndex = index;
  const m = VS.exec(t);
  return m && m.index === index ? m[0].length : 2;
}

export interface TitleContext extends SideContext {
  channel: ChannelConfig;
}

/** Title → two sides, or a named miss. Pure; the caller owns policy. */
export function parseTitle(rawTitle: string, ctx: TitleContext): ParseOutcome {
  const ch = ctx.channel;
  let t = normalizeText(stripHashtagRun(rawTitle));
  t = t.replace(HASHTAG_TOKEN, ' ').replace(/\s+/g, ' ').trim();

  // Strips, PREFIX FIRST, channel before global, repeated until stable. The loop
  // matters: aegisEsports writes "GRAND FINAL - Avatar Legends The Fighting Game
  // Azula vs Toph (…)", where the channel's round prefix has to come off before
  // the global marker prefix can see the start of the title.
  for (let i = 0; i < 4; i++) {
    const before = t;
    t = applyStrips(t, ch.strip?.prefix ?? []);
    t = applyStrips(t, GLOBAL_PREFIX);
    t = applyStrips(t, ch.strip?.suffix ?? []);
    t = applyStrips(t, GLOBAL_SUFFIX);
    t = tailAfterLastGroup(t);
    if (t === before) break;
  }

  let tops = topLevelVs(t);
  // THE SPELLED-OUT 'versus' IS NEVER THIS CORPUS'S SEPARATOR, AND ON ONE
  // CHANNEL IT IS AN EVENT BRAND. The Versus Festival's events are "Versus
  // Experience: TE" and "Versus Experience Mumbai 2026"; its two grand-finals
  // titles put the brand in FRONT of the matchup, where the tail strip cannot
  // reach it, and the title then carries two top-level `vs` tokens. Every
  // channel that writes a separator writes `vs`/`Vs`/`VS`/`V.S`/`v.s.` — the
  // long spelling is measured ZERO times as a separator — so when dropping the
  // long spellings leaves exactly one token, that token is the split.
  if (tops.length > 1) {
    const short = tops.filter((i) => /^v\.?s\.?$/i.test(t.slice(i, i + matchLengthAt(t, i))));
    if (short.length === 1) tops = short;
  }
  if (tops.length === 1) {
    const pair = parsePair(t, ctx, ch.ownerHandle);
    if (pair) return pair;
  }
  if (tops.length === 0) {
    // A pair-level title whose outside `vs` the strips removed, or schoolBus's
    // mirror shape ("HIGH LEVEL KORRA MIRROR (SchoolBus vs Dinotail)"), where the
    // fighter is named once for both sides. Neither is recoverable without
    // guessing which side is which, so both are honest misses.
    //
    // THE ' - ' FALLBACK is skeet's one title (hDEIFL9o_2s): "Skeet (Sokka) -
    // Aeduo (Korra)". It fires only when there is no `vs` at all AND a bracket
    // group sits on each side of the dash, which is what keeps it off every
    // "Fighter [Mai] Day 1 Bread & Butter Combos".
    const dash = dashSplit(t);
    if (!dash) return { miss: 'no-vs' };
    return finishSides(dash, ctx);
  }
  if (tops.length > 1) return { miss: 'vs-count' };

  const parts = splitAt(t, tops[0]!, matchLengthAt(t, tops[0]!));
  if (parts.some((p) => !p)) return { miss: 'no-vs' };
  return finishSides(parts, ctx);
}

/** Exactly one top-level ' - ' with a bracket group on each side. */
function dashSplit(t: string): [string, string] | null {
  GROUP.lastIndex = 0;
  const ranges = [...t.matchAll(GROUP)].map((m) => [m.index, m.index + m[0].length] as const);
  if (ranges.length !== 2) return null;
  const re = /\s+[-–—]\s+/gu;
  const hits: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    if (!ranges.some(([a, b]) => m!.index >= a && m!.index < b)) hits.push(m.index);
  }
  if (hits.length !== 1) return null;
  const at = hits[0]!;
  if (!(at >= ranges[0]![1] && at < ranges[1]![0])) return null;
  const left = t.slice(0, at).trim();
  const right = t
    .slice(at)
    .replace(/^\s*[-–—]\s*/u, '')
    .trim();
  return left && right ? [left, right] : null;
}

function finishSides(parts: [string, string], ctx: TitleContext): ParseOutcome {
  const sides = [parseSide(parts[0], ctx), parseSide(parts[1], ctx)];
  const ambiguous = sides.flatMap((s, i) =>
    'ambiguous' in s ? [{ side: i as 0 | 1, readings: s.ambiguous }] : [],
  );
  if (ambiguous.length) return { miss: 'slot-ambiguous', ambiguous };

  const misses = sides.flatMap((s) => ('miss' in s ? [s] : []));
  if (misses.length) {
    const kinds = misses.map((m) => m.miss);
    // THE CPU / ARCADE REFUSAL (checklist 5r). Both sides named a fighter and
    // NEITHER yielded a handle: the title is exhausted by its two fighter spans
    // plus mode words, which is a MATCHUP, not a match. Measured on WickDaLine —
    // 16 of 23 titles clear marker + two fighters + vs and not one is a real
    // match; 32 of 32 sides have empty residue once the fighter span is removed.
    // Named as its own class rather than folded into `no-handle` because it is a
    // property of the CHANNEL's content, not of one title's grammar, and because
    // it must never reach the review queue: there is no person to complete.
    const matchupOnly =
      misses.length === 2 &&
      kinds.every((k) => k === 'no-handle') &&
      misses.every((m) => (m.characters?.length ?? 0) > 0 && !(m.residue ?? '').trim());
    if (matchupOnly) return { miss: 'matchup-only' };

    const kind: MissKind = kinds.includes('support-overlap')
      ? 'support-overlap'
      : kinds.includes('slot-ambiguous')
        ? 'slot-ambiguous'
        : kinds.includes('no-char')
          ? 'no-char'
          : 'no-handle';
    const overlaps = misses.flatMap((m) => m.overlaps ?? []);
    const placeholder = misses.some((m) => m.placeholder === true);
    const known = sides.map((s) => ('ok' in s ? s.ok.handle : 'miss' in s ? (s.handle ?? '') : ''));
    return {
      miss: kind,
      ...(overlaps.length ? { overlaps } : {}),
      ...(placeholder ? { placeholder: true } : {}),
      ...(known.every(Boolean) ? { handles: [known[0]!, known[1]!] as [string, string] } : {}),
    };
  }
  const [a, b] = sides as [{ ok: ParsedSide }, { ok: ParsedSide }];
  return { ok: [a.ok, b.ok], handles: [a.ok.handle, b.ok.handle] };
}

// ── the description tier (checklist 5b/5p) ──────────────────────────────────

/**
 * Recover the fighters from the description when the TITLE named a matchup's
 * players and no fighter at all.
 *
 * MEASURED BEFORE IT WAS SCOPED, which is checklist 5p's whole point: a recon
 * pass here scoped a description gate for the largest channel and the verifier
 * found ZERO fighter spans in all 63 of its descriptions — a fixed 457-byte
 * boilerplate plus a chapter list. One `grep -c` settles whether the tier
 * exists before a parser is designed around it. It exists on exactly one channel
 * (types/index.ts CHAR_TIERS): 33 of ndyTv's 57 marked titles name no fighter,
 * and for 10 of them line 2 of the description is
 * `<Handle> (<Fighter>) vs <Handle> (<Fighter>)` with BOTH handles equal to the
 * title's. 10 of 10 verified.
 *
 * THE RULE IS KEYED ON THE EVIDENCE, NOT ON THE CHANNEL. It fires only when the
 * description's two handles are the SAME PEOPLE the title named — compared
 * through playerId(), so casing and sponsor tags cannot split them — and it
 * aligns by HANDLE rather than by position, because checklist 5b's failure is
 * compounding one order error with another. A channel id in this condition would
 * be a rule that cannot be checked; handle equality is one that checks itself.
 */
const DESC_LINE =
  /^\s*(.+?)\s*\(([^()]{1,60})\)\s*(?<![\p{L}\p{N}])(?:v\.?s\.?|versus)(?![\p{L}\p{N}])\s*(.+?)\s*\(([^()]{1,60})\)\s*$/iu;

function descriptionFighters(
  description: string,
  handles: [string, string],
  matcher: AliasMatcher,
): [string[], string[]] | null {
  const want = handles.map((h) => playerId(stripTheaterSponsor(normalizeText(h))));
  for (const line of normalizeText(description.replace(/\r/g, '')).split('\n').slice(0, 5)) {
    const m = DESC_LINE.exec(line);
    if (!m) continue;
    const got = [m[1]!, m[3]!].map((h) => playerId(stripTheaterSponsor(normalizeText(h))));
    const chars = [readParts(m[2]!, matcher).fighters, readParts(m[4]!, matcher).fighters];
    if (chars.some((c) => c.length === 0)) continue;
    if (got[0] === want[0] && got[1] === want[1]) return [chars[0]!, chars[1]!];
    if (got[0] === want[1] && got[1] === want[0]) return [chars[1]!, chars[0]!];
  }
  return null;
}

// ── the played-on date (checklist 5s) ───────────────────────────────────────

/**
 * The day the set was PLAYED, read from the text where a channel states it.
 *
 * STiLL titles every set with the played-on day and uploads it later — 22 days
 * measured over its 44 marked titles, 23 on the adversarial re-measure. Keyed on
 * publishedAt its whole corpus is misdated AND its August backlog is credited to
 * September, which is how a corpus looks like it is accelerating while ambient
 * volume is flat.
 *
 * READ BEFORE THE STRIPS RUN, because the channel's own suffix strip removes the
 * date token — the two rules are about the same characters and the order between
 * them is the difference between a dated record and a silently re-dated one.
 *
 * REFUSED rather than clamped when it falls outside the window: a token more
 * than `maxLagDays` before the upload, or after it, is a mistyped year rather
 * than a date, and the record keeps publishedAt. Both outcomes are counted.
 */
type PlayedOn =
  /** No token at all — the common case on a channel that only sometimes dates. */
  | { kind: 'absent' }
  /** A token outside the channel's declared lag window. The record keeps
   *  publishedAt and the refusal is counted separately from `absent`, because a
   *  report that conflates "no date written" with "date refused" hides the one
   *  number that would say the rule has stopped matching. */
  | { kind: 'refused'; iso: string; lagDays: number }
  | { kind: 'used'; date: string; lagDays: number };

function playedOnDate(
  ch: ChannelConfig,
  title: string,
  description: string,
  publishedAt: string,
): PlayedOn {
  const rule = ch.playedOnDateFrom;
  if (!rule) return { kind: 'absent' };
  const text = rule.source === 'description' ? description : title;
  const m = new RegExp(rule.pattern, 'u').exec(normalizeText(text));
  const g = m?.groups;
  if (!g?.m || !g.d || !g.y) return { kind: 'absent' };
  const yy = Number(g.y);
  const year = g.y.length <= 2 ? 2000 + yy : yy;
  const iso = `${String(year).padStart(4, '0')}-${g.m.padStart(2, '0')}-${g.d.padStart(2, '0')}`;
  if (!/^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/.test(iso)) return { kind: 'absent' };
  const lagDays = Math.round(
    (Date.parse(`${publishedAt.slice(0, 10)}T00:00:00Z`) - Date.parse(`${iso}T00:00:00Z`)) /
      86_400_000,
  );
  if (lagDays < 0 || lagDays > rule.maxLagDays) return { kind: 'refused', iso, lagDays };
  return { kind: 'used', date: iso, lagDays };
}

// ── the gate (checklist 3/3b, and the structural one) ───────────────────────

/**
 * Does this upload state that it is this game's?
 *
 * The marker gate first, on the TITLE, through channels.ts — including the
 * bare-'Avatar' GAME SLOT, which is scoped to one channel by its declared
 * gateMode and is a SLOT rule rather than a word rule. Then the two widenings,
 * each declared per channel and each measured:
 *   · 'titleOrDescription' — takeANappa, where two sets carry no marker in
 *     title, description OR tags and the description gate recovers 2 of 9.
 *   · extraGate 'fighterSupportPair' — a vs token AND at least two FIGHTER spans
 *     AND at least one SUPPORT span. It hits 9 on takeANappa, every one a real
 *     Avatar set, and 0 of schoolBus's 304 titles and 0 of either channel's DNF
 *     Duel, 2XKO, Invincible VS, Elsword or GGST uploads. It is a separate field
 *     from GateMode because it answers a different question — GateMode says
 *     which FIELD to read, this says what SHAPE counts as a statement of the
 *     game (types/index.ts ExtraGate).
 */
function isThisGame(ch: ChannelConfig, v: RawVideoRecord, matcher: AliasMatcher): boolean {
  if (hasMarkerForChannel(v.title, ch.gateMode)) return true;
  if (ch.gateMode === 'titleOrDescription' && hasAvatarMarker(v.description ?? '')) return true;
  if (ch.gateMode === 'titleOrTags' && (v.tags ?? []).some((t) => hasAvatarMarker(t))) return true;
  if (ch.extraGate === 'fighterSupportPair') {
    const t = normalizeText(v.title);
    if (countVs(t) >= 1 && matcher.fighters(t).length >= 2 && matcher.supports(t).length >= 1) {
      return true;
    }
  }
  return false;
}

// ── stale-raw guard (DATA ONLY — no filesystem metadata) ────────────────────
//
// Wall-clock age was a proxy and leaked; mtime was a proxy and leaked the same
// way, because `cp`, `git checkout` and a fresh clone all stamp a months-old
// dump as new (checklist 10c).
//
// THE TEST READS ONLY DATA. A dump cannot contain an upload published after it
// was taken, so if the committed corpus holds a record for this intake NEWER
// than the newest upload anywhere in the dump, that record cannot have come from
// this dump and parsing would drop it. Both sides are publish timestamps written
// by YouTube and carried in the files themselves.
//
// IT COMPARES publishedAt AND NEVER `date`. On the one channel where the two
// differ (`still`, up to 23 days) the record's date is the day it was PLAYED,
// which is older than the upload by construction — comparing it against a dump's
// newest upload would make a correctly dated record look like a stale one.
function assertRawIsFresh(id: ChannelKey, dump: RawVideoRecord[], committed: MatchVideo[]): void {
  let newestInDump = '';
  for (const r of dump) if (r.publishedAt > newestInDump) newestInDump = r.publishedAt;
  if (!newestInDump) return;

  let newestCommitted: MatchVideo | undefined;
  for (const v of committed) {
    if (v.intake !== id) continue;
    if (!newestCommitted || v.publishedAt > newestCommitted.publishedAt) newestCommitted = v;
  }
  if (!newestCommitted) return;
  if (newestCommitted.publishedAt <= newestInDump) return;

  throw new Error(
    [
      `raw/${id}.json is stale: the committed corpus holds an upload it cannot contain.`,
      ``,
      `  newest upload in the dump   ${newestInDump}`,
      `  newest committed record     ${newestCommitted.publishedAt}  ${newestCommitted.id}`,
      ``,
      `  A dump cannot contain an upload published after it was taken, so parsing now would`,
      `  drop that record and every one like it — and the next run would treat the smaller`,
      `  archive as the new baseline.`,
      ``,
      `  Refresh first:  npm run data:fetch   (or npm run data:catchup, which cannot be`,
      `  run in the wrong order by accident)`,
    ].join('\n'),
  );
}

const readJson = async <T>(name: string, fallback: T): Promise<T> => {
  const p = join(DATA, name);
  if (!existsSync(p)) return fallback;
  try {
    return JSON.parse(await readFile(p, 'utf8')) as T;
  } catch {
    return fallback;
  }
};

/** NOT readJson: its catch-all fallback is wrong for this one file. `committed`
 *  is the baseline for the freeze carry, the index intake's add-only merge AND
 *  the collapse guard, so a truncated videos.json silently becoming [] would
 *  carry nothing, leave the add-only merge with nothing to preserve, and disarm
 *  the guard for every channel at once. Absent is fine and means a first run;
 *  unreadable is a hard stop. */
async function readCommitted(): Promise<MatchVideo[]> {
  const p = join(DATA, 'videos.json');
  if (!existsSync(p)) return [];
  const text = await readFile(p, 'utf8');
  try {
    const v = JSON.parse(text) as MatchVideo[];
    if (!Array.isArray(v)) throw new Error('not an array');
    return v;
  } catch (err) {
    throw new Error('data/videos.json exists but will not parse — refusing to treat it as empty.', {
      cause: err,
    });
  }
}

/** Duration buckets the floor and the CEILING are both re-derived from. The
 *  boundaries bracket 120 and put the 3600s ceiling on its own edge. */
export const DURATION_BUCKETS = [
  ['0 (live/unknown)', 0, 1],
  ['1–29s', 1, 30],
  ['30–119s', 30, 120],
  ['120–299s', 120, 300],
  ['300–899s', 300, 900],
  ['900–1799s', 900, 1800],
  ['1800–3599s', 1800, 3600],
  ['3600s+', 3600, Infinity],
] as const;

export const durationBucket = (sec: number): string =>
  DURATION_BUCKETS.find(([, lo, hi]) => sec >= lo && sec < hi)?.[0] ?? '3600s+';

const emptyTally = (floorSec: number, ceilSec: number | null): ChannelTally => ({
  raw: 0,
  marked: 0,
  parsed: 0,
  excluded: 0,
  floorSec,
  ceilSec,
  misses: {},
  placeholderHandles: 0,
  slot: {
    'handle-outside': 0,
    'chars-outside': 0,
    'handle-first-bare': 0,
    'pair-chars-outside': 0,
  },
  tieBroken: 0,
  overlaps: 0,
  supportsStated: 0,
  supportSides: 0,
  supportOwnerMismatch: 0,
  descriptionRecovered: 0,
  playedOn: { used: 0, refused: 0, absent: 0, maxLagDays: 0 },
  rejects: [],
  rejectCount: 0,
});

const emptyHistogram = (): DurationHistogram => ({
  records: {},
  matchShapedMisses: {},
  otherMisses: {},
});

const bump = (m: Record<string, number>, k: string, n = 1): void => {
  m[k] = (m[k] ?? 0) + n;
};

async function main(): Promise<void> {
  await mkdir(DATA, { recursive: true });
  const characters = await loadCharacters();
  const supports = await loadSupports();
  const matcher = buildAliasMatcher(characters, supports);
  const supportIndex = buildSupportIndex(supports);
  const overrides = await readJson<Record<string, VideoOverride>>('overrides.json', {});
  const committed = await readCommitted();
  const pins = await readJson<SourcePins>('source-pins.json', {});
  const windows = patchWindows();

  const built: MatchVideo[] = [];
  const frozenBuilt = new Map<ChannelKey, MatchVideo[]>();
  const residue = new Map<string, number>();
  const queue: ReviewQueueItem[] = [];
  const perChannel = new Map<ChannelKey, ChannelTally>();
  const rawSeen = new Map<string, string>();
  const durations = new Map<ChannelKey, DurationHistogram>();
  const handleWords: Record<string, number> = {};

  // ── title-parsed channels ────────────────────────────────────────────────
  // Every YouTube channel, frozen included. A frozen channel normally has no
  // dump (fetch skips it) and is carried by parse-finish; when a dump IS present
  // it can only have come from `data:fetch --include-frozen`, the freeze-pin
  // seeding path, and parse-finish asserts the parse against the pin instead of
  // against the committed count.
  for (const ch of CHANNELS.filter((c) => !c.index)) {
    const floorSec = ch.minDurationSec ?? MIN_MATCH_SEC;
    const ceilSec = ch.maxDurationSec ?? null;
    const file = join(RAW, `${ch.id}.json`);
    if (!existsSync(file)) {
      if (ch.frozen) continue;
      console.warn(`  ⚠ raw/${ch.id}.json missing — skipping (run \`npm run data:fetch\`)`);
      perChannel.set(ch.id, emptyTally(floorSec, ceilSec));
      continue;
    }
    const dump = JSON.parse(await readFile(file, 'utf8')) as RawVideoRecord[];
    if (dump.length === 0) throw new Error(`raw/${ch.id}.json is empty — refusing to parse.`);
    assertRawIsFresh(ch.id, dump, committed);

    const tally = emptyTally(floorSec, ceilSec);
    const hist = emptyHistogram();
    tally.raw = dump.length;
    const floor = ch.preReleaseFrom ?? LAUNCH;
    // The channel's OWN matcher — the roster's vocabulary plus this uploader's
    // typos and shorthand, and nobody else's. The roster-wide matcher stays the
    // one the registry invariant and the index arm use, so a channel-scoped
    // spelling can never make a player name look like a character to the guard.
    const chMatcher = channelMatcher(ch, characters, supports);
    const rewrites = handleRewrites(ch);
    const ctx: TitleContext = {
      matcher: chMatcher,
      declared: ch.slotOrder,
      channel: ch,
      ...(ch.pairCodes ? { pairCodes: ch.pairCodes } : {}),
      ...(rewrites ? { handleRewrites: rewrites } : {}),
    };
    const out: MatchVideo[] = [];

    for (const v of dump) {
      rawSeen.set(v.id, `raw/${ch.id}.json`);
      const ov = overrides[v.id];
      if (ov?.exclude) {
        tally.excluded++;
        continue;
      }

      // THE MARKER GATE, FIRST. Not one of the 32 intakes is single-game: they
      // hold 45,992 uploads and 454 marked titles between them, and several
      // write their OTHER games in the identical grammar. An ungated parse does
      // not produce noise, it produces well-formed records for the wrong game.
      if (!isThisGame(ch, v, chMatcher)) {
        bump(tally.misses, 'no-marker');
        continue;
      }
      tally.marked++;

      // The played-on date, read BEFORE the strips remove it.
      const titleForDate = normalizeText(stripHashtagRun(v.title));
      const played = playedOnDate(ch, titleForDate, v.description ?? '', v.publishedAt);
      if (ch.playedOnDateFrom) {
        if (played.kind === 'used') {
          tally.playedOn.used++;
          tally.playedOn.maxLagDays = Math.max(tally.playedOn.maxLagDays, played.lagDays);
        } else if (played.kind === 'refused') {
          tally.playedOn.refused++;
        } else {
          tally.playedOn.absent++;
        }
      }
      const date = played.kind === 'used' ? played.date : v.publishedAt.slice(0, 10);

      if (date < floor) {
        bump(tally.misses, 'before-floor');
        bump(hist.otherMisses, durationBucket(v.durationSec));
        continue;
      }
      // GATE ON liveBroadcastContent AND NEVER ON liveStreamingDetails: three of
      // kang's three records and three of mikeyChiFgc's three are PREMIERES,
      // which carry that object and are ordinary uploads (types/index.ts).
      if (v.liveBroadcastContent !== 'none') {
        bump(tally.misses, 'live');
        bump(hist.otherMisses, durationBucket(v.durationSec));
        continue;
      }

      // Parsed BEFORE the duration gates, so a too-short or too-long upload is
      // still classified as match-shaped or not: that split is what the duration
      // histogram needs to keep both edges measured numbers rather than
      // inherited ones.
      const parsed = parseTitle(v.title, ctx);

      if (v.durationSec && v.durationSec < floorSec) {
        bump(tally.misses, 'too-short');
        bump(parsed.ok ? hist.matchShapedMisses : hist.otherMisses, durationBucket(v.durationSec));
        continue;
      }
      // THE CEILING (checklist 5t), and it is the harder edge. A whole-tournament
      // VOD passes the marker gate, clears the floor by a factor of sixty, and
      // becomes ONE record standing for fourteen matches. aegisEsports's six VODs
      // run 4840-7112s and the index cuts the longest into FOURTEEN rows; 3600
      // keeps 57 of 57 real sets and refuses 6 of 6 with 1240s of headroom.
      if (ceilSec !== null && v.durationSec > ceilSec) {
        bump(tally.misses, 'too-long');
        bump(parsed.ok ? hist.matchShapedMisses : hist.otherMisses, durationBucket(v.durationSec));
        continue;
      }

      let outcome = parsed;

      // The description tier, where the title named the players and no fighter.
      if (!outcome.ok && outcome.miss === 'no-char' && outcome.handles) {
        const fromDesc = descriptionFighters(v.description ?? '', outcome.handles, chMatcher);
        if (fromDesc) {
          tally.descriptionRecovered++;
          outcome = {
            ok: [
              sideFromDescription(outcome.handles[0], fromDesc[0]),
              sideFromDescription(outcome.handles[1], fromDesc[1]),
            ],
            handles: outcome.handles,
          };
        }
      }

      if (!outcome.ok) {
        const kind = outcome.miss ?? 'no-char';
        bump(tally.misses, kind);
        bump(hist.otherMisses, durationBucket(v.durationSec));
        if (outcome.placeholder) tally.placeholderHandles++;
        if (outcome.overlaps?.length) tally.overlaps += outcome.overlaps.length;
        const r = chMatcher.residue(normalizeText(stripHashtagRun(v.title)));
        if (r) residue.set(r, (residue.get(r) ?? 0) + 1);
        // THE REJECT PRINTER'S PRECISE HALF (checklist 5e): a miss that names a
        // roster character is match-shaped content the parser could not read, and
        // a new grammar variant lives there. Counted per channel, sampled into
        // report.md. A `matchup-only` refusal is deliberately NOT sampled: it
        // names two fighters by definition and would drown the table it exists to
        // make readable.
        if (kind !== 'matchup-only' && chMatcher.fighters(v.title).length > 0) {
          tally.rejectCount++;
          if (tally.rejects.length < 10) tally.rejects.push({ id: v.id, title: v.title, kind });
        }
        // Match-shaped footage the parser could not complete goes to a human,
        // never to a guess. `matchup-only` never does: there is no person in the
        // title to complete, and a queue full of CPU footage is a queue nobody
        // reads (checklist 6).
        if (kind === 'no-char' || kind === 'slot-ambiguous' || kind === 'support-overlap') {
          queue.push({
            id: v.id,
            kind:
              kind === 'no-char'
                ? 'character-completion'
                : kind === 'slot-ambiguous'
                  ? 'slot-ambiguous'
                  : 'support-overlap',
            channel: ch.id,
            title: normalizeText(v.title),
            publishedAt: v.publishedAt,
            durationSec: v.durationSec,
            ...(outcome.handles ? { handles: outcome.handles } : {}),
            ...(outcome.ambiguous
              ? {
                  readings: outcome.ambiguous.flatMap((a) =>
                    a.readings.map((x) => ({ handle: x.handle, characters: x.characters })),
                  ),
                }
              : {}),
            ...(outcome.overlaps?.[0] ? { overlap: outcome.overlaps[0] } : {}),
          });
        }
        continue;
      }

      const sides = outcome.ok.map<MatchSide>((s) => {
        // WHICH TIER PRODUCED THE FIGHTERS, RECORDED WHERE IT IS DECIDED
        // (checklist 8b). `fromTitle` stays the ids the TITLE stated — empty on a
        // description-recovered side, because citing the title for something it
        // did not say is exactly the claim provenance exists to prevent.
        const viaDesc = s.fromDescription !== undefined;
        const provenance: CharProvenance = {
          tier: viaDesc ? 'description' : 'title',
          tiers: viaDesc ? ['title', 'description'] : ['title'],
          fromTitle: viaDesc ? [] : s.characters,
          ...(viaDesc ? { fromDescription: s.characters } : {}),
          slotOrder: s.slotOrder,
          ...(s.tieBroken ? { tieBroken: true } : {}),
          ...(s.support ? { supportTier: 'title' as const } : {}),
          complete: s.characters.length >= 1,
        };
        return {
          player: playerId(s.handle),
          handle: s.handle,
          characters: s.characters,
          support: s.support,
          provenance,
        };
      });

      // `!playerId(h)` on the SLUG, not the handle: an all-CJK handle slugs
      // through roster.ts's non-Latin fallback, and only a pure-symbol handle
      // returns "" — which is the `♱` case, refused LOUDLY here rather than
      // deleted quietly by a placeholder rule (roster.ts playerId).
      if (sides.some((s) => !s.player || s.characters.length === 0)) {
        bump(tally.misses, 'no-handle');
        bump(hist.otherMisses, durationBucket(v.durationSec));
        continue;
      }

      // THE SUPPORT PARTITION, ASSERTED (roster.ts buildSupportIndex). Every one
      // of the 34 attested supports appears under exactly one fighter across all
      // 516 catalogue sides, so a support resolving on a side whose fighter does
      // not own it is a PARSE ERROR — the wrong span won, or the sides were split
      // wrong — not a rare pick. The support is dropped, the record is kept, and
      // the mismatch is counted per channel: a pick nobody made is worse than a
      // pick nobody recorded.
      for (const s of sides) {
        if (!s.support) continue;
        tally.supportSides++;
        const owner = supportIndex.ownerOf(s.support);
        if (owner && !s.characters.includes(owner)) {
          tally.supportOwnerMismatch++;
          s.support = null;
          delete s.provenance.supportTier;
        } else {
          tally.supportsStated++;
        }
      }

      for (const s of outcome.ok) {
        bump(tally.slot, s.slotOrder);
        if (s.tieBroken) tally.tieBroken++;
        bump(handleWords, String(s.handle.split(/\s+/).length));
      }

      const era = seasonToken(seasonForDate(date));
      const patch = patchForDate(date, windows).version;

      tally.parsed++;
      bump(hist.records, durationBucket(v.durationSec));
      const [s0, s1] = sides as [MatchSide, MatchSide];
      out.push({
        id: v.id,
        channel: ch.source,
        intake: ch.id,
        title: normalizeText(v.title),
        date,
        publishedAt: v.publishedAt,
        durationSec: v.durationSec,
        ...(v.viewCount ? { viewCount: v.viewCount } : {}),
        era,
        patch,
        sides: [s0, s1],
        ...(s0.support || s1.support
          ? { supports: [s0.support ?? null, s1.support ?? null] as [string | null, string | null] }
          : {}),
      });
    }
    perChannel.set(ch.id, tally);
    durations.set(ch.id, hist);
    if (ch.frozen) frozenBuilt.set(ch.id, out);
    else built.push(...out);
  }

  // ── --seed-freeze-pins: print, refuse to write ───────────────────────────
  if (SEED_FREEZE_PINS) {
    const frozen = CHANNELS.filter((c) => c.frozen);
    if (frozenBuilt.size === 0) {
      console.error(
        `✖ --seed-freeze-pins found no frozen dump. Fetch one first:\n` +
          frozen.map((c) => `    npm run data:fetch -- --only=${c.id} --include-frozen`).join('\n'),
      );
      process.exit(1);
    }
    console.log('▶ freeze-pin seeding — DRY RUN, nothing written\n');
    for (const [id, rs] of frozenBuilt) {
      const t = perChannel.get(id) ?? emptyTally(MIN_MATCH_SEC, null);
      const missLine = Object.entries(t.misses)
        .sort((a, b) => b[1] - a[1])
        .map(([k, n]) => `${k} ${n}`)
        .join(' · ');
      console.log(
        `  ${id}: ${t.raw} raw · ${t.marked} marked · ${rs.length} parsed\n` +
          `    misses: ${missLine || 'none'}\n` +
          `    → set \`frozen.records: ${rs.length}\` on ${id} in scripts/channels.ts, then run\n` +
          `      \`npm run data:parse\` with raw/${id}.json still in place. That run asserts the\n` +
          `      parse against the pin and writes the records; every later run carries them.`,
      );
    }
    return;
  }

  console.log(
    `▶ title parse: ${built.length} record(s) from ${perChannel.size} channel(s)` +
      (frozenBuilt.size ? ` + ${[...frozenBuilt.keys()].join(', ')} from a frozen dump` : ''),
  );
  await writeReportAndData({
    built,
    frozenBuilt,
    committed,
    overrides,
    pins,
    residue,
    queue,
    perChannel,
    rawSeen,
    durations,
    handleWords,
    matcher,
    supportIndex,
    characters,
    supports,
  });
}

/** A side whose fighters came from the description tier and whose handle came
 *  from the title. The tier is carried on the side rather than inferred later —
 *  checklist 8b: "how did this record get its characters" is unanswerable
 *  afterwards unless it is recorded at the moment it is decided. */
function sideFromDescription(handle: string, characters: string[]): ParsedSide {
  return {
    handle,
    characters,
    support: null,
    slotOrder: 'handle-outside',
    tieBroken: false,
    overlaps: [],
    residue: '',
    fromDescription: characters,
  };
}

// isMain, not a bare call: parseTitle/parseSide are exported so a control can
// exercise the orientation logic without running the pipeline.
const entry = process.argv[1];
const isMain = !!entry && import.meta.url.endsWith(entry.split('/').pop() ?? '');
if (isMain) main();
