/**
 * THE POSITIVE-CONTROL SUITE — checklist step 10.
 *
 * "Inject the failure each gate exists to catch and confirm it exits non-zero,
 * then confirm the clean run exits 0. A gate that cannot fail is
 * indistinguishable from a gate that passes, and you will trust it."
 *
 * Every control below injects a REAL defect into a REAL file, runs a REAL
 * command, and requires a non-zero exit that NAMES the rule it tripped.
 *
 * ── WHAT THIS PORT FIXES IN THE REFERENCE HARNESS ─────────────────────────
 * Ported from ggst-replay-database/scripts/verify-gates.ts, which itself fixed
 * four weaknesses in CotW's. Two of those fixes are carried here verbatim
 * because they are the two that matter, and both are re-stated rather than
 * assumed:
 *
 * 1. `r.status !== 0` COUNTED `null` AS A PASS. spawnSync returns status null
 *    when the child is killed by a signal or never spawns (missing npx, OOM),
 *    so a control that never ran reported PASS — the one outcome a positive
 *    control exists to make impossible. `verdict()` below requires an actual
 *    non-zero NUMBER, uses `=== 0` for the failure case, and names the signal
 *    when there is none.
 *
 * 2. A CONTROL MUST NAME THE RULE IT TRIPS. An exit-code-only assertion lets a
 *    control trip a NEIGHBOURING gate and still report PASS, which is not
 *    theoretical: on this repo today every control that drives `scripts/parse.ts`
 *    dies in the FREEZE-PIN gate — drewShoto ships `frozen.records: -1` and the
 *    pin has not been seeded — long before it reaches the rule it was aimed at.
 *    Under `status !== 0` all seven would print PASS. They are SKIPPED instead,
 *    and the skip names the blocker.
 *
 * ── AND WHAT IT ADDS: A SKIPPED CONTROL STILL AUDITS ITS ANCHOR ───────────
 * The reference treats a control whose precondition is absent as a soft skip and
 * proves nothing at all about it — so an injection anchor can rot for months
 * while the control looks merely "waiting". Here, a control that cannot RUN is
 * still INJECTED and immediately restored, and a missing anchor is a FAILURE
 * rather than a skip. So every control in this file is proven to still be able
 * to place its defect, today, whether or not its command can execute — and the
 * day the precondition lands it becomes a full control without being touched.
 *
 * ── THE PROBE, AND WHY MOST OF THIS GAME'S OWN RULES ARE LIVE ─────────────
 * scripts/parse.ts exports `parseTitle`, `parseSide`, `channelMatcher`,
 * `handleRewrites`, `isPlaceholderHandle`; scripts/roster.ts exports `playerId`
 * and the matcher builders; scripts/parse-finish.ts exports
 * `buildTheaterRecords`. That export surface exists so the orientation and index
 * logic can be exercised WITHOUT running the pipeline, and this file is its
 * consumer: eight controls drive a small probe module against those functions
 * with hand-built inputs. They are offline, they need no corpus, they need no
 * API key, and they are the controls for the four rules that are this game's
 * reason for existing — the pair-level slot order (5q), the CPU/arcade refusal
 * (5r), the support namespace (13) and the index offset/tag edges (12k).
 *
 * THE PROBE IS WRITTEN OUTSIDE THE REPOSITORY, into an OS temp directory that is
 * removed on exit. Nothing is created under the project, so a suite that is
 * killed mid-run cannot leave a stray `.ts` file for `tsc`, `eslint` or a commit
 * to pick up.
 *
 * ── NO CONTROL IN THIS FILE TOUCHES THE YOUTUBE API ───────────────────────
 * Deliberate, and it is checklist 10j rather than caution. The key is SHARED
 * with six production crons; a recon pass on this game exhausted the whole
 * daily quota once already. The reference spends a videos.list batch per theater
 * control — four of them — which is a cost this platform cannot carry on a
 * suite people are meant to run often. The index rules that CAN be exercised
 * offline are exercised offline, through `buildTheaterRecords`; the one that
 * genuinely cannot is named as a skip rather than quietly dropped.
 *
 * ── 10c: THIS SUITE MUST NOT REPAIR THE CONDITION IT TESTS ────────────────
 * A suite that snapshots data and restores it in a `finally` also refreshes
 * MTIMES, so a guard keyed on mtime can never fire again after the first run.
 * That trap cannot be sprung here, and it is worth saying why rather than
 * relying on luck: this repo's stale-raw guard reads ONLY DATA — the newest
 * publishedAt in the dump against the newest committed record for that intake
 * (scripts/parse.ts assertRawIsFresh). It consults no filesystem metadata, so
 * `cp`, `git checkout`, a fresh clone and this suite's own restore are invisible
 * to it. The suite still restores byte-exactly and asserts a clean run
 * afterwards, so a control that corrupted state shows up immediately.
 *
 * Run: npm run verify:gates
 *      npm run verify:gates -- --only=<substring>
 *      npm run verify:gates -- --list        (what is live and what is waiting)
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const only = process.argv.find((a) => a.startsWith('--only='))?.slice('--only='.length);
const LIST_ONLY = process.argv.includes('--list');

// ── file helpers ────────────────────────────────────────────────────────────

const read = (p: string): string => readFileSync(join(ROOT, p), 'utf8');
const write = (p: string, s: string): void => writeFileSync(join(ROOT, p), s);
const readJson = <T>(p: string): T => JSON.parse(read(p)) as T;

/**
 * Replace exactly once, asserting the anchor still exists AND IS UNIQUE.
 *
 * Uniqueness is the half the reference leaves out, and it is not pedantry: two
 * of the anchors below are one line of a repeated shape, and a `String.replace`
 * that silently took the FIRST of two occurrences would inject the defect
 * somewhere other than where the control claims to have put it. Returning false
 * is a FAILURE below, never a skip.
 */
const sub = (p: string, from: string, to: string): boolean => {
  const s = read(p);
  const n = s.split(from).length - 1;
  if (n !== 1) return false;
  write(p, s.replace(from, to));
  return true;
};

// ── the runner ──────────────────────────────────────────────────────────────

interface Run {
  /** null when the child was signalled or never spawned — see verdict(). */
  status: number | null;
  signal: NodeJS.Signals | null;
  /** stdout and stderr concatenated: a gate may name its rule on either. */
  out: string;
  error?: Error;
}

const run = (cmd: string[], env: NodeJS.ProcessEnv = {}): Run => {
  const r = spawnSync('npx', cmd, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, ...env },
  });
  return {
    status: r.status,
    signal: r.signal,
    out: `${r.stdout ?? ''}\n${r.stderr ?? ''}`,
    ...(r.error ? { error: r.error } : {}),
  };
};

// ── verdicts ────────────────────────────────────────────────────────────────

type Verdict =
  | { kind: 'pass'; detail?: string }
  | { kind: 'fail'; detail: string }
  | { kind: 'skip'; detail: string };

const pass = (detail?: string): Verdict => ({ kind: 'pass', ...(detail ? { detail } : {}) });
const fail = (detail: string): Verdict => ({ kind: 'fail', detail });
const skip = (detail: string): Verdict => ({ kind: 'skip', detail });

const head = (r: Run, n = 4): string =>
  r.out
    .split('\n')
    .filter((l) => l.trim())
    .slice(0, n)
    .join(' / ')
    .slice(0, 300);

/**
 * The default assertion: the run must exit with a REAL non-zero number AND name
 * the rule it was supposed to trip.
 *
 * `status === null` is the fix for the first ported weakness. A signalled or
 * unspawnable child reports `status: null`, `null !== 0` is true, and the
 * control that never ran printed PASS.
 */
