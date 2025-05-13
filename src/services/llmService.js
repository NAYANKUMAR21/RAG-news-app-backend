// backend/src/services/llmService.js
const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * Service for interacting with the Gemini API
 */
class GeminiService {
  /**
   * Initialize Gemini client
   * @param {Object} config - Configuration for Gemini API
   */
  constructor(config) {
    this.apiKey = config.apiKey;
    this.modelName = config.modelName || "gemini-pro";
    this.genAI = new GoogleGenerativeAI(this.apiKey);
    this.model = this.genAI.getGenerativeModel({ model: this.modelName });
  }

  /**
   * Generate a response based on retrieved content and user query
   * @param {string} query - User's question
   * @param {Array} retrievedDocs - Retrieved documents from vector store
   * @param {Array} chatHistory - Previous conversation history
   * @returns {Promise<string>} - Generated response
   */
  async generateResponse(query, retrievedDocs, chatHistory = []) {
    try {
      // Format retrieved documents as context
      const context = retrievedDocs
        .map(
          (doc) => `Source: ${doc.metadata.title} (${doc.metadata.source})
Content: ${doc.text}`
        )
        .join("\n\n");

      // Format chat history
      const formattedHistory = chatHistory.map((msg) => ({
        role: msg.role,
        parts: [{ text: msg.content }],
      }));

      // Create a chat session
      const chat = this.model.startChat({
        history: formattedHistory,
        generationConfig: {
          temperature: 0.4,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 1024,
        },
      });

      // Create the prompt with context and query
      const prompt = `
You are a helpful assistant that answers questions based on provided context.
Please only use the information from the provided news articles to answer the question. 
If the information is not in the context, say that you don't know based on the available articles.

CONTEXT:
${context}

QUESTION:
${query}

Please provide a concise, accurate answer based solely on the context. Include sources where appropriate.`;

      // Generate the response
      const result = await chat.sendMessage(prompt);
      const response = result.response.text();

      return response;
    } catch (error) {
      console.error("Failed to generate response from Gemini:", error);
      throw new Error(`Gemini API error: ${error.message}`);
    }
  }

  /**
   * Generate a streaming response (for real-time chat UI)
   * @param {string} query - User's question
   * @param {Array} retrievedDocs - Retrieved documents from vector store
   * @param {Array} chatHistory - Previous conversation history
   * @returns {AsyncGenerator} - Stream of response chunks
   */
  async *generateStreamingResponse(query, retrievedDocs, chatHistory = []) {
    try {
      // Format retrieved documents as context
      const context = retrievedDocs
        .map(
          (doc) => `Source: ${doc.metadata.title} (${doc.metadata.source})
Content: ${doc.text}`
        )
        .join("\n\n");

      // Format chat history
      const formattedHistory = chatHistory.map((msg) => ({
        role: msg.role,
        parts: [{ text: msg.content }],
      }));

      // Create a chat session
      const chat = this.model.startChat({
        history: formattedHistory,
        generationConfig: {
          temperature: 0.4,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 1024,
        },
      });

      // Create the prompt with context and query
      const prompt = `
You are a helpful assistant that answers questions based on provided context.
Please only use the information from the provided news articles to answer the question. 
If the information is not in the context, say that you don't know based on the available articles.

CONTEXT:
${context}

QUESTION:
${query}

Please provide a concise, accurate answer based solely on the context. Include sources where appropriate.`;

      // Generate the streaming response
      const result = await chat.sendMessageStream(prompt);

      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        if (chunkText) {
          yield chunkText;
        }
      }
    } catch (error) {
      console.error(
        "Failed to generate streaming response from Gemini:",
        error
      );
      throw new Error(`Gemini API streaming error: ${error.message}`);
    }
  }
}

module.exports = {
  GeminiService,
};
