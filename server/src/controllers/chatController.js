const { query } = require('../config/db');
const { queryRAG } = require('../services/aiService');
const { v4: uuidv4 } = require('uuid');

// 1. List user's conversations
const listConversations = async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const { jurisdiction } = req.query;

    let text = `
      SELECT c.id, c.title, c.jurisdiction, c.formulation_state, c.updated_at,
             (SELECT content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message,
             (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count
      FROM conversations c
      WHERE c.is_archived = FALSE
    `;
    const params = [];

    if (userId) {
      params.push(userId);
      text += ` AND c.user_id = $${params.length}`;
    } else {
      text += ` AND c.user_id IS NULL`;
    }

    if (jurisdiction && ['india', 'international'].includes(jurisdiction)) {
      params.push(jurisdiction);
      text += ` AND c.jurisdiction = $${params.length}`;
    }

    text += ` ORDER BY c.updated_at DESC LIMIT 50`;

    const result = await query(text, params);
    return res.json({ success: true, conversations: result.rows });
  } catch (error) {
    console.error('[List Conversations Error]', error.message);
    return res.status(500).json({ success: false, error: 'Failed to retrieve conversations.' });
  }
};

// 2. Create a new conversation
const createConversation = async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const { title, jurisdiction, formulation_state } = req.body;

    const jur = ['india', 'international'].includes(jurisdiction) ? jurisdiction : 'india';
    const convTitle = title ? title.slice(0, 250) : 'New AYUSH IP Inquiry';

    const result = await query(
      `INSERT INTO conversations (user_id, title, jurisdiction, formulation_state)
       VALUES ($1, $2, $3, $4)
       RETURNING id, title, jurisdiction, formulation_state, created_at, updated_at`,
      [userId, convTitle, jur, JSON.stringify(formulation_state || {})]
    );

    return res.status(201).json({ success: true, conversation: result.rows[0] });
  } catch (error) {
    console.error('[Create Conversation Error]', error.message);
    return res.status(500).json({ success: false, error: 'Failed to create conversation.' });
  }
};

// 3. Get messages for a conversation
const getConversationMessages = async (req, res) => {
  try {
    const { id } = req.params;

    const convResult = await query('SELECT * FROM conversations WHERE id = $1', [id]);
    if (convResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Conversation not found.' });
    }

    const messagesResult = await query(
      `SELECT id, conversation_id, sender, content, language, thinking_trace,
              confidence_score, confidence_level, citations, ip_domains,
              classification, abs_summary, tkdl_summary, created_at
       FROM messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC`,
      [id]
    );

    return res.json({
      success: true,
      conversation: convResult.rows[0],
      messages: messagesResult.rows,
    });
  } catch (error) {
    console.error('[Get Messages Error]', error.message);
    return res.status(500).json({ success: false, error: 'Failed to retrieve messages.' });
  }
};

