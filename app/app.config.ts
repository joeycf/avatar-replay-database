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