const verdict = (r: Run, names: RegExp): Verdict => {
  if (r.error) return fail(`the command never ran: ${r.error.message}`);
  if (r.status === null) {
    return fail(
      `no exit status — the child was killed by ${r.signal ?? 'an unknown signal'}. ` +
        '`status !== 0` would have called this a PASS.',
    );
  }
  if (r.status === 0) return fail('exited 0 with the defect present');
  if (!names.test(r.out)) {
    return fail(
      `exited ${r.status}, but on a DIFFERENT rule — nothing in the output matches ${names}. ` +
        `A control that trips the wrong gate proves nothing. Got: ${head(r)}`,
    );
  }
  return pass(`exit ${r.status}`);
};

// ── the probe module ────────────────────────────────────────────────────────
//
// Written once into an OS temp directory and removed on exit. `.mts` rather than
// `.ts` because the temp directory has no package.json, so tsx would otherwise
// transpile it as CommonJS and refuse its top-level await.
//
// It imports the pipeline's exported functions by ABSOLUTE FILE URL, which is
// what lets it live outside the project while still exercising the real code
// under injection.

const PROBE_CASES = [
  'pair-level',
  'cpu-arcade',
  'identity',
  'placeholder-symbol',
  'index-format-tag',
  'index-intro-skip',
  'index-zero-offset',
  'index-support-namespace',
] as const;

let probeDir: string | null = null;

function probePath(): string {
  if (probeDir === null) {
    probeDir = mkdtempSync(join(tmpdir(), 'avatar-verify-gates-'));
    writeFileSync(join(probeDir, 'probe.mts'), probeSource(), 'utf8');
  }
  return join(probeDir, 'probe.mts');
}

function probeSource(): string {
  const u = (f: string): string => pathToFileURL(join(ROOT, f)).href;
  return `/* Written by scripts/verify-gates.ts into a temp dir; removed on exit. */
import { CHANNEL_BY_ID } from '${u('scripts/channels.ts')}';
import { LAUNCH, patchWindows } from '${u('scripts/patches.ts')}';
import {
  buildAliasMatcher,
  buildSupportIndex,
  loadCharacters,
  loadSupports,
  playerId,
} from '${u('scripts/roster.ts')}';
import {
  channelMatcher,
  handleRewrites,
  isPlaceholderHandle,
  parseTitle,
} from '${u('scripts/parse.ts')}';
import { buildTheaterRecords } from '${u('scripts/parse-finish.ts')}';
import type { MatchVideo } from '${u('types/index.ts')}';

const which = process.argv[2] ?? '';
const fails: string[] = [];
const need = (rule: string, ok: boolean, got: string): void => {
  if (!ok) fails.push(\`✖ \${rule} — got \${got}\`);
};

const characters = await loadCharacters();
const supports = await loadSupports();

// ── the title parser, on the two grammars that are this game's own ──────────
if (which === 'pair-level' || which === 'cpu-arcade') {
  const ch = CHANNEL_BY_ID.get('aegisEsports')!;
  const rw = handleRewrites(ch);
  const ctx = {
    matcher: channelMatcher(ch, characters, supports),
    declared: ch.slotOrder,
    ...(rw ? { handleRewrites: rw } : {}),
    channel: ch,
  };
  const reading = (o: ReturnType<typeof parseTitle>): string =>
    o.ok ? o.ok.map((s) => \`\${s.handle}=\${s.characters.join('+')}\`).join(' vs ') : \`miss:\${o.miss}\`;
  if (which === 'pair-level') {
    const out = parseTitle(
      'Avatar Legends The Fighting Game Toph vs Azula (Plisno vs T0ni) Avatar Legends Replay!',
      ctx,
    );
    need('PAIR-LEVEL SLOT ORDER (checklist 5q)', reading(out) === 'Plisno=toph vs T0ni=azula', reading(out));
  } else {
    const out = parseTitle('Avatar Legends: The Fighting Game - Katara vs. Zaheer', ctx);
    need('CPU/ARCADE REFUSAL (checklist 5r)', out.miss === 'matchup-only', reading(out));
  }
}

// ── identity, which is what normalisation is FOR ────────────────────────────
if (which === 'identity') {
  const joined: [string, string][] = [
    ['ArinKarin', 'the baseline'],
    ['Arin\\u200BKarin', 'U+200B ZERO WIDTH SPACE'],
    ['Arin\\u2060Karin', 'U+2060 WORD JOINER'],
    ['Arin\\uFEFFKarin', 'U+FEFF ZERO WIDTH NO-BREAK SPACE'],
  ];
  const a = joined.map(([s]) => playerId(s));
  need(
    'NORMALISATION IS IDENTITY — the zero-width class (checklist 5l)',
    new Set(a).size === 1 && a[0] === 'arinkarin',
    joined.map(([, why], i) => \`\${why} → \${a[i]}\`).join(' · '),
  );
  const spaced: [string, string][] = [
    ['Arin Karin', 'ASCII space'],
    ['Arin\\u00A0Karin', 'U+00A0 NO-BREAK SPACE'],
    ['Arin\\u3000Karin', 'U+3000 IDEOGRAPHIC SPACE'],
    ['\\uFF21rin Karin', 'FULLWIDTH LATIN A'],
  ];
  const b = spaced.map(([s]) => playerId(s));
  need(
    'NORMALISATION IS IDENTITY — the space class (checklist 5l)',
    new Set(b).size === 1 && b[0] === 'arin-karin',
    spaced.map(([, why], i) => \`\${why} → \${b[i]}\`).join(' · '),
  );
}

// ── the symbol handle, which the shared predicate would delete ──────────────
if (which === 'placeholder-symbol') {
  need(
    "THE SYMBOL HANDLE (checklist 12k) — '\\u2671' is a real player",
    isPlaceholderHandle('\\u2671') === false,
    \`isPlaceholderHandle('\\u2671') = \${isPlaceholderHandle('\\u2671')}\`,
  );
  const leaked = ['Player', 'Unknown Player', 'N/A', 'TBD', 'GG Player'].filter(
    (h) => !isPlaceholderHandle(h),
  );
  need(
    'and it still refuses the real placeholders',
    leaked.length === 0,
    \`admitted \${leaked.join(', ') || 'none'}\`,
  );
}

// ── the index reader, on a three-row hand-built dump ────────────────────────
if (which.startsWith('index-')) {
  const index = CHANNEL_BY_ID.get('replayTheater')!.index!;
  const base = { publishedAt: '2026-09-10T12:00:00Z', liveBroadcastContent: 'none' as const };
  const dump = [
    {
      ...base,
      id: 'AAAAAAAAAAA',
      theaterId: 1,
      videoId: 'AAAAAAAAAAA',
      title: 'one row, a 30s intro skip on a 600s upload, tagged FT10',
      durationSec: 600,
      startSeconds: 30,
      tag: 'FT10',
      uploader: 'Some Uploader',
      players: ['Alpha', 'Beta'],
      characters: ['Toph', 'Zuko'],
      supports: ['Badgermole', 'Mai'],
    },
    {
      ...base,
      id: 'BBBBBBBBBBB@0',
      theaterId: 2,
      videoId: 'BBBBBBBBBBB',
      title: 'a multi-row VOD whose FIRST row opens at t=0',
      durationSec: 5000,
      startSeconds: 0,
      tag: 'Some Major 2026',
      uploader: 'Org',
      players: ['Gamma', 'Delta'],
      characters: ['Avatar Aang', 'Azula'],
      supports: ['Katara', 'Ursa'],
    },
    {
      ...base,
      id: 'BBBBBBBBBBB@1200',
      theaterId: 3,
      videoId: 'BBBBBBBBBBB',
      title: 'the same VOD, second row',
      durationSec: 5000,
      startSeconds: 1200,
      tag: 'Some Major 2026',
      uploader: 'Org',
      players: ['Eps', 'Zeta'],
      characters: ['Korra', 'Sokka'],
      supports: ['Naga', 'Suki'],
    },
  ];
  const out = buildTheaterRecords(dump as never, {
    records: [],
    committed: [],
    overrides: {},
    rawSeen: new Map(),
    matcher: buildAliasMatcher(characters, supports),
    supportIndex: buildSupportIndex(supports),
    index,
    floor: LAUNCH,
    floorSec: 120,
    windows: patchWindows(),
  });
  const by = new Map(out.built.map((r) => [r.id, r]));
  const ids = out.built.map((r) => r.id).join(', ');
  const show = (r: MatchVideo | undefined): string =>
    r === undefined
      ? 'absent'
      : \`event=\${r.event ?? '-'} channelName=\${r.channelName ?? '-'} start=\${r.startSeconds ?? '-'} \` +
        \`chars=\${r.sides.map((s) => s.characters.join('+')).join('/')} sup=\${(r.supports ?? []).join('/')}\`;

  if (which === 'index-format-tag') {
    const r = by.get('AAAAAAAAAAA');
    need(
      'A SET FORMAT IS NEVER AN EVENT (checklist 12k)',
      !!r && r.event === undefined && r.channelName === 'Some Uploader',
      show(r),
    );
  }
  if (which === 'index-intro-skip') {
    need(
      'AN INTRO-SKIP OFFSET IS NOT A SEGMENT (checklist 12k)',
      by.has('AAAAAAAAAAA') && by.get('AAAAAAAAAAA')!.startSeconds === undefined,
      \`ids: \${ids}\`,
    );
  }
  if (which === 'index-zero-offset') {
    const r = by.get('BBBBBBBBBBB@0');
    need(
      'A t=0 ROW INSIDE A MULTI-ROW VIDEO IS A SEGMENT (checklist 12k)',
      !!r && r.startSeconds === 0 && r.videoId === 'BBBBBBBBBBB',
      \`ids: \${ids}\`,
    );
  }
  if (which === 'index-support-namespace') {
    const r = by.get('BBBBBBBBBBB@0');
    const supportIds = new Set(supports.map((s) => s.id));
    // 'katara' is a fighter id AND a support id, so a blanket "no support id in
    // characters" test would fire on the fighter. The overlap is excluded by
    // name and the row that carries it is asserted field by field instead.
    const fighterIds = new Set(characters.map((c) => c.id));
    const strays = out.built.flatMap((x) =>
      x.sides.flatMap((s) => s.characters.filter((c) => supportIds.has(c) && !fighterIds.has(c))),
    );
    need(
      'A SUPPORT NEVER REACHES Side.characters (checklist 13)',
      !!r &&
        r.sides[0]!.characters.join('+') === 'avatar-aang' &&
        r.supports?.[0] === 'katara' &&
        strays.length === 0,
      show(r),
    );
  }
}

if (!which) {
  console.error('probe: no case named');
  process.exit(2);
}
if (fails.length) {
  for (const f of fails) console.error(f);
  process.exit(1);
}
console.log(\`probe \${which}: clean\`);
`;
}

