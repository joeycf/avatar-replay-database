/**
 * Build the character art — and on this game that means GENERATE ALL OF IT.
 *
 * ── THE LICENCE, READ FIRSTHAND 2026-09-18 (checklist 15) ─────────────────
 * "Art has a licence, and reading it is the first step of the art chain." The
 * reading here is the case nobody had planned for, and it closes the chain
 * before it opens:
 *
 *   · THE RIGHTS HOLDER PROHIBITS REUSE OUTRIGHT. reference.paramount.com/
 *     terms-of-use: reproduction of its materials is "STRICTLY PROHIBITED
 *     WITHOUT THE PRIOR WRITTEN CONSENT". There is no fan-content grant, no
 *     non-commercial carve-out and no attribution clause to satisfy — the
 *     shape every sibling's art chain assumes.
 *   · THERE IS NO FAN KIT. Not on the vendor's site, not on the publisher's,
 *     not on either storefront. Strive's chain starts by enumerating a kit
 *     page; there is no page to enumerate.
 *   · THE WIKI COPIES INHERIT THE PROHIBITION. They are pixel-identical to the
 *     vendor's own renders (mean absolute difference 3.9–24.7 against 71–73
 *     between two different characters), so they are the same asset re-hosted,
 *     and a wiki's own "fair use on this wiki" tag does not transfer.
 *
 * So there is no fetch in this file, no crop, no frame constant and no
 * near-black guard — checklist 15's two mechanical traps are unreachable
 * because nothing external is ever opened. Every one of the seventeen tiles is
 * drawn here from the design handoff's own accents and geometry, and the
 * no-network guard below is enforced rather than asserted in prose.
 *
 * ── SEVENTEEN, NOT TWELVE ─────────────────────────────────────────────────
 * The twelve released fighters (data/characters.json) plus the five ANNOUNCED
 * ones that have a name and an accent (scripts/expiries.ts UNRELEASED). The
 * sixth unreleased row is the Year 1 vote slot: it has no name, no accent and
 * no token on purpose, so it gets no tile — a tile for it would be a fighter
 * this file invented. Drawing the other five now is what makes release day the
 * one-line change scripts/expiries.ts promises: the accent is already derived,
 * the art already exists, and `npm run data:characters` is all that is left.
 *
 * ── FAIL LOUD ─────────────────────────────────────────────────────────────
 * Every id must end with a real file of the right size. A missing one is a
 * throw, never a silent gap and never a placeholder: a fighter silently wearing
 * a different tile looks deliberate. The same applies in reverse — a tile in
 * public/img/char that no id claims is a fighter whose id changed, and it would
 * ship forever.
 *
 * ── PROVENANCE ────────────────────────────────────────────────────────────
 * data/art-provenance.json carries the citation above, the per-file hashes, and
 * a `missing-fan-kit` EXPIRY. scripts/expiries.ts owns four of the five expiry
 * kinds and says so at its own head (expiries.ts:26-29); this is the fifth, and
 * it lives here because the finding it re-checks is this file's.
 *
 * Run: npm run data:art   (manual, never in the cron — nothing here changes
 *                          until the roster or the licence does)
 */

import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { UNRELEASED } from './expiries';
import { assertFonts, FACES, inkBox, loadSharp } from './og';
import type { CharacterRecord, Expiry } from '../types/index';

// scripts/og.ts sets FONTCONFIG_FILE on import, before anything asks for sharp.
// That import is also what gives this file the 5d gate; see assertFonts().

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'img', 'char');
const TOKENS = join(ROOT, 'design', 'handoff', 'tokens.css');
const DATA = join(ROOT, 'data');

/**
 * NO NETWORK, ENFORCED.
 *
 * The rule is "no vendor or wiki fetch anywhere", and a rule that lives only in
 * a comment is a rule a future edit walks past. `fetch` is replaced before any
 * other statement runs, so a line added later that reaches for the vendor's CDN
 * — or a dependency that does — fails immediately and says why. The self-test in
 * main() proves the stub is live, because a guard that cannot fire is
 * indistinguishable from one that passes (checklist step 10).
 */
