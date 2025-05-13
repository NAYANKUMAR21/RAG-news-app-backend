// backend/src/services/cacheService.js
const Redis = require("ioredis");

/**
 * Service for handling Redis caching operations
 */
class RedisCacheService {
  /**
   * Initialize Redis client
   * @param {Object} config - Redis configuration
   */
  constructor(config = {}) {
    this.client = new Redis({
      host: config.host || "localhost",
      port: config.port || 6379,
      password: config.password,
      db: config.db || 0,
      keyPrefix: config.keyPrefix || "news_rag:",
    });

    this.defaultTTL = config.defaultTTL || 3600; // 1 hour default TTL

    // Handle connection events
    this.client.on("error", (err) => {
      console.error("Redis error:", err);
    });

    this.client.on("connect", () => {
      console.log("Connected to Redis");
    });
  }

  /**
   * Store chat session data
   * @param {string} sessionId - Unique session identifier
   * @param {Array} messages - Chat messages
   * @param {number} ttl - Time to live in seconds (optional)
   */
  async storeChatSession(sessionId, messages, ttl = this.defaultTTL) {
    try {
      const key = `session:${sessionId}`;
      await this.client.setex(key, ttl, JSON.stringify(messages));
    } catch (error) {
      console.error("Failed to store chat session:", error);
    }
  }

  /**
   * Retrieve chat session data
   * @param {string} sessionId - Unique session identifier
   * @returns {Array|null} - Chat messages or null if not found
   */
  async getChatSession(sessionId) {
    try {
      const key = `session:${sessionId}`;
      const data = await this.client.get(key);

      if (!data) {
        return null;
      }

      return JSON.parse(data);
    } catch (error) {
      console.error("Failed to retrieve chat session:", error);
      return null;
    }
  }

  /**
   * Add message to existing chat session
   * @param {string} sessionId - Unique session identifier
   * @param {Object} message - New chat message
   * @param {number} ttl - Time to live in seconds (optional)
   * @returns {boolean} - Success status
   */
  async addMessageToSession(sessionId, message, ttl = this.defaultTTL) {
    try {
      const key = `session:${sessionId}`;
      const data = await this.client.get(key);

      let messages = [];
      if (data) {
        messages = JSON.parse(data);
      }

      messages.push(message);
      await this.client.setex(key, ttl, JSON.stringify(messages));

      return true;
    } catch (error) {
      console.error("Failed to add message to session:", error);
      return false;
    }
  }

  /**
   * Delete a chat session
   * @param {string} sessionId - Unique session identifier
   * @returns {boolean} - Success status
   */
  async deleteChatSession(sessionId) {
    try {
      const key = `session:${sessionId}`;
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error("Failed to delete chat session:", error);
      return false;
    }
  }

  /**
   * Cache query results
   * @param {string} query - User query
   * @param {Object} result - Query result
   * @param {number} ttl - Time to live in seconds (optional)
   */
  async cacheQueryResult(query, result, ttl = this.defaultTTL) {
    try {
      const key = `query:${Buffer.from(query).toString("base64")}`;
      await this.client.setex(key, ttl, JSON.stringify(result));
    } catch (error) {
      console.error("Failed to cache query result:", error);
    }
  }

  /**
   * Get cached query result
   * @param {string} query - User query
   * @returns {Object|null} - Cached result or null if not found
   */
  async getCachedQueryResult(query) {
    try {
      const key = `query:${Buffer.from(query).toString("base64")}`;
      const data = await this.client.get(key);

      if (!data) {
        return null;
      }

      return JSON.parse(data);
    } catch (error) {
      console.error("Failed to get cached query result:", error);
      return null;
    }
  }

  /**
   * Close Redis connection
   */
  async close() {
    await this.client.quit();
    console.log("Redis connection closed");
  }
}

module.exports = {
  RedisCacheService,
};
