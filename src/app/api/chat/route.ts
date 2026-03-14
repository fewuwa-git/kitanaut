import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { supabase } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { getKiSettings, } from '@/lib/kiSettings';
import { getOrgById } from '@/lib/data';

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

function buildSystemPrompt(orgName: string): string {
    return `Du bist ein Finanz-Assistent für die Kita ${orgName}.
Beantworte Fragen AUSSCHLIESSLICH auf Basis der bereitgestellten Dashboard-Daten.
Keine Informationen aus dem Internet, aus allgemeinem Wissen oder externen Quellen.
Wenn eine Frage nicht aus den Daten beantwortet werden kann, sage das klar: "Diese Information ist in den Dashboard-Daten nicht verfügbar."
Antworte immer auf Deutsch. Sei präzise, freundlich und hilfreich.
Nutze Markdown für Formatierungen (Listen, Tabellen, Fettschrift) wenn es die Antwort übersichtlicher macht.
Rechne Summen und Statistiken selbst aus, wenn die Daten es erlauben.`;
}

async function buildContext(orgId: string): Promise<{ context: string; txCount: number; dateFrom: string; dateTo: string }> {
    const [{ data: transactions }, { data: receipts }] = await Promise.all([
        supabase
            .from('kitanaut_transactions')
            .select('date, description, counterparty, amount, category')
            .eq('organization_id', orgId)
            .order('date', { ascending: false })
            .limit(600),
        supabase
            .from('kitanaut_transaction_receipts')
            .select('file_name, ai_vendor, ai_amount, ai_date, ai_description, linked_transaction_id')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false })
            .limit(200),
    ]);

    const txList = transactions ?? [];
    const receiptList = receipts ?? [];

    if (txList.length === 0) {
        return { context: 'Keine Buchungsdaten verfügbar.', txCount: 0, dateFrom: '-', dateTo: '-' };
    }

    const dateFrom = txList[txList.length - 1]?.date ?? '-';
    const dateTo = txList[0]?.date ?? '-';

    const totalIncome = txList.filter(t => t.amount > 0).reduce((s, t) => s + Number(t.amount), 0);
    const totalExpenses = txList.filter(t => t.amount < 0).reduce((s, t) => s + Number(t.amount), 0);
    const saldo = totalIncome + totalExpenses;

    // Category totals
    const catTotals: Record<string, number> = {};
    for (const t of txList) {
        const cat = t.category || 'Unkategorisiert';
        catTotals[cat] = (catTotals[cat] || 0) + Number(t.amount);
    }
    const catLines = Object.entries(catTotals)
        .sort((a, b) => a[1] - b[1])
        .map(([cat, total]) => `  ${cat}: ${total.toFixed(2)}€`)
        .join('\n');

    // Monthly totals
    const monthTotals: Record<string, { income: number; expenses: number }> = {};
    for (const t of txList) {
        const month = t.date?.slice(0, 7) ?? 'unbekannt';
        if (!monthTotals[month]) monthTotals[month] = { income: 0, expenses: 0 };
        if (Number(t.amount) > 0) monthTotals[month].income += Number(t.amount);
        else monthTotals[month].expenses += Number(t.amount);
    }
    const monthLines = Object.entries(monthTotals)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, 24)
        .map(([m, v]) => `  ${m}: Einnahmen ${v.income.toFixed(2)}€, Ausgaben ${v.expenses.toFixed(2)}€`)
        .join('\n');

    // Transaction list (newest first)
    const txLines = txList
        .map(t => `${t.date} | ${t.counterparty || '-'} | ${t.description || '-'} | ${Number(t.amount).toFixed(2)}€ | ${t.category || 'Unkategorisiert'}`)
        .join('\n');

    // Receipts
    const receiptLines = receiptList.length > 0
        ? receiptList
            .map(r => `${r.ai_date || '?'} | ${r.ai_vendor || r.file_name} | ${r.ai_amount != null ? Number(r.ai_amount).toFixed(2) + '€' : '?'} | ${r.ai_description || '-'} | ${r.linked_transaction_id ? 'zugeordnet' : 'offen'}`)
            .join('\n')
        : 'Keine Belegdaten verfügbar.';

    const context = `== FINANZDATEN KITA PANKONAUTEN ==
Zeitraum: ${dateFrom} bis ${dateTo}
Anzahl Buchungen: ${txList.length}
Gesamteinnahmen: ${totalIncome.toFixed(2)}€
Gesamtausgaben: ${totalExpenses.toFixed(2)}€
Saldo: ${saldo.toFixed(2)}€

== KATEGORIEN (Gesamtsummen) ==
${catLines}

== MONATLICHE ÜBERSICHT ==
${monthLines}

== ALLE BUCHUNGEN (Datum | Gegenüber | Beschreibung | Betrag | Kategorie) ==
${txLines}

== BELEGE (Datum | Aussteller | Betrag | Beschreibung | Status) ==
${receiptLines}`;

    return { context, txCount: txList.length, dateFrom, dateTo };
}

export async function POST(req: NextRequest) {
    const token = req.cookies.get('token')?.value;
    const payload = token ? await verifyToken(token) : null;
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const messages: ChatMessage[] = body.messages ?? [];
    if (!messages.length) return NextResponse.json({ error: 'Keine Nachricht' }, { status: 400 });

    const [kiSettings, { context, txCount, dateFrom, dateTo }, org] = await Promise.all([
        getKiSettings(),
        buildContext(payload.orgId),
        getOrgById(payload.orgId),
    ]);

    const fullSystem = `${buildSystemPrompt(org?.name || 'Kitanaut')}\n\n${context}`;

    let reply = '';

    try {
        if (kiSettings.provider === 'claude') {
            const apiKey = kiSettings.claudeApiKey || process.env.ANTHROPIC_API_KEY!;
            const client = new Anthropic({ apiKey });
            const res = await client.messages.create({
                model: kiSettings.matchModel,
                max_tokens: 2048,
                system: fullSystem,
                messages: messages.map(m => ({ role: m.role, content: m.content })),
            });
            reply = (res.content[0] as any).text ?? '';

        } else if (kiSettings.provider === 'openai') {
            const apiKey = kiSettings.openaiApiKey || process.env.OPENAI_API_KEY!;
            const client = new OpenAI({ apiKey });
            const res = await client.chat.completions.create({
                model: kiSettings.matchModel,
                max_tokens: 2048,
                messages: [
                    { role: 'system', content: fullSystem },
                    ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
                ],
            });
            reply = res.choices[0].message.content ?? '';

        } else {
            // Gemini
            const apiKey = kiSettings.geminiApiKey || process.env.GEMINI_API_KEY!;
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({
                model: kiSettings.matchModel,
                systemInstruction: fullSystem,
                generationConfig: { maxOutputTokens: 2048, temperature: 0.2 },
            });

            // Build Gemini chat history (all but last message)
            const history = messages.slice(0, -1).map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }],
            }));
            const lastMessage = messages[messages.length - 1].content;

            const chat = model.startChat({ history });
            const result = await chat.sendMessage(lastMessage);
            reply = result.response.text();
        }

        return NextResponse.json({
            reply,
            meta: { txCount, dateFrom, dateTo, provider: kiSettings.provider, model: kiSettings.matchModel },
        });

    } catch (err: any) {
        console.error('[chat] error:', err);
        return NextResponse.json({ error: err?.message ?? 'Unbekannter Fehler' }, { status: 500 });
    }
}
