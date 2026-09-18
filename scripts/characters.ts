/**
 * Build data/characters.json AND data/supports.json — the two registries.
 *
 * TWO NAMESPACES, ONE BUILD, AND THAT IS DELIBERATE. A support is not a
 * Character: it has no page, no portrait, no accent, no usage share and never
 * enters Side.characters. What it has that a Character does not is an OWNER, and
 * the pairing is a strict partition — measured across all 516 sides of the live
 * catalogue on 2026-09-18, every one of the 34 attested supports appears under
 * exactly one fighter. That invariant is only expressible while the two tables
 * are separate, and it is only ASSERTABLE while one script writes both.
 *
 * ── SOURCES, ALL THREE BINDING ────────────────────────────────────────────
 *
 * 1. ROSTER below: the twelve launch fighters, with the vendor's short display
 *    names, the paramountgames.com `fighters[].key` where the widget lists them,
 *    and the Steam achievement token for all twelve. Enumerated 2026-09-16 and
 *    re-verified live 2026-09-18 against both surfaces;
 *    `npx tsx scripts/roster.ts --scrape` re-runs that enumeration and
 *    `npm run data:roster-check` turns it into a verdict.
 *
 * 2. SUPPORTS below: thirty-four rows, every one carrying an index row id and a
 *    video as its evidence. THIRTY-SIX EXIST — the vendor's store copy reads
 *    "Choose from three support characters to accompany your fighter" and there
 *    are twelve fighters — and the two that are NOT here are not here on
 *    purpose. See the table's header.
 *
 * 3. design/handoff/tokens.css: the accents, read from its `--char-<id>` block.
 *    THE DESIGN TOKENS ARE THE SOURCE OF TRUTH. app/app.config.ts transcribes
 *    the same values for the engine, so this script reads BOTH and fails on any
 *    disagreement — a config that drifts from the tokens ships a fighter one
 *    colour on the character page and another on the chip, and nothing renders
 *    an error. Never invent an accent here; it comes from a Claude Design
 *    session.
 *
 * ── THE IDS ARE THE HANDOFF'S SHORT IDS, AND THAT REVERSES THE PRECEDENT ──
 * CotW and Strive both ship FULL-NAME kebab, measured against ComboForge's own
 * keys for those games. Measured on THIS game's partner entry the opposite
 * holds: ComboForge keys `ava` short (`ava-toph`, `ava-ozai`, `ava-kyoshi`),
 * short ids derive 10 of 12 links against full-name ids' 8, and the short forms
 * are also what the vendor's patch notes, the store achievements, the index
 * source and the design handoff all write. Checklist 11c is the rule that fell
 * out of it: measure the partner's convention per game, never inherit the prior.
 *
 * There is therefore NO TOKEN_FOR map. The handoff's `--char-*` tokens ARE the
 * roster ids, one to one, and the cross-check below asserts that in both
 * directions rather than describing it — which is the whole benefit of having
 * chosen the handoff's ids instead of translating them.
 *
 * ── THE DISPLAY NAME IS THE VENDOR'S SHORT FORM, NOT THE HANDOFF'S ────────
 * The handoff writes `Toph Beifong`, `Avatar Kyoshi`, `Fire Lord Ozai` and
 * `Avatar State Aang`. Every vendor surface writes `Toph`, `Kyoshi`, `Ozai` and
 * `Avatar Aang`: the paramountgames `fighters[].name` field, the Steam
 * achievement text, the Patch 2.5 notes ("[Gameplay] Avatar Aang: Final
 * Technique…"), the store news posts. So do the index source and ComboForge. The
 * long forms are carried as ALIASES, which is the same data in the same file
 * reached from the other direction — and the measurement that makes it
 * non-optional is that running versusFestival with the handoff's display names
 * ALONE resolves 4 of its 16 sides.
 *
 * `Avatar State Aang` is the one place the vendor contradicts itself: its own
 * 2026-07-16 announcement says "Avatar State Aang" and its own patch notes say
 * "Avatar Aang". Both are first-party, the shorter one is what the index and the
 * partner write, and the longer one is an alias. Neither is a typo.
 *
 * ── THE ALIAS TABLES ARE THE SHARED SEARCH AND PARSE VOCABULARY ───────────
 * The app's search and the pipeline's parser read the same lists, so a new
 * nickname is added once. Curation rules, in force below:
 *
 *  · The official name always appears (buildAliasMatcher prepends it).
 *  · SPELLINGS only, never spacing or punctuation variants. The matcher's
 *    FLEX_CLASS already covers them: one entry for `Fire Lord Ozai` matches
 *    `Firelord Ozai`, `FireLordOzai` and the glued hashtag `#firelordozai`; one
 *    for `Ming-Hua` matches `Ming Hua` and `MingHua`; one for `P'Li` matches
 *    `P'li`, `PLi` and `P Li`. Adding those as rows would be noise that hides
 *    the rows that matter. `Ran & Shaw` is the exception that proves it —
 *    `&` is NOT in the flexible class, so that spelling is a real alias and
 *    scripts/channels.ts carries it where it was measured.
 *  · CHANNEL-SCOPED SPELLINGS DO NOT APPEAR HERE. types/index.ts
 *    (ChannelAliases) makes that a rule rather than a habit: the app's search
 *    vocabulary and the parser's vocabulary are the same data on this platform,
 *    and a second copy of one alias makes them two. scripts/channels.ts already
 *    owns `Kiyoshi`→kyoshi (still:312, skeet:573, xcaliburBladez:992),
 *    `Norra`→nightmare-korra (still:315, rood:679), `A-State Aang` (still:316),
 *    `A.Aang` (phoenixWrong:1218), `Ozain` (rood:678), `Fire Lord Azula`
 *    (cow:491), and every short support form — `Boulder`, `Pakku`, `Yue`,
 *    `Hippo`, `Sozin`, `Twins`, `Zhao`, `Imperial`, `Pi li`, `Gyatt`. The task
 *    brief lists several of those as roster aliases; the COMMITTED CODE scopes
 *    them per channel and the code wins. Gate 6 below enforces the rule in both
 *    directions so the two files cannot quietly grow a second copy.
 *  · UPLOADER TYPOS live with the uploader. On Strive they are roster-wide
 *    because 107 of them came off one channel and the same misspelling recurs
 *    across the corpus. Here every measured typo is single-channel — `Kiyoshi`
 *    is 9 STiLL titles and 1 skeet title, `Ozain` is 2 rood titles — so a
 *    roster-wide row would widen the matcher for every channel to buy records on
 *    one.
 *
 * THE TOKENS THAT ARE DANGEROUS AND ARE CARRIED ANYWAY: `Aang` (inside `Avatar
 * Aang`), `Korra` (inside `Nightmare Korra`), `Katara` (a fighter AND a
 * support), `Mai`, `Yun`, `June`, `Momo`, `Suki`, `Naga`, `Roku` (three- and
 * four-letter support names). They are the characters' own names and the parser
 * cannot work without them. What protects the data is not omitting them — it is
 * the matcher's longest-first ordering, its boundary guards, the per-channel
 * slot order, the support-overlap review queue, and the registry guard at the
 * bottom of this file, which on this game covers BOTH namespaces.
 *
 * Run: npm run data:characters   (only when the roster changes — never in cron)
 */

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CHANNELS } from './channels';
import { blocksRosterBuild, dueExpiries, SUPPORTS_PER_FIGHTER, UNRELEASED } from './expiries';
import {
  aliasKey,
  buildAliasMatcher,
  buildSupportIndex,
  CONFIRMED_CHARACTER_NAMED_PLAYERS,
  normalizeText,
  playerId,
} from './roster';
import type { CharacterRecord, PlayerRecord, SupportRecord } from '../types/index';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TOKENS = join(ROOT, 'design/handoff/tokens.css');
const APP_CONFIG = join(ROOT, 'app/app.config.ts');
const PLAYERS = join(ROOT, 'data/players.json');
const OUT_CHARACTERS = join(ROOT, 'data/characters.json');
const OUT_SUPPORTS = join(ROOT, 'data/supports.json');

