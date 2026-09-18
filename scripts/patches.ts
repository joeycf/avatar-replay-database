/**
 * The Avatar Legends patch table — the single boundary authority, and the only
 * input to `MatchVideo.era` and `MatchVideo.patch`.
 *
 * ── ONE MODULE, TWO TABLES, AND THE TYPES ──────────────────────────────────
 * SF6's argument, adopted by every sibling since: eras and patches are not
 * independent. An era opens ON a patch, so `SEASONS[n].start` must equal the
 * start of the first patch nested under it, and a validator that cannot see
 * both tables cannot enforce that. The three boundary types live here too, and
 * NOT in types/index.ts — that file says so itself at the `MatchVideo.patch`
 * comment (types/index.ts:863-870: "scripts/patches.ts owns the boundary table
 * and its types; this file deliberately does not declare them"). Siblings put
 * them in types/index.ts; the committed contract for this build enumerates that
 * file and these are not in it, so one declaration, one owner.
 *
 * ── THE GRAMMAR: THE VENDOR VERSIONED ONE BUILD OUT OF FOUR ────────────────
 * Four post-launch builds shipped to a gameplay platform. The vendor published
 * a version string for exactly ONE of them, in the body of its own Steam post:
 *
 *     [h1]Patch 2.5
 *     [i]September 2, 2026[/i][/h1]
 *
 * There is no 1.x, no 2.0–2.4 and no launch version anywhere on Steam,
 * avatarfighters.com or in the press (Stage 0, 2026-09-16; the two Steam bodies
 * re-read live 2026-09-18). "Patch 3" is teased with no number attached to any
 * shipped build.
 *
 * So rules 4 and 4b disagree row by row: 4 says copy the vendor's version, 4b
 * says use the date when there is none, and here three of four rows have none.
 * Checklist 4d — written by this build from this table — resolves it: DATE
 * TOKENS FOR EVERY ROW, with the vendor's version carried as a display LABEL.
 * The reasons, in order of weight:
 *   · 2.5 has no published predecessor, so a mixed table cannot be ordered by
 *     version at all. ffcotw's version-order check (ffcotw scripts/patches.ts
 *     validate() check 4) and ggst's equivalent both run on n = 1 here and can
 *     never fire — a validator that cannot fail is worse than none.
 *   · ggst's validator FORBIDS the mixed shape outright: seasons.ts:835 rejects
 *     a date token on any row whose `announcedOn` is not 'launch' or 'beta'.
 *     Ported here it would reject 2026-07-29 and 2026-08-06, two real
 *     post-launch patches the vendor simply did not number. The CODE wins over
 *     the checklist where they disagree, and here the code of two siblings
 *     disagrees with itself; 4d is the ruling.
 *   · A date token is derivable for every row from a source that exists. A
 *     version token for the other three would have to be invented, which is the
 *     one thing step 4 forbids outright.
 *
 * ── THE SOURCE IS THE STEAM NEWS HUB, AND IT IS MEASURABLY INCOMPLETE ───────
 * `ISteamNews/GetNewsForApp/v2?appid=2424420` is the only vendor-authored
 * surface that is both machine-readable and a full archive (21 posts back to
 * 2025-10-28, re-read 2026-09-18). Everything else was measured and rejected in
 * Stage 0: avatarfighters.com/patchnotes is a single Squarespace page holding
 * only the newest patch, with `?format=rss` HTTP 400 and `?format=json`
 * disallowed by robots.txt; x.com needs a login (syndication HTTP 429); the
 * vendor's Bluesky has posted nothing since 2026-06-27; paramountgames.com and
 * thegameplaygroup.com carry no patch surface; pm-studios.com is behind a
 * Cloudflare 403.
 *
 * It carries 2 of the 3 post-launch builds that reached Steam. The 2026-08-06
 * build — Replay Takeover, Steam/PS5 crossplay, standardized knockdown hurtboxes
 * and changes to SEVEN fighters — was announced on X only. That is why
 * OFF_STEAM_OK exists below and why scripts/patch-check.ts reads the Steam build
 * clock as well as the news feed: a checker pointed at a feed that is missing a
 * balance patch prints a tick forever, which is the ggst/ffcotw failure arriving
 * through a different door.
 *
 * ── THE DATE AUTHORITY IS THE BODY, THEN THE TITLE. NEVER THE POST DATE ─────
 * Patch 2.5 has four dates and three of them are wrong for this table:
 *   body      2026-09-02   ← the authority
 *   tweet     2026-09-02T13:45:54Z (snowflake 2095146198030032962)
 *   Steam post 2026-09-03T23:37:10Z — the storefront lagged the build by a day
 *   avatarfighters.com "Updated September 9, 2026" — an EDIT stamp on a page
 *                        that is overwritten in place, not a release date
 * The Steam public branch's own `timeupdated` is 2026-09-02T10:00:11Z
 * (buildid 25062979, read 2026-09-18), which agrees with the body and not with
 * the post. Keying on the post date would have filed every replay of 2026-09-02
 * and 09-03 under the previous patch.
 *
 * ── THREE PORTED RULES THAT ARE WRONG ON THIS GAME ─────────────────────────
 *   · Tōkon's patch-title gate `/patch\s*update/i` (tokon scripts/patch-check.ts:60)
 *     matches NEITHER Avatar title — both say "Game Update - <date>" — and
 *     non-matching titles are skipped without a word at that file's line 105.
 *     Ported verbatim it would report a clean table against an empty read.
 *   · ggst seasons.ts:835, above: date tokens allowed only on launch/beta rows.
 *   · A bare `/\d+\.\d+/` over the vendor's own bodies mints 5 patches, not 1.
 *     Measured 2026-09-18 across the feed: `2.5` and TWO `1.0`s inside the
 *     Patch 2.5 body ("Ranked Mode 1.0", twice), `29.99` in the pre-order post
 *     and `14.0` in the Toph trailer post. The site and the launch tweet add
 *     "up to 2.5 frame reduction". The version reader is anchored on the
 *     vendor's own `[h1]Patch ` prefix; see scripts/patch-check.ts.
 *
 * ── ONE ERA, AND NO PRE-RELEASE ERA ────────────────────────────────────────
 * The vendor has declared no balance season. "Year 1 Pass" is a five-fighter
 * character pass, not a balance era, and Patch 2.5 carries system-wide changes
 * (input buffer, damage scaling) that the vendor never calls a season. Step 4
 * says eras come from an explicit table and are never inferred, so there is one
 * era, it opens at LAUNCH, and it is labelled for what it is rather than
 * "Season 1" — which would name a season this game has never had.
 *
 * No pre-release era either, and that is decision 9 rather than an omission:
 * about twenty measured pre-launch records exist (types/index.ts, the
 * `preReleaseFrom` comment) and every channel is floored at LAUNCH, so nothing
 * needs a boundary before 2026-07-23. The moment a channel opts in, this file
 * grows the era FIRST — emit throws on a record whose patch no boundary
 * accounts for, which is correct and loud, but the coupling is better expressed
 * than discovered.
 *
 * ── WHAT THE PIPELINE TAKES FROM HERE ──────────────────────────────────────
 *   LAUNCH                 the fetch floor and the record floor (scripts/channels.ts
 *                          re-exports it; there is one declaration)
 *   patchForDate(d)        `patch: patchForDate(d).version`
 *   seasonToken(season)    `era: seasonToken(patchForDate(d).season)`
 *   buildPatchGroups()     → data/patchGroups.json, which app/app.config.ts imports
 *   STALE_PATCH_DAYS       the cadence alarm in scripts/expiries.ts
 *
 * Run: npm run data:patches   (validator; also runs inside `npm run typecheck`)
 *      tsx scripts/patches.ts --emit   (materialise data/patchGroups.json)
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** One shipped build, as a boundary row. */
export interface PatchBoundary {
  /** The token emitted on `MatchVideo.patch` and minted as a facet child id.
   *  AN ISO DAY ON EVERY ROW, including the one the vendor numbered — see the
   *  4d argument in the header. Must equal `start`. */
  version: string;
  /** ISO release day, inclusive. THE BODY DATE IS THE AUTHORITY: the storefront
   *  post lagged the build by a day on Patch 2.5, and the vendor's own site
   *  carries an "Updated" edit stamp a week later. */
  start: string;
  /** The vendor's own version string, verbatim and complete, for display only.
   *  Present on the one row that has one. Never parsed, never sorted on, and
   *  validated against the vendor's `Patch <n>` grammar so a hand edit cannot
   *  quietly put a build number or a feature version here. */
  label?: string;
  /** Where the vendor announced it. An undocumented row cannot hide, and an
   *  'x' row additionally has to be named in OFF_STEAM_OK. */
  announcedOn: 'launch' | 'steam' | 'x';
  /** The announcement permalink. Checked for shape by validate(). */
  url?: string;
  /** Builds the vendor shipped separately that this window absorbs, as prose.
   *  Never a token: nothing here is a patch id. */
  includes?: string[];
  /** Short community-facing hint, surfaced beside the child in the dropdown. */
  note?: string;
}

