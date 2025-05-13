// backend/src/services/vectorStoreService.js
const { QdrantClient } = require("@qdrant/js-client-rest");

/**
 * Service for managing vector database operations with Qdrant
 */
class QdrantVectorStore {
  /**
   * Initialize Qdrant client
   * @param {Object} config - Configuration for Qdrant
   */
  constructor(config) {
    this.client = new QdrantClient({
      url: config.url || "http://localhost:6333",
      apiKey: config.apiKey,
    });

    this.collectionName = config.collectionName || "news_articles";
    this.dimension = config.dimension || 768; // For Jina embeddings
  }

  /**
   * Initialize the vector collection
   */
  async initialize() {
    try {
      // Check if collection exists
      const collections = await this.client.getCollections();
      const exists = collections.collections.some(
        (c) => c.name === this.collectionName
      );

      if (!exists) {
        // Create the collection if it doesn't exist
        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: this.dimension,
            distance: "Cosine",
          },
          optimizers_config: {
            default_segment_number: 2,
          },
          on_disk_payload: true,
        });

        console.log(`Created collection: ${this.collectionName}`);
      } else {
        console.log(`Collection ${this.collectionName} already exists`);
      }
    } catch (error) {
      console.error("Failed to initialize vector store:", error);
      throw new Error(`Qdrant initialization failed: ${error.message}`);
    }
  }

  /**
   * Add documents with their embeddings to the vector store
   * @param {Array} documents - Array of document objects with text and metadata
   * @param {Array} embeddings - Array of embedding vectors
   */
  async addDocuments(documents, embeddings) {
    try {
      if (documents.length !== embeddings.length) {
        throw new Error("Documents and embeddings count mismatch");
      }

      const points = documents.map((doc, i) => ({
        id: `${Date.now()}-${i}`,
        vector: embeddings[i],
        payload: {
          text: doc.text,
          ...doc.metadata,
        },
      }));

      await this.client.upsert(this.collectionName, {
        points,
      });

      console.log(`Added ${points.length} documents to vector store`);
    } catch (error) {
      console.error("Failed to add documents to vector store:", error);
      throw new Error(`Qdrant document insertion failed: ${error.message}`);
    }
  }

  /**
   * Search for similar documents using vector similarity
   * @param {Array} queryEmbedding - Query embedding vector
   * @param {number} limit - Maximum number of results
   * @returns {Array} - Similar documents with scores
   */
  async similaritySearch(queryEmbedding, limit = 5) {
    try {
      const response = await this.client.search(this.collectionName, {
        vector: queryEmbedding,
        limit: limit,
        with_payload: true,
        with_vectors: false,
      });

      return response.map((hit) => ({
        text: hit.payload.text,
        metadata: {
          title: hit.payload.title,
          source: hit.payload.source,
          url: hit.payload.url,
          date: hit.payload.date,
        },
        score: hit.score,
      }));
    } catch (error) {
      console.error("Failed to perform similarity search:", error);
      throw new Error(`Qdrant search failed: ${error.message}`);
    }
  }

  /**
   * Delete all documents from the collection
   */
  async clearCollection() {
    try {
      await this.client.deleteCollection(this.collectionName);
      await this.initialize();
      console.log(`Cleared collection: ${this.collectionName}`);
    } catch (error) {
      console.error("Failed to clear collection:", error);
      throw new Error(`Qdrant collection clear failed: ${error.message}`);
    }
  }
}

module.exports = {
  QdrantVectorStore,
};
