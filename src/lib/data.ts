import { supabase } from './db';
import { type CategoryRule, applyRules } from './categoryMatcher';
export type { CategoryRule };

// ─── Organizations ─────────────────────────────────────────────────────────────

export interface Organization {
    id: string;
    name: string;
    slug: string;
    from_email: string | null;
    created_at: string;
}

export async function getOrgBySlug(slug: string): Promise<Organization | null> {
    const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('slug', slug)
        .single();
    if (error) return null;
    return data;
}

export async function getOrgById(id: string): Promise<Organization | null> {
    const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', id)
        .single();
    if (error) return null;
    return data;
}

export async function createOrganization(name: string, slug: string): Promise<Organization> {
    const { data, error } = await supabase
        .from('organizations')
        .insert({ name, slug })
        .select()
        .single();
    if (error) throw new Error('Failed to create organization: ' + error.message);
    return data;
}

export async function getAllOrganizations(): Promise<Organization[]> {
    const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .order('name', { ascending: true });
    if (error) return [];
    return data || [];
}

export interface Category {
    name: string;
    color: string;
    type: 'income' | 'expense' | 'both';
}

export interface User {
    id: string;
    name: string;
    email: string;
    password: string;
    role: 'admin' | 'finanzvorstand' | 'member' | 'eltern' | 'springerin' | 'teammitglied';
    status?: string;
    strasse?: string;
    ort?: string;
    iban?: string;
    steuerid?: string;
    handynummer?: string;
    stundensatz?: number;
    unterschrift?: string;
    created_at: string;
    last_login_at?: string | null;
    invite_token?: string | null;
    invite_expires_at?: string | null;
}

export interface Transaction {
    id: string;
    date: string;
    description: string;
    counterparty: string;
    amount: number;
    category: string;
    type: 'income' | 'expense';
    balance: number;
}

export interface Abrechnung {
    id: string;
    user_id: string;
    jahr: number;
    monat: number;
    status: string;
    created_at?: string;
    updated_at?: string;
}

