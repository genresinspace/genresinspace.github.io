import { useState } from "react";

import commit from "../../commit.json";
import {
  NodeColourLightness,
  NodeData,
  REPO_LINK,
  nodeColour,
  useDataContext,
} from "../../data";
import { VISIBLE_TYPES, VisibleTypes } from "../../settings";
import { stripGenreNamePrefixFromDescription } from "../../util/stripGenreNamePrefixFromDescription";

import { FAQ } from "./FAQ";

import { Footnote } from "../components/Footnote";

import { ExternalLink as EL } from "../components/links/ExternalLink";
import { dumpUrl } from "../components/wikipedia/urls";
import { WikitextTruncateAtLength } from "../components/wikipedia/wikitexts/WikitextTruncateAtLength";
import { Section } from "../components/Section";
import { InfoIcon, MapIcon, QuestionIcon } from "../components/icons";

/** The sidebar panel for information about the project. */
export function ProjectInformation({
  visibleTypes,
  setVisibleTypes,
  setFocusedId,
}: {
  visibleTypes: VisibleTypes;
  setVisibleTypes: (visibleTypes: VisibleTypes) => void;
  setFocusedId: (id: string | null) => void;
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
      <Section heading="About" icon={<InfoIcon />}>
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
          <RandomGenre
            nodes={nodes}
            maxDegree={maxDegree}
            setFocusedId={setFocusedId}
          />
        </div>
      </Section>
      <Section heading="Legend" icon={<MapIcon />}>
        <Legend visibleTypes={visibleTypes} setVisibleTypes={setVisibleTypes} />
      </Section>
      <Section heading="FAQ" icon={<QuestionIcon />}>
        <FAQ dumpDate={dumpDate} />
      </Section>
      <CommitFooter />
    </div>
  );
}

function RandomGenre({
  nodes,
  maxDegree,
  setFocusedId,
}: {
  nodes: NodeData[];
  maxDegree: number;
  setFocusedId: (id: string | null) => void;
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

  return (
    <span className="flex flex-col w-full">
      <span className="flex flex-row">
        <button
          onClick={() => (window.location.hash = `${randomId}`)}
          className="flex-1 min-h-[2rem] text-left cursor-pointer"
          style={{
            ["--node-color" as string]: randomNodeColour,
          }}
          onMouseEnter={() => setFocusedId(randomNode.id)}
          onMouseLeave={() => setFocusedId(null)}
        >
          <span className="font-bold block p-2 bg-[var(--node-color)] hover:filter hover:brightness-[1.6] text-white transition-all duration-250">
            {randomNode.label}
          </span>
        </button>
        <button
          onClick={() => setRandomId(Math.floor(Math.random() * nodes.length))}
          className="p-1 bg-neutral-800 hover:bg-neutral-700 w-8 flex items-center justify-center text-white transition-colors"
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
  visibleTypes,
  setVisibleTypes,
}: {
  visibleTypes: VisibleTypes;
  setVisibleTypes: (visibleTypes: VisibleTypes) => void;
}) {
  return (
    <div className="flex flex-col gap-4 p-3 text-sm">
      {VISIBLE_TYPES.map(({ color, label, type, description }) => (
        <div key={label} className="flex items-start gap-2">
          <div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id={label}
                checked={visibleTypes[type]}
                onChange={(e) =>
                  setVisibleTypes({
                    ...visibleTypes,
                    [type]: e.target.checked,
                  })
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