/** The vendor's own grouping. Four are `fighters[].element` on
 *  paramountgames.com; `avatar` is the handoff's fifth family for the two
 *  Avatar-State slots, which no vendor surface element-types at all — they are
 *  not benders of one element, and the handoff groups them under "Avatar /
 *  non-benders" beside the gated Ty Lee. types/index.ts documents this field as
 *  "Air / Water / Earth / Fire"; the committed data scaffold and tokens.css both
 *  carry five families, and the data wins. */
type Nation = 'air' | 'water' | 'earth' | 'fire' | 'avatar';

interface RosterEntry {
  id: string;
  /** The vendor's short display name. See the header. */
  name: string;
  /** `fighters[].key` on paramountgames.com. Present on the EIGHT the roster
   *  widget lists; absent on zaheer, ozai, avatar-aang and nightmare-korra,
   *  which the widget simply omits. An absent key is not a defect — it is why
   *  the Steam token below is the enumeration and this is only the control. */
  siteKey?: string;
  /** The `ach_match_won_<token>` suffix in Valve's public achievement schema.
   *  Present on ALL TWELVE, keyless, and the only complete machine-readable
   *  enumeration of this roster anywhere. Two are not derivable from the id and
   *  that is exactly why they are written down: `aang_avchar` and
   *  `korra_nightmare`. */
  steamToken: string;
  nation: Nation;
  /** ISO day the fighter became playable. All twelve shipped at launch. */
  released: string;
  aliases: string[];
}

/**
 * The twelve launch fighters. There is no thirteenth, and the five that are
 * announced are in UNRELEASED (scripts/expiries.ts) rather than here.
 *
 * THE COUNT IS STATED BY THE VENDOR IN THREE PLACES and enumerated in one:
 * "Choose from 12 playable characters" appears in the Steam, PlayStation and
 * Xbox store copy; the achievement schema carries twelve `ach_match_won_*` rows
 * plus an `ach_match_won_all` aggregate; and the index source's fighter column
 * holds exactly twelve distinct values across all 516 sides. The
 * paramountgames.com roster widget shows eight and is the odd one out — it is
 * first-party, it is incomplete, and a checker that treated it as the roster
 * would report four fighters as removed.
 *
 * `Avatar Aang` and `Nightmare Korra` ARE SEPARATE SLOTS, not modes, and four
 * independent surfaces say so: their own win achievements
 * (`ach_match_won_aang_avchar`, `ach_match_won_korra_nightmare`) alongside the
 * base fighters'; ComboForge's separate entries; the index's fighter column,
 * which carries Aang 32 / Avatar Aang 12 and Korra 53 / Nightmare Korra 15; and
 * their own support sets, which do not overlap their base fighters' at all.
 */
const ROSTER: RosterEntry[] = [
  // ── Air Nomads ───────────────────────────────────────────────────────────
  {
    id: 'aang',
    name: 'Aang',
    siteKey: 'aang',
    steamToken: 'aang',
    nation: 'air',
    released: '2026-07-23',
    // No alias. `Aang` lives inside `Avatar Aang`, and the ONLY thing keeping
    // the two apart is the matcher's longest-first ordering across the union —
    // there is no boundary guard that can help, because the inner span is
    // genuinely word-delimited. The positive control at the bottom of this file
    // is what turns that into a gate.
    aliases: [],
  },
  {
    id: 'zaheer',
    name: 'Zaheer',
    // Not in the paramountgames widget's fighters[]; his reveal is the vendor's
    // own YouTube "Zaheer Character Reveal Trailer" (sMzswxhSpgw, 2026-07-17).
    steamToken: 'zaheer',
    nation: 'air',
    released: '2026-07-23',
    aliases: [],
  },
  // ── Water Tribe ──────────────────────────────────────────────────────────
  {
    id: 'katara',
    name: 'Katara',
    siteKey: 'katara',
    steamToken: 'katara',
    nation: 'water',
    released: '2026-07-23',
    // `Katara` IS ALSO A SUPPORT NAME — Avatar Aang's, index row 482155. That is
    // not a collision to fix; it is the reason the two namespaces are typed.
    // Gate 7 asserts the overlap is present and resolvable in both directions,
    // because the day it silently stops being both is the day one of the two
    // tables lost a row.
    aliases: [],
  },
  {
    id: 'korra',
    name: 'Korra',
    siteKey: 'korra',
    steamToken: 'korra',
    nation: 'water',
    released: '2026-07-23',
    aliases: [],
  },
  {
    id: 'sokka',
    name: 'Sokka',
    siteKey: 'sokka',
    steamToken: 'sokka',
    nation: 'water',
    released: '2026-07-23',
    aliases: [],
  },
  // ── Earth Kingdom ────────────────────────────────────────────────────────
  {
    id: 'toph',
    name: 'Toph',
    siteKey: 'toph',
    steamToken: 'toph',
    nation: 'earth',
    released: '2026-07-23',
    // The handoff's display name, and the wiki's. Covers `TophBeifong` and
    // `Toph-Beifong` through FLEX_CLASS. Bare `Beifong` is banned: the gated
    // Lin Beifong makes the surname ambiguous the day she ships.
    aliases: ['Toph Beifong'],
  },
  {
    id: 'kyoshi',
    name: 'Kyoshi',
    siteKey: 'kyoshi',
    steamToken: 'kyoshi',
    nation: 'earth',
    released: '2026-07-23',
    // The handoff's display name; also the vendor's own image alt text on
    // paramountgames.com ("Avatar Kyoshi with war fans…"), which is why it is a
    // roster alias and not a handoff artefact.
    aliases: ['Avatar Kyoshi'],
  },
  // ── Fire Nation ──────────────────────────────────────────────────────────
  {
    id: 'zuko',
    name: 'Zuko',
    siteKey: 'zuko',
    steamToken: 'zuko',
    nation: 'fire',
    released: '2026-07-23',
    aliases: [],
  },
  {
    id: 'azula',
    name: 'Azula',
    siteKey: 'azula',
    steamToken: 'azula',
    nation: 'fire',
    released: '2026-07-23',
    // `Fire Lord Azula` / `Firelord Azula` is NOT here. It is a MODE on Azula —
    // paramountgames describes her as having "Focus and Fire Lord modes" — and
    // it is written by exactly one channel, so scripts/channels.ts:491 carries
    // it where it was measured. Roster-wide it would collide head-on with the
    // ozai alias below.
    aliases: [],
  },
  {
    id: 'ozai',
    name: 'Ozai',
    // Not in the widget's fighters[]; the vendor's 2026-07-16 announcement and
    // the "Ozai Reimagined" news post of 2026-09-03 are where the name is.
    steamToken: 'ozai',
    nation: 'fire',
    released: '2026-07-23',
    // ONE SPELLING, NOT TWO. `Fire Lord Ozai` is the handoff's display name;
    // compiled through FLEX_CLASS it already matches `Firelord Ozai` (EventHubs,
    // and two channels' titles), `FireLordOzai` and `#firelordozai`. Adding the
    // glued form as a second row would violate the spellings-only rule and hide
    // the one thing this entry has to say, which is the BAN below it.
    aliases: ['Fire Lord Ozai'],
  },
  // ── Avatar State slots ───────────────────────────────────────────────────
  {
    id: 'avatar-aang',
    name: 'Avatar Aang',
    steamToken: 'aang_avchar',
    nation: 'avatar',
    released: '2026-07-23',
    // The vendor's OTHER first-party spelling, from its 2026-07-16 announcement
    // ("First previews of Ozai, Avatar State Aang, and Nightmare Korra") and the
    // design handoff. Both are the vendor's; the shorter one ships because the
    // index and ComboForge write it.
    aliases: ['Avatar State Aang'],
  },
  {
    id: 'nightmare-korra',
    name: 'Nightmare Korra',
    steamToken: 'korra_nightmare',
    nation: 'avatar',
    released: '2026-07-23',
    // `Avatar State Korra` IS DELIBERATELY ABSENT. ComboForge keys this slot
    // `ava-avatar-state-korra` (named "Nightmare Korra" — a stale id they never
    // re-keyed) and EventHubs writes it in prose, so it is attested. It is out
    // because no ADMITTED channel writes it, and the one channel that does
    // (Chickensea1, rejected — 381 marked / 0 parsed) writes "AVATAR STATE
    // KORRA" in hype prose where the reading is genuinely ambiguous between this
    // slot and base Korra using her Avatar State. An alias that buys zero
    // records and resolves an ambiguous span silently is a mint target.
    aliases: [],
  },
];

