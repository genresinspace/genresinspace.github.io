import { JSDOM } from "jsdom";
import React from "react";
import ReactDOMServer from "react-dom/server";
import data from "../public/data.json";
import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { Data, DataContext } from "../src/data";

// Get the directory path of the current file
const __dirname = dirname(fileURLToPath(import.meta.url));

// Setup WASM loading for Node environment
const wasmPath = join(
  __dirname,
  "../wikitext_simplified/wikitext_simplified_bg.wasm"
);

await initWasm(await readFile(wasmPath));

// Setup DOM environment
const dom = new JSDOM('<!DOCTYPE html><div id="root"></div>');
global.window = dom.window as unknown as Window & typeof globalThis;
global.document = dom.window.document;

const filterPageTitle = process.argv[2];
const errors: Array<{ pageTitle: string; error: string; wikitext: string }> =
  [];

const resolvedWikiUrl = wikiUrl(data.wikipedia_domain);

try {
  for (const genre of Object.values(data.nodes)) {
    if (filterPageTitle && genre.page_title !== filterPageTitle) {
      continue;
    }

    const wikitext = genre.wikitext_description || "";
    try {
      ReactDOMServer.renderToString(
        React.createElement(
          DataContext.Provider,
          {
            value: data as Data,
          },
          React.createElement(Wikitext, {
            wikitext: wikitext,
          })
        )
      );
    } catch (err) {
      errors.push({
        pageTitle: genre.page_title,
        error: err instanceof Error ? err.message : String(err),
        wikitext: wikitext,
      });
    }
  }

  if (errors.length > 0) {
    errors.forEach(({ pageTitle, error, wikitext }) => {
      console.log(
        `${pageTitle} (${wikiPageUrl(
          resolvedWikiUrl,
          pageTitle
        )}): Wikitext: ${wikitext.slice(0, 100)}...`
      );
      console.log(`Error: ${error}`);
      console.log();
    });
    process.exit(1);
  } else {
    const message = filterPageTitle
      ? `Entry "${filterPageTitle}" rendered successfully!`
      : "\nAll entries rendered successfully!";
    console.log(message);
  }
} catch (err) {
  console.error(err);
  process.exit(1);
}