export interface AbrechnungTag {
    id: string;
    abrechnung_id: string;
    datum: string;
    von: string;
    bis: string;
    stunden: number;
    stundensatz: number;
    betrag: number;
    created_at?: string;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function getUsers(orgId: string): Promise<User[]> {
    const { data, error } = await supabase
        .from('pankonauten_users')
        .select('*')
        .eq('organization_id', orgId);
    if (error) {
        console.error('Error fetching users:', error);
        return [];
    }
    return data || [];
}

export async function getSpringerinUsers(orgId: string): Promise<User[]> {
    const { data, error } = await supabase
        .from('pankonauten_users')
        .select('*')
        .eq('organization_id', orgId)
        .eq('role', 'springerin')
        .order('name', { ascending: true });
    if (error) {
        console.error('Error fetching springerin users:', error);
        return [];
    }
    return data || [];
}

export async function getUserById(id: string, orgId: string): Promise<User | undefined> {
    const { data, error } = await supabase
        .from('pankonauten_users')
        .select('*')
        .eq('id', id)
        .eq('organization_id', orgId)
        .single();
    if (error && error.code !== 'PGRST116') {
        console.error('Error fetching user by ID:', error);
    }
    return data || undefined;
}

export async function getUserByEmail(email: string, orgId: string): Promise<User | undefined> {
    const { data, error } = await supabase
        .from('pankonauten_users')
        .select('*')
        .ilike('email', email)
        .eq('organization_id', orgId)
        .single();
    if (error && error.code !== 'PGRST116') {
        console.error('Error fetching user by email:', error);
    }
    return data || undefined;
}

export async function getUserByInviteToken(token: string): Promise<User | undefined> {
    const { data, error } = await supabase
        .from('pankonauten_users')
        .select('*')
        .eq('invite_token', token)
        .single();
    if (error && error.code !== 'PGRST116') {
        console.error('Error fetching user by invite token:', error);
    }
    return data || undefined;
}

export async function saveUser(user: User & { organization_id: string }): Promise<void> {
    const { error } = await supabase
        .from('pankonauten_users')
        .upsert(
            {
                id: user.id,
                organization_id: user.organization_id,
                name: user.name,
                email: user.email,
                password: user.password,
                role: user.role,
                status: user.status || 'active',
                strasse: user.strasse,
                ort: user.ort,
                iban: user.iban,
                steuerid: user.steuerid,
                handynummer: user.handynummer,
                stundensatz: user.stundensatz,
                unterschrift: user.unterschrift,
                created_at: user.created_at,
                ...(user.last_login_at !== undefined && { last_login_at: user.last_login_at }),
                ...(user.invite_token !== undefined && { invite_token: user.invite_token }),
                ...(user.invite_expires_at !== undefined && { invite_expires_at: user.invite_expires_at }),
            },
            { onConflict: 'id' }
        );
    if (error) {
        throw new Error('Could not save user: ' + error.message);
    }
}

export async function deleteUser(id: string, orgId: string): Promise<void> {
    const { error } = await supabase
        .from('pankonauten_users')
        .delete()
        .eq('id', id)
        .eq('organization_id', orgId);
    if (error) {
        throw new Error('Could not delete user: ' + error.message);
    }
}

export async function updateUserLastLogin(id: string, timestamp: string): Promise<void> {
    const { error } = await supabase
        .from('pankonauten_users')
        .update({ last_login_at: timestamp })
        .eq('id', id);
    if (error) {
        throw new Error('Could not update last_login_at: ' + error.message);
    }
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export async function getTransactions(orgId: string): Promise<Transaction[]> {
    const all: Transaction[] = [];
    const batchSize = 1000;
    let from = 0;

    while (true) {
        const { data, error } = await supabase
            .from('pankonauten_transactions')
            .select('*')
            .eq('organization_id', orgId)
            .order('date', { ascending: true })
            .range(from, from + batchSize - 1);

        if (error) {
            console.error("Database error in getTransactions:", error);
            return [];
        }

        all.push(...(data || []));
        if (!data || data.length < batchSize) break;
        from += batchSize;
    }

    const data = all;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data || []).map((t: any) => ({
        ...t,
        amount: Number(t.amount),
        balance: Number(t.balance),
    }));
}

export async function saveTransactions(transactions: Transaction[], orgId: string): Promise<void> {
    // Delete all for this org
    const { error: delErr } = await supabase
        .from('pankonauten_transactions')
        .delete()
        .eq('organization_id', orgId);
    if (delErr) {
        throw new Error('Failed to clear transactions: ' + delErr.message);
    }

    if (transactions.length === 0) return;

    // chunk inserts (Supabase has limits on insert sizes)
    const chunkSize = 1000;
    for (let i = 0; i < transactions.length; i += chunkSize) {
        const chunk = transactions.slice(i, i + chunkSize).map(t => ({ ...t, organization_id: orgId }));
        const { error: insErr } = await supabase.from('pankonauten_transactions').insert(chunk);
        if (insErr) {
            throw new Error('Failed to insert transactions: ' + insErr.message);
        }
    }
}

export async function addTransactions(newTransactions: Transaction[], orgId: string): Promise<number> {
    const existing = await getTransactions(orgId);

    const sig = (tx: Transaction) => `${tx.date}_${tx.amount}_${tx.description}_${tx.counterparty}`;

    // Count how many times each signature appears in existing data
    const existingCounts = new Map<string, number>();
    for (const tx of existing) {
        const s = sig(tx);
        existingCounts.set(s, (existingCounts.get(s) || 0) + 1);
    }

    // Allow a new transaction through only if we've seen more copies in the new batch than already exist
    const newCounts = new Map<string, number>();
    const uniqueNewTransactions = newTransactions.filter(tx => {
        const s = sig(tx);
        const seen = (newCounts.get(s) || 0) + 1;
        newCounts.set(s, seen);
        return seen > (existingCounts.get(s) || 0);
    });

    if (uniqueNewTransactions.length === 0) {
        return 0;
    }

    const all = [...existing, ...uniqueNewTransactions];
    all.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Only recalculate balance if new transactions don't provide one from CSV
    const hasProvidedBalance = uniqueNewTransactions.some(tx => tx.balance !== 0);
    if (!hasProvidedBalance) {
        let balance = 0;
        for (const tx of all) {
            balance += tx.amount;
            tx.balance = Math.round(balance * 100) / 100;
        }
    }

    await saveTransactions(all, orgId);

    return uniqueNewTransactions.length;
}
export async function getTransactionsByCounterparty(name: string, orgId: string): Promise<Transaction[]> {
    const { data, error } = await supabase
        .from('pankonauten_transactions')
        .select('*')
        .eq('organization_id', orgId)
        .order('date', { ascending: true });

    if (error) {
        console.error('Database error in getTransactionsByCounterparty:', error);
        return [];
    }

    // Normalize whitespace and filter in JS for reliable Unicode handling (ß, ö, ü, etc.)
    const nameLower = name.trim().replace(/\s+/g, ' ').toLowerCase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data || [])
        .filter((t: any) =>
            (t.counterparty ?? '').trim().replace(/\s+/g, ' ').toLowerCase().includes(nameLower) ||
            (t.description ?? '').trim().replace(/\s+/g, ' ').toLowerCase().includes(nameLower)
        )
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((t: any) => ({
            ...t,
            amount: Number(t.amount),
            balance: Number(t.balance),
        }));
}

