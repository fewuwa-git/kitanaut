import { supabase } from '@/lib/db';

const DEMO_ORG_ID = '00000000-0000-0000-0000-000000000002';
const DEMO_PASSWORD_HASH = '$2b$10$7JkiXqMZnUmpYxKKyjDHeeLj4uw4YY/RsspGs6RfB4DF3iwRJOus.';

const DEMO_USERS = [
    { id: 'd0000001-0000-0000-0000-000000000001', name: 'Max Mustermann', email: 'admin@demo.kitanaut.de', role: 'admin' },
    { id: 'd0000001-0000-0000-0000-000000000002', name: 'Anna Schmidt', email: 'finanzen@demo.kitanaut.de', role: 'finanzvorstand' },
    { id: 'd0000001-0000-0000-0000-000000000003', name: 'Thomas Weber', email: 'mitglied@demo.kitanaut.de', role: 'member' },
    { id: 'd0000001-0000-0000-0000-000000000004', name: 'Lisa Müller', email: 'eltern@demo.kitanaut.de', role: 'eltern' },
    { id: 'd0000001-0000-0000-0000-000000000005', name: 'Sarah Klein', email: 'springerin@demo.kitanaut.de', role: 'springerin' },
];

const DEMO_CATEGORIES = [
    { name: 'Demo: Mitgliedsbeiträge', color: '#22c55e', type: 'income' },
    { name: 'Demo: Fördergelder', color: '#3b82f6', type: 'income' },
    { name: 'Demo: Spenden', color: '#10b981', type: 'income' },
    { name: 'Demo: Lebensmittel', color: '#ef4444', type: 'expense' },
    { name: 'Demo: Spielzeug & Basteln', color: '#f59e0b', type: 'expense' },
    { name: 'Demo: Personalkosten', color: '#8b5cf6', type: 'expense' },
    { name: 'Demo: Miete & Betrieb', color: '#ec4899', type: 'expense' },
    { name: 'Demo: Sonstiges', color: '#6b7280', type: 'expense' },
];

