const { pool } = require('../config/db');

/**
 * Assigns the next active Human IP Facilitator sequentially in round-robin fashion.
 * Uses a PostgreSQL transaction and row-level locking (FOR UPDATE) to guarantee race-condition-free assignment.
 *
 * @returns {Promise<{ assigned_facilitator_id: string|null, assignment_status: string, assigned_at: Date|null }>}
 */
const assignNextFacilitator = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch all active facilitators ordered deterministically
    const facRes = await client.query(
      `SELECT id, name, email FROM users
       WHERE role = 'facilitator' AND is_active = TRUE
       ORDER BY created_at ASC, id ASC`
    );

    const facilitators = facRes.rows;

    if (facilitators.length === 0) {
      await client.query('COMMIT');
      return {
        assigned_facilitator_id: null,
        assignment_status: 'PENDING_ASSIGNMENT',
        assigned_at: null,
      };
    }

    // 2. Ensure tracker exists and lock it
    await client.query(
      `INSERT INTO facilitator_round_robin_tracker (id, last_assigned_index)
       VALUES (1, -1)
       ON CONFLICT (id) DO NOTHING`
    );

    const trackerRes = await client.query(
      `SELECT last_assigned_index, last_assigned_facilitator_id
       FROM facilitator_round_robin_tracker
       WHERE id = 1
       FOR UPDATE`
    );

    let nextIndex = 0;
    if (trackerRes.rows.length > 0) {
      const lastIndex = trackerRes.rows[0].last_assigned_index ?? -1;
      nextIndex = (lastIndex + 1) % facilitators.length;
    }

    const assignedFacilitator = facilitators[nextIndex];

    // 3. Update tracker atomically
    await client.query(
      `UPDATE facilitator_round_robin_tracker
       SET last_assigned_facilitator_id = $1, last_assigned_index = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = 1`,
      [assignedFacilitator.id, nextIndex]
    );

    await client.query('COMMIT');

    return {
      assigned_facilitator_id: assignedFacilitator.id,
      assigned_facilitator_name: assignedFacilitator.name,
      assignment_status: 'ASSIGNED',
      assigned_at: new Date(),
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[Round Robin Assignment Error]', error.message);
    return {
      assigned_facilitator_id: null,
      assignment_status: 'PENDING_ASSIGNMENT',
      assigned_at: null,
    };
  } finally {
    client.release();
  }
};

module.exports = {
  assignNextFacilitator,
};
