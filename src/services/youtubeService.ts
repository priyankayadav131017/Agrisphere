import axios from "axios";
import { Video } from "../types/advisory";

const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;
const BASE_URL = "https://www.googleapis.com/youtube/v3/search";

// Array of farming related queries to rotate through for variety
const FARMING_QUERIES = [
    "Indian farming techniques organic kisan",
    "Smart agriculture India technology guide",
    "Successful organic farming stories India",
    "Modern dairy farming india tips",
    "Hydroponics farming at home India",
    "Vegetable farming profit India",
    "Tractor farming equipment India reviews",
    "Sustainable agriculture methods India"
];

// Returns tuple of [videos, nextPageToken]
export const fetchFarmingVideos = async (pageToken?: string): Promise<{ videos: Video[], nextPageToken?: string }> => {
    if (!YOUTUBE_API_KEY) {
        console.error("YouTube API Key is missing!");
        return { videos: [] };
    }

    try {
        // Pick a random query to ensure fresh content on reload
        const randomQuery = FARMING_QUERIES[Math.floor(Math.random() * FARMING_QUERIES.length)];

        const response = await axios.get(BASE_URL, {
            params: {
                part: "snippet",
                q: randomQuery,
                type: "video",
                maxResults: 6,
                regionCode: "IN",
                key: YOUTUBE_API_KEY,
                pageToken: pageToken
            },
        });

        const videos = response.data.items.map((item: any) => ({
            id: item.id.videoId,
            title: item.snippet.title,
            thumbnail: item.snippet.thumbnails.medium.url,
            channelTitle: item.snippet.channelTitle,
            publishedAt: item.snippet.publishedAt,
        }));

        return { videos, nextPageToken: response.data.nextPageToken };

    } catch (error: any) {
        console.error("Error fetching videos:", error);
        if (error.response) {
            console.error("YouTube API Error Details:", error.response.data);
            if (error.response.status === 403) {
                console.error("Access Forbidden. Likely Quota Exceeded or API Key restriction.");
            }
        }
        return { videos: [] };
    }
};