/**
 * The SUPPORT registry — the second namespace.
 *
 * THIRTY-FOUR ROWS AGAINST THIRTY-SIX EXPECTED, AND THE TWO GAPS ARE REAL
 * MEASUREMENTS RATHER THAN MISSING WORK. The vendor states the shape — "Choose
 * from three support characters to accompany your fighter", twelve fighters — so
 * 36 exist. A full sweep of the index on 2026-09-18 (6 pages, 258 rows, 516
 * sides, every side's support column populated) yields exactly 34 distinct
 * names, and the shortfall is one row each under `katara` and `avatar-aang`.
 *
 * THE TWO CANDIDATES ARE KNOWN AND ARE NOT HERE:
 *   · `Hakoda` (Katara's third) — STiLL writes it in two titles (SfssLFrqiS8,
 *     y4AGEJOEPfY), spells it "Hikoda" in a description, and HoneyBeeCMNDR
 *     writes "Hakoda Support" in a description on a Katara video (x8r1DZfZE_E).
 *     Four attestations across two channels, and ZERO index rows in 258.
 *   · `Guru Pathik` (Avatar Aang's third) — the community wiki's table only.
 *     Zero attestations anywhere in the corpus.
 * Both are in BANNED_ALIASES. A support nobody has verified is a support nobody
 * should be able to parse into a record: the alias would fire on the four
 * `Hakoda` spans and mint a support id that no index row has ever confirmed,
 * and the same table would then be quoted as the evidence. Left out, those four
 * spans reach the residue gate as a counted line — which is the detector — and
 * scripts/expiries.ts carries an 'unreleased-support' row that stays due until
 * the table reaches three per fighter.
 *
 * SPELLINGS ARE THE INDEX'S, NOT THE BRIEF'S, and the difference is not
 * academic: the brief writes `Boulder`, `Pakku`, `Ming Hua`, `Ran & Shaw`,
 * `Sozin`, `Yue` where the index writes `The Boulder`, `Master Pakku`,
 * `Ming-Hua`, `Ran and Shaw`, `Firelord Sozin`, `Princess Yue`. The crosscheck
 * witness compares by EXACT alias — one span covering the whole string — so a
 * table holding only `Pakku` does not resolve `Master Pakku` and the index
 * agreeing with us reads as the index disagreeing with us. The short forms are
 * per-channel aliases in scripts/channels.ts, where they were measured.
 *
 * EVERY ROW CARRIES AN INDEX ROW ID AND THE VIDEO IT POINTS AT. That is the
 * claim being made: this name appeared in the support column of a real match,
 * under this fighter. `owner` is asserted the same way — the partition held on
 * 516 of 516 sides, so a second owner for any of these is a data change, not a
 * rare pick.
 *
 * THE COMMUNITY WIKI IS USED FOR ALTERNATE SPELLINGS ONLY, NEVER FOR A ROW.
 * Two rows below carry a wiki spelling as an alias (`Avatar Roku`, `Admiral
 * Zhao`) because the wiki and the game disagree about a title word; neither row
 * EXISTS because of the wiki. `Commander Bumi`, which the brief lists as a
 * support, appears in zero of 258 index rows and is banned below.
 */
interface SupportEntry {
  id: string;
  name: string;
  owner: string;
  aliases: string[];
  /** Index row id and the video it points at — the evidence for the row AND for
   *  its owner. Measured 2026-09-18. */
  evidence: string;
  /** How many of the 516 sides named it. Not load-bearing; it is how a row that
   *  stops appearing becomes visible. */
  sides: number;
}