export async function updateTransactionCategory(id: string, category: string, orgId: string): Promise<void> {
    const { error } = await supabase
        .from('pankonauten_transactions')
        .update({ category })
        .eq('id', id)
        .eq('organization_id', orgId);

    if (error) {
        throw new Error('Failed to update transaction category: ' + error.message);
    }
}

// ─── Categories ───────────────────────────────────────────────────────────────

export async function getCategories(orgId: string): Promise<Category[]> {
    const { data, error } = await supabase
        .from('pankonauten_categories')
        .select('*')
        .eq('organization_id', orgId)
        .order('type', { ascending: true })
        .order('name', { ascending: true });
    if (error) {
        console.error('Error fetching categories:', error);
        return [];
    }
    return data || [];
}

export async function createCategory(category: Category, orgId: string): Promise<void> {
    const { error } = await supabase
        .from('pankonauten_categories')
        .insert({ name: category.name, color: category.color, type: category.type, organization_id: orgId });
    if (error) {
        throw new Error('Failed to create category: ' + error.message);
    }
}

export async function updateCategory(oldName: string, category: Category, orgId: string): Promise<void> {
    // If name changed, update all transactions first, then update category
    if (oldName !== category.name) {
        const { error: txErr } = await supabase
            .from('pankonauten_transactions')
            .update({ category: category.name })
            .eq('category', oldName)
            .eq('organization_id', orgId);
        if (txErr) {
            throw new Error('Failed to rename category in transactions: ' + txErr.message);
        }
        // Delete old, insert new (Supabase: primary key can't be updated directly)
        const { error: delErr } = await supabase
            .from('pankonauten_categories')
            .delete()
            .eq('name', oldName)
            .eq('organization_id', orgId);
        if (delErr) throw new Error('Failed to delete old category: ' + delErr.message);
        const { error: insErr } = await supabase
            .from('pankonauten_categories')
            .insert({ name: category.name, color: category.color, type: category.type, organization_id: orgId });
        if (insErr) throw new Error('Failed to insert renamed category: ' + insErr.message);
    } else {
        const { error } = await supabase
            .from('pankonauten_categories')
            .update({ color: category.color, type: category.type })
            .eq('name', oldName)
            .eq('organization_id', orgId);
        if (error) {
            throw new Error('Failed to update category: ' + error.message);
        }
    }
}

export async function deleteCategory(name: string, orgId: string): Promise<void> {
    // Check if any transactions use this category
    const { count, error: countErr } = await supabase
        .from('pankonauten_transactions')
        .select('id', { count: 'exact', head: true })
        .eq('category', name)
        .eq('organization_id', orgId);
    if (countErr) throw new Error('Failed to check transactions: ' + countErr.message);
    if (count && count > 0) {
        throw new Error(`Kategorie "${name}" wird von ${count} Buchung(en) verwendet und kann nicht gelöscht werden.`);
    }
    const { error } = await supabase
        .from('pankonauten_categories')
        .delete()
        .eq('name', name)
        .eq('organization_id', orgId);
    if (error) {
        throw new Error('Failed to delete category: ' + error.message);
    }
}

// ─── Abrechnungen ────────────────────────────────────────────────────────────

