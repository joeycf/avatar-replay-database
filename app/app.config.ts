import patchGroups from '../data/patchGroups.json';
import type { GameConfig } from '@engine/types';

/**
 * The Avatar Legends: The Fighting Game GameConfig — merged OVER the engine's
 * neutral default. Everything game-shaped the engine renders comes from here
 * via useGame(); the visual skin lives separately in app/assets/theme.css.
 *
 * The genericity knobs, deliberately:
 *
 * - charactersPerSide 1, and on this game that needed an argument. Every side
 *   picks a FIGHTER and a SUPPORT — the index source fills the second column on
 *   100% of its rows — so the obvious move is charactersPerSide 2. It is wrong.
 *   A support is a different KIND of pick: it has no page, no usage share and no
 *   mirror in the fighter namespace, and one support (`Katara`) shares a name
 *   with a fighter. Putting supports in Side.characters would double the roster,
 *   pollute the stat unit, prerender 36 pages nobody asked for, and make that
 *   one name ambiguous forever. They ride the record as `supports` instead
 *   (checklist 13, which this build wrote).
 *
 * - filters.coOccurrence FALSE. No same-side duo on a 1v1 game.
 *
 * - filters.rank FALSE. Nothing in this corpus carries a ladder tier: the
 *   recon's 73-channel sweep found rank tokens on zero channels, and Replay
 *   Theater's 244 rows have no rank column. This is the easy version of the
 *   call SF6, CotW and Strive each had to argue.
 *
 * - terms UNSET. The vendor's own pages, the partner site and the index source
 *   all say "character", so characterRouteSegment stays 'characters'.
 *
 * - NO artCredit, and that is a licence finding rather than an omission. The
 *   rights holder prohibits reuse of its art outright ("STRICTLY PROHIBITED
 *   WITHOUT THE PRIOR WRITTEN CONSENT", reference.paramount.com/terms-of-use,
 *   read 2026-09-18), publishes no fan kit, and the wiki copies are pixel-
 *   identical to the vendor's own renders, so they inherit the same terms.
 *   Every portrait here is therefore GENERATED (scripts/art.ts) and owes no
 *   credit to anyone. data/art-provenance.json carries the citation and the
 *   expiry that re-checks for a fan kit.
 *
 * Accents are transcribed from design/handoff/tokens.css (--char-*), the design
 * system's source of truth — scripts/characters.ts reads the same block when
 * building data/characters.json, so config and data cannot drift, and a roster
 * id with no token fails loud rather than shipping an unstyled fighter.
 *
 * THE KEYS HERE ARE THE HANDOFF'S OWN SHORT IDS, and that reverses the sibling
 * precedent on purpose. CotW and Strive both chose full-name kebab because
 * ComboForge keys characters by full name — measured, on those games. Measured
 * on THIS game's partner entry, the opposite holds: their ids are short
 * (`ava-toph`, `ava-ozai`, `ava-kyoshi`), short ids derive 10 of 12 links
 * against full-name ids' 8, and the short forms are also what the vendor's own
 * patch notes, the index source and the in-game roster say. Checklist 11c is
 * the rule this produced: measure the partner's convention per game, never
 * inherit the prior.
 */
