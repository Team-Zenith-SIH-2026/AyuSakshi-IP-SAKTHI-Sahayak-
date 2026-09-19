const bcrypt = require('bcryptjs');
const { query } = require('../config/db');

// 1. Dashboard summary metrics
const getDashboardSummary = async (req, res) => {
  try {
    const [facTotal, facActive, usersTotal, requestsTotal, requestsPending] = await Promise.all([
      query("SELECT COUNT(*)::int AS count FROM users WHERE role = 'facilitator'"),
      query("SELECT COUNT(*)::int AS count FROM users WHERE role = 'facilitator' AND is_active = TRUE"),
      query("SELECT COUNT(*)::int AS count FROM users WHERE role IN ('user', 'researcher', 'practitioner', 'msme')"),
      query("SELECT COUNT(*)::int AS count FROM human_review_requests"),
      query("SELECT COUNT(*)::int AS count FROM human_review_requests WHERE status IN ('PENDING', 'ASSIGNED', 'IN_REVIEW')"),
    ]);

    return res.json({
      success: true,
      summary: {
        total_facilitators: facTotal.rows[0].count,
        active_facilitators: facActive.rows[0].count,
        total_users: usersTotal.rows[0].count,
        total_review_requests: requestsTotal.rows[0].count,
        pending_review_requests: requestsPending.rows[0].count,
      },
    });
  } catch (error) {
    console.error('[Admin Dashboard Error]', error.message);
    return res.status(500).json({ success: false, error: 'Failed to retrieve dashboard metrics.' });
  }
};

// 2. List all facilitators
const listFacilitators = async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at, u.last_login_at,
              (SELECT COUNT(*)::int FROM human_review_requests r WHERE r.assigned_facilitator_id = u.id) AS assigned_count
       FROM users u
       WHERE u.role = 'facilitator'
       ORDER BY u.created_at DESC`
    );

    return res.json({ success: true, facilitators: result.rows });
  } catch (error) {
    console.error('[Admin List Facilitators Error]', error.message);
    return res.status(500).json({ success: false, error: 'Failed to retrieve facilitators.' });
  }
};

// 3. Create a new facilitator account
const createFacilitator = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Name, email, and initial password are required.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters long.' });
    }

    const emailNormalized = email.trim().toLowerCase();

    // Prevent duplicate email
    const existing = await query('SELECT id FROM users WHERE email = $1', [emailNormalized]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, error: 'An account with this email already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const result = await query(
      `INSERT INTO users (name, email, password_hash, role, is_active, must_change_password, auth_provider)
       VALUES ($1, $2, $3, 'facilitator', TRUE, TRUE, 'local')
       RETURNING id, name, email, role, is_active, must_change_password, created_at`,
      [name.trim(), emailNormalized, passwordHash]
    );

    return res.status(201).json({
      success: true,
      message: 'Human IP Facilitator account created successfully.',
      facilitator: result.rows[0],
    });
  } catch (error) {
    console.error('[Admin Create Facilitator Error]', error.message);
    return res.status(500).json({ success: false, error: 'Failed to create facilitator account.' });
  }
};

// 4. Toggle facilitator active/inactive status
const toggleFacilitatorStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    const result = await query(
      `UPDATE users
       SET is_active = COALESCE($1, NOT is_active), updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND role = 'facilitator'
       RETURNING id, name, email, role, is_active, updated_at`,
      [typeof is_active === 'boolean' ? is_active : null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Facilitator not found.' });
    }

    return res.json({
      success: true,
      message: `Facilitator ${result.rows[0].is_active ? 'activated' : 'deactivated'} successfully.`,
      facilitator: result.rows[0],
    });
  } catch (error) {
    console.error('[Admin Toggle Facilitator Error]', error.message);
    return res.status(500).json({ success: false, error: 'Failed to update facilitator status.' });
  }
};

// 5. Reset facilitator password
const resetFacilitatorPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { new_password } = req.body;

    if (!new_password || new_password.length < 8) {
      return res.status(400).json({ success: false, error: 'New password must be at least 8 characters long.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(new_password, salt);

    const result = await query(
      `UPDATE users
       SET password_hash = $1, must_change_password = TRUE, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND role = 'facilitator'
       RETURNING id, name, email`,
      [passwordHash, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Facilitator not found.' });
    }

    return res.json({
      success: true,
      message: 'Facilitator password reset successfully. The facilitator must change it upon next login.',
    });
  } catch (error) {
    console.error('[Admin Reset Facilitator Password Error]', error.message);
    return res.status(500).json({ success: false, error: 'Failed to reset facilitator password.' });
  }
};

// 6. List registered researchers / regular users
const listUsers = async (req, res) => {
  try {
    const result = await query(
      `SELECT id, name, email, role, is_active, auth_provider, created_at, last_login_at
       FROM users
       WHERE role IN ('user', 'researcher', 'practitioner', 'msme')
       ORDER BY created_at DESC`
    );

    return res.json({ success: true, users: result.rows });
  } catch (error) {
    console.error('[Admin List Users Error]', error.message);
    return res.status(500).json({ success: false, error: 'Failed to retrieve users.' });
  }
};

// 7. Toggle user active status
const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    const result = await query(
      `UPDATE users
       SET is_active = COALESCE($1, NOT is_active), updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND role IN ('user', 'researcher', 'practitioner', 'msme')
       RETURNING id, name, email, role, is_active, updated_at`,
      [typeof is_active === 'boolean' ? is_active : null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    return res.json({
      success: true,
      message: `User ${result.rows[0].is_active ? 'activated' : 'deactivated'} successfully.`,
      user: result.rows[0],
    });
  } catch (error) {
    console.error('[Admin Toggle User Error]', error.message);
    return res.status(500).json({ success: false, error: 'Failed to update user status.' });
  }
};

// 8. List all review requests with assignment info
const listReviewRequests = async (req, res) => {
  try {
    const { status, jurisdiction } = req.query;
    let text = `
      SELECT r.*,
             u.name as assigned_facilitator_name,
             u.email as assigned_facilitator_email
      FROM human_review_requests r
      LEFT JOIN users u ON r.assigned_facilitator_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      params.push(status);
      text += ` AND r.status = $${params.length}`;
    }

    if (jurisdiction) {
      params.push(jurisdiction);
      text += ` AND r.jurisdiction = $${params.length}`;
    }

    text += ` ORDER BY r.created_at DESC LIMIT 200`;

    const result = await query(text, params);
    return res.json({ success: true, count: result.rows.length, requests: result.rows });
  } catch (error) {
    console.error('[Admin List Requests Error]', error.message);
    return res.status(500).json({ success: false, error: 'Failed to retrieve review requests.' });
  }
};

module.exports = {
  getDashboardSummary,
  listFacilitators,
  createFacilitator,
  toggleFacilitatorStatus,
  resetFacilitatorPassword,
  listUsers,
  toggleUserStatus,
  listReviewRequests,
};
