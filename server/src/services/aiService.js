const axios = require('axios');
require('dotenv').config();

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const AI_SERVICE_SECRET = process.env.AI_SERVICE_SECRET || 'ayusakshi_internal_ai_token_2026';

const aiClient = axios.create({
  baseURL: AI_SERVICE_URL,
  timeout: 45000,
  headers: {
    'Content-Type': 'application/json',
    'x-ai-service-token': AI_SERVICE_SECRET,
  },
});

/**
 * Execute Conversational RAG pipeline via Python AI Service
 */
const queryRAG = async (payload) => {
  try {
    const response = await aiClient.post('/api/rag/query', {
      query: payload.query,
      conversation_id: payload.conversation_id,
      jurisdiction: payload.jurisdiction || 'india',
      language: payload.language || 'en',
      history: payload.history || [],
      formulation_state: payload.formulation_state || {},
    });
    return response.data;
  } catch (error) {
    console.error('[AI Service Error - RAG Query]:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Classify Formulation via Domain Intelligence Classifier
 */
const classifyFormulation = async (payload) => {
  try {
    const response = await aiClient.post('/api/formulation/classify', {
      text: payload.text,
      conversation_id: payload.conversation_id,
      current_state: payload.current_state || {},
    });
    return response.data;
  } catch (error) {
    console.error('[AI Service Error - Formulation Classify]:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Ingest / Chunk / Embed Document via Python Service
 */
const ingestDocument = async (payload) => {
  try {
    const response = await aiClient.post('/api/document/ingest', {
      document_id: payload.document_id,
      version_tag: payload.version_tag,
      file_path: payload.file_path,
      title: payload.title,
      authority: payload.authority,
      document_type: payload.document_type,
      jurisdiction: payload.jurisdiction,
      category: payload.category,
      source_url: payload.source_url,
    });
    return response.data;
  } catch (error) {
    console.error('[AI Service Error - Document Ingest]:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Translate Text via Bhashini / Multilingual Service
 */
const translateText = async (payload) => {
  try {
    const response = await aiClient.post('/api/translate', {
      text: payload.text,
      source_language: payload.source_language || 'auto',
      target_language: payload.target_language || 'en',
    });
    return response.data;
  } catch (error) {
    console.error('[AI Service Error - Translate]:', error.response?.data || error.message);
    return { text: payload.text, translated: false };
  }
};

/**
 * Health check on Python AI Service
 */
const getHealth = async () => {
  try {
    const response = await aiClient.get('/health', { timeout: 3000 });
    return response.data;
  } catch (error) {
    return { status: 'unreachable', error: error.message };
  }
};

module.exports = {
  queryRAG,
  classifyFormulation,
  ingestDocument,
  translateText,
  getHealth,
};
