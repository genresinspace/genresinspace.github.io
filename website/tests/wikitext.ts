import { JSDOM } from "jsdom";
import React from "react";
import ReactDOMServer from "react-dom/server";
import { Wikitext } from "../src/Wikipedia";
import data from "../public/data.json";

const dom = new JSDOM('<!DOCTYPE html><div id="root"></div>');
global.window = dom.window as unknown as Window & typeof globalThis;
global.document = dom.window.document;

const filterPageTitle = process.argv[2];
const errors: Array<{ pageTitle: string; error: string; wikitext: string }> =
  [];

try {
  for (const genre of Object.values(data.nodes)) {
    if (filterPageTitle && genre.page_title !== filterPageTitle) {
      continue;
    }

    const wikitext = genre.wikitext_description || "";
    try {
      ReactDOMServer.renderToString(
        React.createElement(Wikitext, {
          wikitext: wikitext,
        })
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
      console.log(`${pageTitle}: Wikitext: ${wikitext.slice(0, 100)}...`);
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
