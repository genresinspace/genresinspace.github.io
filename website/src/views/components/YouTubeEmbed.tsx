/** A YouTube embed for either a video or a playlist */
export function YouTubeEmbed({
  videoId,
  playlistId,
  className,
  autoplay = false,
}: {
  videoId?: string;
  playlistId?: string;
  className?: string;
  autoplay?: boolean;
} & (
  | { videoId: string; playlistId?: never }
  | { videoId?: never; playlistId: string }
)) {
  const embedUrl = playlistId
    ? `https://www.youtube.com/embed/videoseries?list=${playlistId}${autoplay ? "&autoplay=1" : ""}`
    : `https://www.youtube.com/embed/${videoId}${autoplay ? "?autoplay=1" : ""}`;

  return (
    <div
      className={`relative w-full ${className}`}
      style={{ paddingBottom: "56.25%" }}
    >
      <iframe
        className="absolute top-0 left-0 w-full h-full"
        src={embedUrl}
        title="YouTube video player"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}
