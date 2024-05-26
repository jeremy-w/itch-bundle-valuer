# Itch Bundle Valuer

- Goal:
  - Compute the value of a bundle, given all your existing Itch purchases
  - Dim already-owned games in bundle listings
- Non-Goal:
  - Incorporate knowledge of purchases in other storefronts, eg DTRPG
  - Be entirely automated. This is going to be some stuff to wire together with a human in the middle.

## Inputs

Cacheable:

- Owned/Claimed
  - In a logged-in browser session: https://itch.io/my-purchases?format=json&page=1
    - Paginated though
    - And it's just `{page:1,num_items:50,content:hugehtmlstring}`
    - So that's not very helpful really, but it's indeed the API that Itch
      itself uses, using `&page=N` for further pages. You know you're done when
      the `num_items` is less than 50 (for me, just now, page 24).
    - The API key is useless here; the key is the "Cookie: itchio=jwt" one.
      Ironically it doesn't care about the `itchio_key` cookie.
    - Once dumped using my_purchases in the browser, you can get a JSON array of just the game IDs using: `jq [.[].id] < my_purchases*.json`
- Bundles purchased, and the games in those bundles
  - The HTML listing purchased bundles is at https://itch.io/my-purchases/bundles; format=json does
    nothing.
  - The purchased bundle pages themselves do support JSON and are paginated
  - Once dumped using purchased_bundles in the browser, you can get a JSON array of just the game IDs using: `jq [.[].games[].id] < purchased_bundles_games*.json`
- But what we really want is the union of them as a set, so let's use deno to read in the jsons and then throw all the game IDs into a set and write them back out as a sorted array:

```ts
let my_purchases = JSON.parse(
  Deno.readTextFileSync("my_purchases_games_1716653463579.json")
);
let bundles = JSON.parse(
  Deno.readTextFileSync("purchased_bundles_games_1716577193188.json")
);
let ownedGameIds = new Set(
  my_purchases
    .map((it) => it.id)
    .concat(bundles.flatMap((it) => it.games).map((it) => it.id))
);
ownedGameIds.size; // 4855
let list = Array.from(ownedGameIds).sort();
Deno.writeTextFileSync("game_ids.json", JSON.stringify(list));
let css =
  `/* ==UserStyle==
@name        Itch.io Owned Game Dimmer
@description Dims owned games. Generated from a list of owned game IDs.
@match       https://itch.io/*
@exclude     https://itch.io/my-purchases*
==/UserStyle== */
/*! Last updated: ${new Date().toISOString()} */` +
  list.map((it) => `[data-game_id="${it}"]`).join(",") +
  "{ opacity: 30% !important; }";
Deno.writeTextFileSync("dim_game_ids.css", css);
```

Then can dupe to user script to hide owned game IDs too, with header:

```js
/* ==UserStyle==
@name        Itch.io Owned Game Hider
@description Dims owned games. Generated from a list of owned game IDs.
@match       https://itch.io/*
@exclude     https://itch.io/my-purchases*
==/UserStyle== */
```

Per query:

- The bundle to value

## Switching to browser user script?

### How to tell if you own a game on the game's page?

Look for something like:

```html
<div class="purchase_banner above_game_banner">
  <div class="purchase_banner_inner above_game_banner_inner">
    <h2>You own this TTRPG Enemy AI Tool</h2>
    <div class="key_row">
      <a
        href="https://cursenightgames.itch.io/monsterai/download/SECRET_KEY_GOES_HERE"
        class="button"
        >Download</a
      >
      <span class="ownership_reason"
        >Included in
        <a href="https://itch.io/b/2256/solo-but-not-alone-4"
          >Solo But Not Alone 4</a
        >
        <span class="own_date">133 days ago</span></span
      >
    </div>
  </div>
</div>
```

So, finding `div.purchase_banner` should do it, on a blah.itch.io/blah URL.

### Finding games in a bundle for sale

Example: https://itch.io/b/2460

Hmm, all the bundle sale listings have a data-game-id set on them. If you had a list
of all owned game-ids, you'd know what you already own. And could just hide
them! With like `div[data-game-id="known-value"] { display: none }`, or dim
by setting opacity: 30%. You do have to scroll to the bottom to get it to
load them all.

### Finding games in a purchased bundle

Example: https://itch.io/bundle/download/KEY

But the _purchased_ bundles instead are paginated (not infini-scroll) with the
game-ids buried in `div.game-row form input[name="game_id"]`.

### Finding purchased games

And those can overlap with the purchased games list, where the game ids are
in `div.game_cell[data-game_id]`. And that's another infiniscroller.
And we can iterate it rapidly programmatically and fish out the game IDs
with: `rg -P -o '(?<=data-game_id=)[^> ]+'` and some filtering to clean up.

### Finding purchased bundles

This doesn't seem to be paginated, and lives at
https://itch.io/my-purchases/bundles.