export async function getAbrechnung(userId: string, jahr: number, monat: number, orgId: string): Promise<{ abrechnung: Abrechnung | null, tage: AbrechnungTag[] }> {
    const { data: abrechnung, error: abErr } = await supabase
        .from('pankonauten_abrechnungen')
        .select('*')
        .eq('user_id', userId)
        .eq('jahr', jahr)
        .eq('monat', monat)
        .eq('organization_id', orgId)
        .single();

    if (abErr && abErr.code !== 'PGRST116') {
        console.error('Error fetching abrechnung:', abErr);
        return { abrechnung: null, tage: [] };
    }

    if (!abrechnung) return { abrechnung: null, tage: [] };

    const { data: tage, error: tageErr } = await supabase
        .from('pankonauten_abrechnung_tage')
        .select('*')
        .eq('abrechnung_id', abrechnung.id)
        .order('datum', { ascending: true });

    if (tageErr) {
        console.error('Error fetching abrechnung tage:', tageErr);
    }

    return { abrechnung, tage: tage || [] };
}

export async function saveAbrechnung(ab: Partial<Abrechnung>, orgId: string): Promise<Abrechnung> {
    const payload = { ...ab, organization_id: orgId, updated_at: new Date().toISOString() };
    const { data, error } = await supabase
        .from('pankonauten_abrechnungen')
        .upsert(payload, { onConflict: 'organization_id, user_id, jahr, monat' })
        .select()
        .single();

    if (error) throw new Error('Failed to save abrechnung: ' + error.message);
    return data;
}

export async function updateAbrechnungStatus(id: string, status: string): Promise<Abrechnung> {
    const { data, error } = await supabase
        .from('pankonauten_abrechnungen')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

    if (error) throw new Error('Failed to update abrechnung status: ' + error.message);
    return data;
}

export async function saveAbrechnungTag(tag: Partial<AbrechnungTag>): Promise<AbrechnungTag> {
    const { data, error } = await supabase
        .from('pankonauten_abrechnung_tage')
        .upsert(tag, { onConflict: 'abrechnung_id, datum' })
        .select()
        .single();

    if (error) throw new Error('Failed to save abrechnung tag: ' + error.message);
    return data;
}

export async function getAbrechnungTagOwner(tagId: string): Promise<string | null> {
    const { data } = await supabase
        .from('pankonauten_abrechnung_tage')
        .select('pankonauten_abrechnungen(user_id)')
        .eq('id', tagId)
        .single();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data as any)?.pankonauten_abrechnungen?.user_id ?? null;
}

export async function deleteAbrechnungTag(tagId: string): Promise<void> {
    const { error } = await supabase
        .from('pankonauten_abrechnung_tage')
        .delete()
        .eq('id', tagId);

    if (error) throw new Error('Failed to delete abrechnung tag: ' + error.message);
}

export async function deleteAbrechnung(id: string): Promise<void> {
    const { error } = await supabase
        .from('pankonauten_abrechnungen')
        .delete()
        .eq('id', id);

    if (error) throw new Error('Failed to delete abrechnung: ' + error.message);
}

export async function getAllAbrechnungen(orgId: string, userId?: string): Promise<any[]> {
    let query = supabase
        .from('pankonauten_abrechnungen')
        .select(`
            *,
            pankonauten_users (id, name, email, strasse, ort, iban, steuerid, unterschrift),
            pankonauten_abrechnung_tage (*)
        `)
        .eq('organization_id', orgId);

    if (userId) {
        query = query.eq('user_id', userId);
    }

    const { data: abrechnungen, error: abErr } = await query
        .order('jahr', { ascending: false })
        .order('monat', { ascending: false });

    if (abErr) {
        console.error('Error fetching all abrechnungen:', abErr);
        return [];
    }

    return (abrechnungen || []).map(ab => {
        const tage = ab.pankonauten_abrechnung_tage || [];
        const totalStunden = tage.reduce((sum: number, t: any) => sum + Number(t.stunden), 0);
        const totalBetrag = tage.reduce((sum: number, t: any) => sum + Number(t.betrag), 0);

        return {
            ...ab,
            totalStunden,
            totalBetrag
        };
    });
}