const DEMO_TRANSACTIONS = [
    // Januar 2026
    { id: 't0000002-0000-0000-0000-000000000001', date: '2026-01-02', description: 'Mitgliedsbeiträge Januar', counterparty: 'Eltern', amount: 1200, category: 'Demo: Mitgliedsbeiträge', type: 'income', balance: 1200 },
    { id: 't0000002-0000-0000-0000-000000000002', date: '2026-01-05', description: 'Einkauf REWE', counterparty: 'REWE', amount: -180, category: 'Demo: Lebensmittel', type: 'expense', balance: 1020 },
    { id: 't0000002-0000-0000-0000-000000000003', date: '2026-01-08', description: 'Spielzeug JAKO-O', counterparty: 'JAKO-O', amount: -95, category: 'Demo: Spielzeug & Basteln', type: 'expense', balance: 925 },
    { id: 't0000002-0000-0000-0000-000000000004', date: '2026-01-10', description: 'Fördergelder Bezirksamt', counterparty: 'Bezirksamt Mitte', amount: 500, category: 'Demo: Fördergelder', type: 'income', balance: 1425 },
    { id: 't0000002-0000-0000-0000-000000000005', date: '2026-01-15', description: 'Miete Januar', counterparty: 'Hausverwaltung GmbH', amount: -650, category: 'Demo: Miete & Betrieb', type: 'expense', balance: 775 },
    { id: 't0000002-0000-0000-0000-000000000006', date: '2026-01-18', description: 'Spende Familie Bauer', counterparty: 'Familie Bauer', amount: 100, category: 'Demo: Spenden', type: 'income', balance: 875 },
    { id: 't0000002-0000-0000-0000-000000000007', date: '2026-01-20', description: 'Bastelmaterial Idee', counterparty: 'Idee GmbH', amount: -45, category: 'Demo: Spielzeug & Basteln', type: 'expense', balance: 830 },
    { id: 't0000002-0000-0000-0000-000000000008', date: '2026-01-31', description: 'Personalkosten Januar', counterparty: 'Lohnbüro', amount: -1800, category: 'Demo: Personalkosten', type: 'expense', balance: -970 },
    // Februar 2026
    { id: 't0000002-0000-0000-0000-000000000009', date: '2026-02-02', description: 'Mitgliedsbeiträge Februar', counterparty: 'Eltern', amount: 1200, category: 'Demo: Mitgliedsbeiträge', type: 'income', balance: 230 },
    { id: 't0000002-0000-0000-0000-000000000010', date: '2026-02-04', description: 'Einkauf Edeka', counterparty: 'Edeka', amount: -165, category: 'Demo: Lebensmittel', type: 'expense', balance: 65 },
    { id: 't0000002-0000-0000-0000-000000000011', date: '2026-02-07', description: 'Spielzeug Müller', counterparty: 'Müller Drogerie', amount: -120, category: 'Demo: Spielzeug & Basteln', type: 'expense', balance: -55 },
    { id: 't0000002-0000-0000-0000-000000000012', date: '2026-02-14', description: 'Miete Februar', counterparty: 'Hausverwaltung GmbH', amount: -650, category: 'Demo: Miete & Betrieb', type: 'expense', balance: -705 },
    { id: 't0000002-0000-0000-0000-000000000013', date: '2026-02-14', description: 'Spende Valentinstag-Aktion', counterparty: 'Anonym', amount: 250, category: 'Demo: Spenden', type: 'income', balance: -455 },
    { id: 't0000002-0000-0000-0000-000000000014', date: '2026-02-18', description: 'Strom & Gas Februar', counterparty: 'Stadtwerke', amount: -89, category: 'Demo: Miete & Betrieb', type: 'expense', balance: -544 },
    { id: 't0000002-0000-0000-0000-000000000015', date: '2026-02-28', description: 'Personalkosten Februar', counterparty: 'Lohnbüro', amount: -1800, category: 'Demo: Personalkosten', type: 'expense', balance: -2344 },
    // März 2026
    { id: 't0000002-0000-0000-0000-000000000016', date: '2026-03-03', description: 'Mitgliedsbeiträge März', counterparty: 'Eltern', amount: 1200, category: 'Demo: Mitgliedsbeiträge', type: 'income', balance: -1144 },
    { id: 't0000002-0000-0000-0000-000000000017', date: '2026-03-05', description: 'Einkauf REWE', counterparty: 'REWE', amount: -198, category: 'Demo: Lebensmittel', type: 'expense', balance: -1342 },
    { id: 't0000002-0000-0000-0000-000000000018', date: '2026-03-07', description: 'Fördergelder Senat', counterparty: 'Senatsverwaltung', amount: 300, category: 'Demo: Fördergelder', type: 'income', balance: -1042 },
    { id: 't0000002-0000-0000-0000-000000000019', date: '2026-03-10', description: 'Spielzeug Frühling', counterparty: 'Toys R Us', amount: -67, category: 'Demo: Spielzeug & Basteln', type: 'expense', balance: -1109 },
    { id: 't0000002-0000-0000-0000-000000000020', date: '2026-03-14', description: 'Miete März', counterparty: 'Hausverwaltung GmbH', amount: -650, category: 'Demo: Miete & Betrieb', type: 'expense', balance: -1759 },
    { id: 't0000002-0000-0000-0000-000000000021', date: '2026-03-15', description: 'Personalkosten März', counterparty: 'Lohnbüro', amount: -1800, category: 'Demo: Personalkosten', type: 'expense', balance: -3559 },
    { id: 't0000002-0000-0000-0000-000000000022', date: '2026-03-17', description: 'Bastelmaterial Ostern', counterparty: 'Idee GmbH', amount: -38, category: 'Demo: Spielzeug & Basteln', type: 'expense', balance: -3597 },
    { id: 't0000002-0000-0000-0000-000000000023', date: '2026-03-20', description: 'Spende Familie Weber', counterparty: 'Familie Weber', amount: 75, category: 'Demo: Spenden', type: 'income', balance: -3522 },
];

const SPRINGERIN_USER_ID = 'd0000001-0000-0000-0000-000000000005';