/** A patch plus its computed window and resolved era. */
export interface PatchWindow extends PatchBoundary {
  /** Exclusive end: the next patch's start inside the same era, else the era's
   *  end, else null (open). COMPUTED, never authored — a hand-written end is a
   *  second source of truth that drifts the moment a row is inserted. */
  end: string | null;
  season: number;
}

/** One balance era — the facet parent a patch nests under. */
export interface SeasonBoundary {
  season: number;
  /** ISO, inclusive. Must equal the start of its first patch. */
  start: string;
  /** ISO, exclusive; null = the open, current era. */
  end: string | null;
  /** False would mean "the vendor announced the date, the landing is
   *  unverified", and scripts/expiries.ts fails loud once such a date passes. */
  confirmed: boolean;
  /** Facet-parent display label. There is no engine default here worth taking:
   *  the platform's is `Season ${season}`, and this vendor has declared no
   *  season. */
  label?: string;
  note?: string;
}

/**
 * THE GAME'S LAUNCH DAY, the floor for the fetch walk, the record set and this
 * table (decision 9).
 *
 * 2026-07-23, verified three independent ways in Stage 0: Steam PICS
 * `steam_release_date` 2026-07-23T13:59:00Z (re-read 2026-09-18 and unchanged),
 * the PS Store `releaseDate` 2026-07-23T14:00:00Z, and the earliest of 3,468
 * Steam reviews at 2026-07-23T14:07:26Z with 601 of them that day. The vendor's
 * own launch-day post ("Newsletter - Launch Edition", 2026-07-23T23:55Z) says
 * "everyone that started mastering the elements today".
 *
 * Steam's store page and `appdetails` both say "Sep 10, 2026" and are WRONG —
 * the same date sits on the Deluxe Edition Upgrade DLC (5017890), and the
 * vendor's 2026-07-22 post says the game launches the next day. Xbox Series
 * launched separately on 2026-09-03, six weeks late, onto the 08-06 build; that
 * is a platform date, not a boundary, and no row opens there.
 *
 * scripts/channels.ts re-exports this rather than declaring its own, so the
 * fetch floor, the record floor and the era that has to cover them cannot drift
 * apart.
 */
