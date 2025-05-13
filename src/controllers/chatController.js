// backend/src/controllers/chatController.js
const { v4: uuidv4 } = require("uuid");

/**
 * Controller for chat-related operations
 */
class ChatController {
  /**
   * Initialize with required services
   * @param {Object} services - Required services
   */
  constructor(services) {
    this.embeddingService = services.embeddingService;
    this.vectorStoreService = services.vectorStoreService;
    this.llmService = services.llmService;
    this.cacheService = services.cacheService;
    this.persistenceService = services.persistenceService; // Optional SQL persistence
  }

  /**
   * Create a new chat session
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async createSession(req, res) {
    try {
      // Generate a unique session ID
      const sessionId = uuidv4();

      // Create empty session in Redis
      await this.cacheService.storeChatSession(sessionId, []);

      return res.status(201).json({
        success: true,
        sessionId,
        message: "Chat session created",
      });
    } catch (error) {
      console.error("Failed to create chat session:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to create chat session",
      });
    }
  }

  /**
   * Get chat session history
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getSessionHistory(req, res) {
    try {
      const { sessionId } = req.params;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          message: "Session ID is required",
        });
      }

      // Get chat history from Redis
      const history = await this.cacheService.getChatSession(sessionId);

      if (!history) {
        return res.status(404).json({
          success: false,
          message: "Chat session not found",
        });
      }

      return res.status(200).json({
        success: true,
        sessionId,
        history,
      });
    } catch (error) {
      console.error("Failed to get chat session history:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to get chat session history",
      });
    }
  }

  /**
   * Send a message and get response
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async sendMessage(req, res) {
    try {
      const { sessionId } = req.params;
      const { message } = req.body;

      if (!sessionId || !message) {
        return res.status(400).json({
          success: false,
          message: "Session ID and message are required",
        });
      }

      // Get chat history
      const history = (await this.cacheService.getChatSession(sessionId)) || [];

      // Add user message to history
      const userMessage = {
        role: "user",
        content: message,
        timestamp: new Date().toISOString(),
      };

      history.push(userMessage);

      // Check if we have a cached response for this query
      const cachedResult = await this.cacheService.getCachedQueryResult(
        message
      );

      if (cachedResult) {
        console.log("Using cached response");

        // Add bot message to history
        const botMessage = {
          role: "assistant",
          content: cachedResult.response,
          sources: cachedResult.sources,
          timestamp: new Date().toISOString(),
        };

        history.push(botMessage);

        // Update session with both messages
        await this.cacheService.storeChatSession(sessionId, history);

        return res.status(200).json({
          success: true,
          response: botMessage,
          cached: true,
        });
      }

      // Generate embedding for the user query
      const queryEmbedding = await this.embeddingService.embedText(message);

      // Get relevant documents
      const relevantDocs = await this.vectorStoreService.similaritySearch(
        queryEmbedding,
        5
      );

      // Generate response using LLM
      const response = await this.llmService.generateResponse(
        message,
        relevantDocs,
        history
      );

      // Create bot message
      const botMessage = {
        role: "assistant",
        content: response,
        sources: relevantDocs.map((doc) => ({
          title: doc.metadata.title,
          source: doc.metadata.source,
          url: doc.metadata.url,
        })),
        timestamp: new Date().toISOString(),
      };

      // Add bot message to history
      history.push(botMessage);

      // Update session with both messages
      await this.cacheService.storeChatSession(sessionId, history);

      // Cache the query result
      await this.cacheService.cacheQueryResult(message, {
        response,
        sources: botMessage.sources,
      });

      // Optional: Persist chat in SQL
      if (this.persistenceService) {
        this.persistenceService.saveChatMessage(sessionId, userMessage);
        this.persistenceService.saveChatMessage(sessionId, botMessage);
      }

      return res.status(200).json({
        success: true,
        response: botMessage,
      });
    } catch (error) {
      console.error("Failed to process chat message:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to process your message",
      });
    }
  }

  /**
   * Stream response for a message (for real-time typing effect)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async streamMessage(req, res) {
    try {
      const { sessionId } = req.params;
      const { message } = req.body;

      if (!sessionId || !message) {
        return res.status(400).json({
          success: false,
          message: "Session ID and message are required",
        });
      }

      // Set appropriate headers for SSE
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      // Get chat history
      const history = (await this.cacheService.getChatSession(sessionId)) || [];

      // Add user message to history
      const userMessage = {
        role: "user",
        content: message,
        timestamp: new Date().toISOString(),
      };

      history.push(userMessage);

      // Update session with user message
      await this.cacheService.storeChatSession(sessionId, history);

      // Generate embedding for the user query
      const queryEmbedding = await this.embeddingService.embedText(message);

      // Get relevant documents
      const relevantDocs = await this.vectorStoreService.similaritySearch(
        queryEmbedding,
        5
      );

      // Start the stream
      res.write("data: " + JSON.stringify({ type: "start" }) + "\n\n");

      // Stream sources info
      res.write(
        "data: " +
          JSON.stringify({
            type: "sources",
            sources: relevantDocs.map((doc) => ({
              title: doc.metadata.title,
              source: doc.metadata.source,
              url: doc.metadata.url,
            })),
          }) +
          "\n\n"
      );

      // Create a stream for the response
      let fullResponse = "";

      // Generate streaming response
      for await (const chunk of this.llmService.generateStreamingResponse(
        message,
        relevantDocs,
        history
      )) {
        res.write(
          "data: " + JSON.stringify({ type: "chunk", content: chunk }) + "\n\n"
        );
        fullResponse += chunk;
      }

      // Create bot message with full response
      const botMessage = {
        role: "assistant",
        content: fullResponse,
        sources: relevantDocs.map((doc) => ({
          title: doc.metadata.title,
          source: doc.metadata.source,
          url: doc.metadata.url,
        })),
        timestamp: new Date().toISOString(),
      };

      // Add bot message to history
      history.push(botMessage);

      // Update session with both messages
      await this.cacheService.storeChatSession(sessionId, history);

      // Cache the query result
      await this.cacheService.cacheQueryResult(message, {
        response: fullResponse,
        sources: botMessage.sources,
      });

      // Optional: Persist chat in SQL
      if (this.persistenceService) {
        this.persistenceService.saveChatMessage(sessionId, userMessage);
        this.persistenceService.saveChatMessage(sessionId, botMessage);
      }

      // End the stream
      res.write("data: " + JSON.stringify({ type: "end" }) + "\n\n");
      res.end();
    } catch (error) {
      console.error("Failed to stream chat message:", error);
      res.write(
        "data: " +
          JSON.stringify({
            type: "error",
            message: "An error occurred while processing your message",
          }) +
          "\n\n"
      );
      res.end();
    }
  }

  /**
   * Clear chat session
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async clearSession(req, res) {
    try {
      const { sessionId } = req.params;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          message: "Session ID is required",
        });
      }

      // Delete session from Redis
      await this.cacheService.deleteChatSession(sessionId);

      // Create empty session
      await this.cacheService.storeChatSession(sessionId, []);

      return res.status(200).json({
        success: true,
        message: "Chat session cleared",
      });
    } catch (error) {
      console.error("Failed to clear chat session:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to clear chat session",
      });
    }
  }
}

module.exports = ChatController;
