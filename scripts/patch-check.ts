/**
 * Diff the vendor's own patch announcements against scripts/patches.ts.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 * A patch table goes stale silently. A shipped patch that is missing from
 * PATCHES fails nothing: every replay since files under the previous token,
 * renders, filters, passes every count assertion, and is wrong. The platform's
 * 2026-09-02 refresh found two of four sibling tables stale — Tekken by 96
 * days, 258 replays under the wrong patch — with every offline validator green.
 * `validate()` in scripts/patches.ts checks the table's SHAPE; this checks its
 * CONTENT against the vendor.
 *
 * ── THE SOURCE IS THE STEAM NEWS HUB, AND IT IS KNOWN TO BE INCOMPLETE ──────
 * Stage 0 measured every vendor surface (see the scripts/patches.ts header for
 * the list and why each was rejected). Steam news is the only machine-readable
 * archive — and it is missing the 2026-08-06 balance patch, which the vendor
 * announced on X alone. A checker that read only this feed would print a tick
 * forever over a table missing a patch that changed seven fighters. That is the
 * ggst/ffcotw failure — "verify the vendor feed is COMPLETE before adopting it"
 * — arriving through a door neither of them had.
 *
 * So this reads THREE things, and a clean bill needs all three:
 *   1. the news feed        what the vendor posted, with bodies
 *   2. the store events API `event_type`, a SECOND reading of the same posts
 *                          that survives a title rename — the exact blindness
 *                          Tōkon shipped (tokon scripts/patch-check.ts:105
 *                          skips an unmatched title without a word)
 *   3. the Steam build clock  the only signal that can see a patch the vendor
 *                          never posted on Steam at all
 * A read that did not happen is reported as UNVERIFIED, never folded into a
 * tick: "not checked" and "clean" are different answers, and check-patches.sh
 * already has a colour for the first one.
 *
 * ── THE FOUR HARD FAILURES THIS ENCODES ────────────────────────────────────
 * (a) AN UNREADABLE PATCH-SHAPED POST IS FATAL, NEVER A SKIP (checklist 4c).
 *     A title this script cannot read is indistinguishable from a patch that
 *     never shipped, and only one of those is safe to assume.
 * (b) THE TWO READINGS MUST AGREE. `event_type` 13 and the patch-title grammar
 *     pick out the same 2 of 20 community posts (measured 2026-09-18). Either
 *     one firing alone is a hard failure: a type-13 post whose title changed is
 *     a renamed patch, and a patch-titled type-28 post is a newsletter that
 *     would mint a phantom row. A post that is genuinely neither goes in
 *     NOT_A_PATCH by gid, with a reason.
 * (c) THE POST DATE IS NOT THE RELEASE DATE. Patch 2.5's body says September 2
 *     and its Steam post is dated September 3 at 23:37Z; the vendor's own site
 *     says "Updated September 9". The body date wins, the title date is the
 *     fallback for a post with no versioned header, and the two disagreeing is
 *     fatal. The post's own `date` field is never a date authority here.
 * (d) THE VERSION IS ANCHORED ON THE VENDOR'S OWN PREFIX. A bare /\d+\.\d+/
 *     over these bodies returns 2.5, 1.0, 1.0, 29.99 and 14.0 (measured
 *     2026-09-18): "Ranked Mode 1.0" twice inside the Patch 2.5 body, a price
 *     in the pre-order post, and a number in a trailer post. Only
 *     `[h1]Patch <n>` counts.
 *
 * ── NETWORK, MANUAL, NEVER IN THE CRON ─────────────────────────────────────
 * A daily job reaching a storefront would fail on their outage rather than
 * ours, and a patch table is a human decision anyway: this names the row, a
 * person adds it. A vendor outage is not a data error and must not redden a
 * refresh that produced correct data — it prints UNVERIFIED and exits 0. Drift
 * and unreadable input exit 1. The last line is always the machine-readable
 * trailer `patch-check: <STATE>`, which the workspace runner classifies on
 * (check-patches.sh:128-145) — never prose.
 *
 * THIS GAME IS NOT YET IN THAT RUNNER. Registering it means four edits to
 * check-patches.sh — GAMES, REPO_OF, SCRIPT_OF and the literal "unknown game:"
 * string — in the same commit as this repo's first real push, never before
 * (checklist 10g).
 *
 * The cadence alarm that makes a stale table DISCOVERABLE is STALE_PATCH_DAYS
 * in scripts/patches.ts, read by scripts/expiries.ts. It reads only dates and
 * the clock, so it cannot go blind; this is the check it points at.
 *
 * Run: npm run data:patch-check                     (report only)
 *      npm run data:patch-check -- --confirm-quiet  (record a quiet feed)
 */

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CONFIRMED_QUIET_THROUGH,
  OFF_STEAM_OK,
  PATCHES,
  STALE_PATCH_DAYS,
  type PatchBoundary,
} from './patches';

