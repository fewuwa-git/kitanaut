import { supabase } from './db';

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
    role: 'admin' | 'member' | 'eltern' | 'springerin';
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

export async function getUsers(): Promise<User[]> {
    const { data, error } = await supabase.from('pankonauten_users').select('*');
    if (error) {
        console.error('Error fetching users:', error);
        return [];
    }
    return data || [];
}

export async function getSpringerinUsers(): Promise<User[]> {
    const { data, error } = await supabase
        .from('pankonauten_users')
        .select('*')
        .eq('role', 'springerin')
        .order('name', { ascending: true });
    if (error) {
        console.error('Error fetching springerin users:', error);
        return [];
    }
    return data || [];
}

export async function getUserById(id: string): Promise<User | undefined> {
    const { data, error } = await supabase
        .from('pankonauten_users')
        .select('*')
        .eq('id', id)
        .single();
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error fetching user by ID:', error);
    }
    return data || undefined;
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
    const { data, error } = await supabase
        .from('pankonauten_users')
        .select('*')
        .ilike('email', email)
        .single();
    if (error && error.code !== 'PGRST116') {
        console.error('Error fetching user by email:', error);
    }
    return data || undefined;
}

export async function saveUser(user: User): Promise<void> {
    const { error } = await supabase
        .from('pankonauten_users')
        .upsert(
            {
                id: user.id,
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
            },
            { onConflict: 'id' }
        );
    if (error) {
        throw new Error('Could not save user: ' + error.message);
    }
}