const DEMO_ABRECHNUNGEN = [
    {
        id: 'a0000002-0000-0000-0000-000000000001',
        user_id: SPRINGERIN_USER_ID,
        jahr: 2026,
        monat: 1,
        status: 'bezahlt',
        organization_id: DEMO_ORG_ID,
        tage: [
            { id: 'at000002-0000-0000-0000-000000000001', datum: '2026-01-06', von: '08:00', bis: '11:00', stunden: 3, stundensatz: 12, betrag: 36 },
            { id: 'at000002-0000-0000-0000-000000000002', datum: '2026-01-08', von: '09:00', bis: '12:00', stunden: 3, stundensatz: 12, betrag: 36 },
            { id: 'at000002-0000-0000-0000-000000000003', datum: '2026-01-13', von: '08:30', bis: '11:30', stunden: 3, stundensatz: 12, betrag: 36 },
            { id: 'at000002-0000-0000-0000-000000000004', datum: '2026-01-20', von: '09:00', bis: '12:00', stunden: 3, stundensatz: 12, betrag: 36 },
        ],
    },
    {
        id: 'a0000002-0000-0000-0000-000000000002',
        user_id: SPRINGERIN_USER_ID,
        jahr: 2026,
        monat: 2,
        status: 'eingereicht',
        organization_id: DEMO_ORG_ID,
        tage: [
            { id: 'at000002-0000-0000-0000-000000000005', datum: '2026-02-03', von: '08:00', bis: '11:00', stunden: 3, stundensatz: 12, betrag: 36 },
            { id: 'at000002-0000-0000-0000-000000000006', datum: '2026-02-10', von: '09:00', bis: '12:00', stunden: 3, stundensatz: 12, betrag: 36 },
            { id: 'at000002-0000-0000-0000-000000000007', datum: '2026-02-17', von: '08:30', bis: '12:00', stunden: 3.5, stundensatz: 12, betrag: 42 },
            { id: 'at000002-0000-0000-0000-000000000008', datum: '2026-02-24', von: '09:00', bis: '12:30', stunden: 3.5, stundensatz: 12, betrag: 42 },
            { id: 'at000002-0000-0000-0000-000000000009', datum: '2026-02-26', von: '08:00', bis: '10:00', stunden: 2, stundensatz: 12, betrag: 24 },
        ],
    },
];

const DEMO_EMAIL_TEMPLATES = [
    {
        id: 'abrechnung_bezahlt',
        name: 'Abrechnung bezahlt - Springerin',
        subject: 'Deine Abrechnung für {{monat}} {{jahr}} wurde bezahlt',
        body: '<p>Liebe {{name}},</p>\n\n<p>wir freuen uns, dir mitteilen zu können, dass deine Abrechnung für <strong>{{monat}} {{jahr}}</strong> über <strong>{{betrag}} €</strong> erfolgreich geprüft und zur Zahlung freigegeben wurde. Der Betrag wird in den nächsten Tagen auf dein hinterlegtes Konto (<strong>{{iban}}</strong>) eingehen.</p>\n<p>Falls du noch keine Buchung siehst, warte bitte noch einige Werktage – Bankübertragungen können manchmal etwas Zeit in Anspruch nehmen. Bei Fragen kannst du dich jederzeit bei uns melden.</p>\n<p>Wir möchten uns herzlich bei dir bedanken – deine Arbeit und dein Engagement tragen jeden Tag dazu bei, dass unsere Kinder tolle Erfahrungen machen können. Das bedeutet uns wirklich viel, und wir sind dankbar, dich in unserem Team zu haben. Danke, dass du da bist und mit so viel Herzblut dabei bist!</p>\n<p>Liebe Grüße,<br>\nDas Kita Sonnenschein-Team</p>',
    },
    {
        id: 'invite',
        name: 'Einladung',
        subject: 'Einladung zum Kita Sonnenschein-Finanzportal',
        body: '<p>Hallo {{name}},</p><p>du wurdest zum Kita Sonnenschein-Finanzportal eingeladen.</p><p>Klicke auf den folgenden Link, um dein Passwort zu setzen und deinen Account zu aktivieren:</p><p><a href="{{url}}" style="background:#1a3a5c;color:#fff;padding:10px 20px;margin:20px; border-radius:6px;text-decoration:none;display:inline-block;">Einladung annehmen</a></p><p style="color:#666;font-size:13px;">Der Link ist 7 Tage gültig. Falls du diese E-Mail nicht erwartet hast, kannst du sie ignorieren.</p>',
    },
    {
        id: 'password_reset',
        name: 'Passwort zurücksetzen',
        subject: 'Passwort zurücksetzen – Kita Sonnenschein Finanzen',
        body: '<p>Hallo {{name}},</p><p>du hast eine Anfrage zum Zurücksetzen deines Passworts gestellt.</p><p>Klicke auf den folgenden Link, um ein neues Passwort zu setzen:</p><p><a href="{{url}}" style="background:#1a3a5c;color:#fff;padding:10px 20px; margin:20px;border-radius:6px;text-decoration:none;display:inline-block;">Passwort zurücksetzen</a></p><p style="color:#666;font-size:13px;">Der Link ist 1 Stunde gültig. Falls du diese Anfrage nicht gestellt hast, kannst du diese E-Mail ignorieren.</p>',
    },
    {
        id: 'approval',
        name: 'Account freigeschaltet',
        subject: 'Dein Account wurde freigeschaltet – Kita Sonnenschein Finanzen',
        body: '<p>Hallo {{name}},</p><p>dein Account im Kita Sonnenschein-Finanzportal wurde freigeschaltet. Du kannst dich jetzt einloggen:</p><p><a href="{{url}}" style="background:#1a3a5c;color:#fff;padding:10px 20px;margin:20px;border-radius:6px;text-decoration:none;display:inline-block;">Zum Login</a></p>',
    },
];

