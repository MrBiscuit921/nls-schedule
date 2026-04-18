const express = require("express");
const router = express.Router();
const axios = require("axios");

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const VLN_CHANNEL_ID = process.env.VLN_CHANNEL_ID;

// In-memory cache
let cache = {
  data: null,
  timestamp: null,
  lastError: null,
};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

router.get("/streams", async (req, res) => {
  const now = Date.now();

  // Check cache first
  if (cache.data && cache.timestamp && now - cache.timestamp < CACHE_TTL) {
    return res.json(cache.data);
  }

  try {
    // Fetch channel uploads playlist ID
    const channelRes = await axios.get(
      "https://www.googleapis.com/youtube/v3/channels",
      {
        params: {
          part: "contentDetails",
          id: VLN_CHANNEL_ID,
          key: YOUTUBE_API_KEY,
        },
      },
    );

    const uploadsPlaylistId =
      channelRes.data.items[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylistId) throw new Error("Could not find uploads playlist");

    // Fetch playlist items
    const playlistRes = await axios.get(
      "https://www.googleapis.com/youtube/v3/playlistItems",
      {
        params: {
          part: "snippet",
          playlistId: uploadsPlaylistId,
          maxResults: 50,
          key: YOUTUBE_API_KEY,
        },
      },
    );

    const videoIds = playlistRes.data.items
      .map((item) => item.snippet.resourceId.videoId)
      .join(",");
    if (!videoIds) throw new Error("No videos found");

    // Fetch video details
    const videosRes = await axios.get(
      "https://www.googleapis.com/youtube/v3/videos",
      {
        params: {
          part: "snippet,liveStreamingDetails",
          id: videoIds,
          key: YOUTUBE_API_KEY,
        },
      },
    );

    // Filter upcoming/live streams
    const streams = videosRes.data.items
      .filter(
        (video) =>
          video.snippet.liveBroadcastContent === "upcoming" ||
          video.snippet.liveBroadcastContent === "live",
      )
      .map((video) => ({
        id: video.id,
        title: video.snippet.title,
        scheduledStartTime: video.liveStreamingDetails?.scheduledStartTime,
        status: video.snippet.liveBroadcastContent,
        url: `https://www.youtube.com/watch?v=${video.id}`,
      }));

    // Filter out onboard streams
    const filteredStreams = streams.filter((stream) => {
      const title = stream.title.toLowerCase();
      return (
        !title.includes("onboard") &&
        !title.includes("on board") &&
        !title.includes("#")
      );
    });

    // Update cache
    cache.data = filteredStreams;
    cache.timestamp = now;
    cache.lastError = null;
    res.json(filteredStreams);
  } catch (error) {
    console.error("YouTube API error:", error.message);
    if (error.response) console.error("Response data:", error.response.data);

    // If cache exists, serve stale data
    if (cache.data) {
      return res.json(cache.data);
    }

    res.status(500).json({error: "Failed to fetch streams"});
  }
});

module.exports = router;
