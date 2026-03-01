/* eslint-disable @typescript-eslint/no-require-imports */
const { Client } = require('pg');

async function createTables() {
    // Try the direct connection without pooler if the pooler one failed
    const connectionString = "postgres://postgres:xwd7bex2kby!xdb!CTK@db.mvlnkqgitafkamsujymi.supabase.co:5432/postgres";

    console.log("Connecting to PostgreSQL...");
    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log("Connected successfully. Creating tables...");

        await client.query(`
            CREATE TABLE IF NOT EXISTS pankonauten_users (
                id UUID PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'member',
                "createdAt" TEXT NOT NULL
            );
        `);
        console.log("✅ Table pankonauten_users checked/created.");

        await client.query(`
            CREATE TABLE IF NOT EXISTS pankonauten_transactions (
                id UUID PRIMARY KEY,
                date TEXT NOT NULL,
                description TEXT,
                counterparty TEXT,
                amount NUMERIC NOT NULL,
                category TEXT NOT NULL DEFAULT 'Sonstige',
                type TEXT NOT NULL,
                balance NUMERIC NOT NULL DEFAULT 0
            );
        `);
        console.log("✅ Table pankonauten_transactions checked/created.");

    } catch (err) {
        console.error("Error creating tables:", err);
    } finally {
        await client.end();
        console.log("Database connection closed.");
    }
}

createTables();
