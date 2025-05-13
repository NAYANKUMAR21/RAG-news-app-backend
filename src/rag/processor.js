// backend/src/rag/processor.js
/**
 * Splits article text into smaller chunks for embedding
 * @param {Object} article - Article object with content
 * @param {number} chunkSize - Approximate token size for each chunk
 * @param {number} overlap - Overlap between chunks
 * @returns {Array} - Array of text chunks with metadata
 */
function chunkArticleContent(article, chunkSize = 500, overlap = 100) {
  const content = article.content || "";

  // Simple sentence-based chunking (you might want a more sophisticated approach)
  const sentences = content.split(/(?<=[.!?])\s+/);
  const chunks = [];

  let currentChunk = [];
  let currentSize = 0;

  for (const sentence of sentences) {
    // Rough estimation of tokens (words / 0.75)
    const sentenceSize = sentence.split(/\s+/).length;

    if (currentSize + sentenceSize > chunkSize && currentChunk.length > 0) {
      // Store the current chunk
      chunks.push({
        text: currentChunk.join(" "),
        metadata: {
          title: article.title,
          source: article.source,
          url: article.link,
          date: article.pubDate,
        },
      });

      // Calculate overlap - keep some sentences for the next chunk
      const overlapSentences = currentChunk.slice(
        -Math.ceil(overlap / sentenceSize)
      );
      currentChunk = [...overlapSentences, sentence];
      currentSize =
        overlapSentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) +
        sentenceSize;
    } else {
      currentChunk.push(sentence);
      currentSize += sentenceSize;
    }
  }

  // Add the last chunk if it's not empty
  if (currentChunk.length > 0) {
    chunks.push({
      text: currentChunk.join(" "),
      metadata: {
        title: article.title,
        source: article.source,
        url: article.link,
        date: article.pubDate,
      },
    });
  }

  return chunks;
}

/**
 * Process a collection of articles into chunks
 * @param {Array} articles - Collection of article objects
 * @returns {Array} - Processed chunks ready for embedding
 */
function processArticles(articles) {
  const allChunks = [];

  for (const article of articles) {
    const chunks = chunkArticleContent(article);
    allChunks.push(...chunks);
  }

  return allChunks;
}

module.exports = {
  processArticles,
  chunkArticleContent,
};
