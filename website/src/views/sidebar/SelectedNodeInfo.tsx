import { useMemo, useState } from "react";

import {
  NodeData,
  EdgeData,
  nodeIdToInt,
  nodeColour,
  useNodeColourLightness,
  useDataContext,
  GenreFileData,
  nodePageTitle,
  EdgeType,
} from "../../data";
import {
  derivativeColour,
  fusionGenreColour,
  subgenreColour,
} from "../../settings";
import { stripGenreNamePrefixFromDescription } from "../../util/stripGenreNamePrefixFromDescription";

import { YouTubeEmbed } from "../components/YouTubeEmbed";
import { Notice } from "../components/Notice";

import { GenreLink } from "../components/links/GenreLink";
import { DisableTooltips } from "../components/Tooltip";

import { WikipediaLink } from "../components/wikipedia/links/WikipediaLink";
import { Wikitext } from "../components/wikipedia/wikitexts/Wikitext";
import { WikitextTruncateAtNewline } from "../components/wikipedia/wikitexts/WikitextTruncateAtNewline";
import { Collapsible } from "../components/Collapsible";

import {
  DerivativeIcon,
  SubgenreIcon,
  FusionGenreIcon,
} from "../components/icons";
import yt_icon_red_digital from "../components/icons/yt_icon_red_digital.png";

import { WikitextTruncateAtLength } from "../components/wikipedia/wikitexts/WikitextTruncateAtLength";
import { useArtist, useGenre } from "../../services/dataCache";
import { colourStyles } from "../colours";

/** The sidebar panel for information about the selected node. */
export function SelectedNodeInfo({
  selectedId,
  setFocusedId,
  shouldShowMixes,
  shouldAutoplayMixes,
}: {
  selectedId: string | null;
  setFocusedId: (id: string | null) => void;
  shouldShowMixes: boolean;
  shouldAutoplayMixes: boolean;
}) {
  const { nodes, edges, max_degree: maxDegree } = useDataContext();
  const [activeTab, setActiveTab] = useState<"connections" | "artists">(
    "connections"
  );

  const node = selectedId ? nodes[nodeIdToInt(selectedId)] : null;
  const genreData = useGenre(node ? nodePageTitle(node) : null);

  if (!node) {
    return <EmptyState />;
  }

  return (
    <div className="flex flex-col gap-2">
      <GenreHeader node={node} genreData={genreData} maxDegree={maxDegree} />

      {genreData && (
        <>
          {shouldShowMixes && (
            <FeaturedMix
              genreData={genreData}
              shouldAutoplayMixes={shouldAutoplayMixes}
            />
          )}

          <div className="px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900">
            {genreData ? (
              genreData.description ? (
                <WikitextTruncateAtNewline
                  wikitext={genreData.description}
                  expandable={true}
                />
              ) : (
                "No description available."
              )
            ) : (
              "Loading..."
            )}
          </div>

          <ConnectionsAndArtists
            node={node}
            genreData={genreData}
            nodes={nodes}
            edges={edges}
            selectedId={selectedId}
            setFocusedId={setFocusedId}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />
        </>
      )}
      <div>{/* intentionally empty div to use the gap for bottom-margin */}</div>
    </div>
  );
}

/** Displayed when no genre is selected */
function EmptyState() {
  return (
    <div className="flex items-center justify-center h-full p-6 text-slate-600 dark:text-slate-400">
      <p className="text-center">
        No genre selected. Click on a node in the graph to view details.
      </p>
    </div>
  );
}

/** Header section with genre title and controls */
function GenreHeader({
  node,
  genreData,
  maxDegree,
}: {
  node: NodeData;
  genreData: GenreFileData | null;
  maxDegree: number;
}) {
  const nodeColourLightness = useNodeColourLightness();
  const selectedNodeColour = nodeColour(
    node,
    maxDegree,
    nodeColourLightness.Background
  );

  return (
    <div className="rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-900">
        <WikipediaLink
          pageTitle={nodePageTitle(node)}
          className={`${colourStyles.node.background} ${colourStyles.node.hover} text-white p-2 block text-3xl font-bold text-center transition-all duration-200`}
          nostyle={true}
          style={{
            ["--node-color" as string]: selectedNodeColour,
          }}
        >
          {node.label}
        </WikipediaLink>

        <div
          className={`text-slate-600 dark:text-slate-400 text-xs flex items-center ${colourStyles.node.infoBackground} px-3 py-2`}
        >
          {genreData ? (
            <>
              Last updated:{" "}
              <em className="ml-1">
                {new Date(genreData.last_revision_date).toLocaleString()}
              </em>
            </>
          ) : (
            "Loading..."
          )}
        </div>
    </div>
  );
}

