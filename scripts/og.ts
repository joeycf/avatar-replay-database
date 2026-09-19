/**
 * Generate public/og-default.png — the site-wide OG/Twitter card, and the
 * shell's selector card for this game (the shell byte-copies each game repo's
 * og-default.png, so this file speaks the PLATFORM's card language rather than
 * inventing one).
 *
 * ── THE CARD LANGUAGE, WHICH EVERY LIVE og.ts SHARES ──────────────────────
 *   · a cut-corner BADGE in the game's primary, carrying the platform slash
 *   · the SLASH LOCKUP — `AVATAR/REPLAY`, the slash in the game's secondary
 *   · "The competitive <full name> replay database", then the tagline
 *   · a footer STRIPE THAT IS THE ROSTER: one segment per fighter, in roster
 *     order, each in that fighter's own accent, read from data/characters.json
 *     on every run. Twelve segments today. Reading the file rather than hard-
 *     coding the count is what stops the card going stale on the next DLC —
 *     SF6's card shipped 30 segments against a roster that had grown to 31.
 *
 * The design handoff's quadrant layout is deliberately NOT used. A card that
 * sits beside five siblings in the shell's selector has to be recognisable as
 * one of them; a bespoke composition there reads as a different product.
 *
 * ── NO ART CREDIT LINE, AND THAT IS A LICENCE FINDING ─────────────────────
 * Every sibling bakes its vendor's notice into the card because the card
 * travels standalone. This one carries none, because there is nothing to
 * credit: the rights holder PROHIBITS reuse of its art outright ("STRICTLY
 * PROHIBITED WITHOUT THE PRIOR WRITTEN CONSENT", reference.paramount.com/
 * terms-of-use, read 2026-09-18), publishes no fan kit, and this card therefore
 * shows no vendor artwork at all — only type, the accents from the design
 * handoff, and geometry. app/app.config.ts sets no `artCredit` for the same
 * reason, and data/art-provenance.json (scripts/art.ts) carries the citation.
 *
 * ── CHECKLIST 5d: PROVE THE TYPEFACE ACTUALLY DREW ────────────────────────
 * "Anything that generates a branded image must prove the typeface actually
 * drew, because the failure mode is a plausible fallback rather than an error."
 *
 * THE REFERENCE'S PREMISE DOES NOT HOLD HERE, AND IT WAS RE-MEASURED RATHER
 * THAN INHERITED. ggst/scripts/og.ts:9-18 states that in its prebuilt sharp
 * `font-family="Anton"`, `"DejaVu Sans"` and `"__nope__"` render BYTE-IDENTICAL
 * output — "the bundled librsvg/pango resolves no named family at all" — which
 * is why that file converts every string to outlines with opentype.js. Measured
 * in this repo on sharp 0.35.4 with FONTCONFIG_FILE pointed at
 * design/fonts/fonts.conf (2026-09-18), the opposite is true: the four
 * committed TTFs resolve, and all four produce DISTINCT rasters of the same
 * string. So this file sets type as <text> and keeps the proof, instead of
 * carrying a glyph-outline pipeline (and a fifth dependency) for a problem this
 * repo does not have.
 *
 * The proof has two arms, because neither alone is sufficient:
 *
 *  1. FILE IDENTITY — sha256 of each TTF against a pin measured on these exact
 *     files. A zero-filled, truncated, swapped or re-subset face fails here
 *     before anything is drawn, with the file named.
 *  2. THE RENDERER USED IT — each probe string is drawn in all four faces and
 *     the four rasters must be pairwise DISTINCT.
 *
 * Arm 2 is pairwise rather than "versus a family that cannot exist", and that
 * is forced by what fonts.conf does: it makes design/fonts the ONLY font
 * directory, so an unresolvable family falls back to one of OUR faces (measured:
 * `__nope__` renders byte-identical to Figtree 400). The tokon/2XKO probe shape
 * — `ctx.font = '... Bangers, __no_such_family__'` against the bare impossible
 * family, tokon/scripts/og.ts:159-171 — is correct in a browser, where the
 * fallback is a system font, and would report a permanent green here. Pairwise
 * distinctness catches the real failure anyway: lose Figtree-Regular and
 * fontconfig resolves "Figtree 400" to Figtree-Bold, making two of the four
 * rasters equal.
 *
 * TWO PROBE STRINGS, AND THE LATIN ONE HAS LOWERCASE. design/fonts/fonts.conf
 * names both. Cinzel's lowercase is SMALL CAPS, not absent (its own comment
 * measures k/K at 601/700), so a probe of capitals alone would draw identically
 * in Cinzel and in a fallback serif and prove nothing about which face loaded.
 * The latin-ext witness is `ō` (U+014D) — no fighter name on this roster carries
 * punctuation or an accent, so the characters that need proving are the card's
 * own furniture.
 *
 * Run: npm run data:og   (manual — the card changes when the brand or the
 *                         roster does; never in the cron)
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { CharacterRecord } from '../types/index';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const FONT_DIR = join(ROOT, 'design', 'fonts');

// BEFORE sharp's native binding initialises fontconfig. A static `import sharp`
// is hoisted above every statement in the module, which is how CotW's first
// version pointed FONTCONFIG_FILE at a config sharp had already stopped reading
// — so every consumer gets sharp through `loadSharp()` below, never through a
// top-level import. This assignment runs on IMPORT, which is also what makes it
// correct for scripts/art.ts: that file imports this one and therefore inherits
// the environment before it asks for sharp.
process.env.FONTCONFIG_FILE = join(FONT_DIR, 'fonts.conf');

export const loadSharp = async (): Promise<typeof import('sharp').default> =>
  (await import('sharp')).default;

// ── the font gate (checklist 5d) ────────────────────────────────────────────

/**
 * One usable cut. `family` and `weight` are what an SVG asks for; `file` is what
 * fontconfig must answer with.
 *
 * All four are load-bearing across the two generators — this card sets the
 * wordmark in Cinzel 900 and its prose in Figtree 400, and scripts/art.ts sets
 * every fighter name in Cinzel 700 and every nation label in Figtree 700 — so
 * the gate below proves all four rather than only the ones one script happens
 * to draw.
 */
