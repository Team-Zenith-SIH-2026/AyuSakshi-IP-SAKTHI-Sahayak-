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
];

const ensureSchema = async () => {
  for (const update of SCHEMA_UPDATES) {
    try {
      await query(update.sql);
    } catch (err) {
      console.error(`[Schema] Could not apply "${update.name}": ${err.message}`);
    }
  }
};

module.exports = { ensureSchema };
