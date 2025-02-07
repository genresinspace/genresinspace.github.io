import { Cosmograph } from "@cosmograph/react";
import { useEffect, useState } from "react";

type NodeData = {
  id: string;
  label: string;
};

type LinkData = {
  source: string;
  target: string;
  ty: "StylisticOrigin" | "Derivative" | "Subgenre" | "FusionGenre";
};

function App() {
  const [data, setData] = useState<{ nodes: NodeData[]; links: LinkData[] }>({
    nodes: [],
    links: [],
  });
  useEffect(() => {
    async function fetchData() {
      const response = await fetch("/data.json");
      const data = await response.json();
      setData(data);
    }
    fetchData();
  }, []);

  return (
    <Cosmograph
      nodes={data.nodes}
      links={data.links}
      nodeColor={(d) => {
        const hash = d.id
          .split("")
          .reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) >>> 0, 0);
        const hue = Math.abs(hash % 360);
        return `hsl(${hue}, 70%, 60%)`;
      }}
      linkColor={(d) => {
        return d.ty === "StylisticOrigin"
          ? "hsl(0, 70%, 60%)"
          : d.ty === "Derivative"
          ? "hsl(90, 70%, 60%)"
          : d.ty === "Subgenre"
          ? "hsl(180, 70%, 60%)"
          : "hsl(270, 70%, 60%)";
      }}
      nodeSize={0.5}
      linkWidth={2}
      nodeLabelColor="#CCC"
      hoveredNodeLabelColor="#FFF"
    />
  );
}

export default App;