export async function deleteUser(id: string): Promise<void> {
    const { error } = await supabase.from('pankonauten_users').delete().eq('id', id);
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

export async function getTransactions(): Promise<Transaction[]> {
    const { data, error } = await supabase
        .from('pankonauten_transactions')
        .select('*')
        .order('date', { ascending: true });

    if (error) {
        console.error("Database error in getTransactions:", error);
        return [];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data || []).map((t: any) => ({
        ...t,
        amount: Number(t.amount),
        balance: Number(t.balance),
    }));
}

export async function saveTransactions(transactions: Transaction[]): Promise<void> {
    // Delete all
    const { error: delErr } = await supabase.from('pankonauten_transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (delErr) {
        throw new Error('Failed to clear transactions: ' + delErr.message);
    }

    if (transactions.length === 0) return;

    // chunk inserts (Supabase has limits on insert sizes)
    const chunkSize = 1000;
    for (let i = 0; i < transactions.length; i += chunkSize) {
        const chunk = transactions.slice(i, i + chunkSize);
        const { error: insErr } = await supabase.from('pankonauten_transactions').insert(chunk);
        if (insErr) {
            throw new Error('Failed to insert transactions: ' + insErr.message);
        }
    }
}

export async function addTransactions(newTransactions: Transaction[]): Promise<number> {
    const existing = await getTransactions();

    const existingSignatures = new Set(existing.map(tx =>
        `${tx.date}_${tx.amount}_${tx.description}_${tx.counterparty}`
    ));

    const uniqueNewTransactions = newTransactions.filter(tx => {
        const signature = `${tx.date}_${tx.amount}_${tx.description}_${tx.counterparty}`;
        if (existingSignatures.has(signature)) {
            return false;
        }
        existingSignatures.add(signature);
        return true;
    });

    if (uniqueNewTransactions.length === 0) {
        return 0;
    }

    const all = [...existing, ...uniqueNewTransactions];
    all.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let balance = 0;
    for (const tx of all) {
        balance += tx.amount;
        tx.balance = Math.round(balance * 100) / 100;
    }

    await saveTransactions(all);

    return uniqueNewTransactions.length;
}
export async function getTransactionsByCounterparty(name: string): Promise<Transaction[]> {
    const { data, error } = await supabase
        .from('pankonauten_transactions')
        .select('*')
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

export async function updateTransactionCategory(id: string, category: string): Promise<void> {
    const { error } = await supabase
        .from('pankonauten_transactions')
        .update({ category })
        .eq('id', id);

    if (error) {
        throw new Error('Failed to update transaction category: ' + error.message);
    }
}

// ─── Categories ───────────────────────────────────────────────────────────────

export async function getCategories(): Promise<Category[]> {
    const { data, error } = await supabase
        .from('pankonauten_categories')
        .select('*')
        .order('type', { ascending: true })
        .order('name', { ascending: true });
    if (error) {
        console.error('Error fetching categories:', error);
        return [];
    }
    return data || [];
}

export async function createCategory(category: Category): Promise<void> {
    const { error } = await supabase
        .from('pankonauten_categories')
        .insert({ name: category.name, color: category.color, type: category.type });
    if (error) {
        throw new Error('Failed to create category: ' + error.message);
    }
}

export async function updateCategory(oldName: string, category: Category): Promise<void> {
    // If name changed, update all transactions first, then update category
    if (oldName !== category.name) {
        const { error: txErr } = await supabase
            .from('pankonauten_transactions')
            .update({ category: category.name })
            .eq('category', oldName);
        if (txErr) {
            throw new Error('Failed to rename category in transactions: ' + txErr.message);
        }
        // Delete old, insert new (Supabase: primary key can't be updated directly)
        const { error: delErr } = await supabase
            .from('pankonauten_categories')
            .delete()
            .eq('name', oldName);
        if (delErr) throw new Error('Failed to delete old category: ' + delErr.message);
        const { error: insErr } = await supabase
            .from('pankonauten_categories')
            .insert({ name: category.name, color: category.color, type: category.type });
        if (insErr) throw new Error('Failed to insert renamed category: ' + insErr.message);
    } else {
        const { error } = await supabase
            .from('pankonauten_categories')
            .update({ color: category.color, type: category.type })
            .eq('name', oldName);
        if (error) {
            throw new Error('Failed to update category: ' + error.message);
        }
    }
}

export async function deleteCategory(name: string): Promise<void> {
    // Check if any transactions use this category
    const { count, error: countErr } = await supabase
        .from('pankonauten_transactions')
        .select('id', { count: 'exact', head: true })
        .eq('category', name);
    if (countErr) throw new Error('Failed to check transactions: ' + countErr.message);
    if (count && count > 0) {
        throw new Error(`Kategorie "${name}" wird von ${count} Buchung(en) verwendet und kann nicht gelöscht werden.`);
    }
    const { error } = await supabase
        .from('pankonauten_categories')
        .delete()
        .eq('name', name);
    if (error) {
        throw new Error('Failed to delete category: ' + error.message);
    }
}

// ─── Abrechnungen ────────────────────────────────────────────────────────────

export async function getAbrechnung(userId: string, jahr: number, monat: number): Promise<{ abrechnung: Abrechnung | null, tage: AbrechnungTag[] }> {
    const { data: abrechnung, error: abErr } = await supabase
        .from('pankonauten_abrechnungen')
        .select('*')
        .eq('user_id', userId)
        .eq('jahr', jahr)
        .eq('monat', monat)
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

export async function saveAbrechnung(ab: Partial<Abrechnung>): Promise<Abrechnung> {
    const payload = { ...ab, updated_at: new Date().toISOString() };
    const { data, error } = await supabase
        .from('pankonauten_abrechnungen')
        .upsert(payload, { onConflict: 'user_id, jahr, monat' })
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

export async function getAllAbrechnungen(userId?: string): Promise<any[]> {
    let query = supabase
        .from('pankonauten_abrechnungen')
        .select(`
            *,
            pankonauten_users (id, name, email, strasse, ort, iban, steuerid, unterschrift),
            pankonauten_abrechnung_tage (*)
        `);

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

export async function recalculateAbrechnungRates(userId: string, jahr: number, monat: number): Promise<void> {
    const user = await getUserById(userId);
    if (!user || user.stundensatz === undefined) {
        throw new Error('Kein Stundensatz im Profil hinterlegt.');
    }

    const { tage } = await getAbrechnung(userId, jahr, monat);
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

// ─── Springerin Notes ─────────────────────────────────────────────────────────

export interface SpringerinNote {
    id: string;
    jahr: number;
    monat: number;
    content: string;
    author_name: string;
    created_at?: string;
}

export async function getSpringerinNotes(jahr?: number, monat?: number): Promise<SpringerinNote[]> {
    let query = supabase.from('pankonauten_springerin_notes').select('*');
    if (jahr) query = query.eq('jahr', jahr);
    if (monat) query = query.eq('monat', monat);

    const { data, error } = await query;
    if (error) {
        console.error('Error fetching springerin notes:', error.message, error.code);
        return [];
    }
    return data || [];
}

export async function saveSpringerinNote(note: Omit<SpringerinNote, 'id' | 'created_at'>): Promise<SpringerinNote | null> {
    const { data, error } = await supabase
        .from('pankonauten_springerin_notes')
        .upsert(note, { onConflict: 'jahr,monat' })
        .select()
        .single();

    if (error) {
        console.error('Error saving springerin note:', error.message, error.code);
        return null;
    }
    return data;
}
