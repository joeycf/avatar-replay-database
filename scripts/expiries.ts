/**
 * Self-expiring gates — things the DATA can tell us are due, rather than things
 * a human has to remember.
 *
 * THREE SEVERITIES, AND THE DIFFERENCE BETWEEN THEM IS THE WHOLE DESIGN:
 *
 *   scripts/characters.ts  (manual roster run)  → process.exit(1)
 *   scripts/parse.ts       (daily cron path)    → NEVER exits; prints a FAILURE
 *                                                 banner and writes an
 *                                                 "## ⚠ ACTION REQUIRED" block
 *                                                 at the top of data/report.md
 *   .github/workflows/…    (daily cron)         → a FINAL step, AFTER commit and
 *                                                 push, that exits 1
 *
 * A hard exit in parse.ts would fail `npm run data:build` and stop the daily
 * refresh entirely, which is strictly worse than the misfiling it warns about:
 * a day of stale data costs more than a day of a fighter filed under the wrong
 * accent. So the daily path stays soft, the data gets pushed, and the WORKFLOW
 * goes red afterwards so the pending work is impossible to miss.
 *
 * THE RED WORKFLOW AND THE exit 1 ARE THE DESIGN, NOT A BUG. Clear them by
 * doing the work below — never by deleting the check.
 *
 * ── THIS FILE OWNS FOUR OF THE FIVE EXPIRY KINDS ───────────────────────
 * 'unreleased-character', 'unreleased-support', 'dormant-channel' and
 * 'stale-patch-table'. The fifth, 'missing-fan-kit', belongs to scripts/art.ts,
 * beside data/art-provenance.json — the licence finding it re-checks. It is
 * named here once so nobody has to wonder whether this is the file that went
 * quiet about it.
 *
 * THE PATCH ARM IMPORTS ITS NUMBERS, IT DOES NOT RESTATE THEM. STALE_PATCH_DAYS,
 * CONFIRMED_QUIET_THROUGH and PATCHES all come from scripts/patches.ts, which
 * measured the cadence beside the boundary table it describes and says so in
 * its own header. A threshold copied into this file is a threshold that goes
 * stale in two places at once — and a threshold ported from another vendor is
 * how a sibling spent seven weeks red through a known hiatus.
 *
 * ── THE UNRELEASED GATE NEEDS A WINDOW, NOT A DATE (checklist 11d) ────────
 * Every sibling's version of this table is keyed on a release date, because
 * every sibling's vendor published one. THIS VENDOR HAS PUBLISHED NONE, for any
 * of its six announced fighters. Its exact words are "over the course of the
 * season" and "later this year". The only "Fall 2026" in existence is on a fan
 * wiki — and it has already leaked into this repo once, at
 * design/handoff/tokens.css:67, which describes Tagah as "Fall 2026 (announced
 * 2026-07-23, exact date pending)". That sentence is a third-party guess
 * wearing a design handoff's authority, and re-reading it as a vendor date is
 * exactly the failure this file exists to prevent. Nothing below invents a date.
 *
 * SO THE GATE FIRES ON THE FIGHTER, NOT ON THE CALENDAR. Three triggers, in
 * descending order of how much they prove:
 *
 *   1. SHIPPED — the fighter's own name is in the committed corpus. Footage
 *      exists before an announcement reaches anyone here, and it is measured
 *      with the SAME matcher the parser uses, not a lookalike regex.
 *   2. BACKSTOP — the vendor's own window has closed. "later this year",
 *      published 2026-07-23, cannot still be true on 2027-01-01. That is
 *      arithmetic on the vendor's sentence, not a guess at a day.
 *   3. REVIEW — a date to LOOK AGAIN, labelled as such in the row and in the
 *      action text. It buys nothing except somebody running
 *      `npm run data:roster-check`, which is the real detector.
 *
 * Run: npm run data:expiries   (tsx scripts/expiries.ts --check)
 */

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CHANNELS } from './channels';
import { CONFIRMED_QUIET_THROUGH, PATCHES, STALE_PATCH_DAYS } from './patches';
import { buildAliasMatcher, buildSupportIndex } from './roster';
import type { Expiry, SupportRecord } from '../types/index';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SUPPORTS_FILE = join(ROOT, 'data/supports.json');
const REPLAYS = join(ROOT, 'data/replays.json');

