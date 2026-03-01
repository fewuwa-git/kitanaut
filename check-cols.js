/* eslint-disable @typescript-eslint/no-require-imports */
const { Client } = require('pg');
async function run() {
    const client = new Client({ connectionString: 'postgres://postgres:xwd7bex2kby!xdb!CTK@db.mvlnkqgitafkamsujymi.supabase.co:5432/postgres', ssl: { rejectUnauthorized: false } });
    await client.connect();

    // Check columns of pankonauten_users
    try {
        const { rows } = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'pankonauten_users';");
        console.log("Columns in pankonauten_users:");
        console.log(rows.map(r => r.column_name));
    } catch (e) {
        console.error(e);
    }

    await client.end();
}
run();
