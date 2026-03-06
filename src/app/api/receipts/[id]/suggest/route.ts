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
            .select('file_path, file_name, ai_vendor, ai_amount, ai_date, ai_description')
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
        const getModel = (name: string, maxTokens: number) => genAI.getGenerativeModel({
            model: name,
            generationConfig: { maxOutputTokens: maxTokens, temperature: 0.1 },
        });

        const generateWithFallback = async (
            contents: Parameters<ReturnType<typeof getModel>['generateContent']>[0],
            maxTokens: number,
        ) => {
            try {
                return await getModel('gemini-2.5-flash', maxTokens).generateContent(contents);
            } catch (err: any) {
                if (err?.message?.includes('503') || err?.message?.includes('Service Unavailable') || err?.message?.includes('high demand')) {
                    return await getModel('gemini-2.0-flash', maxTokens).generateContent(contents);
                }
                throw err;
            }
        };

        const extractJSON = (text: string): string => {
            const cleaned = text.trim();
            const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (fenceMatch) return fenceMatch[1].trim();
            const start = cleaned.indexOf('{');
            const end = cleaned.lastIndexOf('}');
            if (start !== -1 && end > start) return cleaned.slice(start, end + 1);
            return cleaned;
        };

        // Step 1: Extract key facts from the receipt first
        const extractResult = await generateWithFallback([
            { inlineData: { mimeType, data: base64 } },
            'Extrahiere aus diesem Beleg: Aussteller/Firma, Betrag (Zahl), Datum (YYYY-MM-DD), kurze Beschreibung. Antworte NUR mit JSON (kein Markdown): {"vendor":"...","amount":0.00,"date":"YYYY-MM-DD","description":"..."}. Falls ein Wert nicht erkennbar ist, setze null.',
        ], 256);

        let extracted: { vendor?: string; amount?: number; date?: string; description?: string } = {};
        try { extracted = JSON.parse(extractJSON(extractResult.response.text())); } catch { /* use empty */ }

        // Save extracted data to DB
        await supabase
            .from('pankonauten_transaction_receipts')
            .update({
                ai_vendor: extracted.vendor ?? null,
                ai_amount: extracted.amount ?? null,
                ai_date: extracted.date ?? null,
                ai_description: extracted.description ?? null,
            })
            .eq('id', id);

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

        // Use short numeric indices instead of UUIDs so the AI doesn't hallucinate IDs
        const indexedCandidates = candidates.map((t, i) => ({ idx: i + 1, tx: t }));
        const txList = indexedCandidates.map(({ idx, tx }) =>
            `${idx} | ${tx.date} | ${tx.counterparty} | ${tx.description} | ${tx.amount}€`
        ).join('\n');

        // Step 3: Find best matches
        const matchResult = await generateWithFallback([
            { inlineData: { mimeType, data: base64 } },
            `Beleg-Info: Aussteller="${extracted.vendor ?? '?'}", Betrag=${extracted.amount ?? '?'}€, Datum=${extracted.date ?? '?'}

Buchungen (Nr | Datum | Gegenüber | Beschreibung | Betrag):
${txList}

Welche 3 Buchungen passen am besten zu diesem Beleg? Antworte NUR mit JSON (kein Markdown):
{"suggestions":[{"nr":1,"confidence":0.9,"reason":"..."}]}`,
        ], 512);

        let matchParsed: { suggestions: { nr: number; confidence: number; reason: string }[] };
        try {
            matchParsed = JSON.parse(extractJSON(matchResult.response.text()));
        } catch {
            return NextResponse.json({ error: 'KI-Antwort konnte nicht verarbeitet werden', raw: matchResult.response.text() }, { status: 500 });
        }

        const idxMap = new Map(indexedCandidates.map(({ idx, tx }) => [idx, tx]));
        const enriched = (matchParsed.suggestions || [])
            .map(s => {
                const tx = idxMap.get(s.nr);
                if (!tx) return null;
                return { transaction_id: tx.id, confidence: s.confidence, reason: s.reason, transaction: tx };
            })
            .filter(Boolean);

        return NextResponse.json({ extracted, suggestions: enriched });

    } catch (err: any) {
        console.error('Suggest error:', err);
        return NextResponse.json({ error: err?.message ?? 'Unbekannter Fehler' }, { status: 500 });
    }
}
