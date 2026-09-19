# Avatar Legends: The Fighting Game — Replay Database

The Avatar app for the [Replay Database](https://replaydatabase.com) platform: a
thin consumer of the shared `replay-engine` layer plus the bespoke Avatar data
pipeline. Lives behind the umbrella shell at **replaydatabase.com/avatar**.

Game #7, and the fourth consumer of the engine's
[NEW-GAME-CHECKLIST](../replay-engine/NEW-GAME-CHECKLIST.md). Stage 0 of this
build wrote the checklist's amendments 13, 2b, 5p–5t, 3b, 4d, 11c, 11d, 14, 15,
10h–10k, 1b, 12k and 16 — this is the first consumer whose game has a
role-differentiated second slot, the first whose partner site keys by short name,
and the first whose vendor licence forbids the art outright, and the list assumed
the opposite in all three places.

Where this repo diverges from a sibling, the divergence is argued in the file
that makes it. Those arguments are the useful part of this README's job, so it
links to them rather than restating them.

## The state of the archive

This game launched **2026-07-23**, eight weeks before this build. The corpus is
small and the reason is the game's age, not the intake: Stage 0's sweep of 73
candidate channels found **367 records across 32 intake channels** plus a
244-row index catalogue, with the largest single contributor at 57 records
(15.5%).

The live numbers are in `data/report.md` (per intake, every run) and
`data/summary.json` (the apex card payload). Nothing in this README restates
them, because a number in a README is a number nobody re-derives.

## Sets, not matches — and the ceiling is the harder edge

The YouTube channels publish **sets**; the index source publishes **matches**
cut out of them. Measured durations run 184 s to 7,112 s.

The platform's 120-second floor is **inert on every channel here** — the
shortest marked upload on any intake is 145 s — and `scripts/parse.ts` says so
rather than implying the floor is doing work. What does the work is the other
end. Eight whole-tournament VODs pass the marker gate, clear the floor by a
factor of sixty, and would each become ONE record standing for a whole bracket;
`aegisEsports` therefore declares `maxDurationSec: 3600`, which keeps 57 of 57
real sets and refuses 6 of 6 VODs with 1,240 s of headroom. That is checklist
5t, which this build wrote.

A record carrying `startSeconds` is a match inside a longer video; a whole-video
record is a set. The record already says which.

## The stat unit — side appearances

Avatar is 1v1 (`charactersPerSide: 1`), so a side fields one fighter and a mirror
adds two to that fighter's total. One denominator drives `characterUsage`,
`byPatchUsage` and `playerCharacters`, and `scripts/emit.ts` asserts the totals
agree.

**Support appearances are counted separately**, in `supportUsage`, and are never
folded into the fighter denominator. No `pairingUsage`: there is no same-side duo
on a 1v1 game, and emitting C(n,2) over anything would fabricate pairs nobody
played.

## The support namespace — and why it is not a second roster

Every side of this game picks a **fighter** and a **support**: 12 fighters × 3
supports = 36, and the index source states one on **100% of its rows** (244 of
244). The obvious move is `charactersPerSide: 2`. It is wrong on four counts,
each measured, and this is checklist 13 — the amendment this build contributed:

- A support has no page, no usage share and no mirror in the fighter namespace.
  Folding them into `Side.characters` would double the roster to 48, prerender 36
  pages nobody asked for, and halve every fighter's usage share.
- **The two namespaces overlap.** `Katara` is a launch fighter _and_ Avatar
  Aang's support — 1 of 462 sides at the 2026-09-16 sweep, and the uploader's own
  title confirms it. Folded into one list, that side reads as a two-fighter
  counter-pick and mints Katara as a second fighter on the opponent's slot, with
  every count green.
- The pairing is a strict **partition**: each observed support appears under
  exactly one fighter across all 462 sides. That is a validatable invariant in a
  separate namespace and meaningless inside a shared one.
- The reference's index reader folds `char2..char4` into the side as
  counter-picks. On this catalogue `char2` is the support on every row, so that
  port prints a 100% counter-pick rate and drowns the unresolved-character
  residue in support names.

So supports ride the record as `supports: [string | null, string | null]`
(the 2XKO `fuses` precedent), filtered through a facet and rendered as a second
badge. The engine needs no new field, and `charactersPerSide` stays 1.

Three things enforce it, at three different layers: the matcher is **typed by
role** with its own registry (`scripts/roster.ts`); `scripts/parse-finish.ts`
throws a NAMESPACE INVARIANT before writing if a support ever reaches
`Side.characters`; and `scripts/e2e.ts` asserts on the built site that the
prerendered character set is **exactly** the fighter roster. That last one is
phrased carefully — "no character page for a support id" is false as written,
because it would delete `katara`.

## One parser, five grammars, two namespaces

`parseSide` resolves by **roster membership**, never by slot position, and only
records which slot held the fighter. Four things here have no counterpart in the
reference parser, and each is a measured defect in the port rather than a
refinement:

- **The pair-level branch** (checklist 5q). `CharA vs CharB (HandleA vs HandleB)`
  carries two `vs` tokens, so the reference's global split returns three parts and
  refuses `vs-count` — all 57 records of the corpus's largest channel, where
  `parts === 2` on **zero** of its 63 marked titles. The branch is **marker-keyed,
  not channel-keyed**, because that channel's other game writes the mirror shape.
- **The typed support matcher** (checklist 13, above).
- **The CPU/arcade refusal** (checklist 5r). "Avatar Legends: The Fighting Game -
  Katara vs. Zaheer" passes marker + two fighters + `vs` and is not a match. The
  separating signal is handle recoverability: a matchup title is exhausted by its
  fighter spans plus mode words, so the residue on each side is empty. Measured on
  one channel: 32 of 32 sides empty, **16 fabricated records refused**.
- **Played-on dates** (checklist 5s). One channel titles every set with the day it
  was played and uploads it up to 23 days later. `MatchVideo.date` is that day
  where a channel declares the rule; `publishedAt` is kept beside it so the lag is
  reported rather than hidden.

## The marker is not always a word

`AVATAR_MARKER` is a typo-tolerant stem plus an acronym with lookarounds, not a
title and not `\b` (checklist 3b). Three measured shapes a ported marker misses
silently: a **hashtag-only** marker (`#AvatarLegends` mid-title, the only marker
one channel writes); an **acronym with alphanumeric neighbours**, where
`\bALTFG\b` matches nothing inside the challonge slug `scjuly26altfg` and
`(?<![A-Za-z])ALTFG(?![A-Za-z])` matches; and a vendor name the uploader
**misspells** (`Avatar Legens`, `AVATAR LEGNDS`).

Not one of the 32 intake channels is single-game. They hold 45,992 uploads and
454 marked titles between them — 0.99% — and several write their other games in
the identical grammar. An ungated parse does not produce noise; it produces
well-formed records for the wrong game.

## Patches: the token is a DATE, and the vendor split its own announcements

Checklist 4d, which this build wrote. This vendor published one versioned patch
on its storefront, one date-titled update on the storefront, and a third — a
balance patch that changed seven characters — **only on X**. With no published
predecessor for two of three rows, a version token would have to be invented for
them, so **the token is the ISO day on every row** and the vendor's version rides
as a display label (`Patch 2.5`).

The off-Steam row is the largest window in the table, and its evidence is a
tweet. `OFF_STEAM_OK` is the allowlist that keeps `announcedOn: 'x'` from
becoming the place an unsourced row hides: a row there without a reason of its
own fails `scripts/patches.ts --check`.

`npm run data:patch-check` is the content check against the vendor's feed, and
that feed is **known to be incomplete** — it is missing the 2026-08-06 balance
patch entirely. So the checker reads three things (the news feed, the store
events API, and the Steam build clock) and a clean bill needs all three.

## Unicode normalization ships, and its control asserts IDENTITY

Stage 0 found **zero invisible codepoints** in every marked title across 73
channels. Normalization ships anyway — it is cheap, and the corpus grows — but
its positive control cannot be "does it still parse", and on this pipeline that
matters more than usual.

Measured 2026-09-18 with `normalizeText` bypassed inside `playerId()`: the SPACE
class proves nothing at all. `Arin<U+00A0>Karin`, the U+3000 spelling and the
fullwidth spelling **all still slug to `arin-karin`**, because `playerId`'s own
NFKD folds every one of them. What only `normalizeText` does is delete the
zero-width class, so `Arin<U+200B>Karin` slugs to a second person without it. The
control in `scripts/verify-gates.ts` asserts both groups and says which one
discriminates.

## Match identity is a REPORT-ONLY tier

Checklist 2b. Once an organiser posts both a full VOD and per-match cuts, the
index source segments the VOD, the channel arm ingests the cut, and the two
records collide on nothing: 10 of 47 index segments on one organiser's VODs
duplicate a standalone upload by the same organiser (70% on the single VOD it
fully re-cut), with one pairing reaching **five candidate records across three
intakes**. The duplicate rate on video ids is zero and always will be — composite
`${videoId}@${startSeconds}` ids are what keep those records distinct in the
first place, so that key measures its own success.

So the signature is computed, reported and queued as `duplicate-candidate` — and
**never used to drop**. The runback is a legitimate collision: the same two
players, on the same two fighters, on the same day, is what a winners final
followed by a grand final looks like. `scripts/match-dupes.ts` hashes every file
it opens before and after, so "report only" is a measurement rather than a
promise in a comment, and `verify:gates` injects a write into it to prove the
hash fires.

## The collapse guard is mostly ASLEEP here — say so

Checklist 7b. The guard needs a per-intake loss of **>10% AND >20 records**, and
this corpus is eight weeks old: the largest intake commits 57 records and most
commit fewer than 20, so the second arm **cannot fire at all** on nearly every
channel. `aegisEsports` is the one intake where both arms can fire, and it is the
intake `verify:gates` aims its collapse control at.

What protects the rest is not the guard, and the file says which things do:

- `data/report.md` prints **every** loss the guard cannot refuse, per intake, on
  every run.
- The freeze pin (`drewShoto`) and the `freezeWatch` rows are hard assertions on
  channels that have stopped publishing.
- The add-only carry pin in `data/source-pins.json` is a hard assertion on the
  index intake, and it only ever grows.
- `scripts/verify-deployed.ts` re-checks the same band against the **whole
  archive** in production, where the arithmetic inverts: 10% of 367 records is
  ~37, so the percentage term binds there and the absolute term binds per-intake.

## The art is generated, and that is a licence finding

Checklist 15, which this build wrote. The rights holder prohibits reuse outright
— "STRICTLY PROHIBITED WITHOUT THE PRIOR WRITTEN CONSENT",
reference.paramount.com/terms-of-use, read 2026-09-18 — publishes **no fan kit**,
and the wiki copies are pixel-identical to the vendor's own renders (mean
absolute difference 3.9–24.7 against 71–73 between different characters), so they
inherit the same prohibition. A wiki's "fair use on this wiki" tag does not
transfer.

