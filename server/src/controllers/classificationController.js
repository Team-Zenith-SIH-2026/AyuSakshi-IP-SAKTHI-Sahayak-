const { classifyFormulation, getWizardTree, wizardClassify } = require('../services/aiService');
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

// Rule-based decision tree, served for a client that wants to render it whole
const wizardTree = async (req, res) => {
  try {
    const tree = await getWizardTree();
    return res.json({ success: true, ...tree });
  } catch (error) {
    console.error('[Wizard Tree Error]', error.message);
    return res.status(503).json({ success: false, error: 'Classification engine unavailable.' });
  }
};

// Walk the decision tree. Returns the next question, or the final category
// with the decision path that produced it.
const wizardStep = async (req, res) => {
  try {
    const { answers, conversation_id } = req.body;
    const userId = req.user?.id || null;

    const result = await wizardClassify({
      answers: Array.isArray(answers) ? answers : [],
      conversation_id,
    });

    // Record only completed classifications, with the audit trail
    if (result.complete && conversation_id) {
      await query(
        `INSERT INTO formulation_classifications (
          conversation_id, user_id, raw_input, identified_category, reasoning,
          ip_posture, abs_relevant, regulatory_pathway
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          conversation_id,
          userId,
          JSON.stringify(result.decision_path || []),
          result.category || 'Undetermined',
          result.summary || '',
          JSON.stringify(result.ip_posture || {}),
          true,
          JSON.stringify(result.regulatory_pathway || []),
        ]
      );
    }

    return res.json({ success: true, result });
  } catch (error) {
    const status = error.response?.status === 400 ? 400 : 500;
    console.error('[Wizard Step Error]', error.message);
    return res.status(status).json({
      success: false,
      error: error.response?.data?.detail || 'Failed to advance the classification wizard.',
    });
  }
};

module.exports = {
  classify,
  wizardTree,
  wizardStep,
};