export interface Face {
  family: string;
  weight: number;
  file: string;
  /** sha256 of the committed file, measured in-session 2026-09-18. */
  sha256: string;
}

export const FACES: Face[] = [
  {
    family: 'Cinzel',
    weight: 700,
    file: 'Cinzel-Bold.ttf',
    sha256: '0c23ec565db45c5508ee95889c60ad87debd167ca07167a43a5d68572b4e2eac',
  },
  {
    family: 'Cinzel',
    weight: 900,
    file: 'Cinzel-Black.ttf',
    sha256: 'a763aaf53985919a96894263e93b0eb7ad9f0b1a7536a15aec2bddbe8c0acf82',
  },
  {
    family: 'Figtree',
    weight: 400,
    file: 'Figtree-Regular.ttf',
    sha256: '448d74e778cc9774db27bd86cf451bba982b2e4dc348f610390eb6e3439cf6ca',
  },
  {
    family: 'Figtree',
    weight: 700,
    file: 'Figtree-Bold.ttf',
    sha256: '71a35e2bd92a05427e2dc9897bab41f8a865800e148238007735b5934508198a',
  },
];

/** The two probe strings design/fonts/fonts.conf names, verbatim. The latin one
 *  carries lowercase on purpose (Cinzel's lowercase is small caps), plus the
 *  digits and the middot the card's own furniture uses. */