/** Featured mix section */
function FeaturedMix({
  genreData,
  shouldAutoplayMixes,
}: {
  genreData: GenreFileData;
  shouldAutoplayMixes: boolean;
}) {
  const mixes = genreData.mixes;
  return mixes ? (
    "help_reason" in mixes ? (
      <HelpNeededForMix reason={mixes.help_reason} />
    ) : (
      <div className="flex flex-col gap-2">
        {mixes.map((mix) => (
          // We use the mix as the key to force the iframe to be re-rendered when the mix changes,
          // so that it won't pollute the global history state. (The fact that iframes do this
          // is insane. I love the web.)
          <MixItem
            key={JSON.stringify(mix)}
            mix={mix}
            autoplay={shouldAutoplayMixes}
          />
        ))}
      </div>
    )
  ) : (
    <Notice colour="red">
      <p>
        There's no mix selected for this genre yet. If you know of a good mix or
        playlist that represents this genre well, please let me know - see the
        FAQ on how to contribute!
      </p>
    </Notice>
  );
}

/** Individual mix item with video or playlist */
function MixItem({
  mix,
  autoplay,
}: {
  mix: { playlist: string; note?: string } | { video: string; note?: string };
  autoplay: boolean;
}) {
  return (
    <div
      className={`${colourStyles.node.infoBackground} overflow-hidden shadow-md rounded-xl`}
    >
      {"video" in mix ? (
        <YouTubeEmbed videoId={mix.video} autoplay={autoplay} />
      ) : (
        <YouTubeEmbed playlistId={mix.playlist} autoplay={autoplay} />
      )}
      {mix.note && (
        <Notice colour="blue" roundTop={false}>
          <Wikitext wikitext={mix.note} />
        </Notice>
      )}
    </div>
  );
}

function HelpNeededForMix({ reason }: { reason: string | null }) {
  return (
    <Notice colour="blue">
      <p>
        I've been unable to select a good mix or playlist for this genre because
        I don't know enough about the genre, the mixes I could find include
        other genres, or there just isn't an appropriate mix available. If you
        find one, please contact me - see the FAQ on how!
      </p>
      {reason && (
        <p className="mt-2">
          <strong>Reason:</strong> {reason}
        </p>
      )}
    </Notice>
  );
}

