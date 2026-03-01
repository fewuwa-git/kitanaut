/* eslint-disable @typescript-eslint/no-require-imports */
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
const envPath = path.resolve(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
            process.env[key.trim()] = valueParts.join('=').trim();
        }
    });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
});

async function seedAdmin() {
    console.log(`Connecting to Supabase at: ${supabaseUrl}`);

    try {
        const hashedPassword = await bcrypt.hash('password', 10);
        const adminUser = {
            id: uuidv4(),
            name: 'Felix Admin',
            email: 'admin@pankonauten.de',
            password: hashedPassword,
            role: 'admin',
            created_at: new Date().toISOString(),
        };

        console.log('Checking for existing admin...');
        const { data: existing, error: checkError } = await supabase
            .from('pankonauten_users')
            .select('id')
            .eq('email', adminUser.email)
            .single();

        if (checkError && checkError.code !== 'PGRST116') {
            // Let it fail if table doesn't exist
            console.error('Error checking user (Wait... did you run the SQL script in Supabase?):', checkError.message);
            return;
        }

        if (existing) {
            console.log('Admin user already exists. Updating password...');
            const { error: updateError } = await supabase
                .from('pankonauten_users')
                .update({ password: adminUser.password, name: adminUser.name })
                .eq('email', adminUser.email);

            if (updateError) {
                console.error('Failed to update admin:', updateError.message);
                return;
            }
        } else {
            console.log('Creating new admin user...');
            const { error: insertError } = await supabase
                .from('pankonauten_users')
                .insert(adminUser);

            if (insertError) {
                console.error('Failed to insert admin:', insertError.message);
                return;
            }
        }

        console.log('✅ Success! Admin user seeded (or updated) in Supabase.');
        console.log('Login credentials: admin@pankonauten.de / password');

    } catch (error) {
        console.error('Error seeding admin user:', error);
    }
}

seedAdmin();