export async function recalculateAbrechnungRates(userId: string, jahr: number, monat: number, orgId: string): Promise<void> {
    const user = await getUserById(userId, orgId);
    if (!user || user.stundensatz == null || user.stundensatz === 0) {
        throw new Error('Kein Stundensatz im Profil hinterlegt.');
    }

    const { tage } = await getAbrechnung(userId, jahr, monat, orgId);
    if (!tage || tage.length === 0) return;

    for (const tag of tage) {
        const newBetrag = Math.round((tag.stunden * user.stundensatz) * 100) / 100;
        await saveAbrechnungTag({
            ...tag,
            stundensatz: user.stundensatz,
            betrag: newBetrag
        });
    }
}

// ─── Belege ──────────────────────────────────────────────────────────────────

export interface Beleg {
    id: string;
    user_id: string;
    titel: string;
    beschreibung?: string;
    netto: number;
    mwst_satz: number;
    betrag: number; // brutto
    belegnummer?: string;
    datum: string;
    status: 'entwurf' | 'eingereicht' | 'bezahlt' | 'abgelehnt';
    created_at?: string;
    updated_at?: string;
    pankonauten_users?: { id: string; name: string; email: string; strasse?: string; ort?: string; unterschrift?: string };
}

export async function getNextBelegnummer(orgId: string): Promise<string> {
    const year = new Date().getFullYear();
    const { data } = await supabase
        .from('pankonauten_belege')
        .select('belegnummer')
        .eq('organization_id', orgId)
        .like('belegnummer', `BEL-${year}-%`);
    const max = (data || []).reduce((acc: number, b: any) => {
        const n = parseInt((b.belegnummer || '').split('-')[2] || '0');
        return n > acc ? n : acc;
    }, 0);
    return `BEL-${year}-${String(max + 1).padStart(3, '0')}`;
}

export async function getBelegById(id: string, orgId: string): Promise<Beleg | null> {
    const { data, error } = await supabase
        .from('pankonauten_belege')
        .select('*, pankonauten_users(id, name, email, strasse, ort, unterschrift)')
        .eq('id', id)
        .eq('organization_id', orgId)
        .single();
    if (error || !data) return null;
    return { ...data, netto: Number(data.netto), betrag: Number(data.betrag) };
}

export async function getBelege(orgId: string, userId?: string): Promise<Beleg[]> {
    let query = supabase
        .from('pankonauten_belege')
        .select('*, pankonauten_users(id, name, email, strasse, ort, unterschrift)')
        .eq('organization_id', orgId)
        .order('datum', { ascending: false });
    if (userId) query = query.eq('user_id', userId);
    const { data, error } = await query;
    if (error) { console.error('Error fetching belege:', error); return []; }
    return (data || []).map((b: any) => ({ ...b, netto: Number(b.netto), betrag: Number(b.betrag) }));
}

export async function saveBeleg(beleg: Partial<Beleg>, orgId: string): Promise<Beleg> {
    // Strip the join field – it's not a column in the table
    const { pankonauten_users: _, ...rest } = beleg as any;
    const payload = { ...rest, organization_id: orgId, updated_at: new Date().toISOString() };
    const { data, error } = await supabase
        .from('pankonauten_belege')
        .upsert(payload, { onConflict: 'id' })
        .select()
        .single();
    if (error) throw new Error('Failed to save Beleg: ' + error.message);
    return data;
}

export async function deleteBeleg(id: string): Promise<void> {
    const { error } = await supabase.from('pankonauten_belege').delete().eq('id', id);
    if (error) throw new Error('Failed to delete Beleg: ' + error.message);
}

// Seeds categories and email templates for a new org, copying from the source org
// and replacing orgName occurrences in template bodies/subjects
export async function seedNewOrg(newOrgId: string, newOrgName: string): Promise<void> {
    const SOURCE_ORG_ID = '00000000-0000-0000-0000-000000000001';

    // Copy categories
    const { data: cats } = await supabase
        .from('pankonauten_categories')
        .select('name, color, type')
        .eq('organization_id', SOURCE_ORG_ID);

    if (cats && cats.length > 0) {
        await supabase.from('pankonauten_categories').insert(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            cats.map((c: any) => ({ ...c, organization_id: newOrgId }))
        );
    }

    // Copy email templates, replacing "Pankonauten" with new kita name
    const { data: templates } = await supabase
        .from('pankonauten_email_templates')
        .select('id, name, subject, body')
        .eq('organization_id', SOURCE_ORG_ID);

    if (templates && templates.length > 0) {
        await supabase.from('pankonauten_email_templates').insert(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            templates.map((t: any) => ({
                id: t.id,
                name: t.name,
                subject: t.subject.replaceAll('Pankonauten', newOrgName),
                body: t.body.replaceAll('Pankonauten', newOrgName),
                organization_id: newOrgId,
            }))
        );
    }
}

