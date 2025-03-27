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
  return (
    <span
      className={className}
      title={`Listen to pronunciation (${audioFile})`}
      onClick={() => {
        const audio = new Audio(wikimediaCommmonsAssetUrl(audioFile));
        audio.play();
      }}
    >
      {symbol}
    </span>
  );
}
