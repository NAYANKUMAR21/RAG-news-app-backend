// backend/src/services/embeddingService.js
const axios = require("axios");

/**
 * Service for generating embeddings using Jina Embeddings API
 */
class JinaEmbeddingService {
  constructor(config) {
    this.apiKey = config.apiKey;
    this.apiUrl = config.apiUrl || "https://api.jina.ai/v1/embeddings";
    this.batchSize = config.batchSize || 20; // Reduced batch size for better handling
    this.modelName = config.modelName || "jina-embeddings-v3";
    this.dimension = config.dimension || 768;
    this.maxTokens = config.maxTokens || 1000; // Token limit for Jina API
    this.approximateCharsPerToken = 4; // Approximate characters per token
  }

  /**
   * Create embeddings for a single text
   * @param {string} text - Text to embed
   * @returns {Promise<Array>} - Embedding vector
   */
  async embedText(text) {
    try {
      // Truncate text if necessary to avoid token limit
      const truncatedText = this._truncateText(text);

      const response = await axios.post(
        this.apiUrl,
        {
          input: truncatedText,
          model: this.modelName,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      return response.data.data[0].embedding;
    } catch (error) {
      console.error(
        "Error generating embedding:",
        error.response?.data || error.message
      );
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  }

  /**
   * Create embeddings for multiple texts in batches
   * @param {Array} texts - Array of texts to embed
   * @returns {Promise<Array>} - Array of embedding vectors
   */
  async embedBatch(texts) {
    const embeddings = [];
    console.log(`Processing ${texts.length} texts for embeddings`);

    // First, truncate all texts to avoid token limit issues
    const truncatedTexts = texts.map((text) => this._truncateText(text));

    // Process in batches to avoid rate limits
    for (let i = 0; i < truncatedTexts.length; i += this.batchSize) {
      const batch = truncatedTexts.slice(i, i + this.batchSize);
      console.log(
        `Processing batch ${i / this.batchSize + 1} of ${Math.ceil(
          truncatedTexts.length / this.batchSize
        )}`
      );

      try {
        const response = await axios.post(
          this.apiUrl,
          {
            input: batch,
            model: this.modelName,
          },
          {
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
              "Content-Type": "application/json",
            },
          }
        );

        const batchEmbeddings = response.data.data.map(
          (item) => item.embedding
        );
        embeddings.push(...batchEmbeddings);

        // Add a small delay to avoid rate limiting
        if (i + this.batchSize < truncatedTexts.length) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      } catch (error) {
        console.error(
          `Error generating batch embeddings at index ${i}:`,
          error.response?.data || error.message
        );

        // If batch processing fails, fall back to processing texts individually
        if (batch.length > 1) {
          console.log(
            "Falling back to individual text processing for this batch"
          );
          for (const text of batch) {
            try {
              const embedding = await this.embedText(text);
              embeddings.push(embedding);
              // Add a small delay between individual requests
              await new Promise((resolve) => setTimeout(resolve, 100));
            } catch (individualError) {
              console.error(
                `Failed to process individual text: ${individualError.message}`
              );
              // Push an empty or zero embedding as a placeholder
              embeddings.push(new Array(this.dimension).fill(0));
            }
          }
        } else {
          throw new Error(
            `Failed to generate batch embeddings: ${error.message}`
          );
        }
      }
    }

    return embeddings;
  }

  /**
   * Truncate text to avoid exceeding token limit
   * @param {string} text - Text to truncate
   * @returns {string} - Truncated text
   */
  _truncateText(text) {
    // Simple truncation based on approximate character count
    // A more accurate solution would use a proper tokenizer
    const maxChars = this.maxTokens * this.approximateCharsPerToken;

    if (text.length > maxChars) {
      console.warn(
        `Text truncated from ${text.length} to ${maxChars} characters`
      );
      return text.substring(0, maxChars);
    }

    return text;
  }
}

/**
 * Alternative implementation using SentenceTransformers if Jina is not available
 */
class LocalEmbeddingService {
  constructor(config = {}) {
    this.dimension = config.dimension || 768;
  }

  async embedText(text) {
    // Placeholder - in a real implementation, you'd use a local model
    console.warn(
      "Using placeholder local embedding - implement with proper local embedding library"
    );
    return new Array(this.dimension).fill(0); // Return placeholder embedding
  }

  async embedBatch(texts) {
    console.warn(
      "Using placeholder local embeddings - implement with proper local embedding library"
    );
    return texts.map(() => new Array(this.dimension).fill(0)); // Return placeholder embeddings
  }
}

module.exports = {
  JinaEmbeddingService,
  LocalEmbeddingService,
};
