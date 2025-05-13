// backend/src/rag/collector.js
const axios = require("axios");
const cheerio = require("cheerio");
const Parser = require("rss-parser");
const parser = new Parser();

/**
 * Collects news articles from RSS feeds
 * @param {Array} rssSources - List of RSS feed URLs
 * @returns {Array} - List of article objects
 */
async function collectFromRss(rssSources) {
  const articles = [];

  for (const source of rssSources) {
    try {
      const feed = await parser.parseURL(source);

      for (const item of feed.items) {
        articles.push({
          title: item.title,
          content: item.content || item.contentSnippet,
          link: item.link,
          pubDate: item.pubDate,
          source: feed.title || source,
        });
      }
    } catch (error) {
      console.error(`Error collecting from RSS ${source}:`, error);
    }
  }

  return articles;
}

/**
 * Scrapes article content from URLs
 * @param {Array} urls - List of article URLs to scrape
 * @returns {Array} - List of article objects
 */
async function scrapeArticles(urls) {
  const articles = [];

  for (const url of urls) {
    try {
      const response = await axios.get(url);
      const $ = cheerio.load(response.data);

      // This is a simplified scraper - you'll need to adapt it based on target sites
      const title = $("h1").first().text();
      const content =
        $("article").text() || $("main").text() || $("body").text();

      articles.push({
        title,
        content,
        link: url,
        pubDate: new Date().toISOString(),
        source: new URL(url).hostname,
      });
    } catch (error) {
      console.error(`Error scraping ${url}:`, error);
    }
  }

  return articles;
}

/**
 * Main function to collect articles from different sources
 */
async function collectArticles(config) {
  const { rssSources = [], articleUrls = [] } = config;

  const rssArticles = await collectFromRss(rssSources);
  const scrapedArticles = await scrapeArticles(articleUrls);

  return [...rssArticles, ...scrapedArticles];
}

module.exports = {
  collectArticles,
  collectFromRss,
  scrapeArticles,
};
