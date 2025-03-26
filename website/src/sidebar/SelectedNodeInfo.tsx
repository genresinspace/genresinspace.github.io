import { useMemo } from "react";
import { useCosmograph } from "@cosmograph/react";

import { NodeData, EdgeData, nodeIdToInt } from "../data";
import { derivativeColour, fusionGenreColour, subgenreColour } from "../Graph";

import { YouTubeEmbed } from "../components/YouTubeEmbed";
import { Notice } from "../components/Notice";

import { GenreLink } from "../components/links/GenreLink";

import { WikipediaLink } from "../components/wikipedia/links/WikipediaLink";
import { Wikitext } from "../components/wikipedia/wikitexts/Wikitext";
import { WikitextTruncateAtNewline } from "../components/wikipedia/wikitexts/WikitextTruncateAtNewline";
import { Collapsible } from "../components/Collapsible";

/** The sidebar panel for information about the selected node. */
export function SelectedNodeInfo({
  selectedId,
  setFocusedId,
  nodes,
  edges,
  shouldShowMixes,
}: {
  selectedId: string | null;
  setFocusedId: (id: string | null) => void;
  nodes: NodeData[];
  edges: EdgeData[];
  shouldShowMixes: boolean;
}) {
  if (!selectedId) {
    return <EmptyState />;
  }

  const node = nodes[nodeIdToInt(selectedId)];
  if (!node) return null;

  return (
    <div className="flex flex-col gap-4">
      <GenreHeader node={node} />

      {shouldShowMixes && <FeaturedMix node={node} />}

      {node.wikitext_description && (
        <GenreDescription description={node.wikitext_description} />
      )}

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
function GenreHeader({ node }: { node: NodeData }) {
  return (
    <div className="space-y-4">
      <div className="border-b border-neutral-700 pb-3">
        <WikipediaLink pageTitle={node.page_title}>
          <h2 className="text-3xl font-bold text-center">{node.label}</h2>
        </WikipediaLink>

        <div className="flex justify-between items-center mt-1">
          <small className="text-neutral-400">
            Updated:{" "}
            <em>{new Date(node.last_revision_date).toLocaleDateString()}</em>
          </small>

          <ZoomToNodeButton node={node} />
        </div>
      </div>
    </div>
  );
}

/** Button to zoom to the selected node in the graph */
function ZoomToNodeButton({ node }: { node: NodeData }) {
  const cosmograph = useCosmograph();

  return (
    <button
      className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white text-xs rounded transition-colors duration-200 flex items-center gap-1 shadow-sm"
      onClick={() => {
        if (cosmograph) {
          const targetNodeData = cosmograph.nodes?.[nodeIdToInt(node.id)];
          if (targetNodeData) {
            cosmograph.cosmograph?.zoomToNode(targetNodeData);
          }
        }
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      Zoom to node
    </button>
  );
}

/** Featured mix section */
function FeaturedMix({ node }: { node: NodeData }) {
  return (
    <div>
      <h3 className="text-lg font-semibold mb-2 text-neutral-200">
        Featured Mix
      </h3>
      {node.mixes ? (
        "help_reason" in node.mixes ? (
          <HelpNeededForMix reason={node.mixes.help_reason} />
        ) : (
          node.mixes.map((mix, i) => <MixItem key={i} mix={mix} />)
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
    </div>
  );
}

/** Individual mix item with video or playlist */
function MixItem({ mix }: { mix: any }) {
  return (
    <div className="bg-neutral-800 rounded-lg overflow-hidden shadow-md">
      {"video" in mix ? (
        <YouTubeEmbed videoId={mix.video} />
      ) : (
        <YouTubeEmbed playlistId={mix.playlist} />
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
    <div>
      <h3 className="text-lg font-semibold mb-2 text-neutral-200">
        Description
      </h3>
      <div className="border border-neutral-800 rounded-md p-4">
        <WikitextTruncateAtNewline wikitext={description} expandable={true} />
      </div>
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
      ({ type, inbound: inboundDesc, outbound: outboundDesc }) => [
        ...(inbound[type]?.length > 0
          ? [
              {
                textParts: inboundDesc,
                type,
                nodeIds: inbound[type],
              },
            ]
          : []),
        ...(outbound[type]?.length > 0
          ? [
              {
                textParts: outboundDesc,
                type,
                nodeIds: outbound[type],
              },
            ]
          : []),
      ]
    );
  }, [connectionDescriptions, node, edges, selectedId]);

  if (connections.length === 0) {
    return (
      <div className="text-neutral-400 text-sm p-3 border border-dashed border-neutral-700 rounded-lg text-center">
        This genre has no documented connections to other genres.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-neutral-200">Connections</h3>
      <div className="grid gap-2">
        {connections.map(({ textParts, type, nodeIds }, index) => (
          <Collapsible
            title={<ConnectionHeading textParts={textParts} type={type} />}
            defaultOpen={true}
            key={index}
          >
            <ul>
              {nodeIds.map((id) => {
                const otherNode = nodes[nodeIdToInt(id)];
                return (
                  otherNode && (
                    <li key={id} className="flex items-center">
                      <div
                        className="w-2 h-2 rounded-full mr-2"
                        style={{
                          backgroundColor:
                            type === "Derivative"
                              ? derivativeColour()
                              : type === "Subgenre"
                                ? subgenreColour()
                                : fusionGenreColour(),
                        }}
                      />
                      <GenreLink
                        genreId={id}
                        pageTitle={otherNode.page_title}
                        onMouseEnter={() => setFocusedId(id)}
                        onMouseLeave={() => setFocusedId(null)}
                      >
                        {otherNode.label || id}
                      </GenreLink>
                    </li>
                  )
                );
              })}
            </ul>
          </Collapsible>
        ))}
      </div>
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
      case "Derivative":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            style={{ color: derivativeColour() }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 5l7 7-7 7M5 5l7 7-7 7"
            />
          </svg>
        );
      case "Subgenre":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            style={{ color: subgenreColour() }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
          </svg>
        );
      case "FusionGenre":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            style={{ color: fusionGenreColour() }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"
            />
          </svg>
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
