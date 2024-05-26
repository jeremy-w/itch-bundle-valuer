# Itch Bundle Valuer
This repo contains user scripts and a user CSS that, when modified and loaded into your browser, will:

* when viewing a co-op bundle listing with URL like `/b/*`:
    * inject an approximate value of unowned games after the total value Itch provides
        * E.g., "6,111 new games. Approximate total value in USD: $31,983.27, by way of $31,247.63, £394.25, €214.90, R$15.00."
    * inject the price of each game after its title, or "free" or "web" if there is no price.
* when viewing games anywhere outside your purchases:
    * will dim (or hide, if you tweak it) your owned games

To use this yourself, you need to:

* Generate a list of owned game IDs. You can use the scripts in this repo to help.
* Replace my list of owned game IDs with yours in the user script and CSS files.
* Load those files into the user script runner of your choice.
    * For Safari, I use [Userscripts](https://github.com/quoid/userscripts), because it also works in Mobile Safari on my phone.
    * Elsewhere, I use [Tampermonkey](https://www.tampermonkey.net).

## Problem Statement
* Itch.io does not display whether you own a game or not.
* Itch.io does not display the price of games in a co-op bundle.
* These two things together make it really hard to work out the value to you personally of a bundle.

## Solution
* A user script, edited to include a list of your purchased game IDs, can inject the price of games in a co-op bundle to the end of the game titles, and it can calculate the value of the unowned games for you.
    * That's what **Itch.io Bundle Valuer.user.js** is.
* User CSS can dim or even entirely hide already-owned games, so you can focus on the stuff you don't already own.
    * The dimming variant is in **dim_game_ids.css**. You can easily copy and tweak it to create a hiding version by swapping the `opacity` line for `display: none`.

## Gotcha: You need an owned-games list
* This all assumes you have a list of owned game IDs.
    * **The versions in this repo have MY list of owned game IDs, not yours!**
* Getting that list is messy, and I did it by pasting stuff chunk by chunk into the developer console, so it's not the most repeatable thing.
* I can't just provide an installable user script, because you need to customize it with your own data.

## Gotcha 2: Pricing total is approximate when multiple currencies are involved
* Itch only sends an already display-formatted price, without any currency code.
* Not every game even has a price; some are free or web games, and instead have a `flag` field set.
* So the value of unowned games is only approximate, and to work around that, the total approximate USD amount is shown alongside the totals per currency symbol. The approximate total is calculated using a hardcoded table of currency values, which you are welcome to update locally to match today's exchange rate whenever it takes your fancy. The default value for out-of-table currencies is fixed at 1 USD.

### Sub-gotcha: This script assumes you're working in USD
It probably wouldn't be too hard to switch to working in terms of a different currency, but it's also definitely not written so that's just a config change; it'd require some minor editing.

## Notes on Itch
### Two kinds of bundles
There are two kinds of bundles:
1. **Co-op bundles**
    * Co-op bundles have paths starting with `/b/:id/slug`, though `/b/:id` is all that's needed; the slug is just for SEO and readability.
    * They also have a corresponding JSON that lists all the games at `/bundle/:id/games.json`. This is super convenient.
2. **Sale bundles**
    * Sale bundles have paths starting with `/s/:id/slug`, though again the slug is superfluous.
    * They do NOT have a corresponding JSON. You have to parse the HTML.
    * Luckily, they do not seem to be paginated, at all. Not even when they have a couple hundred items (I found one of those in the active sales list to confirm).

### Listing your owned games
There's not a direct way to grab the list.

There are two sources:
1. **My Purchases** is paginated and comprises all the games you've bought or claimed.
    * It sort of has a JSON API, which you can see by sticking `?format=json&page=1` at the end.
    * It doesn't tell you how many pages there are: you just have to keep fetching pages till you get an empty one. (Or one with fewer than 50 items, but I prefer to run till empty, in case they change that page size in future.)
    * The part where you'd think there'd be data on the games on that page is a joke on you: it's a single key named `content` with a long HTML string.
    * That's right, it's basically just a wrapper around the HTML to inject into the page for the next page of content.
    * Luckily, it uses the same component as the sale bundles, so once you've written one scraper, you're done.
2. **My Bundles** has a list of bundles you've purchased that link to the download pages for those bundles. These bundles contain, both games you've claimed, and games you have not, so we have to scan them all to get a complete picture.
    * Each bundle download page has a link to the bundle page, and that lets us either compute the games.json URL for the co-op bundles and snag that, or get the URL to scan the sales bundles.

### Credentials
* The API credentials you can generate are useless. They're just for doing creator-side things, because that's the only public API Itch has.
* What you need is the `itchio` cookie – and not, surprisingly, the `itchio_token` cookie. That cookie will let you hit authenticated endpoints and get your own data back.
    * This is of course completely irrelevant in the context of a user script, but it is handy if you ever want to do some `curl`ing.
