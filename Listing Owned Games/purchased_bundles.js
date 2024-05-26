// Dev Console Script
// ASSUMED EXECUTION CONTEXT: https://itch.io/my-purchases/bundles
// Licensed under the [BlueOak-1.0.0 license](https://blueoakcouncil.org/license/1.0.0) by [Jeremy W. Sherman](https://jeremywsherman.com), except for the Stack Overflow snippet, which remains under its own license.
// Canonical repository: https://github.com/jeremy-w/itch-bundle-valuer
let bundleListItems = Array.from(document.querySelectorAll('section.bundle_keys li'))

/**
@typedef {Object} User
@property {number} id
@property {string} url Like 'https://user.itch.io'
@property {string} name
 */
/**
@typedef {Object} Game
@property {number} id
@property {string} title
@property {string} short_text A headline description
@property {string} url Like 'https://user.itch.io/gamename'
@property {string} price Like '$5.99'
@property {User} user
@property {string} classification Tag like 'physical_game'
*/
/**
@typedef {Object} Bundle
@property {'bundle'} type
@property {string} name
@property {string|undefined} purchaseDate
@property {string} downloadUrl
@property {string} url
@property {number} id
@property {Game[]} games
 */
let bundles = bundleListItems.map(it => (/** @type Bundle */{
    type: /** @type {const} */('bundle'),
    name: it.querySelector('a')?.textContent ?? '',
    purchaseDate: it.querySelector('abbr')?.getAttribute('title') ?? undefined,
    downloadUrl: it.querySelector('a')?.getAttribute('href') ?? '',
    url: '',
    id: 0,  // known to be numeric due to games.json treatment of all IDs
    games: [],
}))
function sleep(millis) {
    return new Promise((resolve) => {
        window.setTimeout(() => resolve(millis), millis)
    })
}

// Match group 1 is URL and 2 is ID
// Observed /b/ for charity bundles and /s/ for sales bundles. Not sure what else might be out there.
let bundleInfoRegex = /<a href="(\/[a-z]\/(\d+)[^"]+)/
async function populateBundles(/** @type{Bundle[]} */bundles) {
    const total = bundles.length
    let i = 0
    for (const bundle of bundles) {
        let ordinal = ++i;
        console.log(`fetching bundle ${ordinal} of ${total}: ${bundle.name}`)
        // This kept complaining about a syntax error before fetch/window.fetch till I stuck it in an async function.
        const res = await window.fetch(bundle.downloadUrl, { credentials: 'same-origin'})
        if (!res.ok) {
            console.error(`Failed fetching ${bundle.name}: `, res)
            continue
        }
        const html = await res.text()
        const m = html.match(bundleInfoRegex)
        if (m) {
            bundle.url = m[1]
            bundle.id = Number.parseInt(m[2], 10)
        } else {
            console.error(`No match for bundle info URL for bundle #{ordinal} ${bundle.name} at ${bundle.downloadUrl}!`)
        }

        if (i < total) {
            const sleepMillis = 500 + Math.floor(Math.random() * 3000)
            console.log(`sleeping ${sleepMillis} ms before next fetch`)
            await sleep(sleepMillis)
        }
    }
}
await populateBundles(bundles)

// Source: https://stackoverflow.com/a/65939108 by [MSOACC](https://stackoverflow.com/users/5819046/msoacc)
const saveTemplateAsFile = (filename, dataObjToWrite) => {
    const blob = new Blob([JSON.stringify(dataObjToWrite)], { type: "application/json" });
    const link = document.createElement("a");

    link.download = filename;
    link.href = window.URL.createObjectURL(blob);
    link.dataset.downloadurl = ["application/json", link.download, link.href].join(":");

    const evt = new MouseEvent("click", {
        view: window,
        bubbles: true,
        cancelable: true,
    });

    link.dispatchEvent(evt);
    link.remove()
};
let now = new Date()
saveTemplateAsFile(`purchased_bundles_${+now}.json`, bundles);

// Well heck, we can also then go ahead and pull all the game.json data for all the bundles!
// And why not just stuff it in the bundle for now? We can survive dupes - and even get an idea how much duplication there is!
// GOTCHA: Only /b/ co-op bundles have a games.json; /s/ sales bundles, we just have to scrape.
let gamesUrl = (/** @type Bundle */bundle) => bundle.url.startsWith('/b/') ? bundle.url.replace(/^\/b\/(\d+)\/.*/, '/bundle/$1/games.json') : ''

/** Docs: https://github.com/cheeriojs/cheerio/blob/main/Readme.md */
let cheerio = await import('https://esm.sh/cheerio@1.0.0-rc.12')
function gamesFromSalesBundleHtml(/** @type{string} */html) {
    const $ = cheerio.load(html)
    const gamedivs = $('.sale_page .game_grid_widget div[data-game_id]')
    // gamedivs.map just gave indices for some reason.
    const games = []
    for (let gamediv of gamedivs) {
        const id = Number.parseInt($(gamediv).attr('data-game_id'), 10)
        const title = /** @type{string} */($('.game_cell_data a.game_link', gamediv).text()).trim()
        const url = /** @type{string} */($('.game_cell_data a.game_link', gamediv).attr('href'))
        const short_text = /** @type{string} */($('.game_text', gamediv).text()).trim()
        const price = /** @type{string} */($('a.price_tag .price_value', gamediv).text()).trim()
        const classification = ''
        const author = $('.game_author', gamediv)
        const user = {
            id: Number.parseInt($('a', author).attr('data-label').split(':')[1]),
            name: /** @type{string} */(author.text()).trim(),
            url: /** @type{string} */($('a', author).attr('href')),
        }
        const game = {
            id, title, short_text, url, price, user, classification
        }
        games.push(game)
    }
    return games
}

async function scrapeSaleWebpage(/** @type {Bundle} */ bundle) {
    const res = await fetch(bundle.url, { credentials: 'same-origin'})
    if (!res.ok) {
        console.error(`Failed fetching ${bundle.name} games from ${bundle.url}: `, res)
        return []
    }
    const html = await res.text()
    const games = gamesFromSalesBundleHtml(html)
    console.log(`Parsed ${games.length} games from URL for bundle ${bundle.name}`)
    return games
}

async function grabBundleGames(/** @type{Bundle[]} */bundles) {
    const total = bundles.length
    let i = 0
    for (const bundle of bundles) {
        console.log(`fetching bundle games ${++i} of ${total}: ${bundle.name}`)
        if (!bundle.url) {
            console.error(`bundle #${i} ${bundle.name} lacks a bundle.url!`);
            continue
        }
        const gamesJsonUrl = gamesUrl(bundle)
        if (gamesJsonUrl) {
            const res = await window.fetch(gamesJsonUrl, { credentials: 'same-origin'})
            if (!res.ok) {
                console.error(`Failed fetching ${bundle.name} games from ${gamesJsonUrl}: `, res)
                continue
            }
            const wrapper = await res.json()
            bundle.games = wrapper.games
        } else {
            bundle.games = await scrapeSaleWebpage(bundle)
        }

        const sleepMillis = 500 + Math.floor(Math.random() * 3000)
        if (i < total) {
            console.log(`sleeping ${sleepMillis} ms before next fetch`)
            await sleep(sleepMillis)
        }
    }
};
await grabBundleGames(bundles);
now = new Date();
saveTemplateAsFile(`purchased_bundles_games_${+now}.json`, bundles);
