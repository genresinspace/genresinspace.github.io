import { useMemo, useState, useCallback, useEffect } from "react";
import { useCosmograph } from "@cosmograph/react";

import {
  NodeData,
  EdgeData,
  nodeIdToInt,
  nodeColour,
  NodeColourLightness,
  useDataContext,
  ArtistData,
} from "../../data";
import { page_name_to_filename } from "frontend_wasm";
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
import { Section } from "../components/Section";

import {
  MusicIcon,
  DocumentIcon,
  ArrowUpIcon,
  DerivativeIcon,
  SubgenreIcon,
  FusionGenreIcon,
} from "../components/icons";

import { WikitextTruncateAtLength } from "../components/wikipedia/wikitexts/WikitextTruncateAtLength";

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

  if (!selectedId) {
    return <EmptyState />;
  }

  const node = nodes[nodeIdToInt(selectedId)];
  if (!node) return null;

  return (
    <div className="flex flex-col gap-4">
      <GenreHeader node={node} maxDegree={maxDegree} />

      {shouldShowMixes && (
        <FeaturedMix node={node} shouldAutoplayMixes={shouldAutoplayMixes} />
      )}

      {node.wikitext_description && (
        <GenreDescription description={node.wikitext_description} />
      )}

      <TopArtists node={node} />

      <Connections
        node={node}
        nodes={nodes}
        edges={edges}
        selectedId={selectedId}
        setFocusedId={setFocusedId}
      />
    </div>
  );
}

/** Displayed when no genre is selected */
function EmptyState() {
  return (
    <div className="flex items-center justify-center h-full p-6 text-gray-400">
      <p className="text-center">
        No genre selected. Click on a node in the graph to view details.
      </p>
    </div>
  );
}

/** Header section with genre title and controls */
function GenreHeader({
  node,
  maxDegree,
}: {
  node: NodeData;
  maxDegree: number;
}) {
  const selectedNodeColour = nodeColour(
    node,
    maxDegree,
    NodeColourLightness.Background
  );

  return (
    <div className="space-y-4">
      <div className="overflow-hidden">
        <WikipediaLink
          pageTitle={node.page_title}
          className="bg-[var(--node-color)] hover:filter hover:brightness-[1.6] text-white p-2 block text-3xl font-bold text-center transition-all duration-200"
          nostyle={true}
          style={{
            ["--node-color" as string]: selectedNodeColour,
          }}
        >
          {node.label}
        </WikipediaLink>

        <div className="text-neutral-400 text-xs flex items-center bg-neutral-800 px-3 py-2">
          Last updated:{" "}
            <em className="ml-1">
              {new Date(node.last_revision_date).toLocaleString()}
            </em>
        </div>
      </div>
    </div>
  );
}

/** Featured mix section */
function FeaturedMix({
  node,
  shouldAutoplayMixes,
}: {
  node: NodeData;
  shouldAutoplayMixes: boolean;
}) {
  return (
    <Section heading="Featured Mix" icon={<MusicIcon />}>
      {node.mixes ? (
        "help_reason" in node.mixes ? (
          <HelpNeededForMix reason={node.mixes.help_reason} />
        ) : (
          node.mixes.map((mix, i) => (
            <MixItem key={i} mix={mix} autoplay={shouldAutoplayMixes} />
          ))
        )
      ) : (
        <Notice colour="red">
          <p>
            There's no mix selected for this genre yet. If you know of a good
            mix or playlist that represents this genre well, please let me know
            - see the FAQ on how to contribute!
          </p>
        </Notice>
      )}
    </Section>
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
    <div className="bg-neutral-800 overflow-hidden shadow-md">
      {"video" in mix ? (
        <YouTubeEmbed videoId={mix.video} autoplay={autoplay} />
      ) : (
        <YouTubeEmbed playlistId={mix.playlist} autoplay={autoplay} />
      )}
      {mix.note && (
        <Notice colour="blue">
          <Wikitext wikitext={mix.note} />
        </Notice>
      )}
    </div>
  );
}

