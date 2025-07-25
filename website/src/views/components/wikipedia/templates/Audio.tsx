import { useState, useRef } from "react";
import { WikitextSimplifiedNode } from "frontend_wasm";
import { wikimediaCommmonsAssetUrl } from "../urls";
import { templateToObject } from "./util";
import { colourStyles } from "../../../colours";

/**
 * Renders the audio template.
 *
 * Creates an inline link to an audio file with a speaker icon.
 * This template is meant for pronunciations and similar inline audio references.
 *
 * Usage: {{Audio|filename.ogg|label}}
 * Example: {{Audio|en-us-Alabama.ogg|pronunciation}}
 */
export function Audio({
  node,
}: {
  node: Extract<WikitextSimplifiedNode, { type: "template" }>;
}) {
  const params = templateToObject(node);

  const filename = params["1"] || params["filename"];
  const label = params["2"] || params["label"] || "audio";

  if (!filename) {
    return null;
  }

  return <AudioLink filename={filename} label={label} />;
}

interface AudioLinkProps {
  filename: string;
  label: string;
}

function AudioLink({ filename, label }: AudioLinkProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

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

  const handleEnded = () => {
    setIsPlaying(false);
  };

  return (
    <span className="inline-flex items-center gap-1">
      <audio
        ref={audioRef}
        src={wikimediaCommmonsAssetUrl(filename)}
        preload="none"
        onEnded={handleEnded}
      />
      <span className="text-gray-300">({label}</span>
      <button
        onClick={togglePlayPause}
        className={`inline-flex items-center justify-center w-4 h-4 text-xs ${colourStyles.audio.button} rounded-full text-gray-200 cursor-pointer`}
        aria-label={isPlaying ? "Pause audio" : "Play audio"}
        title={isPlaying ? "Pause audio" : "Play audio"}
      >
        {isPlaying ? "⏸️" : "🔊"}
      </button>
      <span className="text-gray-300">)</span>
    </span>
  );
}
