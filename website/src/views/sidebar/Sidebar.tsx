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

/** Default width of the sidebar in pixels */
export const SIDEBAR_DEFAULT_WIDTH = 400;

/** The sidebar for the app. */
export function Sidebar({
  settings,
  setSettings,
  selectedId,
  setFocusedId,
  onMobileDragStart,
  isMobile,
  isFullscreen,
  isMinimized,
  searchComponent,
}: {
  settings: SettingsData;
  setSettings: React.Dispatch<React.SetStateAction<SettingsData>>;
  selectedId: string | null;
  setFocusedId: (id: string | null) => void;
  onMobileDragStart?: () => void;
  isMobile?: boolean;
  isFullscreen?: boolean;
  isMinimized?: boolean;
  searchComponent?: React.ReactNode;
}) {
  const collapseThreshold = 100;
  const minWidth = 200;
  const [width, setWidth] = useState(`${SIDEBAR_DEFAULT_WIDTH}px`);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    const handleMove = (clientX: number) => {
      if (!isResizing) return;

      const newWidth = window.innerWidth - clientX;
      const maxWidth = window.innerWidth * 0.5; // 50% max width

      // Snap to collapsed (0) if below threshold, otherwise clamp between min and max
      if (newWidth < collapseThreshold) {
        setWidth("0px");
      } else {
        setWidth(`${Math.min(Math.max(newWidth, minWidth), maxWidth)}px`);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      handleMove(e.clientX);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handleMove(e.touches[0].clientX);
      }
    };

    const handleEnd = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleEnd);
      document.addEventListener("touchmove", handleTouchMove);
      document.addEventListener("touchend", handleEnd);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleEnd);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleEnd);
    };
  }, [isResizing]);

  return (
    <div className="relative h-full overflow-visible">
      {/* Desktop resize handle - hidden on mobile, supports touch on tablets */}
      <div
        className={`hidden md:flex absolute -left-4 top-1/2 -translate-y-1/2 w-4 h-8 ${colourStyles.sidebar.resizer} cursor-ew-resize items-center justify-center z-20 ${
          isResizing ? colourStyles.sidebar.resizerActive : ""
        }`}
        onMouseDown={() => setIsResizing(true)}
        onTouchStart={() => setIsResizing(true)}
      >
        <ResizeHandleIcon className="text-slate-600 dark:text-slate-400 w-3 h-3" />
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
          isMinimized={isMinimized}
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
  isMinimized,
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
  isMinimized?: boolean;
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
      className={`h-full ${colourStyles.sidebar.background} ${isMobile ? `${colourStyles.sidebar.mobileBackground} rounded-t-2xl` : ""} text-slate-900 dark:text-white box-border flex flex-col overflow-hidden md:w-auto`}
    >
      {/* Mobile drag handle - visible only on mobile */}
      <div
        className="md:hidden w-full flex justify-center py-3 cursor-grab active:cursor-grabbing touch-none shrink-0"
        onTouchStart={onMobileDragStart}
      >
        <div className="w-16 h-3 bg-slate-400 dark:bg-slate-600 rounded-full" />
      </div>

      {/* Content hidden when minimized on mobile */}
      {!isMinimized && (
        <>
          {/* Search component when in fullscreen mode on mobile */}
          {isFullscreen && searchComponent && (
            <div className="w-full p-2 shrink-0">{searchComponent}</div>
          )}

          <div className={`flex-1 flex flex-col min-h-0 ${isMobile ? "" : "pr-2"}`}>
            {/* Fixed navigation bar at top */}
            <div className="flex shrink-0 gap-2 py-2">
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
                    className={`flex-1 p-2 rounded-lg cursor-pointer flex items-center justify-center overflow-hidden ${
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
        </>
      )}
    </div>
  );
}