/** Genre description section */
function GenreDescription({ description }: { description: string }) {
  return (
    <Section heading="Description" icon={<DocumentIcon />}>
      <WikitextTruncateAtNewline
        wikitext={description}
        expandable={true}
        className="p-3"
      />
    </Section>
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

function TopArtists({ node }: { node: NodeData }) {
  return (
    <Section heading="Top Artists" icon={<MusicIcon />}>
      {node.top_artists && node.top_artists.length > 0 ? (
        <div className="flex flex-col gap-3 p-3">
          {node.top_artists.map((artistPage, index) => (
            <Artist
              artistPage={artistPage}
              key={artistPage}
              isLast={index === node.top_artists.length - 1}
            />
          ))}
        </div>
      ) : (
        <Notice colour="blue">
          <p>
            There are no artists on Wikipedia that are associated with this
            genre. If you know of an artist, please update their Wikipedia page!
          </p>
        </Notice>
      )}
    </Section>
  );
}

function Artist({
  artistPage,
  isLast,
}: {
  artistPage: string;
  isLast: boolean;
}) {
  const { artist_page_to_name } = useDataContext();
  const [artistData, setArtistData] = useState<ArtistData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const artistName = artist_page_to_name[artistPage] || artistPage;

  const fetchArtistData = useCallback(async () => {
    if (artistData || isLoading) return;
    setIsLoading(true);
    try {
      const filename = page_name_to_filename(artistPage);
      const response = await fetch(`/artists/${filename}.json`);
      if (response.ok) {
        const data: ArtistData = await response.json();
        setArtistData(data);
      }
    } catch (error) {
      console.error("Failed to fetch artist data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [artistPage, artistData, isLoading]);

  useEffect(() => {
    fetchArtistData();
  }, [fetchArtistData]);

  return (
    <div className={!isLast ? "pb-3 border-b border-neutral-700" : ""}>
      <WikipediaLink pageTitle={artistPage}>{artistName}</WikipediaLink>
      <div className="ml-4 text-xs text-neutral-400">
        {isLoading ? (
          <div>Loading...</div>
        ) : artistData?.description ? (
          <WikitextTruncateAtLength
            wikitext={artistData.description}
            length={200}
          />
        ) : (
          !isLoading && <div>No description available.</div>
        )}
      </div>
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
  const connectionDescriptions = useMemo(
    () => [
      {
        type: "Derivative" as const,
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
        type: "Subgenre" as const,
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
        type: "FusionGenre" as const,
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

    return connectionDescriptions.flatMap(
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
              nodes: nodeIds.map((id) => {
                const connectedNode = nodes[nodeIdToInt(id)];
                return {
                  node: connectedNode,
                  shortDescription: connectedNode.wikitext_description
                    ? stripGenreNamePrefixFromDescription(
                        connectedNode.label,
                        connectedNode.wikitext_description
                      )
                    : "",
                };
              }),
            },
          ];
        };

        return [
          ...createConnectionItem(inbound[type], inboundDesc),
          ...createConnectionItem(outbound[type], outboundDesc),
        ];
      }
    );
  }, [connectionDescriptions, node, edges, selectedId, nodes]);

  if (connections.length === 0) {
    return (
      <div className="text-neutral-400 text-sm p-3 border border-dashed border-neutral-700 text-center">
        This genre has no documented connections to other genres.
      </div>
    );
  }

  return (
    <Section heading="Connections" icon={<ArrowUpIcon />}>
      {connections.map(({ textParts, type, nodes }, index) => (
        <Collapsible
          title={<ConnectionHeading textParts={textParts} type={type} />}
          defaultOpen={true}
          key={index}
          showBorder={false}
        >
          <div className="flex flex-col gap-3">
            {nodes.map(
              ({ node: otherNode, shortDescription }, index) =>
                otherNode && (
                  <div
                    key={otherNode.id}
                    className={
                      index !== nodes.length - 1
                        ? "pb-3 border-b border-neutral-700"
                        : ""
                    }
                  >
                    <GenreLink
                      node={otherNode}
                      hoverPreview={false}
                      onMouseEnter={() => setFocusedId(otherNode.id)}
                      onMouseLeave={() => setFocusedId(null)}
                    >
                      {otherNode.label || otherNode.id}
                    </GenreLink>
                    {shortDescription && (
                      <small className="block text-xs text-neutral-400 ml-4">
                        <DisableTooltips>
                          <WikitextTruncateAtLength
                            wikitext={shortDescription}
                            length={200}
                          />
                        </DisableTooltips>
                      </small>
                    )}
                  </div>
                )
            )}
          </div>
        </Collapsible>
      ))}
    </Section>
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
      case "Derivative":
        return (
          <DerivativeIcon
            width={16}
            height={16}
            style={{ color: derivativeColour() }}
          />
        );
      case "Subgenre":
        return (
          <SubgenreIcon
            width={16}
            height={16}
            style={{ color: subgenreColour() }}
          />
        );
      case "FusionGenre":
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
                  type === "Derivative"
                    ? derivativeColour()
                    : type === "Subgenre"
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
