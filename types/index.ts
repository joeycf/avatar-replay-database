// Pipeline-track types (plain node/tsx code — never enters the Nuxt graph, so
// the engine contract is restated where emitted shapes must mirror it, exactly
// like the SF6, Tekken, 2XKO, Tōkon, CotW and Strive pipelines do).
//
// EVERY NUMBER IN THIS FILE WAS MEASURED BY STAGE 0 (2026-09-16..18, three recon
// workflows over 73 candidate channels and the Replay Theater catalogue). Where
// a figure has two readings the file says both and names the one it uses.

/** The Replay.source contract: doubles as GameConfig.sourceChannels[].id
 *  (badge/filter). Grouping into Online/Tournament chips lives ONLY in
 *  app/app.config.ts sourceGroups; group ids never appear in data or URLs.
 *
 *  THIRTY-THREE TOKENS, WHICH IS FOUR TIMES ANY SIBLING'S, AND THAT IS THE
 *  SHAPE OF THIS GAME'S CORPUS RATHER THAN A FAILURE TO CONSOLIDATE. Strive
 *  reaches 19,538 records from eight channels; Avatar reaches 367 from
 *  thirty-two, and the largest single contributor is 57 records (15.5%). A long
 *  tail is what a two-month-old game has instead of a few big archives, and
 *  collapsing it into "Online"/"Tournament" tokens would destroy the per-channel
 *  deep link and the per-channel dedupe precedence that the array order in
 *  scripts/channels.ts encodes. The CHIPS collapse instead — sourceGroups in
 *  app/app.config.ts renders two — while data, badge and URL stay per channel. */
export type SourceId =
  | 'aegisEsports'
  | 'still'
  | 'ndyTv'
  | 'toledoLocals'
  | 'arinKarin'
  | 'cow'
  | 'saltyRecoveryCenter'
  | 'skeet'
  | 'unrivaledTournaments'
  | 'normalMs'
  | 'rood'
  | 'an11Mo'
  | 'natsuXenoblade'
  | 'takeANappa'
  | 'versusFestival'
  | 'avianZebra'
  | 'kmlTournaments'
  | 'teo1029'
  | 'mysteryRacer21'
  | 'xcaliburBladez'
  | 'schoolBus'
  | 'superSalemFighters'
  | 'redVsFantasy'
  | 'mikeyChiFgc'
  | 'kang'
  | 'phoenixWrong'
  | 'kovac'
  | 'atma00'
  | 'towito'
  | 'redblade'
  | 'saxxiefone'
  | 'drewShoto'
  | 'replayTheater';

/**
 * Per-YouTube-channel intake key: names raw/<key>.json and the coverage
 * report's rows. THE DEDUPE KEY (checklist step 2) — never the SourceId, which
 * two channels may one day deliberately share.
 *
 * 1:1 with SourceId today. The two unions stay separate anyway: the moment one
 * physical channel starts publishing two kinds of footage they stop being 1:1,
 * and keying dedupe on a shared public token means channel priority silently
 * never fires between the two while override protection leaks from one
 * channel's hand corrections to the other's. Both failures look exactly like
 * working dedupe.
 *
 * AND ON THIS GAME THE INTAKE KEY IS NOT ENOUGH ON ITS OWN. Checklist 2b (this
 * build's) measured the duplicate the key cannot see: an organiser posts a whole
 * tournament VOD and per-match cuts of the same bracket, the index source
 * segments the VOD, and the two records collide on nothing — 10 of 47 Replay
 * Theater segments on Aegis's VODs duplicate a standalone Aegis upload, 70% on
 * the one VOD Aegis fully re-cut, and one pairing reaches five candidate records
 * across three intakes. See MatchSignature: a REPORT-ONLY tier, never a drop key.
 */
export type ChannelKey = SourceId;

/**
 * Which part of a title holds the characters.
 *
 * FIVE SHAPES ON THIS GAME, AND THE FIFTH IS PAIR-LEVEL (checklist 5q, written
 * by this build). The reference union has four PER-SIDE members because every
 * Strive channel segments its title into two sides first and then asks which
 * span of each side is the character. Avatar's LARGEST channel does not:
 *
 *   'pair-chars-outside'  CharA vs CharB (HandleA vs HandleB)   — aegisEsports
 *
 * Both handles sit in ONE bracket and the pairing sits outside it, so a title
 * carries TWO `vs` tokens and the reference parser's global vs split returns
 * three parts. Measured on the 63 marked Aegis titles: parts === 2 on ZERO,
 * parts > 2 on 57, no-vs on 6 — i.e. the shipped parser rejects every one of the
 * corpus's 57 best records as `vs-count`, and the recon that first looked at
 * this channel misread the failure as a missing description tier. Slot order is
 * a property of the TITLE's shape, not only of each side.
 *
 * The three per-side members Avatar does use:
 *
 *   'handle-outside'     HANDLE (Fighter[/Support])  — 29 of 32 channels
 *   'chars-outside'      FIGHTER (Handle)            — takeANappa (14 of 18
 *                                                      bracketed sides)
 *   'handle-first-bare'  Handle Fighter vs …         — saxxiefone, and declared
 *                                                      on schoolBus as a value
 *                                                      that CANNOT break a tie
 *
 * 'chars-only' (the reference's fourth) IS DELIBERATELY ABSENT. A side with no
 * handle cannot become a record — the reference refuses it at parse.ts:697-698
 * and again at 1062-1066 — and on this game that is not an edge case but the
 * single biggest rejection class: 35 of the 41 rejected channels fail for
 * exactly it, including the four largest by marked volume (Chickensea1 381
 * marked / 0 parsed, Maelxich 228/0, SageArtz X 99/0, Marvel Tokon Replay Hub
 * 71/0). Adding the member would invite someone to "support" those channels by
 * minting characters-only records with nobody to attribute them to.
 *
 * THE DECLARED VALUE IS A TIE-BREAKER, AND ON TWO CHANNELS IT IS ALSO A TRAP.
 * The reference's parseSide returns no-char when a channel declares
 * 'handle-outside' and the outside span resolves while the bracket does not
 * (ggst parse.ts:626-628). Measured: declaring 'handle-outside' on schoolBus
 * drops it from 5 parsed to 2, and on takeANappa from 9 to 7. The field is
 * documented in the reference as "only recorded" away from the tie-break; the
 * CODE says otherwise and the code wins. Both channels therefore declare a value
 * chosen against that branch, not against their modal orientation.
 *
 * The mix is recorded per channel, BOTH sides, so a channel changing its grammar
 * shows up as a shift rather than as silence. Measured today: of 32 intakes, 26
 * are 100% single-orientation on every side, and the both-resolve branch that
 * cost the reference 215 rejections and 67 confidently-wrong records fires on
 * ZERO sides across the whole corpus — after decoration strips. Before them it
 * fires on 4 STiLL sides and 1 REDvsFantasy side, every one of them because hype
 * prose in the handle position names a fighter ("HIGH LEVEL NORRA PLAY!
 * TestMyLuck(Norra)"). The strips are what keep the branch asleep, so the
 * per-channel tally must keep being printed.
 */
export type SlotOrder =
  'handle-outside' | 'chars-outside' | 'handle-first-bare' | 'pair-chars-outside';