So every tile for all 17 fighters (12 released, 5 announced) is **generated**,
any fetch of vendor art is a hard failure rather than a fallback, and
`app/app.config.ts` declares **no `artCredit`** — the absence is the finding, not
an omission. `scripts/e2e.ts` asserts that absence on the built site, because the
likeliest way a credit appears here is somebody pasting a sibling's config and
publishing a false attribution to a rights holder who refused. `data/art-
provenance.json` carries the citation and an expiry that re-checks for a fan kit.

## Scripts

| command             | what it does                                                         |
| ------------------- | -------------------------------------------------------------------- |
| `data:fetch`        | uploads-playlist walk, 32 channels, per-channel date floor (1b)      |
| `data:theater`      | the index catalogue pull + the YouTube liveness join                 |
| `data:parse`        | title parse + the index merge, every guard, `data/report.md`         |
| `data:emit`         | the public contract, with every assertion a throw                    |
| `data:catchup`      | fetch → theater → parse → emit, in that order, as one command        |
| `data:characters`   | the fighter roster + the support registry + all their validators     |
| `data:patches`      | the patch table's shape; also runs inside `npm run typecheck`        |
| `data:patch-check`  | the vendor's three surfaces vs the table. Manual — never in the cron |
| `data:roster-check` | Steam achievements + the vendor widget vs the roster. Manual         |
| `data:expiries`     | the clock-and-corpus gate: unreleased fighters, supports, patches    |
| `data:dupes`        | the match-identity deep dive. Report only, and it proves it          |
| `data:art`          | the generated tiles. Manual                                          |
| `data:og`           | the OG card. Manual                                                  |
| `verify:gates`      | the positive-control suite                                           |
| `verify:deployed`   | content-digest smoke check against production                        |
| `test:e2e`          | assertions against the built output                                  |

