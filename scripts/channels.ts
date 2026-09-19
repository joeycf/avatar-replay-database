/**
 * The source channels — checklist step 1, done before a fetcher existed.
 *
 * Thirty-three intakes: thirty-two YouTube channels and one third-party INDEX.
 * All thirty-two are ordinary daily uploaders; there is no backfill-once
 * mechanism on this platform and never was. The first cron run IS the backfill,
 * which is why the cron-preservation gate (a simulated daily run proving
 * untouched channels survive) is the one that matters.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHERE THE NUMBERS COME FROM. Stage 0 ran three recon workflows 2026-09-16..18
 * and deep-dived 73 candidate channels one at a time: per-channel grammar with
 * 50 verbatim sample titles, an orientation tally over BOTH sides of every
 * marked title, a codepoint scan, a videos.list hydration, a parse at three
 * duration floors, and a miss split. 32 channels came back INTAKE or FREEZE, 41
 * did not. "records" below is what a ported parser built from that channel's
 * marked titles: 367 across the 32, from 454 marked titles out of 45,992
 * uploads. 263 of the 367 existed on 2026-09-03, so the corpus roughly doubled
 * in the fortnight before the build.
 *
 * 367 IS A PRE-FLOOR FIGURE AND THE SHIPPED CORPUS WILL BE SMALLER. The recon
 * parsed with no date floor. Decision 9 puts the record floor at the 2026-07-23
 * launch, and the pre-launch records that floor removes are measured on three
 * channels — arinKarin 11 (6 from the Feb/Mar closed alpha, 5 from the
 * 07-02..07-07 window), normalMs 5, cow 1 — plus an unmeasured share of
 * schoolBus's two 07-04/07-05 uploads and natsuXenoblade's beta-era sets. Expect
 * roughly 345-350 on the first real parse, and re-derive the number from
 * report.md before quoting it anywhere a reader will take it as final.
 *
 * TWO MORE HONEST CAVEATS, both from Stage 0's own adversarial verifier:
 *  · The per-channel trailing-rate figures in the recon table are anchored to
 *    each channel's NEWEST upload, not to today, which flatters a channel that
 *    has stopped: aegisEsports tables 0.75 marked/day and measures 0.536 to
 *    today. Checklist 10k. Rates quoted per channel below are the to-today ones
 *    where the verifier recomputed them.
 *  · The missed-channel sweep surfaced 62 further candidate channels holding 473
 *    marked titles between them that were never deep-dived, several of them
 *    large (QueueMan 52 marked, AWanderingTanuki 44, Kavalan 38, MicroDuck 38,
 *    Avataryaya 33). This table is a floor, not a census.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ARRAY ORDER IS DEDUPE PRECEDENCE. Reordering changes which copy of a
 * cross-posted match survives, so the order is argued, not incidental. It is
 * committed-corpus size first, because volume is what decides most cross-post
 * ties, with grammar quality breaking near-ties — and on a corpus this flat
 * (largest channel 57 records, median channel 7) the near-ties are the common
 * case rather than the exception, so the grammar argument is written out
 * wherever it fires:
 *
 *   1  aegisEsports    57 records of 63 marked / 371 uploads. The corpus's
 *                      largest and cleanest: 57 of 57 match-like titles parse
 *                      with both fighters, both handles, 0 alias gaps and 0 slot
 *                      ambiguity. Also the only channel with a PAIR-LEVEL
 *                      grammar, which the shipped parser rejects outright.
 *   2  still           34 of 44 / 102. Ranked above ndyTv on a tie: all 34 come
 *                      from the TITLE tier, where 10 of ndyTv's 34 need a
 *                      per-channel description rule.
 *   3  ndyTv           34 of 57 / 3,780. Sole source for four international
 *                      events the index has never heard of.
 *   4  toledoLocals    23 of 25 / 911. Needs the bare-'Avatar' game-slot gate.
 *   5  arinKarin       18 of 19 / 201. Ranked above cow on a tie because it
 *                      needs ZERO per-channel title rules; cow needs a support
 *                      alias table and an in-bracket namespace split.
 *   6  cow             18 of 21 / 79.
 *   7  saltyRecoveryCenter 17 of 20 / 212.
 *   8  skeet           16 of 22 / 138.
 *   9  unrivaledTournaments 14 of 15 / 12,975. First of a three-way tie at 14:
 *                      one grammar 15/15, third-party bracket VODs, both players
 *                      independent of the uploader.
 *  10  normalMs        14 of 17 / 455. Second of the tie: 7 prefix spellings, a
 *                      grammar change at launch, and the uploader on every
 *                      record. In its favour, it is the only TITLE channel that
 *                      states the support slot.
 *  11  rood            14 of 17 / 2,334. Last of the tie: two grammar eras, and
 *                      2 of its 14 records depend on an UNVERIFIED typo alias.
 *  12  an11Mo          13 of 13 / 25.
 *  13  natsuXenoblade  10 of 15 / 174.
 *  14  takeANappa       9 of 16 / 198. The only channel needing a description
 *                      gate and the only one needing a structural gate.
 *  15  versusFestival   8 of 8 / 406. Above avianZebra on the tie: a third-party
 *                      TO, so both players are independent of the uploader,
 *                      where avianZebra is one side of 8 of 8.
 *  16  avianZebra       8 of 9 / 41.
 *  17  kmlTournaments   7 of 7 / 11,605. Above teo1029 on the tie for the same
 *                      reason: one template 7/7, no typos, both players
 *                      independent.
 *  18  teo1029          7 of 8 / 12. teo1029 is one side of 7 of 7, always Ozai.
 *  19  mysteryRacer21   6 of 6 / 312. Above xcaliburBladez on the tie: one clean
 *                      grammar, no per-channel rules, no typo aliases.
 *  20  xcaliburBladez   6 of 6 / 182. Three spellings of the owner's handle and
 *                      a typo alias.
 *  21  schoolBus        5 of 9 / 304.
 *  22  superSalemFighters 4 of 4 / 9,759. Above redVsFantasy on the tie: 4 of 4
 *                      marked titles parse with zero misses, against 4 of 12.
 *  23  redVsFantasy     4 of 12 / 506.
 *  24  mikeyChiFgc      3 of 3 / 21. First of the three-record tier: the cleanest
 *                      grammar measured on this game (fighter AND support on
 *                      every side, 3/3).
 *  25  kang             3 of 3 / 3.
 *  26  phoenixWrong     3 of 5 / 26. Last of the tier because its own side of the
 *                      title is empty and needs an ownerHandle.
 *  27  kovac            2 of 2 / 4. First of the two-record tier: full handles,
 *                      fighter, support and an FT tag, 100% consistent.
 *  28  atma00           2 of 2 / 15. Fighter + support on 4 of 4 sides.
 *  29  towito           2 of 2 / 131. Fighter-only sides.
 *  30  redblade         1 of 2 / 52. ONE record, ranked above a two-record
 *                      channel, and that is the near-tie rule doing its job:
 *                      1-vs-2 is a tie, and redblade is the only channel in the
 *                      table that needs no rules at all — canonical
 *                      HANDLE (FIGHTER) vs HANDLE (FIGHTER), pure ASCII.
 *  31  saxxiefone       2 of 2 / 5. Needs a support-bracket classifier, a 'v.s.'
 *                      separator and a marker-tail strip, and carries a U+2122
 *                      inside a handle.
 *  32  drewShoto        3 records, FROZEN on day one. A frozen channel drops to
 *                      the bottom of the YouTube block whatever its size: its
 *                      corpus is static and can never win a future cross-post.
 *                      The reference does the same (ggst channels.ts:60-61 puts
 *                      a 717-upload frozen channel below a 144-upload live one).
 *  33  replayTheater    the INDEX, 244 rows / 93 videos. Last, deliberately —
 *                      array order is dedupe precedence and lowest is right for
 *                      a source that re-indexes other people's uploads.
 *
 * AND THEN THE INDEX WINS ANYWAY ON THE VIDEOS IT COVERS, WHICH IS NOT A
 * CONTRADICTION. Precedence decides who wins a collision; it does not decide who
 * has more data. This game's index states the SUPPORT on 244 of 244 rows and 27
 * of the 32 title channels never state it at all, so on a shared video id the
 * index record is a strict superset of ours. The rule that follows is: the array
 * order governs, and parse suppresses the title record for a video the index
 * covers with a real segment, using our parse as the CROSS-CHECK witness
 * instead. Measured on the 7 Aegis per-match ids the index also holds, our
 * fighter pair and player pair agree with its on all 7 — a free correctness
 * signal on both intakes, and the reason to keep computing it rather than
 * dropping one side quietly.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * REJECTED: 41 CHANNELS, 1,467 MARKED TITLES, 3 RECORDS BETWEEN THEM.
 * 38 of the 41 yield ZERO records at every duration floor, and the reason on 35
 * of those is one thing — THE TITLE NAMES NO PLAYER — in four shapes: uploader-
 * POV sets ("KORRA vs Zaheer FT10", the opponent never named: DAN 曇, SosaSage,
 * Hellooooo_Nurse, HoneyBeeCMNDR, Danuto, shaktalu, ElliePhil, ProudDisciple,
 * GXBlack, Kings_C1ub, Nate Zatara, Con.D.oriano, FinalRounds, Super,
 * ReyMercury, AngryRaime, JonoKenpachi, SonicFox, Maelxich, Flaccid Joe, King F
 * Entertainment, Unc Nation, SageArtz X, Zachiderp, zeto_r2, jesusquietlips,
 * GuildfordFGC, SAK Gaming, Gem State Smash, AcousticHarmonia, frankvegaFGC,
 * Match Gaming, Elite Videogames, Chickensea1, AvatarFighters); 3 are CPU or
 * arcade SHOWCASE networks (below); and 3 more parse 1-2 records the index
 * already holds with better data (ScytheLDN 2, Exltd 1, KELSO2TIMES 1). A side
 * with no handle is a miss by construction — the reference refuses it twice
 * (parse.ts:697-698, :1062-1066) — and no strip, alias, floor or declared order
 * changes that.
 *
 * THE TWO TRAPS, NAMED SO NOBODY RE-ADDS THEM ON VOLUME:
 *  · WickDaLine (UCWGDYxrlDC6xrZX0UvuP35g), 510 uploads / 23 marked. SIXTEEN of
 *    its 23 titles pass marker + two fighters + vs — "Avatar Legends: The
 *    Fighting Game - Katara vs. Zaheer" — and every single one is CPU footage,
 *    always paired with a "- <Fighter> (Arcade)" upload the same day. It is the
 *    sweep's worst trap and it is ALREADY CAUGHT, but by a gate the checklist
 *    never states: 32 of 32 sides have EMPTY RESIDUE once the fighter span is
 *    removed, so the handle picker returns no-handle on all 16. That is
 *    checklist 5r — the separating signal is handle recoverability, not a
 *    CPU-detection heuristic — and it is why the residue rule must never be
 *    "relaxed" to raise a parse rate.
 *  · Marvel Tokon Replay Hub (UCtU_LgbjBgY1_0PY1L3K_Lw), 2,864 uploads since
 *    2025-10-11 at 9.0/day across 20+ games, 71 of them marked here. The same
 *    failure industrialised: 0 handles in 71 titles and in their descriptions,
 *    tags reading 'player vs cpu' / 'AI battle' / 'arcade mode', and
 *    beta-labelled clips still being uploaded on 2026-08-10, so its own
 *    provenance labels are unreliable too. 71 marked uploads is the third
 *    largest marked count in the whole sweep; the yield is zero.
 *
 * ALIASES BELOW ARE CHANNEL-SCOPED ONLY. The four short roster spellings —
 * 'Toph', 'Kyoshi', 'Ozai', 'Avatar Aang', against the handoff's 'Toph Beifong',
 * 'Avatar Kyoshi', 'Fire Lord Ozai', 'Avatar State Aang' — are what nearly every
 * channel and the index actually write, and they live in data/characters.json
 * `extra.aliases`, not here. The measurement that makes them non-optional:
 * running versusFestival with the handoff's display names alone resolves 4 of
 * its 16 sides, and on kmlTournaments the seed spellings silently file 'Avatar
 * Aang' as `aang` through the inner span. The support namespace is the same
 * story in data/supports.json. What a channel entry carries is only what is true
 * of ONE uploader: a typo, a nickname, a handle rewrite.
 *
 * THE DEDUPE KEY IS `id` (the intake ChannelKey), never `source`. They are 1:1
 * today and the types are still kept distinct; types/index.ts carries the
 * reason. AND ON THIS GAME THE KEY IS NOT SUFFICIENT: see MatchSignature, the
 * report-only identity tier checklist 2b requires. 10 of 47 index segments on
 * aegisEsports's VODs duplicate a standalone aegisEsports upload, and the video
 * id cannot see it.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { ChannelConfig } from '../types/index';
import { LAUNCH } from './patches';

/**
 * THE GAME'S LAUNCH DAY, and the floor for both the fetch walk and the record
 * set (decision 9).
 *
 * 2026-07-23, verified three independent ways: Steam PICS steam_release_date
 * 2026-07-23T13:59:00Z, the PS Store releaseDate 2026-07-23T14:00:00Z, and the
 * earliest of 3,468 Steam reviews at 2026-07-23T14:07:26Z (601 of them that
 * day). Steam's own store page says "Sep 10, 2026" and is WRONG — that date is
 * on the Deluxe Edition Upgrade DLC too, and the vendor's 2026-07-22 news post
 * says "launches July 23rd!". Xbox launched separately on 2026-09-03. The
 * vendor's 2026-03-30 pre-order post had promised July 2nd, which is why five
 * index rows and about seventeen channel records sit before this line.
 *
 * IMPORTED FROM scripts/patches.ts AND RE-EXPORTED, which is what the previous
 * comment here said had to happen the instant that file existed. It now does,
 * so the argument above lives beside the boundary table that owns the date; the
 * re-export stays because this module's own consumers ask it for the floor. The
 * fetch floor, the record floor and the era that has to cover them cannot drift
 * apart if there is only one of them.
 */