/**
 * Where a channel's is-this-Avatar marker may appear (checklist step 3).
 *
 * MANDATORY ON EVERY CHANNEL, and more so than on any sibling: not one intake
 * here is single-game. The 32 channels hold 45,992 uploads and 454 marked
 * titles — 0.99% — and the rest is Under Night, Tekken, Smash, Marvel Tōkon,
 * Granblue, DNF Duel, Melty Blood, Elsword and twenty more. Several channels
 * write their OTHER games in the identical grammar (Cow: 28 of 58 non-Avatar
 * uploads share the exact title shape; Towito: 36; SchoolBus: seven other
 * games), so an ungated parse mints records for games this site does not carry
 * and they look completely normal on the page.
 *
 *   'title'            the marker is in the title. 30 of 32 channels, and the
 *                      default. Description widening was measured per channel
 *                      and adds ZERO parseable records on 30 of them.
 *   'titleOrDescription' takeANappa only, where two sets — including its newest
 *                      — carry no marker in title, description OR tags, and the
 *                      description gate recovers 2 of its 9 records.
 *   'titleOrTags'      DECLARED AND USED BY NOBODY. It is here so that adding a
 *                      tag gate is a typed decision someone has to defend, and
 *                      the defence is already refuted: REDvsFantasy ships a
 *                      54-tag boilerplate block on all 13 of its Avatar uploads
 *                      that also contains 'ggstrive', 'guilty gear strive',
 *                      'mbtl', 'melty blood', 'sfv', 'street fighter v',
 *                      'tekken' and 'project L'. A tags gate on any SIBLING repo
 *                      would ingest this game's sets as that game's records,
 *                      silently. That is the reference's KOF XV lesson with the
 *                      polarity reversed, and it is measured rather than feared.
 *                      Tags also add nothing here: on Aegis 63 of 63 marked
 *                      uploads carry the game in snippet.tags and the title
 *                      already carried it, at a cost of one videos.list unit per
 *                      50 videos.
 *   'titleOrGameSlot'  toledoLocals ONLY. See below.
 *
 * ── THE BARE-'AVATAR' GAME SLOT, AND WHY IT IS FORBIDDEN EVERYWHERE ELSE ─────
 * Toledo Locals writes its game in a fixed slot after the matchup:
 * `Winners R2 - Handle (Fighter) vs Handle (Fighter) - Avatar`. The word
 * 'Avatar' alone is its only marker on 7 of its 25 marked uploads, so a
 * 'Avatar Legends' gate reads 18 and loses 7 — 28% of the channel.
 *
 * Bare 'Avatar' is otherwise NEVER a marker, and the reasons are live, not
 * hypothetical:
 *   · Avatar Legends: The Roleplaying Game is a separate, actively published
 *     Magpie TTRPG with the same first two words.
 *   · the 2009 Cameron film and its sequels, which is what "Avatar" returns to
 *     anyone searching.
 *   · "Avatar Belial" is a Granblue Fantasy Versus: Rising character, and Rood —
 *     an intake channel — writes it in three of its own titles.
 *   · 'Dark Avatar Unalaq' is one of this game's own SUPPORT names, so the word
 *     occurs inside the character namespace too.
 *   · measured on live text the recon read: ArinKarin's description "On Avatar
 *     launch I would…" (a Melty Blood upload), Salty Recovery's GGST Top 8
 *     description carrying the handle "Retro_Avatar (Ky)", and NORMAL MS's
 *     GBVSR titles.
 *
 * What makes the slot safe is the SLOT, not the word: the rule is
 * `/\)\s*-\s*Avatar(?![\p{L}\p{N}])/iu` — bare 'Avatar' immediately after the
 * matchup's closing paren and a dash — and over all 911 of that channel's titles
 * it has zero false positives, because exactly 25 titles contain 'avatar' at all
 * and all 25 are Avatar Legends match cuts. It is scoped to one channel and must
 * stay there.
 */
export type GateMode = 'title' | 'titleOrDescription' | 'titleOrTags' | 'titleOrGameSlot';

/**
 * A second, STRUCTURAL gate that runs beside the marker gate.
 *
 * 'fighterSupportPair' — a title counts as this game's even with no marker, if
 * it holds a vs token AND at least two fighter spans AND at least one SUPPORT
 * span. Measured only on takeANappa, and measured hard: its gate ladder reads
 * title-strict 10 marked / 5 parsed, title|description 14/7, title|description
 * |tags 14/7 (tags add nothing), title|description|pair 16/9. The pair rule
 * alone hits 9 and every one of the 9 is a real Avatar set; it hits 0 of
 * SchoolBus's 304 titles and 0 of either channel's DNF Duel, 2XKO, IVS, Elsword
 * or GGST uploads.
 *
 * It is a separate field rather than a fifth GateMode because it answers a
 * different question: GateMode says which FIELD to read, this says what SHAPE
 * counts as a statement of the game. Conflating them would let someone "widen
 * the gate" on a channel and silently acquire the structural rule too.
 */
export type ExtraGate = 'fighterSupportPair';

/**
 * A per-channel decoration strip. Inputs to the reference's strip() applier,
 * which REFUSES an edit that would remove the last `vs` (ggst parse.ts:320-333).
 *
 * WHY THESE ARE PER CHANNEL HERE AND GLOBAL ON EVERY SIBLING. The reference has
 * two shared DECOR arrays because eight channels share four decoration
 * vocabularies. Thirty-two channels share none: the measured set includes round
 * prefixes (Grand Finals / GRAND FINAL - / LOSER FINALS -), event parentheticals
 * ((Aegis Esports x ZenMarket #4)), bracket-round + event tails
 * (") - FGC Meetups 129 GRAND FINALS"), set-length tokens (FT3..FT30, "First to
 * 10", "FT10...ish"), played-on dates in four spellings, hype prefixes, a
 * clickbait prefix ending in '...'/'!!!'/'?!', pair codes, '[VOD]', '[Avatar
 * Legends]', '[MM/DD/YY|<eventcode>]' and a Spanish '*N' part suffix.
 *
 * Without them the failure is not a miss, it is a PHANTOM PLAYER: measured, the
 * reference's own handle picker mints "Avatar Legends The Fighting Game" as a
 * player on 6 Rood records, "Avatar Legends FT10" on Kovac, "Akuadynasty - FGC
 * Meetups 129 GRAND FINALS - Avatar Legends" on all 15 Unrivaled records (that
 * one is refused by MAX_HANDLE_WORDS and fails safe), "Kyoshi Player nobody
 * knows... Click" on REDvsFantasy (5 words, so MAX_HANDLE_WORDS does NOT save
 * it) and "Beta Long Set Natsu" on Natsu_Xenoblade.
 *
 * A prefix whose captured text is an EVENT is carried to Replay.event rather
 * than discarded (checklist 12j) — skeet's "CEO 2026 R2 Pools Losers R4",
 * versusFestival's "Versus Experience Mumbai 2026", unrivaledTournaments' "FGC
 * Meetups 129", ndyTv's four international events.
 */
export interface DecorationStrips {
  /** Applied to the whole title before the side split. */
  prefix?: RegExp[];
  /** Applied to the whole title before the side split. */
  suffix?: RegExp[];
}