/**
 * How many supports each fighter has, stated by the vendor rather than counted
 * by us: "Support Characters — Choose from three support characters to
 * accompany your fighter" (Steam appdetails 2424420 detailed_description, and
 * the identical sentence on the PlayStation and Xbox store pages; re-read live
 * 2026-09-18). Twelve fighters × three is the 36 the support gate counts down
 * from.
 */
export const SUPPORTS_PER_FIGHTER = 3;

/**
 * The last day a full index sweep confirmed the support table is still short.
 *
 * THIS IS THE DIFFERENCE BETWEEN A CADENCE AND A PERMANENTLY RED WORKFLOW. The
 * shortfall is real, it is known, and NOBODY HERE CAN CLEAR IT: it clears when a
 * third party prints a name in a column we read. A gate that goes due every day
 * until that happens is an alarm that fires through a known-quiet quarter, and
 * an alarm nobody reads is worse than no alarm — which is a lesson this
 * platform has already paid for, in Strive's stale-patch threshold.
 *
 * So the gate asks a question somebody CAN answer: "has anyone re-swept the
 * index lately?" Bumping this date IS the record that they did, the same way
 * Tōkon's CONFIRMED_QUIET_THROUGH records a patch feed read as quiet
 * (tokon-replay-database/scripts/patches.ts). Bump it only after an actual
 * sweep — its whole value is that it is a claim about work done.
 */
export const SUPPORTS_SWEPT_THROUGH = '2026-09-18';

/**
 * How long a support sweep stays fresh.
 *
 * THIRTY DAYS, MEASURED OFF THE CATALOGUE'S OWN GROWTH RATHER THAN CHOSEN. The
 * index went from 231 rows on 2026-09-16 to 258 on 2026-09-18 — 13.5 rows a day
 * — and that two-day window produced a support name no earlier sweep had ever
 * seen (`Master Piandao`, row 497093, which is why Sokka is no longer short).
 * Thirty days at that rate is roughly 400 further rows, more than the 258 the
 * whole table was built from, so a sweep cannot go badly stale inside one. It
 * costs six quota-free requests.
 */
const SUPPORT_SWEEP_STALE_DAYS = 30;

/**
 * Announced-but-unreleased fighters. SIX ROWS — FIVE NAMED FIGHTERS AND ONE
 * UNNAMED SLOT — AND FOUR OF THEM ARE ONE SENTENCE'S WORTH OF EVIDENCE.
 *
 * The Year 1 Pass is sold with its contents named and its schedule not:
 * "Adds five iconic characters over the course of the season: Iroh, Ty Lee, Lin
 * Beifong, Bolin and the winner of the Year 1 Character Vote." That sentence is
 * on Steam's app page, on the Steam DLC listing 5017890 and on Xbox
 * 9N4WK9FB0SHV, and it is the whole of what the vendor has said about when.
 *
 * THE FIFTH PASS SLOT HAS NO NAME AND THEREFORE NO ID. The candidates are
 * Tenzin, Kuvira, Amon, King Bumi and Asami Sato (reported from the vendor's
 * EVO 2026 panel), the vote is a Digital Deluxe pre-order privilege, and no
 * winner announcement exists on the vendor's YouTube, its Bluesky, the Steam
 * news feed or the patch notes. It gets a row anyway, keyed on the SLOT rather
 * than on a guess at the fighter: an unnamed row that fires is a person going to
 * look, and a named row that is wrong is a fabricated fighter on the roster.
 *
 * NONE OF THESE HAS SHIPPED as of 2026-09-18, and that is measured five ways:
 * Steam's `dlc` array holds only [5017890] (the Deluxe Edition Upgrade); all 21
 * Steam news posts and the Patch 2.5 notes mention no new fighter; none of the
 * vendor's 50 YouTube uploads is a DLC release trailer; the index source's
 * fighter column holds exactly the twelve launch names across 516 sides; and
 * ComboForge lists 12 characters for this game.
 */