URL is in `section.bundle_keys a[href]`. The anchors have the bundle name as
text. And then you can go and pull the purchased games for that bundle,
but you have to walk the pages, `?page=N` at the end of the URL.
Last page is at `.pager_label a[href]`, which is like `?page=13`.
The anchor text is the page number, unclear if formatted with commas for
thousands or whatever, but the href should be good to go anyway.

## So assuming a file with game IDs owned

You can then dim the ones you already own in a bundle.

And probably also tot up the ones you don't pretty readily.

And that's what I want to do, hooray!

Ooh! And the full bundle games list is at:
https://itch.io/bundle/2460/games.json

And the game IDs are at `games[].id`. And prices at `games[].price`, though
it's pre-formatted as currency, so that is a little annoying.

So this sorta is scriptable as hoped anyway! But the live-dimming is handy
too. Why not both?

### Updating the dataset

Do want to think about how to update this as well. The purchased list is
from newest to oldest. The bundles list is too. So if we just track the
bundle IDs or URLs that the game IDs trace back to, and the first game ID in
our purchased list, we should be good to go to just add on the new stuff!

Data to track:

- Bundle (going to always be pulled from the bundle's sale page, since that has a convenient games.json)
  - Bundle ID - not available on purchased page? you'd have to visit the download page then grab `span.object_title a[href]` and parse it from eg href="/b/2321/palestinian-relief-bundle"
    - Bundle URL - like /b/1234 or /b/1234/slug-here - have to visit the bundle download page to grab, see Bundle ID above
    - Bundle Name `section.bundle_keys li a`.textContent
    - PurchaseDate `section.bundle_keys li abbr[title]`, formatted like title="28 April 2024 @ 15:29 UTC"
    - Download URL `section.bundle_keys li a[href]` (this gives us the bundle URL and thus ID)
- BundleGame
  - Bundle ID
    - Game ID
      - Price (not sure if this is per-bundle or just the latest price of the game itself, but putting here since we won't have it for owned non-bundle games)
- Game
  - Game ID
    - Game name
    - User ID
    - Short text (maybe)
    - URL (for owned games, can get from download key by stripping off /download/ and everything following)
    - ~~PurchaseDate~~ **not available**
- User (from div.game_author on purchased page)
  - User ID (1234567)
    - Name (Foo Industries, Inc.)
    - URL (e.g. foo.itch.io)

### Initial collection

- Grab the purchased list by pulling it page by page with curl (#PAGES requests)
  - Includes purchases _not_ from bundles, as well as games claimed via keys as eg crowdfunding fulfillment.
  - But likely includes a LOT of bundle games, either because they came from the bundle, or they were later included in a bundle.
  - And also omits a lot of unclaimed bundle games, yay
- Grab the list of bundles with a script (1 request)
  - Curl each bundle's page and find its bundle sale page (#BUNDLES requests)
    - Grab the bundle's list of games from its sale page (#BUNDLES requests, total)

So just 2\*#BUNDLES + #PAGES requests to get the full "what I own" dataset.

And then just need to be able to easily answer "do I own this game-id?" to compute bundle value and dim already-owned games. So dump a list of owned game IDs to a JS object of game-id: true entries for a user script to work with.

## GOTCHA: Sales Bundles have no games.json

Sales bundles (with URLs like /s/1234) don't have a games.json. So we have to spelunk the HTML.

Trying to do this with regex like we did the bundle URL hurts my head, so I'm pulling in cheerio. (I tried jsdom, but it won't load in a browser.) unpkg doesn't convert cjs to esm, but esm.sh does, so we're using that.

So take an example sale bundle: https://itch.io/s/80723/horror-worlds-bundle

- Each game for sale is in: `.sale_page .game_grid_widget div.game_cell[data-game_id]`, call it G
  - id: G.`data-game_id` as base-10 number
  - title: G.`.game_cell_data a.game_link`.textContent
  - url: G.`.game_cell_data a.game_link`.getAttribute('href')
  - short_text: `.game_text`.textContent
  - price: `a.price_tag .price_value` like '$4'
  - user:
    - id: `.game_author a`.dataset.label.split(':')[1], because it looks like `user:12345`
    - name: `.game_author`.textContent
    - url: `.game_author a`.getAttribute('href')
  - classification: **not present on sale page**

## Parsing My Purchases list

- Each game for sale is in: `div.game_cell[data-game_id]`, call it G

  - id: G.`data-game_id` as base-10 number
  - title: G.`.game_cell_data a.game_link`.textContent
  - url: G.`.game_cell_data a.game_link`.getAttribute('href')
    - But this needs trimming to not include the download token by a further `.replace(/\/download\/[^/]+$/, '')`
  - short_text: **Not present on My Purchases page.**
  - price: **Not present on My Purchases page.**
  - user:
    - id: `.game_author a`.dataset.label.split(':')[1], because it looks like `user:12345`
    - name: `.game_author`.textContent
    - url: `.game_author a`.getAttribute('href')
  - classification: **not present on My Purchases page**

  So overall, very similar to the bundle sale page.