const APPID = '2424420';
const UA = 'avatar-replay-database/patch-check';
const CONFIRM_QUIET = process.argv.includes('--confirm-quiet');

/** Bodies are needed for the version and the body date, so `maxlength=0`.
 *  `count` is deliberately far above the 21 posts this app has ever had: the
 *  external-feed items (one PC Gamer piece today) share the quota, and a floor
 *  that trips because syndicated press crowded out the vendor's own posts would
 *  be a confusing way to learn that. */
const NEWS = `https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=${APPID}&count=200&maxlength=0&format=json`;
/** The same posts, with Steam's own `event_type` and the gid that forms the
 *  store permalink the table's rows carry. */
const EVENTS = `https://store.steampowered.com/events/ajaxgetpartnereventspageable?appid=${APPID}&count=100&offset=0&l=english`;
/** The public branch's build clock. A third-party PICS mirror, because Steam's
 *  own `ISteamApps/UpToDateCheck` answers `success:false` for this app and
 *  nothing first-party exposes a buildid. Read-only, unauthenticated, and its
 *  failure downgrades the run to UNVERIFIED rather than inventing a verdict. */
const BUILD = `https://api.steamcmd.net/v1/info/${APPID}`;

/** Only the vendor's own announcements. Measured 2026-09-18: 20 community
 *  posts plus one syndicated PC Gamer article, which carries `feedname:
 *  'PC Gamer'` and would otherwise be a post nobody at the vendor wrote. */
const COMMUNITY = 'steam_community_announcements';
/** Below this the endpoint has moved or the appid has been reassigned, and
 *  every "missing patch" line after that would be noise. 20 community posts on
 *  2026-09-16 and again on 2026-09-18; the archive only grows. */
export const FLOOR_POSTS = 18;
/** Steam's event type for both of this vendor's patch posts, measured on the
 *  store events API 2026-09-18. It is the second reading of rule (b); no other
 *  event type is assumed to mean anything, because none was measured on this
 *  app. */
export const PATCH_EVENT_TYPE = 13;

/** What the vendor calls a patch in a title. Deliberately looser than the date
 *  reader, so a title this script cannot parse reaches the hard failure instead
 *  of falling through as "not a patch" (rule a). Both live titles are
 *  "Game Update - <date>"; `patch`/`hotfix`/`update` are here because the
 *  vendor has used all three words in body prose and a title change is the
 *  thing this gate exists to survive. */
const PATCH_TITLE = /\b(?:game\s*update|patch|hotfix|update)\b/i;

/**
 * Community posts that look like a patch to PATCH_TITLE and are not, keyed by
 * the news gid, with the reason.
 *
 * EMPTY TODAY, AND THAT IS A MEASUREMENT: none of the 20 community posts on
 * 2026-09-18 matches PATCH_TITLE except the two real patches. It exists because
 * rule (b) makes a false positive FATAL, and a fatal check with no way to clear
 * it is a check people delete. An entry is a human decision with a reason, not
 * a mute button.
 */
export const NOT_A_PATCH: Record<string, string> = {};

/**
 * Steam builds that shipped with no announcement anywhere, keyed by buildid
 * with the reason each is not a patch.
 *
 * EMPTY TODAY: the public branch is buildid 25062979, timeupdated
 * 2026-09-02T10:00:11Z, which is Patch 2.5's own build. A store repack, a depot
 * re-upload or a platform SDK bump can move this clock without changing the
 * game, and when one does, the person who checked writes it here.
 */
