import { JSDOM } from "jsdom";
import React from "react";
import ReactDOMServer from "react-dom/server";
import data from "../public/data.json";
import { readFile, readdir } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { Data, DataContext } from "../src/data";
import { initWasm } from "../src/views/components/wikipedia";
import { wikiPageUrl, wikiUrl } from "../src/views/components/wikipedia/urls";
import { Wikitext } from "../src/views/components/wikipedia/wikitexts/Wikitext";
import { MissingTemplateError } from "../src/views/components/wikipedia/templates/WikitextTemplate";

// Get the directory path of the current file
const __dirname = dirname(fileURLToPath(import.meta.url));

// Setup WASM loading for Node environment
const wasmPath = join(__dirname, "../frontend_wasm/frontend_wasm_bg.wasm");

await initWasm(await readFile(wasmPath));

// Setup DOM environment
const dom = new JSDOM('<!DOCTYPE html><div id="root"></div>');
global.window = dom.window as unknown as Window & typeof globalThis;
global.document = dom.window.document;

const filterPageTitle = process.argv[2];
const errors: Array<{
  pageTitle: string;
  error: string;
  wikitext: string;
  type: "genre" | "artist";
}> = [];
const missingTemplates = new Set<string>();

const resolvedWikiUrl = wikiUrl(data.wikipedia_domain);

// Helper function to render wikitext and catch errors
function renderWikitext(
  wikitext: string,
  pageTitle: string,
  type: "genre" | "artist"
) {
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
    if (err instanceof MissingTemplateError) {
      missingTemplates.add(err.templateName);
      errors.push({
        pageTitle,
        error: err.message,
        wikitext: wikitext,
        type,
      });
    } else {
      errors.push({
        pageTitle,
        error: err instanceof Error ? err.message : String(err),
        wikitext: wikitext,
        type,
      });
    }
  }
}

try {
  // Test genre descriptions
  for (const genre of Object.values(data.nodes)) {
    if (filterPageTitle && genre.page_title !== filterPageTitle) {
      continue;
    }

    const wikitext = genre.wikitext_description || "";
    renderWikitext(wikitext, genre.page_title, "genre");
  }

  // Test artist descriptions
  const artistsDir = join(__dirname, "../public/artists");
  try {
    const artistFiles = await readdir(artistsDir);

    for (const artistFile of artistFiles) {
      if (!artistFile.endsWith(".json")) continue;

      const artistPath = join(artistsDir, artistFile);
      const artistData = JSON.parse(await readFile(artistPath, "utf-8"));

      if (filterPageTitle && artistData.page_title !== filterPageTitle) {
        continue;
      }

      const wikitext = artistData.description || "";
      renderWikitext(wikitext, artistData.page_title, "artist");
    }
  } catch (err) {
    console.warn("Could not read artists directory:", err);
  }

  if (errors.length > 0) {
    console.log(`\n=== RENDERING ERRORS (${errors.length}) ===`);
    errors.forEach(({ pageTitle, error, wikitext, type }) => {
      console.log(
        `[${type.toUpperCase()}] ${pageTitle} (${wikiPageUrl(
          resolvedWikiUrl,
          pageTitle
        )}): Wikitext: ${wikitext.slice(0, 100)}...`
      );
      console.log(`Error: ${error}`);
      console.log();
    });
  }

  if (missingTemplates.size > 0) {
    console.log(`\n=== MISSING TEMPLATES (${missingTemplates.size}) ===`);
    const sortedTemplates = Array.from(missingTemplates).sort();
    sortedTemplates.forEach((template) => {
      const templateUrl = `${resolvedWikiUrl}/Template:${template}`;
      console.log(`- ${template}: ${templateUrl}`);
    });
  }

  if (errors.length > 0) {
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
