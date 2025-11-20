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
import { colourStyles } from "../colours";

/** The sidebar for the app. */
export function Sidebar({
  settings,
  setSettings,
  selectedId,
  setFocusedId,
  onMobileDragStart,
  isMobile,
  isFullscreen,
  searchComponent,
}: {
  settings: SettingsData;
  setSettings: React.Dispatch<React.SetStateAction<SettingsData>>;
  selectedId: string | null;
  setFocusedId: (id: string | null) => void;
  onMobileDragStart?: () => void;
  isMobile?: boolean;
  isFullscreen?: boolean;
  searchComponent?: React.ReactNode;
}) {
  const minWidth = 300;
  const [width, setWidth] = useState(`${minWidth}px`);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const newWidth = window.innerWidth - e.clientX;
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

  return (
    <div className="relative h-full overflow-visible">
      {/* Desktop resize handle - hidden on mobile */}
      <div
        className={`hidden md:block absolute -left-4 top-1/2 transform -translate-y-1/2 w-4 h-8 ${colourStyles.sidebar.resizer} cursor-ew-resize flex items-center justify-center z-20 ${
          isResizing ? colourStyles.sidebar.resizerActive : ""
        }`}
        onMouseDown={() => setIsResizing(true)}
      >
        <ResizeHandleIcon className="text-neutral-400 w-3 h-3" />
      </div>

      <div
        style={{ userSelect: isResizing ? "none" : "auto" }}
        className="h-full"
      >
        <SidebarContent
          settings={settings}
          setSettings={setSettings}
          selectedId={selectedId}
          setFocusedId={setFocusedId}
          width={width}
          onMobileDragStart={onMobileDragStart}
          isMobile={isMobile}
          isFullscreen={isFullscreen}
          searchComponent={searchComponent}
        />
      </div>
    </div>
  );
}

function SidebarContent({
  settings,
  setSettings,
  selectedId,
  setFocusedId,
  width,
  onMobileDragStart,
  isMobile,
  isFullscreen,
  searchComponent,
}: {
  settings: SettingsData;
  setSettings: React.Dispatch<React.SetStateAction<SettingsData>>;
  selectedId: string | null;
  setFocusedId: (id: string | null) => void;
  width: string;
  onMobileDragStart?: () => void;
  isMobile?: boolean;
  isFullscreen?: boolean;
  searchComponent?: React.ReactNode;
}) {
  const [activeTab, setActiveTab] = useState<
    "information" | "selected" | "settings"
  >("information");
  const sidebarContentRef = useRef<HTMLDivElement>(null);

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
      style={isMobile ? { userSelect: "auto" } : { width, userSelect: "auto" }}
      className={`h-full ${colourStyles.sidebar.background} text-white box-border flex flex-col overflow-hidden md:w-auto`}
    >
      {/* Mobile drag handle - visible only on mobile */}
      <div
        className="md:hidden w-full flex justify-center py-2 cursor-grab active:cursor-grabbing touch-none"
        onTouchStart={onMobileDragStart}
      >
        <div className="w-12 h-1 bg-neutral-600 rounded-full" />
      </div>

      {/* Search component when in fullscreen mode on mobile */}
      {isFullscreen && searchComponent && (
        <div className="w-full p-2 shrink-0">{searchComponent}</div>
      )}

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
              className={`flex-1 p-2 text-white cursor-pointer flex items-center justify-center ${
                activeTab === tab.id
                  ? colourStyles.sidebar.itemActive
                  : colourStyles.sidebar.itemInactive
              } transition-colors duration-200`}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto min-h-0" ref={sidebarContentRef}>
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
  );
}