export const BUILDS_OK: Record<string, string> = {};

const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];
/** Full names and three-letter abbreviations, with an optional dot. The vendor
 *  writes full names in both live posts; the abbreviations are here because
 *  every sibling's vendor eventually wrote one, and an unreadable date is fatal
 *  rather than forgiving. */
const MONTH = `(${MONTHS.map((m) => `${m}|${m.slice(0, 3)}\\.?`).join('|')})`;
/** `[h1]Patch 2.5` — rule (d). */
const HEADER_VERSION = /\[h1\]\s*Patch\s+(\d+(?:\.\d+)?)/i;
/** The versioned-post layout, with or without a readable number after it. */
const HEADER_SHAPE = /\[h1\]\s*Patch\b/i;
/** `[h1]Patch 2.5 [i]September 2, 2026[/i]` — the release date, anchored inside
 *  the vendor's own header block so a date in the body prose cannot be read as
 *  one. */
const HEADER_DATE = new RegExp(
  `\\[h1\\][^\\[]*\\[i\\]\\s*${MONTH}\\s+(\\d{1,2})\\s*,\\s*(\\d{4})`,
  'i',
);
/** Any `<Month> D, YYYY` in a title. Every literal space is `\s+` and the text
 *  is whitespace-collapsed first — both, because one of the two will be removed
 *  by someone who thinks it redundant and the other still holds (ggst rule d). */
const ANY_DATE = new RegExp(`${MONTH}\\s+(\\d{1,2})\\s*,\\s*(\\d{4})`, 'gi');

/** Tags out, entities decoded, all whitespace collapsed to single spaces —
 *  including newlines, which is what puts `[h1]Patch 2.5` and its `[i]` date on
 *  one line for HEADER_DATE. */
export const flatten = (s: string | undefined): string =>
  (s ?? '')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();

const pad2 = (n: number): string => String(n).padStart(2, '0');
const monthIndex = (name: string): number => {
  const k = name.toLowerCase().replace(/\.$/, '');
  return MONTHS.findIndex((m) => m === k || m.slice(0, 3) === k);
};
const isoDay = (month: string, day: string, year: string): string | null => {
  const m = monthIndex(month);
  return m < 0 ? null : `${year}-${pad2(m + 1)}-${pad2(Number(day))}`;
};
const dayOf = (unix: number): string => new Date(unix * 1000).toISOString().slice(0, 10);
const today = (): string => new Date().toISOString().slice(0, 10);
const daysBetween = (from: string, to: string): number =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// ── the three reads ─────────────────────────────────────────────────────────

interface NewsItem {
  gid: string;
  title: string;
  url: string;
  date: number;
  feedname: string;
  contents: string;
}
interface StoreEvent {
  gid: string;
  event_name: string;
  event_type: number;
  rtime32_start_time: number;
}
interface Build {
  buildid: string;
  timeupdated: string;
}

