/**
 * End-to-end checks against the BUILT static output.
 *
 * Everything here reads `.vercel/output/static/avatar` — what Vercel actually
 * serves — rather than source files or a dev server. Source can be perfect while
 * the build ships the umbrella theme, an unprerendered route, a provenance leak,
 * or a support id wearing a character page; those are the failures this catches.
 *
 * ── EMPTY-CORPUS MODE, AND IT SKIPS VISIBLY ──────────────────────────────
 * A build with zero replays is a legitimate state — it is what this repo is in
 * today (data/replays.json is `[]`), what a fresh clone has before the first
 * fetch, and what the first deploy will serve. The corpus-shaped checks then
 * have nothing to assert on, so they are SKIPPED AND COUNTED, never quietly
 * passed. A suite that reports green on an empty corpus is a suite that will
 * report green on a broken one.
 *
 * ── PENDING STAGES SKIP THE SAME WAY, AND THEY NAME THE FILE ─────────────
 * This game is built in waves, so on any given day some stage's script does not
 * exist yet: `scripts/art.ts` mints the portraits, `scripts/og.ts` the card,
 * `scripts/emit.ts` the public contract. An assertion about an artefact whose
 * producer has not shipped is not a pass and not a failure — it is a named,
 * counted skip that says which file it is waiting on, and it ARMS ITSELF into a
 * hard check the moment that file appears (`stage()` below). Nothing here has to
 * be remembered and edited later.
 *
 * ── WHAT THIS FILE ADDS TO THE PORT ──────────────────────────────────────
 * Ported from ggst-replay-database/scripts/e2e.ts. Five bands are Avatar's own,
 * and each exists because nothing upstream can see the failure:
 *
 *  · THE sourceChannels NAME SYNC, ported, but the REGEX IS WIDENED. ggst's
 *    reader is `id:\s*'([A-Za-z]+)'` (ggst-replay-database/scripts/e2e.ts:247).
 *    Four of this game's 33 channel ids carry digits — `an11Mo`, `teo1029`,
 *    `mysteryRacer21`, `atma00` — so the ported regex silently reads 29 of 33
 *    and the gate goes green while missing four channels. Measured 2026-09-18.
 *  · THE SUPPORT NAMESPACE (checklist 13). `Side.characters` holds fighter ids;
 *    supports ride the record as `supports` and have no page. The trap is
 *    SPECIFIC: `katara` is a fighter id AND a support id (types/index.ts
 *    RecordSupports), so "no character page for a support id" is wrong as
 *    written — it would delete the game's most-played fighter. The rule is that
 *    the prerendered character set is EXACTLY the fighter roster, and that a
 *    support-only id is linked nowhere.
 *  · summary.json carries `engine` (checklist 10i). A pin-only change moves no
 *    record and no content hash, so the deploy check matched a build that was
 *    still building. This is the only place the repo's pin and the payload's can
 *    be compared before the payload is deployed.
 *  · THE ART LICENCE POSITION (checklist 15). The rights holder prohibits reuse
 *    outright, so this game ships NO artCredit — and the absence is a finding
 *    rather than an omission, which means it has to be asserted. A footer credit
 *    appearing here would mean somebody pasted a sibling's config.
 *  · A SET FORMAT IS NEVER AN EVENT (checklist 12k). The index source's `tag`
 *    column is mixed: event names AND set formats (`FT5`..`FT30`). The badge
 *    prints `event` instead of the source name, so a format tag reaching it
 *    renders a chip that says "FT10" where a tournament name belongs.
 *
 * Run: npm run test:e2e   (after `npm run build`)
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SLUG = 'avatar';
const OUT = join(ROOT, '.vercel', 'output', 'static', SLUG);

let pass = 0;
let fail = 0;
let skipped = 0;
const failures: string[] = [];
const skips: string[] = [];

const check = (name: string, ok: boolean, detail = ''): void => {
  if (ok) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
};
const skip = (name: string, why: string): void => {
  skipped++;
  skips.push(`${name} — ${why}`);
  console.log(`  ⊘ ${name} — SKIPPED: ${why}`);
};

if (!existsSync(OUT)) {
  console.error(`✖ ${OUT} does not exist. Run \`npm run build\` first.`);
  process.exit(1);
}

const read = (p: string): string => readFileSync(join(OUT, p), 'utf8');
const has = (p: string): boolean => existsSync(join(OUT, p));
const src = (p: string): string => readFileSync(join(ROOT, p), 'utf8');

/**
 * A wave-gated assertion. `stage('scripts/art.ts')` returns null once that file
 * exists — the assertion is then HARD — and a reason string until it does, which
 * `checkStage` turns into a named, counted skip.
 *
 * This is not the soft skip verify-gates.ts refuses. There the precondition is
 * data that a fetch would provide; here it is a PRODUCER that has not been
 * written, which is a fact about the repo that the repo itself can state. And it
 * arms itself: no comment has to be remembered when the wave lands.
 */
const stage = (script: string): string | null =>
  existsSync(join(ROOT, script)) ? null : `${script} has not shipped yet`;

