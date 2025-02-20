import {
  Cosmograph,
  CosmographProvider,
  useCosmograph,
} from "@cosmograph/react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  createContext,
} from "react";
import {
  SimulationParams,
  SimulationControls,
  defaultSimulationParams,
} from "./SimulationParams";
import { ExternalLink, GenreLink } from "./Links";
import {
  dumpUrl,
  ShortWikitext,
  WikipediaLink,
  WikitextWithEllipsis,
} from "./Wikipedia";
import commit from "./commit.json";

// Ideally, we could integrate this into `commit.json`, but getting the "safe" URL from the checkout
// that GHA does is a bit tricky (we don't necessarily know what the remote's name is in that environment,
// and we'd have to convert the git@ URL to https://).
const REPO_LINK = "https://github.com/graphgenre/graphgenre.github.io";

type Settings = {
  general: {
    zoomOnSelect: boolean;
    maxInfluenceDistance: number;
    visibleTypes: {
      Derivative: boolean;
      Subgenre: boolean;
      FusionGenre: boolean;
    };
  };
  simulation: SimulationParams;
};
const defaultSettings: Settings = {
  general: {
    zoomOnSelect: true,
    maxInfluenceDistance: 3,
    visibleTypes: {
      Derivative: true,
      Subgenre: true,
      FusionGenre: true,
    },
  },
  simulation: defaultSimulationParams,
};

type Data = {
  wikipedia_domain: string;
  wikipedia_db_name: string;
  dump_date: string;
  nodes: NodeData[];
  edges: EdgeData[];
  links_to_page_ids: Record<string, string>;
  max_degree: number;
};
type NodeData = {
  id: string;
  page_title: string;
  wikitext_description?: string;
  label: string;
  last_revision_date: string;
  edges: number[];
};
type EdgeData = {
  source: string;
  target: string;
  ty: "Derivative" | "Subgenre" | "FusionGenre";
};

export const LinksToPageIdContext = createContext<Record<string, string>>({});
export const WikipediaMetaContext = createContext<{
  dbName: string;
  domain: string;
} | null>(null);

const derivativeColour = (saturation: number = 70, alpha: number = 1) =>
  `hsla(0, ${saturation}%, 60%, ${alpha})`;
const subgenreColour = (saturation: number = 70, alpha: number = 1) =>
  `hsla(120, ${saturation}%, 60%, ${alpha})`;
const fusionGenreColour = (saturation: number = 70, alpha: number = 1) =>
  `hsla(240, ${saturation}%, 60%, ${alpha})`;

// Helper types for storing path information
type NodeDistances = Map<string, number>;
type EdgeDistances = Map<EdgeData, number>;
interface PathInfo {
  nodeDistances: NodeDistances;
  // Maps edge index to its distance from source
  edgeDistances: EdgeDistances;
  immediateNeighbours: Set<string>;
}
function getPathsWithinDistance(
  startId: string,
  nodes: NodeData[],
  edges: EdgeData[],
  visibleTypes: Settings["general"]["visibleTypes"],
  maxDistance: number
): PathInfo {
  const nodeDistances = new Map<string, number>();
  const edgeDistances = new Map<EdgeData, number>();
  const immediateNeighbours = new Set<string>();

  const startNodeData = nodes[parseInt(startId, 10)];
  if (startNodeData) {
    immediateNeighbours.add(startNodeData.id);
    for (const edgeIndex of startNodeData.edges) {
      const edge = edges[edgeIndex];
      if (visibleTypes[edge.ty]) {
        immediateNeighbours.add(edge.source);
        immediateNeighbours.add(edge.target);
      }
    }
  }

  // Set the starting node
  nodeDistances.set(startId, 0);

  let frontier = new Set([startId]);
  let currentDistance = 0;

  while (frontier.size > 0 && currentDistance < maxDistance) {
    const nextFrontier = new Set<string>();
    currentDistance++;

    for (const nodeId of frontier) {
      const nodeIndex = parseInt(nodeId, 10);
      const nodeData = nodes[nodeIndex];

      if (!nodeData) continue;

      // Process outgoing edges
      for (const edgeIndex of nodeData.edges) {
        const edge = edges[edgeIndex];
        if (!visibleTypes[edge.ty]) continue;
        if (edge.source === nodeId) {
          // Only follow outgoing edges
          const targetId = edge.target;

          // If we haven't seen this node yet
          if (!nodeDistances.has(targetId)) {
            nodeDistances.set(targetId, currentDistance);
            edgeDistances.set(edge, currentDistance);
            nextFrontier.add(targetId);
          }
        }
      }
    }

    frontier = nextFrontier;
  }

  return { nodeDistances, edgeDistances: edgeDistances, immediateNeighbours };
}