// 4. Post a message to conversation & execute Conversational RAG pipeline
const sendMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { content, language, jurisdiction: overrideJurisdiction } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, error: 'Message content cannot be empty.' });
    }

    // Check conversation
    const convResult = await query('SELECT * FROM conversations WHERE id = $1', [id]);
    if (convResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Conversation not found.' });
    }

    const conversation = convResult.rows[0];
    const jurisdiction = overrideJurisdiction || conversation.jurisdiction || 'india';
    const lang = language || 'en';

    // 1. Insert User Message
    const userMsgResult = await query(
      `INSERT INTO messages (conversation_id, sender, content, language)
       VALUES ($1, 'user', $2, $3)
       RETURNING id, conversation_id, sender, content, language, created_at`,
      [id, content.trim(), lang]
    );
    const userMessage = userMsgResult.rows[0];

    // 2. Fetch recent conversation history for RAG contextual continuity (last 6 turns)
    const historyResult = await query(
      `SELECT sender, content, language, created_at
       FROM messages
       WHERE conversation_id = $1 AND id != $2
       ORDER BY created_at DESC
       LIMIT 6`,
      [id, userMessage.id]
    );
    const history = historyResult.rows.reverse();

    // Auto-update conversation title if it's the first message
    if (conversation.title === 'New Conversation' || conversation.title === 'New AYUSH IP Inquiry') {
      const newTitle = content.trim().slice(0, 45) + (content.length > 45 ? '...' : '');
      await query('UPDATE conversations SET title = $1 WHERE id = $2', [newTitle, id]);
    }

    // 3. Execute RAG pipeline in Python AI Service
    let ragResponse;
    try {
      ragResponse = await queryRAG({
        query: content.trim(),
        conversation_id: id,
        jurisdiction,
        language: lang,
        history,
        formulation_state: conversation.formulation_state || {},
      });
    } catch (aiErr) {
      // The retrieval engine is unreachable, so nothing can be grounded. Abstain.
      //
      // This branch previously invented a complete answer with a hardcoded
      // Section 3(p) citation marked verified_grounded:true at 0.85 confidence.
      // That produced a confidently cited legal answer with the RAG pipeline
      // entirely offline, which is the exact failure this project exists to prevent.
      console.error('[AI Service Unreachable - abstaining]:', aiErr.message);
      ragResponse = {
        answer:
          'The regulatory intelligence engine is currently unreachable, so I cannot ground an answer in statutory sources. ' +
          'Rather than answer from memory, I am withholding a response. Please retry shortly, or request human facilitator escalation below.',
        confidence_score: 0,
        confidence_level: 'abstained',
        citations: [],
        thinking_trace: [
          { step: 'Jurisdiction Check', detail: `Selected jurisdiction: ${jurisdiction}` },
          { step: 'Retrieval Engine', detail: `Unreachable: ${aiErr.message}` },
          { step: 'Safety Gate', detail: 'Abstained rather than answering without retrieved evidence.' },
        ],
        ip_domains: [],
        classification: null,
        abs_summary: null,
        tkdl_summary: null,
        updated_formulation_state: conversation.formulation_state || {},
      };
    }

    // 4. Update Conversation stateful formulation data & updated_at
    if (ragResponse.updated_formulation_state) {
      await query(
        `UPDATE conversations
         SET formulation_state = $1, jurisdiction = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [JSON.stringify(ragResponse.updated_formulation_state), jurisdiction, id]
      );
    } else {
      await query(
        `UPDATE conversations SET jurisdiction = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [jurisdiction, id]
      );
    }

    // 5. Insert Assistant Response Message
    const assistantMsgResult = await query(
      `INSERT INTO messages (
        conversation_id, sender, content, language,
        thinking_trace, confidence_score, confidence_level,
        citations, ip_domains, classification, abs_summary, tkdl_summary
       )
       VALUES ($1, 'assistant', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, conversation_id, sender, content, language, thinking_trace,
                 confidence_score, confidence_level, citations, ip_domains,
                 classification, abs_summary, tkdl_summary, created_at`,
      [
        id,
        ragResponse.answer,
        lang,
        JSON.stringify(ragResponse.thinking_trace || []),
        // Do NOT use `|| 0.85` here. An abstention carries confidence_score 0,
        // and 0 is falsy in JS, so the fallback rewrote every abstention to 0.85
        // before it reached the database.
        ragResponse.confidence_score ?? 0,
        ragResponse.confidence_level || 'low',
        JSON.stringify(ragResponse.citations || []),
        ragResponse.ip_domains || [],
        ragResponse.classification ? JSON.stringify(ragResponse.classification) : null,
        ragResponse.abs_summary ? JSON.stringify(ragResponse.abs_summary) : null,
        ragResponse.tkdl_summary ? JSON.stringify(ragResponse.tkdl_summary) : null,
      ]
    );

    const assistantMessage = assistantMsgResult.rows[0];

    // 6. Record citations in citations table for audit & verification
    if (Array.isArray(ragResponse.citations)) {
      for (const cit of ragResponse.citations) {
        await query(
          `INSERT INTO citations (message_id, claim_text, source_title, section_reference, jurisdiction, verified_grounded, similarity_score)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            assistantMessage.id,
            cit.claim_text || assistantMessage.content.slice(0, 200),
            cit.source_title || 'Statute / Rule',
            cit.section_reference || '',
            cit.jurisdiction || jurisdiction,
            cit.verified_grounded === true,
            cit.similarity_score ?? 0,
          ]
        );
      }
    }

    return res.json({
      success: true,
      user_message: userMessage,
      assistant_message: assistantMessage,
      jurisdiction,
    });
  } catch (error) {
    console.error('[Send Message Error]', error.message);
    return res.status(500).json({ success: false, error: 'Internal server error processing message.' });
  }
};

// 5. Delete or archive conversation
const deleteConversation = async (req, res) => {
  try {
    const { id } = req.params;
    await query('UPDATE conversations SET is_archived = TRUE WHERE id = $1', [id]);
    return res.json({ success: true, message: 'Conversation archived successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to delete conversation.' });
  }
};

module.exports = {
  listConversations,
  createConversation,
  getConversationMessages,
  sendMessage,
  deleteConversation,
};