export const PROBE_LATIN = 'AVATAR/REPLAY Toph Kyoshi Ozai Avatar Aang 0123456789 3-2 ·';
export const PROBE_LATIN_EXT = 'ō';

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** A single line of type on a white field, big enough for any probe. */
const probeSvg = (face: Face, text: string, size: number): Buffer =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="4000" height="400">` +
      `<rect width="100%" height="100%" fill="#FFFFFF"/>` +
      `<text x="20" y="260" font-family="${face.family}" font-weight="${face.weight}" ` +
      `font-size="${size}" fill="#000000">${esc(text)}</text></svg>`,
  );

/**
 * Ink extent of `text` in `face` at `size`, in px. Used both by the gate (ink of
 * zero means the string drew nothing) and by the layout below, which FITS sizes
 * to the column instead of pinning them — the game's full name is 37 characters
 * and a hardcoded size would have to be re-guessed for the next consumer.
 */
export async function inkBox(
  face: Face,
  text: string,
  size: number,
): Promise<{ width: number; height: number }> {
  const sharp = await loadSharp();
  const png = await sharp(probeSvg(face, text, size))
    .png()
    .toBuffer();
  try {
    const { info } = await sharp(png).trim({ threshold: 10 }).toBuffer({ resolveWithObject: true });
    return { width: info.width, height: info.height };
  } catch {
    // sharp refuses to trim an image that is entirely one colour, which is
    // exactly the "nothing drew" case.
    return { width: 0, height: 0 };
  }
}

/**
 * THE GATE. Throws with the offending file named; returns the rasters' hashes so
 * the caller can print what it proved.
 *
 * Both arms run for BOTH probe strings, so a face that lost its latin-ext
 * coverage fails even though its latin run is perfect — the per-subset rule
 * checklist 5d asks for.
 */
export async function assertFonts(): Promise<string> {
  const sharp = await loadSharp();

  // ── arm 1: file identity ────────────────────────────────────────────────
  const wrong: string[] = [];
  for (const f of FACES) {
    const got = createHash('sha256')
      .update(readFileSync(join(FONT_DIR, f.file)))
      .digest('hex');
    if (got !== f.sha256)
      wrong.push(`${f.file}: ${got.slice(0, 16)}… (expected ${f.sha256.slice(0, 16)}…)`);
  }
  if (wrong.length) {
    throw new Error(
      `design/fonts/ does not hold the faces this card was designed on:\n    ${wrong.join('\n    ')}\n` +
        `  The TTFs are committed precisely so the render cannot depend on the host — a swapped, ` +
        `truncated or zero-filled file would otherwise ship a plausible substitute with no error. ` +
        `If a font was deliberately updated, re-measure the pin in scripts/og.ts FACES and say ` +
        `where the file came from.`,
    );
  }

  // ── arm 2: the renderer used it ─────────────────────────────────────────
  const seen = new Map<string, string>();
  const blank: string[] = [];
  for (const probe of [PROBE_LATIN, PROBE_LATIN_EXT]) {
    const label = probe === PROBE_LATIN ? 'latin' : 'latin-ext';
    for (const f of FACES) {
      const png = await sharp(probeSvg(f, probe, 96))
        .png()
        .toBuffer();
      const box = await inkBox(f, probe, 96);
      if (box.width === 0) blank.push(`${f.file} drew nothing for the ${label} probe`);
      const key = `${label}:${createHash('sha256').update(png).digest('hex')}`;
      const already = seen.get(key);
      if (already) {
        throw new Error(
          `${f.family} ${f.weight} and ${already} render the ${label} probe IDENTICALLY.\n` +
            `  One of the two faces is not being resolved, and fontconfig answered with the ` +
            `other — design/fonts/fonts.conf makes that directory the only font source, so a ` +
            `missing cut falls back inside the family and the card ships in the wrong weight ` +
            `with no error (checklist 5d).`,
        );
      }
      seen.set(key, `${f.family} ${f.weight}`);
    }
  }
  if (blank.length) {
    throw new Error(`no ink from a committed face:\n    ${blank.join('\n    ')}`);
  }
  return `${FACES.length} face(s) × 2 probe(s) → ${seen.size} distinct raster(s)`;
}

// ── the card ────────────────────────────────────────────────────────────────

const W = 1200;
const H = 630;

/** design/handoff/tokens.css — the same block app/assets/theme.css transcribes. */
const BG = '#141210';
const SURFACE = '#1D1A16';
const PRIMARY = '#4EC0ED';
const PRIMARY_CONTRAST = '#12100D';
const SECONDARY = '#FCA942';
const TEXT = '#F2EADD';
const TEXT_MUTED = '#B8B0A3';
const TEXT_FAINT = '#8D8579';

/** app/app.config.ts `shortName`. Pure ASCII, so the wordmark needs no
 *  latin-ext coverage — the latin-ext probe is still asserted, because the
 *  faces are shared with scripts/art.ts and with whatever draws next. */
const SHORT_NAME = 'AVATAR';
const FULL_NAME = 'Avatar Legends: The Fighting Game';
const LINE_1 = `The competitive ${FULL_NAME} replay database`;

/**
 * The tagline, and the one string on this card that is game-specific rather
 * than platform-shaped. The siblings say "Character usage · matchups · meta
 * over time"; this game's second pick per side is a SUPPORT rather than a
 * second character (checklist 13), and the card is where a viewer first learns
 * that this archive knows about them.
 *
 * Exported because the shell's selector reuses a game's tagline verbatim
 * (the tokon precedent, tokon/scripts/og.ts:51) — one place to copy from beats
 * two spellings of one sentence.
 */
export const TAGLINE = 'Fighter and support usage · matchups · meta over time';

const CINZEL_BLACK = FACES.find((f) => f.family === 'Cinzel' && f.weight === 900)!;
const FIGTREE = FACES.find((f) => f.family === 'Figtree' && f.weight === 400)!;

/** The largest size at which `text` fits `maxWidth`, never above `cap`. Measured
 *  through the real renderer rather than through a font-metrics library, so what
 *  is fitted is what is drawn. */
async function fitSize(face: Face, text: string, maxWidth: number, cap: number): Promise<number> {
  const REF = 100;
  const { width } = await inkBox(face, text, REF);
  if (width === 0) throw new Error(`fitSize: "${text}" drew no ink in ${face.file}`);
  return Math.max(8, Math.min(cap, Math.floor((maxWidth / width) * REF)));
}

async function main(): Promise<void> {
  const sharp = await loadSharp();
  const proof = await assertFonts();

  const roster = JSON.parse(
    await readFile(join(ROOT, 'data', 'characters.json'), 'utf8'),
  ) as CharacterRecord[];
  if (roster.length === 0) {
    throw new Error('data/characters.json is empty — the roster stripe would be blank.');
  }
  // An invalid fill is dropped by librsvg without a word, and a stripe with one
  // segment missing looks like a fighter was removed from the roster.
  const badAccent = roster.filter((c) => !/^#[0-9A-Fa-f]{6}$/.test(c.accent));
  if (badAccent.length) {
    throw new Error(
      `${badAccent.length} fighter(s) carry a non-hex accent: ` +
        badAccent.map((c) => `${c.id}=${JSON.stringify(c.accent)}`).join(', '),
    );
  }

  const STRIPE = 16;
  const seg = W / roster.length;
  const stripe = roster
    // +0.5px of overlap so neighbouring segments never leave a hairline gap at
    // fractional widths (1200/12 = 100 exactly today, and will not be exact the
    // day a thirteenth fighter ships). Written as (seg + 0.5).toFixed(2), never
    // seg.toFixed(2) + 0.5 — that is string concatenation, it emits
    // width="100.000.5", and librsvg drops the whole stripe. CotW shipped it
    // invisible exactly once.
    .map(
      (c, i) =>
        `<rect x="${(i * seg).toFixed(2)}" y="${H - STRIPE}" width="${(seg + 0.5).toFixed(2)}" ` +
        `height="${STRIPE}" fill="${c.accent}"/>`,
    )
    .join('');

  const BADGE = 116;
  const BX = 70;
  // The siblings sit the lockup at y=168 and fill the bottom third with the
  // vendor's copyright notice. This card owes no notice (see the header), so the
  // whole block drops to keep the composition optically centred above the
  // stripe instead of leaving a third of the card empty: content runs 196→436,
  // centre ≈316 against the 307 midline of the canvas above the stripe.
  const BY = 196;
  const L1_BASELINE = 380;
  const L2_BASELINE = 436;
  const wordLeft = BX + BADGE + 34;
  const RIGHT_MARGIN = BX;

  // FITTED, NOT PINNED. Cinzel is a wide display serif and the lockup is 13
  // glyphs; the cap keeps a short mark from ballooning if `shortName` ever gets
  // shorter.
  const wordmark = `${SHORT_NAME}/REPLAY`;
  const wordSize = await fitSize(CINZEL_BLACK, wordmark, W - wordLeft - RIGHT_MARGIN, 104);
  const l1Size = await fitSize(FIGTREE, LINE_1, W - BX - RIGHT_MARGIN - 6, 34);
  const l2Size = await fitSize(FIGTREE, TAGLINE, W - BX - RIGHT_MARGIN - 6, 26);

  // The slash lives inside the wordmark's own <text> as a <tspan>, so librsvg
  // lays out all three runs with the face's own advances and kern pairs. Placing
  // them as three separate <text> elements would need an advance-width measure
  // per run, and an ink measure is not an advance — the gap after the final Y
  // would be wrong by its right side bearing.
  const wordBaseline = BY + BADGE / 2 + wordSize * 0.36;

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
    `<defs>` +
    `<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0%" stop-color="${SURFACE}"/><stop offset="100%" stop-color="${BG}"/>` +
    `</linearGradient>` +
    `<radialGradient id="wash" cx="78%" cy="18%" r="62%">` +
    `<stop offset="0%" stop-color="${PRIMARY}" stop-opacity="0.20"/>` +
    `<stop offset="100%" stop-color="${PRIMARY}" stop-opacity="0"/>` +
    `</radialGradient>` +
    `<radialGradient id="ember" cx="12%" cy="94%" r="52%">` +
    `<stop offset="0%" stop-color="${SECONDARY}" stop-opacity="0.14"/>` +
    `<stop offset="100%" stop-color="${SECONDARY}" stop-opacity="0"/>` +
    `</radialGradient>` +
    `<pattern id="diag" width="14" height="14" patternUnits="userSpaceOnUse" ` +
    `patternTransform="rotate(35)">` +
    `<rect width="14" height="14" fill="none"/>` +
    `<rect width="5" height="14" fill="#FFFFFF" fill-opacity="0.018"/>` +
    `</pattern>` +
    `</defs>` +
    `<rect width="100%" height="100%" fill="url(#bg)"/>` +
    `<rect width="100%" height="100%" fill="url(#diag)"/>` +
    `<rect width="100%" height="100%" fill="url(#wash)"/>` +
    `<rect width="100%" height="100%" fill="url(#ember)"/>` +
    // the platform badge: a cut-corner square in the game's primary, carrying
    // the same slash the wordmark uses
    `<path d="M${BX} ${BY} H${BX + BADGE - 26} L${BX + BADGE} ${BY + 26} V${BY + BADGE} ` +
    `H${BX} Z" fill="${PRIMARY}"/>` +
    `<path d="M${BX + BADGE * 0.62} ${BY + BADGE * 0.2} L${BX + BADGE * 0.34} ${BY + BADGE * 0.8} ` +
    `l14 0 L${BX + BADGE * 0.62 + 14} ${BY + BADGE * 0.2} Z" fill="${PRIMARY_CONTRAST}"/>` +
    `<text x="${wordLeft}" y="${wordBaseline.toFixed(2)}" font-family="Cinzel" ` +
    `font-weight="900" font-size="${wordSize}" fill="${TEXT}">${esc(SHORT_NAME)}` +
    `<tspan fill="${SECONDARY}">/</tspan>REPLAY</text>` +
    `<text x="${BX + 6}" y="${L1_BASELINE}" font-family="Figtree" font-weight="400" ` +
    `font-size="${l1Size}" ` +
    `fill="${TEXT_MUTED}">${esc(LINE_1)}</text>` +
    `<text x="${BX + 6}" y="${L2_BASELINE}" font-family="Figtree" font-weight="400" ` +
    `font-size="${l2Size}" ` +
    `fill="${TEXT_FAINT}">${esc(TAGLINE)}</text>` +
    stripe +
    `</svg>`;

  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const meta = await sharp(png).metadata();
  if (meta.width !== W || meta.height !== H) {
    throw new Error(`rendered ${meta.width}×${meta.height}, expected ${W}×${H}`);
  }
  const out = join(ROOT, 'public', 'og-default.png');
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, png);

  console.log(
    `✓ public/og-default.png — ${W}×${H}, wordmark ${wordSize}px, ` +
      `${roster.length}-segment roster stripe, no art credit (the vendor prohibits reuse and ` +
      `this card shows no vendor art)\n  fonts verified: ${proof}`,
  );
}

// isMain, so scripts/art.ts can import the font gate above without rendering a
// card as a side effect — the same guard scripts/patches.ts:689 and
// scripts/fetch.ts use for the same reason.
const isMain = !!process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  main().catch((e: unknown) => {
    console.error(`\n✖ og.ts: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  });
}