export const LAUNCH = '2026-07-23';

/**
 * Days without a new patch before scripts/expiries.ts calls this table stale.
 *
 * 30, from the measured cadence and nothing else. The gaps this table actually
 * contains are 6, 8 and 27 days (launch → 07-29 → 08-06 → 09-02); patch to
 * patch alone they are 8 and 27. The platform rule — stated in ffcotw
 * scripts/expiries.ts and ggst scripts/seasons.ts, never in the checklist — is
 * to sit above every real gap so the alarm does not cry, and below the signal
 * of a MISS, which at the current cadence is about 54 days.
 *
 * Tōkon's 10 would already be red today (16 days since Patch 2.5) with nothing
 * wrong, and an alarm that is red for no reason is an alarm that gets muted.
 *
 * THIS IS n = 3 AND MUST BE RE-MEASURED AT THE NEXT PATCH. The cadence is
 * lengthening (6 → 8 → 27) and three gaps cannot separate a slow vendor from a
 * missed patch. validate() refuses a value at or below the largest gap the
 * table itself contains, so shortening it later is checked rather than trusted.
 *
 * This alarm is NOT the real check — `npm run data:patch-check` is. It is the
 * one that cannot go blind, because it reads only this table's own newest date
 * and the clock.
 */
export const STALE_PATCH_DAYS = 30;

/**
 * The last day a person read the vendor's feed and found no patch missing from
 * the table below.
 *
 * WHY IT EXISTS (Tōkon's lesson, tokon scripts/patches.ts): the staleness alarm
 * reads the newest row and the clock, so a vendor that simply ships nothing
 * keeps the cron red every day while data:patch-check is clean the whole time.
 * The alarm counts from whichever is LATER, this date or the newest patch, and
 * still reads nothing but dates — so no vendor title change can blind it, and a
 * patch that ships the day after a confirmation still trips it within
 * STALE_PATCH_DAYS.
 *
 * NORMALLY WRITTEN BY `npm run data:patch-check -- --confirm-quiet`, NOT BY
 * HAND; that flag refuses on any unclean run. This initial value is the one
 * exception and it is a measurement, not a default: on 2026-09-18 the feed
 * returned 21 posts (20 community announcements plus one PC Gamer item), of
 * which exactly two are patches — both already in the table — and the two posts
 * published since Patch 2.5 ("Game Update - September 2, 2026" itself, posted a
 * day late, and "September Content Schedule") were read. The Steam public branch
 * clock agreed: buildid 25062979, timeupdated 2026-09-02T10:00:11Z.
 */
export const CONFIRMED_QUIET_THROUGH = '2026-09-18';

