// backend/scripts/fetch-mock-articles.js
const fs = require("fs");
const path = require("path");
const axios = require("axios");

// Configuration
const config = {
  ragServerUrl: "http://localhost:3000",
  articlesDir: path.join(__dirname, "../data/articles"),
  mockApiUrl: "https://jsonplaceholder.typicode.com",
  totalArticles: 1, //TODO: make sure to change the number back to 50
};

// Create articles directory if it doesn't exist
if (!fs.existsSync(config.articlesDir)) {
  fs.mkdirSync(config.articlesDir, { recursive: true });
}

// Generate additional content to make articles longer
function generateAdditionalContent(title, userId) {
  const paragraphs = [
    `This is an in-depth analysis about ${title}. As we explore this topic, we'll look at various perspectives and considerations.`,
    `Many experts in the field have discussed the implications of this subject. Some believe that it represents a significant advancement in our understanding, while others remain skeptical about its long-term impact.`,
    `When examining ${title}, it's important to consider the historical context. Previous developments in this area have shown mixed results, with some initial excitement followed by periods of reassessment and critical evaluation.`,
    `The technical aspects of this topic warrant careful consideration. While the fundamental principles are relatively straightforward, the implementation details can become quite complex, especially when scaling to real-world scenarios.`,
    `User experience is another critical dimension to consider. How will this affect the average person? Will it simplify processes or add additional complexity? These questions remain central to the discussion.`,
    `Looking ahead, we can anticipate several possible trajectories for how this might evolve. Optimistic scenarios suggest rapid adoption and integration, while more conservative outlooks predict a slower, more measured approach.`,
    `Industry leaders have expressed varying opinions on this matter. Some see it as a revolutionary change that will transform established practices, while others view it as an incremental improvement on existing systems.`,
    `The economic implications cannot be overlooked. Initial investment costs must be weighed against long-term benefits, and the distribution of these costs and benefits across different stakeholders requires careful analysis.`,
    `From a policy perspective, there are important considerations regarding regulation, standardization, and oversight. Finding the right balance between enabling innovation and ensuring safety and fairness presents an ongoing challenge.`,
    `In conclusion, while ${title} presents significant opportunities, it also raises important questions that will need to be addressed as development continues. The conversation around this topic is likely to evolve as we gain more experience and data.`,
  ];

  // Use userId to create some variation in the paragraphs
  const shuffledParagraphs = [...paragraphs]
    .sort(() => (userId % 3 === 0 ? 1 : -1))
    .slice(0, 7 + (userId % 4));

  return shuffledParagraphs.join("\n\n");
}

// Add timeout configuration
const axiosInstance = axios.create({
  timeout: 30000, // 30 seconds timeout
  maxContentLength: 50 * 1024 * 1024, // 50MB max content length
});

// Fetch posts and create mock articles
async function fetchMockArticles() {
  try {
    console.log("Fetching mock articles from JSONPlaceholder API...");

    // Get posts
    const postsResponse = await axios.get(`${config.mockApiUrl}/posts`);
    const posts = postsResponse.data;

    // Get users for additional metadata
    const usersResponse = await axios.get(`${config.mockApiUrl}/users`);
    const users = usersResponse.data;

    // Process posts into articles
    const articles = posts.slice(0, config.totalArticles).map((post) => {
      const user = users.find((u) => u.id === post.userId);

      return {
        id: `mock-article-${post.id}`,
        title: post.title,
        content: `${post.body}\n\n${generateAdditionalContent(
          post.title,
          post.userId
        )}`,
        source: `Mock Publisher ${post.userId}`,
        author: user ? user.name : "Anonymous",
        pubDate: new Date().toISOString(),
        guid: `mock-${post.id}`,
        metadata: {
          category:
            post.userId % 3 === 0
              ? "Technology"
              : post.userId % 3 === 1
              ? "Business"
              : "Science",
          wordCount: post.body.split(" ").length + 500,
        },
      };
    });

    console.log(`Generated ${articles.length} mock articles`);

    // Save articles to files
    articles.forEach((article) => {
      const filename = path.join(
        config.articlesDir,
        `mock_article_${article.id}.json`
      );

      fs.writeFileSync(filename, JSON.stringify(article, null, 2));
      console.log(`Saved article to ${filename}`);
    });

    // Ingest articles to RAG system
    console.log(`Ingesting ${articles.length} articles to RAG system...`);
    try {
      const response = await axiosInstance.post(
        `${config.ragServerUrl}/api/admin/ingest`,
        {
          articles,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      console.log("Ingestion response:", response.data);
    } catch (error) {
      if (error.code === "ECONNREFUSED") {
        console.error(
          "Could not connect to RAG server. Is it running at",
          config.ragServerUrl
        );
      } else if (error.code === "ETIMEDOUT") {
        console.error("Request timed out while ingesting articles");
      } else {
        console.error(
          "Error ingesting articles to RAG system:",
          error.response?.data || error.message
        );
      }
      console.log(
        "Please ensure your RAG server is running at",
        config.ragServerUrl
      );
    }

    return articles;
  } catch (error) {
    console.error("Error fetching mock articles:", error.message);
    return [];
  }
}

// Main function
async function main() {
  try {
    const articles = await fetchMockArticles();
    console.log(`Successfully processed ${articles.length} mock articles`);
  } catch (error) {
    console.error("Error in main function:", error.message);
  }
}

// Run the script
main().catch(console.error);
