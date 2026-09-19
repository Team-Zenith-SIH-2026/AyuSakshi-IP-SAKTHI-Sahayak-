const { query } = require('../config/db');

// 1. Get requests assigned to this facilitator
const getAssignedRequests = async (req, res) => {
  try {
    const facilitatorId = req.user.id;
    const { status } = req.query;

    let text = `
      SELECT id, conversation_id, user_email, question, jurisdiction,
             formulation_summary, system_confidence, reason, status,
             assignment_status, resolution_notes, assigned_at, created_at, updated_at
      FROM human_review_requests
      WHERE assigned_facilitator_id = $1
    `;
    const params = [facilitatorId];

    if (status) {
      params.push(status);
      text += ` AND status = $${params.length}`;
    }

    text += ` ORDER BY created_at DESC`;

    const result = await query(text, params);
    return res.json({ success: true, count: result.rows.length, requests: result.rows });
  } catch (error) {
    console.error('[Facilitator Get Requests Error]', error.message);
    return res.status(500).json({ success: false, error: 'Failed to retrieve assigned requests.' });
  }
};

// 2. Get specific request detail (strict ownership check)
const getRequestDetail = async (req, res) => {
  try {
    const facilitatorId = req.user.id;
    const { id } = req.params;

    const result = await query(
      `SELECT * FROM human_review_requests
       WHERE id = $1 AND assigned_facilitator_id = $2`,
      [id, facilitatorId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Assigned review request not found or access unauthorized.',
      });
    }

    return res.json({ success: true, request: result.rows[0] });
  } catch (error) {
    console.error('[Facilitator Get Request Detail Error]', error.message);
    return res.status(500).json({ success: false, error: 'Failed to retrieve request details.' });
  }
};

// 3. Update status / resolution notes for an assigned request
const updateRequestStatus = async (req, res) => {
  try {
    const facilitatorId = req.user.id;
    const { id } = req.params;
    const { status, resolution_notes } = req.body;

    if (status && !['IN_REVIEW', 'RESOLVED', 'CLOSED'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status. Allowed: IN_REVIEW, RESOLVED, CLOSED.' });
    }

    const result = await query(
      `UPDATE human_review_requests
       SET status = COALESCE($1, status),
           resolution_notes = COALESCE($2, resolution_notes),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND assigned_facilitator_id = $4
       RETURNING *`,
      [status || null, resolution_notes || null, id, facilitatorId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Request not found or not assigned to you.' });
    }

    return res.json({
      success: true,
      message: 'Request updated successfully.',
      request: result.rows[0],
    });
  } catch (error) {
    console.error('[Facilitator Update Status Error]', error.message);
    return res.status(500).json({ success: false, error: 'Failed to update request.' });
  }
};

module.exports = {
  getAssignedRequests,
  getRequestDetail,
  updateRequestStatus,
};
