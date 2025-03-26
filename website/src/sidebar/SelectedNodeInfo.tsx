import React, { useMemo } from "react";
import { useCosmograph } from "@cosmograph/react";

import { NodeData, EdgeData } from "../data";
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
  const cosmograph = useCosmograph();

  if (!selectedId) {
    return <p>No node selected</p>;
  }

  const node = nodes.find((n) => n.id === selectedId);
  if (!node) return null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <WikipediaLink pageTitle={node.page_title}>
          <h2 className="text-xl font-bold">{node.label}</h2>
        </WikipediaLink>
        <small>
          Last updated:{" "}
          <em>{new Date(node.last_revision_date).toLocaleString()}</em>
        </small>
        <button
          className="w-full p-1 my-2 bg-neutral-800 hover:bg-neutral-700 text-white text-xs rounded"
          onClick={() => {
            if (cosmograph) {
              const targetNodeData = cosmograph.nodes?.[parseInt(node.id, 10)];
              if (targetNodeData) {
                cosmograph.cosmograph?.zoomToNode(targetNodeData);
              }
            }
          }}
        >
          Zoom to
        </button>
        {shouldShowMixes &&
          // TODO: proper switcher between videos
          (node.mixes ? (
            "help_reason" in node.mixes ? (
              <HelpNeededForMix reason={node.mixes.help_reason} />
            ) : (
              node.mixes.map((mix, i) => (
                <React.Fragment key={i}>
                  {"video" in mix ? (
                    <YouTubeEmbed videoId={mix.video} className="mb-2" />
                  ) : (
                    <YouTubeEmbed playlistId={mix.playlist} className="mb-2" />
                  )}
                  {mix.note && (
                    <Notice colour="blue">
                      <Wikitext wikitext={mix.note} />
                    </Notice>
                  )}
                </React.Fragment>
              ))
            )
          ) : (
            <Notice colour="red">
              There's no mix selected for this genre yet. If you know of a good
              mix or playlist that represents this genre well, please let me
              know - see the FAQ on how to contribute!
            </Notice>
          ))}
        {node.wikitext_description && (
          <WikitextTruncateAtNewline
            wikitext={node.wikitext_description}
            expandable={true}
          />
        )}
      </div>
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
  }, [connectionDescriptions, node, edges]);

  return connections.map(({ textParts, type, nodeIds }, index) => (
    <Collapsible
      title={<ConnectionHeading textParts={textParts} type={type} />}
      defaultOpen={true}
      key={index}
    >
      <ul className="list-disc pl-5">
        {nodeIds.map((id) => {
          const otherNode = nodes[parseInt(id, 10)];
          return (
            otherNode && (
              <li key={id}>
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
  ));
}

function ConnectionHeading({
  textParts,
  type,
}: {
  textParts: { type: string; content: string }[];
  type: EdgeData["ty"];
}) {
  return (
    <>
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
    </>
  );
}
