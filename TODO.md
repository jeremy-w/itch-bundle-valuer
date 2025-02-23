## Save money
* Add a user script that identifies games you own via some bundle when on the game page, even if you haven't claimed them, so you don't pay twice.

## Cosmetic
* Omit ", by way of …" bit  when the only currency in use is the primary currency (USD for now), because "$123 by way of $123" is just silly.

## Updating owned games
* Make it easier to re-generate the list of owned games.
* Further enhancement: Be clever about re-generating the list, and only scan bundles we haven't already scanned, and purchased items up till we hit the ones we've scanned already from that page.

## User script + css generator
* Probably easier: script the scanning and generate the user script and CSS from the data. Then this is basically turnkey: itchio token in, scripts out.

## All-in-one?
Not sure about this. I kinda like the pre-computed version.

* Move everything into the script itself, so it can update the list itself?
    *  Can the data be stored in script storage with `GM_setValue`? Granted, that's only per-browser, so you'd have to re-scan on each device, which is kinda strictly worse than the current setup, where game-ids is pre-computed (but frozen).
* Maybe fold the CSS injection into it as well, and have it be clever about what URL it's on, since user CSS definitely cannot update the list of game IDs itself.