// ── preconditions ───────────────────────────────────────────────────────────
//
// A skip is legal ONLY for a genuinely absent precondition, it must NAME which
// one, and it is counted and reprinted at the end. Everything else — an anchor
// that no longer matches, a run that tripped a DIFFERENT gate — is a FAILURE.

/** A script that has not been written yet. This repo ships in waves. */
const needScript = (p: string): string | null =>
  existsSync(join(ROOT, p)) ? null : `${p} has not shipped yet`;

/** A committed corpus. Absent until the first successful parse. */
const needCorpus = (): string | null => {
  if (!existsSync(join(ROOT, 'data/videos.json'))) {
    return 'data/videos.json does not exist — no parse has completed yet';
  }
  return readJson<unknown[]>('data/videos.json').length > 0
    ? null
    : 'data/videos.json is empty — there is no record to break';
};

/** A raw dump for a named channel. `raw/` is gitignored, so a fresh checkout
 *  has none and the daily cron fetches them every morning. */
const needRaw = (name: string): string | null =>
  existsSync(join(ROOT, `raw/${name}.json`))
    ? null
    : `raw/${name}.json — run \`npm run data:fetch\``;

/**
 * A clean `scripts/parse.ts` run, MEASURED ONCE and cached.
 *
 * Every control that drives the parse needs this, and not as a formality: while
 * the parse refuses for ANY reason, an injected defect cannot reach its own
 * gate, and the control would be asserting a non-zero exit it was going to get
 * anyway. Today the refusal is the freeze pin, which the parse track shipped
 * unseeded on purpose (scripts/parse-finish.ts: drewShoto `frozen.records: -1`,
 * "a sentinel no carried count can ever equal"). The blocker is quoted into
 * every skip so it is one line to read and one ritual to clear.
 */
let parseBlocker: string | null | undefined;
const needCleanParse = (): string | null => {
  if (parseBlocker === undefined) {
    const r = run(['tsx', 'scripts/parse.ts']);
    parseBlocker =
      r.status === 0
        ? null
        : `a CLEAN parse already exits ${r.status ?? `on ${r.signal}`}, so an injected defect ` +
          `cannot reach its own gate: ${
            r.out
              .split('\n')
              .map((l) => l.trim())
              .filter((l) => l.startsWith('Error:') || l.startsWith('✖'))[0] ?? head(r, 2)
          }`;
  }
  return parseBlocker;
};

// ── controls ────────────────────────────────────────────────────────────────

/** `true` injected · a string is a NAMED skip (a genuinely absent
 *  precondition) · `false` is anchor drift, which is a FAILURE. */
type Injected = true | false | string;

interface Control {
  /** What the gate protects, phrased as the failure it refuses. */
  name: string;
  /** Files this control edits; each is snapshotted and restored byte-exactly
   *  (or unlinked, if it did not exist). */
  files: string[];
  /** Apply the defect. */
  inject: () => Injected;
  /** The command that must exit non-zero. */
  cmd: string[];
  /** The rule the run must NAME. */
  names: RegExp;
  /** Anything that must be true before the command can be judged. Returns null
   *  when it is. The control's ANCHOR is still audited when this is not. */
  precondition?: () => string | null;
}

// Everything scripts/parse.ts and scripts/parse-finish.ts write. Listed so a
// control whose run COMPLETES restores the committed artifacts byte-exactly
// rather than leaving a defective corpus on disk for the next control to read as
// its baseline.
const PARSE_OUTPUTS = [
  'data/videos.json',
  'data/players.json',
  'data/review-queue.json',
  'data/source-pins.json',
  'data/theater-cursor.json',
  'data/report.md',
];
// Everything scripts/emit.ts writes under data/ (its public/data copies are
// gitignored build output and are left alone).
const EMIT_OUTPUTS = [
  'data/replays.json',
  'data/summary.json',
  'data/stats.json',
  'data/patchGroups.json',
  'data/players.json',
];

const PROBE = (c: (typeof PROBE_CASES)[number]): string[] => ['tsx', probePath(), c];

