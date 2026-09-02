const { classifyFormulation } = require('../services/aiService');
const { query } = require('../config/db');

const classify = async (req, res) => {
  try {
    const { text, conversation_id, current_state } = req.body;
    const userId = req.user?.id || null;

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, error: 'Formulation description text is required.' });
    }

    // Call AI classifier
    const classificationResult = await classifyFormulation({
      text: text.trim(),
      conversation_id,
      current_state: current_state || {},
    });

    // Record classification in database if conversation_id is provided
    if (conversation_id) {
      await query(
        `INSERT INTO formulation_classifications (
          conversation_id, user_id, raw_input, identified_category, reasoning,
          ip_posture, abs_relevant, regulatory_pathway
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          conversation_id,
          userId,
          text.trim(),
          classificationResult.category || 'Undetermined',
          classificationResult.reasoning || '',
          JSON.stringify(classificationResult.ip_posture || {}),
          classificationResult.abs_relevant || false,
          JSON.stringify(classificationResult.regulatory_pathway || {}),
        ]
      );
    }

    return res.json({
      success: true,
      classification: classificationResult,
    });
  } catch (error) {
    console.error('[Classification Controller Error]', error.message);
    return res.status(500).json({ success: false, error: 'Failed to classify formulation.' });
  }
};

module.exports = {
  classify,
};
