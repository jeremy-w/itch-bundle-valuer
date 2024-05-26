// Licensed under the [BlueOak-1.0.0 license](https://blueoakcouncil.org/license/1.0.0) by [Jeremy W. Sherman](https://jeremywsherman.com), except for the Stack Overflow snippet, which remains under its own license.
// Canonical repository: https://github.com/jeremy-w/itch-bundle-valuer
const ownedGameIds = new Set([
  991210, 991585, 991647, 992475, 992974, 993481, 993948, 994932, 995638,
  995771, 996175, 99668, 997159, 997479, 997757, 998150, 999294,
]);

let priceEntry = (priceString) => {
  const symbol = priceString.replace(/[0-9.,]/g, "");
  const amount = Number.parseFloat(priceString.replace(/[^0-9.]/g, ""));
  //   console.log(`${priceString} => [${symbol}, ${amount}]`);
  return [symbol, amount];
};
let symbolValues = {
  $: 1,
  "£": 1.27,
  "€": 1.08,
  R$: 0.19,
};
let codes = {
  $: "USD",
  "£": "GBP",
  "€": "EUR",
  R$: "BRL",
};
async function valueGames() {
  // Generate test games.json with: jq [.[].games.[]] < purchased_bundles_games_1716577193188.json > games.json
  const games = JSON.parse(
    Deno.readTextFileSync(`${import.meta.dirname}/../Example Data/games.json`)
  );
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
    unownedGames.length
  )} new games. Approximate total value in USD: ${fmt.format(approx)}${
    stringified ? `, by way of ${stringified}` : ""
  }.`;
  console.log(msg);
}
valueGames();
