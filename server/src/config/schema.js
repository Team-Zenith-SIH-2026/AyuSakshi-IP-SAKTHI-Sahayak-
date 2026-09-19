const { query } = require('./db');

/**
 * Brings an existing database up to the schema this server expects.
 *
 * database/init.sql only runs when the Postgres volume is first created, so a
 * teammate's existing database never sees later changes to it. Each statement
 * here is idempotent and mirrors a change made in init.sql.
 */
const SCHEMA_UPDATES = [
  {
    name: 'messages.clarification',
    // A follow-up question the assistant asked, with the options it offered.
    sql: `ALTER TABLE messages ADD COLUMN IF NOT EXISTS clarification JSONB DEFAULT NULL`,
  },
  {
    name: "messages.confidence_level allows 'clarifying' and 'conversation'",
    // Neither a follow-up question nor a conversational reply is an answer or a
    // refusal, and neither may be stored as one: 'abstained' would show it as
    // "not enough evidence", and a confidence level would claim a check that
    // never ran.
    sql: `
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'messages_confidence_level_check'
            AND pg_get_constraintdef(oid) LIKE '%clarifying%'
            AND pg_get_constraintdef(oid) LIKE '%conversation%'
        ) THEN
          ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_confidence_level_check;
          ALTER TABLE messages ADD CONSTRAINT messages_confidence_level_check
            CHECK (confidence_level IN ('high', 'medium', 'low', 'abstained', 'clarifying', 'conversation'));
        END IF;
      END $$`,
  },
  {
    name: "users.rbac_columns",
    sql: `
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
    `,
  },
  {
    name: "human_review_requests.assignment_columns",
    sql: `
      ALTER TABLE human_review_requests ADD COLUMN IF NOT EXISTS assigned_facilitator_id UUID REFERENCES users(id) ON DELETE SET NULL;
      ALTER TABLE human_review_requests ADD COLUMN IF NOT EXISTS assignment_status VARCHAR(50) DEFAULT 'PENDING_ASSIGNMENT';
      ALTER TABLE human_review_requests ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
    `,
  },
  {
    name: "human_review_requests.status_check",
    sql: `
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'human_review_requests_status_check'
            AND pg_get_constraintdef(oid) NOT LIKE '%ASSIGNED%'
        ) THEN
          ALTER TABLE human_review_requests DROP CONSTRAINT IF EXISTS human_review_requests_status_check;
          ALTER TABLE human_review_requests ADD CONSTRAINT human_review_requests_status_check
            CHECK (status IN ('PENDING', 'ASSIGNED', 'IN_REVIEW', 'RESOLVED', 'CLOSED'));
        END IF;
      END $$;
    `,
  },
  {
    name: "facilitator_round_robin_tracker",
    sql: `
      CREATE TABLE IF NOT EXISTS facilitator_round_robin_tracker (
        id INT PRIMARY KEY DEFAULT 1,
        last_assigned_facilitator_id UUID REFERENCES users(id) ON DELETE SET NULL,
        last_assigned_index INT DEFAULT -1,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO facilitator_round_robin_tracker (id, last_assigned_index)
      VALUES (1, -1)
      ON CONFLICT (id) DO NOTHING;
    `,
  },
];

const bcrypt = require('bcryptjs');

const ensureDefaultAdmin = async () => {
  try {
    const adminCheck = await query("SELECT id, must_change_password FROM users WHERE role = 'admin' LIMIT 1");
    if (adminCheck.rows.length === 0) {
      const email = (process.env.ADMIN_INITIAL_EMAIL || 'admin@ayusakshi.gov.in').trim().toLowerCase();
      const password = process.env.ADMIN_INITIAL_PASSWORD || 'Ayurveda@2026';
      const name = process.env.ADMIN_INITIAL_NAME || 'System Administrator';

      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(password, salt);

      await query(
        `INSERT INTO users (email, password_hash, name, role, is_active, must_change_password, auth_provider)
         VALUES ($1, $2, $3, 'admin', TRUE, TRUE, 'local')
         ON CONFLICT (email) DO UPDATE
         SET role = 'admin', is_active = TRUE, must_change_password = TRUE`,
        [email, hash, name]
      );
      console.log(`[Schema] Initial admin user initialized: ${email}`);
    }
  } catch (err) {
    console.error(`[Schema] Failed to ensure default admin: ${err.message}`);
  }
};

const ensureSchema = async () => {
  for (const update of SCHEMA_UPDATES) {
    try {
      await query(update.sql);
    } catch (err) {
      console.error(`[Schema] Could not apply "${update.name}": ${err.message}`);
    }
  }
  await ensureDefaultAdmin();
};

module.exports = { ensureSchema };
