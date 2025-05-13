// backend/src/services/chunkerService.js
/**
 * Service for chunking large documents into smaller pieces for embedding
 */
class ChunkerService {
  constructor(config = {}) {
    this.maxChunkSize = config.maxChunkSize || 1000; // characters per chunk
    this.overlap = config.overlap || 100; // character overlap between chunks
    this.minChunkSize = config.minChunkSize || 100; // minimum chunk size
  }

  /**
   * Split a long text into smaller chunks with optional overlap
   * @param {string} text - The text to chunk
   * @returns {Array<string>} - Array of text chunks
   */
  chunkText(text) {
    // If text is already small enough, return it as is
    if (text.length <= this.maxChunkSize) {
      return [text];
    }

    const chunks = [];
    let startIndex = 0;

    while (startIndex < text.length) {
      // Calculate end index for this chunk
      let endIndex = startIndex + this.maxChunkSize;

      // If we're not at the end of the text, try to find a good breaking point
      if (endIndex < text.length) {
        // Look for natural break points like paragraph, sentence, or word boundaries
        const paragraphBreak = text.lastIndexOf("\n\n", endIndex);
        const sentenceBreak = text.lastIndexOf(". ", endIndex);
        const wordBreak = text.lastIndexOf(" ", endIndex);

        // Use the best breaking point that's not too far back
        if (paragraphBreak > startIndex && paragraphBreak > endIndex - 200) {
          endIndex = paragraphBreak + 2; // Include the paragraph break
        } else if (
          sentenceBreak > startIndex &&
          sentenceBreak > endIndex - 100
        ) {
          endIndex = sentenceBreak + 2; // Include the period and space
        } else if (wordBreak > startIndex) {
          endIndex = wordBreak + 1; // Include the space
        }
      }

      // Extract the chunk
      const chunk = text.substring(startIndex, endIndex);

      // Only add if the chunk is not too small
      if (chunk.length >= this.minChunkSize) {
        chunks.push(chunk);
      }

      // Move the start index for the next chunk, accounting for overlap
      startIndex = endIndex - this.overlap;

      // Ensure we make progress if overlap is large
      if (startIndex <= 0 || startIndex <= chunks.length - 1) {
        startIndex = endIndex;
      }
    }

    return chunks;
  }

  /**
   * Process an array of document objects for embedding
   * @param {Array<Object>} documents - Array of document objects with content field
   * @returns {Array<Object>} - Array of chunk objects with metadata
   */
  processDocuments(documents) {
    const chunks = [];

    documents.forEach((doc, docIndex) => {
      const docChunks = this.chunkText(doc.content || doc.text || "");

      docChunks.forEach((chunkText, chunkIndex) => {
        chunks.push({
          text: chunkText,
          metadata: {
            docId: doc.id || docIndex.toString(),
            docTitle: doc.title || `Document ${docIndex}`,
            chunkIndex,
            totalChunks: docChunks.length,
            source: doc.source || "unknown",
            ...doc.metadata,
          },
        });
      });
    });

    return chunks;
  }
}

module.exports = ChunkerService;