const checkStage = (
  pendingOn: string | null,
  name: string,
  ok: () => boolean,
  detail: () => string = () => '',
): void => {
  if (pendingOn !== null) {
    skip(name, pendingOn);
    return;
  }
  check(name, ok(), detail());
};

// ── build output ────────────────────────────────────────────────────────────

console.log('▶ build output\n');
check('index.html prerendered', has('index.html'));
check('stats page prerendered', has('stats/index.html'));
check('characters index prerendered', has('characters/index.html'));
check('players index prerendered', has('players/index.html'));
check('404.html emitted', has('404.html'));
check('sitemap.xml emitted', has('sitemap.xml'));
check('robots.txt emitted', has('robots.txt'));
check('manifest emitted', has('manifest.webmanifest'));
check('replays.json shipped under the base', has('data/replays.json'));
check('summary.json shipped (the apex selector reads this)', has('data/summary.json'));
checkStage(
  stage('scripts/og.ts'),
  'OG card shipped',
  () => has('og-default.png'),
  () => 'og-default.png is missing from the build',
);

// ── the apex card payload's CONTRACT ────────────────────────────────────────
//
// Three things, and two of them shipped wrong on a sibling with nothing on the
// page to show for it:
//
//  · the identity key is `game`, not `id`. Every sibling emits {"game": …} and
//    the shell's cutover battery asserts payload.game === the game's id. CotW
//    shipped `id`, the battery read game=undefined, and the page looked perfect.
//  · `updated` is the NEWEST REPLAY's date, never the build time. The cron only
//    commits files that actually changed, so a build-time stamp makes this file
//    differ on every run and puts a deploy on the calendar daily whether or not
//    a single match arrived.
//  · `engine` is the ENGINE TAG THIS BUILD PINS (checklist 10i). It is read here
//    from nuxt.config.ts rather than retyped, so bumping the pin cannot leave
//    this check asserting yesterday's version. scripts/verify-deployed.ts reads
//    the same field off the DEPLOYED payload and compares it with the same pin;
//    this is the pre-deploy half of that pair, and the only place the repo can
//    catch the field missing before the smoke check spends fifteen minutes
//    polling for a fingerprint that will never arrive.
console.log('\n▶ the apex card payload (data/summary.json)\n');
const summary = JSON.parse(read('data/summary.json')) as {
  game?: string;
  id?: string;
  name?: string;
  engine?: string;
  replays?: number;
  players?: number;
  characters?: number;
  updated?: string;
};
check(
  'summary.json identity key is `game` (the platform contract), not `id`',
  summary.game === SLUG && summary.id === undefined,
  JSON.stringify(summary),
);

const ENGINE_PIN = /replay-engine#(v[\d.]+)/.exec(src('nuxt.config.ts'))?.[1] ?? '';
check(
  'nuxt.config.ts pins a concrete engine tag (never a branch)',
  /^v\d+\.\d+\.\d+$/.test(ENGINE_PIN),
  `read "${ENGINE_PIN}" out of the extends[] entry`,
);
check(
  `summary.json carries \`engine\` and it is the pinned tag ${ENGINE_PIN}`,
  summary.engine === ENGINE_PIN,
  `summary says ${JSON.stringify(summary.engine)} — scripts/emit.ts must write ` +
    `"engine": "${ENGINE_PIN}", the tag verbatim as nuxt.config.ts spells it (leading "v" and ` +
    `all). Without it verify:deployed cannot tell a landed pin bump from a build in flight ` +
    '(checklist 10i).',
);

// ── the theme override contract (STACK §5.13) ───────────────────────────────
//
// The failure this catches is the one the engine README calls out: an app
// stylesheet written as @theme ships raw, the browser drops it as an unknown
// at-rule, and PRODUCTION SILENTLY WEARS THE UMBRELLA DEFAULTS while `nuxt dev`
// — which compiles each CSS file on its own — looks perfect.
//
// PRESENCE OF THE UMBRELLA DEFAULT IS NOT A FAILURE. The engine ships its
// neutral palette as a FALLBACK inside `@layer theme`, and the game's unlayered
// `:root` wins the cascade over it. That is the documented contract, not a leak.
// What has to hold is STRUCTURAL rather than positional: an unlayered rule beats
// a layered one wherever it appears. So the check reads BRACE DEPTH — ours must
// sit at depth 1, the umbrella's deeper.
console.log('\n▶ theme override (the @theme trap, and the layer contract)\n');

/** The stylesheets index.html actually loads, in document order — readdir order
 *  is not the cascade and would make the comparison below meaningless. */
const cssHrefs = [...read('index.html').matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)]
  .map((m) => m[1])
  .map((href) => href.replace(new RegExp(`^/${SLUG}/`), ''))
  .filter((p) => has(p));
const css = cssHrefs.map((p) => read(p)).join('\n');
check(
  'the home page loads at least one stylesheet',
  cssHrefs.length > 0,
  'no <link rel="stylesheet"> in index.html',
);

/** Nesting depth at `index`, quoted strings skipped. Depth 1 means a top-level
 *  block; anything deeper is inside an at-rule. */