// ─── Springerin Notes ─────────────────────────────────────────────────────────

export interface SpringerinNote {
    id: string;
    jahr: number;
    monat: number;
    content: string;
    author_name: string;
    created_at?: string;
}

export async function getSpringerinNotes(orgId: string, jahr?: number, monat?: number): Promise<SpringerinNote[]> {
    let query = supabase.from('pankonauten_springerin_notes').select('*').eq('organization_id', orgId);
    if (jahr) query = query.eq('jahr', jahr);
    if (monat) query = query.eq('monat', monat);

    const { data, error } = await query;
    if (error) {
        console.error('Error fetching springerin notes:', error.message, error.code);
        return [];
    }
    return data || [];
}

export async function saveSpringerinNote(note: Omit<SpringerinNote, 'id' | 'created_at'>, orgId: string): Promise<SpringerinNote | null> {
    const { data, error } = await supabase
        .from('pankonauten_springerin_notes')
        .upsert({ ...note, organization_id: orgId }, { onConflict: 'organization_id, jahr, monat' })
        .select()
        .single();

    if (error) {
        console.error('Error saving springerin note:', error.message, error.code);
        return null;
    }
    return data;
}

// ─── Email Templates ──────────────────────────────────────────────────────────

export interface EmailTemplate {
    id: string;
    name: string;
    subject: string;
    body: string;
    updated_at?: string;
}

export async function getEmailTemplates(orgId: string): Promise<EmailTemplate[]> {
    const { data, error } = await supabase
        .from('pankonauten_email_templates')
        .select('*')
        .eq('organization_id', orgId)
        .order('id');
    if (error) { console.error('Error fetching email templates:', error); return []; }
    return data || [];
}

export async function getEmailTemplate(id: string, orgId: string): Promise<EmailTemplate | null> {
    const { data, error } = await supabase
        .from('pankonauten_email_templates')
        .select('*')
        .eq('id', id)
        .eq('organization_id', orgId)
        .single();
    if (error) { console.error('Error fetching email template:', error); return null; }
    return data;
}

export async function saveEmailTemplate(id: string, subject: string, body: string, orgId: string, name?: string): Promise<void> {
    const payload: Record<string, string> = { subject, body, updated_at: new Date().toISOString() };
    if (name) payload.name = name;
    const { error } = await supabase
        .from('pankonauten_email_templates')
        .update(payload)
        .eq('id', id)
        .eq('organization_id', orgId);
    if (error) throw new Error('Failed to save email template: ' + error.message);
}

// ─── Category Rules ───────────────────────────────────────────────────────────

export async function getCategoryRules(orgId: string): Promise<CategoryRule[]> {
    const { data, error } = await supabase
        .from('pankonauten_category_rules')
        .select('*')
        .eq('organization_id', orgId)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true });
    if (error) { console.error('Error fetching category rules:', error); return []; }
    return data || [];
}

export async function createCategoryRule(rule: Omit<CategoryRule, 'id' | 'created_at'>, orgId: string): Promise<CategoryRule> {
    const { data, error } = await supabase
        .from('pankonauten_category_rules')
        .insert({ ...rule, organization_id: orgId })
        .select()
        .single();
    if (error) throw new Error('Failed to create category rule: ' + error.message);
    return data;
}

export async function updateCategoryRule(id: string, updates: Partial<Omit<CategoryRule, 'id' | 'created_at'>>): Promise<void> {
    const { error } = await supabase
        .from('pankonauten_category_rules')
        .update(updates)
        .eq('id', id);
    if (error) throw new Error('Failed to update category rule: ' + error.message);
}

