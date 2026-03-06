import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '@/lib/db';
import { getTransactions } from '@/lib/data';

const BUCKET = 'transaction-receipts';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        const { data: receipt } = await supabase
            .from('pankonauten_transaction_receipts')
            .select('file_path, file_name')
            .eq('id', id)
            .single();

        if (!receipt) return NextResponse.json({ error: 'Beleg nicht gefunden' }, { status: 404 });

        const { data: fileData, error: downloadError } = await supabase.storage
            .from(BUCKET)
            .download(receipt.file_path);

        if (downloadError || !fileData) {
            return NextResponse.json({ error: 'Datei konnte nicht geladen werden' }, { status: 500 });
        }

        const arrayBuffer = await fileData.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        const mimeType = receipt.file_name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/webp';

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            generationConfig: { maxOutputTokens: 256, temperature: 0.1 },
        });

        // Step 1: Extract key facts from the receipt first
        const extractResult = await model.generateContent([
            { inlineData: { mimeType, data: base64 } },
            'Extrahiere aus diesem Beleg: Aussteller/Firma, Betrag (Zahl), Datum (YYYY-MM-DD), kurze Beschreibung. Antworte NUR mit JSON (kein Markdown): {"vendor":"...","amount":0.00,"date":"YYYY-MM-DD","description":"..."}. Falls ein Wert nicht erkennbar ist, setze null.',
        ]);

        const extractText = extractResult.response.text().trim()
            .replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();

        let extracted: { vendor?: string; amount?: number; date?: string; description?: string } = {};
        try { extracted = JSON.parse(extractText); } catch { /* use empty */ }

        // Step 2: Filter transactions to a relevant window around the receipt date
        const allTransactions = await getTransactions();

        let candidates = allTransactions;
        if (extracted.date) {
            const receiptDate = new Date(extracted.date);
            const windowMs = 60 * 24 * 60 * 60 * 1000; // ±60 days
            candidates = allTransactions.filter(t => {
                const diff = Math.abs(new Date(t.date).getTime() - receiptDate.getTime());
                return diff <= windowMs;
            });
        }

        // If window yields too few, fall back to all sorted by proximity to receipt date
        if (candidates.length < 5) {
            candidates = [...allTransactions].sort((a, b) => {
                if (!extracted.date) return new Date(b.date).getTime() - new Date(a.date).getTime();
                const ref = new Date(extracted.date!).getTime();
                return Math.abs(new Date(a.date).getTime() - ref) - Math.abs(new Date(b.date).getTime() - ref);
            }).slice(0, 300);
        }

        // Sort by proximity to receipt date, cap at 300
        if (extracted.date) {
            const ref = new Date(extracted.date).getTime();
            candidates = [...candidates].sort((a, b) =>
                Math.abs(new Date(a.date).getTime() - ref) - Math.abs(new Date(b.date).getTime() - ref)
            ).slice(0, 300);
        }

        const txList = candidates.map(t =>
            `${t.id} | ${t.date} | ${t.counterparty} | ${t.description} | ${t.amount}€`
        ).join('\n');

        // Step 3: Find best matches
        const matchResult = await model.generateContent([
            { inlineData: { mimeType, data: base64 } },
            `Beleg-Info: Aussteller="${extracted.vendor ?? '?'}", Betrag=${extracted.amount ?? '?'}€, Datum=${extracted.date ?? '?'}

Buchungen (ID | Datum | Gegenüber | Beschreibung | Betrag):
${txList}

Welche 3 Buchungen passen am besten zu diesem Beleg? Antworte NUR mit JSON (kein Markdown):
{"suggestions":[{"transaction_id":"...","confidence":0.9,"reason":"..."}]}`,
        ]);

        const matchText = matchResult.response.text().trim()
            .replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();

        let matchParsed: { suggestions: { transaction_id: string; confidence: number; reason: string }[] };
        try {
            matchParsed = JSON.parse(matchText);
        } catch {
            return NextResponse.json({ error: 'KI-Antwort konnte nicht verarbeitet werden', raw: matchText }, { status: 500 });
        }

        const txMap = new Map(allTransactions.map(t => [t.id, t]));
        const enriched = (matchParsed.suggestions || [])
            .map(s => {
                const tx = txMap.get(s.transaction_id);
                if (!tx) return null;
                return { ...s, transaction: tx };
            })
            .filter(Boolean);

        return NextResponse.json({ extracted, suggestions: enriched });

    } catch (err: any) {
        console.error('Suggest error:', err);
        return NextResponse.json({ error: err?.message ?? 'Unbekannter Fehler' }, { status: 500 });
    }
}