`npm run typecheck` — **never raw `tsc`**. The repo is two disjoint TypeScript
tracks and the root config delegates to Nuxt's, so `npx tsc --noEmit -p .`
reports clean while a pipeline script references deleted functions.

## The gates

**`verify:gates`** injects a real defect into a real file, runs a real command,
and requires a non-zero exit that **names the rule it tripped**. Two things it
does that the reference does not:

- A control whose precondition is absent is **still injected and restored**, so a
  rotted anchor is a FAILURE rather than a quiet "waiting". Every control in the
  file is proven able to place its defect today, whether or not its command can
  run yet.
- Eight controls drive the pipeline's **exported functions** — `parseTitle`,
  `playerId`, `isPlaceholderHandle`, `buildTheaterRecords` — through a probe
  module written into a temp directory outside the repo. That is what makes this
  game's own rules (5q, 5r, 13, 12k) testable offline, with no corpus, no API key
  and no quota.

**No control in the suite calls the YouTube API.** Checklist 10j: the key is
shared with six production crons and a recon pass on this game exhausted the
whole day's allowance once already. The reference spends a `videos.list` batch
per index control. The index rules that can be exercised offline are; the one
that cannot is printed under "NOT COVERED, on purpose" at the end of every run,
with the one-line fix that would make it coverable.