const NO_NETWORK = 'art.ts: REFUSED — this file must never fetch anything';
globalThis.fetch = (async (input: unknown): Promise<never> => {
  throw new Error(
    `${NO_NETWORK}. Asked for ${String(input)}. The rights holder prohibits reuse of its ` +
      `art (reference.paramount.com/terms-of-use, read 2026-09-18), publishes no fan kit, and ` +
      `the wiki copies are the same files re-hosted. Every tile here is generated; there is ` +
      `nothing to download. See data/art-provenance.json.`,
  );
}) as unknown as typeof fetch;

// ── the licence record ──────────────────────────────────────────────────────

const LICENCE = {
  source: 'https://reference.paramount.com/terms-of-use',
  read: '2026-09-18',
  finding:
    'Reproduction of the rights holder\'s materials is "STRICTLY PROHIBITED WITHOUT THE PRIOR ' +
    'WRITTEN CONSENT". No fan-content grant, no non-commercial carve-out, no attribution ' +
    'clause — so there is no set of conditions under which the vendor art could be published ' +
    'here, and no credit line that would make it permissible.',
  fanKit:
    'None published. Checked on the vendor site, the publisher site and both storefronts ' +
    '(2026-09-18). Every sibling art chain on this platform starts by enumerating a fan-kit ' +
    'page; there is no page to enumerate.',
  wikiCopies:
    'Pixel-identical to the vendor renders (mean absolute difference 3.9-24.7, against 71-73 ' +
    "between two DIFFERENT characters), i.e. the same asset re-hosted. A wiki's own fair-use " +
    'tag does not transfer, so the copies inherit the prohibition.',
  /** No `artCredit` in app/app.config.ts and no notice on the OG card, because
   *  nothing on this site shows the rights holder's artwork. Recorded as an
   *  explicit null rather than omitted — the siblings all carry a string here,
   *  and an absent key reads as an oversight. */
  credit: null,
} as const;

/**
 * WHEN TO LOOK AGAIN, DERIVED RATHER THAN CHOSEN.
 *
 * A licence re-check needs a date and this vendor has published no review
 * cadence, so the date is taken from the one vendor sentence that bounds
 * anything: the EARLIEST backstop in scripts/expiries.ts UNRELEASED — 2026-12-31,
 * which is the arithmetic on "for FREE later this year", published 2026-07-23,
 * for the free DLC fighter Tagah.
 *
 * The link is not decorative. A new fighter is new character art, and a vendor
 * that is going to publish a press or fan kit publishes it around a release.
 * That is the first day the vendor's own words say new art must exist, so it is
 * the first day worth re-reading the terms. Imported, never restated: if that
 * row's backstop moves because the vendor said something new, this moves with it.
 */
const FAN_KIT_RECHECK = UNRELEASED.map((u) => u.backstop)
  .filter((d): d is string => d !== null)
  .sort()[0]!;

const EXPIRY: Expiry = {
  kind: 'missing-fan-kit',
  id: 'art-licence',
  date: FAN_KIT_RECHECK,
  action:
    `Re-read ${LICENCE.source} in full and re-check the vendor and publisher sites for a fan ` +
    `kit or press kit. If the terms still prohibit reuse, bump this date (it is imported from ` +
    `the earliest backstop in scripts/expiries.ts UNRELEASED, so moving that row moves this) ` +
    `and re-run \`npm run data:art\`. If a kit HAS appeared, read its terms firsthand, record ` +
    `the reading beside this one, and only then consider an enumerate-never-construct chain — ` +
    `the generated tiles stay until a licence says otherwise. Never clear this by deleting it.`,
};

// ── the tile ────────────────────────────────────────────────────────────────

const W = 512;
/** 3:4, the platform portrait norm and the exact box the engine's grid draws
 *  (`aspect-[3/4] w-full object-cover`, replay-engine character index). */
const H = Math.round(W / 0.75);

/** design/handoff/tokens.css. INK is --color-primary-contrast, the token that
 *  exists precisely to sit on an accent. */
const SURFACE = '#1D1A16';
const INK = '#12100D';
const CREAM = '#F2EADD';

const NOTCH = 34;
/** The plinth the type sits on. The ground fades toward the bottom-right (the
 *  engine's own accent gradient does), so type placed straight onto it would be
 *  legible on Sokka's pale steel and not on Ozai's ember. The band gives every
 *  name the same known ground. */
const BAND_TOP = 496;

