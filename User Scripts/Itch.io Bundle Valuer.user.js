// ==UserScript==
// @name        Itch.io Bundle Valuer
// @description Shows value of unowned games in a charity bundle, and shows each game's price alongside its title. NOTE: Only works if you edit the script to change the `ownedGameIds` variable to list the games that you own, rather than me.
// @match       https://itch.io/b/*
// @author      Jeremy W. Sherman <https://jeremywsherman.com>
// @copyright 2024, Jeremy W. Sherman. Licensed under the [BlueOak-1.0.0 license](https://blueoakcouncil.org/license/1.0.0) by [Jeremy W. Sherman](https://jeremywsherman.com).
// @source    https://github.com/jeremy-w/itch-bundle-valuer
// @version    1.0
// ==/UserScript==
(async function itchBundleValuer() {
    'use strict';
var ownedGameIds = new Set(
// BEGIN game_ids.json
[]
// END game_ids.json
)
let gamesUrl = (location) => {
    const path = location.pathname;
    if (!path.startsWith('/b/')) return '';

    const url = path.replace(/^\/b\/(\d+)\/.*/, '/bundle/$1/games.json')
    return url
}
let addPricesObserver = null;
function addPrices(games) {
    let notAllLoaded = false;
    const markerClass = 'jws-price-suffixed'
    for (const game of games) {
        const titleAnchor = document.querySelector(`[data-game_id="${game.id}"] div.label a`)
        if (!titleAnchor) {
            notAllLoaded = true;
            continue;
        }
        if (titleAnchor.classList.contains(markerClass)) {
            // Already added the price on.
            continue;
        }
        titleAnchor.textContent += ` - ${game.price ?? ''}${game.flag ?? ''}`
        titleAnchor.classList.add(markerClass)
    }
    console.log(`addPrices: notAllLoaded=${notAllLoaded}`)
    if (notAllLoaded && !addPricesObserver) {
        const container = document.querySelector('[data-game_id]').parentElement;
        console.log('addPrices: Establishing mutation observer for further loads.')
        addPricesObserver = new MutationObserver(async (_mutations, _observer) => {
            addPrices(games);
        });
        addPricesObserver.observe(container, { subtree: true, childList: true });
    } else if (!notAllLoaded) {
        console.log('addPrices: All loaded, disconnecting observer.')
        addPricesObserver.disconnect();
    }
}
/**
Possible price strings are:

$3
5.00€
£3
£1.99
R$15 (Brazilian reais)

And probably more, but these are the ones I've seen so far.

@returns {[symbol: string, amount: number]}
*/
let priceEntry = (/** @type{string} */priceString) => {
  const symbol = priceString.replace(/[0-9.,]/g, "");
  const amount = Number.parseFloat(priceString.replace(/[^0-9.]/g, ""));
  //   console.log(`${priceString} => [${symbol}, ${amount}]`);
  return ([symbol, amount]);
};
let symbolValues = {
    '$': 1,
    '£': 1.27,
    '€': 1.08,
    'R$': 0.19,
}
let codes = {
  $: "USD",
  "£": "GBP",
  "€": "EUR",
  R$: "BRL",
};
function stickAmountOnPage(msg) {
    if (document.querySelector('#jws-bundle-value')) {
        return;
    }
    const parent = document.querySelector('div.promotion_meta')
    const strong = document.createElement('strong')
    strong.id = 'jws-bundle-value'
    strong.textContent = msg
    const p = document.createElement('p');
    p.appendChild(strong);
    parent?.appendChild(p);
}
function generateValueMessage(value, unownedGameCount) {
  const formatters = Object.fromEntries(
    Object.keys(value).map((currencySign) => [
      currencySign,
      codes[currencySign]
        ? new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: codes[currencySign],
          })
        : undefined,
    ])
  );
  // FIXME: This looks silly when the only currency in use is USD. Omit stringified when that's the case.
  const stringified = Object.entries(value)
    .map(([symbol, amount]) =>
      formatters[symbol]
        ? formatters[symbol]?.format(amount)
        : `${symbol}${amount}`
    )
    .join(", ");
  const approx = Object.entries(value)
    .map(([symbol, amount]) => {
      let approxValueInUsd = symbolValues[symbol];
      if (!approxValueInUsd) {
        console.error(
          `No currency conversion defined in |symbolValues| for symbol: [${symbol}]`
        );
        approxValueInUsd = 1;
      }
      return approxValueInUsd * amount;
    })
    .reduce((accu, it) => accu + it, 0);
  const fmt = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  });
  const countFmt = new Intl.NumberFormat("en-US");
  const msg = `${countFmt.format(
    unownedGameCount
  )} new games. Approximate total value in USD: ${fmt.format(approx)}${
    stringified ? `, by way of ${stringified}` : ""
  }.`;
  return msg;
}
/** Given on a sales bundle page, meaning URL path beginning /s/, computes the value of the unowned items. */
async function computeSalesBundleValue() {
  /** @type{HTMLElement[]} */
  const gamedivs = Array.from(
    document.querySelectorAll(".sale_page .game_grid_widget div[data-game_id]")
  );
  const unownedGameDivs = gamedivs.filter(
    (it) => !ownedGameIds.has(Number.parseInt(it.dataset.gameId ?? ""))
  );
  const unownedGamePrices = unownedGameDivs
    .map((gameDiv) =>
      gameDiv?.querySelector("a.price_tag .price_value")?.textContent?.trim() ?? ''
    )
    .filter((it) => it.length > 0);
  const value = unownedGamePrices.reduce((accu, priceString) => {
    /* TODO: What about Web and Free items in a sale? */
    const [key, value] = priceEntry(priceString);
      if (!accu[key]) {
        console.log(
          `New currency symbol: ${key} - from price string: ${priceString}`
        );
        accu[key] = 0;
      }
      accu[key] += value;
      return accu
  }, {})
  /* TODO: Synthesize price and plop on page. */
}
async function computeBundleValue() {
    console.log(`JWS: Computing bundle value`)
    let loc = gamesUrl(document.location)
    if (!loc) {
      if (loc.pathname.startswith("/s/")) {
        return computeSalesBundleValue();
      }
      console.error("JWS: no game URL returned");
      return;
    }

    console.log(`JWS: Fetching games.json from ${loc}`)
    const res = await fetch(loc, { credentials: 'same-origin' })
    if (!res.ok) {
        console.error('JWS: failed fetching games.json')
        return
    }
    const {games} = await res.json()
    addPrices(games);
  const unownedGames = games.filter((it) => !ownedGameIds.has(it.id));
  console.log(
    `JWS: Found ${games.length} total games, ${unownedGames.length} unowned games.`
  );
  const value = unownedGames.reduce((accu, game) => {
    try {
      if (game.flag === "free" || game.flag === "web") {
        return accu;
      }
      const [key, value] = priceEntry(game.price);
      if (!accu[key]) {
        console.log(
          `New currency symbol: ${key} - from price string: ${game.price}`
        );
        accu[key] = 0;
      }
      accu[key] += value;
      //   console.log(`Now at ${key}${accu[key]}`);
    } catch (error) {
      console.error(`Failed to price a game.`, { game, error });
    }
    return accu;
  }, {});
  const msg = generateValueMessage(value, unownedGames.length);
  console.log(msg);
  done(msg)
  stickAmountOnPage(msg)
}

console.log('Loaded user script: Itch.io Bundle Valuer')
let done = (_) => {}
let bundleValueMessage = new Promise(resolve => { done = resolve })
const observer = new MutationObserver(async (_mutations, _observer) => {
    const msg = await bundleValueMessage;
    stickAmountOnPage(msg);
});
observer.observe(document, { subtree: true, childList: true });
await computeBundleValue();
})()
