import { useEffect, useRef, useState } from "react";

import { SettingsData } from "../../settings";

import { Settings } from "./Settings";
import { SelectedNodeInfo } from "./SelectedNodeInfo";
import { ProjectInformation } from "./ProjectInformation";
import {
  SettingsIcon,
  InfoIcon,
  EyeIcon,
  ResizeHandleIcon,
} from "../components/icons";

/** The sidebar for the app. */
export function Sidebar({
  settings,
  setSettings,
  selectedId,
  setFocusedId,
}: {
  settings: SettingsData;
  setSettings: React.Dispatch<React.SetStateAction<SettingsData>>;
  selectedId: string | null;
  setFocusedId: (id: string | null) => void;
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
      className="h-full bg-neutral-900 text-white box-border flex flex-col"
    >
      {/* Fixed navigation bar at top */}
      <div className="flex shrink-0">
        {[
          {
            id: "selected" as const,
            label: "Selected",
            icon: <EyeIcon className="mr-2" />,
            show: () => selectedId !== null,
          },
          {
            id: "information" as const,
            label: "Info",
            icon: <InfoIcon width={16} height={16} className="mr-2" />,
            show: () => true,
          },
          {
            id: "settings" as const,
            label: "Settings",
            icon: <SettingsIcon width={16} height={16} className="mr-2" />,
            show: () => true,
          },
        ]
          .filter((tab) => tab.show())
          .map((tab) => (
            <button
              key={tab.id}
              className={`flex-1 px-2 py-2 border-b-6 text-white cursor-pointer flex items-center justify-center ${
                activeTab === tab.id
                  ? "bg-violet-600 font-bold border-violet-500"
                  : "bg-gray-700 hover:bg-gray-600 border-gray-600"
              } transition-colors duration-200`}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
      </div>

      {/* Scrollable content area */}
      <div className="flex overflow-y-auto flex-1" ref={sidebarContentRef}>
        <div
          className={`h-auto w-4 cursor-ew-resize hover:bg-neutral-700 ${
            isResizing ? "bg-neutral-700" : ""
          } select-none flex items-center justify-center shrink-0 sticky top-0`}
          onMouseDown={() => setIsResizing(true)}
        >
          <ResizeHandleIcon className="text-neutral-500" />
        </div>
        <div className="flex-1">
          <div className="pr-4 py-4">
            {activeTab === "information" ? (
              <ProjectInformation
                visibleTypes={settings.visibleTypes}
                setVisibleTypes={(visibleTypes) =>
                  setSettings((prev) => ({ ...prev, visibleTypes }))
                }
                setFocusedId={setFocusedId}
              />
            ) : activeTab === "selected" ? (
              <SelectedNodeInfo
                selectedId={selectedId}
                setFocusedId={setFocusedId}
                shouldShowMixes={settings.general.showMixes}
                shouldAutoplayMixes={settings.general.autoplayMixes}
              />
            ) : (
              <Settings settings={settings} setSettings={setSettings} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