export interface UnreleasedFighter {
  id: string;
  /** The vendor's own spelling. Empty for the unnamed vote slot. */
  name: string;
  /** Spellings that would appear in a title the day footage exists. Used by
   *  `unreleasedSightings` with the real matcher — so a short or ambiguous form
   *  here is a false alarm, not a false record. */
  aliases: string[];
  /** The vendor's own words about WHEN, verbatim. Never paraphrased, because a
   *  paraphrase is where a window becomes a date. */
  window: string;
  /** Where those words are published. */
  source: string;
  /** The last day the vendor's own window can still be true, or null when the
   *  vendor's words do not bound one. DERIVED ARITHMETIC ON THE VENDOR'S OWN
   *  SENTENCE, and the row says which sentence. */
  backstop: string | null;
  /** The day to LOOK AGAIN. Not a release date, and the action text says so. */
  reviewAfter: string;
  /** The accent the design handoff already derived, so release day is a one-line
   *  change rather than a design task. Asserted against tokens.css by
   *  scripts/characters.ts. Absent for the unnamed slot, which has no token
   *  on purpose. */
  accent?: string;
  note: string;
}

// The REVIEW date on the four Pass rows and on Tagah is 2026-10-13, the day
// after EVO France closes (10–12 October 2026). That is a THIRD-PARTY
// expectation and it is used for the only thing third-party expectation is good
// for: deciding when to look. rooflemonger's PAX West recap (ANQaLj6tpOs,
// 2026-09-05) reports "No DLC talk yet sadly, probably saving that for Evo
// France". It is not written into `window`, it is not a release date, and no
// roster row will ever be created from it.
const REVIEW_AFTER_EVO_FRANCE = '2026-10-13';
const YEAR_1_PASS_SENTENCE =
  'Adds five iconic characters over the course of the season: Iroh, Ty Lee, ' +
  'Lin Beifong, Bolin and the winner of the Year 1 Character Vote.';
const YEAR_1_PASS_SOURCE = 'https://store.steampowered.com/api/appdetails?appids=2424420';
// The vendor dates its own launch in the page chunk that carries the roster
// widget: dates:{…,digitalLaunch:"2026-07-23"}. "Year 1" counted from it closes
// 2027-07-22. Stated as the outside edge of the vendor's own word, never as a
// release window for any particular fighter.
const YEAR_1_CLOSES = '2027-07-22';