/**
 * Rows the vendor announced somewhere other than its storefront, keyed by the
 * row's start date, with the reason and the source for each.
 *
 * THIS IS AN ALLOWLIST, NOT A NOTE. scripts/patch-check.ts reports an
 * `announcedOn: 'x'` row that is absent here as DRIFT, and validate() refuses
 * it offline, so a future off-channel row cannot be slipped in without someone
 * writing down where it came from. Checklist 4d.
 *
 * The 2026-08-05 PS5-only controller-compatibility build is deliberately NOT
 * here: it is not a row at all. It states no gameplay change, it reached one
 * platform, and it folds into the 2026-07-29 window as an `includes` entry —
 * see that row.
 */
export const OFF_STEAM_OK: Record<string, string> = {
  '2026-08-06':
    'Steam + PS5 balance patch announced on X only, never on the Steam news hub: ' +
    '@avatar_fighters 2085498753125941431 (snowflake 2026-08-06T22:50:24Z) for the build, ' +
    '2085517737150058935 (2026-08-07T00:05:50Z) for the per-fighter notes — standardized ' +
    'knockdown hurtboxes plus changes to Azula, Katara, Nightmare Korra, Sokka, Toph, ' +
    'Zaheer and Zuko. Corroborated by the EventHubs and GameRant write-ups, both of which ' +
    'quote the vendor\'s own "August 6, 2026" heading; the two outlets that say August 7 ' +
    'are dating their own articles.',
};

/**
 * Balance eras. Hardcoded, argued in the header, never inferred.
 *
 * ONE ERA, AND ITS LABEL IS NOT "SEASON 1". The vendor has declared no balance
 * season in fourteen months of announcements — what it sells as "Year 1" is a
 * character pass — and a facet parent reading "Season 1" would claim one. The
 * token stays `S1` because that is the platform's era-token shape and what the
 * engine's `patchGroups` parent ids look like everywhere else; the LABEL is
 * what a reader sees, and it says only what is true.
 */
export const SEASONS: SeasonBoundary[] = [
  {
    season: 1,
    start: LAUNCH,
    end: null,
    confirmed: true,
    label: 'Since launch',
    note: 'The vendor has declared no balance season. One era, opening on the launch build.',
  },
];

/**
 * Every build the vendor shipped to a gameplay platform, oldest first.
 *
 * NEVER INVENT A VERSION TO FILL A GAP. Three of these four rows have no vendor
 * version and are absent from every published version sequence; a reader
 * noticing that only one row carries a `label` is the intended outcome. There is
 * deliberately no validator asserting that versions increment — it would fail on
 * the first honest row here.
 */
export const PATCHES: PatchBoundary[] = [
  {
    version: LAUNCH,
    start: LAUNCH,
    announcedOn: 'launch',
    note: 'Launch build — Windows, PS5 and Switch',
  },
  {
    version: '2026-07-29',
    start: '2026-07-29',
    announcedOn: 'steam',
    url: 'https://store.steampowered.com/news/app/2424420/view/707778917650399673',
    note: 'Samurai Appa support skin, keyboard remapping, fixes',
    // Steam post title, verbatim: "Game Update - July 29, 2026" (gid
    // 1839676055883396, posted 2026-07-29T19:32:59Z).
    // The body states no date and no version, so the TITLE date carries this
    // row; it also happens to equal the post day here, which is the only row
    // where the two agree. The absorbed build is the PS5-only controller-
    // compatibility update of 2026-08-05 (EventHubs, "Avatar Legends August 5,
    // 2026 Update Patch Notes"): one platform, no stated gameplay change, and
    // no vendor post of its own. Folding it is the honest window — splitting it
    // out would mint a boundary that separates no balance state.
    includes: [
      '2026-08-05 PS5-only controller-compatibility update (X only; no gameplay change stated)',
    ],
  },
  {
    version: '2026-08-06',
    start: '2026-08-06',
    announcedOn: 'x',
    url: 'https://x.com/avatar_fighters/status/2085498753125941431',
    note: 'Replay Takeover, Steam/PS5 crossplay, 7 fighters changed',
    // THE ROW THAT IS NOT ON STEAM. Its absence from the storefront feed is why
    // OFF_STEAM_OK exists and why the checker reads the build clock. In record
    // terms it is the largest window in the table: 91 of the 231 Replay Theater
    // rows measured on 2026-09-16 fall in [08-06, 09-02), and without this row
    // every one of them files under 2026-07-29 — rendering, filtering and
    // passing every count assertion while being wrong.
  },
  {
    version: '2026-09-02',
    start: '2026-09-02',
    label: 'Patch 2.5',
    announcedOn: 'steam',
    url: 'https://store.steampowered.com/news/app/2424420/view/681886390551577351',
    note: 'Ranked Mode 1.0, input buffer, damage-scaling fix, 9 fighters changed',
    // Steam post title, verbatim: "Game Update - September 2, 2026" (gid
    // 1842846814444872).
    // THE ONLY VERSIONED BUILD. `start` is the body date (2026-09-02); the
    // Steam post is dated 2026-09-03T23:37Z and the vendor's site says
    // "Updated September 9, 2026". See the header.
  },
];