const SUPPORTS: SupportEntry[] = [
  // ── Aang ─────────────────────────────────────────────────────────────────
  {
    id: 'gyatso',
    name: 'Gyatso',
    owner: 'aang',
    aliases: [],
    evidence: 'rt:497092 tUherLv8z5U',
    sides: 19,
  },
  {
    id: 'appa',
    name: 'Appa',
    owner: 'aang',
    aliases: [],
    evidence: 'rt:495990 fugKMBbwfAg',
    sides: 9,
  },
  {
    id: 'momo',
    name: 'Momo',
    owner: 'aang',
    aliases: [],
    evidence: 'rt:496822 0ieOuTRrs3w',
    sides: 5,
  },
  // ── Katara (TWO of three; see the header) ────────────────────────────────
  {
    id: 'master-pakku',
    name: 'Master Pakku',
    owner: 'katara',
    aliases: [],
    evidence: 'rt:489352 vwFi8BZyU_U',
    sides: 35,
  },
  {
    id: 'kanna',
    name: 'Kanna',
    owner: 'katara',
    aliases: [],
    evidence: 'rt:497250 RJUowOrwAEA',
    sides: 33,
  },
  // ── Zuko ─────────────────────────────────────────────────────────────────
  {
    id: 'mai',
    name: 'Mai',
    owner: 'zuko',
    aliases: [],
    evidence: 'rt:496580 e-MSKn-yyAQ',
    sides: 6,
  },
  {
    id: 'june',
    name: 'June',
    owner: 'zuko',
    aliases: [],
    evidence: 'rt:487717 JD4PIqUOK1A',
    sides: 3,
  },
  {
    id: 'ran-and-shaw',
    name: 'Ran and Shaw',
    owner: 'zuko',
    // `Ran & Shaw` is NOT here: `&` is outside the matcher's flexible class on
    // purpose (see roster.ts FLEXIBLE), so the ampersand spelling is a real
    // alias — and it is one channel's, carried at scripts/channels.ts:722.
    aliases: [],
    evidence: 'rt:497256 dkd1JOCY_FI',
    sides: 4,
  },
  // ── Toph ─────────────────────────────────────────────────────────────────
  {
    id: 'badgermole',
    name: 'Badgermole',
    owner: 'toph',
    aliases: [],
    evidence: 'rt:496767 G7XOMdh7Xe0',
    sides: 24,
  },
  {
    id: 'the-boulder',
    name: 'The Boulder',
    owner: 'toph',
    // Bare `Boulder` is banned roster-wide and scoped to the four channels that
    // write it. It is a common noun and a move name — Chickensea1 titles
    // "MEET THE BOULDER!", "BOULDER POWER!", "DODGED THE BOULDER!" are prose
    // about a rock on a channel with no handles at all.
    aliases: [],
    evidence: 'rt:497092 tUherLv8z5U',
    sides: 19,
  },
  {
    id: 'the-hippo',
    name: 'The Hippo',
    owner: 'toph',
    aliases: [],
    evidence: 'rt:496771 G7XOMdh7Xe0',
    sides: 14,
  },
  // ── Korra ────────────────────────────────────────────────────────────────
  {
    id: 'naga',
    name: 'Naga',
    owner: 'korra',
    aliases: [],
    evidence: 'rt:497098 XQbpwbO6D8U',
    sides: 59,
  },
  {
    id: 'raava',
    name: 'Raava',
    owner: 'korra',
    aliases: [],
    evidence: 'rt:487712 JD4PIqUOK1A',
    sides: 5,
  },
  {
    id: 'tonraq',
    name: 'Tonraq',
    owner: 'korra',
    aliases: [],
    evidence: 'rt:496765 G7XOMdh7Xe0',
    sides: 4,
  },
  // ── Sokka ────────────────────────────────────────────────────────────────
  {
    id: 'princess-yue',
    name: 'Princess Yue',
    owner: 'sokka',
    // The vendor's own Patch 2.5 notes write the bare `Yue` ("Sokka: Support
    // characters Suki and Yue…"), which makes it a first-party roster-wide
    // candidate rather than a channel quirk. It is NOT added here because
    // scripts/channels.ts already carries it on four channels (:489, :574,
    // :1243, :1271) and the no-duplication rule is the contract. Move it here
    // and delete those four in the same commit, or leave it alone.
    aliases: [],
    evidence: 'rt:497097 XQbpwbO6D8U',
    sides: 17,
  },
  {
    id: 'suki',
    name: 'Suki',
    owner: 'sokka',
    aliases: [],
    evidence: 'rt:497094 XQbpwbO6D8U',
    sides: 6,
  },
  {
    id: 'master-piandao',
    name: 'Master Piandao',
    owner: 'sokka',
    // ONE SIDE, AND IT IS NEW. Stage 0's 2026-09-16 sweep found 231 rows with no
    // Piandao at all and recorded Sokka as two-of-three; the 2026-09-18 sweep
    // has it once, on row 497093. That is the catalogue growing, and it is the
    // reason the two remaining gaps are an expiry rather than a conclusion.
    aliases: [],
    evidence: 'rt:497093 XQbpwbO6D8U',
    sides: 1,
  },
  // ── Azula ────────────────────────────────────────────────────────────────
  {
    id: 'ursa',
    name: 'Ursa',
    owner: 'azula',
    aliases: [],
    evidence: 'rt:497095 XQbpwbO6D8U',
    sides: 37,
  },
  {
    id: 'lo-and-li',
    name: 'Lo and Li',
    owner: 'azula',
    aliases: [],
    evidence: 'rt:488651 nGFWTSg41Iw',
    sides: 23,
  },
  {
    id: 'joo-dee',
    name: 'Joo Dee',
    owner: 'azula',
    aliases: [],
    evidence: 'rt:489349 vwFi8BZyU_U',
    sides: 3,
  },
  // ── Kyoshi ───────────────────────────────────────────────────────────────
  {
    id: 'rangi',
    name: 'Rangi',
    owner: 'kyoshi',
    aliases: [],
    evidence: 'rt:497249 RJUowOrwAEA',
    sides: 27,
  },
  {
    id: 'yun',
    name: 'Yun',
    owner: 'kyoshi',
    aliases: [],
    evidence: 'rt:497096 XQbpwbO6D8U',
    sides: 14,
  },
  {
    id: 'kelsang',
    name: 'Kelsang',
    owner: 'kyoshi',
    aliases: [],
    evidence: 'rt:496769 G7XOMdh7Xe0',
    sides: 14,
  },
  // ── Zaheer ───────────────────────────────────────────────────────────────
  {
    id: 'ming-hua',
    name: 'Ming-Hua',
    owner: 'zaheer',
    // `Ming Hua` (the brief's and the wiki's spelling) needs no row: the hyphen
    // is in the matcher's flexible class, so one entry covers both.
    aliases: [],
    evidence: 'rt:497094 XQbpwbO6D8U',
    sides: 24,
  },
  {
    id: 'ghazan',
    name: 'Ghazan',
    owner: 'zaheer',
    aliases: [],
    evidence: 'rt:497103 XQbpwbO6D8U',
    sides: 21,
  },
  {
    // THE APOSTROPHE IS IN THE ID, and that is not a slip. scripts/channels.ts
    // already keys this support `"p'li"` (:811) and a config key that does not
    // match the registry id is a channel alias that silently belongs to nothing.
    // Support ids are never routed — supports have no pages — so the character
    // that would break a URL costs nothing here.
    id: "p'li",
    name: "P'Li",
    // `P'li`, `PLi`, `P Li` and `P-Li` all reach this row through FLEX_CLASS.
    // `Pi li` does not (it has an extra letter) and is channels.ts:811's.
    aliases: [],
    owner: 'zaheer',
    evidence: 'rt:496772 G7XOMdh7Xe0',
    sides: 18,
  },
  // ── Ozai ─────────────────────────────────────────────────────────────────
  {
    id: 'imperial-firebender',
    name: 'Imperial Firebender',
    owner: 'ozai',
    aliases: [],
    evidence: 'rt:497101 XQbpwbO6D8U',
    sides: 27,
  },
  {
    id: 'general-zhao',
    name: 'General Zhao',
    owner: 'ozai',
    // The community wiki's table calls him "Admiral Zhao" where the game calls
    // him General. Carried so third-party text resolves to the row the index
    // evidenced — the row exists because of row 497093, not because of the wiki.
    aliases: ['Admiral Zhao'],
    evidence: 'rt:497093 XQbpwbO6D8U',
    sides: 12,
  },
  {
    id: 'firelord-sozin',
    name: 'Firelord Sozin',
    owner: 'ozai',
    // THE ROW THAT MAKES THE OZAI BAN NECESSARY. See BANNED_ALIASES 'firelord'.
    aliases: [],
    evidence: 'rt:496296 CYR9YnnIZ-c',
    sides: 6,
  },
  // ── Avatar Aang (TWO of three; see the header) ───────────────────────────
  {
    id: 'roku',
    name: 'Roku',
    owner: 'avatar-aang',
    // The wiki writes "Avatar Roku"; the game writes "Roku". Carried so the
    // longer spelling resolves as one span instead of leaving "Avatar" — the
    // word this game's marker rules spend three paragraphs on — in the residue.
    aliases: ['Avatar Roku'],
    evidence: 'rt:496966 4MvmxEM16yY',
    sides: 11,
  },
  {
    // THE NAMESPACE OVERLAP, AS A ROW. Same string as the fighter `katara`,
    // different table, different owner. types/index.ts SupportRecord says a
    // support id and a character id may coincide and that this is not an error;
    // this is the row it means.
    id: 'katara',
    name: 'Katara',
    owner: 'avatar-aang',
    aliases: [],
    evidence: 'rt:482155 GmU3e6jvpcI@582',
    sides: 1,
  },
  // ── Nightmare Korra ──────────────────────────────────────────────────────
  {
    id: 'dark-avatar-unalaq',
    name: 'Dark Avatar Unalaq',
    owner: 'nightmare-korra',
    // Contains the word "Avatar", which is one more reason bare 'Avatar' is not
    // a game marker (types/index.ts GateMode). Bare `Unalaq` is written once, by
    // rood, and scripts/channels.ts does not carry it — so that span is residue
    // today. Recorded rather than fixed here: a short form belongs to the
    // channel that writes it.
    aliases: [],
    evidence: 'rt:495994 fugKMBbwfAg',
    sides: 7,
  },
  {
    id: 'dark-spirit',
    name: 'Dark Spirit',
    owner: 'nightmare-korra',
    aliases: [],
    evidence: 'rt:496767 G7XOMdh7Xe0',
    sides: 5,
  },
  {
    id: 'vaatu',
    name: 'Vaatu',
    owner: 'nightmare-korra',
    aliases: [],
    evidence: 'rt:481906 PjBAU9AUd-o',
    sides: 3,
  },
];

/**
 * Aliases that must STAY rejected, keyed the way the matcher keys them
 * (roster.ts aliasKey: normalized, lowercased, letters and digits only).
 *
 * Written as an assertion rather than a comment, because the comment is what a
 * future edit deletes. Each one names the failure it prevents, and the entries
 * are checked against BOTH namespaces — the support table is exactly as easy to
 * widen by accident as the fighter table, and one of the traps below is a
 * support name eating a fighter.
 */
