import { useEffect, useRef, useState } from "react";

import { SettingsData } from "../../settings";

import { Settings } from "./Settings";
import { SelectedNodeInfo } from "./SelectedNodeInfo";
import { ProjectInformation } from "./ProjectInformation";

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
                icon: (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    className="mr-2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                ),
                show: () => selectedId !== null,
              },
              {
                id: "information" as const,
                label: "Info",
                icon: (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    className="mr-2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                ),
                show: () => true,
              },
              {
                id: "settings" as const,
                label: "Settings",
                icon: (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    className="mr-2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                ),
                show: () => true,
              },
            ]
              .filter((tab) => tab.show())
              .map((tab) => (
                <button
                  key={tab.id}
                  className={`flex-1 px-2 py-1 border-b-6 text-white cursor-pointer flex items-center justify-center ${
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
          {activeTab === "information" ? (
            <ProjectInformation settings={settings} setSettings={setSettings} />
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
  );
}