// ── derivations ─────────────────────────────────────────────────────────────

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
/** The era-token shape. A date token can never collide with it, which is what
 *  keeps parent and child ids unique inside one `patchGroups` tree. */
const ERA_TOKEN = /^S\d+$/i;
/** The vendor's own display grammar, and the whole of it: `Patch 2.5`. Anchored
 *  so "Ranked Mode 1.0" and "up to 2.5 frame reduction" cannot become labels. */
const VENDOR_LABEL = /^Patch \d+(?:\.\d+)?$/;

const today = (): string => new Date().toISOString().slice(0, 10);
const days = (from: string, to: string): number =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/** The era a date falls in. Half-open [start, end).
 *
 *  THROWS on a date no era covers. It must not return a sentinel: this game has
 *  no pre-release era, so a date below LAUNCH means a floor gate is wrong, and
 *  a silent 0 would file that record as footage of a build nobody measured. */
export function seasonForDate(iso: string, seasons: SeasonBoundary[] = SEASONS): number {
  const hit = seasons.find((s) => iso >= s.start && (s.end === null || iso < s.end));
  if (!hit) throw new Error(`seasonForDate: "${iso}" falls in no era (the floor is ${LAUNCH})`);
  return hit.season;
}

/** The era token as emitted on `MatchVideo.era` and as the `patchGroups` parent
 *  id. The LABEL is where this game says something other than the token —
 *  see SEASONS. */
export const seasonToken = (season: number): string => `S${season}`;

/** Every patch with its computed window and resolved era. */
export function patchWindows(
  patches: PatchBoundary[] = PATCHES,
  seasons: SeasonBoundary[] = SEASONS,
): PatchWindow[] {
  const sorted = [...patches].sort((a, b) => a.start.localeCompare(b.start));
  return sorted.map((p, i) => {
    const season = seasonForDate(p.start, seasons);
    const era = seasons.find((s) => s.season === season)!;
    const next = sorted[i + 1];
    const end = next && seasonForDate(next.start, seasons) === season ? next.start : era.end;
    return { ...p, end: end ?? null, season };
  });
}

/** The window in force on `iso`.
 *
 *  `patch: patchForDate(d).version` and `era: seasonToken(patchForDate(d).season)`
 *  are the two pipeline callers. THROWS below the first build, for the same
 *  reason seasonForDate does. */
export function patchForDate(iso: string, windows: PatchWindow[] = patchWindows()): PatchWindow {
  const hit = windows.find((w) => iso >= w.start && (w.end === null || iso < w.end));
  if (!hit) throw new Error(`patchForDate: "${iso}" is earlier than the first build (${LAUNCH})`);
  return hit;
}

/**
 * The `GameConfig.patchGroups` payload → data/patchGroups.json, which
 * app/app.config.ts imports.
 *
 * PIPELINE-EMITTED, never hand-written: the same table that derives every
 * replay's patch token also builds the facet, so the UI hierarchy and the data
 * cannot disagree.
 *
 * Children carry a `label` only where the vendor published one. A bare ISO day
 * IS the display string for the other three, because inventing a prettier one
 * ("Launch build", "August update") would put a name in the facet that the
 * vendor never used and that no source can be checked against.
 */
export function buildPatchGroups(
  seasons: SeasonBoundary[] = SEASONS,
  patches: PatchBoundary[] = PATCHES,
): {
  id: string;
  label?: string;
  note?: string;
  children?: { id: string; label?: string; note?: string }[];
}[] {
  const windows = patchWindows(patches, seasons);
  return seasons.map((s) => {
    const children = windows
      .filter((w) => w.season === s.season)
      .map((w) => ({
        id: w.version,
        ...(w.label ? { label: w.label } : {}),
        ...(w.note ? { note: w.note } : {}),
      }));
    return {
      id: seasonToken(s.season),
      ...(s.label ? { label: s.label } : {}),
      ...(s.note ? { note: s.note } : {}),
      ...(children.length ? { children } : {}),
    };
  });
}

// ── the validator ───────────────────────────────────────────────────────────
//
// Runs under `npm run data:patches` AND inside `npm run typecheck`, so a bad row
// cannot reach a build — `tsc --noEmit` only TYPE-checks and would never execute
// any of this. Every check names the silent failure it prevents, and they are
// COLLECTED rather than thrown one at a time: a validator whose first crash
// replaces its error list says there is one problem when there may be six.