export async function resetDemoData(): Promise<void> {
    // Delete in FK-safe order
    await supabase.from('kitanaut_transaction_receipts').delete().eq('organization_id', DEMO_ORG_ID);
    await supabase.from('kitanaut_springerin_notes').delete().eq('organization_id', DEMO_ORG_ID);
    await supabase.from('kitanaut_abrechnung_tage').delete().in('abrechnung_id', ['a0000002-0000-0000-0000-000000000001', 'a0000002-0000-0000-0000-000000000002']);
    await supabase.from('kitanaut_abrechnungen').delete().eq('organization_id', DEMO_ORG_ID);
    await supabase.from('kitanaut_belege').delete().eq('organization_id', DEMO_ORG_ID);
    await supabase.from('kitanaut_transactions').delete().eq('organization_id', DEMO_ORG_ID);
    await supabase.from('kitanaut_category_rules').delete().eq('organization_id', DEMO_ORG_ID);
    await supabase.from('kitanaut_categories').delete().eq('organization_id', DEMO_ORG_ID);
    await supabase.from('kitanaut_email_templates').delete().eq('organization_id', DEMO_ORG_ID);
    await supabase.from('kitanaut_users').delete().eq('organization_id', DEMO_ORG_ID);

    // Insert users
    const { error: usersErr } = await supabase.from('kitanaut_users').insert(
        DEMO_USERS.map(u => ({
            ...u,
            password: DEMO_PASSWORD_HASH,
            organization_id: DEMO_ORG_ID,
            status: 'active',
            created_at: new Date().toISOString(),
        }))
    );
    if (usersErr) throw new Error('Users insert failed: ' + usersErr.message);

    // Insert categories
    const { error: catErr } = await supabase.from('kitanaut_categories').insert(
        DEMO_CATEGORIES.map(c => ({ ...c, organization_id: DEMO_ORG_ID }))
    );
    if (catErr) throw new Error('Categories insert failed: ' + catErr.message);

    // Insert transactions
    const { error: txErr } = await supabase.from('kitanaut_transactions').insert(
        DEMO_TRANSACTIONS.map(t => ({ ...t, organization_id: DEMO_ORG_ID }))
    );
    if (txErr) throw new Error('Transactions insert failed: ' + txErr.message);

    // Insert abrechnungen and tage
    for (const abrechnung of DEMO_ABRECHNUNGEN) {
        const { tage, ...abrechnungData } = abrechnung;
        const { error: aErr } = await supabase.from('kitanaut_abrechnungen').insert(abrechnungData);
        if (aErr) throw new Error('Abrechnung insert failed: ' + aErr.message);

        const { error: tErr } = await supabase.from('kitanaut_abrechnung_tage').insert(
            tage.map(t => ({ ...t, abrechnung_id: abrechnung.id }))
        );
        if (tErr) throw new Error('Abrechnung tage insert failed: ' + tErr.message);
    }

    // Insert email templates
    const { error: etErr } = await supabase.from('kitanaut_email_templates').upsert(
        DEMO_EMAIL_TEMPLATES.map(t => ({ ...t, organization_id: DEMO_ORG_ID })),
        { onConflict: 'id' }
    );
    if (etErr) throw new Error('Email templates insert failed: ' + etErr.message);
}