const CINZEL_BOLD = FACES.find((f) => f.family === 'Cinzel' && f.weight === 700)!;
const FIGTREE_BOLD = FACES.find((f) => f.family === 'Figtree' && f.weight === 700)!;

/** The vendor's own grouping, as design/handoff/tokens.css files the accents. */
type Nation = 'water' | 'earth' | 'fire' | 'air' | 'avatar';

const NATION_LABEL: Record<Nation, string> = {
  water: 'Water Tribe',
  earth: 'Earth Kingdom',
  fire: 'Fire Nation',
  air: 'Air Nomads',
  avatar: 'Avatar / non-benders',
};

/** tokens.css section comment → nation token. The section headings ARE the
 *  grouping; this map is the only place their spelling is interpreted. */
const SECTIONS: Record<string, Nation> = {
  'Water Tribe': 'water',
  'Earth Kingdom': 'earth',
  'Fire Nation': 'fire',
  'Air Nomads': 'air',
  'Avatar / non-benders': 'avatar',
};

/**
 * The nation emblem, drawn on a 0–100 box so one transform places it at any
 * size. Geometry only — these are element signs (waves, peaks, flame, air
 * currents, the Avatar's ring), not traced from anything the vendor published,
 * which is the whole point of a generated tile on a prohibited-art game.
 */
function emblem(nation: Nation, stroke: string, width: number): string {
  const s = `fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"`;
  switch (nation) {
    case 'water':
      return (
        `<path d="M10 38 q12 -14 24 0 t24 0 t24 0" ${s}/>` +
        `<path d="M10 56 q12 -14 24 0 t24 0 t24 0" ${s}/>` +
        `<path d="M10 74 q12 -14 24 0 t24 0 t24 0" ${s}/>`
      );
    case 'earth':
      return (
        `<path d="M8 84 L50 16 L92 84 Z" ${s}/>` +
        `<path d="M28 84 L50 48 L72 84 Z" ${s}/>` +
        `<path d="M4 92 H96" ${s}/>`
      );
    case 'fire':
      // Asymmetric, with a curl on the left — a symmetric teardrop reads as
      // WATER at tile size, which is the one confusion this set cannot afford
      // on a game whose four families are the four elements.
      return (
        `<path d="M54 4 C70 28 78 44 78 60 a28 28 0 0 1 -56 0 c0 -11 6 -20 14 -30 ` +
        `c1 10 8 13 13 8 c8 -8 -1 -22 5 -34 Z" ${s}/>` +
        `<path d="M50 48 C58 60 61 65 61 70 a11 11 0 0 1 -22 0 c0 -6 4 -11 11 -22 Z" ${s}/>`
      );
    case 'air':
      return (
        `<path d="M50 6 A44 44 0 1 1 6 50" ${s}/>` +
        `<path d="M50 26 A24 24 0 1 1 26 50" ${s}/>` +
        `<path d="M50 40 A10 10 0 1 1 40 50" ${s}/>`
      );
    case 'avatar':
      // Two rings and four DIAGONAL ticks. On the axes the same marks read as a
      // crosshair; off the axes they read as the four elements meeting, which
      // is what this group is (the two Avatar-State slots and the one
      // non-bender).
      return (
        `<circle cx="50" cy="50" r="36" ${s}/>` +
        `<circle cx="50" cy="50" r="18" ${s}/>` +
        `<path d="M85 15 L76 24 M85 85 L76 76 M15 85 L24 76 M15 15 L24 24" ${s}/>` +
        `<circle cx="50" cy="50" r="6" fill="${stroke}"/>`
      );
  }
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

interface Tile {
  id: string;
  name: string;
  nation: Nation;
  accent: string;
  /** Released fighters are on the roster; gated ones are drawn ahead of time. */
  state: 'released' | 'announced';
}

function tileSvg(t: Tile, nameSize: number, labelSize: number): string {
  const clip = `M0 0 H${W - NOTCH} L${W} ${NOTCH} V${H} H${NOTCH} L0 ${H - NOTCH} Z`;
  const EM = 232;
  const emX = (W - EM) / 2;
  const emY = 176;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
    `<defs>` +
    // The engine's own missing-art fallback, rebuilt in SVG:
    // `linear-gradient(150deg, accent, color-mix(in srgb, accent 20%, transparent))`
    // (replay-engine app/utils/format.ts accentGradient). The generated tile is
    // the SAME tile the grid draws when an image fails to load, in the same
    // colour, rather than a third design.
    `<linearGradient id="g" x1="0" y1="0" x2="0.5" y2="0.866">` +
    `<stop offset="0" stop-color="${t.accent}" stop-opacity="1"/>` +
    `<stop offset="1" stop-color="${t.accent}" stop-opacity="0.2"/>` +
    `</linearGradient>` +
    `<clipPath id="notch"><path d="${clip}"/></clipPath>` +
    `</defs>` +
    `<g clip-path="url(#notch)">` +
    `<rect width="${W}" height="${H}" fill="${SURFACE}"/>` +
    `<rect width="${W}" height="${H}" fill="url(#g)"/>` +
    `<g transform="translate(${emX} ${emY}) scale(${(EM / 100).toFixed(4)})">` +
    emblem(t.nation, INK, 4.5) +
    `</g>` +
    `<rect x="0" y="${BAND_TOP}" width="${W}" height="${H - BAND_TOP}" fill="${INK}" ` +
    `fill-opacity="0.82"/>` +
    `<rect x="0" y="${BAND_TOP}" width="${W}" height="3" fill="${t.accent}"/>` +
    `<text x="${W / 2}" y="574" text-anchor="middle" font-family="Cinzel" font-weight="700" ` +
    `font-size="${nameSize}" fill="${CREAM}">${esc(t.name.toUpperCase())}</text>` +
    `<text x="${W / 2}" y="620" text-anchor="middle" font-family="Figtree" font-weight="700" ` +
    `font-size="${labelSize}" fill="${t.accent}">${esc(NATION_LABEL[t.nation].toUpperCase())}` +
    `</text>` +
    `<path d="${clip}" fill="none" stroke="${INK}" stroke-opacity="0.35" stroke-width="3"/>` +
    `</g></svg>`
  );
}

