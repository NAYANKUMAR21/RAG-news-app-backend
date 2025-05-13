// backend/src/routes/chatRoutes.js
const express = require("express");
const router = express.Router();

/**
 * Setup chat routes
 * @param {Object} chatController - Chat controller instance
 * @returns {Object} - Express router
 */
function setupChatRoutes(chatController) {
  /**
   * @route POST /api/chat/session
   * @description Create a new chat session
   * @access Public
   */
  router.post("/session", (req, res) => chatController.createSession(req, res));

  /**
   * @route GET /api/chat/session/:sessionId
   * @description Get chat session history
   * @access Public
   */
  router.get("/session/:sessionId", (req, res) =>
    chatController.getSessionHistory(req, res)
  );

  /**
   * @route POST /api/chat/session/:sessionId/message
   * @description Send a message and get response
   * @access Public
   */
  router.post("/session/:sessionId/message", (req, res) =>
    chatController.sendMessage(req, res)
  );

  /**
   * @route POST /api/chat/session/:sessionId/stream
   * @description Stream response for a message
   * @access Public
   */
  router.post("/session/:sessionId/stream", (req, res) =>
    chatController.streamMessage(req, res)
  );

  /**
   * @route DELETE /api/chat/session/:sessionId
   * @description Clear chat session
   * @access Public
   */
  router.delete("/session/:sessionId", (req, res) =>
    chatController.clearSession(req, res)
  );

  return router;
}

module.exports = setupChatRoutes;