export const UNRELEASED: UnreleasedFighter[] = [
  {
    id: 'iroh',
    name: 'Iroh',
    aliases: ['Uncle Iroh'],
    window: 'over the course of the season',
    source: YEAR_1_PASS_SOURCE,
    backstop: YEAR_1_CLOSES,
    reviewAfter: REVIEW_AFTER_EVO_FRANCE,
    accent: '#FCB26F',
    note: `Year 1 Pass. Vendor sentence: "${YEAR_1_PASS_SENTENCE}" — names, no dates. Third-party reporting of the reveal order puts him fourth of five, which is reporting and not a schedule.`,
  },
  {
    id: 'ty-lee',
    name: 'Ty Lee',
    // `Ty` alone is deliberately absent: two letters plus a common given name,
    // and the corpus has handles that would eat it. `Ty Lee` covers `TyLee` and
    // `Ty-Lee` through the matcher's flexible class.
    aliases: [],
    window: 'over the course of the season',
    source: YEAR_1_PASS_SOURCE,
    backstop: YEAR_1_CLOSES,
    reviewAfter: REVIEW_AFTER_EVO_FRANCE,
    accent: '#F59ECF',
    note: `Year 1 Pass. Vendor sentence: "${YEAR_1_PASS_SENTENCE}" — names, no dates. Second of five by third-party reveal order.`,
  },
  {
    id: 'lin-beifong',
    name: 'Lin Beifong',
    // `Lin` alone is absent for the same reason as `Ty`, and `Beifong` alone is
    // BANNED in scripts/characters.ts: Toph Beifong is already on the roster, so
    // a bare surname resolves to a coin flip the day this row clears.
    aliases: [],
    window: 'over the course of the season',
    source: YEAR_1_PASS_SOURCE,
    backstop: YEAR_1_CLOSES,
    reviewAfter: REVIEW_AFTER_EVO_FRANCE,
    accent: '#A8BEAC',
    note: `Year 1 Pass. Vendor sentence: "${YEAR_1_PASS_SENTENCE}" — names, no dates. Third of five by third-party reveal order.`,
  },
  {
    id: 'bolin',
    name: 'Bolin',
    aliases: [],
    window: 'over the course of the season',
    source: YEAR_1_PASS_SOURCE,
    backstop: YEAR_1_CLOSES,
    reviewAfter: REVIEW_AFTER_EVO_FRANCE,
    accent: '#D3D979',
    note: `Year 1 Pass. Vendor sentence: "${YEAR_1_PASS_SENTENCE}" — names, no dates. First of five by third-party reveal order.`,
  },
  {
    // NO NAME, NO ACCENT, NO TOKEN, AND THAT IS THE ROW'S WHOLE POINT. The slot
    // is sold and the fighter is not chosen. An id here is the SLOT's id, so
    // nothing downstream can mistake it for a fighter: it will never match a
    // title, it owns no accent, and clearing it means SPLITTING it into a real
    // row on reveal rather than editing this one.
    id: 'year-1-vote-winner',
    name: '',
    aliases: [],
    window: 'the winner of the Year 1 Character Vote',
    source: YEAR_1_PASS_SOURCE,
    backstop: YEAR_1_CLOSES,
    reviewAfter: REVIEW_AFTER_EVO_FRANCE,
    note: 'Year 1 Pass slot five, unnamed. Candidates reported from the vendor\'s EVO 2026 panel: Tenzin, Kuvira, Amon, King Bumi, Asami Sato. The vote is a Digital Deluxe pre-order privilege ("Players who pre-order the Digital Deluxe Edition can vote to choose the final character in the Year 1 Pass!", Xbox 9N4WK9FB0SHV). No winner has been announced on any vendor surface. On reveal: split this row into a named one, get an accent from a Claude Design session, and leave this one deleted.',
  },
  {
    id: 'tagah',
    name: 'Tagah',
    aliases: [],
    window: 'for FREE later this year',
    source: 'https://x.com/avatar_fighters/status/2080398201811558791',
    // "later this year", published 2026-07-23, cannot still be true on
    // 2027-01-01. Arithmetic on the vendor's own sentence.
    backstop: '2026-12-31',
    reviewAfter: REVIEW_AFTER_EVO_FRANCE,
    accent: '#F7E6C3',
    note: 'Free DLC, announced 2026-07-23 on the vendor\'s X account and its YouTube (RCqSVv1GnlY). DO NOT RE-READ design/handoff/tokens.css:67 AS A SOURCE — it says "Fall 2026", the vendor never did, and that phrase exists only on a fan wiki. Not part of the Year 1 Pass.',
  },
];

const today = (): string => new Date().toISOString().slice(0, 10);
const daysBetween = (a: string, b: string): number =>
  Math.floor((Date.parse(b) - Date.parse(a)) / 86_400_000);

/** One place a gated fighter's name turned up in the committed corpus. */
export interface Sighting {
  id: string;
  /** The record it was seen on, and the text that matched. */
  where: string;
}

export interface SightingScan {
  sightings: Sighting[];
  /** How many records were read. ZERO is reported, never treated as clean. */
  scanned: number;
  /** Why the scan could not run, when it could not. */
  unavailable: string | null;
}

