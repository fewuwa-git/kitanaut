const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function applyAbrechnungenSchema() {
    const connectionString = "postgres://postgres:xwd7bex2kby!xdb!CTK@db.mvlnkqgitafkamsujymi.supabase.co:5432/postgres";

    console.log("Connecting to PostgreSQL...");
    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log("Connected successfully. Reading SQL file...");

        const sqlFilePath = path.join(__dirname, 'supabase_abrechnungen.sql');
        const sql = fs.readFileSync(sqlFilePath, 'utf8');

        console.log("Executing SQL...");
        await client.query(sql);

        console.log("✅ SQL script executed successfully.");

    } catch (err) {
        console.error("Error executing SQL script:", err);
    } finally {
        await client.end();
        console.log("Database connection closed.");
    }
}

applyAbrechnungenSchema();