const CONTROLS: Control[] = [
  // ── the patch table (scripts/patches.ts) ─────────────────────────────────
  {
    name: 'patches: two rows share a start date (the CMS error that mis-filed 950 records on CotW)',
    cmd: ['tsx', 'scripts/patches.ts', '--check'],
    files: ['scripts/patches.ts'],
    names: /2026-07-29 and 2026-09-02 both start 2026-07-29/,
    inject: () =>
      sub(
        'scripts/patches.ts',
        "    version: '2026-09-02',\n    start: '2026-09-02',",
        "    version: '2026-09-02',\n    start: '2026-07-29',",
      ),
  },
  {
    name: 'patches: a future-dated row (a typo year mints an empty window and asserts clean)',
    cmd: ['tsx', 'scripts/patches.ts', '--check'],
    files: ['scripts/patches.ts'],
    names: /starts 2027-09-02, in the FUTURE/,
    inject: () =>
      sub(
        'scripts/patches.ts',
        "    version: '2026-09-02',\n    start: '2026-09-02',",
        "    version: '2027-09-02',\n    start: '2027-09-02',",
      ),
  },
  {
    // THIS GAME'S OWN RULE (checklist 4d, which this build wrote). The vendor
    // numbered ONE of four builds, so the token is the DATE on every row and the
    // version rides as a display label. A row that takes the vendor's version as
    // its token mints a URL no window matches — and looks more correct than the
    // rule it breaks, which is why it is asserted rather than described.
    name: 'patches: A VENDOR VERSION AS THE TOKEN — the one temptation rule 4d exists to refuse',
    cmd: ['tsx', 'scripts/patches.ts', '--check'],
    files: ['scripts/patches.ts'],
    names: /the token must be an ISO day on every row \(checklist 4d\)/,
    inject: () =>
      sub(
        'scripts/patches.ts',
        "    version: '2026-09-02',\n    start:",
        "    version: '2.5',\n    start:",
      ),
  },
  {
    // The off-Steam row is the largest window in the table — 91 of 231 catalogue
    // rows measured on 2026-09-16 fall inside it — and its evidence is a tweet.
    // `announcedOn: 'x'` must never become the place a row with no source hides.
    name: "patches: an off-Steam row loses its OFF_STEAM_OK reason (the vendor's feed is incomplete)",
    cmd: ['tsx', 'scripts/patches.ts', '--check'],
    files: ['scripts/patches.ts'],
    names: /announcedOn x but not in OFF_STEAM_OK/,
    inject: () => sub('scripts/patches.ts', "  '2026-08-06':\n", "  '2026-08-07':\n"),
  },
  {
    // A bare /\d+\.\d+/ over these bodies returns 2.5, 1.0, 1.0, 29.99 and 14.0
    // (measured 2026-09-18). "Ranked Mode 1.0" appears twice inside the Patch 2.5
    // body, so it is the exact string a loosened label rule would admit.
    name: 'patches: a label outside the vendor\'s "Patch <n>" grammar ("Ranked Mode 1.0")',
    cmd: ['tsx', 'scripts/patches.ts', '--check'],
    files: ['scripts/patches.ts'],
    names: /label "Ranked Mode 1\.0" is not the vendor's "Patch <n>" grammar/,
    inject: () =>
      sub('scripts/patches.ts', "    label: 'Patch 2.5',", "    label: 'Ranked Mode 1.0',"),
  },
  {
    name: 'patches: the newest era is closed (the current era stops collecting records)',
    cmd: ['tsx', 'scripts/patches.ts', '--check'],
    files: ['scripts/patches.ts'],
    names: /the newest era must be open \(end: null\)/,
    inject: () =>
      sub(
        'scripts/patches.ts',
        '    start: LAUNCH,\n    end: null,',
        "    start: LAUNCH,\n    end: '2026-09-10',",
      ),
  },
  {
    // THE MEASURED-CADENCE RULE, MADE EXECUTABLE. This table already contains a
    // 27-day gap (2026-08-06 → 2026-09-02), so a staleness threshold at or below
    // it is red by construction — and an alarm that is red for a vendor doing
    // nothing wrong is an alarm everybody learns to skim past.
    name: 'patches: the staleness alarm is set below the table’s own widest gap',
    cmd: ['tsx', 'scripts/patches.ts', '--check'],
    files: ['scripts/patches.ts'],
    names: /STALE_PATCH_DAYS is 20 but this table already contains a 27-day gap/,
    inject: () =>
      sub(
        'scripts/patches.ts',
        'export const STALE_PATCH_DAYS = 30;',
        'export const STALE_PATCH_DAYS = 20;',
      ),
  },

  // ── the registries (scripts/characters.ts) ───────────────────────────────
  {
    // THE MEASURED TRAP, and it is this game's version of CotW's "Griffon" case.
    // `Firelord Sozin` is a real SUPPORT (ozai's, catalogue row 496296). A bare
    // `Fire Lord` alias on ozai resolves that support to the fighter in any pass
    // that runs the fighter vocabulary alone — and `aliasKey` folds `Fire Lord`
    // and `Firelord` to one key, so one ban covers both spellings.
    name: 'roster: a BANNED alias is re-added ("Fire Lord" — Ozai\'s own support resolves to Ozai)',
    cmd: ['tsx', 'scripts/characters.ts'],
    files: ['data/characters.json', 'data/supports.json', 'scripts/characters.ts'],
    names: /"firelord" is a BANNED alias but ozai claims it/,
    inject: () =>
      sub(
        'scripts/characters.ts',
        "    aliases: ['Fire Lord Ozai'],",
        "    aliases: ['Fire Lord', 'Fire Lord Ozai'],",
      ),
  },
  {
    name: 'roster: two fighters claim one alias (the matcher then resolves a coin flip)',
    cmd: ['tsx', 'scripts/characters.ts'],
    files: ['data/characters.json', 'data/supports.json', 'scripts/characters.ts'],
    names: /alias "Toph" claimed by both (toph and kyoshi|kyoshi and toph)/,
    inject: () =>
      sub(
        'scripts/characters.ts',
        "    aliases: ['Avatar Kyoshi'],",
        "    aliases: ['Toph', 'Avatar Kyoshi'],",
      ),
  },
  {
    // The bridge to the design handoff, asserted in BOTH directions: a roster id
    // with no token ships an unstyled fighter, and a token nothing claims is
    // either a typo or a fighter somebody forgot to add. Renaming one token
    // fires both halves at once.
    name: 'roster: a fighter with no --char-* design token',
    cmd: ['tsx', 'scripts/characters.ts'],
    files: ['data/characters.json', 'data/supports.json', 'design/handoff/tokens.css'],
    names: /toph: no --char-toph in design\/handoff\/tokens\.css/,
    inject: () => sub('design/handoff/tokens.css', '--char-toph:', '--char-toph-x:'),
  },
  {
    // Recomputed against --color-surface #1D1A16 rather than trusted: the
    // handoff STATES a ratio per accent and the roster build re-derives it. The
    // tightest on this roster is ozai at 5.06:1, so the floor has real headroom
    // and this injection is well clear of it.
    name: 'roster: an accent below the 4.5:1 AA floor on #1D1A16',
    cmd: ['tsx', 'scripts/characters.ts'],
    files: ['data/characters.json', 'data/supports.json', 'design/handoff/tokens.css'],
    names: /toph: accent #2E4A28 is [0-9.]+:1 on #1D1A16/,
    inject: () =>
      sub('design/handoff/tokens.css', '#85CD75;  /* Toph Beifong', '#2E4A28;  /* Toph Beifong'),
  },
  {
    // TWO FILES, ONE COLOUR, AND EACH RENDERS PERFECTLY ON ITS OWN. tokens.css is
    // the source of truth and app.config.ts is a transcription of it (checklist
    // 14), so a drift is invisible to every other gate — including e2e, which
    // compares the config against the BUILD and would agree with the wrong value.
    name: 'roster: the theme accent drifts from the handoff token it transcribes',
    cmd: ['tsx', 'scripts/characters.ts'],
    files: ['data/characters.json', 'data/supports.json', 'app/app.config.ts'],
    names: /accent drift on toph: tokens\.css says #85CD75, app\/app\.config\.ts says #85CD76/,
    inject: () => sub('app/app.config.ts', "toph: '#85CD75'", "toph: '#85CD76'"),
  },
  {
    // THE SUPPORT PARTITION (checklist 13). Each support belongs to exactly one
    // fighter across all 462 sides of the 2026-09-16 sweep — a validatable
    // invariant that only exists because the namespace is separate.
    name: 'roster: a support owned by something that is not a fighter',
    cmd: ['tsx', 'scripts/characters.ts'],
    files: ['data/characters.json', 'data/supports.json', 'scripts/characters.ts'],
    names: /support badgermole: owner "toph-beifong" is not a roster id/,
    inject: () =>
      sub(
        'scripts/characters.ts',
        "    id: 'badgermole',\n    name: 'Badgermole',\n    owner: 'toph',",
        "    id: 'badgermole',\n    name: 'Badgermole',\n    owner: 'toph-beifong',",
      ),
  },
  {
    // The release date is far in the future ON PURPOSE: a past one would trip the
    // expiry hard-stop instead, which is a different gate.
    name: 'roster: an announced-but-unreleased fighter reaches the roster',
    cmd: ['tsx', 'scripts/characters.ts'],
    files: ['data/characters.json', 'data/supports.json', 'scripts/expiries.ts'],
    names: /toph is in ROSTER and in UNRELEASED/,
    inject: () => sub('scripts/expiries.ts', "    id: 'iroh',", "    id: 'toph',"),
  },

  // ── the parser and the index reader, through the exported API ────────────
  {
    name: 'parse: THE PAIR-LEVEL BRANCH is reverted — all 57 of the largest channel’s records vanish',
    cmd: PROBE('pair-level'),
    files: ['scripts/parse.ts'],
    names: /PAIR-LEVEL SLOT ORDER \(checklist 5q\)/,
    inject: () =>
      sub(
        'scripts/parse.ts',
        '    const pair = parsePair(t, ctx, ch.ownerHandle);\n    if (pair) return pair;\n',
        '',
      ),
  },
  {
    name: 'parse: THE CPU/ARCADE REFUSAL is disarmed — a matchup with no person becomes a queue item',
    cmd: PROBE('cpu-arcade'),
    files: ['scripts/parse.ts'],
    names: /CPU\/ARCADE REFUSAL \(checklist 5r\)/,
    inject: () =>
      sub(
        'scripts/parse.ts',
        "    if (matchupOnly) return { miss: 'matchup-only' };",
        "    if (false as boolean) return { miss: 'matchup-only' };",
      ),
  },
  {
    // NORMALISATION MUST EXERCISE IDENTITY, NOT THE PARSE RATE — the trap the
    // checklist amendment names, and it has a sharp edge on THIS pipeline.
    // Measured 2026-09-18 with normalizeText bypassed inside playerId(): the
    // SPACE class proves nothing at all. `Arin<U+00A0>Karin`, the U+3000
    // spelling and the fullwidth spelling ALL still slug to `arin-karin`,
    // because playerId()'s own NFKD folds every one of them to an ASCII space
    // and `[^a-z0-9]+` then hyphenates it. A control built on U+00A0 alone would
    // pass on a pipeline with no normalisation whatsoever.
    //
    // What only normalizeText does is DELETE the zero-width class: NFKD keeps
    // U+200B, so `Arin<U+200B>Karin` slugs to `arin-karin` — a second person —
    // where the fold gives `arinkarin`. So the control asserts BOTH groups: the
    // space class because it is what the corpus would plausibly carry, and the
    // zero-width class because it is the one that discriminates. Stage 0 found
    // ZERO invisible codepoints in every marked title across 73 channels, which
    // is exactly why this must not be asserted as a parse RATE: there is no rate
    // to move, and an identity that quietly splits is still possible.
    name: 'parse: NORMALISATION IS IDENTITY — a variant spelling must not mint a second player',
    cmd: PROBE('identity'),
    files: ['scripts/roster.ts'],
    names: /NORMALISATION IS IDENTITY — the zero-width class/,
    inject: () =>
      sub(
        'scripts/roster.ts',
        "  const nfkd = normalizeText(handle).normalize('NFKD').toLowerCase();",
        "  const nfkd = handle.normalize('NFKD').toLowerCase();",
      ),
  },
  {
    // The reference's placeholder predicate ends in `[^\p{L}\p{N}]*`, which
    // matches any all-punctuation string — and this corpus contains `♱` (U+2671)
    // as an ENTIRE handle, written by arinKarin in its own title ("Vs ♱ (Azula)")
    // and echoed by catalogue row 482823. It is a person. Re-adding the
    // alternative is the exact port this game must not accept.
    name: 'parse: the shared placeholder rule is pasted back in and deletes the ♱ player (12k)',
    cmd: PROBE('placeholder-symbol'),
    files: ['scripts/parse.ts'],
    names: /THE SYMBOL HANDLE \(checklist 12k\)/,
    inject: () =>
      sub(
        'scripts/parse.ts',
        '  /^(?:(?:[\\p{L}\\p{N}]+\\s+)?player|unknown(?:\\s+player)?|none|n\\/a|tbd)$/iu;',
        '  /^(?:(?:[\\p{L}\\p{N}]+\\s+)?player|unknown(?:\\s+player)?|none|n\\/a|tbd|[^\\p{L}\\p{N}]*)$/iu;',
      ),
  },
  {
    // The `tag` column is MIXED on this catalogue: an event on 170 rows and a set
    // FORMAT (FT5..FT30) on 40, measured over its 244 rows on 2026-09-18. The
    // engine prints `event` INSTEAD of the source name, so a format reaching it
    // renders a chip reading "FT10" where a tournament belongs.
    name: 'index: a set FORMAT tag is published as the event chip (checklist 12k)',
    cmd: PROBE('index-format-tag'),
    files: ['scripts/parse-finish.ts'],
    names: /A SET FORMAT IS NEVER AN EVENT \(checklist 12k\)/,
    inject: () =>
      sub(
        'scripts/parse-finish.ts',
        "    const event = tag && !ctx.index.formatTagPattern.test(tag) ? tag : '';",
        '    const event = tag;',
      ),
  },
  {
    // 26 of the 29 single-row offsets on this catalogue are 5-51s INTRO SKIPS on
    // whole per-set uploads; the only two real segments sit at 50% and 56% of
    // their VOD. "t= is present" therefore mints `vid@N` segment ids for videos
    // that are not segments, and the embed then opens a whole upload as a clip.
    name: 'index: an intro-skip offset mints a segment id (checklist 12k)',
    cmd: PROBE('index-intro-skip'),
    files: ['scripts/parse-finish.ts'],
    names: /AN INTRO-SKIP OFFSET IS NOT A SEGMENT \(checklist 12k\)/,
    inject: () =>
      sub(
        'scripts/parse-finish.ts',
        '      (rows > 1 ? true : start > 0 && share >= ctx.index.segmentOffsetMinShare);',
        '      (rows > 1 ? true : start > 0);',
      ),
  },
  {
    // The other end of the same rule, and it is the half a `start > 0` guard gets
    // wrong: five multi-row VODs here open at ZERO, and publishing that row as
    // the whole 1,722-11,139s video makes one record stand for a whole bracket.
    name: 'index: a t=0 row inside a multi-row VOD is published as the whole video (12k)',
    cmd: PROBE('index-zero-offset'),
    files: ['scripts/parse-finish.ts'],
    names: /A t=0 ROW INSIDE A MULTI-ROW VIDEO IS A SEGMENT \(checklist 12k\)/,
    inject: () =>
      sub(
        'scripts/parse-finish.ts',
        '      (rows > 1 ? true : start > 0 && share >= ctx.index.segmentOffsetMinShare);',
        '      (rows > 1 ? start > 0 : start > 0 && share >= ctx.index.segmentOffsetMinShare);',
      ),
  },
  {
    // The reference's index reader folds char2..char4 into the side as
    // counter-picks. On this catalogue char2 is the SUPPORT on 100% of rows, so
    // that port prints a 100% counter-pick rate, doubles the roster and — on the
    // one row where the namespaces overlap — mints `katara` as a second fighter
    // on an Avatar Aang side. Every count stays green while it happens.
    name: 'index: the support column is folded into Side.characters (checklist 13)',
    cmd: PROBE('index-support-namespace'),
    files: ['scripts/parse-finish.ts'],
    names: /A SUPPORT NEVER REACHES Side\.characters \(checklist 13\)/,
    inject: () =>
      sub(
        'scripts/parse-finish.ts',
        '        characters: [fighter.id],\n        support: keepSupport,',
        '        characters: keepSupport ? [fighter.id, keepSupport] : [fighter.id],\n        support: keepSupport,',
      ),
  },

  // ── the pipeline guards (scripts/parse.ts, end to end) ───────────────────
  {
    // THE FREEZE BRANCH HAS A CONSUMER ON DAY ONE. drewShoto ships frozen, and
    // the committed data file is both the source and the target of the carry, so
    // a wrong pin poisons every later run silently. Editing the pin IS the
    // deliberate-prune mechanism; a mismatch nobody edited means the archive
    // moved on its own.
    name: 'parse: THE FROZEN PIN — drewShoto is carried against a count nobody edited',
    cmd: ['tsx', 'scripts/parse.ts'],
    files: ['scripts/channels.ts', ...PARSE_OUTPUTS],
    names: /drewShoto is frozen at \d+ record\(s\) but/,
    precondition: needCleanParse,
    inject: () => sub('scripts/channels.ts', '      records: 3,', '      records: 9999,'),
  },
  {
    name: 'parse: an empty raw dump is refused outright (never read as "a quiet day")',
    cmd: ['tsx', 'scripts/parse.ts'],
    files: ['raw/still.json', ...PARSE_OUTPUTS],
    names: /raw\/still\.json is empty — refusing to parse/,
    precondition: () => needRaw('still') ?? needCleanParse(),
    inject: () => {
      if (!existsSync(join(ROOT, 'raw/still.json'))) return needRaw('still')!;
      write('raw/still.json', '[]');
      return true;
    },
  },
  {
    // CHECKLIST 10c. The guard reads ONLY DATA: a dump cannot contain an upload
    // published after it was taken, so a committed record NEWER than anything in
    // the dump proves the dump is stale. Both sides are publish timestamps
    // written by YouTube and carried inside the files, so no amount of touching
    // mtimes — `cp`, `git checkout`, a fresh clone, or this suite's own restore —
    // can fake or hide it.
    name: 'parse: the DATA-ONLY stale-raw guard (the dump predates a committed record)',
    cmd: ['tsx', 'scripts/parse.ts'],
    files: ['raw/still.json', ...PARSE_OUTPUTS],
    names: /raw\/still\.json is stale/,
    precondition: () => needRaw('still') ?? needCorpus() ?? needCleanParse(),
    inject: () => {
      if (!existsSync(join(ROOT, 'raw/still.json'))) return needRaw('still')!;
      const dump = readJson<{ publishedAt: string }[]>('raw/still.json');
      if (!dump.length) return 'raw/still.json is empty';
      for (const r of dump) {
        r.publishedAt = `${Number(r.publishedAt.slice(0, 4)) - 1}${r.publishedAt.slice(4)}`;
      }
      write('raw/still.json', JSON.stringify(dump));
      return true;
    },
  },
  {
    // videos.json is the baseline for the freeze carry, the index intake's
    // add-only merge AND the collapse guard. A truncated file silently read as []
    // would carry nothing, preserve nothing, and disarm the guard for every
    // channel at once — a total loss with every gate green. Absent means a first
    // run; unreadable is a hard stop.
    name: 'parse: an unreadable videos.json is a hard stop, never "treat it as empty"',
    cmd: ['tsx', 'scripts/parse.ts'],
    files: ['data/videos.json'],
    names: /will not parse — refusing to treat it as empty/,
    precondition: () => needCorpus() ?? needCleanParse(),
    inject: () => {
      write('data/videos.json', '{ this is not json');
      return true;
    },
  },
  {
    // THE COLLAPSE GUARD, AND ON THIS CORPUS IT IS MOSTLY ASLEEP (checklist 7b).
    // It needs >10% AND >20 records lost from ONE intake, and the largest channel
    // commits 57 — so aegisEsports is the only intake where both arms can fire at
    // all, and that is the intake this control targets. Everywhere else the live
    // protection is the freeze pin, the freezeWatch rows and the per-intake table
    // in report.md, which prints every loss the guard cannot refuse.
    //
    // The rows are dropped from the OLD end of the dump, not the head: the newest
    // publishedAt has to stay put or the run dies in the STALE-RAW guard instead
    // and the control proves nothing about collapses.
    name: 'parse: the collapse guard (aegisEsports loses >10% AND >20 records)',
    cmd: ['tsx', 'scripts/parse.ts'],
    files: ['raw/aegisEsports.json', ...PARSE_OUTPUTS],
    names: /COLLAPSE GUARD: 1 intake\(s\) lost[\s\S]*aegisEsports: \d+ → \d+/,
    precondition: () => needRaw('aegisEsports') ?? needCorpus() ?? needCleanParse(),
    inject: () => {
      if (!existsSync(join(ROOT, 'raw/aegisEsports.json'))) return needRaw('aegisEsports')!;
      const dump = readJson<{ title: string; publishedAt: string }[]>('raw/aegisEsports.json');
      // HALVE THE MARKED ROWS, NOT THE DUMP. The first version of this control
      // halved the dump by publishedAt and the guard did not fire — correctly.
      // Measured 2026-09-19: this channel holds 371 uploads going back years and
      // all 63 marked ones are 2026-07-29 or newer, so the oldest half contains
      // ZERO marked rows and the parse loses nothing. A control that removes
      // rows the parse never reads proves nothing about a collapse.
      const marked = dump.filter((v) => /avatar\s*legends/i.test(v.title));
      if (marked.length < 42)
        return `raw/aegisEsports.json holds only ${marked.length} marked row(s)`;
      const oldestFirst = [...marked].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
      // Keep the NEWEST marked row: the stale-raw guard reads publishedAt and
      // would refuse the run first, and then this control would be proving that
      // gate instead of its own.
      const drop = new Set(oldestFirst.slice(0, Math.floor(marked.length * 0.6)));
      const kept = dump.filter((v) => !drop.has(v));
      write('raw/aegisEsports.json', JSON.stringify(kept));
      return true;
    },
  },
  {
    // CHECKLIST 5n, AT PARSE TIME, OVER BOTH NAMESPACES. The failure is a
    // character filed as a person. The SUPPORT half is this game's and every
    // sibling's guard is blind to it: a fighters-only comparison passes `Sozin`
    // silently, because `Sozin` resolves to no fighter.
    //
    // CONFIRMED_CHARACTER_NAMED_PLAYERS ships EMPTY — measured, not skipped: zero
    // collisions over 178 catalogue player names and every admitted channel's
    // handles. So the control ADDS a fighter-named player to the registry rather
    // than removing an allow-list row, because there is no row to remove.
    name: 'parse: THE REGISTRY INVARIANT — a roster-named handle with no allow-list row',
    cmd: ['tsx', 'scripts/parse.ts'],
    files: ['scripts/parse.ts', ...PARSE_OUTPUTS],
    names: /REGISTRY INVARIANT: \d+ player handle/,
    precondition: needCleanParse,
    // THE INJECTION POINT IS THE SIDE CONSTRUCTOR EVERY RECORD PASSES THROUGH.
    // The first version rewrote the handle inside sideFromDescription(), which
    // measured 0 of 1,004 sides on this corpus — the description tier is a
    // MARKING gate here and has never supplied a character — so the control
    // exited 0 with nothing injected. Checklist 5p, from the other side: a tier
    // nobody populates cannot carry a control either.
    inject: () =>
      sub(
        'scripts/parse.ts',
        '          handle: s.handle,',
        "          handle: s.handle === 'STiLL' ? 'Zaheer' : s.handle,",
      ),
  },

  // ── emit: the two-schema boundary (scripts/emit.ts) ──────────────────────
  {
    // The registry assertions run in EMPTY-CORPUS MODE too, which is what makes
    // this one live before the first parse: emit refuses a supports table whose
    // owner column has come loose from the roster, with or without records.
    name: 'emit: a support is owned by somebody who is not on the roster',
    cmd: ['tsx', 'scripts/emit.ts'],
    files: ['data/supports.json', ...EMIT_OUTPUTS],
    names: /emit: support badgermole is owned by "toph-beifong", who is not on the roster/,
    precondition: () => needScript('scripts/emit.ts'),
    inject: () => {
      const rows = readJson<{ id: string; owner: string }[]>('data/supports.json');
      const row = rows.find((s) => s.id === 'badgermole');
      if (!row) return 'data/supports.json has no badgermole row';
      row.owner = 'toph-beifong';
      write('data/supports.json', `${JSON.stringify(rows, null, 2)}\n`);
      return true;
    },
  },
  {
    // The substrate's MatchSide carries provenance and the emitted side does not.
    // emit.ts builds sides FIELD BY FIELD rather than spreading, so the leak
    // "cannot happen by construction" — which is exactly what people say before
    // it does. The assertion runs on the SERIALIZED output.
    name: 'emit: pipeline provenance leaks into the public contract',
    cmd: ['tsx', 'scripts/emit.ts'],
    files: ['scripts/emit.ts', ...EMIT_OUTPUTS],
    names: /"provenance" leaked into replays\.json/,
    precondition: () => needScript('scripts/emit.ts') ?? needCorpus(),
    inject: () =>
      sub(
        'scripts/emit.ts',
        '      { player: v.sides[0].player, characters: v.sides[0].characters },',
        '      { player: v.sides[0].player, characters: v.sides[0].characters, provenance: v.sides[0].provenance } as never,',
      ),
  },
  {
    name: 'emit: a record references a character the roster does not have',
    cmd: ['tsx', 'scripts/emit.ts'],
    files: ['data/videos.json', ...EMIT_OUTPUTS],
    names: /emit: [^\s]+ references unknown character not-a-fighter/,
    precondition: () => needScript('scripts/emit.ts') ?? needCorpus(),
    inject: () => {
      const absent = needCorpus();
      if (absent) return absent;
      const v =
        readJson<
          { sides: { characters: string[]; support?: string | null }[]; supports?: unknown }[]
        >('data/videos.json');
      v[0]!.sides[0]!.characters = ['not-a-fighter'];
      // AND THAT SIDE'S SUPPORT IS CLEARED. emit asserts the support OWNER
      // PARTITION (checklist 13) before it checks roster membership, so a side
      // left holding Appa on a fighter that no longer exists trips the
      // partition instead — measured 2026-09-18, and exactly the wrong-gate
      // pass this harness refuses to hand out.
      v[0]!.sides[0]!.support = null;
      delete v[0]!.supports;
      write('data/videos.json', `${JSON.stringify(v, null, 2)}\n`);
      return true;
    },
  },
  {
    name: 'emit: a record carries a patch token no boundary accounts for',
    cmd: ['tsx', 'scripts/emit.ts'],
    files: ['data/videos.json', ...EMIT_OUTPUTS],
    names: /emit: [^\s]+ carries patch "9999-99-99", which no boundary accounts for/,
    precondition: () => needScript('scripts/emit.ts') ?? needCorpus(),
    inject: () => {
      const absent = needCorpus();
      if (absent) return absent;
      const v = readJson<{ patch: string }[]>('data/videos.json');
      v[0]!.patch = '9999-99-99';
      write('data/videos.json', `${JSON.stringify(v, null, 2)}\n`);
      return true;
    },
  },

  // ── match identity: REPORT ONLY (scripts/match-dupes.ts) ─────────────────
  {
    // CHECKLIST 2b, AND THIS CONTROL IS THE INVERSE OF EVERY OTHER ONE IN THE
    // FILE. Everywhere else the defect is a gate failing to fire. Here the defect
    // is the reporter DOING SOMETHING — dropping a record it believes is a
    // duplicate — and the gate is match-dupes' own before/after hash of the files
    // it opens. The runback is why: the same two players, the same two fighters,
    // the same day, is what a winners final followed by a grand final looks like,
    // and dropping on that key deletes the grand final of the corpus's biggest
    // event with every count green.
    name: 'dupes: the match-identity report DROPS a record (2b — it is report-only, forever)',
    cmd: ['tsx', 'scripts/match-dupes.ts'],
    files: ['scripts/match-dupes.ts', 'data/videos.json'],
    names: /match-dupes wrote to videos\.json\. This script is REPORT ONLY \(checklist 2b\)/,
    precondition: () => needScript('scripts/match-dupes.ts') ?? needCorpus(),
    inject: () =>
      sub(
        'scripts/match-dupes.ts',
        '  // ── the proof that nothing was written ────────────────────────────────────',
        '  const { writeFile: __w } = await import("node:fs/promises");\n' +
          '  const __v = JSON.parse(await readFile(join(DATA, "videos.json"), "utf8")) as MatchVideo[];\n' +
          '  await __w(join(DATA, "videos.json"), JSON.stringify(__v.slice(1), null, 2) + "\\n");\n' +
          '  // ── the proof that nothing was written ────────────────────────────────────',
      ),
  },

  // ── the OG card (scripts/og.ts) ──────────────────────────────────────────
  {
    // CHECKLIST 5d — PROVE THE TYPEFACE DREW. The real defect elsewhere on this
    // platform was a VARIABLE font: the layout emitted NaN path geometry and the
    // card truncated mid-word with no error anywhere. Rather than ship a variable
    // font to test it, corrupt the static instance's tables — the parse then
    // either throws or draws no ink, and both are refusals. design/fonts/ carries
    // the TTFs precisely so this cannot depend on the host's font stack.
    name: 'og: a committed display TTF is swapped or corrupted (the card ships a plausible substitute)',
    cmd: ['tsx', 'scripts/og.ts'],
    files: ['design/fonts/Figtree-Regular.ttf', 'public/og-default.png'],
    names: /(does not hold the faces this card was designed on|no ink from a committed face)/,
    precondition: () => needScript('scripts/og.ts'),
    inject: () => {
      const p = join(ROOT, 'design/fonts/Figtree-Regular.ttf');
      if (!existsSync(p)) return 'no design/fonts/Figtree-Regular.ttf';
      const buf = readFileSync(p);
      buf.fill(0, Math.floor(buf.length * 0.6), Math.floor(buf.length * 0.9));
      writeFileSync(p, buf);
      return true;
    },
  },
];