const depthAt = (text: string, index: number): number => {
  let depth = 0;
  let quote = '';
  for (let i = 0; i < index; i++) {
    const c = text[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = '';
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') depth--;
  }
  return depth;
};

// The 18 engine tokens this game shadows. app/assets/theme.css is the authority;
// the list is READ FROM IT rather than retyped, so adding a token there cannot
// leave this check asserting yesterday's set. 18 is the engine's full semantic
// set — the handoff declares 16 and theme.css derives the other five and renames
// one (checklist 14, argued in that file's header).
const shadowed = [
  ...new Set(
    [...src('app/assets/theme.css').matchAll(/^ {2}(--color-[a-z0-9-]+):/gm)].map((m) => m[1]),
  ),
];
check(
  'app/assets/theme.css shadows 18 engine --color-* tokens',
  shadowed.length === 18,
  `${shadowed.length}: ${shadowed.join(', ')}`,
);
const missingTokens = shadowed.filter((t) => !css.includes(`${t}:`));
check(
  'every shadowed --color-* token reaches the built CSS',
  missingTokens.length === 0,
  missingTokens.join(', '),
);
check(
  'no raw @theme block shipped (the browser would drop it as an unknown at-rule)',
  !css.includes('@theme'),
  'an @theme at-rule reached the bundle',
);

const OURS = '#4ec0ed'; // --color-primary, the AVATAR wordmark blue
const UMBRELLA = '#17cfc8'; // the engine's neutral default (tailwind/theme-default.css)
const oursAt = css.toLowerCase().lastIndexOf(OURS);
const umbrellaAt = css.toLowerCase().lastIndexOf(UMBRELLA);
check(`the built CSS carries the Avatar primary ${OURS}`, oursAt >= 0);
check('the built CSS carries the Avatar page bg #141210', css.toLowerCase().includes('#141210'));
check(
  'the Avatar :root is UNLAYERED (depth 1) — an @layer rule would lose the cascade',
  oursAt >= 0 && depthAt(css, oursAt) === 1,
  oursAt >= 0 ? `it sits at brace depth ${depthAt(css, oursAt)}` : 'the primary is absent',
);
check(
  'the umbrella default is layered (it is a fallback, not a competitor)',
  umbrellaAt < 0 || depthAt(css, umbrellaAt) > 1,
  `the umbrella primary sits at depth ${umbrellaAt < 0 ? 'n/a' : depthAt(css, umbrellaAt)}`,
);

// ── the accents ─────────────────────────────────────────────────────────────
//
// Accents are the ONE place a game's palette reaches components by character id.
// The engine's plugin injects them through useHead, so they are in the
// PRERENDERED HTML rather than only after hydration — which is what makes them
// checkable here at all.
//
// THE CONFIG DECLARES MORE THAN THE ROSTER, ON PURPOSE, and that asymmetry is
// the interesting half. app.config.ts carries an accent for the five announced-
// but-unreleased fighters too, so the day one ships the skin is already there.
// An accent belonging to NEITHER the roster nor scripts/expiries.ts UNRELEASED
// is an orphan: a typo'd id, or a fighter somebody added to one file and not the
// other. The two files are on separate TypeScript tracks (app/ vs scripts/), so
// this is the only place they meet.
console.log('\n▶ accents (12 roster + the announced-but-unreleased rows)\n');
const characters = JSON.parse(src('data/characters.json')) as {
  id: string;
  accent: string;
  name: string;
  imgPortrait: string;
}[];
check('roster is non-empty', characters.length > 0, `${characters.length} fighters`);
const home = read('index.html');
const injected = new Map(
  [...home.matchAll(/--accent-([a-z0-9-]+):(#[0-9a-fA-F]{6})/g)].map((m) => [
    m[1],
    m[2].toLowerCase(),
  ]),
);
const missingAccents = characters.filter(
  (c) => injected.get(c.id) !== c.accent.toLowerCase().trim(),
);
check(
  `all ${characters.length} roster accents are injected as --accent-<id> in the prerendered HTML`,
  missingAccents.length === 0,
  missingAccents
    .slice(0, 3)
    .map((c) => `${c.id} wants ${c.accent}, built ${injected.get(c.id) ?? '(absent)'}`)
    .join(', '),
);
const rosterIds = new Set(characters.map((c) => c.id));
const unreleasedIds = new Set(
  [...src('scripts/expiries.ts').matchAll(/^ {4}id: '([a-z0-9-]+)',$/gm)].map((m) => m[1]),
);
const orphanAccents = [...injected.keys()].filter(
  (id) => !rosterIds.has(id) && !unreleasedIds.has(id),
);
check(
  'every injected accent belongs to the roster or to an UNRELEASED row',
  orphanAccents.length === 0,
  `${orphanAccents.join(', ')} — in app/app.config.ts accents and in neither ` +
    'data/characters.json nor scripts/expiries.ts UNRELEASED',
);

// ── the sourceChannels NAME SYNC ────────────────────────────────────────────
//
// scripts/channels.ts (pipeline track) and app/app.config.ts (Nuxt track) each
// hold the same 33 {id, name} pairs by hand. tsconfig.pipeline.json includes only
// scripts/ and types/; the Nuxt graph includes only app/ — so no compiler on this
// platform can see both, and no test in the pipeline can reach the config.
//
// The BUILT app is where they meet: app.config.ts is bundled into the client
// chunk, and the channel list is what SourceBadge names on every card. So the
// assertion is: what the bundle SHIPS must equal what the pipeline DECLARES.
//
// THE PORTED READER IS TOO NARROW FOR THIS GAME. ggst's is
// `id:\s*'([A-Za-z]+)'` and four ids here carry digits (an11Mo, teo1029,
// mysteryRacer21, atma00), so it reads 29 of 33 — measured 2026-09-18 — and
// every count below would agree with itself while missing four channels.
console.log('\n▶ sourceChannels name sync (two hand-kept lists, separate TS tracks)\n');

const declared = [
  ...src('scripts/channels.ts').matchAll(
    /\bid:\s*'([A-Za-z0-9]+)',\s*\n\s*source:\s*'[A-Za-z0-9]+',\s*\n\s*name:\s*'([^']+)'/g,
  ),
].map((m) => ({ id: m[1], name: m[2] }));
check(
  'scripts/channels.ts yields all 33 {id, source, name} triples',
  declared.length === 33,
  `the reader matched ${declared.length} — if the count is 29, the [A-Za-z]+ id class was ` +
    'pasted back in and the four ids with digits dropped out',
);