/**
 * Channel-SCOPED alias additions. Roster-wide aliases live in
 * data/characters.json `extra.aliases` and data/supports.json `aliases`, and
 * MUST NOT be duplicated here — the app's search vocabulary and the parser's
 * vocabulary are the same data on this platform, and a channel-scoped copy of a
 * roster alias makes them two.
 *
 * What belongs here is a spelling that is true of ONE uploader and would be
 * wrong or dangerous globally:
 *   · typos: 'Kiyoshi' → kyoshi (9 STiLL titles, 8 records depend on it; also
 *     xcaliburBladez and skeet), 'Ozain' → ozai (2 Rood titles, UNVERIFIED —
 *     see the channel entry), 'Gyatt' → Gyatso (avianZebra).
 *   · community shorthand: 'Norra' → nightmare-korra (STiLL, Rood), 'A-State
 *     Aang' → avatar-aang (STiLL), 'A.Aang' → avatar-aang (phoenixWrong, and it
 *     must be compiled so it cannot also match 'A Aang'/'AAang'/'a Aang').
 *   · handle rewrites: drewShoto's 'Me' → 'Drewski-27' (the uploader's
 *     self-reference), avianZebra's 'Avian Zebra' → 'AvianZebra'.
 *
 * `handles` is a RAW-SPELLING → CANONICAL-HANDLE map, not a player id map: the
 * id is derived from the canonical handle by the shared slug rule, so a rewrite
 * here cannot invent an id the roster track does not know about.
 */
export interface ChannelAliases {
  /** characterId → literal spellings this channel writes. */
  fighters?: Record<string, string[]>;
  /** supportId (data/supports.json) → literal spellings this channel writes. */
  supports?: Record<string, string[]>;
  /** raw handle as written → the canonical handle to slug from. */
  handles?: Record<string, string>;
}

/**
 * The record's date comes from a token in the TEXT, not from publishedAt
 * (checklist 5s, written by this build).
 *
 * ONE CHANNEL NEEDS IT AND THE DAMAGE IS TWO-SIDED. STiLL titles every set with
 * the day it was PLAYED ("…BEST ZUKO I'VE FACED YET 08.18.2026") and uploads it
 * later — measured lags of 22 days (deep dive, over 44 marked titles) and 23
 * days (adversarial re-measure: uploaded 2026-09-17, titled 08.25.26). Keyed on
 * publishedAt, its whole corpus is misdated, AND a backlog flush is credited to
 * the weeks it was uploaded in, which is how a corpus can look like it is
 * accelerating while ambient volume is flat. That is not hypothetical either:
 * STiLL's August backlog draining through September is one of the two reasons
 * Stage 0's adversarial verifier withheld GO.
 *
 * `maxLagDays` is a SANITY BOUND, not a measurement: a token further from the
 * upload than this is refused and the record keeps publishedAt, because a
 * mis-OCR'd or mistyped year is otherwise unbounded. It is set to the widest
 * value any source states (26, Stage 0's handoff) rather than the narrowest
 * measured (22), because the cap fails safe in that direction — too wide only
 * admits a date the uploader wrote, too narrow silently discards real ones.
 *
 * `source: 'description'` exists and is set by nobody today. Cow states
 * "Recorded on <date>" in 18 of 18 descriptions and 6 of its 18 records would
 * be dated to the wrong side of the 2026-07-29 or 2026-09-02 updates by publish
 * time — a measured second consumer, deliberately not wired here, because
 * reading a date out of a description is the parse track's call and is NOT a
 * gate widening (the marker still has to be in the title).
 */
export interface PlayedOnDateRule {
  source: 'title' | 'description';
  /** Regex source with named groups m, d, y. Kept as a string so channels.ts
   *  states the spelling and scripts/parse.ts owns the compile flags. */
  pattern: string;
  /** Month-day-year is the only order measured on this game. Declared so a
   *  channel writing D/M/Y cannot be added by copying this one. */
  order: 'MDY';
  /** Refuse a token more than this many days before publishedAt. */
  maxLagDays: number;
}

/**
 * A channel that has stopped publishing this game but has not been pruned.
 * `records` is a hard-asserted pin (checklist step 7).
 */
export interface FreezePin {
  since: string;
  reason: string;
  /** Hard-asserted against the committed data file, which is BOTH the source and
   *  the target of the carry — so a wrong pin poisons the next run's reference
   *  permanently and silently. Editing it IS the deliberate-prune mechanism.
   *  -1 until a real fetch+parse has run once with the freeze lifted. */
  records: number;
}

/**
 * A channel that is dormant but not frozen: carry the count Stage 0 measured so
 * that whoever freezes it later does not have to invent the pin at the moment
 * they are least able to check it.
 *
 * This is the gap checklist 7b leaves open at this corpus size. The collapse
 * guard cannot fire below a few hundred records, so on THIS game it is asleep
 * for 32 of 33 intakes, and the freeze pin is the only protection a small
 * channel has. Every field here is a measurement, not a plan:
 * `lastMarked` is the channel's newest marked upload at recon, `recordsAtRecon`
 * is what the ported parser built from it, and `reviewAfterDays` is the silence
 * window. 90 is the default because it is the widest window any deep dive named
 * for its own channel (towito's "about 90 days"); a channel whose deep dive
 * named a shorter one carries that number instead.
 */
export interface FreezeWatch {
  lastMarked: string;
  recordsAtRecon: number;
  reviewAfterDays: number;
}

/**
 * An INDEX source: a third-party catalogue that points AT video rather than
 * hosting it. (Checklist step 12.)
 *
 * REPLAY THEATER IS THE PLATFORM'S SMALLEST CATALOGUE FOR A GAME AND ITS
 * RICHEST PER ROW. 244 rows over 93 videos on 2026-09-18 (231 over 91 at the
 * 2026-09-16 sweep — it is still growing), against Strive's 21,944 and SF6's
 * 15,568. What makes it load-bearing anyway is the SUPPORT column: it states the
 * second pick on 100% of rows, and no title channel on this game states it on
 * more than a handful. See `SupportRecord`.
 *
 * Four measured edges the reference's reader gets wrong (checklist 12k, written
 * by this build) are answered by the fields below.
 */