// ── the roster, from three sources that have to agree ───────────────────────

interface TokenRow {
  id: string;
  hex: string;
  nation: Nation;
}

/**
 * Parse design/handoff/tokens.css into (id, hex, nation).
 *
 * The section comments are load-bearing here: they are the only place the
 * vendor's nation grouping is written down for the FIVE GATED fighters, whose
 * rows are not in data/characters.json. Reading them rather than hardcoding a
 * map means a fighter moved to another family in the handoff moves on the tile
 * too — and a token outside every section is a throw rather than a tile with no
 * emblem.
 */
async function readTokens(): Promise<TokenRow[]> {
  const css = await readFile(TOKENS, 'utf8');
  const rows: TokenRow[] = [];
  let current: Nation | null = null;
  for (const line of css.split('\n')) {
    const head = /^\s*\/\*\s*([A-Za-z][A-Za-z /-]*?)\s*\*\/\s*$/.exec(line);
    if (head && SECTIONS[head[1]!]) {
      current = SECTIONS[head[1]!]!;
      continue;
    }
    const tok = /^\s*--char-([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})/.exec(line);
    if (!tok) continue;
    if (!current) {
      throw new Error(
        `design/handoff/tokens.css: --char-${tok[1]} appears before any nation section ` +
          `comment. The section headings are how the five GATED fighters get a nation at all ` +
          `(they are not in data/characters.json), so a token outside one has no grouping.`,
      );
    }
    rows.push({ id: tok[1]!, hex: tok[2]!.toUpperCase(), nation: current });
  }
  const missing = Object.values(SECTIONS).filter((n) => !rows.some((r) => r.nation === n));
  if (missing.length) {
    throw new Error(`design/handoff/tokens.css: no --char-* token under ${missing.join(', ')}`);
  }
  return rows;
}

