/* eslint-disable @typescript-eslint/no-require-imports */
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function testConnection() {
    console.log('--- Testing Database Connection ---');

    // Load environment variables from .env.local
    const envPath = path.resolve(__dirname, '.env.local');
    if (fs.existsSync(envPath)) {
        console.log(`Loading environment from ${envPath}...`);
        const envContent = fs.readFileSync(envPath, 'utf8');
        envContent.split('\n').forEach(line => {
            const [key, ...valueParts] = line.split('=');
            if (key && valueParts.length > 0) {
                process.env[key.trim()] = valueParts.join('=').trim();
            }
        });
    } else {
        console.error('.env.local not found!');
        return;
    }

    const config = {
        host: process.env.DATABASE_HOST,
        port: Number(process.env.DATABASE_PORT) || 3306,
        database: process.env.DATABASE_NAME,
        user: process.env.DATABASE_USER,
        password: process.env.DATABASE_PASSWORD,
        connectTimeout: 5000,
    };

    console.log(`Host: ${config.host}`);
    console.log(`Port: ${config.port}`);
    console.log(`Database: ${config.database}`);
    console.log(`User: ${config.user}`);
    console.log('Connecting...');

    try {
        const pool = mysql.createPool(config);
        const start = Date.now();
        const [rows] = await pool.query('SELECT 1 as connected');
        const duration = Date.now() - start;
        console.log(`✅ Success! Connected in ${duration}ms.`);

        console.log('Checking for admin user...');
        const [users] = await pool.query('SELECT name, email, role FROM pankonauten_users WHERE email = ?', ['admin@pankonauten.de']);
        if (users.length > 0) {
            console.log(`✅ Admin user found: ${users[0].name} (${users[0].role})`);
        } else {
            console.warn('❌ Admin user admin@pankonauten.de NOT found in database.');
        }

        await pool.end();
    } catch (error) {
        console.error('\n❌ Connection Failed!');
        console.error('Error Code:', error.code);
        console.error('Error Message:', error.message);

        if (error.code === 'ECONNREFUSED') {
            console.log('\nPossible cause: The remote database port 3306 is not open to your IP address.');
            console.log('Suggestion: Ensure your SSH tunnel is running if required.');
        } else if (error.code === 'ETIMEDOUT') {
            console.log('\nPossible cause: Network timeout. The host might be unreachable or firewalled.');
        } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            console.log('\nPossible cause: Incorrect username or password in .env.local.');
        }
    }
}

testConnection();
