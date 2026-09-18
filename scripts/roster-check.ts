/**
 * Roster drift check — is data/characters.json still what the vendor ships?
 *
 * WHY THIS EXISTS. A roster goes stale silently: a fighter who is not on it
 * fails no build and trips no assertion, they just leave every match they appear
 * in filed with one side missing. See ../check-rosters.sh, which runs this and
 * reads only the `roster-check: <STATE>` trailer at the bottom.
 *
 * ── THE TWO ENUMERATIONS ARE NOT TWO VIEWS OF ONE LIST ────────────────────
 * Strive's checker reads a character grid and a sitemap: two complete
 * enumerations that should agree, where a disagreement means one scrape broke.
 * This vendor has nothing of the kind, and pretending otherwise is the trap:
 *
 *   paramountgames.com  FIRST-PARTY AND INCOMPLETE. Its roster widget ships a
 *                       `fighters[]` array of EIGHT and simply omits Zaheer,
 *                       Ozai, Avatar Aang and Nightmare Korra. It is the only
 *                       surface that states each fighter's ELEMENT and the only
 *                       one whose keys are our ids, so it is the NAME AND NATION
 *                       CONTROL. A checker that treated it as the roster would
 *                       report four fighters as removed, every run, forever.
 *   Steam achievements  COMPLETE, KEYLESS AND MACHINE-READABLE. Twelve
 *                       `ach_match_won_<token>` rows plus an
 *                       `ach_match_won_all` aggregate. This is THE COUNT, and it
 *                       moves the day a thirteenth fighter ships — before any
 *                       store page is rewritten and before any footage reaches
 *                       the cron.
 *   Steam store prose   "Choose from 12 playable characters", a third statement
 *                       of the count in a fourth place. Used as a CONTROL on the
 *                       achievement count, never as an enumeration: prose is
 *                       what a vendor forgets to update, and this vendor's own
 *                       store page still carries the wrong release date.
 *
 * IT GATES ON STRUCTURE, NEVER ON A FILENAME. paramountgames.com is a Next.js
 * app and the chunk carrying `fighters[]` is content-hashed — Stage 0 read
 * `page-997bea5bc54fdf44.js` and the next deploy will rename it. scripts/roster.ts
 * discovers it from the page's own script tags by ROUTE PATH. A checker keyed on
 * the hash would go green on a 404.
 *
 * IT COMPARES VENDOR KEYS, NOT NAMES, for the same reason Strive compares site
 * slugs: two of this roster's twelve have achievement tokens nobody could derive
 * (`aang_avchar`, `korra_nightmare`), and the vendor spells two fighters two
 * ways across its own surfaces. Names are for humans; keys are for machines. The
 * names are still checked — against the one surface that publishes them as data
 * — but a name disagreement and a roster disagreement are different findings and
 * are reported as such.
 *
 * THE PAIR THIS FORMS WITH scripts/expiries.ts. This checker is CONTENT-AWARE
 * and fires on the real event — a new achievement token appearing upstream.
 * expiries.ts is CLOCK-AND-CORPUS and nothing upstream can blind it. Keep both;
 * this repo's siblings learned that the sophisticated check is the one that goes
 * quietly blind.
 *
 * NETWORK, MANUAL, NEVER IN THE CRON.
 *
 * Run: npm run data:roster-check
 */

import { UNRELEASED } from './expiries';
import { loadCharacters, loadSupports, scrapeRoster } from './roster';

type State = 'CURRENT' | 'DRIFT' | 'UNVERIFIED' | 'UNREADABLE';

const verdict = (state: State, detail = ''): never => {
  if (detail) console.log(detail);
  console.log(`roster-check: ${state}`);
  process.exit(state === 'CURRENT' || state === 'UNVERIFIED' ? 0 : 1);
};