async function buildTileList(): Promise<Tile[]> {
  const tokens = await readTokens();
  const byId = new Map(tokens.map((r) => [r.id, r]));

  const roster = JSON.parse(
    await readFile(join(DATA, 'characters.json'), 'utf8'),
  ) as CharacterRecord[];
  const gated = UNRELEASED.filter((u) => u.name !== '');

  const tiles: Tile[] = [];
  const errs: string[] = [];

  for (const c of roster) {
    const tok = byId.get(c.id);
    if (!tok) {
      errs.push(`${c.id} is on the roster and has no --char-${c.id} in tokens.css`);
      continue;
    }
    if (tok.hex !== c.accent.toUpperCase()) {
      errs.push(`${c.id}: accent ${c.accent} in characters.json, ${tok.hex} in tokens.css`);
    }
    // data/characters.json states the nation for a RELEASED fighter and
    // tokens.css groups every fighter; they are two independent transcriptions
    // of one vendor grouping, so disagreeing means one of them was edited alone.
    const stated = c.extra?.nation;
    if (stated !== undefined && stated !== tok.nation) {
      errs.push(
        `${c.id}: nation "${String(stated)}" in characters.json, "${tok.nation}" in tokens.css`,
      );
    }
    tiles.push({ id: c.id, name: c.name, nation: tok.nation, accent: tok.hex, state: 'released' });
  }

  for (const u of gated) {
    const tok = byId.get(u.id);
    if (!tok) {
      errs.push(`${u.id} is an announced fighter with no --char-${u.id} in tokens.css`);
      continue;
    }
    if (u.accent && u.accent.toUpperCase() !== tok.hex) {
      errs.push(`${u.id}: accent ${u.accent} in expiries.ts, ${tok.hex} in tokens.css`);
    }
    tiles.push({ id: u.id, name: u.name, nation: tok.nation, accent: tok.hex, state: 'announced' });
  }

  // The unnamed Year 1 vote slot must have no token and therefore no tile. If
  // one ever appears, somebody has guessed a fighter.
  for (const u of UNRELEASED) {
    if (u.name === '' && byId.has(u.id)) {
      errs.push(`${u.id} is the unnamed vote slot and has a --char-${u.id} token — it must not`);
    }
  }

  // Every token has to end up on a tile, or a colour was derived for a fighter
  // nothing draws.
  const drawn = new Set(tiles.map((t) => t.id));
  for (const r of tokens) {
    if (!drawn.has(r.id)) {
      errs.push(
        `--char-${r.id} exists in tokens.css and belongs to no fighter — it is neither on the ` +
          `roster nor in UNRELEASED`,
      );
    }
  }

  if (errs.length) {
    throw new Error(
      `the roster, the design tokens and the unreleased table disagree:\n    ${errs.join('\n    ')}`,
    );
  }
  return tiles;
}

// ── main ────────────────────────────────────────────────────────────────────

interface Written {
  id: string;
  name: string;
  nation: Nation;
  accent: string;
  state: Tile['state'];
  file: string;
  dimensions: string;
  bytes: number;
  sha256: string;
}