async function getJson<T>(url: string, what: string): Promise<T> {
  const res = await fetch(url, {
    headers: { 'user-agent': UA, accept: 'application/json' },
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`${what} returned HTTP ${res.status}`);
  return (await res.json()) as T;
}

async function news(): Promise<NewsItem[]> {
  const body = await getJson<{ appnews?: { newsitems?: NewsItem[] } }>(NEWS, 'Steam news feed');
  const items = body.appnews?.newsitems;
  if (!Array.isArray(items)) throw new Error('Steam news feed returned no newsitems array');
  return items;
}

async function events(): Promise<StoreEvent[]> {
  const body = await getJson<{ events?: StoreEvent[]; success?: number }>(
    EVENTS,
    'Steam events API',
  );
  if (!Array.isArray(body.events)) throw new Error('Steam events API returned no events array');
  return body.events;
}

async function build(): Promise<Build> {
  const body = await getJson<{
    data?: Record<string, { depots?: { branches?: { public?: Build } } }>;
  }>(BUILD, 'Steam build clock');
  const pub = body.data?.[APPID]?.depots?.branches?.public;
  if (!pub?.buildid || !pub.timeupdated) throw new Error('Steam build clock has no public branch');
  return pub;
}

// ── reading one post ────────────────────────────────────────────────────────

export interface Announced {
  gid: string;
  title: string;
  /** The store permalink, from the joined event — the form the table's rows
   *  carry. Falls back to the news item's own url when the join failed. */
  url: string;
  /** ISO day the post was PUBLISHED. Context only, never a date authority. */
  posted: string;
  /** The release day: the body's header date, else the title's. */
  start: string;
  /** The vendor's own version, present only on a versioned post. */
  version?: string;
  /** What the title said, when it carried a date. Counted, to report how often
   *  the two disagree — the live number behind rule (c). */
  titleDate: string | null;
  eventType: number | null;
}

export interface Unreadable {
  gid: string;
  title: string;
  posted: string;
  why: string;
}

export interface Classified {
  announced: Announced[];
  unreadable: Unreadable[];
  /** Posts allowlisted in NOT_A_PATCH, printed so nobody has to open this file
   *  to know why one is being ignored. */
  excused: { title: string; posted: string; why: string }[];
  /** Community posts the events read could not be joined to. A non-empty list
   *  means rule (b) did not run on them. */
  unjoined: string[];
}

/** The join key between a news item and its store event: the two endpoints
 *  share no id (the news gid and the event gid are different numbers for the
 *  same post), so the join is on title plus publication day. The ISO day goes
 *  FIRST because it is fixed-width — a title containing the separator cannot
 *  make two different (day, title) pairs collide. 20/20 on 2026-09-18. */
const joinKey = (day: string, title: string): string => `${day} ${title}`;

/** Sort every community post into announced / unreadable / excused. Pure, so a
 *  fixture can drive it without the network. */
export function classify(items: NewsItem[], byKey: Map<string, StoreEvent>): Classified {
  const out: Classified = { announced: [], unreadable: [], excused: [], unjoined: [] };
  const byDate = new Map<string, string>();
  const byVersion = new Map<string, string>();

  for (const raw of items) {
    if (raw.feedname !== COMMUNITY) continue;
    const title = flatten(raw.title);
    const posted = dayOf(raw.date);
    const ev = byKey.get(joinKey(posted, title));
    if (!ev) out.unjoined.push(title);

    const eventType = ev ? ev.event_type : null;
    const byType = eventType === PATCH_EVENT_TYPE;
    const byTitle = PATCH_TITLE.test(title);
    const excuse = NOT_A_PATCH[raw.gid];

    if (!byType && !byTitle) continue;
    if (excuse) {
      out.excused.push({ title, posted, why: excuse });
      continue;
    }
    // (b) THE TWO READINGS MUST AGREE. Only checked where the join succeeded —
    // an unjoined post has no event_type to disagree with, and that gap is
    // reported separately rather than assumed away.
    if (ev && byType !== byTitle) {
      out.unreadable.push({
        gid: raw.gid,
        title,
        posted,
        why: byType
          ? `event_type ${PATCH_EVENT_TYPE} (the vendor's own patch type) but the title does not read as a patch — ` +
            'a renamed patch title looks exactly like this. Teach PATCH_TITLE, or excuse the gid in NOT_A_PATCH'
          : `title reads as a patch but Steam files it as event_type ${eventType} — ` +
            'a newsletter that mentions an update would mint a phantom row. Excuse the gid in NOT_A_PATCH with a reason',
      });
      continue;
    }

    const body = flatten(raw.contents);
    const versioned = HEADER_SHAPE.test(body);
    const vm = HEADER_VERSION.exec(body);
    if (versioned && !vm) {
      out.unreadable.push({
        gid: raw.gid,
        title,
        posted,
        why:
          'the body uses the vendor\'s versioned header but no number follows "Patch" — teach HEADER_VERSION. ' +
          'A bare version regex is not the fix: over these bodies it also returns 1.0, 29.99 and 14.0',
      });
      continue;
    }

    // (c) THE DATE AUTHORITY: the body's header date, then the title's.
    const hm = HEADER_DATE.exec(body);
    const bodyDate = hm ? isoDay(hm[1]!, hm[2]!, hm[3]!) : null;
    if (versioned && !bodyDate) {
      out.unreadable.push({
        gid: raw.gid,
        title,
        posted,
        why:
          'a versioned post whose date will not parse from its own header block — the post date is NOT a ' +
          'substitute (Patch 2.5 was posted a day after it shipped). Teach HEADER_DATE',
      });
      continue;
    }
    const inTitle = [...title.matchAll(ANY_DATE)].map((m) => isoDay(m[1]!, m[2]!, m[3]!));
    if (inTitle.length > 1) {
      out.unreadable.push({
        gid: raw.gid,
        title,
        posted,
        why: `the title carries ${inTitle.length} dates (${inTitle.join(', ')}) — which one is the release?`,
      });
      continue;
    }
    const titleDate = inTitle[0] ?? null;
    if (bodyDate && titleDate && bodyDate !== titleDate) {
      out.unreadable.push({
        gid: raw.gid,
        title,
        posted,
        why: `the body says ${bodyDate} and the title says ${titleDate} — one of them is wrong and only a person can say which`,
      });
      continue;
    }
    const start = bodyDate ?? titleDate;
    if (!start) {
      out.unreadable.push({
        gid: raw.gid,
        title,
        posted,
        why: 'a patch post whose date will not parse from either its body header or its title',
      });
      continue;
    }

    // (e) ONE DAY, ONE BUILD. Two posts resolving to the same release day (or
    // the same version) forces a decision about which is canonical, and
    // scripts/patches.ts refuses two rows sharing a start for the same reason.
    const clashDate = byDate.get(start);
    if (clashDate) {
      out.unreadable.push({
        gid: raw.gid,
        title,
        posted,
        why: `resolves to ${start}, the same release day as ${JSON.stringify(clashDate)} — which is canonical?`,
      });
      continue;
    }
    byDate.set(start, title);
    const version = vm?.[1];
    if (version) {
      const clashVersion = byVersion.get(version);
      if (clashVersion) {
        out.unreadable.push({
          gid: raw.gid,
          title,
          posted,
          why: `states Patch ${version}, as ${JSON.stringify(clashVersion)} already does — which is canonical?`,
        });
        continue;
      }
      byVersion.set(version, title);
    }

    out.announced.push({
      gid: raw.gid,
      title,
      url: ev ? `https://store.steampowered.com/news/app/${APPID}/view/${ev.gid}` : raw.url,
      posted,
      start,
      ...(version ? { version } : {}),
      titleDate,
      eventType,
    });
  }
  return out;
}

// ── the diff ────────────────────────────────────────────────────────────────

export interface Finding {
  /** + announced, not in the table · ~ a row the vendor contradicts · - a row
   *  on no announcement · ⓘ informational */
  glyph: '+' | '~' | '-' | 'ⓘ';
  text: string;
}
export const fatal = (f: Finding): boolean => f.glyph !== 'ⓘ';

/** Compare what the vendor announced with the table. Pure; `now` injectable. */
export function diff(
  announced: Announced[],
  table: PatchBoundary[] = PATCHES,
  buildDay: string | null = null,
  now: string = today(),
): Finding[] {
  const findings: Finding[] = [];
  const rows = new Map(table.map((r) => [r.start, r]));
  const gidOf = (url: string | undefined): string | undefined => url?.split('/').pop();
  const byGid = new Map(table.filter((r) => r.url).map((r) => [gidOf(r.url)!, r]));
  /** Rows a vendor post was matched to, by identity — see the reverse pass. */
  const matched = new Set<PatchBoundary>();

  for (const a of announced) {
    const row = rows.get(a.start) ?? byGid.get(gidOf(a.url)!);
    if (!row) {
      findings.push({
        glyph: '+',
        text:
          `${a.start} ${JSON.stringify(a.title)} — announced by the vendor, NOT in scripts/patches.ts:\n` +
          `    {\n      version: '${a.start}',\n      start: '${a.start}',\n` +
          (a.version ? `      label: 'Patch ${a.version}',\n` : '') +
          `      announcedOn: 'steam',\n      url: '${a.url}',\n      note: ${JSON.stringify(a.title)},\n    },`,
      });
      continue;
    }
    matched.add(row);
    // A row found by its permalink but sitting on another day is a date
    // correction, not a missing row plus a spurious extra one.
    if (row.start !== a.start) {
      findings.push({
        glyph: '~',
        text:
          `${JSON.stringify(a.title)} — the table dates this post ${row.start}, the vendor's own ` +
          `${a.version ? 'header' : 'title'} says ${a.start} (posted ${a.posted}; the post date is not the authority)`,
      });
    }
    // The label is the vendor's version, verbatim. A vendor that starts
    // numbering every build shows up here first, one row at a time.
    const want = a.version ? `Patch ${a.version}` : undefined;
    if (want && row.label !== want) {
      findings.push({
        glyph: '~',
        text: row.label
          ? `${row.start} — the table labels this ${JSON.stringify(row.label)}, the vendor's body says ${JSON.stringify(want)}`
          : `${row.start} — the vendor's body states ${JSON.stringify(want)}; the row carries no label`,
      });
    }
    if (!want && row.label) {
      findings.push({
        glyph: '~',
        text: `${row.start} — the table labels this ${JSON.stringify(row.label)}, the vendor's post states no version`,
      });
    }
  }

  // The reverse direction. A 'steam' row on no post is invented or the post was
  // removed; an 'x' row is fine PROVIDED it is allowlisted, which is the only
  // thing keeping the off-Steam escape hatch honest; a 'launch' row never had a
  // patch post at all.
  //
  // A row already MATCHED above is skipped even when its date is wrong. Keying
  // this pass on the date alone reported a misdated row twice — once as the date
  // correction it is, and once as "invented, or the post was removed", which is
  // both untrue and the louder of the two.
  const announcedDays = new Set(announced.map((a) => a.start));
  for (const r of table) {
    if (announcedDays.has(r.start) || matched.has(r)) continue;
    if (r.announcedOn === 'steam') {
      findings.push({
        glyph: '-',
        text: `${r.start} — announcedOn 'steam' but no such post is in the feed (invented, or the post was removed)`,
      });
    } else if (r.announcedOn === 'x') {
      const why = OFF_STEAM_OK[r.start];
      if (!why) {
        findings.push({
          glyph: '-',
          text: `${r.start} — announcedOn 'x' and absent from OFF_STEAM_OK; an off-Steam row with no written source`,
        });
      } else {
        findings.push({ glyph: 'ⓘ', text: `${r.start} — off-Steam by design: ${why}` });
      }
    } else {
      findings.push({
        glyph: 'ⓘ',
        text: `${r.start} — announcedOn '${r.announcedOn}', no patch post expected`,
      });
    }
  }

  // THE BUILD CLOCK. The one reading that can see a patch the vendor never
  // posted on Steam — which this vendor has already done once, on 2026-08-06.
  const newest = table.reduce((a, b) => (a.start > b.start ? a : b));
  if (buildDay && buildDay > newest.start && !announcedDays.has(buildDay)) {
    findings.push({
      glyph: '~',
      text:
        `a Steam build shipped on ${buildDay}, after the newest table row (${newest.start}), and no ` +
        'announcement explains it — check @avatar_fighters, then either add the row with ' +
        "announcedOn: 'x' and an OFF_STEAM_OK entry, or record the buildid in BUILDS_OK with a reason",
    });
  }

  // How often the title contradicts the body — the live number behind rule (c).
  const both = announced.filter((a) => a.titleDate !== null && a.version !== undefined);
  if (both.length) {
    const clash = both.filter((a) => a.titleDate !== a.start);
    findings.push({
      glyph: 'ⓘ',
      text:
        `of ${both.length} versioned post(s) that also date their title, ${clash.length} contradict the body` +
        (clash.length ? ` (${clash.map((a) => a.title).join('; ')})` : ''),
    });
  }
  // The table's own age, in the terms the staleness alarm uses.
  const floor = CONFIRMED_QUIET_THROUGH > newest.start ? CONFIRMED_QUIET_THROUGH : newest.start;
  findings.push({
    glyph: 'ⓘ',
    text:
      `newest row ${newest.start}, quiet confirmed through ${CONFIRMED_QUIET_THROUGH} — ` +
      `${daysBetween(floor, now)} of ${STALE_PATCH_DAYS} days before scripts/expiries.ts calls this table stale`,
  });
  return findings;
}

// ── the run ─────────────────────────────────────────────────────────────────
//
// `isMain`, not a bare argv check: the pure functions above are importable by a
// fixture, and importing this module must not fire the network.
const isMain = !!process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop()!);

