// backend/scripts/load-articles.js
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const Parser = require("rss-parser");
const { JSDOM } = require("jsdom");

// Configuration
const config = {
  ragServerUrl: "http://localhost:3000",
  articlesDir: path.join(__dirname, "../data/articles"),
  rssFeeds: [
    "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml",
    "https://feeds.bbci.co.uk/news/technology/rss.xml",
    "https://www.wired.com/feed/rss",
  ],
  maxArticlesPerSource: 20, // Limit articles per source
  totalArticles: 50, // Total articles to collect
};

// Create articles directory if it doesn't exist
if (!fs.existsSync(config.articlesDir)) {
  fs.mkdirSync(config.articlesDir, { recursive: true });
}

// HTML content extractor
function extractContent(html) {
  const dom = new JSDOM(html);
  const document = dom.window.document;

  // Remove script and style elements
  const scripts = document.querySelectorAll(
    "script, style, nav, header, footer, aside"
  );
  scripts.forEach((script) => script.remove());

  // Get the article content
  const article = document.querySelector("article") || document.body;

  // Extract text content and clean it up
  let content = article.textContent
    .replace(/\s+/g, " ")
    .replace(/\n+/g, "\n")
    .trim();

  return content;
}

// Parse RSS feed
async function parseRssFeed(feedUrl) {
  try {
    const parser = new Parser();
    const feed = await parser.parseURL(feedUrl);

    console.log(`Parsed feed: ${feed.title} (${feed.items.length} items)`);
    return feed.items.map((item) => ({
      title: item.title,
      link: item.link,
      pubDate: item.pubDate,
      source: feed.title,
      guid: item.guid || item.id || item.link,
    }));
  } catch (error) {
    console.error(`Error parsing RSS feed ${feedUrl}:`, error.message);
    return [];
  }
}

// Fetch article content
async function fetchArticleContent(article) {
  try {
    console.log(`Fetching article: ${article.title}`);
    const response = await axios.get(article.link, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });

    // Extract content from HTML
    const content = extractContent(response.data);

    return {
      ...article,
      content,
      id: article.guid,
    };
  } catch (error) {
    console.error(`Error fetching article ${article.title}:`, error.message);
    return null;
  }
}

// Save article to file
function saveArticleToFile(article) {
  const filename = path.join(
    config.articlesDir,
    `${article.source.replace(/[^a-zA-Z0-9]/g, "_")}_${article.guid.replace(
      /[^a-zA-Z0-9]/g,
      "_"
    )}.json`
  );

  fs.writeFileSync(filename, JSON.stringify(article, null, 2));
  return filename;
}

// Ingest articles to RAG system
async function ingestArticlesToRag(articles) {
  try {
    console.log(`Ingesting ${articles.length} articles to RAG system...`);
    const response = await axios.post(`${config.ragServerUrl}/ingest`, {
      articles,
    });
    console.log("Ingestion successful:", response.data);
    return response.data;
  } catch (error) {
    console.error(
      "Error ingesting articles to RAG system:",
      error.response?.data || error.message
    );
    throw error;
  }
}

// Load articles from saved files
function loadSavedArticles() {
  if (!fs.existsSync(config.articlesDir)) {
    console.log("No saved articles found");
    return [];
  }

  const files = fs
    .readdirSync(config.articlesDir)
    .filter((file) => file.endsWith(".json"));

  console.log(`Found ${files.length} saved articles`);

  return files.map((file) => {
    const content = fs.readFileSync(
      path.join(config.articlesDir, file),
      "utf8"
    );
    return JSON.parse(content);
  });
}

// Main function to collect and ingest articles
async function collectAndIngestArticles() {
  try {
    // Check if we already have saved articles
    const savedArticles = loadSavedArticles();

    if (savedArticles.length >= config.totalArticles) {
      console.log(`Using ${config.totalArticles} saved articles for ingestion`);
      await ingestArticlesToRag(savedArticles.slice(0, config.totalArticles));
      return;
    }

    // Collect articles from RSS feeds
    let allArticles = [...savedArticles];

    for (const feedUrl of config.rssFeeds) {
      if (allArticles.length >= config.totalArticles) break;

      const feedItems = await parseRssFeed(feedUrl);
      const limitedItems = feedItems.slice(0, config.maxArticlesPerSource);

      for (const item of limitedItems) {
        if (allArticles.length >= config.totalArticles) break;

        // Check if article already exists
        const exists = allArticles.some(
          (article) => article.guid === item.guid
        );
        if (!exists) {
          const article = await fetchArticleContent(item);
          if (article) {
            saveArticleToFile(article);
            allArticles.push(article);

            // Add a small delay to avoid overwhelming the server
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }
      }
    }

    // Ingest articles to RAG system
    if (allArticles.length > 0) {
      await ingestArticlesToRag(allArticles.slice(0, config.totalArticles));
    } else {
      console.log("No articles found to ingest");
    }
  } catch (error) {
    console.error("Error collecting and ingesting articles:", error.message);
  }
}

// Run the main function
collectAndIngestArticles()
  .then(() => {
    console.log("Article collection and ingestion complete");
  })
  .catch(console.error);