export interface ChannelIndex {
  /** Catalogue endpoint, paged with &page=N. */
  endpoint: string;
  /** The index's own token for this game, used as the ?game= query value.
   *  'avatar' — the same string as our slug, which is a coincidence and not a
   *  rule: `?game=avatarlegends`, `?game=ava` (ComboForge's id) and `?game=Avatar`
   *  all return HTTP 400 "Invalid game". Probed 2026-09-16. */
  slug: string;
  /** The game string each ENTRY states about itself. Checked per entry, because
   *  ?game= is a filter someone else answers and a mistagged submission arrives
   *  looking exactly like a real one. 244/244 pass today. */
  gameLabel: string;
  /** Entries per page. Theirs, not ours. 5 pages at 50. */
  pageSize: number;
  /** ms between requests — politeness, not rate-limit avoidance. 1600 is what
   *  Stage 0's last sweep used over 18 requests with no HTTP 429 and no bot
   *  gate; the brief's floor is 1500. */
  pacingMs: number;
  /**
   * Untagged entries are ADMITTED, not just kept as a witness. 34 of 244 rows
   * carry no tag; they are ordinary whole-video sets from player channels and
   * are as real as the tagged ones.
   *
   * THE DEAD-LINK PRICE IS ZERO AND THAT NUMBER MUST BE RE-MEASURED, NOT
   * INHERITED. All 93 distinct videos resolve — 0.00% dead across every upload
   * month — where CotW measured 32.1% and Strive 9.20%. The catalogue is nine
   * weeks old, which is the whole explanation; checklist 12h says do not carry a
   * sibling's number over, and this is the direction that makes complacency
   * cheap. Re-measure at ingest.
   */
  admitUntagged: boolean;
  /**
   * The `t=` grammar the catalogue actually writes.
   *
   * 'hms' — `26m55s`, `35m`, `1h11m20s`, `2h41m` as well as plain seconds. 18 of
   * 231 rows (7.79%) use the h/m/s form, all on one VOD, and the reference's
   * seconds-only /^(\d+)s?$/ reads every one of them as an unreadable t= and
   * DROPS THE ROW as a bad link. A (?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)? grammar
   * parses 231 of 231 (1615..9660s).
   *
   * Declared as a field rather than fixed in the reader because it is a property
   * of the catalogue, and the next catalogue this platform ports will have its
   * own answer.
   */
  offsetGrammar: 'seconds' | 'hms';
  /**
   * When is a `t=` offset a real SEGMENT, on a video the catalogue lists only
   * ONCE? (Checklist 12b's "real offset" needs a floor; 12k says so.)
   *
   * Measured over the 29 single-row videos that carry t>0: 26 are intro-skips of
   * 5-51 seconds (under 5% of the video) on whole per-set uploads, one more sits
   * at 97s of 738s (13.1%) and is also a whole casual set — and only 2 are real
   * segments, at 5262s of 9381s (56%) and 2576s of 5171s (50%). The two
   * populations do not touch: false 0-13.1%, true 50-56%. 0.2 sits in the
   * middle of that gap with a wide margin on both sides.
   *
   * Below the share the row is the WHOLE VIDEO and takes the bare YouTube id;
   * above it the row is a segment and takes `${videoId}@${startSeconds}`. Get
   * this wrong and 27 whole-video uploads mint `vid@N` segment ids with
   * durationSec 0 — records that claim to be a clip of themselves.
   *
   * THE RULE IS ONLY FOR SINGLE-ROW VIDEOS. Every row of a MULTI-row video is a
   * segment, t=0 included: 5 multi-row VODs here have a t=0 first segment, and
   * the reference publishes each of them as one whole 1722-11139s video standing
   * for the entire tournament. A segment at zero is still a segment.
   */
  segmentOffsetMinShare: number;
  /**
   * The `tag` column is MIXED, and half of what is in it is not an event.
   *
   * Measured 2026-09-18 over 244 rows: 170 carry an EVENT ("Mix Masters
   * Tournament #1", "Aegis Esports x ZenMarket #1", "WELCOME TO THE JALTA
   * LEAGUE'S ETERNITY #5", "UMAD 2026 Top 8"), 40 carry a SET FORMAT
   * (FT5/FT7/FT10/FT15/FT17/FT20/FT30) and 34 are null. The reference emits any
   * non-empty tag as Replay.event, which would print 40 event chips reading
   * "FT10" — a tournament that does not exist, on the one field the engine shows
   * INSTEAD of the source name.
   *
   * A row whose tag matches this falls through to channelName and the token is
   * kept as set length, never as an event.
   */
  formatTagPattern: RegExp;
}

