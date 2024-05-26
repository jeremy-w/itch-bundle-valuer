// EXECUTION CONTEXT: https://itch.io/my-purchases
/**
@typedef {Object} PurchasePage
@property {string}  content HTML when there are items, empty string if none.
@property {number} num_items 0 if you've exceeded the necessary number of pages, else max of 50.
@property {number} page Starts at page 1, not 0, but 0 is treated as 1, rather than an error.
 */

let urlForPage = (/** @type {number} */ number) =>
  `https://itch.io/my-purchases?format=json&page=${number}`;

/** @returns {Promise<PurchasePage>} */
async function fetchMyPurchasesPage(/** @type{number} */ pageNumber) {
  console.log(`Fetching My Purchases page ${pageNumber}`);
  let url = urlForPage(pageNumber);
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) {
    console.error(
      `Error fetching My Purchases page ${pageNumber} at ${url}: Status ${res.status} ${res.statusText}`,
      res
    );
    return { content: "", num_items: 0, page: pageNumber };
  }

  let json = await res.json();
  console.log(
    `Fetched My Purchases page ${pageNumber} from ${url}: ${json.num_items} items`
  );
  return json;
}

/** Docs: https://github.com/cheeriojs/cheerio/blob/main/Readme.md */
let cheerio = await import("https://esm.sh/cheerio@1.0.0-rc.12");
// DUPE of gamesFromSalesBundleHtml with shorter gamedivs selector, since this doesn't have noise from promos at the bottom
function gamesFromMyPurchasesContent(/** @type{string} */ html) {
  const $ = cheerio.load(html);
  const gamedivs = $("div[data-game_id]");
  // gamedivs.map just gave indices for some reason.
  const games = [];
  for (let gamediv of gamedivs) {
    const id = Number.parseInt($(gamediv).attr("data-game_id"), 10);
    const title = /** @type{string} */ (
      $(".game_cell_data a.game_link", gamediv).text()
    ).trim();
    const url = /** @type{string} */ (
      $(".game_cell_data a.game_link", gamediv).attr("href")
    );
    const short_text = /** @type{string} */ (
      $(".game_text", gamediv).text()
    ).trim();
    const price = /** @type{string} */ (
      $("a.price_tag .price_value", gamediv).text()
    ).trim();
    const classification = "";
    const author = $(".game_author", gamediv);
    const user = {
      id: Number.parseInt($("a", author).attr("data-label").split(":")[1]),
      name: /** @type{string} */ (author.text()).trim(),
      url: /** @type{string} */ ($("a", author).attr("href")),
    };
    const game = {
      id,
      title,
      short_text,
      url,
      price,
      user,
      classification,
    };
    games.push(game);
  }
  return games;
}

// DUPE
function sleep(millis) {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(millis), millis);
  });
}
async function loadMyPurchases(startingAtPage = 1) {
  let myPurchases = [];
  let itemCount = 0;
  for (let pageNumber = startingAtPage; true; ++pageNumber) {
    const page = await fetchMyPurchasesPage(pageNumber);
    itemCount += page.num_items;
    if (page.num_items <= 0) {
      console.log(
        `Finished fetching My Purchases: ${
          pageNumber - 1
        } pages, ${itemCount} total purchased items.`
      );
      return myPurchases.flat();
    }

    const pagePurchases = gamesFromMyPurchasesContent(page.content);
    const delta = page.num_items - pagePurchases.length;
    if (delta !== 0) {
      console.error(
        `Parsing of My Purchases page ${pageNumber} yielded ${
          pagePurchases.length
        } purchases, but the page is supposed to have ${
          page.num_items
        } purchases! ${delta > 0 ? "Missing" : "Extra"} ${delta} items!`
      );
    }
    myPurchases.push(pagePurchases);

    const sleepMillis = 500 + Math.floor(Math.random() * 2000);
    console.log(`sleeping ${sleepMillis} ms before next fetch`);
    await sleep(sleepMillis);
  }
}

// DUPE from purchased_bundles. Probably should just move this all into a userscript at some point, then it can share functions.
// Source: https://stackoverflow.com/a/65939108 by [MSOACC](https://stackoverflow.com/users/5819046/msoacc)
const saveTemplateAsFile = (filename, dataObjToWrite) => {
  const blob = new Blob([JSON.stringify(dataObjToWrite)], {
    type: "application/json",
  });
  const link = document.createElement("a");

  link.download = filename;
  link.href = window.URL.createObjectURL(blob);
  link.dataset.downloadurl = [
    "application/json",
    link.download,
    link.href,
  ].join(":");

  const evt = new MouseEvent("click", {
    view: window,
    bubbles: true,
    cancelable: true,
  });

  link.dispatchEvent(evt);
  link.remove();
};

let myPurchases = await loadMyPurchases();
let now = new Date();
saveTemplateAsFile(`my_purchases_games_${+now}.json`, myPurchases);
