/**
 * Shared roster vocabulary — text normalization, TYPED SPAN EXTRACTION over two
 * namespaces, player ids — plus the vendor-facing half: the scrape that
 * re-checks Paramount Games' and Valve's own surfaces against what we committed.
 *
 * ── TWO NAMESPACES, AND THE TYPE IS THE WHOLE POINT ───────────────────────
 * Every sibling on this platform matches ONE vocabulary: a span is a character
 * or it is residue. Avatar cannot work that way, because every side picks a
 * FIGHTER and a SUPPORT, the two vocabularies OVERLAP, and the corpus writes
 * them in each other's slots. Three measurements, none of them hypothetical:
 *
 *   · `Katara` is a launch FIGHTER and also Avatar Aang's SUPPORT. Replay
 *     Theater row 482155 (youtu.be/GmU3e6jvpcI&t=582s) reads
 *     p2_char "Avatar Aang" / p2_char2 "Katara", and the uploader's own title
 *     agrees: "Internal Tester Series: Smitty (Azula - Lo & Li/Avatar State
 *     Aang - Katara)". Folded into one list that side reads as a two-fighter
 *     counter-pick and mints Katara on the opponent's slot.
 *   · STiLL writes SUPPORTS INSIDE THE FIGHTER BRACKET. Video IK7OAwzSIsw:
 *     "KATARA ON KATARA! Enigmode(Kanna) V.S STiLL(Pakku) | AVATAR LEGENDS MEGA
 *     SET 08.22.26", and its own description says "Katara Mirror - Pakku vs
 *     Kanna". Both brackets hold a support; neither holds a fighter. A
 *     fighters-only matcher reports that side as char-unresolved and a
 *     fighters-only REGISTRY guard passes "Kanna" as a player handle.
 *   · The support table is a strict PARTITION over fighters — measured on
 *     2026-09-18 across all 516 sides of the live catalogue, every one of the 34
 *     attested supports appears under exactly one fighter. That is an assertable
 *     invariant, and it only exists because the namespace is separate.
 *
 * So `find()` returns spans that carry a `fighter` id, a `support` id, or BOTH,
 * and `readSlot()` reads one slot's text against the kind that slot is DECLARED
 * to hold while reporting every crossing. Nothing here decides an overlap: a
 * span that resolves in both namespaces is handed back with both ids so the
 * caller can queue it ('support-overlap', types/index.ts ReviewQueueItem).
 *
 * ── NORMALIZATION SHIPS ON A CORPUS THAT MEASURED ZERO INVISIBLES ─────────
 * Stage 0's Unicode scan covered every marked title on all 73 candidate
 * channels and found NOT ONE U+202F, U+3000, U+00A0, U+200B, U+FEFF or U+00AD.
 * CotW's whole story is 333 U+202F; Strive's is 547 U+3000; Avatar's is zero.
 *
 * The folds ship anyway, and the argument is not "it might happen". It is that
 * a fold costs one regex pass and its absence is INVISIBLE — it mints a second
 * player page for one person, it makes a Map keyed on a literal alias miss, and
 * every one of those failures looks like ordinary data. Nobody adds
 * normalization to a working pipeline on a hunch; they add it after the second
 * page appears. The classes that are zero today arrive with the next uploader,
 * not with this week's corpus.
 *
 * WHICH IS WHY THE POSITIVE CONTROL MUST EXERCISE IDENTITY, NOT THE PARSE RATE.
 * A control that asks "does the corpus still parse" passes on a pipeline with no
 * normalization at all — it passed on CotW, which shipped 24 gates and none of
 * them touched this. scripts/characters.ts asserts that normalizeText and
 * aliasKey COLLAPSE the folded spellings onto the plain ones, i.e. that two
 * writings of one string produce one id.
 *
 * WHAT THE SCAN DID FIND IS NOT INVISIBLE AT ALL, and each one is answered here:
 *   · `♱` (U+2671) as an ENTIRE handle — ArinKarin's "Avatar Legends - ArinKarin
 *     (Ozai) Vs ♱ (Azula)", catalogue row 482823. See playerId().
 *   · `™` inside a handle — saxxiefone 3yXR-UC5enA, "Saxxie Zuko (June) v.s.
 *     Chris™ Zuko (June)". It survives normalizeText and then NFKD EXPANDS IT TO
 *     "TM", so the id is `christm`, not `chris`. Measured, pinned as a gate, and
 *     explained at playerId() — it is a consequence of the ported slug rule
 *     rather than a decision anyone made here.
 *   · DOUBLED ASCII SPACES beside the game marker — "Avatar Legends The Fighting
 *     Game  ..." (rood), triple on another channel. Plain U+0020 runs, which is
 *     why the whitespace COLLAPSE below matters more here than the exotic folds.
 *   · ONE FULLWIDTH COLON, in a localized title Aegis Esports serves to Japanese
 *     search — "Avatar Legends：対戦格闘ゲーム キョーシ vs カタラ（Gonemad vs STiLL）".
 *     The Data API returns that video's title in English, so the katakana never
 *     reaches our intake and no katakana alias is carried. The fullwidth fold
 *     below is still what keeps ：and （） from surviving into an id if it ever
 *     does.
 *
 * ── CHARACTER MATCHING IS SPAN EXTRACTION, NEVER A SEPARATOR SPLIT ────────
 * Checklist 5c, and this game needs it for a reason the siblings do not have:
 * the separator does not say which side of it is the fighter. Most channels
 * write FIGHTER/SUPPORT — "(Aang/Gyatso)", "(Toph; Boulder)", "Aang(Momo)" —
 * and the vendor's own tester title writes the pair the other way round inside
 * a slash-delimited group. A split on `/` picks a role; a span matcher reads
 * one, and where both readings survive the record is queued instead of guessed.
 *
 * Run the vendor check: `npx tsx scripts/roster.ts --scrape`
 * (the wired entry point is `npm run data:roster-check`, which adds the verdict
 * trailer the workspace runner reads.)
 */

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { CharacterRecord, SupportRecord } from '../types/index';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Space-like characters that are not U+0020, folded to a plain space.
 *
 * WRITTEN AS ESCAPES, NEVER AS LITERALS. The whole point of this list is that
 * these characters are invisible, so a diff adding or removing a literal one
 * shows nothing at review. ESLint's no-irregular-whitespace rule flags the
 * literal form for the same reason.
 *
 * Every codepoint in this class measured ZERO on this corpus. See the header for
 * why it ships regardless, and scripts/characters.ts for the control that proves
 * it does something.
 */
