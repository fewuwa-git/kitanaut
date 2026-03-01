/* eslint-disable @typescript-eslint/no-require-imports */
const { Client } = require('pg');
async function run() {
    const client = new Client({ connectionString: 'postgres://postgres:xwd7bex2kby!xdb!CTK@db.mvlnkqgitafkamsujymi.supabase.co:5432/postgres', ssl: { rejectUnauthorized: false } });
    await client.connect();

    console.log("Dropping table...");
    await client.query('DROP TABLE IF EXISTS pankonauten_users CASCADE;');

    console.log("Creating table...");
    await client.query(`CREATE TABLE pankonauten_users (
        id UUID PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'member',
        created_at TEXT NOT NULL
    );`);

    console.log("Reloading schema cache...");
    await client.query("NOTIFY pgrst, 'reload schema';");

    await client.end();
    console.log("Done!");
}
run();