const BANNED_ALIASES: { key: string; why: string }[] = [
  {
    // aliasKey('Fire Lord') === aliasKey('Firelord') === 'firelord', so this one
    // key bans both spellings.
    key: 'firelord',
    why:
      'THE MEASURED TRAP. The support `Firelord Sozin` is a real row (ozai, index row 496296). ' +
      'Compiled through FLEX_CLASS a bare `Fire Lord` matches the `Firelord` inside it and the ' +
      'trailing boundary guard passes, because the next character is a space — so in any pass ' +
      "that runs the fighter vocabulary alone over a bracket, Ozai's own support resolves to " +
      'Ozai. Separately, Elite Videogames writes `Azula Fire Lord` / `Azula Firelord` for a MODE ' +
      'on Azula, which would then resolve two fighters on one side. The full `Fire Lord Ozai` is ' +
      'safe and is carried; the bare title is not.',
  },
  {
    key: 'beifong',
    why: 'two Beifongs — Toph today and the announced Lin Beifong. A bare surname resolves to a coin flip the day she ships, and the roster is where that is decided, not later.',
  },
  {
    key: 'avatar',
    why: "the game marker, refused everywhere but toledoLocals' bracketed game slot (types/index.ts GateMode). It also sits inside the support names `Dark Avatar Unalaq` and `Avatar Roku` and inside two roster aliases, so as an alias it would fire on half the corpus.",
  },
  {
    key: 'darkavatar',
    why: '"The Dark Avatar" is used in one title as a nickname — on a row whose support is Vaatu, not Dark Avatar Unalaq. Two common words, one of them the banned marker, pointing at the wrong row.',
  },
  {
    key: 'aaang',
    why: 'UNRESOLVED between `aang` and `avatar-aang` and it must not be guessed. It occurs zero times on every admitted channel, so nothing in the corpus decides it; `A.Aang` is scoped to phoenixWrong (channels.ts:1218) and compiled so it cannot also match this.',
  },
  {
    key: 'hakoda',
    why: "the leading candidate for Katara's missing third support, attested in two STiLL titles and one HoneyBeeCMNDR description and in ZERO of 258 index rows. Minting it here would make this file the evidence for its own guess. Leave it banned, let the residue gate count it, and clear the `unreleased-support` expiry by evidencing it in the index.",
  },
  {
    key: 'gurupathik',
    why: "the community wiki's candidate for Avatar Aang's missing third support, with zero attestations anywhere in the corpus and zero index rows. Same rule as `hakoda`.",
  },
  {
    key: 'commanderbumi',
    why: 'listed as a support by the task brief and present in zero of 258 index rows. The vendor\'s Patch 2.5 renames "Bumi (Son)" to "Commander Bumi" under a [Gallery] heading, i.e. a gallery label rather than a roster or support row.',
  },
  {
    key: 'kora',
    why: 'proposed off one KELSO2TIMES title ("These Kora Players are Either Carried or Scary"), which buys zero records — it has no opponent and no handle. A four-letter common-word-shaped token that widens the matcher for nothing.',
  },
  {
    key: 'zula',
    why: 'observed once (zeto_r2 U9pcng7f92k) as a typo for Azula and refused there, because it is also a perfectly plausible handle and one occurrence is not a pattern.',
  },
  {
    key: 'boulder',
    why: 'a common noun and a move name before it is a support. Chickensea1 writes "MEET THE BOULDER!", "BOULDER POWER!" and "DODGED THE BOULDER!" as prose. Scoped to the four channels that write it as a name (channels.ts:486, :723, :810, :876).',
  },
  {
    key: 'melonlord',
    why: 'a fan epithet used for Toph on one channel and as bare prose on another, and the vendor never writes it. Two common words and a disputed referent.',
  },
  // Two-letter pair codes, refused as a class. saltyRecoveryCenter writes
  // KO/OZ/ZU/ZA as a bracket-filling pair list and channels.ts carries that as a
  // per-channel `pairCodes` mechanism precisely so they never become aliases.
  { key: 'ko', why: 'pair code, and "KO" is a knockout in every fighting-game corpus there is.' },
  { key: 'oz', why: 'pair code; two letters cannot be told from a team tag.' },
  { key: 'zu', why: 'pair code.' },
  { key: 'za', why: 'pair code.' },
];

/** The id derivation, applied to the vendor's own display name. Asserted
 *  against every row rather than described, so a hand-typed id cannot drift
 *  from the rule. Both registries use it; the support ids derive too, with the
 *  single documented exception of `p'li`, whose apostrophe is load-bearing
 *  because scripts/channels.ts keys it that way. */