export interface ChannelConfig {
  /** Raw-dump key / report row (unique per YouTube channel). */
  id: ChannelKey;
  /** The source this channel's replays publish under. */
  source: SourceId;
  /** Display name (mirrors app/app.config.ts sourceChannels[].name). */
  name: string;
  /** YouTube channel id. Absent on an `index` source, which has no channel. */
  channelId?: string;
  /** The channel's uploads playlist (UU + channelId.slice(2), pinned — saves a
   *  quota unit per channel per run, and the id is stable where a handle is
   *  not). Absent on an `index` source. */
  uploadsPlaylist?: string;
  /** This intake is a third-party INDEX, not a YouTube channel. Its dump is
   *  built by scripts/fetch-theater.ts, its records are not built by a title
   *  parse, and data:fetch skips it. Mutually exclusive with channelId. */
  index?: ChannelIndex;
  /** Where this channel's game marker may appear. Default 'title'. */
  gateMode?: GateMode;
  /** A structural gate that runs beside the marker gate. See ExtraGate. */
  extraGate?: ExtraGate;
  /** The channel's declared slot order. See SlotOrder — on two channels the
   *  declared value is chosen AGAINST a code branch, not to describe the modal
   *  orientation, and those entries say so. */
  slotOrder: SlotOrder;
  /** Per-channel decoration strips, applied before the side split. */
  strip?: DecorationStrips;
  /** Channel-scoped alias additions. Roster-wide aliases do NOT go here. */
  aliases?: ChannelAliases;
  /**
   * The uploader's own handle, for a channel whose grammar leaves ITS OWN side
   * of the title empty.
   *
   * NO SIBLING HAS THIS FIELD (a grep for ownerHandle/selfHandle/uploaderHandle
   * across the workspace's pipelines returns nothing), and it is one step from
   * inventing data, so it is fenced: it is legal only where a SECOND source
   * independently names the uploader as that side. phoenixWrong is the only
   * channel that sets it — its grammar is `FT5 vs <opponent> (<opponentFighter>
   * vs <selfFighter>) - Avatar Legends`, so the self side carries a fighter and
   * no handle on 3 of 3 records, and Replay Theater row 496966 names
   * "PhoenixWrong" as the player on that exact video. Without it the channel has
   * no second side and is a REJECT; with it the three records are real.
   *
   * Which side receives it is decided by the channel's grammar rule, never by
   * title order — teo1029's index witness (row 484973) is the reverse of its own
   * title order, and that channel would be wrong half the time on a positional
   * read.
   */
  ownerHandle?: string;
  /**
   * Two-letter fighter codes, valid ONLY as an `XX/YY` list filling a whole
   * bracket, e.g. "Mattchu (KO/OZ) vs Batmanity (ZU/ZA)".
   *
   * saltyRecoveryCenter only, and the constraint is the whole point. The codes
   * are the first two letters of the fighter's name — the same convention that
   * channel uses on its SF6 (CH/ED, JA/CA) and GGST (LU/MI, SO/JO) titles — and
   * they recover 2 of its 17 records. As BARE aliases they would be a disaster:
   * 'KO' is the most common two-letter token in fighting-game titles there is.
   * Only codes actually observed are listed; a code that has not been seen is
   * not added on the strength of the pattern.
   */
  pairCodes?: Record<string, string>;
  /**
   * This channel's duration FLOOR in seconds, in place of the global
   * MIN_MATCH_SEC (scripts/parse.ts, 120). A shorter record is a `too-short`
   * miss, counted per channel in report.md.
   *
   * SET BY NOBODY, AND THAT IS A MEASUREMENT RATHER THAN AN OVERSIGHT. The
   * shortest marked upload on any intake channel is 145s (toledoLocals, and 3 of
   * its genuine bracket sets run 145-177s, so a 180 floor would wrongly drop
   * them). Every channel's parsedFloor0 equals its parsedFloor120 with exactly
   * one exception: normalMs, where the floor removes two pre-launch BETA clips
   * of 94s and 96s that the launch date floor removes anyway. So the platform
   * default is inert as a record filter on 31 of 32 channels and redundant on
   * the 32nd.
   *
   * It is still declared and still runs, for the reason takeANappa and
   * superSalemFighters both make concrete: several of these uploaders already
   * post 15-30s Shorts of OTHER games, and the floor is the guard that is
   * already in place when one of them starts doing it here. The reference's
   * ggstHq case — 434 fully-titled matchups under 120s that a global floor would
   * delete — has no counterpart on this game: zero sub-120s uploads parse
   * anywhere in this corpus.
   */
  minDurationSec?: number;
  /**
   * This channel's duration CEILING in seconds. An upload longer than this is a
   * `too-long` miss, not a record.
   *
   * CHECKLIST 5t, WRITTEN BY THIS BUILD, AND IT IS THE HARDER EDGE. A whole-
   * tournament VOD passes the marker gate, clears the 120s floor by a factor of
   * sixty, and becomes ONE record standing for fourteen matches. Measured on
   * aegisEsports: its six "Full Tournament VOD" uploads run 4840, 5408, 6445,
   * 6558, 6798 and 7112 seconds, and the index source cuts the 7112s one into
   * FOURTEEN rows. Nothing in the shared pipeline catches that; the floor is the
   * wrong end of the same ruler.
   *
   * Set on aegisEsports alone, at 3600. The number is not a round guess: that
   * channel has 7 uploads over 20 minutes and 6 over 60, and the 6 over 60 are
   * exactly the 6 VODs, so the seventh — a genuine set — is the longest match-
   * like upload and sits below 3600s, while the shortest VOD is 4840s. 3600
   * keeps 57 of 57 and refuses 6 of 6 with 1240s of headroom on the wrong side.
   *
   * It is deliberately NOT set anywhere else. takeANappa has six marked uploads
   * over an hour, five rejected by grammar and one a real 77-minute set;
   * natsuXenoblade's 4727s upload is a real bracket VOD whose records are
   * genuine. A ceiling on either would delete footage. The alternative 5t offers
   * — route over-length uploads to the index arm that already segments them — is
   * exactly what happens on Aegis: all four of its VODs the index covers are
   * indexed there, with offsets, so refusing them here loses nothing.
   */
  maxDurationSec?: number;
  /**
   * A date floor for the FETCH WALK, not for the parse (checklist 1b, written by
   * this build).
   *
   * `preReleaseFrom` bounds which records are KEPT. This bounds how far back the
   * uploads-playlist walk goes, and on this game it is the difference between a
   * cron that costs 20 units and one that costs 1,600. Five intakes have
   * playlists far larger than their Avatar output: unrivaledTournaments 12,975
   * uploads for 14 records, kmlTournaments 11,605 for 7, superSalemFighters
   * 9,759 for 4, ndyTv 3,780 for 34, rood 2,334 for 14. The reference's fetcher
   * walks the whole playlist and hydrates every id (ggst scripts/fetch.ts:75-120),
   * which on those five is 810 playlistItems pages plus 810 videos.list calls —
   * about 1,620 units EVERY DAY, on a key shared with six production crons, to
   * harvest 73 marked uploads. NdyTV alone is ~152.
   *
   * Set to the launch date on every channel whose playlist exceeds 2,000
   * uploads. The walk is newest-first, so the floor is a stop condition: after
   * the first harvest those five cost a page or two a day. The floor must never
   * be LATER than the record floor or the fetch starves the parse — both are the
   * 2026-07-23 launch here, and both are imported from one constant.
   */
  fetchFrom?: string;
  /**
   * This channel's record date comes from a played-on token in the text.
   * See PlayedOnDateRule. Set on `still` only.
   */
  playedOnDateFrom?: PlayedOnDateRule;
  /**
   * This channel's date floor, in place of the global LAUNCH gate — i.e. it
   * ADMITS pre-release footage this channel published.
   *
   * SET BY NOBODY, AND THAT IS DECISION 9 RATHER THAN AN OMISSION. Pre-launch
   * footage exists and is not rare: ArinKarin has 11 marked uploads before
   * 2026-07-23 (6 from the Feb/Mar 2026 closed alpha, 5 from the 07-02..07-07
   * window the vendor's own 2026-03-30 Steam post had promised as the launch),
   * normalMs has 8 pre-order BETA uploads, schoolBus 2, cow 1, and Replay
   * Theater carries 5 rows dated 2026-07-02..07-07. Admitting them would add
   * about 20 records.
   *
   * They are excluded because there is no balance era to file them under. The
   * vendor shipped one versioned patch in its life (Patch 2.5, 2026-09-02), the
   * patch table opens at LAUNCH, and emit throws on a record whose patch no
   * boundary accounts for — correctly. Inventing a pre-release era for twenty
   * records of a build nobody measured would put a date token in the facet that
   * names a balance state we cannot describe. If that changes, this field is
   * where it changes, and scripts/patches.ts has to grow the era first.
   */
  preReleaseFrom?: string;
  /** A channel that stopped publishing this game. Its committed records are
   *  carried forward byte-stable rather than pruned; fetch skips it. */
  frozen?: FreezePin;
  /** A dormant channel that is not frozen yet. See FreezeWatch. */
  freezeWatch?: FreezeWatch;
  /**
   * CRON-FETCHED, WITH A CARRY FALLBACK. raw/ is gitignored and the cron works
   * from a fresh checkout, so a run whose pull failed has no dump. When the dump
   * is ABSENT OR EMPTY the intake's committed records are CARRIED; when it has
   * rows they are rebuilt and merged over the committed set add-only. The carry
   * pin lives in data/source-pins.json because this kind of source GROWS — the
   * catalogue went from 231 rows to 244 in two days during Stage 0 — and a
   * constant in this file would be friction that teaches people to skip the
   * check.
   */
  cronFetchedWithCarry?: boolean;
}

/** One upload as fetched from the YouTube Data API (raw/<key>.json). */
export interface RawVideoRecord {
  id: string;
  /** Intake channel, NOT the source — parse maps it via CHANNELS. */
  channel: ChannelKey;
  title: string;
  description: string;
  publishedAt: string; // ISO
  /** ISO8601 duration decoded to seconds; 0 = live/upcoming/unknown. */
  durationSec: number;
  viewCount?: number;
  /** 'none' for normal VODs; 'live'/'upcoming' are excluded by parse.
   *  GATE ON THIS FIELD AND NEVER ON THE PRESENCE OF liveStreamingDetails: three
   *  of KANG's three records and three of mikeyChiFgc's three are PREMIERES,
   *  which carry liveStreamingDetails and are ordinary uploads. Gating on the
   *  object would delete both channels entirely. */
  liveBroadcastContent: string;
  tags?: string[];
}

/**
 * One record in raw/replayTheater.json — an index entry already joined to its
 * VOD's YouTube metadata. Extends RawVideoRecord so the dump reads like any
 * other, but the fields below are what the record is actually BUILT from:
 * nothing here is recovered by parsing a title.
 */
