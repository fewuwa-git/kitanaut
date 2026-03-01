const { Client } = require('pg');

async function migrate() {
    const connectionString = "postgres://postgres:xwd7bex2kby!xdb!CTK@db.mvlnkqgitafkamsujymi.supabase.co:5432/postgres";

    console.log("Connecting to PostgreSQL...");
    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log("Connected. Altering table...");

        await client.query(`
            ALTER TABLE pankonauten_users
            ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
            ADD COLUMN IF NOT EXISTS adresse TEXT,
            ADD COLUMN IF NOT EXISTS iban TEXT,
            ADD COLUMN IF NOT EXISTS steuerid TEXT,
            ADD COLUMN IF NOT EXISTS handynummer TEXT,
            ADD COLUMN IF NOT EXISTS stundensatz NUMERIC;
        `);
        console.log("✅ Columns added successfully.");

        // Also update any existing users with status = null to 'active'
        await client.query(`UPDATE pankonauten_users SET status = 'active' WHERE status IS NULL;`);
        console.log("✅ Existing users updated with active status.");

    } catch (err) {
        console.error("Migration error:", err);
    } finally {
        await client.end();
        console.log("Closed.");
    }
}

migrate();
