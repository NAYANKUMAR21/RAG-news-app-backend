// backend/src/services/ragService.js
const { embeddingService } = require("../app");
const ChunkerService = require("./chunkerService");

/**
 * Service for handling RAG (Retrieval Augmented Generation) functionality
 */
class RAGService {
  constructor(embeddingService, vectorStore) {
    this.embeddingService = embeddingService;
    this.vectorStore = vectorStore;
    this.chunkerService = new ChunkerService({
      maxChunkSize: 6000, // characters, which should be ~1500 tokens
      overlap: 200,
    });
  }

  /**
   * Ingest articles into the vector store
   * @param {Array<Object>} articles - Array of article objects
   * @returns {Promise<Object>} - Result of the ingestion
   */
  async ingestArticles({ articles }) {
    console.log(
      `Processing ${articles.length} articles for ingestion`,
      articles
    );

    try {
      // Process articles into chunks
      const chunks = this.chunkerService.processDocuments(articles);
      console.log(
        `Generated ${chunks.length} chunks from ${articles.length} articles`
      );

      // Extract texts for embedding
      const texts = chunks.map((chunk) => chunk.text);

      // Generate embeddings one by one instead of batch
      console.log("Generating embeddings...", texts[0]);
      // return;
      // const embed = await embeddingService.embedBatch();
      const embeddings = await Promise.all(
        texts.map((text) =>
          embeddingService.embedBatch([
            "quia et suscipit\n" +
              "suscipit recusandae consequuntur expedita et cum\n" +
              "reprehenderit molestiae ut ut quas totam\n" +
              "nostrum rerum est autem sunt rem eveniet architecto\n" +
              "\n" +
              "In conclusion, while sunt aut facere repellat provident occaecati excepturi optio reprehenderit presents significant opportunities, it also raises important questions that will need to be addressed as development continues. The conversation around this topic is likely to evolve as we gain more experience and data.\n" +
              "\n" +
              "From a policy perspective, there are important considerations regarding regulation, standardization, and oversight. Finding the right balance between enabling innovation and ensuring safety and fairness presents an ongoing challenge.\n" +
              "\n" +
              "The economic implications cannot be overlooked. Initial investment costs must be weighed against long-term benefits, and the distribution of these costs and benefits across different stakeholders requires careful analysis.\n" +
              "\n" +
              "Industry leaders have expressed varying opinions on this matter. Some see it as a revolutionary change that will transform established practices, while others view it as an incremental improvement on existing systems.\n" +
              "\n" +
              "Looking ahead, we can anticipate several possible trajectories for how this might evolve. Optimistic scenarios suggest rapid adoption and integration, while more conservative outlooks predict a slower, more measured approach.\n" +
              "\n" +
              "User experience is another critical dimension to consider. How will this affect the average person? Will it simplify processes or add additional complexity? These questions remain central to the discussion.\n" +
              "\n" +
              "The technical aspects of this topic warrant careful consideration. While the fundamental principles are relatively straightforward, the implementation details can become quite complex, especially when scaling to real-world scenarios.\n" +
              "\n" +
              "When examining sunt aut facere repellat provident occaecati excepturi optio reprehenderit, it's important to consider the historical context. Previous developments in this area have shown mixed results, with some initial excitement followed by periods of reassessment and critical evaluation.",
          ])
        )
      );
      console.log(`Generated ${embeddings.length} embeddings`);

      // Store documents with embeddings
      const results = await this.vectorStore.addDocuments(
        chunks.map((chunk, index) => ({
          text: chunk.text,
          embedding: embeddings[index],
          metadata: chunk.metadata,
        }))
      );

      return {
        success: true,
        message: `Successfully ingested ${chunks.length} chunks from ${articles.length} articles`,
        results,
      };
    } catch (error) {
      console.error("Error ingesting articles:", error);
      throw new Error(`Failed to ingest articles: ${error.message}`);
    }
  }

  /**
   * Query the RAG system
   * @param {string} query - The query text
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Relevant documents
   */
  async query(query, options = {}) {
    try {
      const { topK = 5, threshold = 0.7 } = options;

      // Generate embedding for the query
      const queryEmbedding = await this.embeddingService.embedText(query);

      // Search for similar documents
      const results = await this.vectorStore.similaritySearch(
        queryEmbedding,
        topK,
        threshold
      );

      return results;
    } catch (error) {
      console.error("Error querying RAG system:", error);
      throw new Error(`Failed to query RAG system: ${error.message}`);
    }
  }
}

module.exports = RAGService;