async function main(): Promise<void> {
  const local = await loadCharacters();
  const supports = await loadSupports();
  const gated = new Set(UNRELEASED.map((u) => u.id));

  /** roster id → the vendor keys it claims. A row with no steamToken can never
   *  be matched against the one complete enumeration, so it is a defect in
   *  itself rather than drift. */
  const steamTokenOf = new Map<string, string>();
  const siteKeyOf = new Map<string, string>();
  const noToken: string[] = [];
  for (const c of local) {
    const extra = c.extra as { steamToken?: string; siteKey?: string } | undefined;
    if (extra?.steamToken) steamTokenOf.set(c.id, extra.steamToken);
    else noToken.push(c.id);
    if (extra?.siteKey) siteKeyOf.set(c.id, extra.siteKey);
  }
  if (noToken.length) {
    return void verdict(
      'UNREADABLE',
      `✖ ${noToken.length} roster row(s) carry no extra.steamToken: ${noToken.join(', ')}\n` +
        "  Nothing can be compared against the vendor's only complete enumeration for these.\n" +
        '  Fix ROSTER in scripts/characters.ts.',
    );
  }

  let scrape: Awaited<ReturnType<typeof scrapeRoster>>;
  try {
    scrape = await scrapeRoster();
  } catch (e) {
    return void verdict(
      'UNVERIFIED',
      `! could not read the vendor surfaces — ${(e as Error).message}`,
    );
  }

  // ── The scrapes' own health, before any verdict about US ─────────────────
  // A zero read is a parser that broke, not a vendor that deleted its roster,
  // and saying so is the difference between "teach the parser" and "delete
  // twelve fighters".
  if (scrape.achievementTokens.length === 0) {
    return void verdict(
      'UNREADABLE',
      "✖ Valve's achievement schema yielded no ach_match_won_* rows — either the endpoint\n" +
        '  changed shape or the achievement ids were renamed. This is the ONLY complete\n' +
        '  enumeration of this roster; nothing can be concluded without it.',
    );
  }
  if (scrape.site.length === 0) {
    return void verdict(
      'UNREADABLE',
      `✖ paramountgames.com yielded no fighters[] entries from\n  ${scrape.chunkUrl}\n` +
        "  The route chunk was found and its object literal did not parse — the site's bundle\n" +
        '  shape changed. Re-read scrapeRoster() in scripts/roster.ts before trusting the\n' +
        '  name and nation half of this check.',
    );
  }

  // The store's prose count is the control on the achievement count. If the
  // vendor's own two statements disagree, neither is a trustworthy baseline and
  // a verdict about OUR roster would mean nothing — so say so rather than
  // picking a side.
  if (scrape.statedCount !== null && scrape.statedCount !== scrape.achievementTokens.length) {
    return void verdict(
      'UNREADABLE',
      `✖ the vendor's own two counts disagree: the store says "${scrape.statedCount} playable\n` +
        `  characters" and the achievement schema carries ${scrape.achievementTokens.length}\n` +
        '  per-fighter rows. One of the two moved first — which is informative and is NOT a\n' +
        '  baseline. Read both before changing anything here.',
    );
  }

  // The site widget is a strict SUBSET, by design. It carrying a key we have
  // never heard of is real news; it omitting one is its normal state.
  const tokens = new Set(scrape.achievementTokens);
  const ourTokens = new Set(steamTokenOf.values());
  const siteKeys = new Set(scrape.site.map((f) => f.key));
  const ourSiteKeys = new Set(siteKeyOf.values());
  const siteOnly = [...siteKeys].filter((k) => !ourSiteKeys.has(k)).sort();
  if (siteOnly.length) {
    return void verdict(
      'UNREADABLE',
      `✖ paramountgames.com fighters[] carries key(s) no roster row claims: ${siteOnly.join(', ')}\n` +
        '  The widget is a partial list that only ever shrinks our way, so a NEW key there is\n' +
        '  either a fighter that shipped without an achievement (which has never happened) or\n' +
        '  a bundle whose object shape changed under the regex. Check the chunk by hand.',
    );
  }

  console.log(
    `  ${tokens.size} fighter achievement(s) upstream · ${local.length} in characters.json · ` +
      `${scrape.site.length} in the paramountgames widget (partial, by design)`,
  );
  console.log(
    `  store prose: ${scrape.statedCount ?? 'no'} playable characters · dlc ` +
      `${scrape.dlc.join(', ') || 'none'} · ${supports.length} support(s) committed`,
  );
  if (gated.size)
    console.log(`  ${gated.size} gated in UNRELEASED: ${[...gated].sort().join(', ')}`);

  const missing = [...tokens].filter((t) => !ourTokens.has(t)).sort();
  const extra = [...steamTokenOf.entries()].filter(([, t]) => !tokens.has(t)).sort();

  // Name and nation drift, from the one surface that publishes them as data.
  // Reported as DRIFT alongside a roster change rather than instead of it: a
  // renamed fighter and a new fighter are different jobs.
  const byId = new Map(local.map((c) => [c.id, c]));
  const idOfSiteKey = new Map([...siteKeyOf.entries()].map(([id, k]) => [k, id]));
  const renamed: string[] = [];
  for (const f of scrape.site) {
    const id = idOfSiteKey.get(f.key);
    const c = id ? byId.get(id) : undefined;
    if (!c) continue;
    if (c.name.toLowerCase() !== f.name.toLowerCase()) {
      renamed.push(
        `  NAME     ${c.id}: the vendor's fighters[].name is "${f.name}" and we ship "${c.name}".\n` +
          `           fighters[].name is the vendor's SHORT form and is what we ship on purpose —\n` +
          `           the handoff's longer spellings are aliases. If the vendor renamed a\n` +
          `           fighter, change ROSTER's name and move the old spelling into its aliases;\n` +
          `           the id is derived from the name, so it moves too.`,
      );
    }
    const nation = (c.extra as { nation?: string } | undefined)?.nation;
    if (nation !== f.element) {
      renamed.push(
        `  NATION   ${c.id}: the vendor's fighters[].element is "${f.element}" and we ship\n` +
          `           "${nation ?? 'nothing'}". The element drives the accent family in\n` +
          `           design/handoff/tokens.css, so this is a design decision as well as a\n` +
          `           data one.`,
      );
    }
  }

  if (!missing.length && !extra.length && !renamed.length) {
    return void verdict(
      'CURRENT',
      '✓ roster matches the achievement schema, and the site widget agrees on every name and ' +
        'element it publishes',
    );
  }

  const lines = ['✖ roster has drifted from the vendor', ''];
  for (const token of missing) {
    lines.push(
      `  MISSING  achievement token "${token}" — upstream, with no roster row claiming it.`,
      `           A fighter shipped. The NAME is the vendor's SHORT form: take it from the`,
      `           achievement text or the patch notes, never from the design handoff, which`,
      `           writes "Toph Beifong" and "Fire Lord Ozai" where every vendor surface writes`,
      `           "Toph" and "Ozai". Full runbook in scripts/expiries.ts — and remember the`,
      `           THREE SUPPORTS: a fighter with no supports is a half-added fighter, and a`,
      `           support with no index row must stay out.`,
    );
  }
  for (const [id, token] of extra) {
    lines.push(
      `  EXTRA    ${id} (steamToken "${token}") — in characters.json, not upstream.`,
      `           Confirm before deleting: committed records already reference this id, and a`,
      `           renamed achievement looks exactly like a removed fighter from here.`,
    );
  }
  lines.push(...renamed);
  verdict('DRIFT', lines.join('\n'));
}

await main();