function Graph({
  settings,
  maxDegree,
  selectedId,
  setSelectedId,
  focusedId,
}: {
  settings: Settings;
  maxDegree: number;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  focusedId: string | null;
}) {
  const { cosmograph, nodes, links } = useCosmograph<NodeData, EdgeData>()!;

  // Calculate connected paths and their distances
  const maxDistance = settings.general.maxInfluenceDistance;
  const pathInfo = useMemo(() => {
    if (!selectedId || !nodes || !links)
      return { nodeDistances: new Map(), edgeDistances: new Map() } as PathInfo;
    return getPathsWithinDistance(
      selectedId,
      nodes,
      links,
      settings.general.visibleTypes,
      maxDistance
    );
  }, [selectedId, nodes, links, maxDistance, settings.general.visibleTypes]);

  useEffect(() => {
    const nodeData = selectedId ? nodes?.[parseInt(selectedId, 10)] : null;
    if (nodeData) {
      cosmograph?.selectNode(nodeData, false);
      if (settings.general.zoomOnSelect) {
        cosmograph?.zoomToNode(nodeData);
      }
    } else {
      cosmograph?.unselectNodes();
    }
  }, [selectedId]);

  useEffect(() => {
    const nodeData = focusedId ? nodes?.[parseInt(focusedId, 10)] : null;
    if (nodeData) {
      cosmograph?.focusNode(nodeData);
    } else {
      cosmograph?.focusNode(undefined);
    }
  }, [focusedId, nodes]);

  const onClick = (nodeData: NodeData | undefined): void => {
    setSelectedId(nodeData && selectedId !== nodeData.id ? nodeData.id : null);
  };

  return (
    <Cosmograph
      disableSimulation={false}
      backgroundColor="#000"
      nodeLabelAccessor={(d: NodeData) => d.label}
      nodeColor={(d) => {
        let color = nodeColour(d, maxDegree);

        if (selectedId) {
          if (
            pathInfo.immediateNeighbours.has(d.id) ||
            (pathInfo.nodeDistances.get(d.id) || Number.POSITIVE_INFINITY) <
              maxDistance
          ) {
            return color;
          } else {
            return "hsl(0, 0%, 60%)";
          }
        } else {
          return color;
        }
      }}
      linkColor={(d: EdgeData) => {
        if (!settings.general.visibleTypes[d.ty]) {
          return "rgba(0, 0, 0, 0)";
        }

        let colour = (saturation: number, alpha: number) =>
          d.ty === "Derivative"
            ? derivativeColour(saturation, alpha)
            : d.ty === "Subgenre"
            ? subgenreColour(saturation, alpha)
            : fusionGenreColour(saturation, alpha);

        const selectedAlpha = 0.8;
        const selectedMinInfluenceAlpha = 0.4;
        const selectedDimmedAlpha = 0.1;
        const unselectedAlpha = 0.3;

        if (selectedId) {
          if (d.source === selectedId) {
            return colour(90, selectedAlpha);
          } else if (d.target === selectedId) {
            return colour(40, selectedAlpha);
          } else {
            let distance = pathInfo.edgeDistances.get(d);
            if (distance !== undefined) {
              const factor = 1 - distance / maxDistance;
              const saturation = Math.max(0, 100 * factor);
              const alpha =
                selectedMinInfluenceAlpha +
                (selectedAlpha - selectedMinInfluenceAlpha) * factor;

              // Use the appropriate base color based on edge type
              if (saturation > 0) {
                return colour(saturation, alpha);
              }
            }

            // Edges not in path
            return `hsla(0, 0%, 20%, ${selectedDimmedAlpha})`;
          }
        }

        // Default edge colors when no selection
        return colour(70, unselectedAlpha);
      }}
      nodeSize={(d: NodeData) => {
        return (
          8.0 * (0.2 + (d.edges.length / maxDegree) * 0.8) +
          1.0 *
            (selectedId &&
            !(
              pathInfo.immediateNeighbours.has(d.id) ||
              (pathInfo.nodeDistances.get(d.id) || Number.POSITIVE_INFINITY) <
                maxDistance
            )
              ? -1
              : 0) +
          1.0 * (focusedId === d.id ? 1 : 0)
        );
      }}
      linkWidth={(d: EdgeData) => {
        if (selectedId) {
          if (d.source === selectedId) {
            return 2.5;
          } else if (d.target === selectedId) {
            return 1.5;
          }
          const distance = pathInfo.edgeDistances.get(d);
          if (distance !== undefined) {
            // Scale width based on distance, with minimum of 1
            return Math.max(1, 2.5 * (1 - distance / maxDistance));
          }
        }
        return 1;
      }}
      linkArrowsSizeScale={1}
      nodeLabelColor="#CCC"
      hoveredNodeLabelColor="#FFF"
      spaceSize={8192}
      {...settings.simulation}
      randomSeed={"Where words fail, music speaks"}
      nodeGreyoutOpacity={1}
      linkGreyoutOpacity={1}
      linkVisibilityMinTransparency={selectedId ? 0.75 : 0.25}
      onClick={onClick}
      onLabelClick={onClick}
    />
  );
}