const SPACE_LIKE = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g;
/**
 * IN-WORD hyphens, folded to ASCII '-'.
 *
 * ONE ROSTER NAME AND ONE SUPPORT NAME CARRY A REAL HYPHEN: the support
 * `Ming-Hua` (the catalogue's spelling; the wiki and two channels write "Ming
 * Hua") and, through the alias table, `Lin Beifong` is written "Lin-Beifong" by
 * nobody today but would fold here if it were. A non-ASCII hyphen inside one of
 * them makes the matcher miss and the support read as absent — on CotW that
 * exact miss cost 18 records before anyone noticed, and it was cheap to find
 * only because a miss is visible rather than wrong.
 *
 * The em and en dashes are deliberately NOT here. They are SEPARATORS in these
 * titles — toledoLocals' game slot is literally `) - Avatar`, and half the
 * corpus writes `Handle (Fighter) - Handle (Fighter)` — and folding a separator
 * into a name merges two spans that were never one.
 *
 * U+FF0D FULLWIDTH HYPHEN-MINUS is not here either, and its absence is not an
 * omission: the fullwidth fold above already turned it into an ASCII '-' one
 * line earlier. Re-adding it would be a branch that can never fire.
 */
const IN_WORD_HYPHEN = /[\u2010\u2011\u2012\u2212\uFE63\u00AD]/g;
/** Zero-width and directional marks, deleted outright — they are not spaces and
 *  folding them to one would split a word that was never split. */
const ZERO_WIDTH = /[\u200B-\u200F\u2060\uFEFF\u061C\u180E]/g;
/** FULLWIDTH FORMS of printable ASCII. Arithmetic, so the reviewable claim is
 *  the range and the offset rather than a hand-typed table nobody can check.
 *  Halfwidth katakana (U+FF61–U+FF9F) is deliberately NOT folded: it needs
 *  composition rather than arithmetic, and the corpus scan found none. */
const FULLWIDTH = /[\uFF01-\uFF5E]/g;
/**
 * RIGHT SINGLE QUOTATION MARK → APOSTROPHE.
 *
 * MEASURED, not inherited. One support name carries an ASCII apostrophe —
 * `P'Li` (U+0027, the catalogue's spelling) — and uploaders write "P'li" and
 * "Pi li". Separately, FinalRounds writes `Zuko’s` with U+2019, which is the
 * possessive rather than a name, and folding it is what lets the trailing
 * boundary guard see `Zuko` + `'s` instead of one unknown word.
 */
const CURLY_APOSTROPHE = /\u2019/g;

/**
 * NFC + fullwidth fold + apostrophe fold + space folding + zero-width removal +
 * whitespace collapse.
 *
 * NFC FIRST. It is the cheapest of these and the only one whose absence can
 * split a Latin handle too: a decomposed é keys differently from a precomposed
 * one, and the corpus carries Spanish and Portuguese handles on six channels.
 *
 * WHAT THIS COSTS: the stored title and the displayed handle lose their
 * fullwidth glyphs. That is the deliberate trade — one canonical spelling per
 * person beats a prettier string on a page nobody can find because it was minted
 * twice.
 */