export interface TheaterRawRecord extends RawVideoRecord {
  /** `${videoId}@${startSeconds}` for a real SEGMENT, the plain YouTube id for a
   *  whole-video entry. See ChannelIndex.segmentOffsetMinShare for where the
   *  boundary is and why it is not "t= is present". */
  id: string;
  /** The catalogue's own entry id. Provenance, and the fetch resume key.
   *  NOT A SORT KEY: ids are global across the catalogue's games (this game's
   *  244 rows span 481582-496971, a 15,390-id range), and the feed is
   *  upload_date DESC but NOT id ASC within a date — 22 of 188 same-date
   *  adjacent pairs step DOWN. The reference's cursor comment asserts the
   *  opposite. */
  theaterId: number;
  /** The YouTube id this record lives in or is. */
  videoId: string;
  /** Offset into videoId, in seconds. Absent when the entry is a whole video. */
  startSeconds?: number;
  /** The catalogue's tag, '' when null. MIXED: an event on 170 rows and a set
   *  FORMAT (FT5..FT30) on 40. Only an event reaches Replay.event — see
   *  ChannelIndex.formatTagPattern. No untrimmed or non-ASCII tags occur here,
   *  unlike the reference's corpus; trim anyway. */
  tag: string;
  /** The VOD's own uploader, for the report and for channelName. 30 distinct
   *  uploaders over 93 videos. */
  uploader: string;
  /** [side0, side1] handles, exactly as the catalogue spells them — sponsor
   *  prefixes intact, for the parser to strip. */
  players: [string, string];
  /** [side0, side1] FIGHTER names, one per side. The catalogue exposes four
   *  character columns and this game uses exactly two of them per side: char3
   *  and char4 are null on 244 of 244 rows, and char2 is NOT a counter-pick —
   *  it is the SUPPORT. Reading the columns as one list is the single most
   *  expensive porting mistake available on this game; see `supports`. */
  characters: [string, string];
  /** [side0, side1] SUPPORT names, verbatim. Filled on 244 of 244 rows. */
  supports: [string, string];
}

/**
 * Which stage produced a side's characters. Ordered weakest → strongest.
 *
 * FOUR MEMBERS, AND 'description' IS ONE OF THEM ON EXACTLY ONE CHANNEL.
 * Checklist 5p (written by this build) says to measure whether the description
 * tier is POPULATED before scoping a parser for it, and the measurement on the
 * largest channel is decisive against: all 63 of Aegis's marked descriptions are
 * a fixed 457-byte boilerplate plus a chapter list, with ZERO fighter spans and
 * ZERO support spans. A recon pass had scoped a description gate for that
 * channel; it had nothing to read.
 *
 * ndyTv is the one place the tier exists and pays: 33 of its 57 marked titles
 * name no fighter, and for 10 of them description LINE 2 carries
 * `<Handle> (<Fighter>) vs <Handle> (<Fighter>)` with BOTH handles equal to the
 * title's. 10 of 10 verified. The handle-equality condition is what keeps it
 * from being a free-text description scrape. The other 23 are a genuine
 * character void — no field anywhere names a fighter — and stay out.
 *
 * There is NO footage-extraction tier in this repo and no plan for one: the 41
 * rejected channels did not fail for want of a richer tier, they contain no 1v1
 * set with named players in ANY tier, and no OCR recovers a handle that was
 * never written down.
 *
 * THE ORDER OF THIS UNION IS DOCUMENTATION, NOT CONTROL FLOW. Precedence is the
 * order of application in code, and nothing ever downgrades a side.
 */
export const CHAR_TIERS = ['title', 'description', 'index', 'human'] as const;

export type CharTier = (typeof CHAR_TIERS)[number];

/**
 * Per-side character provenance — the answer to "how did this record get its
 * characters and its support", recorded at the moment it is decided
 * (checklist 8b).
 *
 * SUBSTRATE ONLY. The engine's `Side` is { player, players?, characters, rank? }
 * with no `extra` bag. scripts/emit.ts projects sides field-by-field rather than
 * spreading, so provenance cannot leak into replays.json by construction; emit
 * asserts that anyway.
 */
export interface CharProvenance {
  /** The tier that produced the FINAL fighter list. */
  tier: CharTier;
  /** Every tier that contributed, in the order applied. */
  tiers: CharTier[];
  /** Ids the TITLE stated. Always present on a title-parsed record. An index
   *  intake parses no title — its title is synthesized FROM the catalogue's own
   *  character fields, so citing it as a source would be circular — and those
   *  sides carry `[]` here. */
  fromTitle: string[];
  /** Ids the DESCRIPTION stated. ndyTv only; see CHAR_TIERS. */
  fromDescription?: string[];
  /** Ids a third-party INDEX stated for this side, as discrete fields. */
  fromIndex?: string[];
  /** Ids a PERSON entered, resolving a review-queue item. Authoritative. */
  fromHuman?: string[];
  /** How this side's SUPPORT was sourced, if it has one. Tracked separately
   *  from the fighter because the two come from different tiers on most
   *  records: 27 of 32 title channels state a fighter and no support, while the
   *  index states both. A record whose fighter is title-tier and whose support
   *  is index-tier is the normal case here, not a conflict. */
  supportTier?: CharTier;
  /** Which slot order this side's segment resolved to. Recorded for EVERY side,
   *  not sampled — the per-channel mix is printed in report.md, and it is how a
   *  channel changing its grammar becomes visible. */
  slotOrder?: SlotOrder;
  /** The tie-breaker fired: both spans resolved and the channel's declared
   *  slotOrder decided it. Counted per channel, because a rising rate means a
   *  channel is drifting. Zero on every side of the Stage 0 corpus, AFTER the
   *  decoration strips — which is the number to watch, not a property to trust. */
  tieBroken?: boolean;
  /** A span resolved in BOTH namespaces (see SupportRecord: 'Katara' is a
   *  fighter and also Avatar Aang's support). The record is queued, never
   *  guessed. */
  namespaceOverlap?: boolean;
  /** Tiers disagreed. The record is queued for review, WITHHELD rather than
   *  published: a union of two disagreeing tiers asserts a matchup neither
   *  source stated. */
  conflict?: boolean;
  /** characters.length >= charactersPerSide (1 here), i.e. the side is known. */
  complete: boolean;
}

/** One parsed side: one pilot, the fighter they picked, and the support that
 *  came with it.
 *
 *  Avatar is 1v1, so a normal side holds exactly ONE fighter. `characters` is
 *  still a union of 1..N in first-appearance order, not a fixed-length tuple:
 *   · MORE than 1 is a counter-pick inside a set — legal data, counted in
 *     characterUsage. Measured on 5 titles across skeet, toledoLocals,
 *     unrivaledTournaments and salty ("Ozai, Toph", "Zuko/Katara"). It is rare
 *     enough that each one is named in its channel's entry.
 *   · ZERO is the only failure, and emit hard-fails on it. */