async function main(): Promise<void> {
  // The no-network guard, proven live before anything else runs.
  let guardFired = false;
  try {
    await fetch('https://reference.paramount.com/');
  } catch (e) {
    guardFired = e instanceof Error && e.message.startsWith(NO_NETWORK);
  }
  if (!guardFired) {
    throw new Error(
      'the no-network guard did not fire. Something restored the real `fetch`, and this file ' +
        'is one careless line away from publishing art the rights holder prohibits.',
    );
  }

  const sharp = await loadSharp();
  const proof = await assertFonts();
  const tiles = await buildTileList();
  await mkdir(OUT_DIR, { recursive: true });

  const written: Written[] = [];
  for (const t of tiles) {
    // Fitted per name, through the real renderer: "NIGHTMARE KORRA" is 15
    // glyphs and "TOPH" is 4, and one pinned size makes one of them wrong.
    const nameSize = await fit(CINZEL_BOLD, t.name.toUpperCase(), W * 0.8, 62);
    const labelSize = await fit(FIGTREE_BOLD, NATION_LABEL[t.nation].toUpperCase(), W * 0.66, 20);
    const png = await sharp(Buffer.from(tileSvg(t, nameSize, labelSize)))
      .png()
      .toBuffer();
    const meta = await sharp(png).metadata();
    if (meta.width !== W || meta.height !== H) {
      throw new Error(`${t.id}: rendered ${meta.width}×${meta.height}, expected ${W}×${H}`);
    }
    const webp = await sharp(png).webp({ quality: 88 }).toBuffer();
    const file = join(OUT_DIR, `${t.id}.webp`);
    await writeFile(file, webp);
    written.push({
      id: t.id,
      name: t.name,
      nation: t.nation,
      accent: t.accent,
      state: t.state,
      // The path as data/characters.json publishes it (scripts/characters.ts:1154).
      file: `/img/char/${t.id}.webp`,
      dimensions: `${W}×${H}`,
      bytes: webp.length,
      sha256: createHash('sha256').update(webp).digest('hex'),
    });
  }

  // ── FAIL LOUD, both directions ──────────────────────────────────────────
  const onDisk = new Set((await readdir(OUT_DIR)).filter((f) => f.endsWith('.webp')));
  const expected = new Set(tiles.map((t) => `${t.id}.webp`));
  const absent = [...expected].filter((f) => !onDisk.has(f));
  if (absent.length) {
    throw new Error(
      `${absent.length} tile(s) did not reach public/img/char: ${absent.join(', ')}. Every id ` +
        `must end with a real file — a fighter with no art is a 404 in the grid or, worse, a ` +
        `build that renders a gap that looks deliberate.`,
    );
  }
  const orphans = [...onDisk].filter((f) => !expected.has(f));
  if (orphans.length) {
    throw new Error(
      `public/img/char holds ${orphans.length} tile(s) no fighter claims: ${orphans.join(', ')}. ` +
        `That is an id that changed and a file that would ship forever. Delete them ` +
        `deliberately, then re-run.`,
    );
  }
  for (const w of written) {
    const meta = await sharp(join(OUT_DIR, `${w.id}.webp`)).metadata();
    if (meta.format !== 'webp' || meta.width !== W || meta.height !== H) {
      throw new Error(
        `${w.id}.webp read back as ${meta.format} ${meta.width}×${meta.height}, expected ` +
          `webp ${W}×${H}`,
      );
    }
  }

  // ── provenance ──────────────────────────────────────────────────────────
  // NO BUILD TIMESTAMP. Everything in this file is either a constant or derived
  // from the bytes that were written, so a re-run with no change produces a
  // byte-identical file and the commit guard has nothing to commit. `read` is
  // the day the terms were read, which is the date that actually matters here.
  const provenance = {
    method:
      'GENERATED. No vendor or wiki asset is fetched, cropped, composited or published by this ' +
      'repo; scripts/art.ts replaces global fetch with a throwing stub and proves the stub is ' +
      'live before it draws anything.',
    licence: LICENCE,
    expiry: EXPIRY,
    tiles: written.length,
    releasedTiles: written.filter((w) => w.state === 'released').length,
    announcedTiles: written.filter((w) => w.state === 'announced').length,
    files: written,
  };
  await writeFile(
    join(DATA, 'art-provenance.json'),
    `${JSON.stringify(provenance, null, 2)}\n`,
    'utf8',
  );

  const byNation = (Object.keys(NATION_LABEL) as Nation[])
    .map((n) => `${n} ${written.filter((w) => w.nation === n).length}`)
    .join(' · ');
  console.log(
    `✓ art — ${written.length} generated tile(s) → public/img/char (${W}×${H} webp)\n` +
      `  ${provenance.releasedTiles} released · ${provenance.announcedTiles} announced-but-` +
      `unreleased; by nation: ${byNation}\n` +
      `  fonts verified: ${proof}\n` +
      `  no fetch: the rights holder prohibits reuse (${LICENCE.source}, read ${LICENCE.read}); ` +
      `citation and hashes in data/art-provenance.json`,
  );

  // ── the expiry, LAST, so the tiles are on disk before this can stop the run ─
  const today = new Date().toISOString().slice(0, 10);
  if (today >= EXPIRY.date) {
    console.error(
      `\n⚠ ACTION REQUIRED — expiry due (${EXPIRY.kind}, ${EXPIRY.id}, ${EXPIRY.date})\n` +
        `  ${EXPIRY.action}\n`,
    );
    process.exit(1);
  }
}

/** The largest size at which `text` fits `maxWidth`, never above `cap`,
 *  measured through the renderer that is about to draw it. */
async function fit(
  face: (typeof FACES)[number],
  text: string,
  maxWidth: number,
  cap: number,
): Promise<number> {
  const REF = 100;
  const { width } = await inkBox(face, text, REF);
  if (width === 0) throw new Error(`fit: "${text}" drew no ink in ${face.file}`);
  return Math.max(8, Math.min(cap, Math.floor((maxWidth / width) * REF)));
}

main().catch((e: unknown) => {
  console.error(`\n✖ art.ts: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
