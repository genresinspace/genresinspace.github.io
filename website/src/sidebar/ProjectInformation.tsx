import { useState } from "react";

import commit from "../commit.json";
import { EdgeData, NodeData, REPO_LINK } from "../Data";
import { SettingsData } from "../Settings";
import { stripGenreNamePrefixFromDescription } from "../util";

import {
  fusionGenreColour,
  derivativeColour,
  nodeColour,
  subgenreColour,
} from "../Graph";
import { FAQ } from "./FAQ";

import { Collapsible } from "../components/Collapsible";
import { Footnote } from "../components/Footnote";

import { ExternalLink as EL } from "../components/links/ExternalLink";
import { dumpUrl } from "../components/wikipedia/urls";
import { WikitextTruncateAtLength } from "../components/wikipedia/wikitexts/WikitextTruncateAtLength";

export function ProjectInformation({
  nodes,
  edges,
  databaseName,
  dumpDate,
  settings,
  setSettings,
  maxDegree,
}: {
  nodes: NodeData[];
  edges: EdgeData[];
  databaseName: string;
  dumpDate: string;
  settings: SettingsData;
  setSettings: React.Dispatch<React.SetStateAction<SettingsData>>;
  maxDegree: number;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p>
        A graph of every music genre on English Wikipedia
        <Footnote>
          {nodes.length} genres, {edges.length} connections, as of{" "}
          <EL href={dumpUrl(databaseName, dumpDate)}>{dumpDate}</EL>.
        </Footnote>
        , by <EL href="https://philpax.me">Philpax</EL>.
      </p>
      <p>Try clicking on a genre, or try a random genre: </p>
      <RandomGenre nodes={nodes} maxDegree={maxDegree} />
      <p>
        <EL href={REPO_LINK}>Source code</EL>.{" "}
        <EL href="https://upload.wikimedia.org/wikipedia/commons/1/19/Under_construction_graphic.gif">
          Blog post
        </EL>
        , if you're curious. Inspired by{" "}
        <EL href="https://eightyeightthirty.one/">8831</EL> and{" "}
        <EL href="https://musicmap.info/">musicmap</EL>.
      </p>
      <Collapsible title="Legend" defaultOpen={true}>
        <Legend settings={settings} setSettings={setSettings} />
      </Collapsible>
      <Collapsible title="FAQ" defaultOpen={true}>
        <FAQ dumpDate={dumpDate} />
      </Collapsible>
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
  const randomNodeColour = nodeColour(randomNode, maxDegree, 30);
  const randomNodeColourHover = nodeColour(randomNode, maxDegree, 50);

  return (
    <span className="flex">
      <button
        onClick={() => (window.location.hash = `${randomId}`)}
        className="block p-2 bg-(--node-color) hover:bg-(--node-color-hover) text-white rounded-l-md flex-1 min-h-[2rem] text-left cursor-pointer"
        style={{
          ["--node-color" as any]: randomNodeColour,
          ["--node-color-hover" as any]: randomNodeColourHover,
        }}
      >
        <span className="font-bold">{randomNode.label}</span>
        {randomNode.wikitext_description && (
          <span className="block text-xs">
            <WikitextTruncateAtLength
              wikitext={stripGenreNamePrefixFromDescription(
                randomNode.label,
                randomNode.wikitext_description
              )}
              length={100}
            />
          </span>
        )}
      </button>
      <button
        onClick={() => setRandomId(Math.floor(Math.random() * nodes.length))}
        className="p-2 bg-amber-700 hover:bg-amber-600 rounded-r-md w-8 self-stretch flex items-center justify-center text-white transition-colors"
        title="Get another random genre"
      >
        🎲
      </button>
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
    <div className="flex flex-col gap-2">
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