export interface MatchSide {
  /** Player id (slug of handle). */
  player: string;
  /** Display handle, nicest casing seen. */
  handle: string;
  /** Roster FIGHTER ids (data/characters.json), 1..N, first-appearance order.
   *  A SUPPORT NEVER APPEARS HERE. See `support`. */
  characters: string[];
  /** The support id (data/supports.json), or null when no text stated one.
   *  Substrate: emit projects it onto the record's `supports` tuple and asserts
   *  the two agree. */
  support?: string | null;
  /** How this side's characters and support were sourced. Never emitted. */
  provenance: CharProvenance;
}

/**
 * The game-local support field as it reaches data/replays.json, index-aligned
 * with `sides`: supports[i] is sides[i]'s support, or null.
 *
 * THIS IS THE WHOLE POINT OF CHECKLIST 13, SO IT IS WORTH SAYING WHY IT IS NOT
 * A SECOND CHARACTER. Every side of this game picks a fighter AND a support;
 * there are 36 supports (12 fighters × 3) and the index source states one on
 * 100% of its rows — 244 of 244 on 2026-09-18. The obvious move is charactersPerSide 2. It is wrong on
 * four counts, each measured:
 *   · a support has no page, no usage share and no mirror in the fighter
 *     namespace. Putting them in Side.characters doubles the roster to 48,
 *     prerenders 36 pages nobody asked for and makes every character's usage
 *     share exactly half of what it is.
 *   · the namespaces OVERLAP. 'Katara' is a launch fighter and also Avatar
 *     Aang's support — 1 of 462 sides at the 2026-09-16 sweep (Replay Theater row
 *     482155, and the
 *     uploader's own title confirms it: "Avatar State Aang - Katara"). Folded
 *     into one list, that side reads as a two-fighter counter-pick and mints
 *     Katara as a second fighter on the opponent's slot, with every count green.
 *   · the pairing is a strict partition, not a free choice: each of the 33
 *     supports observed appears under exactly one fighter across all 462 sides of
 *     that sweep.
 *     That is a validatable invariant in a separate namespace and meaningless
 *     inside a shared one.
 *   · the reference's index reader folds char2..char4 into the side as
 *     counter-picks, which on this catalogue would print a 100% counter-pick
 *     rate and drown the unresolved-character residue in hundreds of support names.
 *
 * The engine has no field for this, and does not need one: 2XKO ships
 * `fuses?: [string | null, string | null]` the same way (2xko/scripts/emit.ts:73-79).
 * The engine ignores the key, a GameFacet filters on it and a badge override
 * renders it. charactersPerSide stays 1.
 */
export type RecordSupports = [string | null, string | null];

/** The committed parse substrate (data/videos.json): only structurally parsed
 *  matches enter it; misses are reported, not stored. */
export interface MatchVideo {
  id: string;
  /** Resolved source (Replay.source), not the intake channel. */
  channel: SourceId;
  /** The INTAKE channel — the dedupe key (checklist step 2). */
  intake: ChannelKey;
  title: string;
  /** THE RECORD'S DATE. publishedAt for 31 intakes; the played-on token for
   *  `still`, where the two differ by up to 23 measured days. */
  date: string;
  /** The upload's own publishedAt, always. Kept beside `date` so a played-on
   *  record can still be reconciled with the API, and so the report can show the
   *  lag rather than hide it. */
  publishedAt: string;
  durationSec: number;
  viewCount?: number;
  /** The patchGroups PARENT token this record's era resolves to. */
  era: string;
  /** The patch token in force on `date`. An ISO DAY, not a vendor version, and
   *  that is checklist 4d: this vendor published one versioned patch in its life
   *  (Patch 2.5), one date-titled storefront update, and a third balance patch —
   *  seven characters changed — only on X. With no published predecessor for two
   *  of three rows, a version token would have to be invented for them. The
   *  version rides along as a display label instead. scripts/patches.ts owns the
   *  boundary table and its types; this file deliberately does not declare them,
   *  so there is one declaration and one owner. */
  patch: string;
  /** The YouTube id, when `id` is not it. */
  videoId?: string;
  /** Where this record's footage starts inside `videoId`, in seconds. Absent
   *  means the whole video. */
  startSeconds?: number;
  /** THE BADGE LABEL (engine v0.13.0). `event` is what the set was played at;
   *  `channelName` is the VOD's uploader, set only where it differs from the
   *  source's configured name — which is exactly the index intake, one token
   *  covering 30 uploaders. The engine prints the first one present INSTEAD of
   *  the source name. A set FORMAT is never an event: see
   *  ChannelIndex.formatTagPattern. Both go through normalizeText, like
   *  `title`. */
  event?: string;
  channelName?: string;
  sides: [MatchSide, MatchSide];
  /** The support pair. See RecordSupports. Absent only when neither side's text
   *  stated one, which is the common case on title channels. */
  supports?: RecordSupports;
}

/**
 * A match IDENTITY hypothesis — the dedupe tier the intake key cannot see
 * (checklist 2b, written by this build; decision 5 of the build brief).
 *
 * REPORT-ONLY. IT IS NEVER AN AUTO-DROP KEY, AND THAT IS NOT CAUTION.
 * The runback is a legitimate collision: the same two players on the same two
 * fighters on the same day is what a winners final followed by a grand final
 * looks like, and a signature is a hypothesis about footage identity, not a
 * verdict. Dropping on it deletes the grand final of the corpus's biggest event.
 *
 * Not computing it is the other half of the same mistake. Measured: 10 of 47
 * index segments on Aegis's VODs duplicate a standalone Aegis upload (70% on the
 * one VOD Aegis fully re-cut), and one pairing — MarsSpitsBars/Ozai vs
 * STiLL/Katara — has up to five candidate records across three intakes and five
 * distinct video ids. On a video-id key every one of those is invisible, so the
 * archive quietly counts its biggest event up to five times while every gate
 * reads green.
 *
 * Compute it, report the rate in report.md, and route candidates to the review
 * queue as 'duplicate-candidate'. Composite segment ids stay the mechanism for
 * index-within-VOD.
 */
export interface MatchSignature {
  /** Both player ids, sorted, so side order cannot split a pair. */
  players: [string, string];
  /** Both fighter ids, sorted, for the same reason. */
  characters: [string, string];
  /** The played-on day (MatchVideo.date), not publishedAt — the index dates a
   *  segment to the event day and the channel dates the cut to its upload, and
   *  on `still` the title states the real one. */
  playedOn: string;
}

/** data/source-pins.json — the carry pin for every `cronFetchedWithCarry`
 *  intake, keyed by ChannelKey. Written by every rebuilding run, hard-asserted
 *  by every carry, and refused if a rebuild would move it DOWN. */
export type SourcePins = Partial<Record<ChannelKey, number>>;

/** data/players.json entry (mirrors the engine's Player). */
export interface PlayerRecord {
  id: string;
  handle: string;
  featured?: boolean;
  extra?: { aliases?: string[] };
}

/** data/characters.json entry (mirrors the engine's Character). `aliases` is
 *  the shared search/parse key — the app's search vocabulary and the parser's
 *  vocabulary are the same data, which is why a new nickname only has to be
 *  added once. */
