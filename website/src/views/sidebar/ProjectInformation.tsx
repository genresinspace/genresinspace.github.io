import { useState } from "react";

import commit from "../../commit.json";
import {
  NodeColourLightness,
  NodeData,
  REPO_LINK,
  nodeColour,
  useDataContext,
} from "../../data";
import { SettingsData } from "../../settings";
import { stripGenreNamePrefixFromDescription } from "../../util";

import { fusionGenreColour, derivativeColour, subgenreColour } from "../Graph";
import { FAQ } from "./FAQ";

import { Footnote } from "../components/Footnote";

import { ExternalLink as EL } from "../components/links/ExternalLink";
import { dumpUrl } from "../components/wikipedia/urls";
import { WikitextTruncateAtLength } from "../components/wikipedia/wikitexts/WikitextTruncateAtLength";
import { Section } from "../components/Section";

/** The sidebar panel for information about the project. */
export function ProjectInformation({
  settings,
  setSettings,
}: {
  settings: SettingsData;
  setSettings: React.Dispatch<React.SetStateAction<SettingsData>>;
}) {
  const {
    nodes,
    edges,
    wikipedia_db_name: databaseName,
    dump_date: dumpDate,
    max_degree: maxDegree,
  } = useDataContext();

  return (
    <div className="flex flex-col gap-4">
      <Section
        heading="About"
        icon={
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        }
      >
        <div className="flex flex-col gap-2 p-3">
          <p>
            A graph of every music genre on English Wikipedia
            <Footnote>
              {nodes.length} genres, {edges.length} connections, as of{" "}
              <EL href={dumpUrl(databaseName, dumpDate)}>{dumpDate}</EL>.
            </Footnote>
            , by <EL href="https://philpax.me">Philpax</EL>. Inspired by{" "}
            <EL href="https://eightyeightthirty.one/">8831</EL> and{" "}
            <EL href="https://musicmap.info/">musicmap</EL>.
          </p>
          <p>
            <EL href={REPO_LINK}>Source code</EL>.{" "}
            <EL href="https://upload.wikimedia.org/wikipedia/commons/1/19/Under_construction_graphic.gif">
              Blog post
            </EL>
            , if you're curious.
          </p>
          <p>Try clicking on a genre, or check out a random genre: </p>
          <RandomGenre nodes={nodes} maxDegree={maxDegree} />
        </div>
      </Section>
      <Section
        heading="Legend"
        icon={
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
            />
          </svg>
        }
      >
        <Legend settings={settings} setSettings={setSettings} />
      </Section>
      <Section
        heading="FAQ"
        icon={
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        }
      >
        <FAQ dumpDate={dumpDate} />
      </Section>
      <CommitFooter />
    </div>
  );
}

function RandomGenre({
  nodes,
  maxDegree,
}: {
  nodes: NodeData[];
  maxDegree: number;
}) {
  const [randomId, setRandomId] = useState(() =>
    Math.floor(Math.random() * nodes.length)
  );
  const randomNode = nodes[randomId];
  const randomNodeColour = nodeColour(
    randomNode,
    maxDegree,
    NodeColourLightness.Background
  );
  const randomNodeColourHover = nodeColour(
    randomNode,
    maxDegree,
    NodeColourLightness.BackgroundHover
  );

  return (
    <span className="flex flex-col w-full">
      <span className="flex flex-row">
        <button
          onClick={() => (window.location.hash = `${randomId}`)}
          className="flex-1 min-h-[2rem] text-left cursor-pointer"
          style={{
            ["--node-color" as string]: randomNodeColour,
            ["--node-color-hover" as string]: randomNodeColourHover,
          }}
        >
          <span className="font-bold block px-2 py-1 bg-(--node-color) hover:bg-(--node-color-hover) text-white">
            {randomNode.label}
          </span>
        </button>
        <button
          onClick={() => setRandomId(Math.floor(Math.random() * nodes.length))}
          className="p-1 bg-amber-700 hover:bg-amber-600 w-8 flex items-center justify-center text-white transition-colors"
          title="Get another random genre"
        >
          🎲
        </button>
      </span>
      {randomNode.wikitext_description && (
        <span className="block text-xs p-2 border-b border-l border-r border-neutral-800">
          <WikitextTruncateAtLength
            wikitext={stripGenreNamePrefixFromDescription(
              randomNode.label,
              randomNode.wikitext_description
            )}
            length={100}
          />
        </span>
      )}
    </span>
  );
}

function Legend({
  settings,
  setSettings,
}: {
  settings: SettingsData;
  setSettings: React.Dispatch<React.SetStateAction<SettingsData>>;
}) {
  const types = [
    {
      color: derivativeColour(),
      label: "Derivative",
      type: "Derivative" as const,
      description:
        "Genres that use some of the elements inherent to this genre, without being a subgenre.",
    },
    {
      color: subgenreColour(),
      label: "Subgenre",
      type: "Subgenre" as const,
      description:
        "Genres that share characteristics with this genre and fall within its purview.",
    },
    {
      color: fusionGenreColour(),
      label: "Fusion Genre",
      type: "FusionGenre" as const,
      description:
        "Genres that combine elements of this genre with other genres.",
    },
  ];

  return (
    <div className="flex flex-col gap-4 p-3 text-sm">
      {types.map(({ color, label, type, description }) => (
        <div key={label} className="flex items-start gap-2">
          <div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id={label}
                checked={settings.visibleTypes[type]}
                onChange={(e) =>
                  setSettings((prev: SettingsData) => ({
                    ...prev,
                    visibleTypes: {
                      ...prev.visibleTypes,
                      [type]: e.target.checked,
                    },
                  }))
                }
                style={{ accentColor: color }}
              />
              <label htmlFor={label} className="select-none">
                <span style={{ color }}>{label}</span>
              </label>
            </div>
            <p>{description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function CommitFooter() {
  return (
    <footer className="text-sm text-neutral-500">
      Commit{" "}
      <code>
        <EL href={`${REPO_LINK}/tree/${commit.commit}`}>{commit.commit}</EL>
      </code>{" "}
      on{" "}
      <time dateTime={commit.date}>
        {new Date(commit.date).toLocaleString()}
      </time>
      .
    </footer>
  );
}