// ── controls this suite deliberately does NOT ship, named rather than absent ─
//
// A gate nobody wrote is invisible; a gate somebody decided not to write should
// not be. These print at the end of every run.
const DECLARED_GAPS: string[] = [
  'index: an h/m/s `t=` offset (`1h11m20s`) that a seconds-only pattern drops — 7.8% of this ' +
    'catalogue’s rows carry one. The conversion lives inside scripts/fetch-theater.ts’s link ' +
    'reader, which exports nothing this suite can call, and the only other way to reach it is a ' +
    'sweep whose YouTube join spends quota shared with six production crons (checklist 10j). ' +
    'THE FIX IS ONE LINE IN THAT FILE: export the offset reader, and this becomes a probe case ' +
    'beside the other four index controls.',
  'theater: the cursor-ahead refusal, the full-sweep record floor and partial-resume identity. ' +
    'The reference controls each drive a real sweep against a local fixture and still spend a ' +
    'videos.list batch on the liveness join. Not ported for the same quota reason; they belong ' +
    'in a suite that runs with its own key.',
  'art: FAIL LOUD on any vendor art fetch (checklist 15). scripts/art.ts has not shipped yet — ' +
    'when it does, the control is to point its fetcher at the prohibited source and require a ' +
    'refusal BEFORE anything is written under public/.',
];

