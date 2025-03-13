import React from "react";
import { useCosmograph } from "@cosmograph/react";

import { NodeData, EdgeData } from "../Data";
import { derivativeColour, fusionGenreColour, subgenreColour } from "../Graph";

import { YouTubeVideoEmbed } from "../components/YouTubeEmbed";
import { YouTubePlaylistEmbed } from "../components/YouTubeEmbed";
import { Notice } from "../components/Notice";

import { GenreLink } from "../components/links/GenreLink";

import { WikipediaLink } from "../components/wikipedia/links/WikipediaLink";
import { Wikitext } from "../components/wikipedia/wikitexts/Wikitext";
import { WikitextTruncateAtNewline } from "../components/wikipedia/wikitexts/WikitextTruncateAtNewline";

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

  const getConnections = (isInbound: boolean) =>
    node.edges
      .map((edgeIndex) => edges[edgeIndex])
      .filter((edge) =>
        isInbound ? edge.target === selectedId : edge.source === selectedId
      )
      .reduce((acc, edge) => {
        const type = edge.ty;
        if (!acc[type]) acc[type] = [];
        acc[type].push(isInbound ? edge.source : edge.target);
        return acc;
      }, {} as Record<EdgeData["ty"], string[]>);

  const inbound = getConnections(true);
  const outbound = getConnections(false);

  const connectionDescriptions = [
    {
      type: "Derivative" as const,
      inbound: [
        { type: "text", content: "This was " },
        { type: "emphasis", content: "influenced" },
        { type: "text", content: " by:" },
      ],
      outbound: [
        { type: "text", content: "This has " },
        { type: "emphasis", content: "influenced" },
        { type: "text", content: ":" },
      ],
    },
    {
      type: "Subgenre" as const,
      inbound: [
        { type: "text", content: "This is a " },
        { type: "emphasis", content: "subgenre" },
        { type: "text", content: " of:" },
      ],
      outbound: [
        { type: "text", content: "This has " },
        { type: "emphasis", content: "subgenres" },
        { type: "text", content: ":" },
      ],
    },
    {
      type: "FusionGenre" as const,
      inbound: [
        { type: "text", content: "This " },
        { type: "emphasis", content: "fusion genre" },
        { type: "text", content: " draws upon:" },
      ],
      outbound: [
        { type: "text", content: "Used in these " },
        { type: "emphasis", content: "fusion genres" },
        { type: "text", content: ":" },
      ],
    },
  ];

  const renderHeading = (
    textParts: { type: string; content: string }[],
    type: EdgeData["ty"]
  ) => {
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
  };

  const connections = connectionDescriptions.flatMap(
    ({ type, inbound: inboundDesc, outbound: outboundDesc }) => {
      const connections = [];
      if (inbound[type]?.length > 0) {
        connections.push({
          heading: renderHeading(inboundDesc, type),
          nodeIds: inbound[type],
        });
      }
      if (outbound[type]?.length > 0) {
        connections.push({
          heading: renderHeading(outboundDesc, type),
          nodeIds: outbound[type],
        });
      }
      return connections;
    }
  );

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
                    <YouTubeVideoEmbed videoId={mix.video} className="mb-2" />
                  ) : (
                    <YouTubePlaylistEmbed
                      playlistId={mix.playlist}
                      className="mb-2"
                    />
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

      {connections.map(({ heading, nodeIds }, index) => (
        <div key={index}>
          <h3 className="text-lg font-medium mb-2">{heading}</h3>
          <ul className="list-disc pl-5">
            {nodeIds.map((id) => {
              const otherNode = nodes.find((n) => n.id === id);
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
        </div>
      ))}
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