**`test:e2e`** reads `.vercel/output/static/avatar` — what Vercel actually serves.
It has an **empty-corpus mode** that skips and counts the record-shaped
assertions rather than passing them, and stage-gated assertions that name the
script they are waiting on and arm themselves the day it ships.

## Daily data refresh

`.github/workflows/data-refresh.yml`, **09:17 UTC** — the seventh stagger slot,
which Strive's workflow reserved by name for game seven. The platform's no-push
window is now 06:00–09:30. Game eight takes 09:47.

fetch → theater (allowed to fail, and last of the fetches) → parse → emit →
commit-if-changed → smoke check → expiries → patch-table validate. The index pull
is `continue-on-error` because the cron must never depend on a third party
succeeding: on any failure there is no dump, parse carries the committed records
against the pin, and the run stays green.

The commit guard stages data files **by name** (checklist 9b) and leaves
`data/overrides.json` out — that file is a human's. Two diffs are suppressed when
they are the only thing that changed: `report.md`'s generated timestamp, and
`theater-cursor.json`, whose value rises on days when nothing of ours moved. The
cursor suppression is written as an **emptiness test on the remaining staged
names**, because with the cursor filtered out that path list can be empty and an
empty pathspec means "everything".

`roster-check` and `patch-check` are **not** in the cron. Both read the vendor and
say so in their own headers; a vendor outage is not ours to go red on, and their
home is the workspace-level `../check-rosters.sh` and `../check-patches.sh`. The
offline halves — the unreleased/support/patch expiries and the patch table's own
clock-dependent validator — run after the commit, where a red step costs no data.

## Vercel, and the flip

Project `avatar-replay-database`. `NUXT_PUBLIC_SITE_URL` and `NUXT_APP_BASE_URL`
(`/avatar/`) must both be set on **Production and Preview** before the first
build, and **never copied from a sibling project** — checklist 10h exists because
one game shipped its first build mounted at the previous game's base path exactly
that way. The engine pin is `v0.15.1` and **that tag must exist on the remote**:
Vercel leaves `ENGINE_PATH` unset and clones the pinned ref.

`observability.insights: '/avatar-insights'` pairs 1:1 with the shell's rewrite.
The two ship together or every analytics beacon 404s, silently.

**The flip is gated, and the gate is in two files.** Until the shell's edge
rewrite of `/avatar/*` to this project exists, `SMOKE_HOST` must point at
`https://avatar-replay-database.vercel.app` — the workflow sets it explicitly, in
a block that exists to be deleted on flip day. Pointed at the apex before then,
every poll reads the shell's 404 and the smoke check times out as "never
readable": a red step for a deployment that is perfectly healthy. And
`verify:deployed` reads `summary.json` at the base path first, because a wrong
`game` there means the archive it would otherwise compare against belongs to
another project — that one is a hard failure the moment it is readable, and
polling longer will never make it true.
