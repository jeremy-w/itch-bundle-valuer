#!/usr/bin/env deno run --allow-read --allow-write
import { parseArgs } from "jsr:@std/cli/parse-args";

const progname = import.meta.filename.split("/").toReversed()[0];

const flags = parseArgs(Deno.args, {
  boolean: ["help"],
  alias: { help: "h" },
  string: ["data-dir", "out-dir"],
  default: { "data-dir": "./Example Data", "out-dir": "./out" },
});
if (flags.help) {
  console.log(`Usage: ${progname} --data-dir <path> --out-dir <path>
  --data-dir: The directory containing the JSON files from running
      Listing Owned Games/{my_purchases,purchased_bundles}.js
      manually in the browser console on the appropriate pages.
  --out-dir: The directory to write the CSS and JS userscript files to.`);
  Deno.exit();
}

const dataDir = flags["data-dir"];
try {
  const dataInfo = Deno.statSync(dataDir);
  if (!dataInfo.isDirectory) {
    console.error(`${progname}: Data directory is not a directory:`, dataDir);
    Deno.exit(1);
  }
} catch (e) {
  console.error(`${progname}: Data directory does not exist:`, dataDir, e);
  Deno.exit(1);
}

const outDir = flags["out-dir"];
try {
  const outInfo = Deno.statSync(outDir);
  if (!outInfo.isDirectory) {
    console.error(`${progname}: Output directory is not a directory:`, outDir);
    Deno.exit(1);
  }
} catch (e) {
  if (e instanceof Deno.errors.NotFound) {
    // This is fine.
  } else {
    console.error(`${progname}: Error checking output directory:`, outDir, e);
    Deno.exit(1);
  }
}
await Deno.mkdir(outDir, { recursive: true });

console.log(
  `${progname}: Reading data from ${dataDir}, and writing to ${outDir}.`
);

const fileNames = (await Array.fromAsync(Deno.readDir(dataDir)))
  .filter(
    (it) =>
      it.isFile && it.name.endsWith(".json") && it.name.includes("_games_")
  )
  .map((it) => it.name);
fileNames.sort();

const my_purchases_file = fileNames.findLast((it) =>
  it.startsWith("my_purchases_games_")
);
const bundles_file = fileNames.findLast((it) =>
  it.startsWith("purchased_bundles_games_")
);
console.log(progname, ":", { my_purchases_file, bundles_file });

const my_purchases = JSON.parse(
  Deno.readTextFileSync(dataDir + "/" + my_purchases_file)
);
const bundles = JSON.parse(Deno.readTextFileSync(dataDir + "/" + bundles_file));

const ownedGameIds = new Set(
  my_purchases
    .map((it) => it.id)
    .concat(bundles.flatMap((it) => it.games).map((it) => it.id))
);
const list = Array.from(ownedGameIds).sort();
await Deno.writeTextFile(outDir + "/game_ids.json", JSON.stringify(list));
console.log(
  `${progname}: Wrote ${list.length} game IDs to ${outDir}/game_ids.json`
);

const pre =
  `/* ==UserStyle==
@name        Itch.io Owned Game Dimmer
@description Dims owned games. Generated from a list of owned game IDs.
@match       https://itch.io/*
@exclude     https://itch.io/my-purchases*
==/UserStyle== */
/*! Last updated: ${new Date().toISOString()} */` +
  list.map((it) => `[data-game_id="${it}"]`).join(",");
const dimmer = pre + " { opacity: 30% !important; }";
await Deno.writeTextFile(outDir + "/Itch.io Owned Game Dimmer.css", dimmer);
console.log(
  `${progname}: Wrote CSS to ${outDir}/Itch.io Owned Game Dimmer.user.css`
);

const hider =
  pre.replace("Dimmer", "Hider").replace("Dims", "Hides") +
  " { display: none; }";
await Deno.writeTextFile(outDir + "/Itch.io Owned Game Hider.user.css", hider);
console.log(
  `${progname}: Wrote CSS to ${outDir}/Itch.io Owned Game Hider.user.css`
);

const declarer =
  pre
    .replace("Dimmer", "Declarer")
    .replace("Dims owned", "Makes obvious that you own") +
  list
    .map(
      (it) =>
        `html:has(head meta[name="itch:path"][content="games/${it}"]) .header_buy_row::before`
    )
    .join(",") +
  " .header_buy_row::before { content: 'HEY! YOU OWN THIS ALREADY!' }";
await Deno.writeTextFile(
  outDir + "/Itch.io Owned Game Declarer.user.css",
  declarer
);
console.log(
  `${progname}: Wrote CSS to ${outDir}/Itch.io Owned Game Declarer.user.css`
);

const js = await Deno.readTextFile(
  import.meta.dirname + "/User Scripts/Itch.io Bundle Valuer.user.js"
);
const lines = js.split("\n");
const start = lines.findIndex((it) => it.includes("// BEGIN game_ids.json"));
const end = lines.findIndex((it) => it.includes("// END game_ids.json"));
lines.splice(start + 1, end - start - 1, `  ${JSON.stringify(list)},`);
await Deno.writeTextFile(
  outDir + "/Itch.io Bundle Valuer.user.js",
  lines.join("\n")
);
console.log(`${progname}: Wrote JS to ${outDir}/Itch.io Bundle Valuer.user.js`);
