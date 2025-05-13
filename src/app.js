// backend/src/app.js
require("dotenv").config();
const Parser = require("rss-parser");

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const { v4: uuidv4 } = require("uuid");

// Import services
const {
  JinaEmbeddingService,
  LocalEmbeddingService,
} = require("./services/embeddingService");
const { QdrantVectorStore } = require("./services/vectorStoreService");
const { GeminiService } = require("./services/llmService");
const { RedisCacheService } = require("./services/cacheService");
const RAGService = require("./services/ragService");

// Import controllers and routes
const ChatController = require("./controllers/chatController");
const setupChatRoutes = require("./routes/chatRoutes");

// Import RAG components
const { collectArticles } = require("./rag/collector");
const { processArticles } = require("./rag/processor");

// App initialization
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(helmet());
app.use(compression());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", limiter);
const embeddingService = new JinaEmbeddingService({
  apiKey: process.env.JINA_API_KEY,
  modelName: process.env.EMBEDDING_MODEL || "jina-embeddings-v3",
});
// Initialize services
const initializeServices = async () => {
  try {
    // Initialize embedding service
    console.log(process.env.JINA_API_KEY, process.env.EMBEDDING_MODEL);

    // Initialize vector store
    const vectorStoreService = new QdrantVectorStore({
      url: process.env.QDRANT_URL || "http://localhost:6333",
      apiKey: process.env.QDRANT_API_KEY,
      collectionName: process.env.QDRANT_COLLECTION || "news_articles",
    });
    await vectorStoreService.initialize();

    // Initialize LLM service
    const llmService = new GeminiService({
      apiKey: process.env.GEMINI_API_KEY,
      modelName: process.env.GEMINI_MODEL || "gemini-pro",
    });

    // Initialize Redis cache
    const cacheService = new RedisCacheService({
      host: process.env.REDIS_HOST || "localhost",
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD,
      keyPrefix: process.env.REDIS_PREFIX || "news_rag:",
      defaultTTL: parseInt(process.env.REDIS_TTL) || 3600,
    });

    // Initialize RAG service
    console.log(
      "Initializing RAG service...",

      embeddingService.embedText
    );

    // console.log(embed);
    const ragService = new RAGService({
      collector: { collectArticles },
      processor: { processArticles },
      embeddingService,
      vectorStoreService,
    });

    // Initialize controllers
    const chatController = new ChatController({
      embeddingService,
      vectorStoreService,
      llmService,
      cacheService,
    });

    // Setup routes
    app.use("/api/chat", setupChatRoutes(chatController));

    // Health check route
    app.get("/api/health", (req, res) => {
      res.status(200).json({
        status: "ok",
        timestamp: new Date().toISOString(),
      });
    });

    /**
     eneral http://rss.cnn.com/rss/cnn_topstories.rss
US general http://www.cbsnews.com/latest/rss/main
     */
    // Admin route for data ingestion

    app.post("/api/admin/ingest", async (req, res) => {
      try {
        // This would typically be protected by authentication
        console.log(process.env.JINA_API_KEY);
        // res.status(200).json("hi");

        const config = req.body;
        const result = await ragService.ingestArticles(config);
        res.status(200).json(result);
        return;
      } catch (error) {
        console.error("Ingestion error:", error);
        res.status(500).json({
          success: false,
          message: "Failed to ingest articles",
        });
      }
    });

    // Not found route
    app.use((req, res) => {
      res.status(404).json({
        success: false,
        message: "Route not found",
      });
    });

    // Error handling middleware
    app.use((err, req, res, next) => {
      console.error("Server error:", err);
      res.status(500).json({
        success: false,
        message: "Server error",
        error: process.env.NODE_ENV === "development" ? err.message : undefined,
      });
    });

    // Start the server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
    });

    // Return services for testing or other use
    return {
      embeddingService,
      vectorStoreService,
      llmService,
      cacheService,
      ragService,
    };
  } catch (error) {
    console.error("Failed to initialize services:", error);
    process.exit(1);
  }
};

// Start the application
if (process.env.NODE_ENV !== "test") {
  initializeServices();
}

module.exports = { app, initializeServices, embeddingService };
