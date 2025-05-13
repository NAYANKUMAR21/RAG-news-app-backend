// backend/test/test-rag-system.js
const axios = require("axios");
const fs = require("fs");
const path = require("path");

// Base URL for the RAG application
const baseUrl = "http://localhost:3000";

/**
 * Function to test the RAG system
 */
async function testRagSystem() {
  console.log("---- Testing RAG System ----");

  // Test the health endpoint
  try {
    const healthResponse = await axios.get(`${baseUrl}/health`);
    console.log("Health check:", healthResponse.data);
  } catch (error) {
    console.error("Health check failed:", error.message);
    process.exit(1);
  }

  // Test ingestion endpoint with a single article
  try {
    const testArticle = {
      title: "Test Article",
      content:
        "This is a test article for the RAG system. It contains some sample content to test the ingestion and embedding functionality.",
      source: "test-script",
      id: "test-001",
    };

    console.log("Testing ingestion with a single article...");
    const ingestionResponse = await axios.post(`${baseUrl}/ingest`, {
      articles: [testArticle],
    });

    console.log("Ingestion response:", ingestionResponse.data);
  } catch (error) {
    console.error(
      "Ingestion test failed:",
      error.response?.data || error.message
    );
  }

  // Test the query endpoint
  try {
    const queryResponse = await axios.post(`${baseUrl}/query`, {
      query: "What is this system about?",
    });

    console.log("Query response:", JSON.stringify(queryResponse.data, null, 2));
  } catch (error) {
    console.error("Query test failed:", error.response?.data || error.message);
  }

  console.log("---- Testing Complete ----");
}

// Run the test
testRagSystem().catch(console.error);
