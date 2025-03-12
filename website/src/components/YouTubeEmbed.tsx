export function YouTubeVideoEmbed({
  videoId,
  className,
}: {
  videoId: string;
  className?: string;
}) {
  return (
    <YouTubeEmbed
      link={`https://www.youtube.com/watch?v=${videoId}`}
      className={className}
    />
  );
}

export function YouTubePlaylistEmbed({
  playlistId,
  className,
}: {
  playlistId: string;
  className?: string;
}) {
  return (
    <YouTubeEmbed
      link={`https://www.youtube.com/playlist?list=${playlistId}`}
      className={className}
    />
  );
}

export function YouTubeEmbed({
  link,
  className,
}: {
  link: string;
  className?: string;
}) {
  // Extract video ID or playlist ID from YouTube URL
  const videoId = link.split("v=")[1]?.split("&")[0];
  const playlistId = link.split("list=")[1]?.split("&")[0];

  if (!videoId && !playlistId) {
    return null;
  }

  const embedUrl = playlistId
    ? `https://www.youtube.com/embed/videoseries?list=${playlistId}`
    : `https://www.youtube.com/embed/${videoId}`;

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