const jsChunks = readdirSync(join(OUT, '_nuxt')).filter((f) => f.endsWith('.js'));
// Find the chunk carrying the DECLARED ARRAY, not merely the word. Several chunks
// mention `sourceChannels` — FilterBar, FilterDrawer and SourceBadge all read it
// — and the engine's own empty default (`sourceChannels:[]`) can sit in the same
// chunk as the game's. Matching on the word alone picks whichever chunk readdir
// returns first and then reports "built 0" against a pipeline that declares 33.
const CONFIG_ARRAY = /sourceChannels:\s*\[\s*\{/;
const bundleWith = jsChunks.find((f) => CONFIG_ARRAY.test(read(join('_nuxt', f))));
if (!bundleWith) {
  check('the built bundle carries sourceChannels', false, 'no chunk carries the declared array');
} else if (declared.length === 0) {
  check('scripts/channels.ts yields its {id, name} pairs', false, 'the reader matched nothing');
} else {
  const chunk = read(join('_nuxt', bundleWith));
  const list = /sourceChannels:\s*\[(\s*\{.*?)\]/s.exec(chunk)?.[1] ?? '';
  const shipped = [
    ...list.matchAll(/\{\s*id:\s*["'`]([^"'`]+)["'`]\s*,\s*name:\s*["'`]([^"'`]+)["'`]\s*\}/g),
  ].map((m) => ({ id: m[1], name: m[2] }));
  check(
    'the built app ships one sourceChannel per pipeline channel',
    shipped.length === declared.length,
    `built ${shipped.length}, pipeline declares ${declared.length}`,
  );
  const drifted = declared.filter((d) => !shipped.some((s) => s.id === d.id && s.name === d.name));
  check(
    `all ${declared.length} channel ids AND display names agree between the two lists`,
    drifted.length === 0,
    drifted
      .map(
        (d) =>
          `${d.id}: pipeline "${d.name}", built "${shipped.find((s) => s.id === d.id)?.name ?? '(absent)'}"`,
      )
      .join(' · '),
  );
}

// sourceGroups membership, asserted in BOTH directions and corpus-independently.
// 33 chips are unusable at every breakpoint, so the filter row collapses them
// into two groups — which means a source in no group is UNREACHABLE from the
// filter bar even though its records exist and its badge renders, and a group
// naming a source that does not exist is a chip that selects nothing.
const groupsBlock =
  /sourceGroups:\s*\[([\s\S]*?)\n {4}\],/.exec(src('app/app.config.ts'))?.[1] ?? '';
const grouped = new Set(
  [...groupsBlock.matchAll(/sources:\s*\[([\s\S]*?)\]/g)].flatMap((m) =>
    [...m[1].matchAll(/'([A-Za-z0-9]+)'/g)].map((s) => s[1]),
  ),
);
const ungrouped = declared.filter((d) => !grouped.has(d.id)).map((d) => d.id);
check(
  'every configured source belongs to a sourceGroup',
  ungrouped.length === 0,
  `${ungrouped.join(', ')} — those records cannot be reached from the filter bar`,
);
const phantomGroupMembers = [...grouped].filter((s) => !declared.some((d) => d.id === s));
check(
  'no sourceGroup names a source that does not exist',
  phantomGroupMembers.length === 0,
  `${phantomGroupMembers.join(', ')} — a chip that can never select anything`,
);

// ── THE SUPPORT NAMESPACE (checklist 13) ────────────────────────────────────
//
// Every side of this game picks a FIGHTER and a SUPPORT. The supports are their
// own registry with their own matcher, they never enter `Side.characters`, and
// they have no page — that is the whole design, and the built site is where it
// either held or did not.
//
// THE OVERLAP IS THE TRAP AND IT IS NAMED RATHER THAN AVOIDED. `katara` is a
// launch fighter AND Avatar Aang's support (types/index.ts RecordSupports,
// scripts/parse-finish.ts step 5b). So "no character page exists for a support
// id" is FALSE AS WRITTEN — enforcing it would delete the roster's most-played
// fighter. What is true, and what is asserted here, is that the prerendered
// character set is EXACTLY the fighter roster: a support that is only a support
// has no page, and one that is also a fighter has a page as the FIGHTER.
console.log('\n▶ the support namespace (checklist 13)\n');
const supports = JSON.parse(src('data/supports.json')) as {
  id: string;
  name: string;
  owner: string;
}[];
const supportIds = new Set(supports.map((s) => s.id));
check(
  'data/supports.json is populated',
  supports.length > 0,
  `${supports.length} supports for ${characters.length} fighters`,
);
const badOwners = supports.filter((s) => !rosterIds.has(s.owner));
check(
  "every support's owner is a roster fighter",
  badOwners.length === 0,
  badOwners
    .slice(0, 3)
    .map((s) => `${s.id} → ${s.owner}`)
    .join(', '),
);

const pagedCharacters = existsSync(join(OUT, 'characters'))
  ? readdirSync(join(OUT, 'characters')).filter((d) => has(join('characters', d, 'index.html')))
  : [];
const pagedNotRoster = pagedCharacters.filter((id) => !rosterIds.has(id));
const rosterNotPaged = characters.map((c) => c.id).filter((id) => !pagedCharacters.includes(id));
check(
  'the prerendered character set is EXACTLY the fighter roster',
  pagedNotRoster.length === 0 && rosterNotPaged.length === 0,
  `paged-but-not-roster: ${pagedNotRoster.join(', ') || 'none'} · ` +
    `roster-but-not-paged: ${rosterNotPaged.join(', ') || 'none'}`,
);
const supportOnly = [...supportIds].filter((id) => !rosterIds.has(id));
const supportWithPage = supportOnly.filter((id) => pagedCharacters.includes(id));
check(
  `no support-only id has a character page (${supportOnly.length} of ${supports.length} supports ` +
    `are not also fighters; ${supports.length - supportOnly.length} is)`,
  supportWithPage.length === 0,
  supportWithPage.join(', '),
);
// A badge that deep-links a support-only id would 404 on static hosting, and it
// is the FIRST thing a "supports are just characters" refactor produces. Checked
// on the rendered pages, not on a component's source, because the config can be
// right while the template builds the href itself.
const linkedSupportOnly = supportOnly.filter((id) =>
  new RegExp(`href="[^"]*/${SLUG}/characters/${id}(?:/|")`).test(home),
);
check(
  'the home page links no support-only id as a character route',
  linkedSupportOnly.length === 0,
  linkedSupportOnly.join(', '),
);

// ── art: the LICENCE POSITION, and the tiles when they exist ────────────────
//
// CHECKLIST 15, AND THE ABSENCE IS THE FINDING. The rights holder prohibits
// reuse outright ("STRICTLY PROHIBITED WITHOUT THE PRIOR WRITTEN CONSENT",
// reference.paramount.com/terms-of-use, read 2026-09-18), publishes no fan kit,
// and the wiki copies are pixel-identical to the vendor's own renders, so they
// inherit the same terms. Every tile here is GENERATED and owes credit to
// nobody, which is why app.config.ts declares NO artCredit.
//
// That absence has to be ASSERTED, not assumed. Every sibling declares one, the
// engine renders `GameConfig.artCredit` in the footer whenever it is present,
// and the likeliest way one appears here is somebody copying a sibling's config
// — which would publish a false attribution to a rights holder who refused.
console.log('\n▶ art: the licence position (checklist 15)\n');
const appConfigSrc = src('app/app.config.ts');
check(
  'app.config.ts declares NO artCredit (the vendor prohibits reuse; every tile is generated)',
  !/^\s*artCredit:/m.test(appConfigSrc),
  'an artCredit appeared — every tile on this game is generated and owes credit to nobody',
);
const creditPages = ['index.html', 'characters/index.html', 'stats/index.html'].filter((p) =>
  has(p),
);
const creditLeaks = creditPages.filter((p) => /©\s*(Paramount|Viacom|Nickelodeon)/i.test(read(p)));
check(
  `no page renders a vendor art credit (${creditPages.length} sampled)`,
  creditLeaks.length === 0,
  creditLeaks.join(', '),
);

const ART = stage('scripts/art.ts');
if (ART !== null) {
  skip('the art provenance record', ART);
  skip('portrait shape and tile hashes', ART);
} else {
  // THE PROVENANCE FILE IS THE LICENCE RECORD, not a manifest. It has to carry
  // the citation that was actually read, the finding, and the expiry that goes
  // back to look for a fan kit — otherwise "we generated these because we had
  // to" is an assertion nobody can check a year from now.
  const prov = JSON.parse(src('data/art-provenance.json')) as {
    licence?: { source?: string; read?: string; finding?: string };
    expiry?: { kind?: string; date?: string };
    tiles?: number;
    files?: { id?: string; file?: string; sha256?: string }[];
  };
  check(
    'data/art-provenance.json cites the terms it read, with the date',
    typeof prov.licence?.source === 'string' &&
      /^https?:\/\//.test(prov.licence.source) &&
      /^\d{4}-\d{2}-\d{2}$/.test(prov.licence?.read ?? '') &&
      (prov.licence?.finding ?? '').length > 40,
    JSON.stringify(prov.licence ?? null).slice(0, 120),
  );
  check(
    'it carries an expiry that goes back to look for a fan kit (checklist 15)',
    typeof prov.expiry?.kind === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(prov.expiry?.date ?? ''),
    JSON.stringify(prov.expiry ?? null).slice(0, 120),
  );
  const provFiles = prov.files ?? [];
  const unvouched = characters.filter(
    (c) => !provFiles.some((f) => f.id === c.id && f.file === c.imgPortrait),
  );
  check(
    'every roster fighter has a provenance row naming the exact file characters.json points at',
    unvouched.length === 0,
    unvouched
      .slice(0, 3)
      .map((c) => `${c.id} → ${c.imgPortrait}`)
      .join(', '),
  );

  const portraits = characters.map((c) => c.imgPortrait.replace(/^\//, ''));
  const missingArt = portraits.filter((p) => !has(p));
  check(
    'a portrait ships for every fighter, at the path characters.json names',
    missingArt.length === 0,
    missingArt.slice(0, 3).join(', '),
  );
  const offRatio: string[] = [];
  const unhashed: string[] = [];
  for (const c of characters) {
    const p = c.imgPortrait.replace(/^\//, '');
    if (!has(p)) continue;
    const m = await sharp(join(OUT, p)).metadata();
    // One pixel of tolerance: an integer height rarely divides exactly.
    if (Math.abs(m.width / m.height - 0.75) > 0.75 / m.height) {
      offRatio.push(`${p} ${m.width}×${m.height}`);
    }
    // THE SHIPPED BYTES ARE THE VOUCHED-FOR BYTES. The provenance row's whole
    // claim is "this file was generated here and fetched from nobody"; comparing
    // the built artefact's hash against it is what stops that claim drifting
    // away from the file it describes — a hand-dropped image would keep the
    // path, the ratio and the row, and change only this.
    const want = (prov.files ?? []).find((f) => f.id === c.id)?.sha256 ?? '';
    const got = createHash('sha256')
      .update(readFileSync(join(OUT, p)))
      .digest('hex');
    if (want !== got)
      unhashed.push(`${c.id} ${got.slice(0, 12)}… vs ${want.slice(0, 12) || '(none)'}…`);
  }
  check(
    'every portrait is a 3:4 crop (the grid draws aspect-[3/4] object-cover and re-crops anything else)',
    offRatio.length === 0,
    offRatio.slice(0, 3).join(', '),
  );
  check(
    'every shipped tile hashes to what data/art-provenance.json vouches for',
    unhashed.length === 0,
    unhashed.slice(0, 3).join(', '),
  );
}

// ── the public data contract ────────────────────────────────────────────────

console.log('\n▶ data contract\n');
const replays = JSON.parse(read('data/replays.json')) as {
  id: string;
  sides: { player: string; characters: string[] }[];
  supports?: (string | null)[];
  date: string;
  patch?: string;
  source: string;
  title: string;
  videoId?: string;
  startSeconds?: number;
  /** What the badge prints instead of the source name (engine v0.13.0). */
  event?: string;
  channelName?: string;
}[];
const EMPTY = replays.length === 0;

if (EMPTY) {
  skip(
    'every record-shaped assertion',
    'empty corpus — 0 replays in the build. This is the legitimate day-one state: ' +
      'scripts/emit.ts has not run, or has run against an empty data/videos.json.',
  );
} else {
  const rawPayload = read('data/replays.json');
  check(
    'no pipeline provenance in the public payload',
    !/"(provenance|fromTitle|fromIndex|slotOrder|intake|handle|tieBroken|publishedAt)"/.test(
      rawPayload,
    ),
    'MatchSide.provenance and MatchVideo.intake/publishedAt are substrate — emit projects ' +
      'field by field and must never spread a side',
  );
  check(
    'every side has at least one character',
    replays.every((r) => r.sides.every((s) => s.characters.length >= 1)),
  );
  const unknown = [...new Set(replays.flatMap((r) => r.sides.flatMap((s) => s.characters)))].filter(
    (c) => !rosterIds.has(c),
  );
  check(
    'every character id resolves against the FIGHTER roster',
    unknown.length === 0,
    unknown.slice(0, 3).join(', '),
  );
  // The namespace assertion, on what actually shipped. scripts/parse-finish.ts
  // throws on this before writing; here it is checked on the emitted payload,
  // which is a different file written by a different script.
  const supportsAsCharacters = [
    ...new Set(replays.flatMap((r) => r.sides.flatMap((s) => s.characters))),
  ].filter((c) => supportIds.has(c) && !rosterIds.has(c));
  check(
    'no support id reached Side.characters',
    supportsAsCharacters.length === 0,
    `${supportsAsCharacters.join(', ')} — the stat unit, the character pages and the ` +
      'prerender set would all inherit a second roster',
  );
  const withSupports = replays.filter((r) => r.supports !== undefined);
  const badSupportShape = withSupports.filter(
    (r) =>
      !Array.isArray(r.supports) ||
      r.supports.length !== 2 ||
      r.supports.some((s) => s !== null && !supportIds.has(s)),
  );
  check(
    `every \`supports\` tuple is index-aligned with sides and resolves (${withSupports.length} of ` +
      `${replays.length} records carry one)`,
    badSupportShape.length === 0,
    badSupportShape
      .slice(0, 3)
      .map((r) => `${r.id}: ${JSON.stringify(r.supports)}`)
      .join(', '),
  );
  check(
    'every record carries a patch token',
    replays.every((r) => !!r.patch),
  );
  check('record ids are unique', new Set(replays.map((r) => r.id)).size === replays.length);

  // THE INDEX INTAKE'S TWO RECORD SHAPES. A SEGMENT carries videoId AND
  // startSeconds; a whole-video record carries neither and its id IS the YouTube
  // id. The trap is `...(v.startSeconds ? {…} : {})` written for startSeconds
  // alone, which strips videoId from every offset-zero record and leaves the
  // embed building a URL against the composite id — and on THIS catalogue the
  // offset-zero segment is not hypothetical: five multi-row videos have a t=0
  // first row that IS a segment (checklist 12k).
  const segments = replays.filter((r) => r.startSeconds !== undefined);
  check(
    'segment records carry BOTH videoId and startSeconds',
    segments.every((r) => typeof r.videoId === 'string' && r.videoId.length === 11),
    'a startSeconds with no videoId would build a URL against the record id',
  );
  const composite = replays.filter((r) => r.id.includes('@'));
  check(
    'every composite id is a segment and vice versa',
    composite.length === segments.length && composite.every((r) => r.startSeconds !== undefined),
    `${composite.length} composite ids vs ${segments.length} segments`,
  );
  check(
    'a whole-video record carries neither field (its id IS the YouTube id)',
    replays
      .filter((r) => !r.id.includes('@'))
      .every((r) => r.startSeconds === undefined && r.videoId === undefined),
  );

  const ungroupedSources = [...new Set(replays.map((r) => r.source))].filter(
    (s) => !grouped.has(s),
  );
  check(
    'every EMITTED source belongs to a sourceGroup',
    ungroupedSources.length === 0,
    `${ungroupedSources.join(', ')} — those records cannot be reached from the filter bar`,
  );

  // ── the badge names the EVENT, not the catalogue (engine v0.13.0) ─────────
  // Both label arms are live on this game: the index source's tagged rows
  // publish the event, and its untagged rows publish the uploader (30 of them
  // across 93 videos, measured 2026-09-18), because calling those "Tournament"
  // would be false about every one.
  const indexed = replays.filter((r) => r.source === 'replayTheater');
  const byEvent = indexed.filter((r) => r.event);
  const byChannel = indexed.filter((r) => r.channelName);
  check(
    'every index-sourced record carries at most one label',
    !indexed.some((r) => r.event && r.channelName),
    `${byEvent.length} with an event, ${byChannel.length} with an uploader, ` +
      `${indexed.filter((r) => r.event && r.channelName).length} with both`,
  );
  check(
    'no channel-sourced record carries a label',
    replays.every((r) => r.source === 'replayTheater' || (!r.event && !r.channelName)),
    'labels are emitted only by the index intake',
  );
  check(
    'no emitted label is empty or blank',
    replays.every((r) => (r.event ?? 'x').trim() !== '' && (r.channelName ?? 'x').trim() !== ''),
    'an empty label would render a bordered chip with no text',
  );
  // CHECKLIST 12k — A SET FORMAT IS NEVER AN EVENT. The catalogue's `tag` column
  // is mixed on this game: event names AND set formats (FT5..FT30, measured over
  // its 244 rows on 2026-09-18). The badge prints `event` INSTEAD of the source
  // name, so a format reaching it renders a chip that says "FT10" where a
  // tournament belongs. The pattern is the channel's own declaration
  // (scripts/channels.ts replayTheater.index.formatTagPattern), read rather than
  // retyped.
  const FORMAT_TAG = new RegExp(
    /formatTagPattern:\s*\/([^/]+)\//.exec(src('scripts/channels.ts'))?.[1] ?? '^FT\\d+$',
  );
  const formatsAsEvents = byEvent.filter((r) => FORMAT_TAG.test(r.event!));
  check(
    `no set FORMAT was published as an event (${FORMAT_TAG.source})`,
    formatsAsEvents.length === 0,
    formatsAsEvents
      .slice(0, 3)
      .map((r) => `${r.id} → "${r.event}"`)
      .join(', '),
  );
  // An uploader spelled like a tracked channel would render a chip
  // indistinguishable from that channel's, on a record filed under a different
  // source. This is the tripwire.
  const configured = new Set(declared.map((c) => c.name));
  const collide = [...new Set(byChannel.map((r) => r.channelName!))].filter((n) =>
    configured.has(n),
  );
  check(
    'no uploader label collides with a configured source name',
    collide.length === 0,
    collide.join(', '),
  );
  // The card caps the chip and ellipsizes past it, so a runaway tag should fail
  // HERE rather than render as a three-word fragment.
  const longest = [...byEvent, ...byChannel].reduce(
    (n, r) => Math.max(n, (r.event ?? r.channelName ?? '').length),
    0,
  );
  check('longest label is within the card budget', longest <= 60, `${longest} chars (cap 60)`);

  check(
    'summary.json replay count matches the emitted archive',
    summary.replays === replays.length,
    `summary says ${summary.replays}, archive holds ${replays.length}`,
  );
  // THE DATE IS THE PLAYED-ON DATE WHERE A CHANNEL STATES ONE (checklist 5s), so
  // `updated` is the newest RECORD date and not the newest upload date. On
  // `still` the two differ by up to 23 measured days, and a summary keyed on
  // publishedAt would credit a backlog flush to the week it was uploaded in.
  const newestDay = replays.reduce((n, r) => (r.date > n ? r.date : n), '').slice(0, 10);
  check(
    'summary.json `updated` is the newest replay date, not the build date',
    summary.updated === newestDay,
    `summary says ${summary.updated}, newest replay is ${newestDay}`,
  );

  // A prerendered entity page must contain REAL content, not an empty shell —
  // that is the whole reason the registries are provided rather than fetched.
  const sample = characters[0];
  if (has(`characters/${sample.id}/index.html`)) {
    const html = read(`characters/${sample.id}/index.html`);
    check(
      `/characters/${sample.id} prerenders with a data-derived <title>`,
      /<title>[^<]*\w[^<]*<\/title>/.test(html),
    );
    check(
      `/characters/${sample.id} carries its accent`,
      html.toLowerCase().includes(sample.accent.toLowerCase()),
    );
  } else {
    check(`/characters/${sample.id} prerendered`, false, 'missing from the build');
  }

  const players = JSON.parse(src('data/players.json')) as { id: string }[];
  const p = players[0]?.id;
  check(
    'player pages prerendered (they must not 404 on static hosting)',
    !!p && has(`players/${p}/index.html`),
  );
}

// ── ComboForge cross-link (engine v0.11.0/v0.12.0) ──────────────────────────
//
// Corpus-independent on purpose: the partner link is on the character page and
// the character pages exist from day one. Their game id is `ava`, NOT this
// game's slug, and their character ids are SHORT (`ava-toph`) — the reverse of
// the sibling precedent, which is what checklist 11c was written from. Two
// overrides carry the Avatar State slots, whose partner ids are out of date
// against the partner's own display names.
console.log('\n▶ partner cross-link\n');
const sampleChar = characters.find((c) => c.id === 'toph') ?? characters[0];
if (sampleChar && has(`characters/${sampleChar.id}/index.html`)) {
  const html = read(`characters/${sampleChar.id}/index.html`);
  check('character page links to ComboForge', html.includes('comboforge.gg'));
  check(
    'the deep link carries THEIR gameId (`ava`), not our slug',
    /comboforge\.gg[^"']*gameId=ava(?![A-Za-z0-9-])/.test(html),
    'a link built from game.slug would read gameId=avatar and 404 on their side',
  );
  const overrides = /comboforge:\s*\{[\s\S]*?characters:\s*\{([\s\S]*?)\}/.exec(appConfigSrc)?.[1];
  const overridden = [...(overrides ?? '').matchAll(/'([a-z0-9-]+)':\s*'([a-z0-9-]+)'/g)];
  check(
    'the two Avatar State overrides are declared',
    overridden.length === 2,
    `${overridden.length} override(s): ${overridden.map((m) => `${m[1]}→${m[2]}`).join(', ')}`,
  );
  for (const [, id, partnerId] of overridden) {
    if (!has(`characters/${id}/index.html`)) continue;
    check(
      `/characters/${id} deep-links their id ava-${partnerId}`,
      read(`characters/${id}/index.html`).includes(`characterId=ava-${partnerId}`),
    );
  }
} else {
  check('a character page prerendered to carry the partner link', false, 'none in the build');
}

console.log(
  `\n${fail === 0 ? '✓' : '✖'} ${pass} passed · ${fail} failed · ${skipped} skipped` +
    (EMPTY ? '  (EMPTY-CORPUS MODE)' : ''),
);
if (skips.length) {
  console.log('\nSkipped, with the precondition each one is waiting on:\n');
  for (const s of skips) console.log(`  ${s}`);
}
if (failures.length) {
  console.error('\nFailures:\n');
  for (const f of failures) console.error(`  ${f}`);
}
process.exit(fail === 0 ? 0 : 1);