export function validate(now: string = today()): string[] {
  const errs: string[] = [];

  // 1. SHAPES, AND RULE 4d. The token IS the date on every row. A token that
  //    disagrees with its start mints a URL no window ever matches; a malformed
  //    date sorts wrong and files records nowhere.
  //
  //    THERE IS DELIBERATELY NO CHECK TYING DATE TOKENS TO announcedOn.
  //    ggst scripts/seasons.ts:835 has one — date tokens only on 'launch' and
  //    'beta' rows — and ported here it rejects 2026-07-29 and 2026-08-06, two
  //    real post-launch patches the vendor did not number. That rule encodes a
  //    vendor who numbers everything. This one does not.
  for (const p of PATCHES) {
    if (!ISO_DAY.test(p.start)) errs.push(`${p.version}: start "${p.start}" is not an ISO day`);
    if (!ISO_DAY.test(p.version)) {
      errs.push(
        `${p.version}: the token must be an ISO day on every row (checklist 4d) — ` +
          `the vendor numbered 1 of 4 builds, so a version token would have to be invented for the rest`,
      );
    }
    if (p.version !== p.start) errs.push(`${p.version}: token must equal start ("${p.start}")`);
    if (ERA_TOKEN.test(p.version)) errs.push(`${p.version}: collides with an era token`);
  }

  // 2. UNIQUE TOKENS. A duplicate makes one window unreachable and mints two
  //    facet children with the same id.
  const seen = new Set<string>();
  for (const p of PATCHES) {
    if (seen.has(p.version)) errs.push(`${p.version}: duplicate token`);
    seen.add(p.version);
  }

  // 3. NO TWO ROWS SHARE A START. Two builds on one day is not impossible in
  //    principle — it IS impossible to file a record between them, so it has to
  //    be a human decision rather than a silent sort. CotW hit this for real:
  //    its vendor's CMS gave two patches the same date and taking that at face
  //    value would have misfiled 950 records (ffcotw scripts/patches.ts, check 3).
  const byStart = new Map<string, string[]>();
  for (const p of PATCHES) byStart.set(p.start, [...(byStart.get(p.start) ?? []), p.version]);
  for (const [day, vs] of byStart) {
    if (vs.length > 1)
      errs.push(`${vs.join(' and ')} both start ${day} — which window owns that day?`);
  }

  // 4. AUTHORED ORDER IS DATE ORDER. Everything downstream reads this array as
  //    written; a row pasted into the wrong place would still derive correct
  //    windows (patchWindows sorts) and would read as a lie to the next person.
  for (let i = 1; i < PATCHES.length; i++) {
    if (PATCHES[i]!.start <= PATCHES[i - 1]!.start) {
      errs.push(
        `${PATCHES[i]!.version}: authored after ${PATCHES[i - 1]!.version} but not later than it`,
      );
    }
  }

  // 5. FLOORS AND THE FUTURE GUARD. A typo'd year mints an empty window that
  //    filters to nothing and asserts perfectly clean — the exact silent
  //    failure this table exists to prevent.
  for (const p of PATCHES) {
    if (p.start < LAUNCH) errs.push(`${p.version}: starts ${p.start}, before launch (${LAUNCH})`);
    if (p.start > now) errs.push(`${p.version}: starts ${p.start}, in the FUTURE (today ${now})`);
  }
  for (const s of SEASONS) {
    if (!ISO_DAY.test(s.start)) errs.push(`S${s.season}: start "${s.start}" is not an ISO day`);
    if (s.end !== null && !ISO_DAY.test(s.end))
      errs.push(`S${s.season}: end "${s.end}" is not an ISO day`);
    if (s.start > now) errs.push(`S${s.season}: starts ${s.start}, in the future`);
    if (s.end !== null && s.end <= s.start)
      errs.push(`S${s.season}: end ${s.end} is not after start`);
  }

  // 6. PROVENANCE. `announcedOn` is required by the type, but a hand edit can
  //    still write anything at the JSON boundary, and a row nobody can point at
  //    a source for is invented until proven otherwise.
  const CHANNELS = ['launch', 'steam', 'x'];
  for (const p of PATCHES) {
    if (!CHANNELS.includes(p.announcedOn)) {
      errs.push(`${p.version}: announcedOn "${p.announcedOn}" is not one of ${CHANNELS.join('/')}`);
    }
    if (
      p.announcedOn === 'steam' &&
      !p.url?.startsWith('https://store.steampowered.com/news/app/2424420/')
    ) {
      errs.push(
        `${p.version}: announcedOn steam but no Steam news permalink — the post is the evidence`,
      );
    }
    if (p.announcedOn === 'x') {
      // 7. AN OFF-CHANNEL ROW MUST BE ALLOWLISTED, WITH A REASON. The feed this
      //    game is checked against is measurably incomplete, so 'x' is a real
      //    and necessary value — and exactly for that reason it must not become
      //    the place a row with no evidence goes to hide. Checklist 4d.
      const why = OFF_STEAM_OK[p.start];
      if (!why) {
        errs.push(
          `${p.version}: announcedOn x but not in OFF_STEAM_OK — add it with the tweet id and ` +
            `what the build changed, or the row is unsourced`,
        );
      } else if (why.trim().length < 40) {
        errs.push(`${p.version}: its OFF_STEAM_OK reason is too short to be evidence`);
      }
      if (!p.url?.startsWith('https://x.com/')) {
        errs.push(`${p.version}: announcedOn x but no x.com permalink`);
      }
    }
  }
  for (const day of Object.keys(OFF_STEAM_OK)) {
    if (!PATCHES.some((p) => p.start === day && p.announcedOn === 'x')) {
      errs.push(
        `OFF_STEAM_OK has ${day}, which is no longer an announcedOn:'x' row — drop it or explain it`,
      );
    }
  }

  // 8. THE VENDOR LABEL IS THE VENDOR'S. Anchored on its own "Patch <n>"
  //    grammar because the bodies are full of version-shaped numbers that are
  //    not versions: a bare /\d+\.\d+/ over this feed mints 2.5, 1.0, 1.0,
  //    29.99 and 14.0 (measured 2026-09-18).
  const labels = new Set<string>();
  for (const p of PATCHES) {
    if (p.label === undefined) continue;
    if (!VENDOR_LABEL.test(p.label)) {
      errs.push(`${p.version}: label "${p.label}" is not the vendor's "Patch <n>" grammar`);
    }
    if (labels.has(p.label))
      errs.push(`${p.version}: label "${p.label}" is already on another row`);
    labels.add(p.label);
  }

  // 9. `includes` IS PROSE, NEVER A TOKEN. A folded build that looks like a
  //    patch id would eventually be treated as one.
  for (const p of PATCHES) {
    for (const inc of p.includes ?? []) {
      if (seen.has(inc)) errs.push(`${p.version}: includes "${inc}", which is a real patch token`);
      if (ISO_DAY.test(inc))
        errs.push(`${p.version}: includes a bare date "${inc}" — say what it was`);
    }
  }

  // 10. ERAS TILE THE TIMELINE, AND EACH OPENS ON A PATCH. A gap makes
  //     seasonForDate throw at parse time on a real record; an era whose first
  //     patch starts later has a window at its head whose records file under a
  //     patch from the era before it.
  const eras = [...SEASONS].sort((a, b) => a.start.localeCompare(b.start));
  for (let i = 1; i < eras.length; i++) {
    if (eras[i - 1]!.end !== eras[i]!.start) {
      errs.push(
        `era gap/overlap: S${eras[i - 1]!.season} ends ${eras[i - 1]!.end}, S${eras[i]!.season} starts ${eras[i]!.start}`,
      );
    }
  }
  if (eras.length === 0) errs.push('SEASONS is empty');
  else if (eras.at(-1)!.end !== null) errs.push('the newest era must be open (end: null)');
  // seasonForDate THROWS on an uncovered date and check 5 has already recorded
  // that case, so this must not be the thing that surfaces it.
  const eraOf = (day: string): number | null =>
    SEASONS.find((s) => day >= s.start && (s.end === null || day < s.end))?.season ?? null;
  for (const p of PATCHES) {
    if (eraOf(p.start) === null) errs.push(`${p.version}: starts ${p.start}, which no era covers`);
  }
  for (const s of SEASONS) {
    const own = PATCHES.filter((p) => eraOf(p.start) === s.season).sort((a, b) =>
      a.start.localeCompare(b.start),
    );
    if (own.length === 0) errs.push(`S${s.season} (${s.label ?? s.season}) owns no patch`);
    else if (own[0]!.start !== s.start) {
      errs.push(
        `S${s.season} starts ${s.start} but its first patch ${own[0]!.version} starts ${own[0]!.start}`,
      );
    }
  }

  // 11. THE STALENESS THRESHOLD MUST CLEAR THE TABLE'S OWN LARGEST GAP. This is
  //     the measured-cadence rule made executable: a threshold below a gap this
  //     vendor has already taken is red by construction, and an alarm that is
  //     red for a vendor doing nothing wrong is an alarm everybody learns to
  //     skim past. 27 days is the largest gap here today.
  const gaps = PATCHES.slice(1).map((p, i) => days(PATCHES[i]!.start, p.start));
  const widest = gaps.length ? Math.max(...gaps) : 0;
  if (STALE_PATCH_DAYS <= widest) {
    errs.push(
      `STALE_PATCH_DAYS is ${STALE_PATCH_DAYS} but this table already contains a ${widest}-day gap — ` +
        `the alarm would fire on a vendor who had done nothing wrong`,
    );
  }

  // 12. THE QUIET DATE. A malformed or future value would be silently ignored
  //     by the alarm (which keeps firing — the safe direction); this makes the
  //     typo loud instead of puzzling.
  if (!ISO_DAY.test(CONFIRMED_QUIET_THROUGH)) {
    errs.push(`CONFIRMED_QUIET_THROUGH "${CONFIRMED_QUIET_THROUGH}" is not an ISO day`);
  } else if (CONFIRMED_QUIET_THROUGH > now) {
    errs.push(
      `CONFIRMED_QUIET_THROUGH "${CONFIRMED_QUIET_THROUGH}" is in the future (today ${now})`,
    );
  }

  // 13. FACET IDS ARE UNIQUE ACROSS PARENTS AND CHILDREN. Two entries with one
  //     id makes one of them unreachable in the dropdown.
  //
  //     Built from the two tables directly rather than from buildPatchGroups(),
  //     WHICH IS NOT A STYLE CHOICE. That function derives every child's era, so
  //     it throws on a patch no era covers — and check 10 has already recorded
  //     exactly that case as an error. Calling it here replaced the whole error
  //     list with a stack trace the first time an era was closed by hand
  //     (positive-controlled 2026-09-18 by setting the open era's end to
  //     2026-09-01: the list said "starts 2026-09-02, which no era covers" and
  //     then crashed before returning it). The ids are identical either way:
  //     parents are seasonToken(), children are the patch tokens.
  const ids = new Set<string>();
  for (const s of SEASONS) {
    const id = seasonToken(s.season);
    if (ids.has(id)) errs.push(`patchGroups: duplicate id "${id}"`);
    ids.add(id);
  }
  for (const p of PATCHES) {
    if (ids.has(p.version)) errs.push(`patchGroups: duplicate id "${p.version}"`);
    ids.add(p.version);
  }

  return errs;
}