export { LAUNCH };

/** The uploads playlist is always 'UU' + channelId.slice(2). Pinned rather than
 *  looked up: it saves a quota unit per channel per run, and the id is stable
 *  where a handle is not. */
const uploads = (channelId: string) => `UU${channelId.slice(2)}`;

export const CHANNELS: ChannelConfig[] = [
  {
    id: 'aegisEsports',
    source: 'aegisEsports',
    name: 'Aegis Esports',
    channelId: 'UCeDXTKKarzOKJoVlUQUfTeA',
    uploadsPlaylist: uploads('UCeDXTKKarzOKJoVlUQUfTeA'),
    // Found by scrape, by the index's uploader list, and by search. 371 uploads,
    // 63 marked, 57 records; 59 marked / 54 parsed on 2026-09-03.
    //
    // "Avatar Legends The Fighting Game Toph vs Azula (Plisno vs T0ni) Avatar
    //  Legends Replay!" — THE PAIR-LEVEL GRAMMAR, and the whole reason
    //  SlotOrder needed a fifth member (checklist 5q). Fighters OUTSIDE the
    //  bracket, handles INSIDE it, index-aligned, two `vs` tokens per title. The
    //  reference's side-segmented split returns 3 parts and refuses all 57 as
    //  `vs-count`; measured over the 63 marked titles, parts===2 on ZERO.
    //
    // THE RULE MUST BE KEYED ON THE MARKER, NOT ON THIS CHANNEL. Its other game
    // uses the MIRROR of the same shape — "Aubrey vs Raeze UNI 2 REPLAY!
    // (Kaguya vs Akatsuki)" puts players outside and characters inside — so a
    // channel-scoped reading would file one of the two games backwards on every
    // record. About 150 of its 371 uploads are Under Night In-Birth 2, nine of
    // them posted the same week as Avatar sets, so the marker gate is
    // load-bearing here and the discovery note calling this channel
    // "single-game" is simply wrong.
    //
    // Requiring EXACTLY ONE bracket group is what separates a match from a
    // whole-tournament VOD, so no VOD blacklist is needed; the ceiling below is
    // the second, grammar-independent guard.
    slotOrder: 'pair-chars-outside',
    gateMode: 'title',
    strip: {
      prefix: [
        /^\s*(?:GRAND FINAL|LOSER FINALS|WINNERS FINAL)\s*-\s*/i,
        /^\s*Grand Finals\s+/i,
        /^\s*(?:OVER \d+\+? PLAYERS!|THE MOST STACKED [A-Z ]+YET|INSANE [A-Z ]+MATCHES!|Absolute Chaos in the Grand Finals!)\s*/,
      ],
      suffix: [
        /\s*Avatar\s*Legends\s*(?:The\s*Fighting\s*Game\s*)?(?:Tournament\s*)?Replay!*\s*$/i,
        /\s*Avatar\s*Replay!*\s*$/i,
        /\s*Tournament Highlights!*\s*$/i,
        /\s*Match!*\s*$/i,
      ],
    },
    // Checklist 5t. Six "Full Tournament VOD" uploads run 4840, 5408, 6445,
    // 6558, 6798 and 7112 seconds and the index cuts the 7112s one into
    // FOURTEEN rows. This channel has 7 uploads over 20 minutes and 6 over 60,
    // and the 6 over 60 are exactly those VODs — so the seventh is the longest
    // genuine set and sits under 3600s, while the shortest VOD is 4840s. 3600
    // keeps 57 of 57 and refuses 6 of 6 with 1240s of headroom.
    maxDurationSec: 3600,
    // TRAJECTORY, STATED BECAUSE THE TABLE HIDES IT. Weekly marked output ran
    // 11/15/15/9/9 through 2026-08-24 and then 1/2/1. Of its 7 uploads since
    // 2026-08-31, four are whole-tournament VODs and three are per-match
    // replays: the corpus's largest contributor has changed publishing model,
    // and its 28-day rate to today is 0.536/day against the 0.75 the recon
    // table carries (checklist 10k).
  },
  {
    id: 'still',
    source: 'still',
    name: 'STiLL',
    channelId: 'UC4_E3NfnI1Y9AVgID-X9okA',
    uploadsPlaylist: uploads('UC4_E3NfnI1Y9AVgID-X9okA'),
    // Found by scrape, by the index's uploader list, and by search. 102 uploads,
    // 44 marked, 34 records; 29 marked / 23 parsed on 2026-09-03. The
    // adversarial re-measure two days later read 47 marked and 1.643/day.
    //
    // "THE #1 OZAI & THE #1 KATARA! MEGA SET | ARIN KARIN(OZAI) V.S
    //  STiLL(KATARA) 08.20.26" — handle outside, fighter inside, and everything
    // else is hype prose that has to come off before the handle is read. 18% of
    // its handle slots are polluted and the worst runs to 12 words against
    // MAX_HANDLE_WORDS=5, so 3 titles are rejected outright and the rest would
    // mint phantom players.
    //
    // THIS IS THE CHANNEL THAT REPRODUCES THE DEFECT THE REFERENCE PAID FOR.
    // Its decoration CONTAINS roster names, so both readings of a bracketed
    // segment resolve: "HIGH LEVEL NORRA PLAY! TestMyLuck(Norra)" and "TOP TIER
    // ZUKO PLAY! Saxophone(ZUKO)". Raw, 4 sides are both-resolve; after the
    // strips, zero. The strips are the fix and the declared order is the
    // backstop, in that order.
    slotOrder: 'handle-outside',
    gateMode: 'title',
    strip: {
      prefix: [/^[^|]*!\s+(?=\S)/, /^[^|]*:\s+(?=\S)/],
      suffix: [/\s*\d{1,2}\.\d{1,2}\.\d{2,4}\s*$/],
    },
    aliases: {
      fighters: {
        // 9 STiLL titles spell Kyoshi 'Kiyoshi' and ZERO spell it correctly; 8
        // records depend on this one line.
        kyoshi: ['Kiyoshi'],
        // Community shorthand for Nightmare Korra; also on rood. The channel's
        // own description spells it 'Nightmare Kora'.
        'nightmare-korra': ['Norra'],
        'avatar-aang': ['A-State Aang'],
      },
    },
    // CHECKLIST 5s. The title states the day the set was PLAYED and the upload
    // lands later — 22 days measured over the 44 marked titles, 23 on the
    // adversarial re-measure (uploaded 2026-09-17, titled 08.25.26). Keyed on
    // publishedAt this channel's whole corpus is misdated AND its August backlog
    // is credited to September, which is one of the two reasons Stage 0's
    // verifier withheld GO on the corpus trend.
    playedOnDateFrom: {
      source: 'title',
      pattern: String.raw`(?<m>\d{1,2})\.(?<d>\d{1,2})\.(?<y>\d{2,4})\s*$`,
      order: 'MDY',
      maxLagDays: 26,
    },
    // POV BIAS, for whoever reads the character usage table: STiLL is one side
    // of 34 of 34 records and always on Katara (the index says Master Pakku on
    // 10 of 10 of its rows). Two handle-identity questions are open and are the
    // roster track's, not this file's: 'ArinKarin'/'ARIN KARIN' and 'NYCHRIS G'
    // against the index's 'NYChrisG'.
  },
  {
    id: 'ndyTv',
    source: 'ndyTv',
    name: 'NdyTV',
    channelId: 'UCJUGKasY-Yp8Z5E6feeaO6Q',
    uploadsPlaylist: uploads('UCJUGKasY-Yp8Z5E6feeaO6Q'),
    // Found by scrape and by search. 3,780 uploads, 57 marked, 34 records; 27
    // marked / 4 parsed on 2026-09-03. Marker density 4.4% — it is a ~96%
    // other-game channel at 43.8 uploads/day.
    //
    // INTAKEN FOR WHAT THE INDEX DOES NOT HAVE, NOT FOR VOLUME. Zero of its 57
    // video ids appear in the catalogue, and the catalogue has no row tagged
    // Moscow Slam, UFA 2026, VC Series or Fighting Frenzy: this is the only
    // source on the platform for four international events (TH Fighting Frenzy
    // #21, MX VC Series #1, RU Moscow Slam 2026, FR UFA 2026).
    //
    // TWO WIDENINGS, AND THEY MUST NOT BE CONFLATED. The MARKER gate stays
    // title-only: 57 title-marked, 57 title-or-description, zero
    // description-only. The CHARACTER tier widens: 33 of 57 marked titles name
    // no fighter, and for 10 of them description LINE 2 carries
    // "<Handle> (<Fighter>) vs <Handle> (<Fighter>)" with BOTH handles equal to
    // the title's. 10 of 10 verified. The handle-equality condition is what
    // keeps it from being a free-text description scrape.
    //
    // THE OTHER 23 STAY OUT. They are one event (Mix Masters Legends #2) and no
    // field anywhere names a fighter — title, description and tags all measured
    // — while the index already holds the identical 23 matches with fighter AND
    // support per side. Forcing them in from the index would be inventing a
    // YouTube record from an index source.
    slotOrder: 'handle-outside',
    gateMode: 'title',
    strip: {
      prefix: [/^\s*[^|—-]{0,60}?\s*[|—-]\s*(?=\S)/u],
      suffix: [/\s*[|—-]\s*(?:Winners|Losers|Grand|Top \d+|Pools)[^|—-]*$/iu],
    },
    aliases: {
      // Verified live in four descriptions (1UFftCLhFeA, acCkZoDH9Ac,
      // cHA3OzaqzBA, OhjH-xXKoWE).
      fighters: { 'nightmare-korra': ['Nightmare Korra'] },
    },
    // CHECKLIST 1b. 3,780 uploads is 76 playlistItems pages plus 76 videos.list
    // calls — about 152 units EVERY DAY, on a key shared with six production
    // crons, to harvest 57 marked uploads. The walk is newest-first, so this
    // floor is a stop condition and the steady-state cost falls to a page or
    // two. Its first marked upload is 2026-07-27, four days after the floor.
    fetchFrom: LAUNCH,
    // Two strip-order hazards measured here, both cheap and both silent if
    // missed: 7 sides carry a team tag inside the handle ("ASG | ScytheLDN",
    // "LS99 | Dai", "HCL | DLZ") and the sponsor strip must run BEFORE any
    // blanket '|'→space, or it mints "ASG ScytheLDN"; and in one grammar the
    // handle's FIRST grapheme is a regional-indicator flag pair, which the
    // reference's decoration glyph class does not cover.
    //
    // ENUMERATION CAVEAT, stated rather than hidden: at 43.8 uploads/day the
    // deep dive's 50-page cap reached only 2026-07-19, so its sweep does not
    // cover 06-25..08-19 on its own. The first run's full 75-page sweep measured
    // the same 57 marked and the same first-marked date, so the gap is closed by
    // agreement between two sweeps, not by assumption.
  },
  {
    id: 'toledoLocals',
    source: 'toledoLocals',
    name: 'Toledo Locals',
    channelId: 'UCxx7SC-mDxpjCsEGA66HN_Q',
    uploadsPlaylist: uploads('UCxx7SC-mDxpjCsEGA66HN_Q'),
    // Found by scrape. 911 uploads, 25 marked, 23 records; 16 marked / 14 parsed
    // on 2026-09-03. A biweekly local's per-match cuts: every title carries a
    // bracket round, none carries an FT token, durations run 145-869s.
    //
    // THE ONLY CHANNEL WITH THE BARE-'AVATAR' GATE, and the only one that may
    // ever have it. 'Avatar Legends' reads 18 of its uploads; the game-slot rule
    // `/\)\s*-\s*Avatar(?![\p{L}\p{N}])/iu` adds 7 more, 28% of the channel. Its
    // safety is measured over all 911 titles: exactly 25 contain 'avatar' at all
    // and all 25 are Avatar Legends match cuts — zero false positives. Widening
    // to descriptions would not help: all 25 marked descriptions are empty.
    // See types/index.ts GateMode for the four live reasons bare 'Avatar' is
    // forbidden everywhere else.
    gateMode: 'titleOrGameSlot',
    slotOrder: 'handle-outside',
    strip: {
      suffix: [/\s*-\s*Avatar(?:\s*Legends)?(?![\p{L}\p{N}])[^()]*$/iu],
    },
    // 3 genuine bracket sets run 145-177s, so a 180s floor — which looks
    // harmless — would drop them. The platform default of 120 is what keeps
    // them; nothing on this channel is under 120.
    //
    // A comma-separated side is a real counter-pick here ("Ozai, Toph"), not a
    // parse failure; it goes to the multi-fighter path, never to review as a
    // grammar miss.
  },
  {
    id: 'arinKarin',
    source: 'arinKarin',
    name: 'ArinKarin',
    channelId: 'UCBBS606LN2hiLRcEuO33hwg',
    uploadsPlaylist: uploads('UCBBS606LN2hiLRcEuO33hwg'),
    // Found by the index's uploader list, by scrape and by search. 201 uploads,
    // 19 marked, 18 records; 19 marked / 18 parsed on 2026-09-03.
    //
    // THE ONLY INTAKE THAT NEEDS NO PER-CHANNEL TITLE RULE AT ALL, which is why
    // it outranks cow at the same size. "GAME - HANDLE (Char) Vs HANDLE (Char)
    // M/D/YY" is the same grammar it uses for thirteen other games, so the
    // marker gate is what does all the work here: 0 of 19 marked descriptions
    // carry the marker and 0 of 66 unmarked recent ones do either, but one of
    // them says "On Avatar launch I would…" on a Melty Blood upload — a live
    // example of why bare 'Avatar' is never a marker.
    //
    // ELEVEN OF ITS 19 MARKED UPLOADS ARE PRE-LAUNCH: 6 from the Feb/Mar 2026
    // closed alpha and 5 from the 2026-07-02..07-07 window the vendor's own
    // pre-order post had promised as launch. Decision 9's floor removes them, so
    // this channel ships 7 records rather than 18 — the single largest deduction
    // between the recon's 367 and the corpus that will actually be committed.
    slotOrder: 'handle-outside',
    gateMode: 'title',
    // The index is a clean second witness here: 12 of 12 of its rows on this
    // channel's videos agree on the fighters (24 of 24 sides) and on 11 of 11
    // recoverable handles. It also supplies supports no title carries.
    //
    // xBEhibYPh-U goes to review as handle-unrecoverable, and the reason is the
    // one checklist 12k names: the opponent's handle is the single codepoint
    // U+2671 ("Vs ♱ (Azula)"). It is a REAL player — the uploader wrote it —
    // and the shared placeholder predicate would delete the row.
    //
    // FREEZE CANDIDATE, not yet: it works in per-game bursts (Avatar Feb-Mar,
    // then Jul-Aug) and was 31 days quiet at recon. Its deep dive did not state
    // a last-marked timestamp precise enough to pin here, so it carries no
    // freezeWatch; the report's per-channel rate is what will catch it.
  },
  {
    id: 'cow',
    source: 'cow',
    name: 'Cow',
    channelId: 'UCRResEeDFgW3tVU397YhYSQ',
    uploadsPlaylist: uploads('UCRResEeDFgW3tVU397YhYSQ'),
    // Found by scrape, by the index's uploader list, and by search. 79 uploads,
    // 21 marked, 18 records; 18 marked / 16 parsed on 2026-09-03.
    //
    // "Handle (Fighter/Support) vs Handle (Fighter/Support) | Avatar Legends
    //  FT20" — 36 of 36 sides handle-outside, 0 both-resolve, 0 registry
    // collisions, and supports named on 16 of its sides. The gate is mandatory:
    // 28 of its 58 non-Avatar uploads are DNF Duel in the EXACT same grammar.
    //
    // THE NAMESPACE SPLIT INSIDE THE BRACKET IS BY MEMBERSHIP, NEVER BY
    // POSITION: 1 of 36 sides writes the support first. That one side is the
    // whole argument for a typed matcher over a split on '/'.
    slotOrder: 'handle-outside',
    gateMode: 'title',
    aliases: {
      supports: {
        'the-boulder': ['Boulder'],
        'imperial-firebender': ['Imperial'],
        'master-pakku': ['Pakku'],
        'princess-yue': ['Yue'],
      },
      fighters: { azula: ['Fire Lord Azula', 'Firelord Azula'] },
    },
    // Its descriptions carry "Recorded on <date>" on 18 of 18, and 6 of its 18
    // records would be dated to the wrong side of the 2026-07-29 or 2026-09-02
    // updates by publish time. That is a measured second consumer for
    // playedOnDateFrom with source 'description' — deliberately NOT wired here,
    // because reading a date out of a description is the parse track's call and
    // widening the DATE source is not widening the gate.
    //
    // elzK54_KEys is a Beta 2 recording (2026-07-05) and falls to the launch
    // floor: 17 records ship, not 18.
  },
  {
    id: 'saltyRecoveryCenter',
    source: 'saltyRecoveryCenter',
    name: 'Salty Recovery Center FGC',
    channelId: 'UCMBn-vvFgf57F0Z_LKomD9A',
    uploadsPlaylist: uploads('UCMBn-vvFgf57F0Z_LKomD9A'),
    // Found by scrape and by search. 212 uploads, 20 marked, 17 records; 20
    // marked / 17 parsed on 2026-09-03 — its whole corpus predates the build
    // window.
    //
    // "Avatar Legends | Mattchu (Toph) vs Batmanity (Kyoshi) | Winners Semis |
    //  8/09/26" — 19 of 19 titles handle-outside on both sides, 0 both-resolve.
    // Per-match cuts of a local, 201-659s, every one carrying a bracket round.
    //
    // The marker gate is title-only and the measurement that settles it is a
    // good one: its GGST Top 8 description carries the handle "Retro_Avatar
    // (Ky)", so a description gate widened to bare 'Avatar' would ingest a
    // Guilty Gear VOD as an Avatar record.
    slotOrder: 'handle-outside',
    gateMode: 'title',
    strip: {
      prefix: [/^\s*Avatar\s*Legends\s*\|\s*/i],
      suffix: [/\s*\|[^|]*\|\s*\d{1,2}\/\d{1,2}\/\d{2,4}\s*$/],
    },
    // CHANNEL-SCOPED PAIR CODES, and the scoping is the point. Two of its 17
    // records write both fighters as a code list filling the whole bracket
    // ("(KO/OZ)", "(ZU/ZA)") — the first two letters of the name, the same
    // convention this channel uses on its SF6 (CH/ED, JA/CA) and GGST (LU/MI,
    // SO/JO) titles. As bare aliases these would be catastrophic: 'KO' is the
    // most common two-letter token in fighting-game titles there is. Only codes
    // actually observed are listed.
    pairCodes: { KO: 'korra', OZ: 'ozai', ZU: 'zuko', ZA: 'zaheer' },
    // TRAJECTORY: three events produced Avatar footage (07-26 eleven cuts,
    // 08-09 eight, 08-23 one chaptered VOD) and the 09-06 event produced GGST
    // and SF6 Top 8 VODs and no Avatar upload. Freeze candidate on trajectory;
    // no last-marked timestamp precise enough to pin a freezeWatch.
  },
  {
    id: 'skeet',
    source: 'skeet',
    name: 'Skeet',
    channelId: 'UC6PWTtrbZIDrl1Ib3C8Npsw',
    uploadsPlaylist: uploads('UC6PWTtrbZIDrl1Ib3C8Npsw'),
    // Found by scrape and by search. 138 uploads, 22 marked, 16 records; 20
    // marked / 16 parsed on 2026-09-03. Thirteen of the 22 landed in one week —
    // the CEO 2026 batch — so its 0.61/day since-first rate is an event, not a
    // cadence.
    //
    // Two strips are mandatory and one is worth the money:
    //  · the trailing played-on date. Without it 5 records mint
    //    date-contaminated handles ("Son-Dula 8/11/26"). NOTE this is a STRIP,
    //    not a playedOnDateFrom: nothing measured a publish lag on this channel,
    //    and reading a date as the record's date without measuring the lag is
    //    how a corpus gets silently re-dated.
    //  · the CEO event/round prefix, which recovers 10 pool sets. The captured
    //    text is the EVENT and is carried to Replay.event (checklist 12j):
    //    "CEO 2026 R2 Pools Losers R4".
    //  · a ' - ' separator fallback where there is no vs (1 record).
    //
    // Its shortest genuine sets are CEO pool cuts at 177s and 179s, which a 180s
    // floor would drop. Nothing is under 120.
    slotOrder: 'handle-outside',
    gateMode: 'title',
    strip: {
      prefix: [
        /^\s*@\s*[^@]*?\s(?:19|20)\d\d\s+(?:(?:R\d+\s+)?Pools\s+|Top\s*\d+\s+)?(?:Winners|Losers|Grand)\s+(?:R(?:ound)?\s*\d+|Quarter Final|Semi Final|Final)\s+/i,
      ],
      suffix: [/\s+\d{1,2}[./]\d{1,2}[./](?:\d{4}|\d{2})\s*$/],
    },
    aliases: {
      fighters: { kyoshi: ['Kiyoshi'] },
      supports: { 'princess-yue': ['Yue'] },
    },
    // Two sides write a SLASH inside the fighter bracket — two fighters played
    // in one set, a real counter-pick — and two write the fighter and support
    // space-joined ("Sokka Suki", "Sokka Yue"). The second shape is exactly why
    // the support matcher has to be typed: a split on whitespace makes 'Suki' a
    // second fighter, and a fighters-only registry guard passes it silently
    // because 'Suki' resolves to no fighter.
  },
  {
    id: 'unrivaledTournaments',
    source: 'unrivaledTournaments',
    name: 'Unrivaled Tournaments',
    channelId: 'UCvcLcxEPvxqhyryQM9eGsZg',
    uploadsPlaylist: uploads('UCvcLcxEPvxqhyryQM9eGsZg'),
    // Found by scrape and by search. 12,975 uploads, 15 marked, 14 records; ZERO
    // on 2026-09-03 — its whole corpus is one batch of 15 uploads on 2026-09-12
    // from FGC Meetups 129.
    //
    // ONE GAME PER EVENT ON THIS CHANNEL, which is what its rate means: 129
    // Avatar 15, 128 Tekken 17, 127 Marvel Tōkon 14, 126 Tekken 17, 124 SF6 18,
    // 119 2XKO 15. Expect sporadic batches of ~15 when Avatar rotates in and
    // weeks at zero between them; do not read its trailing rates as a cadence.
    //
    // Without the two strips below the reference's handle picker is handed
    // "Akuadynasty - FGC Meetups 129 GRAND FINALS - Avatar Legends" — six words,
    // refused by MAX_HANDLE_WORDS, so 0 of 15 parse. It fails SAFE (no wrong
    // player is minted) but the channel is silently empty, which is the failure
    // mode this file exists to prevent.
    slotOrder: 'handle-outside',
    gateMode: 'title',
    strip: {
      suffix: [/\s*-\s*Avatar\s*Legends\s*$/i, /\)\s*-\s*[^()]*$/],
    },
    // CHECKLIST 1b: 12,975 uploads is 260 playlistItems pages plus 260
    // videos.list calls — about 520 units a day for 14 records.
    fetchFrom: LAUNCH,
  },
  {
    id: 'normalMs',
    source: 'normalMs',
    name: 'NORMAL MS',
    channelId: 'UCgglKe1F_c7L3BKGqqf0WXA',
    uploadsPlaylist: uploads('UCgglKe1F_c7L3BKGqqf0WXA'),
    // Found by search. 455 uploads, 17 marked, 14 records; 15 marked / 12 parsed
    // on 2026-09-03. Post-launch it is 9 records in 56 days.
    //
    // THE ONLY TITLE CHANNEL THAT STATES THE SUPPORT SLOT, which is the whole
    // reason it is worth its rules: "Avatar Legends: The Fighting Game_
    // NORMAL-MS (Aang/Appa) vs Handle (Kyoshi/Rangi)". The second span after '/'
    // is ALWAYS the support, even when it is a fighter name — the Katara case,
    // live in index row 482155 — so it is typed by ROLE and never by position.
    //
    // Seven spellings of the marker prefix and a grammar change at launch; the
    // uploader is on every record, which skews usage toward NORMAL-MS and Aang.
    //
    // THE DURATION FLOOR IS LIVE ON THIS CHANNEL AND NOWHERE ELSE. Its marked
    // durations have a gap between 96s and 358s, and the only two under 120 are
    // pre-launch BETA clips of 94s and 96s. The launch floor removes them
    // anyway, so the effect is belt-and-braces; it is still the one place the
    // platform default is not inert.
    //
    // Eight of its marked uploads are pre-order BETA, five of them parseable, so
    // decision 9's floor ships 9 records here rather than 14.
    slotOrder: 'handle-outside',
    gateMode: 'title',
    strip: {
      prefix: [/^\s*Avatar\s*Legends\s*:?\s*(?:The\s*Fighting\s*Game)?[_\s-]*(?:BETA\s*)?/i],
    },
  },
  {
    id: 'rood',
    source: 'rood',
    name: 'Rood',
    channelId: 'UCtgkqgYejlIgq8kjXObUE1w',
    uploadsPlaylist: uploads('UCtgkqgYejlIgq8kjXObUE1w'),
    // Found by scrape and by search. 2,334 uploads, 17 marked, 14 records; 13
    // marked / 11 parsed on 2026-09-03. Avatar is 17 of 2,334, sharing one title
    // grammar with Melty Blood, SF6, Fatal Fury, GBVSR, 2XKO and GGST.
    //
    // THE MARKER GATE IS LOAD-BEARING IN BOTH DIRECTIONS HERE: bare 'Avatar'
    // appears in three of its own titles as Granblue's "Avatar Belial", and the
    // support name 'Mai' appears in fourteen as Mai Shiranui. Neither can be
    // allowed to reach a matcher on an ungated title.
    //
    // Two grammar eras — a bracketed one and a bare 2026-08-13 batch — which one
    // resolver covers, because the bare path takes the uncovered gap as the
    // handle. Without the marker cut the 5-word gap "Avatar Legends The Fighting
    // Game" outranks the real handle and passes MAX_HANDLE_WORDS: measured, 6
    // records minted with that string as the player.
    slotOrder: 'handle-outside',
    gateMode: 'title',
    strip: {
      suffix: [/\s*-\s*(?:LATAM SERIES #\d+\s*-\s*)?Avatar\s*Legends\s+The\s+Fighting\s+Game\s*$/i],
    },
    aliases: {
      fighters: {
        // UNVERIFIED, AND SAID SO IN THE CONFIG RATHER THAN IN A NOTE NOBODY
        // READS. 'Ozain' appears on 2 titles, both in the fighter position of
        // the bare grammar, and 2 of this channel's 14 records depend on it. It
        // was never checked against the footage (y779fYSC6sM, Kd1O19bWrgE). If
        // it turns out to be a different character the two records are wrong,
        // not missing — which is the worse failure — so confirm it before the
        // first publish or drop the line and lose 2 records.
        ozai: ['Ozain'],
        'nightmare-korra': ['Norra'],
      },
    },
    // CHECKLIST 1b: 2,334 uploads is about 94 units a day for 14 records.
    fetchFrom: LAUNCH,
    // 'Grappler' appears once as an unresolved support-position token and is in
    // no index row. It is NOT in the support registry and must not be added
    // without footage: a support nobody has verified is a support nobody should
    // be able to parse into a record.
  },
  {
    id: 'an11Mo',
    source: 'an11Mo',
    name: 'An11-_-MO',
    channelId: 'UC5gT0-XhA0BzkF6biMfLFtQ',
    uploadsPlaylist: uploads('UC5gT0-XhA0BzkF6biMfLFtQ'),
    // Found by the index's uploader list, by scrape and by search. 25 uploads,
    // 13 marked, 13 records; 6 marked / 6 parsed on 2026-09-03 — it doubled
    // during the recon window and is the fastest-growing small channel here.
    //
    // "Avatar Legends | Handle (Fighter/Support) Vs. Handle (Fighter/Support)
    //  FT10" — 26 of 26 sides handle-outside, 13 of 13 parse, supports on
    // twelve distinct names. The gate is mandatory: 12 of its 25 uploads are
    // Hyper DBZ and 6 of those are vs-plus-bracket shaped.
    //
    // The trailing FTn must come off BEFORE the outside text becomes the handle,
    // including when it is glued to the closing paren, or the handle reads
    // "HexaNoid FT10".
    //
    // NEVER TAKE SIDE ATTRIBUTION FROM TITLE ORDER HERE: the uploader always
    // writes himself first and the index's order differs on 7 of 12 shared rows.
    slotOrder: 'handle-outside',
    gateMode: 'title',
    strip: {
      prefix: [/^\s*Avatar\s*Legends\s*\|\s*/i],
      suffix: [/\)?\s*FT\s*\d+\s*$/i],
    },
    aliases: {
      supports: {
        'the-hippo': ['Hippo'],
        'firelord-sozin': ['Sozin'],
        // '&' is not in the matcher's flexible-punctuation class, so this one
        // needs to be explicit where 'Ming Hua' → 'Ming-Hua' does not.
        'ran-and-shaw': ['Ran & Shaw'],
        'the-boulder': ['Boulder'],
      },
    },
    // FREEZE WATCH WITH A REASON, not a guess: the 2026-09-16 description says
    // "I probably won't be able to play/upload for a while cuz I hurt my wrist".
    // The collapse guard is inert at 13 records, so the pin is the protection.
    //
    // Registry near-miss worth keeping: the handle 'TwinkleToes' plays Aang, and
    // Twinkle Toes is Toph's nickname for Aang in the show. Do NOT add it as a
    // Toph alias without first adding this player to the confirmed list.
  },
  {
    id: 'natsuXenoblade',
    source: 'natsuXenoblade',
    name: 'Natsu_Xenoblade',
    channelId: 'UCgMNG7quGsN_7KfVOEPFCKA',
    uploadsPlaylist: uploads('UCgMNG7quGsN_7KfVOEPFCKA'),
    // Found by scrape. 174 uploads, 15 marked, 10 records; 15 marked / 10 parsed
    // on 2026-09-03 — nothing since 2026-08-07, while the channel keeps
    // uploading Marvel Tōkon at 0.357/day.
    //
    // "Natsu (Zuko [Mai]) vs Handle (Korra [Naga]) : Set 1" — THE SQUARE-BRACKET
    // SUPPORT SLOT, and the reason this channel is worth intaking at 10 records:
    // it is the cleanest statement of the two namespaces in the whole corpus,
    // 22 of 22 sides unambiguous.
    //
    // IT IS ALSO WHERE THE PORTED BRACKET REGEX BREAKS, VERIFIED IN SESSION. The
    // reference's BRACKET pattern (ggst parse.ts:313) has one character
    // namespace and its round alternative's `[^()]` class eats square brackets,
    // so "Natsu (Zuko [Mai])" hands the matcher the string "Zuko [Mai]" as one
    // group. Today that is harmless because a fighters-only roster cannot read
    // 'Mai' — but the moment anyone puts all 48 names in one table,
    // ids("Zuko [Mai]") returns TWO ids and the side is filed as a two-fighter
    // counter-pick, silently, with every count green. And the collision case is
    // live: ids("Avatar Aang [Katara]") would mint Katara as a fighter on the
    // opponent's slot. Split the square bracket BEFORE resolution and assert it.
    slotOrder: 'handle-outside',
    gateMode: 'title',
    strip: {
      prefix: [
        /^\s*(?:\[VOD\]\s*)?Avatar\s*Legends(?:\s*:?\s*The\s*Fighting\s*Game)?\s*(?:Beta\s*)?(?:Long\s*Set|Matches|Match)?\s*[-:]\s*/i,
      ],
      suffix: [/\s*:\s*Set\s*\d+\s*$/i],
    },
    aliases: {
      supports: { 'the-boulder': ['The Boulder'] },
    },
    freezeWatch: { lastMarked: '2026-08-07', recordsAtRecon: 10, reviewAfterDays: 90 },
    // Its post-launch grammar appeared only two uploads in, which reads as a
    // format the uploader means to keep — so this is a watch, not a freeze. Its
    // 4727s bracket VOD is a real set series and must NOT be cut by a ceiling.
  },
  {
    id: 'takeANappa',
    source: 'takeANappa',
    name: 'Take A Nappa',
    channelId: 'UCU5YEybMjja6f8mApqmBRtg',
    uploadsPlaylist: uploads('UCU5YEybMjja6f8mApqmBRtg'),
    // Found by search. 198 uploads, 16 marked under the full gate, 9 records; 12
    // marked / 8 parsed on 2026-09-03. Still publishing (last upload 09-15).
    //
    // THE ONLY CHANNEL THAT NEEDS BOTH A DESCRIPTION GATE AND A STRUCTURAL ONE,
    // and the ladder was measured rather than assumed: title-strict 10 marked /
    // 5 parsed, title raw 11/5, title|description 14/7, title|description|tags
    // 14/7 (tags add nothing), title|description|pair 16/9. Its newest set and
    // one other carry no marker in title, description OR tags; the pair rule —
    // a vs token plus two fighter spans plus at least one SUPPORT span — is what
    // recovers them. That rule hits 0 of schoolBus's 304 titles and 0 of either
    // channel's DNF Duel, 2XKO, Invincible VS, Elsword or GGST uploads.
    //
    // DECLARED 'chars-outside' AND NEVER 'handle-outside'. 14 of its 18
    // bracketed sides are fighter-outside, and the reference's parseSide returns
    // no-char on a handle-outside channel whose outside resolves: measured,
    // declaring handle-outside drops this channel from 9 records to 2. The
    // reference's own type comment says the field is "only recorded" away from
    // the tie-break; the code disagrees and the code wins.
    gateMode: 'titleOrDescription',
    extraGate: 'fighterSupportPair',
    slotOrder: 'chars-outside',
    strip: {
      suffix: [
        /\s*\[Avatar\s*Legends\]\s*HIGH\s*LEVEL\s*(?:MATCHES|MATCH|AVATAR\s*LEGENDS|[A-Za-z' -]+MIRROR)\s*$/i,
      ],
    },
    aliases: {
      supports: {
        'firelord-sozin': ['Sozin'],
        'the-boulder': ['Boulder'],
        "p'li": ['Pi li'],
      },
    },
    // Without the support namespace, 'Sozin' is extracted as a PLAYER on two
    // videos. A fighters-only registry guard passes that silently, which is
    // checklist 5n's blind spot and the reason the guard must cover both
    // namespaces.
    //
    // POV bias: GrayCapedHero is side 2 on 9 of 9 records and Ozai appears on 10
    // of 18 sides. 'xcaliburbladez' here and 'XCaliburBladez' on schoolBus are
    // one player; 'Gonemad' in one title is 'GONEPRO' in its own description and
    // is NOT merged.
  },
  {
    id: 'versusFestival',
    source: 'versusFestival',
    name: 'The Versus Festival',
    channelId: 'UCjLKI7siUJ3VTqnk-C3hhsA',
    uploadsPlaylist: uploads('UCjLKI7siUJ3VTqnk-C3hhsA'),
    // Found by scrape and by search. 406 uploads, 8 marked, 8 records; 7 parsed
    // on 2026-09-03 (the 8th is bounded to within a few hours of the cutoff and
    // is 7 or 8 — stated rather than rounded). A multi-game South-India TO,
    // event-driven in bursts of 3-5.
    //
    // THE EVENT DECORATION MUST COME OFF BEFORE THE VS SPLIT, because the event
    // brand is literally "Versus Experience" and collides with the vs pattern.
    // The stripped text is the event and is carried to Replay.event: "Versus
    // Experience: TE", "Versus Experience Mumbai 2026".
    //
    // 100% of its orientation signal depends on the short roster aliases: with
    // the handoff's display names alone ("Avatar Kyoshi", "Toph Beifong") 12 of
    // its 16 sides resolve to nothing. Those aliases are roster-wide, not
    // channel-scoped, and belong in data/characters.json.
    slotOrder: 'handle-outside',
    gateMode: 'title',
    strip: {
      prefix: [/^\s*(?:GRAND FINALS\s*[-–|]\s*)?Versus\s+Experience[^|]*[|:]\s*/i],
    },
    // Its floor is worth one line: the shortest marked upload is 277s, but the
    // channel posts 13-117s promos of other games, so the platform floor is a
    // live guard here even though it removes nothing today.
  },
  {
    id: 'avianZebra',
    source: 'avianZebra',
    name: 'Avian Zebra',
    channelId: 'UCuhD4AxXhrZXZEl3hY9I3wQ',
    uploadsPlaylist: uploads('UCuhD4AxXhrZXZEl3hY9I3wQ'),
    // Found by the index's uploader list, by scrape and by search. 41 uploads,
    // 9 marked, 8 records; 8 marked / 7 parsed on 2026-09-03.
    //
    // Small, clean and slowing: since Ranked Mode shipped (2026-09-02) the
    // uploader has posted 5 multi-set compilations against 1 marked set, so
    // expect marked volume to keep falling. The compilations are chapter-
    // timestamped 43-65 minute videos and are correctly not record-shaped.
    //
    // The bracket reads first-span-is-the-fighter, later spans are supports —
    // and a support span whose name is also a fighter name goes to review rather
    // than being resolved either way.
    slotOrder: 'handle-outside',
    gateMode: 'title',
    strip: {
      suffix: [/\s*FT\s*\d+(?:\s*\+\s*\d+)?\s*$/i],
    },
    aliases: {
      supports: { gyatso: ['Gyatt'], 'the-boulder': ['Boulder'] },
      handles: { 'Avian Zebra': 'AvianZebra' },
    },
    // The index holds 2 of its 9 videos with offsets of 10s and 25s — intro
    // skips, not segments, which is exactly the case ChannelIndex
    // .segmentOffsetMinShare exists to classify. Its links are also malformed
    // (`youtu.be/<id>&t=`), so a URL parser keyed on searchParams misses the
    // offset entirely.
  },
  {
    id: 'kmlTournaments',
    source: 'kmlTournaments',
    name: 'KML Tournaments',
    channelId: 'UCAjmpP7UAxdDGqXeg3bQqXg',
    uploadsPlaylist: uploads('UCAjmpP7UAxdDGqXeg3bQqXg'),
    // Found by scrape and by search. 11,605 uploads, 7 marked, 7 records; ZERO
    // on 2026-09-03 — its whole Avatar corpus is one side bracket (KMLocal 73)
    // uploaded 2026-09-07, with no Avatar upload for KMLocal 71, 72 or 74.
    //
    // THE ONLY CHANNEL WHOSE MARKER IS THE ACRONYM. "KMLocal 73: Winners Round 2
    //  - Handle (Toph) vs Handle (Kyoshi) ALTFG". Checklist 3b: `\bALTFG\b` is
    // the wrong boundary because the neighbours can be alphanumeric — the
    // lookaround form is what matches inside a token like a challonge slug — and
    // the gate is mandatory here because the channel's own history carries 10
    // NASB2 titles naming Korra and Azula, one of which parses cleanly without
    // it.
    //
    // Without the two strips, 0 of 7 parse; with them, 7 of 7 from one template
    // with no typos and no handle variants.
    slotOrder: 'handle-outside',
    gateMode: 'title',
    strip: {
      prefix: [/^\s*[^:]{1,40}:\s*[^-]{1,40}-\s*/],
      suffix: [/\s*ALTFG\s*$/i],
    },
    // CHECKLIST 1b, AND THIS IS THE CHANNEL THAT MEASURED IT: 11,605 uploads is
    // 233 playlistItems pages plus 233 videos.list calls — about 466 units per
    // daily run for 7 records, on a key that hit quotaExceeded during the recon.
    fetchFrom: LAUNCH,
  },
  {
    id: 'teo1029',
    source: 'teo1029',
    name: 'teo1029',
    channelId: 'UCwxY0pVBx7Wqi-5tch9t1Lg',
    uploadsPlaylist: uploads('UCwxY0pVBx7Wqi-5tch9t1Lg'),
    // Found by the index's uploader list, by scrape and by search. 12 uploads,
    // 8 marked, 7 records; 7 marked / 6 parsed on 2026-09-03. Still active.
    //
    // "Avatar Legends FT10 | teo1029 (Ozai - Sozin) vs Handle (Kyoshi/Kelsang)
    //  | FT10" — a support after '/', ' - ' or ' -', extracted by the support
    // matcher and never counted as a fighter. Needs the short spellings Sozin,
    // Twins (= Lo and Li) and Hippo beside the index's canonical names.
    //
    // NEVER ASSIGN THE HUD SIDE FROM TITLE ORDER. The uploader titles himself
    // first on 7 of 7, and index row 484973 lists the reverse for wx8p38AIHXg
    // while row 496296 agrees for CYR9YnnIZ-c — so a positional read is wrong on
    // at least one of the two witnessed records.
    slotOrder: 'handle-outside',
    gateMode: 'title',
    strip: {
      prefix: [/^\s*Avatar\s*Legends(?:\s*FT\s*\d+)?\s*\|\s*/i],
      suffix: [/\s*\|\s*FT\s*\d+\s*$/i],
    },
    aliases: {
      supports: {
        'firelord-sozin': ['Sozin', 'Fire Lord Sozin'],
        'lo-and-li': ['Twins'],
        'the-hippo': ['Hippo'],
      },
    },
    // POV bias: teo1029 is one side of 7 of 7, always Ozai.
  },
  {
    id: 'mysteryRacer21',
    source: 'mysteryRacer21',
    name: 'MysteryRacer21',
    channelId: 'UCKgIAJHQf4fBzvgt3p0WdNw',
    uploadsPlaylist: uploads('UCKgIAJHQf4fBzvgt3p0WdNw'),
    // Found by search. 312 uploads, 6 marked, 6 records; all 6 present on
    // 2026-09-03. One clean grammar, 12 of 12 sides handle-outside, zero
    // per-channel rules — which is what puts it above xcaliburBladez at the same
    // size.
    //
    // All 6 records are UNIQUE: none of its videos is in the index, and none of
    // its 7 handles appears in any index row.
    //
    // Six uploads in six days (2026-08-03..08-09) and then nothing, on a channel
    // whose prior history had a 3.4-year gap. The first description promised
    // more; it has not happened.
    slotOrder: 'handle-outside',
    gateMode: 'title',
    freezeWatch: { lastMarked: '2026-08-09', recordsAtRecon: 6, reviewAfterDays: 90 },
  },
  {
    id: 'xcaliburBladez',
    source: 'xcaliburBladez',
    name: 'XCalibur BladeZ',
    channelId: 'UCkWNnDEr_UkDAERh-SuLchQ',
    uploadsPlaylist: uploads('UCkWNnDEr_UkDAERh-SuLchQ'),
    // Found by scrape and by search. 182 uploads, 6 marked, 6 records; all 6
    // present on 2026-09-03. Long money-match sets, 24-45 minutes.
    //
    // Without the prefix strip, 3 handles are wrong and 3 records are lost.
    //
    // Three spellings of the owner's own handle (XCali / XCaliburBladez /
    // XCaliburbladez, against the index's 'xcaliburbladez'), and three cross-
    // source opponent spellings that are unconfirmed redirect candidates:
    // 'ScytheLDN' vs index 'Scythe', 'TheZiadGuy' vs 'Ziad', 'BarBarXII' vs
    // 'bar_barXII' (which slug differently). That is the roster track's call,
    // recorded here because this channel is where it was measured.
    slotOrder: 'handle-outside',
    gateMode: 'title',
    strip: {
      prefix: [/^\s*Avatar\s*Legends\s*(?:FT\s*\d+\s*)?(?:High\s?Level\s*Set\s*)?/i],
    },
    aliases: { fighters: { kyoshi: ['Kiyoshi'] } },
    freezeWatch: { lastMarked: '2026-08-23', recordsAtRecon: 6, reviewAfterDays: 90 },
    // It historically hops games (DOA, BBCF, GGST, Tekken) and posted a Dead or
    // Alive 6 upload on 2026-09-10 with no Avatar since 08-23. Freeze rather
    // than prune if that continues.
  },
  {
    id: 'schoolBus',
    source: 'schoolBus',
    name: 'SchoolBus',
    channelId: 'UC87BEPdfhs4x029YLnC2MTw',
    uploadsPlaylist: uploads('UC87BEPdfhs4x029YLnC2MTw'),
    // Found by scrape and by search. 304 uploads, 9 marked, 5 records; 9 marked
    // / 5 parsed on 2026-09-03. Multi-game with the identical
    // "[Game] handle (char) vs handle (char)" grammar for DaemonBride, Fatal
    // Fury CotW, UNI2, GGST, MBTL, Idol Showdown and Elsword, so the gate is
    // mandatory. The marker is always the literal "[Avatar Legends]"; a tags
    // gate would reach only 8 of 9.
    //
    // THE ONLY CHANNEL THAT FLIPS ORIENTATION INSIDE ITS OWN HISTORY: 7 sides
    // fighter-outside, 5 handle-outside, one title flipped between its own two
    // sides, and its newest two titles are handle-outside. So it declares a
    // value that CANNOT break a tie — 'handle-first-bare' returns ambiguous to
    // the review queue — rather than one that guesses. Declaring 'handle-outside'
    // here costs 3 of its 5 records to the reference's no-char branch; declaring
    // 'chars-outside' or nothing gives 5.
    slotOrder: 'handle-first-bare',
    gateMode: 'title',
    strip: {
      prefix: [/^\s*\[Avatar\s*Legends\]\s*/i, /^\s*HIGH\s*LEVEL\s*/i, /^\s*FT\s*\d+\s*/i],
      suffix: [/\s*HIGH\s*LEVEL\s*PLAY\s*$/i, /\s*FT\s*10\s*\.*\s*ish\s*$/i],
    },
    // xD9XubfCCG0 goes to review: its token 'Azula-Lord' resolves to the fighter
    // azula if taken whole as a handle — a registry hazard rather than a record.
    //
    // Two of its marked uploads are 2026-07-04/07-05 and fall to the launch
    // floor. The channel hops games and its own earlier Avatar gap was 30 days,
    // so the deep dive pre-registers a freeze at about 45 days of silence rather
    // than the 90 used elsewhere.
  },
  {
    id: 'superSalemFighters',
    source: 'superSalemFighters',
    name: 'Super Salem Fighters',
    channelId: 'UCmYwKQz0drEzFoL77Oq0D6g',
    uploadsPlaylist: uploads('UCmYwKQz0drEzFoL77Oq0D6g'),
    // Found ONLY by the missed-channel sweep, by scraping a search result page
    // for "Nightmare Korra vs Azula Avatar Legends" — the first workflow's
    // 157-channel discovery pass never saw it. 9,759 uploads, 4 marked, 4
    // records, all from one event on 2026-09-12; ZERO on 2026-09-03.
    //
    // "[09/12/26] #AvatarLegends GF: Wynter (Azula) VS ReverendBaka (Nightmare
    //  Korra)" — 4 of 4 parse with full handles and fighters, zero misses, zero
    // registry collisions. A weekly Oregon TO, so it should grow.
    //
    // THE MARKER LIVES ONLY INSIDE A HASHTAG, which is checklist 3b in its
    // sharpest form. The gate must run BEFORE the hashtag strip, and the tag is
    // currently mid-title so the trailing-run strip does not reach it. If this
    // uploader ever moves it to the end the channel silently drops to zero
    // marked — so the gate control must assert markedTitle > 0 for any window in
    // which this channel published.
    //
    // Its tags are Smash-era ('Salem Smashfests', 'Smash', 'Guilty Gear') with
    // no Avatar tag at all, so a tags gate reads zero here: one more measurement
    // against GateMode 'titleOrTags'.
    slotOrder: 'handle-outside',
    gateMode: 'title',
    strip: {
      // The pipe form is live on this channel's other games and would otherwise
      // leak an event code into side 1.
      prefix: [
        /^\s*\[\d{1,2}\/\d{1,2}\/\d{2,4}(?:\|[^\]]*)?\]\s*/,
        /^\s*#AvatarLegends\s*/i,
        /^\s*(?:WF|LF|GF|LSF|WSF|LQF|WQF)\s*:\s*/,
      ],
    },
    // Keep the round abbreviations OUT of the general decoration vocabulary
    // beyond this prefix, so a player literally called 'GF' is not deleted.
    // Sponsor prefixes are stripped repeatedly and never split: 'SSF|
    // HoldBackToBark' is one player, not two.
    //
    // CHECKLIST 1b: 9,759 uploads is about 392 units a day for 4 records.
    fetchFrom: LAUNCH,
  },
  {
    id: 'redVsFantasy',
    source: 'redVsFantasy',
    name: 'REDvsFantasy',
    channelId: 'UC2CJ0kMhKiDKTL9r7TFUCFw',
    uploadsPlaylist: uploads('UC2CJ0kMhKiDKTL9r7TFUCFw'),
    // Found by search. 506 uploads, 12 marked, 4 records; 6 marked / 2 parsed on
    // 2026-09-03. A low and honest yield — 4 of 12 — taken because the 4 are
    // high-value: named humans on both sides, one of them a tournament grand
    // final, 12-52 minutes.
    //
    // THE HASHTAG-RUN STRIP IS LOAD-BEARING HERE AND IT IS THE ONLY CHANNEL
    // WHERE IT REMOVES ANYTHING: 12 marked with the strip, 14 without. The two
    // it removes are 67s and 19s Shorts whose only marker is a trailing
    // '#avatarlegendsthefightinggame' — the reference's argument that a marker
    // in a hashtag run is decoration rather than a statement of the game,
    // reproduced exactly.
    //
    // THIS CHANNEL DISQUALIFIES THE TAGS GATE PLATFORM-WIDE. All 13 of its
    // Avatar uploads carry one 54-tag boilerplate block that also contains
    // 'ggstrive', 'guilty gear strive', 'mbtl', 'melty blood', 'sfv', 'street
    // fighter v', 'tekken' and 'project L'. A tags gate on any SIBLING repo
    // would ingest these Avatar sets as that game's records, silently.
    //
    // The clickbait prefix is what makes the sides honest: without it,
    // "TOP TIER Kyoshi Player nobody knows... Click (Kyoshi)" reads as a
    // both-resolve side, and BOTH readings are wrong — handle-outside yields the
    // 5-word handle "Kyoshi Player nobody knows... Click" (MAX_HANDLE_WORDS does
    // not save it) and chars-outside mints the player "Kyoshi" outright.
    slotOrder: 'handle-outside',
    gateMode: 'title',
    strip: {
      prefix: [/^[^()]*?(?:\.\.\.\.|\.\.\.|!!!|\?!)\s*(?=[^()]*\()/],
      suffix: [
        /\s*---\s*[A-Za-z0-9 ]+\s*(?:19|20)\d\d\s*$/,
        /\s*(?:Grand |Winners |Losers )?Finals!*\s*$/i,
        /\s*(?:FT\s*\d+|First to \d+)\s*$/i,
      ],
    },
    // Identity, recorded not resolved: the index writes 'STILL' where the title
    // writes 'STiLL' (a case fold merges them) but 'CWang RED' where the title
    // writes 'RED' — two player ids for one person unless a confirmed alias is
    // declared. Roster track's call.
  },
  {
    id: 'mikeyChiFgc',
    source: 'mikeyChiFgc',
    name: 'Mikey',
    channelId: 'UCE_xj_AEgjliTLSiPyeg8HQ',
    uploadsPlaylist: uploads('UCE_xj_AEgjliTLSiPyeg8HQ'),
    // Found by search. 21 uploads, 3 marked, 3 records; all 3 present on
    // 2026-09-03. Small, dormant 22 days at recon — and the CLEANEST GRAMMAR
    // MEASURED ON THIS GAME: 3 of 3 parse with a fighter and a support on every
    // side, which is why it leads the three-record tier.
    //
    // The suffix strip is mandatory: without it 1 of 3 is filed wrong and 2 of 3
    // lose a handle. It must not cross a vs.
    //
    // All 3 are PREMIERES. Gate liveness on liveBroadcastContent and never on
    // the presence of liveStreamingDetails, or this channel and kang both
    // disappear entirely.
    slotOrder: 'handle-outside',
    gateMode: 'title',
    strip: {
      suffix: [/\s*[-–—|:.]*\s*Avatar\s*Legends(?:\s*:?\s*The\s*Fighting\s*Game)?\s*$/i],
    },
    // Inside the paren the fighter is the roster span and the support is the '/'
    // remainder, resolved against the support table and never as a fighter. If
    // the remainder resolves as a fighter it goes to review as a namespace
    // overlap — that is the Katara case, and the index proves it happens.
  },
  {
    id: 'kang',
    source: 'kang',
    name: 'KANG',
    channelId: 'UCYcCrSJxbwJxiG9jKGd6gBQ',
    uploadsPlaylist: uploads('UCYcCrSJxbwJxiG9jKGd6gBQ'),
    // Found by scrape. 3 uploads, 3 marked, 3 records; all 3 present on
    // 2026-09-03. The channel's entire output is these three sets.
    //
    // "[Avatar Legends] KANG (Nightmare Korra/Vaatu) vs Handle (Katara/Hakoda)
    //  FT10" — 6 of 6 sides handle-outside, the bracket always resolving to
    // exactly one fighter plus one support.
    //
    // WITHOUT A TYPED SUPPORT MATCHER THIS CHANNEL DEMONSTRATES BOTH FAILURES AT
    // ONCE, measured: the reference as-is parses 6 of 6 sides and silently drops
    // all four support names into the residue report every run, while a union
    // matcher that treats supports as fighter aliases makes every side a pair
    // (nightmare-korra + Vaatu, katara + Hakoda) and corrupts characterUsage.
    //
    // 'Hakoda' is NOT in the index's vocabulary and is presumably Katara's third
    // support. It stays out of the registry until it is verified — see
    // types/index.ts SupportRecord.
    slotOrder: 'handle-outside',
    gateMode: 'title',
    strip: {
      prefix: [/^\s*\[Avatar\s*Legends\]\s*/i],
      suffix: [/\s*FT\s*\d+\s*!*\s*$/i],
    },
    // 'Loading...' is a real handle here and cleans to the player id 'loading'.
    // The handle 'The Painted Lady' resolves to nothing today and is an
    // Avatar-franchise name to watch if a support or skin of that name ships.
    //
    // Three records in 34 days and nothing in the 27 days before recon. At this
    // size the collapse guard is asleep and the freeze pin is the only
    // protection; its deep dive names 60 days of silence as the review point.
  },
  {
    id: 'phoenixWrong',
    source: 'phoenixWrong',
    name: 'PhoenixWrongSSB',
    channelId: 'UC4rP6g7i4tHNnD8toiYjCNQ',
    uploadsPlaylist: uploads('UC4rP6g7i4tHNnD8toiYjCNQ'),
    // Found by the index's uploader list and by search. 26 uploads, 5 marked, 3
    // records; 2 marked / 1 parsed on 2026-09-03. Rising (2 in the trailing 7
    // days) but tiny.
    //
    // "FT5 vs Diaphone (Roku A.Aang vs Suki Sokka) - Avatar Legends" — the
    // channel's own side of the title is EMPTY, and the support is written
    // BEFORE the fighter on 6 of 6 sides. The generic vs split returns 3 parts
    // on 3 of 3, so this needs its own grammar rule as well as the ownerHandle.
    //
    // WITHOUT THE OWNER HANDLE THIS CHANNEL IS A REJECT, and that is the honest
    // fallback: a side with no player is a miss. It is intaken only because a
    // second source names the player independently — index row 496966 puts
    // 'PhoenixWrong' on the Sokka/Suki side of that exact video.
    //
    // Without a support-aware matcher the naive read files 'Suki' as a PLAYER on
    // 3 of 3 records, and a fighters-only registry guard does not catch it
    // because 'Suki' resolves to no fighter.
    slotOrder: 'handle-outside',
    gateMode: 'title',
    ownerHandle: 'PhoenixWrong',
    strip: {
      prefix: [/^\s*(?:FT|BO)\s*\d+\s*(?=vs\b)/i],
      suffix: [/\s*-\s*Avatar\s*Legends\s*$/i],
    },
    aliases: {
      // 'A.Aang' must be compiled so it cannot also match 'A Aang', 'AAang' or
      // an English 'a Aang' — all three were measured as matches under the
      // reference's flexible-punctuation alias compiler, and all three would
      // resolve silently to the wrong roster slot.
      fighters: { 'avatar-aang': ['A.Aang'] },
      supports: { 'the-boulder': ['Boulder'], 'general-zhao': ['Zhao'] },
    },
  },
  {
    id: 'kovac',
    source: 'kovac',
    name: 'Kovac',
    channelId: 'UC1R59lqL2yoxAjXEkV_oMcw',
    uploadsPlaylist: uploads('UC1R59lqL2yoxAjXEkV_oMcw'),
    // Found by scrape. 4 uploads, 2 marked, 2 records; both present on
    // 2026-09-03. Two FT10 sets of 27 and 42 minutes.
    //
    // First of the two-record tier on grammar: full handles, fighter, support
    // and an FT tag, 100% consistent, 4 of 4 sides unambiguous.
    //
    // The tail strip is mandatory rather than cosmetic: without it the uploader
    // side mints the player "Avatar Legends FT10" through the sponsor stripper.
    // Keep the FT token as set-length metadata.
    slotOrder: 'handle-outside',
    gateMode: 'title',
    strip: {
      suffix: [/\s*\|\s*Avatar\s*Legends\s*FT\s*\d+\s*$/i],
    },
    aliases: {
      supports: { 'master-pakku': ['Pakku'], 'princess-yue': ['Yue'] },
    },
    freezeWatch: { lastMarked: '2026-08-08', recordsAtRecon: 2, reviewAfterDays: 90 },
  },
  {
    id: 'atma00',
    source: 'atma00',
    name: 'Atma_00',
    channelId: 'UC14YIdvvvX3FWkb_WfOrokA',
    uploadsPlaylist: uploads('UC14YIdvvvX3FWkb_WfOrokA'),
    // Found by the index's uploader list, by scrape and by search. 15 uploads,
    // 2 marked, 2 records; 1 parsed on 2026-09-03. Above towito at the same size
    // on grammar: a fighter AND a support on 4 of 4 sides.
    //
    // Its descriptions are Spanish flavour text and one of them names a fighter
    // ("autorizo q kyoshi controle mi mente"), so they must never feed a
    // description-based character tier. Widening the gate to them adds nothing
    // and would arm exactly that.
    //
    // Four of 4 sides are fighter-first after the slash. A span resolving in
    // BOTH namespaces still goes to review — this channel does not get a
    // fighter-first exemption on the strength of four sides.
    slotOrder: 'handle-outside',
    gateMode: 'title',
    strip: {
      suffix: [/\s*\*\s*\d+\s*$/],
    },
    aliases: {
      supports: { 'princess-yue': ['Yue'] },
    },
    // Witness: QVxhCdDuc30 is index row 488280, which agrees on both handles,
    // both fighters and both supports in the same order. Its other record is not
    // in the index, so the channel's net-new contribution over the index is 1.
  },
  {
    id: 'towito',
    source: 'towito',
    name: 'Towito',
    channelId: 'UComEvVB8QFKsEaVRrWfLMNA',
    uploadsPlaylist: uploads('UComEvVB8QFKsEaVRrWfLMNA'),
    // Found by the index's uploader list. 131 uploads, 2 marked, 2 records; both
    // present on 2026-09-03.
    //
    // The gate is mandatory and the measurement is unusually clean: 36 unmarked
    // titles use the IDENTICAL "Handle (Char) vs Handle (Char)" grammar for
    // BBCF, MBTL and GGST ("GGST: Towito(Giovanna) vs Search(Zato-1)"), and 0 of
    // 129 unmarked titles resolve an Avatar roster or support alias. The gate is
    // the only thing between those and the corpus.
    //
    // Its own 2022 BBCF title "Nu-13(AuraGuard) vs Bullet(Towito)" is the exact
    // mirror-image shape of the both-resolve defect, so keep this channel's
    // both-resolve and neither tallies printed every run.
    slotOrder: 'handle-outside',
    gateMode: 'title',
    strip: {
      prefix: [/^\s*FT\s*\d+\s*[-|:]?\s*/i],
      suffix: [/\s*FT\s*\d+\s*$/i],
    },
    freezeWatch: { lastMarked: '2026-08-15', recordsAtRecon: 2, reviewAfterDays: 90 },
    // No support in either title, so the index's char2 is the only support
    // source for these records — which makes it a genuinely independent witness
    // here rather than a re-reading of the same title.
    //
    // 'Towito' also appears as a PLAYER in an index row from another uploader,
    // so the handle spans channels.
  },
  {
    id: 'redblade',
    source: 'redblade',
    name: 'Redblade',
    channelId: 'UCoF3kZkq-UulnXOj4jrpNAQ',
    uploadsPlaylist: uploads('UCoF3kZkq-UulnXOj4jrpNAQ'),
    // Found by scrape. 52 uploads, 2 marked, 1 record + 1 review item; 2 marked
    // / 1 parsed on 2026-09-03.
    //
    // ONE RECORD, RANKED ABOVE TWO-RECORD CHANNELS, and that is the near-tie
    // rule working rather than an error. 1-vs-2 is a tie at this size, and this
    // is the only channel in the table that needs NO rules at all: canonical
    // "HANDLE (FIGHTER) vs HANDLE (FIGHTER)", pure ASCII, verbatim-port
    // compatible.
    //
    // A multi-game personal channel (Melty Blood, UNICLR, BBTag) whose 50
    // non-Avatar uploads the title gate marks at zero.
    slotOrder: 'handle-outside',
    gateMode: 'title',
    // The declared order is also the safe one here: on a handle-outside channel
    // a name-shaped bracket that fails to resolve is an honest no-char miss, so
    // a future "(Support)" or "(Fighter/Support)" bracket is refused rather than
    // mis-filed.
  },
  {
    id: 'saxxiefone',
    source: 'saxxiefone',
    name: 'saxxiefone',
    channelId: 'UCatq0rlthJieWLvHAeN2koQ',
    uploadsPlaylist: uploads('UCatq0rlthJieWLvHAeN2koQ'),
    // Found by search. 5 uploads, 2 marked, 2 records; both present on
    // 2026-09-03. Long sessions, 29 and 74 minutes.
    //
    // "Saxxie Zuko (June) v.s. Chris™ Zuko (June) | Avatar Legends Zuko
    //  Gameplay" — handle first, fighter bare, and the bracket holds a SUPPORT
    // rather than a fighter or a handle. That is why it declares
    // 'handle-first-bare': the union has no "handle fighter (support)" member,
    // and the counterfactual is measured — declaring 'chars-outside' parses both
    // titles CONFIDENTLY WRONG with the handle 'June' on both sides, while
    // 'handle-outside' gives no-char. The support bracket must be classified
    // BEFORE the bracket logic runs; 'handle-first-bare' is then correct rather
    // than lucky.
    //
    // A U+2122 sits inside a handle ("Chris™"). The shared normalizer does not
    // fold it but the player-id slug applies NFKD, which decomposes it to 'TM' —
    // so the display handle and the id disagree about whether the trademark sign
    // is part of the name. Recorded here because this is the only place in the
    // corpus it occurs.
    slotOrder: 'handle-first-bare',
    gateMode: 'title',
    strip: {
      suffix: [/\s*\|\s*Avatar\s*Legends\s+[A-Za-z' -]+\s*Gameplay\s*$/i],
    },
  },
  {
    id: 'drewShoto',
    source: 'drewShoto',
    name: 'drew Shoto',
    channelId: 'UCtgVLDTD1aCWhbfPZoo0jrg',
    uploadsPlaylist: uploads('UCtgVLDTD1aCWhbfPZoo0jrg'),
    // Found by scrape. 653 uploads, 12 marked, 3 records — all three uploaded
    // within 68 minutes on 2026-09-07, and ZERO records as of 2026-09-03.
    // Nothing since. Its Avatar output is otherwise stream VODs.
    //
    // THIS SHIPS FROZEN, and the reference's day-one freeze is the precedent
    // (ggst froze a channel that had been silent 7.5 weeks). A frozen channel
    // sits at the bottom of the YouTube block whatever its size: its corpus is
    // static and can never win a future cross-post.
    //
    // ITS MARKER NEEDS THE RIGHT BOUNDARY, which is the cheapest measurement in
    // the sweep: a loose gate with no trailing boundary adds five "AVATAR
    // LEGENDSS" / "AVATAR LEGENDSSSS" stream VODs, 100-6449s, all was-live, none
    // parseable.
    //
    // ── THE PIN IS A PLACEHOLDER AND MUST NOT BE COMMITTED AS ONE ────────────
    // `records` is hard-asserted against the committed data file, which is BOTH
    // the source and the target of the carry, so a wrong pin poisons the next
    // run's reference permanently and silently. The recon's 3 was produced by a
    // ported parser offline, not by this pipeline, so it is not a pin.
    //
    // SHIPPING ORDER, and it is not optional: fetch and parse this channel ONCE
    // with the freeze lifted, commit what it yields, read the count off
    // report.md, then set it here. -1 is deliberate — it can never equal a
    // carried count, so skipping that step throws on the first parse instead of
    // shipping an empty channel that looks like a working freeze.
    frozen: {
      since: '2026-09-07',
      reason:
        'three records in 68 minutes on 2026-09-07 and nothing since; its Avatar output is stream VODs',
      // SET 2026-09-18 from this pipeline's own parse of raw/drewShoto.json, per
      // the shipping order above: `npm run data:catchup` refused the -1
      // placeholder, the dump parsed to 3 records, and 3 is what is pinned. It
      // matches the recon's offline figure, which is a check rather than the
      // source.
      records: 3,
    },
    slotOrder: 'handle-outside',
    gateMode: 'title',
    strip: {
      suffix: [/\s*Battle of Firebending\s*$/i],
    },
    aliases: { handles: { Me: 'Drewski-27' } },
    // Unfreeze if two or more matchup titles a week appear for two consecutive
    // weeks. Its three records are 219-417s and look like single matches or
    // short cuts; that is not verifiable from metadata and the card says what
    // the duration says.
  },
  {
    /**
     * THE INDEX SOURCE. replaytheater.app is a fan-curated match catalogue: it
     * hosts no video, it points AT video. See types/index.ts ChannelIndex for
     * the measurements that shaped this intake — briefly:
     *
     *   · 244 rows over 93 videos and 30 uploaders on 2026-09-18, up from 231
     *     over 91 two days earlier. The platform's SMALLEST catalogue for a game
     *     and its RICHEST per row.
     *   · IT IS THE ONLY COMPLETE SOURCE FOR THE SUPPORT SLOT: char2 is filled
     *     on 244 of 244 rows with 34 distinct support names, each bound to
     *     exactly one fighter, while 27 of the 32 title channels never state a
     *     support at all. char3 and char4 are null on every row — the second
     *     column is a ROLE, not a counter-pick, and the reference's reader folds
     *     all four columns into the side as fighters.
     *   · 0.00% dead: all 93 videos resolve, in every upload month. Do not carry
     *     a sibling's decay number over (checklist 12h) and do not pin this one
     *     either — the catalogue is nine weeks old.
     *   · 158 of its rows are tournament segments inside VODs whose uploaders
     *     are tracked channels here, so the known-anywhere check decides a large
     *     share of this intake's real contribution.
     *
     * NO channelId, NO uploadsPlaylist, NO gate: there is no channel and no
     * title to gate. The game is checked per ENTRY against `gameLabel`, because
     * ?game= is a filter the catalogue answers, not one we control — 244 of 244
     * pass today.
     */
    // `name` is kept in lockstep with app/app.config.ts by the NAME SYNC gate in
    // e2e.ts — two TypeScript tracks, no compiler sees both. That gate reads
    // these three lines with a regex that allows only whitespace between them,
    // so this comment sits ABOVE the triple rather than inside it.
    id: 'replayTheater',
    source: 'replayTheater',
    name: 'Replay Theater',
    index: {
      endpoint: 'https://replaytheater.app/api/matches',
      // THEIR slug, which happens to equal ours and must not be assumed to:
      // `?game=avatarlegends`, `?game=ava` (ComboForge's id) and `?game=Avatar`
      // all return HTTP 400 "Invalid game". Probed 2026-09-16.
      slug: 'avatar',
      gameLabel: 'Avatar Legends',
      pageSize: 50,
      pacingMs: 1600,
      admitUntagged: true,
      offsetGrammar: 'hms',
      segmentOffsetMinShare: 0.2,
      formatTagPattern: /^FT\d+$/,
    },
    cronFetchedWithCarry: true,
    // Inert, and declared anyway because the type requires a value for every
    // intake: this source parses no title. Its records are built from the
    // catalogue's discrete p1_name/p1_char/p1_char2 fields and its title is
    // SYNTHESIZED from them, so 'handle-outside' is the value that does not make
    // the report's per-channel slot-order mix describe a title shape that does
    // not exist.
    slotOrder: 'handle-outside',
    // Five of its rows are dated 2026-07-02..07-07, before the launch. Decision
    // 9 excludes them: no balance era covers that build, and emit throws on a
    // record whose patch no boundary accounts for. They are NOT admitted by a
    // preReleaseFrom here — see types/index.ts for why that field is set by
    // nobody on this game.
    //
    // THREE FURTHER PORT BREAKS, MEASURED, THAT ARE THE READER'S JOB RATHER THAN
    // THIS CONFIG'S:
    //  · the shared placeholder-handle predicate flags '♱' (U+2671, row 482823),
    //    which is a REAL player — the uploader's own title reads "Vs ♱ (Azula)".
    //    The reference would drop the row.
    //  · the catalogue's upload_date is NOT the publish date on 31 of 231 rows,
    //    and on three of them it is the MATCH date taken from the video's title
    //    (-9, -11 and -22 days). Use publishedAt, as the reference already does,
    //    and treat date equality as an approximate dependence signal rather than
    //    a fact.
    //  · the cross-check that compares only single-entry videos would exclude
    //    155 of 231 rows here (67.1%), and 57 of the 76 single-row videos have
    //    titles naming both players — near-dependent witnesses. The independent
    //    set is 83 segment rows with no chapter and no title naming, plus 8
    //    whole uploads with non-descriptive titles. Report the split three ways,
    //    not two.
  },
];

export const CHANNEL_BY_ID = new Map(CHANNELS.map((c) => [c.id, c]));

/**
 * THE GAME-MARKER GATE (checklist step 3).
 *
 * ── WHY IT EXISTS HERE, WHICH IS BROADER THAN ON ANY SIBLING ────────────────
 * Not one of the 32 intake channels is single-game. They hold 45,992 uploads and
 * 454 marked titles between them — 0.99% — and several write their OTHER games
 * in the identical grammar: Cow's 28 DNF Duel uploads, Towito's 36 BBCF/MBTL/
 * GGST uploads, SchoolBus across seven games, Rood across six, aegisEsports's
 * ~150 Under Night uploads. An ungated parse does not produce noise; it produces
 * well-formed records for the wrong game.
 *
 * ── THREE CORRECTIONS THE REFERENCE'S MARKER DOES NOT NEED (checklist 3b) ────
 * 1. THE MARKER IS SOMETIMES ONLY A HASHTAG. superSalemFighters writes
 *    '#AvatarLegends' and nothing else — its tags are Smash-era and name no
 *    Avatar title at all. So the gate runs on the hashtag-run-STRIPPED title,
 *    exactly as the reference does, and that is what keeps it: the tag is
 *    mid-title, so the trailing-run strip does not reach it. The same strip is
 *    load-bearing in the other direction on redVsFantasy, where two Shorts of
 *    67s and 19s carry a trailing '#avatarlegendsthefightinggame' and nothing
 *    else. One strip, both jobs, and a per-channel assertion on
 *    superSalemFighters is what would catch that uploader moving the tag to the
 *    end.
 *
 * 2. THE ACRONYM NEEDS A LOOKAROUND, NOT `\b`. ALTFG is the only marker on
 *    kmlTournaments and on the rejected GuildfordFGC, and `\b` does not fire
 *    between an alphanumeric neighbour and 'A' — the measured case is the
 *    challonge slug 'scjuly26altfg', where `/\bALTFG\b/i` returns null and
 *    `/(?<![A-Za-z])ALTFG(?![A-Za-z])/i` matches. That slug lives in a
 *    DESCRIPTION, which a title gate never reads, so the lookaround costs
 *    nothing today; it would need re-checking the moment any channel using
 *    ALTFG widens to descriptions.
 *
 * 3. THE VENDOR NAME IS MISSPELLED BY ITS OWN COMMUNITY. 'Avatar Legens' occurs
 *    in three of one organiser's descriptions, and the checklist records
 *    'AVATAR LEGNDS' as well. The stem below tolerates a dropped letter in
 *    'Legends' but NOT a trailing one, which matters: drew Shoto publishes five
 *    "AVATAR LEGENDSS"/"AVATAR LEGENDSSSS" stream VODs, 100-6449s, all was-live
 *    and none parseable, and a stem with no right boundary reads all five.
 *
 * ── BARE 'AVATAR' IS NOT A MARKER, ON 32 OF 33 INTAKES ──────────────────────
 * See types/index.ts GateMode: the TTRPG, the film, Granblue's "Avatar Belial"
 * (three times in rood's own titles), this game's own support 'Dark Avatar
 * Unalaq', and three live false positives the recon read in descriptions and
 * neighbouring titles. toledoLocals is the single exception and it is a SLOT
 * rule, not a word rule — the word must sit immediately after the matchup's
 * closing paren — with zero false positives over all 911 of its titles.
 *
 * ── WHITESPACE AND UNICODE, WHICH IS THE OPPOSITE OF EVERY SIBLING'S STORY ───
 * The scan covered every marked title on all 73 candidate channels and found
 * ZERO occurrences of U+202F, U+3000, U+00A0, U+200B, U+200C, U+200D, U+2060,
 * U+FEFF and U+00AD. Not "rare": zero. CotW's carrier, Strive's ideographic
 * space and the whole zero-width family are simply absent from this corpus.
 *
 * NORMALIZATION IS CARRIED ANYWAY, and its control exercises IDENTITY rather
 * than the parse rate — a positive control that injects U+202F and U+00A0 into a
 * title and asserts the normalizer folds them, not a claim that doing so
 * recovers records here. What actually occurs is:
 *   · a handle that is ENTIRELY U+2671 (♱), on arinKarin and in the index. It is
 *     a real player and the shared placeholder predicate deletes it.
 *   · U+2122 inside a handle ('Chris™' on saxxiefone), where the normalizer
 *     leaves it and the id slug's NFKD turns it into 'TM'.
 *   · doubled ASCII spaces beside the marker on eight channels — normal
 *     whitespace collapse handles them, and `\s*` in the marker is why the gate
 *     survives them.
 *   · U+3010/U+3011 lenticular brackets wrapping the marker on 27 of SonicFox's
 *     titles (a rejected channel), which the shared normalizer does not fold.
 *   · a fullwidth colon and fullwidth parens in YouTube's LOCALIZED Japanese
 *     rendering of an aegisEsports title. The API's snippet.title is the English
 *     one, so this never reaches the parser — unless someone sets `hl`, which
 *     nothing here does.
 */
const HASHTAG_RUN = /(?:^|\s)#[\p{L}\p{N}_]+(?:\s*#[\p{L}\p{N}_]+)*\s*$/u;

/** Remove the trailing hashtag block, repeatedly (a title can end in several
 *  runs separated by other punctuation). */
export function stripHashtagRun(title: string): string {
  let out = title.trim();
  for (let i = 0; i < 4; i++) {
    const next = out.replace(HASHTAG_RUN, '').trim();
    if (next === out) break;
    out = next;
  }
  return out;
}

/**
 * The game name in the spellings this corpus actually uses.
 *
 * `Leg[a-z]{0,3}nds` covers 'Legends' and the dropped-letter misspellings while
 * the trailing `(?![A-Za-z])` refuses 'LEGENDSS'. Both lookarounds are
 * `[A-Za-z]` rather than `\b` — see correction 2 above.
 */
export const AVATAR_MARKER =
  /(?<![A-Za-z])Avatar\s*[:\-–|]?\s*Leg[a-z]{0,3}nds?(?![A-Za-z])|(?<![A-Za-z])ALTFG(?![A-Za-z])/iu;

/** Does this text carry a load-bearing Avatar Legends marker? */
export function hasAvatarMarker(text: string): boolean {
  return AVATAR_MARKER.test(stripHashtagRun(text ?? ''));
}

/**
 * The bare-'Avatar' GAME SLOT — toledoLocals only, and never as a general
 * marker. The word must sit immediately after the matchup's closing paren and a
 * dash: "… vs Handle (Kyoshi) - Avatar". Zero false positives over all 911 of
 * that channel's titles, where exactly 25 contain 'avatar' at all and all 25 are
 * this game's match cuts.
 */
export const GAME_SLOT_AVATAR = /\)\s*-\s*Avatar(?![\p{L}\p{N}])/iu;

/** Does this title carry the marker under the channel's declared gate mode?
 *  Description and tag widening are the caller's job — they cost a videos.list
 *  round-trip and only two channels earn it. */
export function hasMarkerForChannel(title: string, gateMode: ChannelConfig['gateMode']): boolean {
  if (hasAvatarMarker(title)) return true;
  return gateMode === 'titleOrGameSlot' && GAME_SLOT_AVATAR.test(title);
}

/** Channels the daily fetch actually contacts, and the channels whose records
 *  are built by a TITLE PARSE — the two happen to be the same set.
 *
 *  A frozen channel is skipped: its committed records are carried forward
 *  byte-stable by parse, which also hard-asserts the pinned count. Like the
 *  reference, this ships with a live consumer on day one (drewShoto), so the
 *  branch is exercised by the first real run rather than waiting years to be
 *  needed for the first time.
 *
 *  An INDEX source is skipped for a different reason: it has no channel to fetch
 *  and no title to parse, and its records are built by their own function. Note
 *  both are still in CHANNELS, so the collapse guard and the report still see
 *  them; only these two jobs skip them. */
export const ACTIVE_CHANNELS = CHANNELS.filter((c) => !c.frozen && !c.index);

/**
 * Sponsor/team prefix on a handle: "ASG | ScytheLDN", "LS99 | Dai",
 * "HCL | DLZ", "SSF|HoldBackToBark", "PAR | Nicky". STRIPPED, never split — '|'
 * is not a duo delimiter on a 1v1 game, and treating it as one would mint a
 * player called "ASG" with a page of its own. Seven sides on ndyTv carry one,
 * and so do index handles.
 *
 * APPLIED REPEATEDLY, and that is not defensive coding: a single .replace()
 * leaves a handle that still CONTAINS a sponsor tag — a worse outcome than not
 * stripping at all, because the minted player looks like a real name rather than
 * an obvious mistake. Loop until stable.
 *
 * ORDER MATTERS AND IT IS MEASURED: this must run BEFORE any blanket '|'→space
 * in the handle cleaner, or "ASG | ScytheLDN" becomes the player "ASG
 * ScytheLDN". The index also carries SPACE-separated team tags — "HOC Faulty",
 * "SOZ tofuboi", "CWang RED" — which this pattern deliberately does not touch,
 * because a space-separated prefix is indistinguishable from a two-word handle
 * and guessing would split real names.
 */
export const THEATER_SPONSOR = /^[^|｜]{1,12}\s*[|｜]\s*/;

export const stripTheaterSponsor = (handle: string): string => {
  let out = handle.trim();
  for (let i = 0; i < 4; i++) {
    const next = out.replace(THEATER_SPONSOR, '').trim();
    if (next === out || next === '') break;
    out = next;
  }
  return out;
};

/*
 * THERE IS NO `playerSep`, AND ADDING ONE WOULD DESTROY REAL DATA.
 *
 * 2XKO splits duo handles on /\s*[/&+]\s*|\s+-\s+/. Avatar is 1v1, and on this
 * corpus '/' inside a bracket means FIGHTER/SUPPORT on twelve channels — the
 * single most common punctuation in the whole grammar. A separator rule there
 * would shred the second namespace into player names. Outside the bracket the
 * index carries the handle "Vik/Jagi" on five sides, which is one person.
 *
 * The one place a slash IS a split is a fighter counter-pick inside a set
 * ("Zuko/Katara" on skeet, "Ozai, Toph" on toledoLocals), and that is decided by
 * NAMESPACE — two fighter spans — not by the punctuation.
 */