const kebab = (name: string): string =>
  normalizeText(name)
    .toLowerCase()
    .replace(/[\s_\-=]+/g, '-')
    .replace(/[.?']/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

/** Read the `--char-<id>: #hex;` block out of the design handoff. */
async function readTokenAccents(): Promise<Map<string, string>> {
  const css = await readFile(TOKENS, 'utf8');
  const out = new Map<string, string>();
  for (const m of css.matchAll(/--char-([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})\s*;/g)) {
    out.set(m[1]!, m[2]!.toUpperCase());
  }
  return out;
}

/**
 * Read the `accents: { … }` block out of app/app.config.ts, AS TEXT.
 *
 * Not imported, and that is not laziness: app.config.ts calls Nuxt's
 * `defineAppConfig` and imports `@engine/types`, neither of which resolves
 * outside the Nuxt graph, so a pipeline script that imports it needs jiti and a
 * build cache to read twenty hex strings. The reference repos solve the same
 * problem by not checking config against tokens at all, which is how the two
 * drift. Reading the literal block is exact, offline, and fails loudly if
 * someone reformats it — which is the correct failure, because a config whose
 * accents cannot be located is a config whose accents cannot be trusted.
 */
async function readConfigAccents(): Promise<Map<string, string>> {
  const src = await readFile(APP_CONFIG, 'utf8');
  const start = src.indexOf('accents: {');
  if (start < 0) throw new Error(`no \`accents: {\` block in ${APP_CONFIG}`);
  let depth = 0;
  let end = start;
  for (let i = src.indexOf('{', start); i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) {
      end = i;
      break;
    }
  }
  const block = src.slice(start, end);
  const out = new Map<string, string>();
  for (const m of block.matchAll(/'?([a-z0-9-]+)'?:\s*'(#[0-9A-Fa-f]{6})'/g)) {
    out.set(m[1]!, m[2]!.toUpperCase());
  }
  return out;
}

/** data/players.json, or [] before the first parse has produced one. */
async function readPlayers(): Promise<PlayerRecord[]> {
  try {
    return JSON.parse(await readFile(PLAYERS, 'utf8')) as PlayerRecord[];
  } catch {
    return [];
  }
}

/** WCAG relative luminance / contrast, so the AA floor is asserted rather than
 *  trusted. The handoff states a ratio per accent; this recomputes it. */
const SURFACE = '#1D1A16';
const lum = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
  const f = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (a: string, b: string): number => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

async function main(): Promise<void> {
  const errs: string[] = [];
  const warns: string[] = [];

  // A manual roster run is the RIGHT place for a hard stop — it is not the cron
  // and nobody is blocked by it — but ONLY for the rows this rebuild would bake
  // in WRONG. `blocksRosterBuild` owns that grading in scripts/expiries.ts,
  // beside the triggers it grades, so there is one definition of "this blocks".
  //
  // The two that do NOT block are the ones a stop would only make worse:
  //   'dormant-channel'    fires on an uploader going quiet, which says nothing
  //                        about whether the roster is right.
  //   'unreleased-support' is a STANDING gap — 34 of 36 evidenced — and blocking
  //                        on it would make the registries unbuildable until a
  //                        third party prints a name we do not control.
  //   the REVIEW trigger   is a look-again date, not a roster fact.
  const due = await dueExpiries();
  const blocking = due.filter(blocksRosterBuild);
  for (const d of due.filter((d) => !blocksRosterBuild(d))) {
    warns.push(`${d.id} (${d.kind}, due ${d.date}) — ${d.action.split('. ')[0]}.`);
  }
  if (blocking.length) {
    console.error(
      `✖ ${blocking.length} roster expiry(s) due — resolve them before rebuilding the roster:\n`,
    );
    for (const d of blocking)
      console.error(`  ${d.id} (${d.kind}, due ${d.date})\n    ${d.action}\n`);
    process.exit(1);
  }

  const tokenAccents = await readTokenAccents();
  const configAccents = await readConfigAccents();

  // 1. Every id derives from its own name. No exception table, so none can rot.
  for (const c of ROSTER) {
    const want = kebab(c.name);
    if (c.id !== want) {
      errs.push(`${c.id}: name "${c.name}" derives the id "${want}" — one of the two is wrong`);
    }
  }
  for (const s of SUPPORTS) {
    // `p'li` is the one id that does not derive, because channels.ts:811 keys it
    // with the apostrophe and a config key that misses the registry is silent.
    const want = s.id === "p'li" ? s.id : kebab(s.name);
    if (s.id !== want) {
      errs.push(`support ${s.id}: name "${s.name}" derives the id "${want}"`);
    }
  }

  // 2. Ids, names and vendor keys are unique WITHIN each registry. Across the
  //    two they may collide, and one does: `katara`. That is the design.
  const fighterIds = new Set<string>();
  const seenName = new Map<string, string>();
  const seenSiteKey = new Map<string, string>();
  const seenSteamToken = new Map<string, string>();
  for (const c of ROSTER) {
    if (fighterIds.has(c.id)) errs.push(`duplicate roster id ${c.id}`);
    fighterIds.add(c.id);
    const nameOwner = seenName.get(c.name.toLowerCase());
    if (nameOwner) errs.push(`name "${c.name}" claimed by both ${nameOwner} and ${c.id}`);
    seenName.set(c.name.toLowerCase(), c.id);
    if (c.siteKey) {
      const owner = seenSiteKey.get(c.siteKey);
      if (owner) errs.push(`siteKey "${c.siteKey}" claimed by both ${owner} and ${c.id}`);
      seenSiteKey.set(c.siteKey, c.id);
    }
    const tokenOwner = seenSteamToken.get(c.steamToken);
    if (tokenOwner)
      errs.push(`steamToken "${c.steamToken}" claimed by both ${tokenOwner} and ${c.id}`);
    seenSteamToken.set(c.steamToken, c.id);
  }
  const supportIds = new Set<string>();
  for (const s of SUPPORTS) {
    if (supportIds.has(s.id)) errs.push(`duplicate support id ${s.id}`);
    supportIds.add(s.id);
  }

  // 3. THE SUPPORT PARTITION, BOTH DIRECTIONS.
  //    Every support's owner is a released fighter, and every released fighter
  //    owns at most the three the vendor says exist. Fewer than three is not an
  //    error here — two fighters are genuinely short and scripts/expiries.ts
  //    carries that as a due row — but MORE than three means a name was filed
  //    under the wrong fighter, which is the failure the partition exists to
  //    catch.
  const owned = new Map<string, string[]>();
  for (const s of SUPPORTS) {
    if (!fighterIds.has(s.owner)) {
      errs.push(`support ${s.id}: owner "${s.owner}" is not a roster id`);
      continue;
    }
    owned.set(s.owner, [...(owned.get(s.owner) ?? []), s.id]);
  }
  for (const [fighter, list] of owned) {
    if (list.length > SUPPORTS_PER_FIGHTER) {
      errs.push(
        `${fighter} owns ${list.length} supports (${list.join(', ')}) and the vendor states ` +
          `${SUPPORTS_PER_FIGHTER} — one of these belongs to another fighter`,
      );
    }
  }
  for (const c of ROSTER) {
    if (!owned.has(c.id)) {
      errs.push(
        `${c.id} owns no supports at all. Every side of this game picks one and the index states ` +
          `it on 100% of rows, so a fighter with an empty set is a table that lost its owner ` +
          `column, not a fighter without supports`,
      );
    }
  }

  // 4. THE DESIGN-TOKEN BRIDGE, BOTH DIRECTIONS AND BOTH FILES.
  //    A roster id with no token ships an unstyled fighter. A token nothing
  //    claims is either a typo or a fighter somebody forgot to add — except for
  //    the five tokens the handoff derived for the GATED fighters, which are
  //    supposed to sit there unclaimed until release day.
  const gated = new Map(UNRELEASED.map((u) => [u.id, u]));
  for (const c of ROSTER) {
    if (!tokenAccents.has(c.id)) {
      errs.push(`${c.id}: no --char-${c.id} in design/handoff/tokens.css`);
    }
    if (!configAccents.has(c.id)) {
      errs.push(`${c.id}: no accents.${c.id} in app/app.config.ts`);
    }
  }
  for (const [token, hex] of tokenAccents) {
    if (fighterIds.has(token)) continue;
    if (gated.has(token)) {
      if (gated.get(token)!.accent !== hex) {
        errs.push(
          `--char-${token} is ${hex} in tokens.css and ${gated.get(token)!.accent} in ` +
            `UNRELEASED (scripts/expiries.ts) — release day would ship the stale one`,
        );
      }
      continue;
    }
    errs.push(
      `design/handoff/tokens.css declares --char-${token} and nothing claims it — either a ` +
        `fighter is missing from ROSTER or the token is stale`,
    );
  }
  //    THE CONFIG/TOKENS CROSS-CHECK. tokens.css is the source of truth and
  //    app.config.ts is a transcription, so a disagreement is always the
  //    config's to fix — and it is invisible without this, because each file
  //    renders a perfectly good colour on its own surface.
  for (const [id, hex] of configAccents) {
    const token = tokenAccents.get(id);
    if (!token) {
      errs.push(`app/app.config.ts accents.${id} = ${hex} and tokens.css has no --char-${id}`);
    } else if (token !== hex) {
      errs.push(
        `accent drift on ${id}: tokens.css says ${token}, app/app.config.ts says ${hex}. ` +
          `tokens.css is the source of truth — fix the config`,
      );
    }
  }
  for (const [token] of tokenAccents) {
    if (!configAccents.has(token)) {
      errs.push(
        `design/handoff/tokens.css declares --char-${token} and app/app.config.ts does not ` +
          `carry it — the engine would render that fighter with no accent`,
      );
    }
  }

  // 5. An announced-but-unreleased fighter must never reach the roster.
  for (const u of UNRELEASED) {
    if (fighterIds.has(u.id)) errs.push(`${u.id} is in ROSTER and in UNRELEASED — pick one`);
  }

  // 6. ALIASES ARE UNIQUE WITHIN A NAMESPACE, keyed the way the MATCHER keys
  //    them. A validator with its own normalisation passes while the matcher
  //    collides. ACROSS namespaces a collision is legal and expected — `katara`
  //    is the one that exists — so the two tables are keyed separately and the
  //    crossing is counted rather than refused.
  const fighterAliasOwner = new Map<string, string>();
  const supportAliasOwner = new Map<string, string>();
  const collect = (
    into: Map<string, string>,
    id: string,
    label: string,
    spellings: string[],
  ): void => {
    for (const a of spellings) {
      const k = aliasKey(a);
      if (!k) {
        errs.push(
          `${label} ${id}: alias "${a}" has no letters or digits — it would compile to a ` +
            `zero-width pattern and spin the scan`,
        );
        continue;
      }
      const owner = into.get(k);
      if (owner && owner !== id) {
        errs.push(`${label} alias "${a}" claimed by both ${owner} and ${id}`);
      }
      into.set(k, id);
    }
  };
  for (const c of ROSTER) collect(fighterAliasOwner, c.id, 'fighter', [c.name, ...c.aliases]);
  for (const s of SUPPORTS) collect(supportAliasOwner, s.id, 'support', [s.name, ...s.aliases]);

  // 7. The banned list, over BOTH namespaces.
  for (const b of BANNED_ALIASES) {
    const owner = fighterAliasOwner.get(b.key) ?? supportAliasOwner.get(b.key);
    if (owner) errs.push(`"${b.key}" is a BANNED alias but ${owner} claims it — ${b.why}`);
  }

  // 8. NO CHANNEL-SCOPED ALIAS MAY RESTATE A ROSTER-WIDE ONE (types/index.ts,
  //    ChannelAliases). The two grades are graded differently on purpose:
  //      · resolving to a DIFFERENT id is a silent mis-resolution and an error;
  //      · resolving to the SAME id is redundancy — harmless to the parse,
  //        fatal to the single-source rule the moment one copy is edited.
  //    This is the only place both files are visible at once.
  for (const ch of CHANNELS) {
    for (const [id, spellings] of Object.entries(ch.aliases?.fighters ?? {})) {
      for (const a of spellings) {
        const owner = fighterAliasOwner.get(aliasKey(a));
        if (owner && owner !== id) {
          errs.push(
            `channel ${ch.id}: fighter alias "${a}" → ${id}, but the roster already resolves it ` +
              `to ${owner}. One of the two is wrong and the parse will not say which`,
          );
        } else if (owner === id) {
          warns.push(
            `channel ${ch.id}: fighter alias "${a}" → ${id} duplicates the roster's own ` +
              `spelling. Drop it from scripts/channels.ts — one vocabulary, one file`,
          );
        }
      }
    }
    for (const [id, spellings] of Object.entries(ch.aliases?.supports ?? {})) {
      if (!supportIds.has(id)) {
        errs.push(
          `channel ${ch.id}: support alias block keys "${id}", which is not a data/supports.json ` +
            `id — those spellings resolve to nothing`,
        );
        continue;
      }
      for (const a of spellings) {
        const owner = supportAliasOwner.get(aliasKey(a));
        if (owner && owner !== id) {
          errs.push(
            `channel ${ch.id}: support alias "${a}" → ${id}, but the roster already resolves it ` +
              `to ${owner}`,
          );
        } else if (owner === id) {
          warns.push(
            `channel ${ch.id}: support alias "${a}" → ${id} duplicates the roster's own spelling.`,
          );
        }
      }
    }
  }

  // 9. The AA floor, recomputed rather than trusted.
  for (const c of ROSTER) {
    const hex = tokenAccents.get(c.id);
    if (!hex) continue;
    const ratio = contrast(hex, SURFACE);
    if (ratio < 4.5) {
      errs.push(`${c.id}: accent ${hex} is ${ratio.toFixed(2)}:1 on ${SURFACE} (<4.5)`);
    }
  }

  const characters: CharacterRecord[] = ROSTER.map((c) => ({
    id: c.id,
    name: c.name,
    // PORTRAIT ONLY, AND NO SPLASH. Every tile on this game is GENERATED
    // (scripts/art.ts) because the rights holder prohibits reuse of its art
    // outright and publishes no fan kit, so there is no second art size to ship
    // and an imgSplash path would point at a file nobody can make.
    imgPortrait: `/img/char/${c.id}.webp`,
    accent: tokenAccents.get(c.id) ?? '#000000',
    extra: {
      aliases: c.aliases,
      nation: c.nation,
      released: c.released,
      steamToken: c.steamToken,
      ...(c.siteKey ? { siteKey: c.siteKey } : {}),
      // The support ids this fighter owns, denormalised onto the fighter so the
      // app can render the badge without loading and inverting the second
      // registry. scripts/emit.ts reads supports.json; the app reads this.
      supports: (owned.get(c.id) ?? []).slice().sort(),
    },
  }));

  const supports: SupportRecord[] = SUPPORTS.map((s) => ({
    id: s.id,
    name: s.name,
    owner: s.owner,
    aliases: s.aliases,
  }));

  // 10. POSITIVE CONTROL ON THE MATCHER ITSELF.
  //     Every name and every alias must resolve to its OWN row in its OWN
  //     namespace. This is what catches a longest-first regression: without the
  //     ordering `Aang` wins inside `Avatar Aang` and `Korra` inside `Nightmare
  //     Korra`, and nothing else in this file would notice.
  const matcher = buildAliasMatcher(characters, supports);
  for (const c of ROSTER) {
    for (const a of [c.name, ...c.aliases]) {
      const got = matcher.one(a, 'fighter');
      if (got !== c.id) {
        errs.push(
          `matcher: fighter "${a}" should resolve to ${c.id} and resolves to ${got ?? 'nothing'}`,
        );
      }
    }
  }
  for (const s of SUPPORTS) {
    for (const a of [s.name, ...s.aliases]) {
      const got = matcher.one(a, 'support');
      if (got !== s.id) {
        errs.push(
          `matcher: support "${a}" should resolve to ${s.id} and resolves to ${got ?? 'nothing'}`,
        );
      }
    }
  }

  // 11. THE NAMED TRAPS, AS GATES. Every one of these is a measured failure
  //     from Stage 0, written as an assertion so that the comment explaining it
  //     cannot be the only thing keeping it shut.
  const trap = (label: string, ok: boolean, why: string): void => {
    if (!ok) errs.push(`trap "${label}": ${why}`);
  };
  //     (a) THE FIRELORD TRAP, checked in the pass where it actually fires. The
  //         union matcher is immune by ordering; a fighter-only pass is what a
  //         role-blind parser runs, and it is where a future `Firelord` alias
  //         would resolve Ozai's own support to Ozai.
  trap(
    'firelord-sozin is not ozai',
    matcher.findIn('Firelord Sozin', 'fighter').length === 0,
    'a fighter-only scan of "Firelord Sozin" resolved a fighter. Something re-added a bare ' +
      'Fire Lord / Firelord alias to ozai — see BANNED_ALIASES.',
  );
  trap(
    'firelord-sozin resolves as a support',
    matcher.one('Firelord Sozin', 'support') === 'firelord-sozin' &&
      matcher.one('Fire Lord Ozai', 'fighter') === 'ozai',
    'the pair that has to stay separable no longer does.',
  );
  //     (b) LONGEST-FIRST OVER THE ALT SLOTS. The whole reason 27 catalogue
  //         sides do not silently become their base fighter.
  trap(
    'avatar-aang beats aang',
    matcher.fighters('Avatar Aang vs Nightmare Korra').join(',') === 'avatar-aang,nightmare-korra',
    'the alt slots collapsed into their base fighters. Verified live on aegisEsports A_CSU5_gLGw, ' +
      '"Avatar Aang vs Nightmare Korra".',
  );
  //     (c) THE NAMESPACE OVERLAP IS PRESENT AND TYPED. Not "resolvable" —
  //         present in BOTH tables, reported as an overlap, and never silently
  //         one of the two.
  trap(
    'katara is in both namespaces',
    matcher.one('Katara', 'fighter') === 'katara' &&
      matcher.one('Katara', 'support') === 'katara' &&
      matcher.overlaps('Katara').length === 1,
    'the one live namespace overlap stopped being reported. Index row 482155 has p2_char ' +
      '"Avatar Aang" with p2_char2 "Katara"; if this stops firing, that side reads as a ' +
      'two-fighter counter-pick.',
  );
  //     (d) STiLL'S SUPPORT-IN-THE-FIGHTER-BRACKET, the crossing readSlot
  //         exists for. Title IK7OAwzSIsw: "KATARA ON KATARA! Enigmode(Kanna)
  //         V.S STiLL(Pakku)", description "Katara Mirror - Pakku vs Kanna".
  //         The bare `Pakku` is channels.ts:1243's, so only `Kanna` resolves
  //         here — which is the point: the fighter bracket holds a SUPPORT.
  trap(
    'a support in the fighter bracket is a support',
    matcher.fighters('Kanna').length === 0 && matcher.supports('Kanna')[0] === 'kanna',
    'STiLL IK7OAwzSIsw puts supports in both fighter brackets. If "Kanna" ever resolves as a ' +
      'fighter, that title mints a fighter and a player page out of one support name.',
  );
  //     (e) NORMALIZATION EXERCISES IDENTITY, NOT THE PARSE RATE. A control that
  //         only asks "does it still parse" passes on a pipeline with no
  //         normalization at all — which is how a sibling shipped 24 gates and
  //         no normalization control. These ask whether two writings of one
  //         string produce ONE id. Every codepoint here measured ZERO on this
  //         corpus except the fullwidth colon and the trademark sign.
  const IDENTITY: { fold: string; odd: string; plain: string }[] = [
    // WRITTEN AS ESCAPES, LIKE THE FOLD CLASSES THEMSELVES. A test fixture whose
    // input is an invisible literal is a fixture a reviewer cannot read and a
    // diff cannot show — which is the same argument that put the folds in
    // scripts/roster.ts in escaped form, applied to the thing that proves they
    // work.
    {
      fold: 'fullwidth (U+FF21-FF5A)',
      odd: '\uFF2B\uFF41\uFF54\uFF41\uFF52\uFF41',
      plain: 'Katara',
    },
    { fold: 'no-break space (U+00A0)', odd: 'Avatar\u00A0Aang', plain: 'Avatar Aang' },
    { fold: 'zero-width space (U+200B)', odd: 'Ming\u200BHua', plain: 'Ming Hua' },
    { fold: 'curly apostrophe (U+2019)', odd: 'P\u2019Li', plain: "P'Li" },
    { fold: 'non-breaking hyphen (U+2011)', odd: 'Ming\u2011Hua', plain: 'Ming-Hua' },
    { fold: 'doubled ASCII space', odd: 'Fire  Lord  Ozai', plain: 'Fire Lord Ozai' },
    {
      fold: 'fullwidth colon (U+FF1A)',
      odd: 'Avatar Legends\uFF1AToph',
      plain: 'Avatar Legends: Toph',
    },
  ];
  for (const { fold, odd, plain } of IDENTITY) {
    trap(
      `identity: ${fold}`,
      aliasKey(odd) === aliasKey(plain),
      `two writings of one string must produce ONE id — aliasKey gives "${aliasKey(odd)}" and ` +
        `"${aliasKey(plain)}". Two ids means two pages for one person or one character.`,
    );
  }
  // PINNED, NOT ASSERTED-EQUAL. NFKD compatibility-expands U+2122 to the letters
  // "TM", so saxxiefone's "Chris™" (3yXR-UC5enA) is `christm`. Only one channel
  // writes that handle and it writes it one way, so nothing is split today; what
  // this gate protects is the id itself, which a later swap of NFKD for NFC or a
  // blanket NFKC would move silently. See playerId() for the condition that
  // would change the answer.
  trap(
    'identity: the trademark sign expands rather than strips',
    playerId('Chris™') === 'christm' && playerId('Chris') === 'chris',
    `playerId("Chris™") is now "${playerId('Chris™')}". The slug rule changed — every id ` +
      'carrying a compatibility character moved with it.',
  );
  trap(
    'identity: a symbol-only handle is refused, not minted',
    playerId('♱') === '',
    'ArinKarin\'s "Vs ♱ (Azula)" (index row 482823) is a real handle that cannot be slugged. ' +
      'It must return "" so parse refuses the side — a symbol-accepting slug mints ids for "-" ' +
      'and "!" and turns decoration into player pages.',
  );

  // 12. CHECKLIST 5n — NO PLAYER-REGISTRY ENTRY MAY CARRY A CHARACTER NAME, AND
  //     ON THIS GAME THAT MEANS BOTH NAMESPACES.
  //
  //     The failure: a title grammar that puts a character in the handle slot
  //     mints a player page for one. Measured live in both vocabularies —
  //     redVsFantasy yhT8j0QMd_E mints "Kyoshi" under generic rules, and
  //     takeANappa PGUYXwHR_x8 / mGiMDzaWAIk extract the SUPPORT "Sozin" as a
  //     handle whenever the support namespace is absent. Every sibling's guard
  //     compares fighter names only and is blind to the second case.
  //
  //     On day one data/players.json is [] and this loop does nothing — which is
  //     the point: the mechanism ships before the data does.
  const confirmed = new Map(CONFIRMED_CHARACTER_NAMED_PLAYERS.map((p) => [p.id, p]));
  for (const p of CONFIRMED_CHARACTER_NAMED_PLAYERS) {
    if (playerId(p.handle) !== p.id) {
      errs.push(`allow-list: handle "${p.handle}" slugs to "${playerId(p.handle)}", not "${p.id}"`);
    }
    if (matcher.find(p.handle).length === 0) {
      errs.push(
        `allow-list: "${p.handle}" no longer collides with any character or support name — ` +
          `either a table changed or the row was never needed; delete it rather than leaving a ` +
          `dead exemption`,
      );
    }
    if (!p.video) {
      warns.push(
        `allow-list: "${p.handle}" (${p.id}) is exempted with no evidence. Watch a record, ` +
          `confirm a person is behind the handle, and put its video id on the row.`,
      );
    }
  }
  const players = await readPlayers();
  for (const p of players) {
    const spellings = [p.handle, ...((p.extra?.aliases as string[] | undefined) ?? [])];
    const hits = [
      ...new Set(
        spellings.flatMap((s) => [
          ...matcher.fighters(s).map((id) => `fighter:${id}`),
          ...matcher.supports(s).map((id) => `support:${id}`),
        ]),
      ),
    ];
    if (!hits.length) continue;
    if (!confirmed.has(p.id)) {
      errs.push(
        `player "${p.handle}" (${p.id}) contains ${hits.join(', ')} and is not on ` +
          `CONFIRMED_CHARACTER_NAMED_PLAYERS. Watch a record and decide: a real person goes on ` +
          `the list WITH a video id; a character parsed into the handle slot is a parse bug, and ` +
          `the fix is the channel's slotOrder or an overrides.json entry — never an exemption`,
      );
    }
  }
  if (players.length) {
    for (const p of CONFIRMED_CHARACTER_NAMED_PLAYERS) {
      if (!players.some((q) => q.id === p.id)) {
        warns.push(`allow-list entry ${p.id} is not in data/players.json — stale?`);
      }
    }
  }

  if (errs.length) {
    console.error(`✖ the registries are invalid:\n${errs.map((e) => `    ${e}`).join('\n')}`);
    process.exit(1);
  }

  await writeFile(OUT_CHARACTERS, `${JSON.stringify(characters, null, 2)}\n`);
  await writeFile(OUT_SUPPORTS, `${JSON.stringify(supports, null, 2)}\n`);

  const index = buildSupportIndex(supports);
  const short = ROSTER.filter((c) => index.supportsOf(c.id).length < SUPPORTS_PER_FIGHTER);
  const worst = ROSTER.map((c) => ({
    id: c.id,
    r: contrast(tokenAccents.get(c.id)!, SURFACE),
  })).sort((a, b) => a.r - b.r)[0]!;
  const byNation = (['air', 'water', 'earth', 'fire', 'avatar'] as Nation[]).map(
    (n) => `${n} ${ROSTER.filter((c) => c.nation === n).length}`,
  );
  console.log(
    `✓ data/characters.json — ${characters.length} fighters (${byNation.join(' · ')}), ` +
      `${fighterAliasOwner.size} unique fighter alias keys\n` +
      `✓ data/supports.json — ${supports.length} supports of ${
        ROSTER.length * SUPPORTS_PER_FIGHTER
      } the vendor states, ${supportAliasOwner.size} unique support alias keys; ` +
      `${short.length} fighter(s) still short: ${short.map((c) => c.id).join(', ') || 'none'}\n` +
      `  matcher compiled ${matcher.aliasCount.fighter} fighter + ${matcher.aliasCount.support} ` +
      `support keys; lowest accent contrast ${worst.id} ${worst.r.toFixed(2)}:1 on ${SURFACE}; ` +
      `${UNRELEASED.length} announced-but-unreleased held back; ` +
      `${CONFIRMED_CHARACTER_NAMED_PLAYERS.length} character-named players allow-listed`,
  );
  for (const w of warns) console.warn(`  ⚠ ${w}`);
}

await main();
