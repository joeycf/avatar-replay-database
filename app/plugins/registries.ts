import characters from '../../data/characters.json';
import players from '../../data/players.json';
import stats from '../../data/stats.json';
import type { Character, KnownStats, Player } from '@engine/types';

/**
 * Hand the small registries to the engine at build time.
 *
 * PROVIDED, not fetched: bundled once and synchronously available during
 * prerender, which is what makes /characters/:id and /players/:id emit real
 * HTML with data-derived titles instead of an empty shell the crawler sees.
 * A prerender-time $fetch cannot read the app's own public/ (STACK §5.6), so
 * "just fetch it" is not an option for anything a prerendered page renders.
 *
 * The two client-fetched files are deliberately NOT here: replays.json is the
 * whale, and summary.json is the apex selector's card payload rather than a
 * registry. Both are copied into public/data by nuxt.config's build:before
 * hook and read under the base path at runtime.
 *
 * Avatar's registries are the platform's smallest — a 12-fighter roster and a
 * player list in the low hundreds — so the cost argument that dominates on
 * Strive does not arise here. The support namespace is not a registry: it is
 * carried on the record and resolved through the same characters.json rows
 * (`supports`), because a support is a property of a pick, not an entity with
 * a page.
 */
export default defineNuxtPlugin(() => {
  provideRegistries({
    characters: characters as Character[],
    players: players as Player[],
    stats: stats as KnownStats,
  });
});