// ── snapshot / restore ──────────────────────────────────────────────────────
//
// A file that did not exist is restored by DELETING it, not by writing zero
// bytes: several of the paths above (data/videos.json, data/report.md,
// public/og-default.png) are absent on a fresh checkout, and an empty file left
// behind is the difference between "not built yet" and "unparseable".

const snapshots = new Map<string, Buffer | null>();

const snapshot = (files: string[]): void => {
  for (const f of files) {
    const abs = join(ROOT, f);
    snapshots.set(f, existsSync(abs) ? readFileSync(abs) : null);
  }
};

const restore = (files: string[]): void => {
  for (const f of files) {
    const abs = join(ROOT, f);
    const snap = snapshots.get(f);
    if (snap === undefined) continue;
    if (snap === null) {
      if (existsSync(abs)) unlinkSync(abs);
      continue;
    }
    writeFileSync(abs, snap);
  }
};

// A SUITE THAT IS INTERRUPTED MUST STILL PUT THE FILES BACK, and it must take
// the probe directory with it. SIGKILL still cannot be caught; nothing fixes
// that.
let cleaningUp = false;
const cleanUp = (why: string): void => {
  if (cleaningUp) return;
  cleaningUp = true;
  const files = [...snapshots.keys()];
  if (files.length) {
    console.error(`\n  ${why} — restoring ${files.length} snapshotted file(s) before exiting.`);
    restore(files);
  }
  if (probeDir) rmSync(probeDir, { recursive: true, force: true });
};
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    cleanUp(`interrupted by ${sig}`);
    process.exit(sig === 'SIGINT' ? 130 : 143);
  });
}
process.on('uncaughtException', (err: unknown) => {
  cleanUp('the suite threw');
  console.error(err);
  process.exit(1);
});
process.on('exit', () => {
  if (probeDir) rmSync(probeDir, { recursive: true, force: true });
});