export interface CharacterRecord {
  id: string;
  name: string;
  imgPortrait: string;
  imgSplash?: string;
  accent: string;
  extra?: {
    aliases: string[];
    /** Air / Water / Earth / Fire, the vendor's own grouping. Drives nothing in
     *  the engine; it is what the design handoff groups the accents by. */
    nation?: string;
    /** ISO day this fighter became playable, or null for an announced-but-
     *  unreleased row. NOT a guess: this vendor gives "over the course of the
     *  season" and "later this year" for its five Pass fighters and Tagah, and
     *  the only "Fall 2026" in existence is on a fan wiki. See checklist 11d —
     *  an unreleased row carries a window or a stated backstop, never a wiki's
     *  guess laundered into a vendor date. */
    released?: string | null;
    [k: string]: unknown;
  };
}

/**
 * data/supports.json entry — the SECOND NAMESPACE (checklist 13).
 *
 * Not a Character, and the differences are load-bearing rather than cosmetic: a
 * support has no page, no portrait, no accent, no usage share and no presence in
 * Side.characters. What it has that a Character does not is an OWNER.
 *
 * THIRTY-SIX EXIST (the vendor's store copy: "Choose from three support
 * characters to accompany your fighter", × 12 launch fighters) AND THIRTY-FOUR
 * ARE ATTESTED. The index's 462 sides at the 2026-09-16 sweep yield 33 distinct
 * names and the 2026-09-18 re-measure over 244 rows reads 34; the two gaps are
 * on Katara and Sokka, who show only two each. STiLL's titles also carry
 * 'Hakoda' twice, which is in no index row and is most likely Katara's third —
 * recorded here as a note and NOT as a registry row, because a support nobody
 * has verified is a support nobody should be able to parse into a record.
 *
 * `owner` is a strict partition, measured: every one of the 33 index-attested
 * supports appears under exactly one fighter across all 462 sides. That makes it
 * an assertable invariant — a support resolving on a side whose fighter does not
 * own it is a parse error, not a rare pick — and the invariant is only available
 * because the namespace is separate.
 *
 * SPELLINGS COME FROM THE INDEX, NOT FROM THE BRIEF, and the difference is not
 * academic: the brief writes 'Boulder', 'Pakku', 'Ming Hua', 'Ran & Shaw',
 * 'Sozin' where the index writes 'The Boulder', 'Master Pakku', 'Ming-Hua',
 * 'Ran and Shaw', 'Firelord Sozin'. An exact-alias comparison demands ONE span
 * covering the WHOLE string, so a table holding only 'Pakku' does not resolve
 * 'Master Pakku' and the cross-check witness silently reads as disagreement. The
 * short forms belong in `aliases`; the canonical `name` is the index's.
 *
 * Five spellings need care in the matcher: 'Lo and Li' and 'Ran and Shaw'
 * contain " and "; 'Ming-Hua' a hyphen; "P'Li" an apostrophe (U+0027, and
 * uploaders write "P'li" and "Pi li"); and 'Dark Avatar Unalaq' contains the
 * word Avatar, which is one more reason bare 'Avatar' is not a marker.
 */
export interface SupportRecord {
  /** kebab id, e.g. 'master-pakku'. Its own id space — a support id and a
   *  character id may coincide ('katara' does) and that is not an error. */
  id: string;
  /** Display name, spelled as the index spells it. */
  name: string;
  /** The data/characters.json id that owns this support. Exactly one. */
  owner: string;
  /** Parse and search vocabulary, including the short forms uploaders write. */
  aliases: string[];
}

/** Per-video manual corrections (data/overrides.json). A hand verdict beats
 *  every automatic tier. */
export type VideoOverride = Partial<
  Pick<MatchVideo, 'era' | 'patch' | 'sides' | 'supports' | 'channel' | 'date'>
> & {
  /** Free-text provenance note. JSON has no comment syntax and this file is
   *  read by humans as often as by code, so an entry says how it got there. */
  '//'?: string;
  exclude?: boolean;
  /** Who resolved this. Load-bearing for dedupe: only HAND-AUTHORED `sides`
   *  overrides protect a record from dedupe (checklist step 2), so the priority
   *  check must test THIS field rather than the mere presence of `sides`. */
  resolvedBy?: 'human';
};

/** One pending item in data/review-queue.json — footage the pipeline refuses to
 *  publish. REGENERATED by every parse run (derived state: resolutions live
 *  solely in overrides.json, so the queue self-clears as verdicts land).
 *  Pending items NEVER reach videos.json or replays.json.
 *
 *  Kinds:
 *   'character-completion' — match-shaped footage whose fighters no text states.
 *   'source-classification'— a title carrying signals for two games.
 *   'index-conflict'       — the catalogue and the uploader's own title disagree
 *                            about a side. Held, not merged.
 *   'slot-ambiguous'       — BOTH spans of a side resolved and the channel
 *                            declares no usable order. Zero today, after the
 *                            decoration strips; before them, 5 sides.
 *   'support-overlap'      — a span resolved as BOTH a fighter and a support.
 *                            One case exists in the live data ('Katara' as
 *                            Avatar Aang's support) and it is never guessed.
 *   'duplicate-candidate'  — two records share a MatchSignature. Reported and
 *                            queued, NEVER dropped: see MatchSignature. */
export interface ReviewQueueItem {
  id: string;
  kind:
    | 'character-completion'
    | 'source-classification'
    | 'index-conflict'
    | 'slot-ambiguous'
    | 'support-overlap'
    | 'duplicate-candidate';
  channel: ChannelKey;
  title: string;
  publishedAt: string;
  durationSec: number;
  /** Handles the title DID state, canonicalised against players.json.
   *  Pre-fills the review form so a reviewer answers only the characters — and,
   *  more importantly, stops a verdict minting a second player page under a
   *  different spelling of an existing player. */
  handles?: [string, string];
  /** For 'index-conflict': what each tier claimed. */
  conflict?: { side: 0 | 1; fromTitle: string[]; fromIndex: string[] };
  /** For 'slot-ambiguous': the two readings, so the reviewer picks rather than
   *  re-derives. */
  readings?: { handle: string; characters: string[] }[];
  /** For 'support-overlap': the span, and the two ids it resolved to. */
  overlap?: { span: string; fighterId: string; supportId: string };
  /** For 'duplicate-candidate': the other record ids sharing the signature, and
   *  the signature itself. Up to five ids have been observed on one pairing. */
  duplicates?: { signature: MatchSignature; ids: string[] };
}

/** A time-bomb that has gone off: something the data can tell us is due, rather
 *  than something a human has to remember. See scripts/expiries.ts.
 *
 *  'unreleased-character' is the awkward one on this game and checklist 11d
 *  names why: the gate's shape wants a release date, and this vendor has given
 *  none for any of its six unreleased fighters. The expiry fires on a WINDOW or
 *  a stated backstop with its reasoning attached, never on a date invented to
 *  fill the field.
 *
 *  'dormant-channel' is this game's addition, and it exists because the collapse
 *  guard cannot protect a 2-record channel: 32 intakes, 20 of them under ten
 *  records. See FreezeWatch. */
export interface Expiry {
  kind:
    | 'unreleased-character'
    | 'unreleased-support'
    | 'stale-patch-table'
    | 'dormant-channel'
    | 'missing-fan-kit';
  /** roster id, support id, ChannelKey, or 'patch-table' / 'art-licence'. */
  id: string;
  /** the ISO date that has now passed */
  date: string;
  /** what a human must do to clear it */
  action: string;
}