if (isMain) {
  const reason = (e: unknown): string => {
    const cause = (e as { cause?: { code?: string } })?.cause?.code;
    return `${e instanceof Error ? e.message : String(e)}${cause ? ` (${cause})` : ''}`;
  };
  /** Every unverified read, named. A clean feed with an unread cross-check is
   *  not a clean bill — check-patches.sh has a colour for exactly that. */
  const unverified: string[] = [];

  const items = await news().catch((e: unknown): null => {
    console.warn(`⚠ patch table NOT verified — ${reason(e)}`);
    return null;
  });
  if (!items) {
    console.log('patch-check: UNVERIFIED');
    process.exit(0);
  }

  const community = items.filter((i) => i.feedname === COMMUNITY);
  if (community.length < FLOOR_POSTS) {
    console.error(
      `✖ only ${community.length} of ${items.length} posts are ${COMMUNITY} (floor ${FLOOR_POSTS}; 20 on ` +
        '2026-09-18) — the appid has been reassigned or the endpoint has moved. Refusing to report: every ' +
        'line after this would be noise.',
    );
    console.log('patch-check: UNREADABLE');
    process.exit(1);
  }

  await sleep(1_500); // the vendor's hosts are quota-free; be polite anyway
  const evs = await events().catch((e: unknown): null => {
    unverified.push(`the store events API (event_type) — ${reason(e)}`);
    return null;
  });
  const byKey = new Map<string, StoreEvent>(
    (evs ?? []).map((e) => [joinKey(dayOf(e.rtime32_start_time), flatten(e.event_name)), e]),
  );

  await sleep(1_500);
  const pub = await build().catch((e: unknown): null => {
    unverified.push(`the Steam build clock — ${reason(e)}`);
    return null;
  });
  const buildDay = pub ? dayOf(Number(pub.timeupdated)) : null;

  const { announced, unreadable, excused, unjoined } = classify(community, byKey);
  if (evs && unjoined.length) {
    unverified.push(
      `event_type on ${unjoined.length} of ${community.length} community post(s) — the events API did not ` +
        `carry ${unjoined.map((t) => JSON.stringify(t)).join(', ')}`,
    );
  }

  console.log(
    `Steam news: ${items.length} posts, ${community.length} from the vendor, ${announced.length} patch(es)` +
      `${excused.length ? `, ${excused.length} excused` : ''}` +
      `${evs ? `; events API joined ${community.length - unjoined.length}/${community.length}` : '; events API UNREAD'}` +
      `${pub ? `; public build ${pub.buildid} @ ${buildDay}` : '; build clock UNREAD'}`,
  );
  console.log(
    `Table:      ${PATCHES.length} rows, newest ${PATCHES.at(-1)?.start}` +
      `${PATCHES.at(-1)?.label ? ` (${PATCHES.at(-1)!.label})` : ''}\n`,
  );
  for (const e of excused)
    console.log(`  ⓘ ${e.posted}  ${JSON.stringify(e.title)} — excused: ${e.why}`);

  if (unreadable.length) {
    console.error(`\n✖ ${unreadable.length} vendor post(s) this script cannot read:\n`);
    for (const u of unreadable) {
      console.error(`    ${u.posted}  ${JSON.stringify(u.title)}`);
      console.error(`      gid ${u.gid}`);
      console.error(`      ${u.why}\n`);
    }
    console.error(
      '  Refusing to report on the rest. A post this script cannot read is indistinguishable from a\n' +
        '  patch that never shipped, and skipping it quietly is how a checker ends up confirming exactly\n' +
        '  the staleness it exists to catch (checklist 4c; Tōkon spent two missing patches learning it).',
    );
    console.log('patch-check: UNREADABLE');
    process.exit(1);
  }

  const findings = diff(announced, PATCHES, buildDay);
  for (const f of findings.filter((x) => !fatal(x))) console.log(`  ${f.glyph} ${f.text}`);
  const drift = findings.filter(fatal);

  if (drift.length) {
    console.error(`\n✖ the patch table has drifted from the vendor (${drift.length}):\n`);
    for (const f of drift) console.error(`  ${f.glyph} ${f.text}`);
    console.error(
      '\nEdit PATCHES in scripts/patches.ts — rows in date order, the BODY date, the vendor version as a\n' +
        'label — then `npm run data:patches` to validate and `npm run data:parse`, not `data:emit` alone:\n' +
        'the patch token is stored on each record at parse time and emit only copies it, so nothing short\n' +
        'of a re-parse refiles the replays. Every replay published since a missing patch is filed under the\n' +
        'previous token right now — it renders and filters cleanly, and it is wrong.\n',
    );
    console.log('patch-check: DRIFT');
    process.exit(1);
  }

  if (unverified.length) {
    console.warn(`\n⚠ patch table NOT verified — ${unverified.length} read(s) did not happen:`);
    for (const u of unverified) console.warn(`    ${u}`);
    console.warn(
      '  Nothing above contradicts the vendor, and that is not the same as a clean table: the two\n' +
        '  unread checks are the only ones that can see a patch the vendor never posted on Steam — which\n' +
        '  it has already done once, on 2026-08-06. Run it again later.',
    );
    console.log('patch-check: UNVERIFIED');
    process.exit(0);
  }

  console.log(
    `\n✓ the patch table matches every vendor patch post — ${announced.length} announcements, every date ` +
      'and every stated version identical, and no unexplained Steam build',
  );

  if (CONFIRM_QUIET) {
    // --confirm-quiet IS HOW A QUIET VENDOR CLEARS THE STALENESS ALARM. It only
    // runs on a fully clean, fully verified read — the three exits above all
    // leave before this point — and it first prints every post published since
    // the newest patch, because a renamed patch title would be hiding among
    // them. So the recorded date means "a person read the feed", not "a person
    // wanted the red to stop".
    const newest = PATCHES.at(-1)!;
    if (!community.some((i) => dayOf(i.date) <= newest.start)) {
      console.error(
        `\n✖ --confirm-quiet: every one of the ${community.length} vendor posts returned is newer than ` +
          `${newest.start}, so the feed may not reach back to the newest patch. Not recorded.`,
      );
      process.exit(1);
    }
    const since = community
      .filter((i) => dayOf(i.date) > newest.start)
      .sort((a, b) => a.date - b.date);
    console.log(`\n${since.length} vendor post(s) since ${newest.start} — read these titles:`);
    for (const i of since) console.log(`    ${dayOf(i.date)}  ${JSON.stringify(flatten(i.title))}`);
    console.log('  A patch posted under a title this script does not know would be in this list.');

    const day = today();
    if (CONFIRMED_QUIET_THROUGH === day) {
      console.log(`\n✓ CONFIRMED_QUIET_THROUGH is already ${day}`);
    } else {
      const path = join(dirname(fileURLToPath(import.meta.url)), 'patches.ts');
      const src = await readFile(path, 'utf8');
      const LINE = /^export const CONFIRMED_QUIET_THROUGH = '[^']*';$/gm;
      const found = src.match(LINE)?.length ?? 0;
      if (found !== 1) {
        console.error(
          `\n✖ expected one CONFIRMED_QUIET_THROUGH line in scripts/patches.ts, found ${found}. Not recorded.`,
        );
        process.exit(1);
      }
      await writeFile(path, src.replace(LINE, `export const CONFIRMED_QUIET_THROUGH = '${day}';`));
      console.log(
        `\n✓ CONFIRMED_QUIET_THROUGH ${CONFIRMED_QUIET_THROUGH} → ${day} in scripts/patches.ts.\n` +
          '  Commit and push it: the cron reads the repo, not this machine.',
      );
    }
  }

  console.log('patch-check: CURRENT');
  process.exit(0);
}