export function normalizeText(s: string): string {
  return s
    .normalize('NFC')
    .replace(FULLWIDTH, (c) => String.fromCodePoint(c.codePointAt(0)! - 0xfee0))
    .replace(CURLY_APOSTROPHE, "'")
    .replace(SPACE_LIKE, ' ')
    .replace(IN_WORD_HYPHEN, '-')
    .replace(ZERO_WIDTH, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function loadCharacters(): Promise<CharacterRecord[]> {
  const raw = await readFile(join(ROOT, 'data', 'characters.json'), 'utf8');
  const characters = JSON.parse(raw) as CharacterRecord[];
  if (characters.length === 0) {
    throw new Error('data/characters.json is empty — run `npm run data:characters` first.');
  }
  return characters;
}

/** data/supports.json — the second namespace. Empty is a HARD error for the
 *  same reason an empty roster is: 516 of 516 catalogue sides state a support,
 *  so a pipeline that loads none is not "a game without supports", it is a
 *  pipeline whose support column silently became residue. */
export async function loadSupports(): Promise<SupportRecord[]> {
  const raw = await readFile(join(ROOT, 'data', 'supports.json'), 'utf8');
  const supports = JSON.parse(raw) as SupportRecord[];
  if (supports.length === 0) {
    throw new Error('data/supports.json is empty — run `npm run data:characters` first.');
  }
  return supports;
}

/**
 * The lookup key an alias and a matched literal share.
 *
 * KEEPS EVERY UNICODE LETTER rather than filtering to [a-z0-9]. No alias in
 * either namespace is non-Latin today, so the filter would be harmless HERE —
 * which is exactly why it would be copied to the next game, where Strive's
 * thirty-odd Japanese aliases all key to the empty string and a Map keyed that
 * way keeps only the last writer. The cheap version of this function is a
 * silent, total, roster-wide mis-resolution on any game with a second script.
 *
 * scripts/characters.ts asserts alias uniqueness through THIS function, not a
 * lookalike of its own: a validator that normalises differently from the matcher
 * passes while the matcher collides.
 */
export const aliasKey = (s: string): string =>
  normalizeText(s)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');

/** Which vocabulary a span or a slot belongs to. */
export type Namespace = 'fighter' | 'support';

export interface AliasSpan {
  /** [start, end) of the alias inside the NORMALIZED text. */
  start: number;
  end: number;
  /** The literal text that matched, for the residue report and for telemetry. */
  literal: string;
  /** data/characters.json id, when this literal names a fighter. */
  fighter?: string;
  /** data/supports.json id, when this literal names a support. */
  support?: string;
}

/** A span that resolved in BOTH namespaces. One exists in live data today
 *  (`Katara`); the record is queued, never guessed. */
export interface NamespaceOverlap {
  span: string;
  fighterId: string;
  supportId: string;
}

export interface AliasMatcher {
  /** Every span in the text, longest-alias-first across BOTH namespaces,
   *  overlaps suppressed — so "Nightmare Korra" absorbs the inner "Korra",
   *  "Dark Avatar Unalaq" absorbs nothing it should not, and "Firelord Sozin"
   *  is never seen as a Fire-Lord-anything plus a stray "Sozin". */
  find(text: string): AliasSpan[];
  /** The same scan restricted to one vocabulary, compiled separately. This is
   *  the pass a role-blind parser would run, and the pass scripts/characters.ts
   *  uses to prove the Firelord trap stays shut. */
  findIn(text: string, ns: Namespace): AliasSpan[];
  /** Ordered, de-duplicated fighter ids — first appearance first, which is
   *  exactly the engine's `Side.characters` contract. */
  fighters(text: string): string[];
  /** Ordered, de-duplicated support ids. */
  supports(text: string): string[];
  /** The single id of that namespace the fragment names, or null when it names
   *  zero or 2+. */
  one(text: string, ns: Namespace): string | null;
  /** Spans that resolved in both namespaces. */
  overlaps(text: string): NamespaceOverlap[];
  /** The characters of `text` that no span covered and that are not ordinary
   *  separator punctuation or known decoration. Non-empty residue is a report
   *  line, never a silent drop — and on this game it is the ONLY automatic
   *  detector for the two supports nobody has evidenced yet and for the five
   *  gated fighters, because the vendor has published no date for any of them. */
  residue(text: string): string;
  /** Compiled alias keys per namespace, for gates and for the report. */
  aliasCount: { fighter: number; support: number };
}

/**
 * Punctuation and decoration that is never part of a handle or a name, so its
 * presence in the residue means nothing. Kept narrow on purpose: the residue
 * gate is only useful if it still reports real words.
 *
 * `avatar` and `legends` are in the list because they are this game's marker and
 * appear in every second title — NOT because they are safe words. Bare 'Avatar'
 * is refused as a game marker everywhere but one slot (types/index.ts GateMode),
 * it is inside the support names 'Dark Avatar Unalaq' and 'Avatar Roku', and it
 * opens two roster aliases. Dropping it from the RESIDUE is safe precisely
 * because the span matcher has already claimed those occurrences: this list runs
 * over what is left after the spans are cut out.
 *
 * The FT tokens are separate from the `\b`-anchored group and that is checklist
 * 5l's lesson in miniature: this catalogue's `tag` column mixes event names with
 * set formats FT5..FT30, channels write "FT 10" and "FT10...ish", and `\bft\b`
 * does not match inside "FT10" because T/1 is not a word boundary.
 */
const RESIDUE_NOISE = new RegExp(
  [
    'ft\\s*\\d+',
    '\\b(?:avatar|legends|fighting|game|vs|versus|feat|and|the|de|la|el|los|las|a|an|of|' +
      'match|matches|replay|replays|gameplay|high|low|mid|level|rank|ranked|ranking|' +
      'online|offline|set|sets|day|round|rounds|perfect|combo|combos|guide|guides|training|lab|' +
      'season|dlc|patch|update|ver|version|new|full|best|top|pro|player|players|support|supports|' +
      'tournament|tourney|final|finals|grand|semi|winners|losers|pools|bracket|ceo|evo|' +
      'hd|4k|1080p|60fps|shorts|short|live|stream|clip|clips|highlight|highlights|old)\\b',
    '[^\\p{L}\\p{N}]+',
    // The ordinal suffix has to be part of the NUMBER term, not a word in the
    // \b-anchored group: replacement is progressive but the boundaries are
    // evaluated against the original string, so there is no \b between "3" and
    // "rd" and a round marker "Round 3rd" would report a nickname "rd".
    '\\d+(?:st|nd|rd|th)?',
  ].join('|'),
  'giu',
);

/**
 * Characters inside an alias that match any amount of themselves, including
 * none. One entry for `Ming-Hua` then covers `Ming Hua`, `MingHua` and
 * `Ming--Hua`; one for `P'Li` covers `P'li`, `PLi` and `P Li`; one for `Fire
 * Lord Ozai` covers `FireLordOzai` and the glued hashtag `#firelordozai`; one
 * for `Avatar Aang` covers `Avatar-Aang`. That is why the alias tables enumerate
 * SPELLINGS, never spacing or punctuation variants.
 *
 * `&` IS DELIBERATELY ABSENT, and it is the one place this class is narrower
 * than the reference's. `Ran and Shaw` versus the channel spelling `Ran & Shaw`
 * is a word-for-symbol substitution, not punctuation flex; scripts/channels.ts
 * (an11Mo) carries that spelling as a channel-scoped alias and says so. Putting
 * `&` in this class would also make `Lo and Li` match `Lo&Li`, which nobody
 * writes, at the cost of making the class unreviewable.
 *
 * `*` rather than a bounded repeat is safe only because normalizeText has
 * already collapsed whitespace runs — do not remove one without the other.
 */
const FLEXIBLE = /[.\-\s']/;
const FLEX_CLASS = "[.\\-\\s']*";

const flexPattern = (alias: string): string =>
  alias
    .split('')
    .map((ch) => (FLEXIBLE.test(ch) ? FLEX_CLASS : ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('');

const compile = (aliases: string[]): RegExp | null => {
  if (aliases.length === 0) return null;
  const sorted = [...aliases].sort((a, b) => b.length - a.length || a.localeCompare(b));
  return new RegExp(
    `(?<![\\p{L}\\p{N}])(?:${sorted.map(flexPattern).join('|')})(?![\\p{L}\\p{N}])`,
    'giu',
  );
};

/**
 * Build the typed matcher over both namespaces.
 *
 * LONGEST-FIRST ACROSS THE UNION IS THE WHOLE CORRECTNESS ARGUMENT, and it is
 * what makes the two vocabularies safe to compile into one alternation.
 * Aliases from both tables are sorted by length descending into a single
 * pattern, and the scan takes non-overlapping matches left to right. Two
 * measured pairs depend on it:
 *
 *   · fighter `Nightmare Korra` must beat fighter `Korra`, and fighter
 *     `Avatar Aang` must beat fighter `Aang`. Without the ordering both alt
 *     slots collapse into their base fighter and 27 catalogue sides change
 *     character silently.
 *   · support `Firelord Sozin` must beat any Ozai alias. This is the measured
 *     trap named in scripts/characters.ts BANNED_ALIASES: `Fire Lord` alone,
 *     compiled through FLEX_CLASS, matches the `Firelord` inside `Firelord
 *     Sozin` and the trailing guard passes because the next character is a
 *     space. Inside ONE alternation the 14-character support wins the position
 *     and the trap cannot fire; in two separate passes it fires every time. That
 *     is why `findIn` exists and why characters.ts asserts against it rather
 *     than against `find`.
 *
 * THE BOUNDARY GUARDS ARE WHAT MAKE THE SHORT NAMES USABLE. `Mai`, `Yun`,
 * `June`, `Momo`, `Suki`, `Naga` and `Roku` are three-to-four-letter support
 * names that would otherwise fire inside handles; `(?<![\p{L}\p{N}])` and
 * `(?![\p{L}\p{N}])` are the reason the live check over the catalogue's 178
 * distinct player names finds zero collisions — re-run against this exact table
 * on 2026-09-18, not inherited from the recon's 171.
 */
/** The structural minimum the matcher needs from a fighter row. CharacterRecord
 *  satisfies it; so does an announced-but-unreleased row in
 *  scripts/expiries.ts, which is how the gated fighters get scanned for with the
 *  REAL matcher instead of a lookalike regex that would drift from it. */
export interface FighterAliasSource {
  id: string;
  name: string;
  extra?: { aliases?: string[] } & Record<string, unknown>;
}

/** The same, for a support row. SupportRecord satisfies it. */
export interface SupportAliasSource {
  id: string;
  name: string;
  aliases: string[];
}

export function buildAliasMatcher(
  characters: FighterAliasSource[],
  supports: SupportAliasSource[],
): AliasMatcher {
  // Normalised at BUILD time, because the text side is normalised at match time.
  const fighterAliases: string[] = [];
  const supportAliases: string[] = [];
  const fighterByKey = new Map<string, string>();
  const supportByKey = new Map<string, string>();

  for (const c of characters) {
    for (const a of [c.name, ...(c.extra?.aliases ?? [])]) {
      const n = normalizeText(a);
      fighterAliases.push(n);
      fighterByKey.set(aliasKey(n), c.id);
    }
  }
  for (const s of supports) {
    for (const a of [s.name, ...s.aliases]) {
      const n = normalizeText(a);
      supportAliases.push(n);
      supportByKey.set(aliasKey(n), s.id);
    }
  }

  const RE_ALL = compile([...fighterAliases, ...supportAliases]);
  const RE_BY_NS: Record<Namespace, RegExp | null> = {
    fighter: compile(fighterAliases),
    support: compile(supportAliases),
  };

  const scan = (text: string, re: RegExp | null, ns: Namespace | null): AliasSpan[] => {
    if (!re) return [];
    const t = normalizeText(text);
    const out: AliasSpan[] = [];
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(t)) !== null) {
      // The flexible-punctuation class is `*`, so a pathological alias could
      // match empty and spin the cron forever. characters.ts refuses such an
      // alias; this guard is what makes that refusal non-load-bearing.
      if (m[0].length === 0) {
        re.lastIndex += 1;
        continue;
      }
      const key = aliasKey(m[0]);
      const fighter = ns === 'support' ? undefined : fighterByKey.get(key);
      const support = ns === 'fighter' ? undefined : supportByKey.get(key);
      if (fighter || support) {
        out.push({ start: m.index, end: m.index + m[0].length, literal: m[0], fighter, support });
      }
    }
    return out;
  };

  const find = (text: string): AliasSpan[] => scan(text, RE_ALL, null);
  const findIn = (text: string, ns: Namespace): AliasSpan[] => scan(text, RE_BY_NS[ns], ns);

  const idsOf = (text: string, ns: Namespace): string[] => {
    const seen: string[] = [];
    for (const s of find(text)) {
      const id = ns === 'fighter' ? s.fighter : s.support;
      if (id && !seen.includes(id)) seen.push(id);
    }
    return seen;
  };

  return {
    find,
    findIn,
    fighters: (text) => idsOf(text, 'fighter'),
    supports: (text) => idsOf(text, 'support'),
    one: (text, ns) => {
      const found = idsOf(text, ns);
      return found.length === 1 ? found[0]! : null;
    },
    overlaps: (text) =>
      find(text)
        .filter((s) => s.fighter && s.support)
        .map((s) => ({ span: s.literal, fighterId: s.fighter!, supportId: s.support! })),
    residue: (text) => {
      const t = normalizeText(text);
      const spans = find(t);
      let prev = 0;
      const gaps: string[] = [];
      for (const s of spans) {
        gaps.push(t.slice(prev, s.start));
        prev = s.end;
      }
      gaps.push(t.slice(prev));
      return gaps.join(' ').replace(RESIDUE_NOISE, ' ').replace(/\s+/g, ' ').trim();
    },
    aliasCount: { fighter: fighterByKey.size, support: supportByKey.size },
  };
}

/** What one title slot turned out to hold. */
export interface SlotReading {
  /** Fighter ids the slot named, first appearance first. */
  fighters: string[];
  /** Support ids the slot named, first appearance first. */
  supports: string[];
  /** Spans that resolved in BOTH namespaces. NON-EMPTY MEANS QUEUE THE RECORD:
   *  `kind` below is the declared slot's reading, not a verdict. */
  overlaps: NamespaceOverlap[];
  /** The namespace the slot actually delivered, or null when it delivered
   *  neither. Equals `want` on every honest slot. */
  kind: Namespace | null;
  /** The slot is declared to hold `want` and holds the OTHER namespace with
   *  nothing of `want` in it. Measured on STiLL IK7OAwzSIsw, "Enigmode(Kanna)".
   *  Its other bracket, "STiLL(Pakku)", holds a support too and resolves to
   *  NOTHING today, because the bare `Pakku` is scoped to cow and kovac
   *  (channels.ts:488, :1243) and the `still` entry declares no `supports`
   *  block. That is a channels-track gap, recorded here rather than papered
   *  over: a roster-wide `Pakku` would be this file overreaching into a
   *  per-channel decision. */
  crossed: boolean;
  /** Text no span covered. */
  residue: string;
}

/**
 * Read ONE slot's text against the namespace that slot is declared to hold.
 *
 * `want` is the channel's declared shape, not a guess — a fighter bracket on a
 * 'handle-outside' channel wants 'fighter'. The function never rewrites what it
 * found to fit: it reports both vocabularies, flags the crossing, and leaves the
 * verdict to the caller. Three outcomes and what each one means:
 *
 *   kind === want                  the ordinary case.
 *   crossed === true               the slot holds the other namespace and
 *                                  nothing of the declared one — STiLL's
 *                                  "Enigmode(Kanna) V.S STiLL(Pakku)", where
 *                                  both fighter brackets hold a support. The
 *                                  record is not a miss and not a fighter; its
 *                                  fighter is unknown and its support is stated.
 *   overlaps.length > 0            the span is in both tables ('Katara'). The
 *                                  declared slot gives `kind` and BOTH id lists
 *                                  still carry it, so an unqueued caller reads
 *                                  "Avatar Aang - Katara" as a two-fighter
 *                                  counter-pick and mints a Katara pick that
 *                                  nobody made. Queue it: a declared slot is a
 *                                  channel's habit, not evidence about one
 *                                  title.
 */
export function readSlot(matcher: AliasMatcher, text: string, want: Namespace): SlotReading {
  const fighters = matcher.fighters(text);
  const supports = matcher.supports(text);
  const wanted = want === 'fighter' ? fighters : supports;
  const other = want === 'fighter' ? supports : fighters;
  return {
    fighters,
    supports,
    overlaps: matcher.overlaps(text),
    kind: wanted.length ? want : other.length ? (want === 'fighter' ? 'support' : 'fighter') : null,
    crossed: wanted.length === 0 && other.length > 0,
    residue: matcher.residue(text),
  };
}

/**
 * fighter id → its support ids, and support id → its owning fighter.
 *
 * THE PARTITION IS AN INVARIANT, NOT A CONVENIENCE. Across all 516 sides of the
 * live catalogue on 2026-09-18, every one of the 34 attested supports appears
 * under exactly one fighter — zero exceptions. So a support resolving on a side
 * whose fighter does not own it is a PARSE ERROR (the wrong span won, or the
 * sides were split wrong), not a rare pick, and parse.ts can say so. That check
 * is only expressible because the namespaces are separate; inside one character
 * list it is not even a sentence.
 */
export interface SupportIndex {
  ownerOf(supportId: string): string | undefined;
  supportsOf(fighterId: string): string[];
}

export function buildSupportIndex(supports: { id: string; owner: string }[]): SupportIndex {
  const owner = new Map<string, string>();
  const owned = new Map<string, string[]>();
  for (const s of supports) {
    owner.set(s.id, s.owner);
    owned.set(s.owner, [...(owned.get(s.owner) ?? []), s.id]);
  }
  return {
    ownerOf: (id) => owner.get(id),
    supportsOf: (id) => owned.get(id) ?? [],
  };
}

/**
 * Slug a handle into a stable player id — the PUBLIC id, and the URL.
 *
 * NFKD IS DOING MORE THAN CASE-FOLDING AND THE CORPUS PROVES IT. The ported rule
 * runs NFKD before the ASCII filter, which COMPATIBILITY-EXPANDS as well as
 * decomposing: `™` becomes the letters `TM`. So saxxiefone's "Chris™"
 * (3yXR-UC5enA) slugs to `christm`, not `chris`.
 *
 * That is pinned as a gate rather than "fixed", and the reasoning is bounded by
 * what was measured. Only one channel writes this handle and it writes it one
 * way, so there is no second spelling to collide with and no page is split
 * today. Adding `™` to a strip class would be a roster-wide change to the shared
 * slug rule, derived from a single occurrence, and it would move ids on every
 * sibling that ports this function. The condition that would change the answer
 * is a SECOND channel writing "Chris" for the same player — and the fix for that
 * is a player alias in data/overrides.json, which is a judgement about two
 * humans being one, not a judgement about a codepoint.
 *
 * The gate exists because the expansion is invisible: a later edit that swapped
 * NFKD for NFC or added a blanket NFKC would silently move this id and every id
 * like it, and nothing else would notice.
 *
 * THE NON-LATIN FALLBACK IS TŌKON'S, PORTED, AND ON THIS CORPUS IT DOES NOT
 * FIRE. Tōkon shipped `{"id": "", "handle": "シルクちゃん"}` into players.json,
 * which seeded a prerender route for `/players/` that collided with the index.
 * Avatar has no non-Latin handle in any parsed side, so the fallback is
 * insurance rather than a load-bearing branch — and the one handle that would
 * need rescuing is NOT rescued by it:
 *
 *   `♱` (U+2671 EAST SYRIAC CROSS) is a REAL handle. ArinKarin's own title reads
 *   "Avatar Legends - ArinKarin (Ozai) Vs ♱ (Azula)" (catalogue row 482823), so
 *   it is a person, not a placeholder — the shared placeholder predicate the
 *   siblings use would drop that row as junk, and it would be wrong.
 *   U+2671 is `\p{So}`, not `\p{L}`, so both paths below return "" and the side
 *   is refused at parse by `!playerId(h)`.
 *
 * REFUSING IS THE RIGHT ANSWER AND EXTENDING THE FALLBACK TO SYMBOLS IS NOT.
 * A symbol-accepting slug mints ids for `-`, `!` and `...`, which is how a
 * decoration fragment becomes a player page. One side is lost, it is lost
 * LOUDLY, and the fix is a hand entry in data/overrides.json — not a rule that
 * cannot tell a cross from a bullet.
 *
 * The price of the ASCII-first order is a MIXED-script handle slugging on its
 * Latin part alone. That is the right trade: the alternative moves every
 * existing Latin id the day a non-Latin character appears in one.
 */
export function playerId(handle: string): string {
  const nfkd = normalizeText(handle).normalize('NFKD').toLowerCase();
  const ascii = nfkd.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (ascii) return ascii;
  return nfkd
    .replace(/\p{M}+/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Players whose handle contains a fighter's or a support's name ON PURPOSE — the
 * allow-list for checklist 5n, asserted by scripts/characters.ts.
 *
 * WHY THIS EXISTS. The guard says no player-registry entry may collide with a
 * roster name, because the failure it prevents is a character filed as a person.
 * On this game the class is live in BOTH namespaces:
 *   · fighter into the handle slot — REDvsFantasy yhT8j0QMd_E mints a player
 *     called "Kyoshi Player nobody knows... Click" under generic rules, and
 *     "Kyoshi" outright if the slot order is read the other way.
 *   · SUPPORT into the handle slot — takeANappa PGUYXwHR_x8 and mGiMDzaWAIk
 *     extract "Sozin" as a handle whenever the support namespace is absent.
 *     That one is invisible to every sibling's guard, which compares fighter
 *     names only.
 *
 * WHY IT SHIPS EMPTY, WHICH IS A MEASUREMENT AND NOT AN OVERSIGHT. Stage 0 ran
 * the registry check over every admitted channel's extracted handles and over
 * the catalogue's own player column:
 *   · Replay Theater, 178 distinct player names — re-measured 2026-09-18 against
 *     THIS table rather than the recon's seed, over all 258 rows. Zero
 *     collisions with any fighter or support name. (The recon read 171 at its
 *     2026-09-16 sweep; the catalogue grew.)
 *   · One of those 178 slugs to the empty string and is therefore refused at
 *     parse rather than exempted: `♱`. See playerId().
 *   · schoolBus 13 handles, takeANappa 18 handles, redVsFantasy 8 handles — 0
 *     collisions each at the recommended per-channel configuration.
 *   · The large counterfactual numbers (SageArtz 75 candidates, Elite
 *     Videogames 63) come from REJECTED channels under a naive port, and are
 *     rejections rather than records.
 * So there is nothing to exempt yet. The MECHANISM ships before the data does,
 * which is the point — the alternative is adding the guard after the first
 * fighter-named player page, by which time it is a migration.
 *
 * EVIDENCE IS A VIDEO ID, one per entry, and it is the point of the row: the
 * claim being made is "a human watched this and it is a person, not a
 * character". An entry with `video: null` is a guess wearing an allow-list's
 * clothes, and characters.ts names them so they cannot go quiet.
 */
export interface ConfirmedCharacterNamedPlayer {
  /** playerId() of the handle, i.e. the id the registry will carry. */
  id: string;
  /** The handle as the uploader spells it, for the reviewer's eyes. */
  handle: string;
  /** A record whose footage confirms this is a person. null = not yet checked. */
  video: string | null;
  note: string;
}

export const CONFIRMED_CHARACTER_NAMED_PLAYERS: ConfirmedCharacterNamedPlayer[] = [];

// ── VENDOR SCRAPE ───────────────────────────────────────────────────────────
// The provenance half. Everything below talks to the vendor's own surfaces and
// answers one question: do they still say what data/characters.json says they
// said?
//
// TWO INDEPENDENT ENUMERATIONS, BECAUSE NEITHER IS SUFFICIENT ALONE — and that
// is a stronger reason than the sibling repos have. Strive reads a grid and a
// sitemap, two views of one complete list. Here:
//
//   · paramountgames.com is FIRST-PARTY AND INCOMPLETE. Its roster widget ships
//     a `fighters[]` array of EIGHT — aang, katara, zuko, toph, korra, sokka,
//     azula, kyoshi — and simply omits zaheer, ozai, avatar-aang and
//     nightmare-korra. It is the only surface that states each fighter's ELEMENT
//     and the only one whose keys are the ids we chose, so it is the name and
//     nation control; it can never be the count.
//   · Valve's achievement schema is COMPLETE AND KEYLESS. The public
//     GetGlobalAchievementPercentagesForApp endpoint returns 42 achievements for
//     app 2424420, of which thirteen are `ach_match_won_*`: twelve per-fighter
//     and one `ach_match_won_all` aggregate. Twelve is the roster, it needs no
//     API key, and it moves the day a thirteenth fighter ships.
//
// A third surface states the count in PROSE — the store description's "Choose
// from 12 playable characters" — and is used as a control on the achievement
// count rather than as an enumeration.
//
// THE CHUNK URL IS DISCOVERED, NEVER TYPED. paramountgames.com is a Next.js app
// and its route chunk is content-hashed: today
// `page-997bea5bc54fdf44.js`, tomorrow something else, on every deploy. Stage 0
// recorded that filename; hard-coding it would produce a checker that goes green
// on a 404 the first time the vendor ships a change. The rule below is the ROUTE
// PATH — `_next/static/chunks/app/games/<game route>/page-<hash>.js` — read out
// of the page's own script tags.

const PG_PAGE = 'https://www.paramountgames.com/games/avatar-legends-the-fighting-game';
const PG_ORIGIN = 'https://www.paramountgames.com';
/** The route whose chunk carries `fighters[]`. Structure, not a filename. */
const PG_CHUNK_ROUTE =
  /_next\/static\/chunks\/app\/games\/avatar-legends-the-fighting-game\/page-[a-z0-9]+\.js/i;
const STEAM_APPID = 2424420;
const STEAM_APPDETAILS = `https://store.steampowered.com/api/appdetails?appids=${STEAM_APPID}`;
const STEAM_ACHIEVEMENTS =
  'https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/' +
  `?gameid=${STEAM_APPID}`;
/** The per-fighter achievements are `ach_match_won_<token>`; this one is the
 *  "won with everyone" aggregate and is not a fighter. Named rather than
 *  filtered by heuristic, so a future `ach_match_won_ranked` does not silently
 *  become a thirteenth roster row. */
const ACH_AGGREGATE = 'ach_match_won_all';

/** Politeness, not rate-limit avoidance. Four requests at this pacing is ~5s,
 *  and every one of these surfaces is quota-free. */
const PACING_MS = 1600;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'user-agent': 'avatar-replay-database/roster-check' },
  });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  const body = await res.text();
  await sleep(PACING_MS);
  return body;
}

/** Tags to spaces, then collapse — for reading prose out of the store's
 *  HTML-in-JSON description. */
const textOf = (html: string): string =>
  normalizeText(
    html
      .replace(/<[^>]*>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&#8217;|&rsquo;/g, "'")
      .replace(/&nbsp;/g, ' '),
  );

export interface VendorFighter {
  /** `fighters[].key` — the same string as our roster id, which is a finding
   *  rather than a coincidence: the design handoff took its ids from here. */
  key: string;
  /** `fighters[].name` — the vendor's own short display name. */
  name: string;
  /** `fighters[].element` — air / water / earth / fire. */
  element: string;
}

export interface RosterScrape {
  /** The chunk the fighters were read out of, for the error messages. */
  chunkUrl: string;
  /** paramountgames.com `fighters[]`. EIGHT today — a partial widget. */
  site: VendorFighter[];
  /** `ach_match_won_<token>` suffixes, aggregate removed. TWELVE today, and this
   *  is the complete enumeration. */
  achievementTokens: string[];
  /** The count the store description states in prose, or null if the sentence
   *  changed shape. */
  statedCount: number | null;
  /** Steam DLC app ids. `[5017890]` (the Deluxe Edition Upgrade) today — a
   *  character DLC appearing here is a Year 1 Pass fighter shipping. */
  dlc: number[];
  /** The Year 1 Pass sentence, verbatim, or null if it is no longer on the
   *  page. It is the only vendor text that names the five gated fighters. */
  passText: string | null;
}

/**
 * Enumerate the roster from the vendor's own surfaces.
 *
 * Every regex below is anchored on a STRUCTURE the page is built from — a route
 * path, an object literal's field order, an achievement id prefix — rather than
 * on a hash, a position or a count. A scrape that reads zero is reported as
 * unreadable by the caller and never as "the vendor removed a character".
 */
export async function scrapeRoster(): Promise<RosterScrape> {
  const page = await get(PG_PAGE);
  const chunkPath = PG_CHUNK_ROUTE.exec(page);
  if (!chunkPath) {
    throw new Error(
      `no ${PG_CHUNK_ROUTE.source} script on ${PG_PAGE} — the site's route layout changed; ` +
        `re-read the page's <script src> list before trusting anything else here`,
    );
  }
  const chunkUrl = `${PG_ORIGIN}/${chunkPath[0]}`;
  const chunk = await get(chunkUrl);

  // The four fields are read as one ordered literal rather than four lookups:
  // the array is minified and every other object in the bundle also has a
  // `name`, so `key` immediately followed by `element` is what identifies a
  // fighter entry.
  const site: VendorFighter[] = [
    ...chunk.matchAll(/\{key:"([a-z0-9-]+)",element:"([a-z]+)",number:"[^"]*",name:"([^"]*)"/g),
  ].map((m) => ({ key: m[1]!, element: m[2]!, name: normalizeText(m[3]!) }));

  const achJson = JSON.parse(await get(STEAM_ACHIEVEMENTS)) as {
    achievementpercentages?: { achievements?: { name: string }[] };
  };
  const achievementTokens = (achJson.achievementpercentages?.achievements ?? [])
    .map((a) => a.name)
    .filter((n) => n.startsWith('ach_match_won_') && n !== ACH_AGGREGATE)
    .map((n) => n.slice('ach_match_won_'.length))
    .sort();

  const app = JSON.parse(await get(STEAM_APPDETAILS)) as Record<
    string,
    { success?: boolean; data?: { detailed_description?: string; dlc?: number[] } }
  >;
  const data = app[String(STEAM_APPID)]?.data;
  const description = textOf(data?.detailed_description ?? '');
  const counted = /Choose from (\d+) playable characters/i.exec(description);
  const pass = /Year 1 Pass\s+(Adds [^●]+?)(?:\s*●|$)/i.exec(description);

  return {
    chunkUrl,
    site,
    achievementTokens,
    statedCount: counted ? Number(counted[1]) : null,
    dlc: data?.dlc ?? [],
    passText: pass ? pass[1]!.trim() : null,
  };
}

// ── standalone `--scrape` ───────────────────────────────────────────────────
// isMain, not a bare argv check: `--check` and `--scrape` are taken by more than
// one script in this repo's pipeline, and a bare flag test fires a validator
// inside an unrelated run, where its process.exit(1) kills work that was doing
// something else.
const isMain = !!process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop()!);
if (isMain && process.argv.includes('--scrape')) {
  const scrape = await scrapeRoster();
  console.log(
    `roster scrape\n` +
      `  ${PG_PAGE}\n` +
      `    chunk ${scrape.chunkUrl}\n` +
      `    fighters[] ${scrape.site.length}: ` +
      `${scrape.site.map((f) => `${f.key}/${f.element}`).join(', ')}\n` +
      `  steam app ${STEAM_APPID}\n` +
      `    ach_match_won_* ${scrape.achievementTokens.length}: ` +
      `${scrape.achievementTokens.join(', ')}\n` +
      `    store prose states ${scrape.statedCount ?? 'no'} playable characters\n` +
      `    dlc ${scrape.dlc.join(', ') || 'none'}\n` +
      `    year 1 pass: ${scrape.passText ?? '(sentence not found)'}`,
  );
}