function ConnectionsAndArtists({
  node,
  genreData,
  nodes,
  edges,
  selectedId,
  setFocusedId,
  activeTab,
  setActiveTab,
}: {
  node: NodeData;
  genreData: GenreFileData;
  nodes: NodeData[];
  edges: EdgeData[];
  selectedId: string | null;
  setFocusedId: (id: string | null) => void;
  activeTab: "connections" | "artists";
  setActiveTab: (tab: "connections" | "artists") => void;
}) {
  return (
    <div>
      {/* Tab switcher */}
      <div className="flex gap-2 pb-2">
        {[
          {
            id: "connections" as const,
            label: "Connections",
          },
          {
            id: "artists" as const,
            label: "Top Artists",
          },
        ].map((tab) => (
          <button
            key={tab.id}
            className={`flex-1 px-3 py-1.5 rounded-lg cursor-pointer flex items-center justify-center ${
              activeTab === tab.id
                ? colourStyles.node.buttonActive
                : colourStyles.node.buttonInactive
            } transition-colors duration-200`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "connections" ? (
        <Connections
          node={node}
          nodes={nodes}
          edges={edges}
          selectedId={selectedId}
          setFocusedId={setFocusedId}
        />
      ) : (
        <TopArtists genreData={genreData} setFocusedId={setFocusedId} />
      )}
    </div>
  );
}

function Connections({
  node,
  nodes,
  edges,
  selectedId,
  setFocusedId,
}: {
  node: NodeData;
  nodes: NodeData[];
  edges: EdgeData[];
  selectedId: string | null;
  setFocusedId: (id: string | null) => void;
}) {
  const connectionCategories = useMemo(
    () => [
      {
        type: EdgeType.Derivative,
        inbound: [
          { type: "text", content: "Was " },
          { type: "emphasis", content: "influenced" },
          { type: "text", content: " by:" },
        ],
        outbound: [
          { type: "text", content: "Has " },
          { type: "emphasis", content: "influenced" },
          { type: "text", content: ":" },
        ],
      },
      {
        type: EdgeType.Subgenre,
        inbound: [
          { type: "text", content: "Is a " },
          { type: "emphasis", content: "subgenre" },
          { type: "text", content: " of:" },
        ],
        outbound: [
          { type: "text", content: "Has " },
          { type: "emphasis", content: "subgenres" },
          { type: "text", content: ":" },
        ],
      },
      {
        type: EdgeType.FusionGenre,
        inbound: [
          { type: "text", content: "Is a " },
          { type: "emphasis", content: "fusion genre" },
          { type: "text", content: " of:" },
        ],
        outbound: [
          { type: "text", content: "Part of " },
          { type: "emphasis", content: "fusion genres" },
          { type: "text", content: ":" },
        ],
      },
    ],
    []
  );

  const connections = useMemo(() => {
    const getConnections = (
      node: NodeData,
      edges: EdgeData[],
      isInbound: boolean
    ) =>
      node.edges
        .map((edgeIndex) => edges[edgeIndex])
        .filter((edge) =>
          isInbound ? edge.target === selectedId : edge.source === selectedId
        )
        .reduce(
          (acc, edge) => {
            const type = edge.ty;
            if (!acc[type]) acc[type] = [];
            acc[type].push(isInbound ? edge.source : edge.target);
            return acc;
          },
          {} as Record<EdgeData["ty"], string[]>
        );

    const inbound = getConnections(node, edges, true);
    const outbound = getConnections(node, edges, false);

    return connectionCategories.flatMap(
      ({ type, inbound: inboundDesc, outbound: outboundDesc }) => {
        const createConnectionItem = (
          nodeIds: string[] | undefined,
          textParts: { type: string; content: string }[]
        ) => {
          if (!nodeIds?.length) return [];

          return [
            {
              textParts,
              type,
              nodes: nodeIds.map((id) => nodes[nodeIdToInt(id)]),
            },
          ];
        };

        return [
          ...createConnectionItem(inbound[type], inboundDesc),
          ...createConnectionItem(outbound[type], outboundDesc),
        ];
      }
    );
  }, [connectionCategories, node, edges, selectedId, nodes]);

  if (connections.length === 0) {
    return (
      <Notice colour="blue">
        This genre has no documented connections to other genres.
      </Notice>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {connections.map(({ textParts, type, nodes }, index) => (
        <div key={index} className="rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-900">
          <Collapsible
            title={<ConnectionHeading textParts={textParts} type={type} />}
            defaultOpen={true}
            showBorder={false}
          >
            <div className="flex flex-col gap-2">
              {nodes.map(
                (otherNode, index) =>
                  otherNode && (
                    <ConnectionItem
                      key={otherNode.id}
                      node={otherNode}
                      isLast={index === nodes.length - 1}
                      setFocusedId={setFocusedId}
                    />
                  )
              )}
            </div>
          </Collapsible>
        </div>
      ))}
    </div>
  );
}

function ConnectionItem({
  node,
  isLast,
  setFocusedId,
}: {
  node: NodeData;
  isLast: boolean;
  setFocusedId: (id: string | null) => void;
}) {
  const genreData = useGenre(nodePageTitle(node));
  const shortDescription = genreData?.description
    ? stripGenreNamePrefixFromDescription(node.label, genreData.description)
    : null;

  return (
    <div
      key={node.id}
      className={!isLast ? "pb-3 border-b border-neutral-700" : ""}
    >
      <GenreLink
        node={node}
        hoverPreview={false}
        onMouseEnter={() => setFocusedId(node.id)}
        onMouseLeave={() => setFocusedId(null)}
      >
        {node.label || node.id}
      </GenreLink>
      <small className="block text-xs text-slate-600 dark:text-slate-400">
        {genreData ? (
          shortDescription ? (
            <DisableTooltips>
              <WikitextTruncateAtLength
                wikitext={shortDescription}
                length={200}
              />
            </DisableTooltips>
          ) : (
            "No description available."
          )
        ) : (
          "Loading..."
        )}
      </small>
    </div>
  );
}

function ConnectionHeading({
  textParts,
  type,
}: {
  textParts: { type: string; content: string }[];
  type: EdgeData["ty"];
}) {
  const getIcon = () => {
    switch (type) {
      case EdgeType.Derivative:
        return (
          <DerivativeIcon
            width={16}
            height={16}
            style={{ color: derivativeColour() }}
          />
        );
      case EdgeType.Subgenre:
        return (
          <SubgenreIcon
            width={16}
            height={16}
            style={{ color: subgenreColour() }}
          />
        );
      case EdgeType.FusionGenre:
        return (
          <FusionGenreIcon
            width={16}
            height={16}
            style={{ color: fusionGenreColour() }}
          />
        );
    }
  };

  return (
    <div className="flex items-center gap-2">
      {getIcon()}
      <div>
        {textParts.map((part, index) =>
          part.type === "emphasis" ? (
            <span
              key={index}
              className="font-bold"
              style={{
                color:
                  type === EdgeType.Derivative
                    ? derivativeColour()
                    : type === EdgeType.Subgenre
                      ? subgenreColour()
                      : fusionGenreColour(),
              }}
            >
              {part.content}
            </span>
          ) : (
            part.content
          )
        )}
      </div>
    </div>
  );
}

function TopArtists({
  genreData,
  setFocusedId,
}: {
  genreData: GenreFileData;
  setFocusedId: (id: string | null) => void;
}) {
  return genreData.top_artists && genreData.top_artists.length > 0 ? (
    <div className="flex flex-col gap-3 px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900">
      {genreData.top_artists.map((artistPage, index) => (
        <Artist
          artistPage={artistPage}
          key={artistPage}
          isLast={index === genreData.top_artists.length - 1}
          setFocusedId={setFocusedId}
        />
      ))}
    </div>
  ) : (
    <Notice colour="blue">
      <p>
        There are no artists on Wikipedia that are associated with this genre.
        If you know of an artist, please update their Wikipedia page!
      </p>
    </Notice>
  );
}

function Artist({
  artistPage,
  isLast,
  setFocusedId,
}: {
  artistPage: string;
  isLast: boolean;
  setFocusedId: (id: string | null) => void;
}) {
  const artistData = useArtist(artistPage);
  const { nodes } = useDataContext();

  return (
    <div className={!isLast ? "pb-3 border-b border-neutral-700" : ""}>
      {artistData ? (
        <div>
          <div className="flex items-center gap-1">
            <WikipediaLink pageTitle={artistPage}>
              {artistData.name}
            </WikipediaLink>
            <a
              href={`https://www.youtube.com/results?search_query=${artistData.name.replace(/ /g, "+")}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src={yt_icon_red_digital}
                alt="YouTube"
                className="h-[1em] w-auto align-middle"
                style={{ verticalAlign: "middle" }}
              />
            </a>
          </div>
          <div className="text-xs mb-2">
            Known for:{" "}
            {artistData.genres
              .map((genreId) => nodes[genreId])
              .map((node, index) => (
                <>
                  {index > 0 && ", "}
                  <GenreLink
                    node={node}
                    hoverPreview={false}
                    onMouseEnter={() => setFocusedId(node.id)}
                    onMouseLeave={() => setFocusedId(null)}
                  >
                    {node.label}
                  </GenreLink>
                </>
              ))}
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-400">
            {artistData?.description ? (
              <WikitextTruncateAtLength
                wikitext={artistData.description}
                length={200}
              />
            ) : (
              "No description available."
            )}
            <div className="text-[0.9em] leading-none mt-1">
              Last updated:{" "}
              <em>
                {new Date(artistData.last_revision_date).toLocaleString()}
              </em>
            </div>
          </div>
        </div>
      ) : (
        "Loading..."
      )}
    </div>
  );
}