function nodeColour(d: NodeData, maxDegree: number, lightness: number = 60) {
  const hash = d.id
    .split("")
    .reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) >>> 0, 0);
  const hue = Math.abs(hash % 360);
  let color = `hsl(${hue}, ${
    ((d.edges.length / maxDegree) * 0.8 + 0.2) * 100
  }%, ${lightness}%)`;
  return color;
}

function Collapsible({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-lg font-bold"
      >
        {isOpen ? "▼" : "▶"} {title}
      </button>
      {isOpen && children}
    </div>
  );
}

function FAQ({ dumpDate }: { dumpDate: string }) {
  const faqs = [
    {
      question: "Why build this?",
      answer: (
        <>
          <p>
            When I'm working on things, I often listen to genre mixes on
            YouTube; the curation by connoisseurs, especially well-mixed, is
            sublime. However, I wanted to branch out and listen to genres that I
            was unfamiliar with, but with the condition that I wanted to explore
            outwards from what I already knew.
          </p>
          <p>
            However, I have a tendency to start projects with too large a scope,
            which inevitably leads to them never being finished. I didn't want
            to work my way through a checklist and burn out on music-listening
            homework.
          </p>
          <p>
            While working on{" "}
            <ExternalLink href="https://philpax.me">my website</ExternalLink>, I
            became reacquainted with{" "}
            <ExternalLink href="https://eightyeightthirty.one">
              8831
            </ExternalLink>
            , a project by my friend,{" "}
            <ExternalLink href="https://notnite.me">NotNite</ExternalLink>.
            Looking at it, I realised I could create a project that I could
            actually finish that would actually solve a problem I actually have:
            I could visualise the graph of genres - or at least the ones English
            Wikipedia knows about - and attach mixes to each genre, so that I
            could share a little taste of everything with the world (including
            myself!)
          </p>
          <p>
            In addition to that, Wikipedia is one of the greatest resources of
            our time, and I wanted to do two things: encourage people to improve
            this little slice of it (I've certainly made a few edits while
            working on this!) and to draw attention to{" "}
            <ExternalLink href="https://www.theatlantic.com/technology/archive/2025/02/elon-musk-wikipedia/681577/">
              the vicious attacks by people who would rather you didn't know any
              better
            </ExternalLink>
            . Don't let them take it from you.
          </p>
        </>
      ),
    },
    {
      question: `Why is the data ${Math.ceil(
        (Date.now() - new Date(dumpDate).getTime()) / (1000 * 60 * 60 * 24)
      )} days old?`,
      answer: (
        <>
          <p>
            This website does not use live data from Wikipedia, because finding
            all of the genres and the links between them would be unkind to
            Wikipedia's API.
          </p>
          <p>
            Instead, I used one of Wikipedia's regularly-scheduled database
            downloads ("dumps"), which allowed me to process every article and
            link to my heart's content without worrying about being a bad
            internet citizen.
          </p>
          <p>
            Every once in a while, I will manually update the dump used to the
            latest version available. I wouldn't mind automating this, but as
            you might imagine, processing all of Wikipedia requires
            computational resources that I have access to locally, but that I'd
            have to pay for if I ran it remotely. Some day, maybe.
          </p>
        </>
      ),
    },
    {
      question: "Why is the graph missing genres?",
      answer: (
        <>
          <p>
            The English Wikipedia doesn't capture the full breadth of the world
            of music for a variety of reasons:
            <ul className="list-disc pl-5">
              <li>the genre is poorly known in the English-speaking world</li>
              <li>nobody has made the time to write an article about it</li>
              <li>
                it's just not notable enough to merit an entire article, or a
                section of an article
              </li>
              <li>
                it's not treated as a genre unto itself by Wikipedia: for
                example, "classical music" is too broad to be considered just
                one genre, so it's not represented here outside of downstream
                genres
              </li>
            </ul>
          </p>
          <p>
            This sucks, but it means that every genre covered here has{" "}
            <em>some</em> information attached to it to help you contextualise
            it. In future, I may consider using genres from MusicBrainz and/or
            other-language Wikis.
          </p>
          <p>
            To see what's <em>really</em> out there, check out{" "}
            <ExternalLink href="https://musicbrainz.org/genres">
              MusicBrainz' genres
            </ExternalLink>
            , or poke around{" "}
            <ExternalLink href="https://everynoise.com/">
              Every Noise At Once
            </ExternalLink>
            .
          </p>
          <p>
            Of course, I encourage you to take matters into your own hands: if
            there's a genre that you think should be here, you can update
            Wikipedia and make that a reality! Spread knowledge of <em>your</em>{" "}
            favourite genre to everyone!
          </p>
        </>
      ),
    },
    {
      question: 'What does the "wp" next to each genre mean?',
      answer:
        "That's the link to the corresponding Wikipedia article for the genre, as opposed to the primary link, which navigates you to that genre in the graph.",
    },
    {
      question: "Who selected the mixes, and under what criteria?",
      answer: (
        <>
          <p>
            Tentative answer: I did, under essentially vibes-based criteria: I
            looked at the most relevant/most viewed mixes for a given genre, and
            then picked the mixes that looked like they had the most
            effort/love/curation.
          </p>
          <p>
            I'm very open to suggestions for new mixes or replacements - see the
            FAQ entry below on how to contact me!
          </p>
        </>
      ),
    },
    {
      question: "How does this compare to the other music mapping projects?",
      answer: (
        <>
          <p>
            I encourage you to check out other projects of a similar ilk! This
            project is designed to show you how the genres are connected, and to
            give you a representative mix for each; but you may find other maps
            more germane to your interests.
          </p>
          <p>
            Here's the ones I'm aware of:
            <ul className="list-disc pl-5">
              <li>
                <ExternalLink href="https://everynoise.com/">
                  Every Noise At Once
                </ExternalLink>
                : a word cloud of genres, arranged across axes, and with
                perspective-altering filters to further contextualise the
                development and influence of each genre
              </li>
              <li>
                <ExternalLink href="https://musicmap.info/">
                  Musicmap
                </ExternalLink>
                : an extremely-well-researched, high-quality map of the world of
                music, with genealogy, purpose-written text, references, and
                more
              </li>
            </ul>
          </p>
        </>
      ),
    },
    {
      question: "Why is it difficult to pan the graph at times?",
      answer: (
        <p>
          That's a technical limitation of the solution I'm using for the graph:
          the labels for each genre block the motion for panning, and there are
          a *lot* of labels. I'm still working on a way to address this.
        </p>
      ),
    },
    {
      question: "What's with the ring of genres around the graph?",
      answer: (
        <p>
          Those are genres that have very few, or zero, connections to the rest
          of the graph. This can happen because their connections are
          poorly-documented, they're unique and have few connections to other
          genres (most often the case with traditional cultural music), or
          they're too broad to be a distinct entity that other genres can
          connect to.
        </p>
      ),
    },
    {
      question:
        "Why are some genres' descriptions kind of broken, but look fine on Wikipedia?",
      answer: (
        <>
          <p>
            Wikipedia articles are written in "wikitext". I process the raw
            wikitext to extract information, and then use my own code to display
            that wikitext here by roughly replicating Wikipedia's display logic.
          </p>
          <p>
            Unfortunately, my code isn't perfect: it's basically a Minimum
            Viable Product, and has <em>many</em> rough edges. It especially
            breaks down around non-English languages (sorry!). Please write to
            me if you see something egregiously broken!
          </p>
        </>
      ),
    },
    {
      question:
        "I'd like to reach out to you about a bug/a feature/a music mix/something else. How can I do that?",
      answer: (
        <p>
          If you have a GitHub account, I'd appreciate you creating an issue in{" "}
          <ExternalLink href={REPO_LINK}>the repository</ExternalLink>.
          Otherwise, feel free to contact me through one of the means mentioned
          on <ExternalLink href="https://philpax.me">my website</ExternalLink>!
        </p>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {faqs.map((faq, index) => (
        <div key={index}>
          <p className="font-bold">{faq.question}</p>
          <div className="mt-1 flex flex-col gap-2">{faq.answer}</div>
        </div>
      ))}
    </div>
  );
}

function ProjectInformation({
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
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
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
          <div className="flex gap-2 mt-1">
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
          </div>
        </p>
        <Collapsible title="Legend" defaultOpen={true}>
          <div className="flex flex-col gap-2 mt-1">
            {[
              {
                color: derivativeColour(),
                label: "Derivative",
                type: "Derivative" as const,
                description:
                  "Genres that use some of the elements inherent to this genre, without being a child genre.",
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
                        setSettings((prev: Settings) => ({
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

function SelectedNodeInfo({
  selectedId,
  setFocusedId,
  nodes,
  edges,
}: {
  selectedId: string | null;
  setFocusedId: (id: string | null) => void;
  nodes: NodeData[];
  edges: EdgeData[];
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
        {node.wikitext_description && (
          <ShortWikitext
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

function Search({
  selectedId,
  setFocusedId,
  nodes,
  filter,
  setFilter,
}: {
  selectedId: string | null;
  setFocusedId: (id: string | null) => void;
  nodes: NodeData[];
  filter: string;
  setFilter: (filter: string) => void;
}) {
  const results = useMemo(() => {
    if (filter.length < 2) {
      return [];
    }

    // Check if current filter matches selected node before showing results
    const selectedNode = selectedId ? nodes[parseInt(selectedId, 10)] : null;
    if (selectedNode?.label.toLowerCase() === filter.toLowerCase()) {
      return [];
    }

    // Normalize the filter string to remove diacritics and convert to lowercase
    const normalizeStr = (str: string) =>
      str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

    const normalizedFilter = normalizeStr(filter);

    return nodes
      .filter((node) => normalizeStr(node.label).includes(normalizedFilter))
      .sort((a, b) => {
        // Sort by closest length first
        const lengthDiffA = Math.abs(a.label.length - filter.length);
        const lengthDiffB = Math.abs(b.label.length - filter.length);
        if (lengthDiffA !== lengthDiffB) {
          return lengthDiffA - lengthDiffB;
        }
        // Then alphabetically
        return a.label.localeCompare(b.label);
      });
  }, [filter, nodes, selectedId]);

  return (
    <div>
      <input
        type="text"
        placeholder="Search for genre..."
        className="w-full p-2 bg-neutral-800 rounded-md mb-2"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto">
        {results.map((node) => (
          <div
            key={node.id}
            className="p-2 bg-neutral-900 rounded-lg hover:bg-neutral-700 transition-colors"
            onMouseEnter={() => setFocusedId(node.id)}
            onMouseLeave={() => setFocusedId(null)}
          >
            <GenreLink genreId={node.id} pageTitle={node.page_title}>
              {node.label}
            </GenreLink>
            <small className="block">
              <WikitextWithEllipsis
                wikitext={node.wikitext_description ?? ""}
                length={100}
              />
            </small>
          </div>
        ))}
      </div>
    </div>
  );
}

function Settings({
  settings,
  setSettings,
}: {
  settings: Settings;
  setSettings: (settings: Settings) => void;
}) {
  return (
    <>
      <section>
        <h2 className="text-lg font-extrabold mb-2">General</h2>
        <div className="mb-2">
          <label title="Whether or not to zoom / pan the graph upon selecting a node.">
            <input
              type="checkbox"
              checked={settings.general.zoomOnSelect}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  general: {
                    ...settings.general,
                    zoomOnSelect: e.target.checked,
                  },
                })
              }
            />
            Zoom on select
          </label>
        </div>
        <div className="mb-2">
          <label
            title="Controls how many steps away from the selected node to highlight connected nodes and connections"
            className="block font-bold"
          >
            Maximum Influence Distance
          </label>
          <input
            type="range"
            min={1}
            max={5}
            step={1}
            value={settings.general.maxInfluenceDistance - 1}
            onChange={(e) =>
              setSettings({
                ...settings,
                general: {
                  ...settings.general,
                  maxInfluenceDistance: parseInt(e.target.value) + 1,
                },
              })
            }
          />
          <span className="value">
            {settings.general.maxInfluenceDistance - 1}
          </span>
          <p className="description">
            When a node is selected, highlight nodes and connections that are up
            to this many steps away in the graph. Higher values show more of the
            network around the selected node.
          </p>
        </div>
      </section>
      <section>
        <h2 className="text-lg font-extrabold mb-2">Simulation</h2>
        <SimulationControls
          params={settings.simulation}
          setParams={(params) =>
            setSettings({ ...settings, simulation: params })
          }
        />
      </section>
    </>
  );
}

function Sidebar({
  settings,
  setSettings,
  databaseName,
  dumpDate,
  selectedId,
  setFocusedId,
  nodes,
  edges,
  maxDegree,
}: {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  databaseName: string;
  dumpDate: string;
  selectedId: string | null;
  setFocusedId: (id: string | null) => void;
  nodes: NodeData[];
  edges: EdgeData[];
  maxDegree: number;
}) {
  const [activeTab, setActiveTab] = useState<
    "information" | "selected" | "settings"
  >("information");
  const [width, setWidth] = useState("20%");
  const sidebarRef = useRef<HTMLDivElement>(null);
  const sidebarContentRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const newWidth = window.innerWidth - e.clientX;
      const minWidth = 300;
      const maxWidth = window.innerWidth * 0.4; // 40% max width

      setWidth(`${Math.min(Math.max(newWidth, minWidth), maxWidth)}px`);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  useEffect(() => {
    if (selectedId) {
      setActiveTab("selected");
      sidebarContentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      setActiveTab("information");
    }
  }, [selectedId]);

  return (
    <div
      ref={sidebarRef}
      style={{ width, userSelect: isResizing ? "none" : "auto" }}
      className="h-full bg-neutral-900 text-white box-border flex"
    >
      <div
        className={`h-full w-4 cursor-ew-resize hover:bg-neutral-700 ${
          isResizing ? "bg-neutral-700" : ""
        } select-none flex items-center justify-center shrink-0`}
        onMouseDown={() => setIsResizing(true)}
      >
        <svg
          width="8"
          height="16"
          viewBox="0 0 8 16"
          fill="currentColor"
          className="text-neutral-500"
        >
          <path d="M2 0h1v16H2V0zM5 0h1v16H5V0z" />
        </svg>
      </div>
      <div className="flex-1 overflow-y-auto" ref={sidebarContentRef}>
        <div className="p-5 pl-1">
          <div className="flex mb-4">
            {[
              {
                id: "selected" as const,
                label: "Selected",
                show: () => selectedId !== null,
              },
              { id: "information" as const, label: "Info", show: () => true },
              { id: "settings" as const, label: "Settings", show: () => true },
            ]
              .filter((tab) => tab.show())
              .map((tab) => (
                <button
                  key={tab.id}
                  className={`flex-1 p-2 border-none text-neutral-300 cursor-pointer ${
                    activeTab === tab.id
                      ? "bg-neutral-800"
                      : "bg-neutral-800/50"
                  }`}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                >
                  {tab.label}
                </button>
              ))}
          </div>
          {activeTab === "information" ? (
            <ProjectInformation
              nodes={nodes}
              edges={edges}
              databaseName={databaseName}
              dumpDate={dumpDate}
              settings={settings}
              setSettings={setSettings}
              maxDegree={maxDegree}
            />
          ) : activeTab === "selected" ? (
            <SelectedNodeInfo
              selectedId={selectedId}
              setFocusedId={setFocusedId}
              nodes={nodes}
              edges={edges}
            />
          ) : (
            <Settings settings={settings} setSettings={setSettings} />
          )}
        </div>
      </div>
    </div>
  );
}

function App() {
  const [data, setData] = useState<Data | undefined>();
  const [loadingProgress, setLoadingProgress] = useState(0);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("/data.json");
        const reader = response.body?.getReader();
        const contentLength = +(response.headers.get("Content-Length") ?? 0);

        if (!reader) {
          const data = await response.json();
          setData(data);
          return;
        }

        let receivedLength = 0;
        let chunks = [];

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          chunks.push(value);
          receivedLength += value.length;

          setLoadingProgress(
            contentLength ? receivedLength / contentLength : 0
          );
        }

        const chunksAll = new Uint8Array(receivedLength);
        let position = 0;
        for (let chunk of chunks) {
          chunksAll.set(chunk, position);
          position += chunk.length;
        }

        const result = new TextDecoder("utf-8").decode(chunksAll);
        const data = JSON.parse(result);
        setData(data);
      } catch (error) {
        console.error("Error loading data:", error);
      }
    }
    fetchData();
  }, []);

  // Selection
  const [selectedId, setSelectedIdRaw] = useState<string | null>(() => {
    const hash = window.location.hash.slice(1);
    return hash || null;
  });
  const [filter, setFilter] = useState("");

  // Wrapper function to handle both states
  const setSelectedId = useCallback(
    (newId: string | null) => {
      setSelectedIdRaw(newId);
      if (newId && data) {
        const nodeData = data.nodes[parseInt(newId, 10)];
        if (nodeData) {
          setFilter(nodeData.label);
          document.title = `graphgenre: ${nodeData.label}`;
        }
      } else {
        setFilter("");
        document.title = "graphgenre";
      }
      setFocusedId(newId);
    },
    [data]
  );

  // Handle hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      setSelectedId(hash || null);
    };

    // Handle initial load
    handleHashChange();

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [setSelectedId]);

  // Handle URL updates
  useEffect(() => {
    if (selectedId && window.location.hash !== `#${selectedId}`) {
      window.history.pushState(null, "", `#${selectedId}`);
    } else if (!selectedId && window.location.hash) {
      window.history.pushState(null, "", window.location.pathname);
    }
  }, [selectedId]);

  // Focus, visible
  const [focusedId, setFocusedRawId] = useState<string | null>(null);

  const setFocusedId = useCallback(
    (id: string | null) => {
      if (id) {
        setFocusedRawId(id);
      } else if (selectedId) {
        setFocusedRawId(selectedId);
      } else {
        setFocusedRawId(null);
      }
    },
    [data, selectedId]
  );

  const [settings, setSettings] = useState<Settings>(defaultSettings);

  if (!data) {
    return (
      <div className="flex w-screen h-screen items-center justify-center bg-neutral-900 text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-neutral-600 border-t-white rounded-full animate-spin" />
          {loadingProgress > 0 && (
            <div>Loading... {Math.round(loadingProgress * 100)}%</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <WikipediaMetaContext.Provider
      value={{ dbName: data.wikipedia_db_name, domain: data.wikipedia_domain }}
    >
      <LinksToPageIdContext.Provider value={data.links_to_page_ids}>
        <div className="flex w-screen h-screen">
          <CosmographProvider nodes={data.nodes} links={data.edges}>
            <div className="flex-1 h-full relative">
              <Graph
                settings={settings}
                maxDegree={data.max_degree}
                selectedId={selectedId}
                setSelectedId={setSelectedId}
                focusedId={focusedId}
              />
              <div className="absolute top-4 left-4 z-50 w-sm text-white">
                <Search
                  selectedId={selectedId}
                  setFocusedId={setFocusedId}
                  nodes={data.nodes}
                  filter={filter}
                  setFilter={setFilter}
                />
              </div>
            </div>
            <Sidebar
              settings={settings}
              setSettings={setSettings}
              databaseName={data.wikipedia_db_name}
              dumpDate={data.dump_date}
              selectedId={selectedId}
              setFocusedId={setFocusedId}
              nodes={data.nodes}
              edges={data.edges}
              maxDegree={data.max_degree}
            />
          </CosmographProvider>
        </div>
      </LinksToPageIdContext.Provider>
    </WikipediaMetaContext.Provider>
  );
}

export default App;
