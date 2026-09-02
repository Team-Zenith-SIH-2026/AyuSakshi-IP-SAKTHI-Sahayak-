const { Queue, Worker } = require('bullmq');
const redisClient = require('../config/redis');
const { ingestDocument } = require('../services/aiService');
const { query } = require('../config/db');

let ingestionQueue = null;
let ingestionWorker = null;

try {
  const connection = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  };

  ingestionQueue = new Queue('document-ingestion-queue', { connection });

  ingestionWorker = new Worker(
    'document-ingestion-queue',
    async (job) => {
      const { documentId, versionTag, filePath, title, authority, documentType, jurisdiction, category, sourceUrl } = job.data;
      console.log(`[BullMQ Worker] Processing Ingestion Job ${job.id} for "${title}" (${versionTag})...`);

      try {
        const result = await ingestDocument({
          document_id: documentId,
          version_tag: versionTag,
          file_path: filePath,
          title,
          authority,
          document_type: documentType,
          jurisdiction,
          category,
          source_url: sourceUrl,
        });

        console.log(`[BullMQ Worker] Ingestion successful for Document ${documentId}. Chunks created: ${result.chunks_count}`);
        return result;
      } catch (err) {
        console.error(`[BullMQ Worker] Ingestion job ${job.id} failed:`, err.message);
        throw err;
      }
    },
    { connection, concurrency: 2 }
  );

  ingestionWorker.on('failed', (job, err) => {
    console.error(`[BullMQ Job Failed] Job ${job?.id} failed with error: ${err.message}`);
  });
} catch (err) {
  console.warn('[BullMQ] Queue initialization warning:', err.message);
}

const addIngestionJob = async (data) => {
  if (ingestionQueue) {
    return await ingestionQueue.add('ingest-document', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: true,
    });
  } else {
    // Synchronous fallback if Redis queue unavailable
    console.log('[Queue Fallback] Processing ingestion synchronously...');
    return await ingestDocument(data);
  }
};

module.exports = {
  ingestionQueue,
  ingestionWorker,
  addIngestionJob,
};
