import axios from "axios";
import { NewsArticle } from "../types/advisory";

const NEWS_API_KEY = import.meta.env.VITE_NEWS_API_KEY;
const BASE_URL = "https://newsapi.org/v2/everything";

export const fetchFarmingNews = async (language: "Hindi" | "English" = "English", page: number = 1): Promise<NewsArticle[]> => {
    if (!NEWS_API_KEY) {
        console.error("News API Key is missing!");
        return [];
    }

    // Strict queries to filter out noise
    const englishQuery = '(agriculture OR farming OR farmers OR "kisan scheme") AND India -"politics" -"election" -"cricket" -"advertising" -"movie" -"bollywood" -"nasa" -"space"';
    // Hindi keywords attempt - Note: NewsAPI support for Hindi content is variable
    const hindiQuery = '(कृषि OR किसान OR खेती OR "फसल बीमा") -"politics" -"election" -"cricket"';

    try {
        const response = await axios.get(BASE_URL, {
            params: {
                q: language === "Hindi" ? hindiQuery : englishQuery,
                sortBy: "publishedAt",
                // 'hi' is the code for Hindi, 'en' for English
                language: language === "Hindi" ? "hi" : "en",
                apiKey: NEWS_API_KEY,
                pageSize: 12, // Increased slightly to allow for post-filtering if needed
                page: page,
            },
        });

        if (response.data.status === "ok") {
            return response.data.articles.filter((article: any) =>
                article.title &&
                article.urlToImage &&
                article.description && // Ensure description exists
                article.description !== "No description available." && // Filter out placeholder descriptions
                // Extra safety filter for common unrelated terms that might slip through
                !article.title.toLowerCase().includes("advertising") &&
                !article.title.toLowerCase().includes("nasa") &&
                !article.title.toLowerCase().includes("gherkin") && // User requested removal
                !article.title.toLowerCase().includes("tariff") // Filter out trade/export specific news if requested
            ).map((article: any) => ({
                title: article.title,
                description: article.description || "No description available.",
                url: article.url,
                urlToImage: article.urlToImage,
                source: { name: article.source.name },
                publishedAt: article.publishedAt
            }));
        }
        return [];
    } catch (error) {
        console.error("Error fetching news:", error);
        return [];
    }
};
