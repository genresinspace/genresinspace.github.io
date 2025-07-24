import React, { useState, useRef, useEffect } from "react";
import { WikitextSimplifiedNode } from "frontend_wasm";
import { wikimediaCommmonsAssetUrl } from "../urls";
import { Wikitext } from "../wikitexts/Wikitext";
import { templateToObject } from "./util";
import { colourStyles } from "../../../../../../colours";

interface AudioPlayerProps {
  filename: string;
  title: string;
  startTime?: string;
}

function AudioPlayer({ filename, startTime }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Convert startTime string (like "0:20") to seconds
  const parseStartTime = (time?: string): number => {
    if (!time) return 0;

    const parts = time.split(":").map(Number).reverse();
    let seconds = 0;

    for (let i = 0; i < parts.length; i++) {
      seconds += parts[i] * Math.pow(60, i);
    }

    return seconds;
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const startTimeInSeconds = parseStartTime(startTime);

    // Set initial start time if provided
    if (startTimeInSeconds > 0) {
      audio.currentTime = startTimeInSeconds;
    }

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [startTime]);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch((err) => console.error("Error playing audio:", err));
    }
    setIsPlaying(!isPlaying);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const newTime = parseFloat(e.target.value);
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Format time as mm:ss or hh:mm:ss
  const formatTime = (time: number): string => {
    if (isNaN(time)) return "0:00";

    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    } else {
      return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    }
  };

  return (
    <div className="flex flex-col space-y-1 min-w-[200px]">
      <audio
        ref={audioRef}
        src={wikimediaCommmonsAssetUrl(filename)}
        preload="metadata"
      />

      <div className="flex items-center space-x-2">
        <button
          onClick={togglePlayPause}
          className={`w-8 h-8 flex items-center justify-center ${colourStyles.audio.button} rounded-full text-gray-200`}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <span className="text-sm">⏸️</span>
          ) : (
            <span className="text-sm">▶️</span>
          )}
        </button>
        <div className="grow">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSliderChange}
            className={`w-full h-2 ${colourStyles.audio.progress} rounded-lg appearance-none cursor-pointer`}
          />
        </div>
        <div className="text-xs text-gray-300 w-14 text-right">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>
    </div>
  );
}

/**
 * Renders a Wikipedia "Listen" template, which displays audio players
 */
export function Listen({
  node,
}: {
  node: Extract<WikitextSimplifiedNode, { type: "template" }>;
}) {
  const params = templateToObject(node);

  // Get all the numbered parameters for multiple files
  const getNumberedParams = (): {
    filename: string;
    title: string;
    description?: string;
    start?: string;
  }[] => {
    const files = [];

    // Get the first file (no number)
    const filename = params["filename"];
    const title = params["title"];
    if (filename && title) {
      files.push({
        filename,
        title,
        description: params["description"],
        start: params["start"],
      });
    }

    // Check for additional files (filename2, filename3, etc.)
    // Use a for loop with a reasonable upper limit instead of while(true)
    for (let i = 2; i <= 10; i++) {
      const filenameN = params[`filename${i}`];
      const titleN = params[`title${i}`];

      if (filenameN && titleN) {
        files.push({
          filename: filenameN,
          title: titleN,
          description: params[`description${i}`],
          start: params[`start${i}`],
        });
      } else {
        // No more files found, exit the loop
        break;
      }
    }

    return files;
  };

  const files = getNumberedParams();
  if (files.length === 0) return null;

  const header = params["header"];
  const type = params["type"] || "sound";
  const plain = params["plain"] === "yes";
  const embed = params["embed"] === "yes";

  // Determine icon based on type
  let icon = "🔊"; // default sound icon
  if (type === "music") icon = "🎵";
  if (type === "speech") icon = "🎤";

  // Custom image can override default icon
  const customImage = params["image"];
  const showIcon = customImage !== "none";

  // Plain style removes borders and backgrounds
  let styleClass = `border border-neutral-800 rounded ${colourStyles.audio.container} p-3 mb-4`;
  if (plain) styleClass = "";
  if (embed) styleClass = "p-1";

  return (
    <div className={`${styleClass} max-w-xs text-gray-200`}>
      {header && <div className="font-bold mb-2">{header}</div>}

      {files.map((file, index) => (
        <div
          key={index}
          className={index > 0 ? "mt-4 pt-3 border-t border-neutral-600" : ""}
        >
          <div className="flex items-start mb-2">
            {showIcon && !plain && !embed && (
              <div className="mr-2 text-xl">{icon}</div>
            )}
            <div>
              <div className="font-medium text-gray-100">{file.title}</div>
              {file.description && (
                <div className="text-sm text-gray-300">
                  <Wikitext wikitext={file.description} />
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-neutral-600 pt-2">
            <AudioPlayer
              filename={file.filename}
              title={file.title}
              startTime={file.start}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