export async function deleteCategoryRule(id: string): Promise<void> {
    const { error } = await supabase
        .from('pankonauten_category_rules')
        .delete()
        .eq('id', id);
    if (error) throw new Error('Failed to delete category rule: ' + error.message);
}

export async function applyRulesToTransactions(overwrite: boolean, orgId: string): Promise<{ updated: number; skipped: number }> {
    const [rules, transactions] = await Promise.all([getCategoryRules(orgId), getTransactions(orgId)]);

    const updates: { id: string; category: string }[] = [];
    let skipped = 0;

    for (const tx of transactions) {
        if (!overwrite && tx.category !== 'Nicht kategorisiert') {
            skipped++;
            continue;
        }
        const newCategory = applyRules(rules, tx.description, tx.counterparty);
        if (newCategory !== tx.category) {
            updates.push({ id: tx.id, category: newCategory });
        } else {
            skipped++;
        }
    }

    if (updates.length > 0) {
        // Group by category for efficient bulk updates
        const byCategory = new Map<string, string[]>();
        for (const { id, category } of updates) {
            if (!byCategory.has(category)) byCategory.set(category, []);
            byCategory.get(category)!.push(id);
        }
        for (const [category, ids] of byCategory) {
            const { error } = await supabase
                .from('pankonauten_transactions')
                .update({ category })
                .in('id', ids)
                .eq('organization_id', orgId);
            if (error) throw new Error('Failed to batch update categories: ' + error.message);
        }
    }

    return { updated: updates.length, skipped };
}

// ─── Transaction Receipts ─────────────────────────────────────────────────────

export async function getTransactionIdsWithReceipts(orgId: string): Promise<string[]> {
    const { data, error } = await supabase
        .from('pankonauten_transaction_receipts')
        .select('transaction_id')
        .eq('organization_id', orgId);
    if (error) { console.error('Error fetching receipt ids:', error); return []; }
    return [...new Set((data || []).map((r: { transaction_id: string }) => r.transaction_id))];
}

export interface TransactionReceipt {
    id: string;
    transaction_id: string;
    file_path: string;
    file_name: string;
    file_size: number | null;
    uploaded_at: string;
    linked_method: 'manual' | 'ki' | null;
    linked_at: string | null;
    linked_by: string | null;
    ai_vendor: string | null;
    ai_amount: number | null;
    ai_date: string | null;
    ai_description: string | null;
    ai_invoice_number: string | null;
    transaction_date: string;
    transaction_description: string;
    transaction_counterparty: string;
    transaction_amount: number;
    transaction_category: string;
}

export async function getAllTransactionReceipts(orgId: string): Promise<TransactionReceipt[]> {
    const { data: receipts, error } = await supabase
        .from('pankonauten_transaction_receipts')
        .select('*')
        .eq('organization_id', orgId)
        .not('transaction_id', 'is', null)
        .order('uploaded_at', { ascending: false });
    if (error) { console.error('Error fetching all receipts:', error); return []; }
    if (!receipts || receipts.length === 0) return [];

    const txIds = [...new Set(receipts.map((r: any) => r.transaction_id))];
    const { data: txs } = await supabase
        .from('pankonauten_transactions')
        .select('id, date, description, counterparty, amount, category')
        .eq('organization_id', orgId)
        .in('id', txIds);

    const txMap = new Map((txs || []).map((t: any) => [t.id, t]));

    return receipts.map((r: any) => {
        const tx = txMap.get(r.transaction_id) as any;
        return {
            ...r,
            transaction_date: tx?.date ?? '',
            transaction_description: tx?.description ?? '',
            transaction_counterparty: tx?.counterparty ?? '',
            transaction_amount: tx ? Number(tx.amount) : 0,
            transaction_category: tx?.category ?? '',
        };
    }).sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));
}

export async function getUnlinkedReceipts(orgId: string): Promise<Omit<TransactionReceipt, 'transaction_date' | 'transaction_description' | 'transaction_counterparty' | 'transaction_amount' | 'transaction_category'>[]> {
    const { data, error } = await supabase
        .from('pankonauten_transaction_receipts')
        .select('*')
        .eq('organization_id', orgId)
        .is('transaction_id', null)
        .order('uploaded_at', { ascending: false });
    if (error) { console.error('Error fetching unlinked receipts:', error); return []; }
    return data || [];
}