export default defineAppConfig({
  game: {
    id: 'avatar',
    slug: 'avatar',
    name: 'Avatar Legends: The Fighting Game',
    // "AVATAR/REPLAY" in the header wordmark. The full title is four words and
    // would wrap at every breakpoint; "AVATAR" is what the vendor's own
    // shorthand, the community and the shell's Coming Soon card all use. Pure
    // ASCII, so no latin-ext dependency in the display face.
    shortName: 'AVATAR',
    // From the vendor's own legal notice, verbatim where it matters: the Steam
    // legal_notice and the avatarfighters.com footer both read "© 2026 Viacom
    // International Inc. … trademarks of Viacom International Inc." The engine
    // renders this as "Unofficial fan project · not affiliated with {…}", so
    // it names the parties a viewer would check: the trademark owner, the
    // developer and the publisher. The handoff's "© Paramount" is the one
    // spelling no vendor surface actually uses.
    rightsHolder: 'Viacom International Inc., Gameplay Group International or PM Studios',
    baseURL: '/avatar', // behind the shell at replaydatabase.com/avatar
    siteUrl: 'https://replaydatabase.com',
    // Web Analytics beacons go to THIS project instead of pooling into the
    // shell. Paired 1:1 with the shell vercel.json rewrite
    //   /avatar-insights/:path* → https://avatar-replay-database.vercel.app/_vercel/insights/:path*
    // — the two ship together or every beacon 404s, silently. Same-origin on
    // purpose: the child's endpoints send no CORS headers, so an absolute URL
    // here would die at preflight.
    observability: { insights: '/avatar-insights' },
    charactersPerSide: 1,
    filters: {
      coOccurrence: false,
      rank: false,
    },
    // THIRTY-THREE SOURCES, 1:1 WITH scripts/channels.ts AND HAND-KEPT IN STEP.
    // Two TypeScript tracks and no compiler sees both, so the id/name pairs
    // below are checked against CHANNELS by the NAME SYNC gate in
    // scripts/e2e.ts — the only place both files are visible at once. An id here
    // that channels.ts does not emit produces a chip nothing can ever select; a
    // name that drifts produces two different labels for one source depending on
    // which surface you are looking at.
    //
    // The order mirrors channels.ts, which is DEDUPE PRECEDENCE — committed-
    // corpus size first, grammar quality breaking near-ties — so the two files
    // read as one list. Nothing in the engine depends on that order; it is here
    // so a reviewer can diff them by eye.
    //
    // Why thirty-three rather than a handful of tidy buckets: this game is eight
    // weeks old, its largest single contributor is 57 of 367 records (15.5%),
    // and the corpus is a long tail of small channels rather than a few big
    // archives. Collapsing them into source tokens would throw away the
    // per-channel deep link and the per-channel dedupe precedence. The CHIPS
    // collapse instead — see sourceGroups.
    sourceChannels: [
      { id: 'aegisEsports', name: 'Aegis Esports' },
      { id: 'still', name: 'STiLL' },
      { id: 'ndyTv', name: 'NdyTV' },
      { id: 'toledoLocals', name: 'Toledo Locals' },
      { id: 'arinKarin', name: 'ArinKarin' },
      { id: 'cow', name: 'Cow' },
      { id: 'saltyRecoveryCenter', name: 'Salty Recovery Center FGC' },
      { id: 'skeet', name: 'Skeet' },
      { id: 'unrivaledTournaments', name: 'Unrivaled Tournaments' },
      { id: 'normalMs', name: 'NORMAL MS' },
      { id: 'rood', name: 'Rood' },
      { id: 'an11Mo', name: 'An11-_-MO' },
      { id: 'natsuXenoblade', name: 'Natsu_Xenoblade' },
      { id: 'takeANappa', name: 'Take A Nappa' },
      { id: 'versusFestival', name: 'The Versus Festival' },
      { id: 'avianZebra', name: 'Avian Zebra' },
      { id: 'kmlTournaments', name: 'KML Tournaments' },
      { id: 'teo1029', name: 'teo1029' },
      { id: 'mysteryRacer21', name: 'MysteryRacer21' },
      { id: 'xcaliburBladez', name: 'XCalibur BladeZ' },
      { id: 'schoolBus', name: 'SchoolBus' },
      { id: 'superSalemFighters', name: 'Super Salem Fighters' },
      { id: 'redVsFantasy', name: 'REDvsFantasy' },
      { id: 'mikeyChiFgc', name: 'Mikey' },
      { id: 'kang', name: 'KANG' },
      { id: 'phoenixWrong', name: 'PhoenixWrongSSB' },
      { id: 'kovac', name: 'Kovac' },
      { id: 'atma00', name: 'Atma_00' },
      { id: 'towito', name: 'Towito' },
      { id: 'redblade', name: 'Redblade' },
      { id: 'saxxiefone', name: 'saxxiefone' },
      { id: 'drewShoto', name: 'drew Shoto' },
      { id: 'replayTheater', name: 'Replay Theater' },
    ],
    // Two chips over thirty-three sources. Without this the filter row renders
    // 33 chips and is unusable at every breakpoint; with it the badge, the data
    // and the ?source= deep link stay per channel and only the chips collapse.
    //
    // THE GROUP IS THE UPLOADER'S KIND, NOT THE RECORD'S. A record already says
    // where it was played — the engine prints Replay.event instead of the source
    // name when one is present — so a tournament set from a player's own channel
    // shows its event on the card while its chip stays under Online. Grouping by
    // the record instead would need a second pass over the data and would still
    // disagree with the badge on the same card.
    //
    // Tournament is the nine intakes that publish other people's brackets:
    // seven event organisers, plus the index, whose rows are event-tagged on 170
    // of 244. Online is the twenty-four player and creator channels publishing
    // their own netplay sets. Where a channel does both — STiLL uploads Aegis
    // tournament sets, REDvsFantasy a CEO grand final — it is filed by what it
    // mostly is, and the event on the record carries the rest.
    sourceGroups: [
      {
        id: 'online',
        name: 'Online',
        sources: [
          'still',
          'arinKarin',
          'cow',
          'skeet',
          'normalMs',
          'rood',
          'an11Mo',
          'natsuXenoblade',
          'takeANappa',
          'avianZebra',
          'teo1029',
          'mysteryRacer21',
          'xcaliburBladez',
          'schoolBus',
          'redVsFantasy',
          'mikeyChiFgc',
          'kang',
          'phoenixWrong',
          'kovac',
          'atma00',
          'towito',
          'redblade',
          'saxxiefone',
          'drewShoto',
        ],
      },
      {
        id: 'tournament',
        name: 'Tournament',
        sources: [
          'aegisEsports',
          'ndyTv',
          'toledoLocals',
          'saltyRecoveryCenter',
          'unrivaledTournaments',
          'versusFestival',
          'kmlTournaments',
          'superSalemFighters',
          'replayTheater',
        ],
      },
    ],
    // Top 8 of a 12-fighter roster, and the meta chart gets the whole row —
    // no GameStatsPanels override ships, so the `beside-timeline` anchor is
    // empty.
    stats: {
      metaTimelineTopN: 8,
      metaTimelineFullWidth: true,
    },
    accents: {
      // Launch roster (2026-07-23), by nation — the handoff's own grouping.
      // Water Tribe
      katara: '#62C5EF',
      korra: '#64A1EE',
      sokka: '#ACD1E7',
      // Earth Kingdom
      toph: '#85CD75',
      kyoshi: '#45A075',
      // Fire Nation
      zuko: '#FF9284',
      azula: '#EE79A1',
      ozai: '#DE6907',
      // Air Nomads
      aang: '#F7CC4B',
      zaheer: '#A6A266',
      // Avatar State slots — separate roster entries with their own
      // achievements, their own partner ids and their own supports.
      'avatar-aang': '#B7F0FB',
      'nightmare-korra': '#B28FEF',

      // Announced, not released (data/characters.json gates them; see
      // scripts/expiries.ts). Tokens live here from day one so the UNRELEASED
      // gate has a colour the moment a fighter ships.
      bolin: '#D3D979',
      'lin-beifong': '#A8BEAC',
      iroh: '#FCB26F',
      'ty-lee': '#F59ECF',
      tagah: '#F7E6C3',
    },
    // Era → patch hierarchy. PIPELINE-EMITTED (scripts/emit.ts →
    // data/patchGroups.json) from the same boundary authority that derives
    // every replay's patch token, so the UI hierarchy and the data cannot
    // drift. Vercel never runs the pipeline, so that artifact is committed.
    patchGroups,
    fonts: {
      display: 'Cinzel',
      ui: 'Figtree',
      mono: 'JetBrains Mono',
    },
    // Built and gated with the engine's `npm run verify:comboforge`. Do not
    // paste `--suggest` output raw: it emits unquoted hyphenated keys, and on
    // an empty repo it cannot run at all (it reads data/characters.json).
    // Their game id is `ava`, not our slug. Two overrides, because their id for
    // the Avatar State Korra slot is out of date against their own display
    // name ("Nightmare Korra").
    comboforge: {
      gameId: 'ava',
      characters: {
        'avatar-aang': 'avatar-state-aang',
        'nightmare-korra': 'avatar-state-korra',
      },
    },
  } satisfies GameConfig,
});
