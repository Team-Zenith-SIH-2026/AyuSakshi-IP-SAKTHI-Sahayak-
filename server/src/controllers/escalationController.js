const { query } = require('../config/db');

// 1. Submit Human Review / Escalation Request
const submitEscalation = async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const userEmail = req.user?.email || req.body.email || 'guest@ayusakshi.gov.in';
    const { conversation_id, question, jurisdiction, formulation_summary, retrieved_evidence, system_confidence, reason } = req.body;

    if (!question || !reason) {
      return res.status(400).json({ success: false, error: 'Question and reason for escalation are required.' });
    }

    const result = await query(
      `INSERT INTO human_review_requests (
        conversation_id, user_id, user_email, question, jurisdiction,
        formulation_summary, retrieved_evidence, system_confidence, reason, status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING')
       RETURNING *`,
      [
        conversation_id || null,
        userId,
        userEmail,
        question.trim(),
        jurisdiction || 'india',
        formulation_summary || null,
        JSON.stringify(retrieved_evidence || []),
        system_confidence || 0.0,
        reason.trim(),
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Escalation request submitted successfully. An AYUSH IP Facilitator will review this matter.',
      review_ticket: result.rows[0],
    });
  } catch (error) {
    console.error('[Submit Escalation Error]', error.message);
    return res.status(500).json({ success: false, error: 'Failed to submit escalation request.' });
  }
};

// 2. List escalation requests (for IP Facilitator workspace)
const listEscalations = async (req, res) => {
  try {
    const { status, jurisdiction } = req.query;

    let text = `
      SELECT r.*, u.name as facilitator_name
      FROM human_review_requests r
      LEFT JOIN users u ON r.facilitator_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (status && ['PENDING', 'IN_REVIEW', 'RESOLVED', 'CLOSED'].includes(status)) {
      params.push(status);
      text += ` AND r.status = $${params.length}`;
    }

    if (jurisdiction) {
      params.push(jurisdiction);
      text += ` AND r.jurisdiction = $${params.length}`;
    }

    text += ` ORDER BY r.created_at DESC LIMIT 100`;

    const result = await query(text, params);
    return res.json({ success: true, count: result.rows.length, escalations: result.rows });
  } catch (error) {
    console.error('[List Escalations Error]', error.message);
    return res.status(500).json({ success: false, error: 'Failed to retrieve escalation requests.' });
  }
};

// 3. Update escalation status and resolution notes (Facilitator only)
const updateEscalationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolution_notes } = req.body;
    const facilitatorId = req.user?.id || null;

    if (!['PENDING', 'IN_REVIEW', 'RESOLVED', 'CLOSED'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status code.' });
    }

    const result = await query(
      `UPDATE human_review_requests
       SET status = $1, resolution_notes = COALESCE($2, resolution_notes), facilitator_id = COALESCE($3, facilitator_id), updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [status, resolution_notes || null, facilitatorId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Review request not found.' });
    }

    return res.json({
      success: true,
      message: `Escalation ticket #${id.slice(0, 8)} updated to ${status}.`,
      review_ticket: result.rows[0],
    });
  } catch (error) {
    console.error('[Update Escalation Error]', error.message);
    return res.status(500).json({ success: false, error: 'Failed to update escalation ticket.' });
  }
};

module.exports = {
  submitEscalation,
  listEscalations,
  updateEscalationStatus,
};
