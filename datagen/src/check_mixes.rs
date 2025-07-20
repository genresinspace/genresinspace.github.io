//! Check the status of all videos in the mixes.
use std::{
    collections::{HashMap, HashSet},
    path::Path,
};

use serde::{Deserialize, Serialize};

use crate::types::{GenreMix, GenreMixes};

/// Check the status of all videos in the mixes.
pub fn run(mixes_path: &Path, key: &str) -> anyhow::Result<()> {
    let videos_to_ignore = HashSet::<&str>::from_iter([
        "dQw4w9WgXcQ", // We use rickroll for the Nazi genres, so we don't really care about checking this
    ]);

    let mut genre_mixes = HashMap::new();
    for mix in std::fs::read_dir(mixes_path)? {
        let mix_path = mix?.path();
        let mixes = GenreMixes::parse(&std::fs::read_to_string(&mix_path)?);
        genre_mixes.insert(
            mix_path.file_stem().unwrap().to_str().unwrap().to_string(),
            mixes,
        );
    }

    let mut videos = vec![];
    let mut video_to_genre = HashMap::new();
    for (genre, mixes) in &genre_mixes {
        let GenreMixes::Mixes(items) = &mixes else {
            continue;
        };
        for mix in items {
            match mix {
                GenreMix::Playlist {
                    playlist: _,
                    note: _,
                } => {}
                GenreMix::Video { video, note: _ } => {
                    if videos_to_ignore.contains(video.as_str()) {
                        continue;
                    }
                    if let Some(existing_genre) = video_to_genre.insert(video.as_str(), genre) {
                        anyhow::bail!(
                            "video {video} is in multiple genres: {existing_genre} and {genre}"
                        );
                    }

                    videos.push((genre, video));
                }
            }
        }
    }

    let mut missing = vec![];
    let mut not_embeddable = vec![];
    let mut not_public = vec![];

    for slice in videos.chunks(50) {
        let yt_videos = list_videos(key, slice.iter().map(|(_, video)| video.as_str()))?;
        let yt_ids = yt_videos
            .iter()
            .map(|v| v.id.as_str())
            .collect::<HashSet<_>>();

        for (genre, video_id) in slice {
            if !yt_ids.contains(video_id.as_str()) {
                missing.push((genre.as_str(), video_id.to_string()));
            }
        }

        for yt_video in yt_videos {
            let genre = video_to_genre.get(yt_video.id.as_str()).unwrap();
            if !yt_video.status.embeddable {
                not_embeddable.push((genre.as_str(), yt_video.id.clone()));
            }
            if yt_video.status.privacy_status != VideoPrivacyStatus::Public {
                not_public.push((genre.as_str(), yt_video.id.clone()));
            }
        }
    }

    println!("=== VIDEOS: MISSING ===");
    for (genre, video_id) in missing {
        println!("- {genre}: {video_id}");
    }
    println!();

    println!("=== VIDEOS: NOT EMBEDDABLE ===");
    for (genre, video_id) in not_embeddable {
        println!("- {genre}: {video_id}");
    }

    println!();
    println!("=== VIDEOS: NOT PUBLIC ===");
    for (genre, video_id) in not_public {
        println!("- {genre}: {video_id}");
    }

    Ok(())
}

// https://www.youtube.com/playlist?list=PL037F8CE61D670129: unavailable (no info)

#[derive(Debug, Serialize, Deserialize)]
struct Video {
    id: String,
    status: VideoStatus,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct VideoStatus {
    privacy_status: VideoPrivacyStatus,
    embeddable: bool,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
enum VideoPrivacyStatus {
    Private,
    Public,
    Unlisted,
}

fn list_videos<'a>(
    key: &str,
    ids: impl IntoIterator<Item = &'a str>,
) -> anyhow::Result<Vec<Video>> {
    let ids = ids.into_iter().collect::<Vec<_>>();
    assert!(ids.len() <= 50);
    let ids = ids.join(",");

    #[derive(Debug, Deserialize)]
    struct ListVideosResponse {
        items: Vec<Video>,
    }
    let response = reqwest::blocking::get(format!(
        "https://www.googleapis.com/youtube/v3/videos?part=status,id&id={ids}&key={key}&maxResults=50"
    ))?.json::<ListVideosResponse>()?;

    Ok(response.items)
}
