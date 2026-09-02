const { query } = require('../config/db');
const { addIngestionJob } = require('../queues/ingestionQueue');
const path = require('path');
const fs = require('fs');

// 1. List all knowledge base documents with versions and chunk counts
const listDocuments = async (req, res) => {
  try {
    const { jurisdiction, category, search } = req.query;

    let text = `
      SELECT d.id, d.title, d.authority, d.document_type, d.jurisdiction, d.category, d.source_url, d.status,
             v.id as version_id, v.version_tag, v.effective_date, v.is_current, v.chunk_count, v.created_at as version_created_at
      FROM documents d
      LEFT JOIN document_versions v ON d.id = v.document_id AND v.is_current = TRUE
      WHERE 1=1
    `;
    const params = [];

    if (jurisdiction && ['india', 'international'].includes(jurisdiction)) {
      params.push(jurisdiction);
      text += ` AND d.jurisdiction = $${params.length}`;
    }

    if (category) {
      params.push(category);
      text += ` AND d.category = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      text += ` AND (d.title ILIKE $${params.length} OR d.authority ILIKE $${params.length})`;
    }

    text += ` ORDER BY d.jurisdiction ASC, d.category ASC, d.title ASC`;

    const result = await query(text, params);
    return res.json({ success: true, count: result.rows.length, documents: result.rows });
  } catch (error) {
    console.error('[List Documents Error]', error.message);
    return res.status(500).json({ success: false, error: 'Failed to fetch knowledge base documents.' });
  }
};

// 2. Get specific document details with all historical versions and sample chunks
const getDocumentById = async (req, res) => {
  try {
    const { id } = req.params;

    const docResult = await query('SELECT * FROM documents WHERE id = $1', [id]);
    if (docResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Document not found.' });
    }

    const versionsResult = await query(
      'SELECT * FROM document_versions WHERE document_id = $1 ORDER BY created_at DESC',
      [id]
    );

    const chunksResult = await query(
      `SELECT c.id, c.chunk_index, c.section_identifier, c.title, c.content, c.metadata
       FROM document_chunks c
       JOIN document_versions v ON c.document_version_id = v.id
       WHERE v.document_id = $1 AND v.is_current = TRUE
       ORDER BY c.chunk_index ASC
       LIMIT 50`,
      [id]
    );

    return res.json({
      success: true,
      document: docResult.rows[0],
      versions: versionsResult.rows,
      chunks_sample: chunksResult.rows,
    });
  } catch (error) {
    console.error('[Get Document Error]', error.message);
    return res.status(500).json({ success: false, error: 'Failed to fetch document details.' });
  }
};

// 3. Upload & Ingest New Document / Version (Admin only)
const uploadDocument = async (req, res) => {
  try {
    const { title, authority, document_type, jurisdiction, category, source_url, version_tag } = req.body;
    const file = req.file;

    if (!title || !authority || !document_type || !jurisdiction || !category) {
      return res.status(400).json({
        success: false,
        error: 'Missing required metadata (title, authority, document_type, jurisdiction, category).',
      });
    }

    const filePath = file ? file.path : null;

    // Check if document already exists
    let docResult = await query('SELECT id FROM documents WHERE title = $1 AND jurisdiction = $2', [title, jurisdiction]);
    let documentId;

    if (docResult.rows.length > 0) {
      documentId = docResult.rows[0].id;
    } else {
      const newDoc = await query(
        `INSERT INTO documents (title, authority, document_type, jurisdiction, category, source_url)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [title, authority, document_type, jurisdiction, category, source_url || '']
      );
      documentId = newDoc.rows[0].id;
    }

    const vTag = version_tag || `v-${new Date().toISOString().slice(0, 10)}`;

    // Queue ingestion job
    await addIngestionJob({
      documentId,
      versionTag: vTag,
      filePath,
      title,
      authority,
      documentType: document_type,
      jurisdiction,
      category,
      sourceUrl: source_url,
    });

    return res.status(202).json({
      success: true,
      message: `Document "${title}" accepted for ingestion. Background indexing job scheduled.`,
      document_id: documentId,
      version_tag: vTag,
    });
  } catch (error) {
    console.error('[Upload Document Error]', error.message);
    return res.status(500).json({ success: false, error: 'Document upload and ingestion failed.' });
  }
};

module.exports = {
  listDocuments,
  getDocumentById,
  uploadDocument,
};