/**
 * Look for a gated fighter in the committed corpus.
 *
 * THIS IS THE ARM THAT FIRES ON THE REAL EVENT. Footage of a new fighter exists
 * the day they ship and reaches this repo through the ordinary cron, weeks
 * before anybody here reads an announcement. Every other arm of this gate fires
 * on a clock.
 *
 * IT USES THE PARSER'S OWN MATCHER, which is the only reason it can be trusted:
 * a bespoke regex here would drift from the boundary guards and the longest-first
 * ordering that make short names safe, and the first thing it would do is fire
 * on `Lin` inside a handle. The rows above carry only spellings that survive
 * that matcher.
 *
 * A MISSING data/replays.json IS NOT A CLEAN SCAN and does not silently pass:
 * `unavailable` is returned and the caller prints it. This is a young repo and
 * the file is `[]` until the first parse, so the quiet-failure mode is the
 * likely one.
 */
export async function unreleasedSightings(): Promise<SightingScan> {
  let records: { id?: string; title?: string }[];
  try {
    const parsed = JSON.parse(await readFile(REPLAYS, 'utf8')) as unknown;
    if (!Array.isArray(parsed)) throw new Error('not an array');
    records = parsed as { id?: string; title?: string }[];
  } catch (e) {
    return { sightings: [], scanned: 0, unavailable: `${REPLAYS}: ${(e as Error).message}` };
  }

  const matcher = buildAliasMatcher(
    UNRELEASED.filter((u) => u.name).map((u) => ({
      id: u.id,
      name: u.name,
      extra: { aliases: u.aliases },
    })),
    [],
  );

  const sightings: Sighting[] = [];
  const seen = new Set<string>();
  for (const r of records) {
    const title = r.title ?? '';
    for (const span of matcher.find(title)) {
      const key = `${span.fighter}`;
      if (!span.fighter || seen.has(key)) continue;
      seen.add(key);
      sightings.push({ id: span.fighter, where: `${r.id ?? '(no id)'}: "${title}"` });
    }
  }
  return { sightings, scanned: records.length, unavailable: null };
}

/** data/supports.json, or null before the first roster build has written one. */
async function readSupports(): Promise<SupportRecord[] | null> {
  try {
    const parsed = JSON.parse(await readFile(SUPPORTS_FILE, 'utf8')) as unknown;
    return Array.isArray(parsed) ? (parsed as SupportRecord[]) : null;
  } catch {
    return null;
  }
}

/**
 * Which of the three triggers fired, carried on the row rather than left for a
 * caller to re-derive from prose.
 *
 * IT EXISTS SO THE ROSTER BUILD CAN GRADE ITSELF. scripts/characters.ts
 * hard-stops on a roster fact this rebuild would bake in WRONG — a fighter who
 * has shipped, or a vendor window that has closed — and must not hard-stop on a
 * look-again date, which would make the roster unbuildable for a reason that has
 * nothing to do with the roster. The reference repo learned that with a stale
 * patch table and a threshold ported from another vendor.
 */
export type UnreleasedTrigger = 'shipped' | 'backstop' | 'review';

export type DueExpiry = Expiry & { trigger?: UnreleasedTrigger };

/** A row this rebuild would bake in wrong, as opposed to one that only needs
 *  somebody to go and look. */
export const blocksRosterBuild = (e: DueExpiry): boolean =>
  e.kind === 'unreleased-character' && e.trigger !== 'review';

