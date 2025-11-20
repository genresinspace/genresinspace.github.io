import { useRef, useEffect } from "react";
import { wikimediaCommmonsAssetUrl } from "../urls";

interface WikimediaAudioProps {
  audioFile: string;
  symbol?: React.ReactNode;
  className?: string;
}

/**
 * A component for playing Wikimedia Commons audio files
 */
export function WikimediaAudio({
  audioFile,
  symbol = "🔊",
  className = "cursor-pointer",
}: WikimediaAudioProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
    };
  }, []);

  const handleClick = () => {
    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    // Create new audio instance
    audioRef.current = new Audio(wikimediaCommmonsAssetUrl(audioFile));
    audioRef.current.play().catch((error) => {
      console.error("Failed to play audio:", error);
    });
  };

  return (
    <span
      className={className}
      title={`Listen to pronunciation (${audioFile})`}
      onClick={handleClick}
    >
      {symbol}
    </span>
  );
}
