import { useState } from "react";

import commit from "../commit.json";
import { EdgeData, NodeData, REPO_LINK } from "../Data";
import { SettingsData } from "../Settings";

import {
  fusionGenreColour,
  derivativeColour,
  nodeColour,
  subgenreColour,
} from "../Graph";
import { FAQ } from "./FAQ";

import { Collapsible } from "../components/Collapsible";
import { ExternalLink } from "../components/links/ExternalLink";
import { dumpUrl } from "../components/wikipedia/urls";

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
  const [randomId, setRandomId] = useState(
    Math.floor(Math.random() * nodes.length)
  );
  const randomNode = nodes[randomId];
  const randomNodeColour = nodeColour(randomNode, maxDegree, 30);
  const randomNodeColourHover = nodeColour(randomNode, maxDegree, 50);

  return (
    <div>
      <div className="flex flex-col gap-4">
        <p>
          A graph of{" "}
          <span
            title={`${nodes.length} genres, ${edges.length} connections`}
            className="border-b border-dotted border-neutral-500 hover:border-white cursor-help"
          >
            every music genre on English Wikipedia
          </span>{" "}
          (as of{" "}
          <ExternalLink href={dumpUrl(databaseName, dumpDate)}>
            {dumpDate}
          </ExternalLink>
          ), inspired by{" "}
          <ExternalLink href="https://eightyeightthirty.one/">
            8831
          </ExternalLink>{" "}
          and{" "}
          <ExternalLink href="https://musicmap.info/">musicmap</ExternalLink>.
        </p>
        <p>
          Try clicking on a genre, or try a random genre:{" "}
          <span className="flex gap-2 mt-1">
            <a
              href={`#${randomId}`}
              className="block p-1 bg-(--node-color) hover:bg-(--node-color-hover) text-white rounded flex-1 min-h-[2rem] flex items-center"
              style={{
                ["--node-color" as any]: randomNodeColour,
                ["--node-color-hover" as any]: randomNodeColourHover,
              }}
            >
              {nodes[randomId].label}
            </a>
            <button
              onClick={() =>
                setRandomId(Math.floor(Math.random() * nodes.length))
              }
              className="p-1 bg-neutral-800 hover:bg-neutral-700 rounded w-8 self-stretch flex items-center justify-center"
              title="Get another random genre"
            >
              🎲
            </button>
          </span>
        </p>
        <Collapsible title="Legend" defaultOpen={true}>
          <div className="flex flex-col gap-2 mt-1">
            {[
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
            ].map(({ color, label, type, description }) => (
              <div key={label} className="flex items-start gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={label}
                      checked={settings.general.visibleTypes[type]}
                      onChange={(e) =>
                        setSettings((prev: SettingsData) => ({
                          ...prev,
                          general: {
                            ...prev.general,
                            visibleTypes: {
                              ...prev.general.visibleTypes,
                              [type]: e.target.checked,
                            },
                          },
                        }))
                      }
                      style={{ accentColor: color }}
                    />
                    <label htmlFor={label} className="select-none">
                      <span style={{ color }}>{label}</span>
                    </label>
                  </div>
                  <p className="mt-1">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </Collapsible>
        <Collapsible title="FAQ" defaultOpen={false}>
          <FAQ dumpDate={dumpDate} />
        </Collapsible>
        <p>
          By <ExternalLink href="https://philpax.me">Philpax</ExternalLink>.
          Powered by{" "}
          <ExternalLink href="https://cosmograph.app/">Cosmograph</ExternalLink>
          .
        </p>
        <p>
          <ExternalLink href={REPO_LINK}>Source code</ExternalLink>.{" "}
          <ExternalLink href="https://upload.wikimedia.org/wikipedia/commons/1/19/Under_construction_graphic.gif">
            Blog post
          </ExternalLink>
          , if you're curious.
        </p>
        <footer className="text-sm text-neutral-500">
          Commit{" "}
          <code>
            <ExternalLink href={`${REPO_LINK}/tree/${commit.commit}`}>
              {commit.commit}
            </ExternalLink>
          </code>{" "}
          on{" "}
          <time dateTime={commit.date}>
            {new Date(commit.date).toLocaleString()}
          </time>
          .
        </footer>
      </div>
    </div>
  );
}
