import { JSDOM } from "jsdom";
import React from "react";
import ReactDOMServer from "react-dom/server";
import data from "../public/data.json";
import { readFile, readdir } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { ArtistFileData, Data, DataContext, GenreFileData } from "../src/data";
import { initWasm } from "../src/views/components/wikipedia";
import { wikiPageUrl, wikiUrl } from "../src/views/components/wikipedia/urls";
import { Wikitext } from "../src/views/components/wikipedia/wikitexts/Wikitext";
import { MissingTemplateError } from "../src/views/components/wikipedia/templates/WikitextTemplate";
import { page_name_to_filename } from "frontend_wasm";
import { DataCache, DataCacheContext } from "../src/services/dataCache";

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
const renderingErrors: Array<{
  pageTitle: string;
  error: string;
  callstack: string;
  wikitext: string;
  type: "genre" | "artist";
}> = [];
const missingTemplateErrors: Array<{
  pageTitle: string;
  templateName: string;
  error: string;
  wikitext: string;
  type: "genre" | "artist";
}> = [];

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
        React.createElement(
          DataCacheContext.Provider,
          {
            value: new DataCache(),
          },
          React.createElement(Wikitext, {
            wikitext: wikitext,
          })
        )
      )
    );
  } catch (err) {
    if (err instanceof MissingTemplateError) {
      missingTemplateErrors.push({
        pageTitle,
        templateName: err.templateName,
        error: err.message,
        wikitext: wikitext,
        type,
      });
    } else {
      renderingErrors.push({
        pageTitle,
        error: err instanceof Error ? err.message : String(err),
        callstack: (err instanceof Error && err.stack) || "",
        wikitext: wikitext,
        type,
      });
    }
  }
}

try {
  // Test genre descriptions
  const genresDir = join(__dirname, "../public/genres");
  for (const genre of Object.values(data.nodes)) {
    if (filterPageTitle && genre.page_title !== filterPageTitle) {
      continue;
    }

    const genrePath = join(
      genresDir,
      page_name_to_filename(genre.page_title) + ".json"
    );
    const genreData: GenreFileData = JSON.parse(
      await readFile(genrePath, "utf-8")
    );

    const wikitext = genreData.description || "";
    renderWikitext(wikitext, genre.page_title, "genre");
  }

  // Test artist descriptions
  const artistsDir = join(__dirname, "../public/artists");
  try {
    const artistFiles = await readdir(artistsDir);

    for (const artistFile of artistFiles) {
      if (!artistFile.endsWith(".json")) continue;

      const artistPath = join(artistsDir, artistFile);
      const artistData: ArtistFileData = JSON.parse(
        await readFile(artistPath, "utf-8")
      );

      const wikitext = artistData.description || "";
      renderWikitext(wikitext, artistFile, "artist");
    }
  } catch (err) {
    console.warn("Could not read artists directory:", err);
  }

  if (missingTemplateErrors.length > 0) {
    const templates = {};
    for (const error of missingTemplateErrors) {
      if (!(error.templateName in templates)) {
        templates[error.templateName] = [];
      }
      templates[error.templateName].push(error.pageTitle);
    }
    const sortedTemplates = Object.keys(templates).sort();

    console.log(`\n=== MISSING TEMPLATES (${sortedTemplates.length}) ===`);
    for (const template of sortedTemplates) {
      const templateUrl = `${resolvedWikiUrl}/Template:${template}`;
      console.log(`- ${template}: ${templateUrl}`);
      console.log(`\t${templates[template].join(", ")}\n`);
    }
  }

  if (renderingErrors.length > 0) {
    console.log(`\n=== RENDERING ERRORS (${renderingErrors.length}) ===`);
    for (const {
      pageTitle,
      error,
      callstack,
      wikitext,
      type,
    } of renderingErrors) {
      console.log(
        `[${type.toUpperCase()}] ${pageTitle} (${wikiPageUrl(
          resolvedWikiUrl,
          pageTitle
        )}): Wikitext: ${wikitext.slice(0, 100)}...`
      );
      console.log(`Error: ${error}`);
      console.log(`Callstack: ${callstack}`);
      console.log();
    }
  }

  // Determine if we should exit with error code
  if (renderingErrors.length > 0 || missingTemplateErrors.length > 0) {
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
