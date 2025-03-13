import { useEffect, useRef, useState } from "react";

import { SettingsData } from "../settings";
import { NodeData, EdgeData } from "../data";

import { Settings } from "./Settings";
import { SelectedNodeInfo } from "./SelectedNodeInfo";
import { ProjectInformation } from "./ProjectInformation";

export function Sidebar({
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
  settings: SettingsData;
  setSettings: React.Dispatch<React.SetStateAction<SettingsData>>;
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
              shouldShowMixes={settings.general.showMixes}
            />
          ) : (
            <Settings settings={settings} setSettings={setSettings} />
          )}
        </div>
      </div>
    </div>
  );
}