/** Everything whose gate has now tripped. Empty is the happy path. */
export async function dueExpiries(asOf: string = today()): Promise<DueExpiry[]> {
  const due: DueExpiry[] = [];

  // ── 1. UNRELEASED FIGHTERS ────────────────────────────────────────────────
  const scan = await unreleasedSightings();
  const sighted = new Map(scan.sightings.map((s) => [s.id, s.where]));
  for (const u of UNRELEASED) {
    const label = u.name || `the unnamed slot "${u.id}"`;
    const seen = sighted.get(u.id);
    const backstopPassed = !!u.backstop && asOf > u.backstop;
    const reviewDue = asOf >= u.reviewAfter;
    if (!seen && !backstopPassed && !reviewDue) continue;

    const trigger: UnreleasedTrigger = seen ? 'shipped' : backstopPassed ? 'backstop' : 'review';
    const headline = seen
      ? `SHIPPED — ${label} is named in a committed record (${seen}). Footage exists.`
      : backstopPassed
        ? `BACKSTOP — the vendor said "${u.window}" (${u.source}) and that window closed ` +
          `${u.backstop}.`
        : `REVIEW — this is a look-again date, NOT a release date. The vendor's own words are ` +
          `still "${u.window}" (${u.source}) and it has published no date.`;

    due.push({
      kind: 'unreleased-character',
      id: u.id,
      trigger,
      date: seen ? asOf : backstopPassed ? u.backstop! : u.reviewAfter,
      action:
        `${headline} Run \`npm run data:roster-check\` — it reads Valve's achievement schema for ` +
        `app 2424420, which gains an \`ach_match_won_<token>\` row the day a fighter ships and ` +
        `is the only complete machine-readable enumeration of this roster. IF THEY HAVE ` +
        `SHIPPED: add a ROSTER row in scripts/characters.ts with the vendor's SHORT display ` +
        `name (the achievement text and the patch notes, never the handoff's longer form), its ` +
        `\`steamToken\` from that schema, its \`siteKey\` if the paramountgames widget now lists ` +
        `it, its nation, and the aliases its uploaders actually write — respecting ` +
        `BANNED_ALIASES, which already refuses \`Beifong\` because two Beifongs cannot share a ` +
        `surname. Add its THREE supports to SUPPORTS with an index row id each; a support with ` +
        `no index row stays out. ${
          u.accent
            ? `The accent is already derived: --char-${u.id} ${u.accent} in ` +
              `design/handoff/tokens.css and app/app.config.ts.`
            : `Get an accent from a Claude Design session — never invent one — and add ` +
              `--char-<id> to design/handoff/tokens.css AND accents in app/app.config.ts; ` +
              `scripts/characters.ts fails on either one missing.`
        } Drop this row from UNRELEASED, then run \`npm run data:characters\` and ` +
        `\`npm run data:art\`. IF THEY HAVE NOT SHIPPED: re-date \`reviewAfter\` and say in the ` +
        `note what you checked — do not delete the row, and do not write a release date the ` +
        `vendor has not published.`,
    });
  }

  // ── 2. THE SUPPORT NAMESPACE'S OWN SHORTFALL ─────────────────────────────
  // The vendor states three per fighter and the index has evidenced 34 of 36.
  //
  // WHICH FIGHTERS ARE SHORT IS DATA-DRIVEN: it counts data/supports.json rather
  // than restating a number, so the row disappears the moment somebody evidences
  // a missing support and reappears if a row is ever deleted. WHEN IT FIRES is
  // the sweep cadence, not the shortfall — see SUPPORTS_SWEPT_THROUGH for why a
  // gap nobody here can close must not be a gate that is due every day.
  const supports = await readSupports();
  const sweepAge = daysBetween(SUPPORTS_SWEPT_THROUGH, asOf);
  if (supports?.length && sweepAge > SUPPORT_SWEEP_STALE_DAYS) {
    const index = buildSupportIndex(supports);
    const owners = [...new Set(supports.map((s) => s.owner))].sort();
    for (const owner of owners) {
      const have = index.supportsOf(owner);
      if (have.length >= SUPPORTS_PER_FIGHTER) continue;
      due.push({
        kind: 'unreleased-support',
        id: owner,
        date: SUPPORTS_SWEPT_THROUGH,
        action:
          `${owner} owns ${have.length} support(s) (${have.join(', ')}) and the vendor states ` +
          `${SUPPORTS_PER_FIGHTER} ("Choose from three support characters to accompany your ` +
          `fighter"). The index has not been swept for ${sweepAge} days. The missing one is not a ` +
          `bug and not a guess — it is a name the index has never printed. Re-sweep ` +
          `https://replaytheater.app/api/matches?game=avatar (paged, >=1.5s apart, quota-free) ` +
          `and read the char2 column on this fighter's rows. IF A NEW NAME APPEARS: add it to ` +
          `SUPPORTS in scripts/characters.ts with its row id as evidence and remove it from ` +
          `BANNED_ALIASES. The two known candidates are banned there on purpose — \`Hakoda\` for ` +
          `katara (four title/description attestations across two channels, zero index rows) and ` +
          `\`Guru Pathik\` for avatar-aang (community wiki only, zero attestations). Until one is ` +
          `evidenced its spans reach the residue gate as a counted line, which is the detector; ` +
          `do not add either from memory. IF THE SWEEP FINDS NOTHING NEW: bump ` +
          `SUPPORTS_SWEPT_THROUGH in scripts/expiries.ts to today and commit it — that records ` +
          `the work and quiets this for ${SUPPORT_SWEEP_STALE_DAYS} days.`,
      });
    }
  }

  // ── 3. DORMANT CHANNELS ───────────────────────────────────────────────────
  // This kind is this game's addition and it exists because the collapse guard
  // cannot protect a 2-record channel: 32 intakes, 20 of them under ten records.
  // A channel that stops uploading does not fail anything — it just quietly
  // stops contributing, and on a corpus this size nobody notices one going
  // silent. FreezeWatch carries the measurement; this turns it into a date.
  for (const ch of CHANNELS) {
    const w = ch.freezeWatch;
    if (!w) continue;
    const quiet = daysBetween(w.lastMarked, asOf);
    if (quiet <= w.reviewAfterDays) continue;
    due.push({
      kind: 'dormant-channel',
      id: ch.id,
      date: w.lastMarked,
      action:
        `${ch.name} has published nothing marked since ${w.lastMarked} — ${quiet} days, past its ` +
        `${w.reviewAfterDays}-day watch. It held ${w.recordsAtRecon} record(s) at recon. Check ` +
        `the channel: if it has moved on to another game, set \`frozen: { since, reason, ` +
        `records }\` on its entry in scripts/channels.ts with the record count the last full ` +
        `parse produced — that pin is hard-asserted and is the deliberate-prune mechanism. If it ` +
        `is simply slow, push \`freezeWatch.lastMarked\` to its newest marked upload. Do not ` +
        `delete the channel: its committed records are still real.`,
    });
  }

  // ── 4. THE PATCH TABLE GOES STALE SILENTLY ─────────────────────────
  // A patch missing from scripts/patches.ts does not fail: it files every replay
  // since under the previous token, which renders, filters and passes every
  // count assertion while being wrong. This alarm reads only that table's own
  // newest date and the clock, so no change to the vendor's post titles can
  // blind it — which is why it sits beside `npm run data:patch-check`, the real
  // detector, rather than instead of it.
  //
  // COUNTED FROM THE LATER OF the newest patch and the last CONFIRMED-QUIET feed
  // read (Tōkon's lesson, carried in patches.ts): a vendor that simply ships
  // nothing would otherwise keep this red every day while patch-check is clean
  // the whole time. A quiet date that is malformed or in the future is IGNORED
  // rather than trusted — its age would be NaN or negative, both compare false
  // against the threshold, and the alarm would never fire again.
  const newest = PATCHES.at(-1);
  const quiet =
    /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(CONFIRMED_QUIET_THROUGH) && CONFIRMED_QUIET_THROUGH <= asOf
      ? CONFIRMED_QUIET_THROUGH
      : '';
  const since = newest && quiet > newest.start ? quiet : newest?.start;
  if (newest && since && daysBetween(since, asOf) > STALE_PATCH_DAYS) {
    const age = daysBetween(since, asOf);
    due.push({
      kind: 'stale-patch-table',
      id: 'patch-table',
      date: since,
      action:
        (since === newest.start
          ? `The newest patch in scripts/patches.ts is ${newest.version}, ${age} days old `
          : `The newest patch in scripts/patches.ts is ${newest.version}, and the feed was last ` +
            `confirmed quiet ${since}, ${age} days ago `) +
        `(threshold ${STALE_PATCH_DAYS}). Run \`npm run data:patch-check\` against the vendor's ` +
        `own feed. IF A PATCH SHIPPED and is not in the table, every replay since is filed under ` +
        `the previous token — it renders, it filters, and it is wrong. IF GENUINELY NOTHING ` +
        `SHIPPED, run it as \`npm run data:patch-check -- --confirm-quiet\` and commit ` +
        `scripts/patches.ts: that records today and quiets this for ${STALE_PATCH_DAYS} days. Do ` +
        `not raise STALE_PATCH_DAYS to silence it — patches.ts measured it off this table's own ` +
        `gaps (6, 8 and 27 days) at n = 3 and says so.`,
    });
  }

  return due;
}