// ── standalone entry ────────────────────────────────────────────────────────
//
// `isMain`, not a bare argv check: this module is imported by patch-check.ts and
// will be imported by parse.ts, emit.ts and expiries.ts. A bare
// `process.argv.includes('--check')` fires this block whenever ANY of them runs
// with --check, printing this banner over their output and letting a
// process.exit(1) here kill an unrelated script.
const isMain = !!process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop()!);

if (isMain && (process.argv.includes('--check') || process.argv.includes('--emit'))) {
  const errs = validate();
  if (errs.length) {
    console.error(`✖ scripts/patches.ts is invalid:\n${errs.map((m) => `    ${m}`).join('\n')}`);
    process.exit(1);
  }

  if (process.argv.includes('--emit')) {
    // How a fresh checkout materialises the one committed artifact this table
    // owns, without a full fetch+parse: app/app.config.ts imports
    // data/patchGroups.json, so `npm run typecheck` needs it to exist. Writes
    // ONLY that file — data/patchBoundaries.json is scripts/emit.ts's to write,
    // and two writers of one file flip-flop it on every run (the mistake ggst
    // documents in scripts/seasons.ts). Note for whoever adds it: check-patches.sh
    // keys its unregistered-game warning on data/patchBoundaries.json existing,
    // so that file appearing is also the moment this game must join that
    // script's four lists (checklist 10g).
    const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'patchGroups.json');
    // writeFileSync, NOT the promise form: a top-level `await` anywhere in this
    // module makes it an async module for EVERY importer, and parse.ts, emit.ts
    // and expiries.ts all import it for `patchForDate`. ggst pays that cost in
    // scripts/seasons.ts:1089; there is no reason to here.
    writeFileSync(out, `${JSON.stringify(buildPatchGroups(), null, 2)}\n`, 'utf8');
    console.log(`✓ wrote ${out}`);
  }

  const w = patchWindows();
  const newest = w.at(-1)!;
  const quiet = CONFIRMED_QUIET_THROUGH > newest.start ? CONFIRMED_QUIET_THROUGH : newest.start;
  console.log(
    `✓ patches.ts — ${SEASONS.length} era, ${PATCHES.length} dated patches ` +
      `(${PATCHES.filter((p) => p.label).length} the vendor versioned, ` +
      `${PATCHES.filter((p) => p.announcedOn === 'x').length} off-Steam and allowlisted); ` +
      `newest ${newest.version}${newest.label ? ` (${newest.label})` : ''}, ` +
      `${days(quiet, today())}/${STALE_PATCH_DAYS} days into the staleness window`,
  );
}