// ── tallies ─────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
let skipped = 0;
const failures: string[] = [];
const skips: string[] = [];

const record = (name: string, v: Verdict): void => {
  if (v.kind === 'pass') {
    passed++;
    console.log(`  PASS  ${name}${v.detail ? `\n        ${v.detail}` : ''}`);
    return;
  }
  if (v.kind === 'skip') {
    skipped++;
    skips.push(`${name}\n        ${v.detail}`);
    console.log(`  SKIP  ${name}\n        ${v.detail}`);
    return;
  }
  failed++;
  failures.push(`${name} — ${v.detail}`);
  console.log(`  FAIL  ${name}\n        ${v.detail}`);
};

const wanted = (name: string): boolean => !only || name.includes(only);

// ── run the controls ────────────────────────────────────────────────────────

const selected = CONTROLS.filter((c) => wanted(c.name));

if (LIST_ONLY) {
  console.log(`▶ ${selected.length} control(s)\n`);
  for (const c of selected) {
    const why = c.precondition?.() ?? null;
    console.log(`  ${why === null ? 'LIVE' : 'WAIT'}  ${c.name}${why ? `\n        ${why}` : ''}`);
  }
  if (probeDir) rmSync(probeDir, { recursive: true, force: true });
  process.exit(0);
}

console.log(`▶ ${selected.length} positive control(s)\n`);