/** Rendered into data/report.md by parse.ts when anything is due. */
export function expiryBlock(due: Expiry[]): string[] {
  if (!due.length) return [];
  return [
    '## ⚠ ACTION REQUIRED',
    '',
    `${due.length} self-expiring gate(s) are due:`,
    '',
    ...due.flatMap((d) => [`- **${d.id}** (${d.kind}, due ${d.date})`, `  ${d.action}`, '']),
  ];
}

// ── standalone `--check` ─────────────────────────────────────────────────────
// The workflow's LAST step. It runs after the data has been committed and
// pushed, so a red run never costs a refresh — it only makes the pending work
// impossible to ignore.
//
// isMain, not a bare argv check: `--check` is taken by more than one script in
// this pipeline, and a bare flag test fires this validator inside an unrelated
// run where its process.exit(1) kills work that was doing something else.
const isMain = !!process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop()!);
if (isMain && process.argv.includes('--check')) {
  const scan = await unreleasedSightings();
  const due = await dueExpiries();
  // The scan's own health is printed either way. A sightings arm that silently
  // read zero records looks exactly like a sightings arm that found nothing.
  console.log(
    scan.unavailable
      ? `! the corpus scan could not run — ${scan.unavailable}. The SHIPPED arm of the ` +
          `unreleased gate is asleep; only the vendor's windows and the review dates are live.`
      : `  corpus scan: ${scan.scanned} record(s) read, ${scan.sightings.length} gated fighter ` +
          `name(s) sighted`,
  );
  // THE STANDING GAPS ARE PRINTED ON THE HAPPY PATH TOO. A gate on a cadence is
  // quiet between sweeps by design, and "quiet" must not read as "complete" —
  // the support table is knowingly two rows short and that has to be visible on
  // the run that says everything is fine.
  const committed = await readSupports();
  if (committed?.length) {
    const index = buildSupportIndex(committed);
    const short = [...new Set(committed.map((s) => s.owner))]
      .filter((o) => index.supportsOf(o).length < SUPPORTS_PER_FIGHTER)
      .sort();
    console.log(
      `  supports: ${committed.length} of ${
        [...new Set(committed.map((s) => s.owner))].length * SUPPORTS_PER_FIGHTER
      } evidenced, last swept ${SUPPORTS_SWEPT_THROUGH} (${daysBetween(
        SUPPORTS_SWEPT_THROUGH,
        today(),
      )}d ago, stale at ${SUPPORT_SWEEP_STALE_DAYS}d)` +
        (short.length ? ` · short: ${short.join(', ')}` : ''),
    );
  }
  if (!due.length) {
    console.log(`✓ no expiries due — ${UNRELEASED.length} unreleased row(s) pending`);
    process.exit(0);
  }
  console.error(`\n✖ ${due.length} EXPIRY(S) DUE — this step is designed to go red.\n`);
  for (const d of due) {
    console.error(`  ${d.id}  (${d.kind}, due ${d.date})`);
    console.error(`    ${d.action}\n`);
  }
  console.error('  Clear these by doing the work above. Never by deleting the check.');
  process.exit(1);
}
