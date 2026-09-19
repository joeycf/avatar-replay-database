/**
 * THE MAINTENANCE RITUAL, AS ONE COMMAND.
 *
 * Run: npm run data:catchup
 *
 * WHY THIS EXISTS, AND WHY IT IS NOT A CONVENIENCE WRAPPER (checklist 9c).
 * `raw/` is gitignored, so it is local and the daily cron never writes it. That
 * means a local `raw/` is routinely OLDER than the committed `data/` the cron
 * produced in CI — and running `data:parse` on its own then silently DELETES
 * every record the local dump cannot reproduce.
 *
 * NEITHER GUARD CLOSES THAT GAP ON THIS GAME, and here it is worse than on the
 * reference. The collapse guard needs >10% AND >20 records lost from one intake,
 * and only four of this corpus's intakes commit more than 20 records at all
 * (checklist 7b — scripts/parse-finish.ts says the same thing to the same
 * reader), so a stale local dump that costs every channel a record or two is
 * invisible to it by construction. The data-only stale-raw guard in parse.ts
 * catches the clear-cut case — a dump that provably predates a committed record
 * — but a dump that is merely INCOMPLETE is invisible to that one. Ordering is
 * what closes the gap, and making the mistake unhittable by accident is worth
 * more than either guard.
 *
 * THE ORDER IS THE POINT: fetch → index pull → parse → emit. The index pull runs
 * BEFORE parse because parse merges its dump, and it is allowed to FAIL without
 * stopping the run — the same rule the cron follows, for the same reason: on any
 * failure there is simply no dump, parse carries the committed records against
 * the pin, and the day stays green (checklist 12d).
 *
 * Nothing here resolves a review item. A verdict stays a human decision.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { MatchVideo, ReviewQueueItem } from '../types/index';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'data');

const read = <T>(p: string, fallback: T): T =>
  existsSync(join(DATA, p)) ? (JSON.parse(readFileSync(join(DATA, p), 'utf8')) as T) : fallback;

function step(label: string, args: string[], allowFailure = false): boolean {
  console.log(`\n\x1b[1m── ${label}\x1b[0m`);
  const r = spawnSync('npm', ['run', ...args], { stdio: 'inherit', cwd: ROOT });
  if (r.status !== 0) {
    if (allowFailure) {
      console.warn(`  ⚠ ${label} failed — continuing. This step is allowed to fail by design.`);
      return false;
    }
    console.error(`\n✖ ${label} failed. Nothing after it has run.`);
    process.exit(r.status ?? 1);
  }
  return true;
}

const before = {
  records: read<MatchVideo[]>('videos.json', []).length,
  pending: read<ReviewQueueItem[]>('review-queue.json', []).length,
};

step('1/4  fetch channel uploads', ['data:fetch']);
step('2/4  pull the Replay Theater index', ['data:theater'], true);
step('3/4  parse', ['data:parse']);
step('4/4  emit', ['data:emit']);

const after = {
  records: read<MatchVideo[]>('videos.json', []).length,
  pending: read<ReviewQueueItem[]>('review-queue.json', []).length,
};
const delta = (n: number) => (n > 0 ? `+${n}` : String(n));
console.log(
  `\n\x1b[1m✓ catchup complete\x1b[0m\n` +
    `  records ${before.records} → ${after.records} (${delta(after.records - before.records)})\n` +
    `  pending review ${before.pending} → ${after.pending} (${delta(after.pending - before.pending)})\n` +
    `  Nothing was drained to the site: resolving a review item stays a human decision.`,
);