for (const c of selected) {
  // The precondition is read BEFORE the injection so the skip can name it, and
  // the injection happens EITHER WAY: a control that cannot run must still prove
  // it can still place its defect. An anchor that has drifted is a FAILURE, not
  // a skip, because a drifted anchor is a control that would report PASS on a
  // pipeline with the gate deleted.
  const blocked = c.precondition?.() ?? null;
  snapshot(c.files);
  let injected: Injected = false;
  try {
    injected = c.inject();
  } catch (e) {
    injected = false;
    console.log(`        inject threw: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    if (injected !== true || blocked !== null) restore(c.files);
  }
  if (injected === false) {
    record(
      c.name,
      fail('ANCHOR DRIFT — the injection point no longer matches, so this control is a NO-OP'),
    );
    continue;
  }
  if (typeof injected === 'string') {
    record(c.name, skip(`precondition absent: ${injected}`));
    continue;
  }
  if (blocked !== null) {
    record(
      c.name,
      skip(`${blocked}\n        (the anchor still matches — the defect can be placed)`),
    );
    continue;
  }
  const r = run(c.cmd);
  restore(c.files);
  record(c.name, verdict(r, c.names));
}

// ── the clean run, which is the other half of step 10 ───────────────────────
//
// It also proves the restores above were byte-exact: every one of these reads
// files the controls edited, and several re-derive the committed artifacts.

console.log('\n▶ clean run');
const CLEAN: { label: string; cmd: string[]; precondition?: () => string | null }[] = [
  { label: 'patches --check', cmd: ['tsx', 'scripts/patches.ts', '--check'] },
  { label: 'expiries --check', cmd: ['tsx', 'scripts/expiries.ts', '--check'] },
  { label: 'characters', cmd: ['tsx', 'scripts/characters.ts'] },
  ...PROBE_CASES.map((c) => ({ label: `probe ${c}`, cmd: PROBE(c) })),
  { label: 'parse', cmd: ['tsx', 'scripts/parse.ts'], precondition: needCleanParse },
  {
    label: 'emit',
    cmd: ['tsx', 'scripts/emit.ts'],
    precondition: () => needScript('scripts/emit.ts'),
  },
];
for (const { label, cmd, precondition } of CLEAN) {
  if (only && !wanted(label)) continue;
  const blocked = precondition?.() ?? null;
  if (blocked !== null) {
    record(`clean run: ${label}`, skip(blocked));
    continue;
  }
  const r = run(cmd);
  if (r.status === 0) {
    passed++;
    console.log(`  PASS  ${label} exits 0`);
  } else {
    failed++;
    failures.push(`clean run: ${label} exits ${r.status ?? `on signal ${r.signal}`}`);
    console.log(
      `  FAIL  ${label} exits ${r.status ?? `on signal ${r.signal}`}\n` +
        r.out
          .split('\n')
          .filter((l) => l.trim())
          .slice(0, 6)
          .map((l) => `        ${l}`)
          .join('\n'),
    );
  }
}

// ── the tally ───────────────────────────────────────────────────────────────

console.log(
  `\n${failed === 0 ? '✓' : '✖'} ${passed} passed · ${failed} failed · ${skipped} skipped`,
);
if (skips.length) {
  console.log('\nSkipped, with the precondition each one is waiting on:\n');
  for (const s of skips) console.log(`  ${s}`);
}
if (DECLARED_GAPS.length) {
  console.log('\nNOT COVERED, on purpose — a gate nobody wrote is invisible:\n');
  for (const g of DECLARED_GAPS) console.log(`  · ${g}\n`);
}
if (failures.length) {
  console.error('\nA control that does not fire is worse than no control:\n');
  for (const f of failures) console.error(`  ${f}`);
}
process.exit(failed === 0 ? 0 : 1);
