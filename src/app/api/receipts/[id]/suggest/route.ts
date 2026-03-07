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
            .select('file_path, file_name, ai_vendor, ai_amount, ai_date, ai_description, ai_invoice_number, ai_suggestions')
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

        // For extraction: use 2.5-flash (better at reading documents), fallback to 2.0-flash
        const extractWithFallback = async (contents: Parameters<ReturnType<typeof getModel>['generateContent']>[0]) => {
            try {
                return await getModel('gemini-2.5-flash', 256).generateContent(contents);
            } catch (err: any) {
                if (err?.message?.includes('503') || err?.message?.includes('Service Unavailable') || err?.message?.includes('high demand') || err?.message?.includes('429') || err?.message?.includes('quota') || err?.message?.includes('Too Many Requests')) {
                    return await getModel('gemini-2.0-flash', 256).generateContent(contents);
                }
                throw err;
            }
        };

        // For matching: use 2.5-flash with thinking disabled so no tokens are wasted on reasoning
        const matchModel = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            generationConfig: {
                maxOutputTokens: 512,
                temperature: 0.1,
                // @ts-ignore – thinkingConfig is supported but not yet typed in the SDK
                thinkingConfig: { thinkingBudget: 0 },
            },
        });
        const matchWithModel = async (contents: Parameters<typeof matchModel.generateContent>[0]) => {
            try {
                return await matchModel.generateContent(contents);
            } catch (err: any) {
                if (err?.message?.includes('503') || err?.message?.includes('Service Unavailable') || err?.message?.includes('high demand') || err?.message?.includes('429') || err?.message?.includes('quota') || err?.message?.includes('Too Many Requests')) {
                    await new Promise(r => setTimeout(r, 3000));
                    return await matchModel.generateContent(contents);
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

        // Step 1: Extract key facts from the receipt first (including invoice/order number)
        const extractResult = await extractWithFallback([
            { inlineData: { mimeType, data: base64 } },
            'Extrahiere aus diesem Beleg: Aussteller/Firma, Betrag (Zahl), Datum (YYYY-MM-DD), kurze Beschreibung, Rechnungsnummer oder Auftragsnummer (nur die Zahl/Nummer). Antworte NUR mit JSON (kein Markdown): {"vendor":"...","amount":0.00,"date":"YYYY-MM-DD","description":"...","invoice_number":"..."}. Falls ein Wert nicht erkennbar ist, setze null.',
        ], 256);

        let extracted: { vendor?: string; amount?: number; date?: string; description?: string; invoice_number?: string } = {};
        try { extracted = JSON.parse(extractJSON(extractResult.response.text())); } catch { /* use empty */ }

        // Also extract numbers from the filename as additional hints
        const filenameNumbers = (receipt.file_name.match(/\d{4,}/g) || []);
        const invoiceNumbers = [
            extracted.invoice_number,
            ...filenameNumbers,
        ].filter(Boolean).map(n => String(n).trim());

        // Save extracted data to DB – only overwrite fields that are new (non-null) or changed
        const extractionUpdate: Record<string, any> = {};
        const mergeField = (key: string, newVal: any, oldVal: any) => {
            if (newVal != null && newVal !== oldVal) extractionUpdate[key] = newVal;
        };
        mergeField('ai_vendor', extracted.vendor, receipt.ai_vendor);
        mergeField('ai_amount', extracted.amount, receipt.ai_amount);
        mergeField('ai_date', extracted.date, receipt.ai_date);
        mergeField('ai_description', extracted.description, receipt.ai_description);
        mergeField('ai_invoice_number', extracted.invoice_number, receipt.ai_invoice_number);
        if (Object.keys(extractionUpdate).length > 0) {
            await supabase
                .from('pankonauten_transaction_receipts')
                .update(extractionUpdate)
                .eq('id', id);
        }

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
        // Mark transactions that contain an invoice/filename number with ★
        const indexedCandidates = candidates.map((t, i) => {
            const haystack = `${t.description} ${t.counterparty}`.toLowerCase();
            const hasNumberMatch = invoiceNumbers.some(n => haystack.includes(n.toLowerCase()));
            return { idx: i + 1, tx: t, hasNumberMatch };
        });

        // Sort number-matched candidates to the top
        indexedCandidates.sort((a, b) => {
            if (a.hasNumberMatch && !b.hasNumberMatch) return -1;
            if (!a.hasNumberMatch && b.hasNumberMatch) return 1;
            return 0;
        });
        // Re-index after sort
        indexedCandidates.forEach((c, i) => { c.idx = i + 1; });

        const txList = indexedCandidates.map(({ idx, tx, hasNumberMatch }) =>
            `${hasNumberMatch ? '★' : ' '} ${idx} | ${tx.date} | ${tx.counterparty} | ${tx.description} | ${tx.amount}€`
        ).join('\n');

        const invoiceHint = invoiceNumbers.length > 0
            ? `\nRechnungs-/Auftragsnummern aus Beleg/Dateiname: ${invoiceNumbers.join(', ')} – Buchungen mit ★ enthalten diese Nummer.`
            : '';

        // Step 3: Find best matches
        const matchResult = await matchWithModel([
            { inlineData: { mimeType, data: base64 } },
            `Beleg-Info: Aussteller="${extracted.vendor ?? '?'}", Betrag=${extracted.amount ?? '?'}€, Datum=${extracted.date ?? '?'}${invoiceHint}

Buchungen (★=Nummernübereinstimmung | Nr | Datum | Gegenüber | Beschreibung | Betrag):
${txList}

Welche 3 Buchungen passen am besten zu diesem Beleg? ★-markierte Buchungen haben sehr hohe Priorität. Antworte NUR mit JSON (kein Markdown), reason max. 8 Wörter auf Deutsch:
{"suggestions":[{"nr":1,"confidence":0.9,"reason":"..."}]}`,
        ], 256);

        const matchRaw = matchResult.response.text();
        console.log('[suggest] match raw response:', matchRaw);

        let matchParsed: { suggestions: { nr: number; confidence: number; reason: string }[] };
        try {
            matchParsed = JSON.parse(extractJSON(matchRaw));
        } catch {
            return NextResponse.json({ error: 'KI-Antwort konnte nicht verarbeitet werden', raw: matchRaw }, { status: 500 });
        }

        const idxMap = new Map(indexedCandidates.map(({ idx, tx, hasNumberMatch }) => [idx, { tx, hasNumberMatch }]));
        const enriched = (matchParsed.suggestions || [])
            .map(s => {
                const entry = idxMap.get(s.nr);
                if (!entry) return null;
                const { tx, hasNumberMatch } = entry;

                // Override confidence with hard facts where possible
                let confidence = s.confidence;
                let reason = s.reason;
                if (hasNumberMatch) {
                    confidence = 0.99;
                    reason = 'Rechnungsnummer stimmt überein';
                } else {
                    // Boost if amount matches exactly
                    const amountMatch = extracted.amount != null && Math.abs(Math.abs(Number(tx.amount)) - Math.abs(extracted.amount)) < 0.01;
                    if (amountMatch && confidence < 0.85) {
                        confidence = 0.85;
                        reason = 'Betrag stimmt überein';
                    }
                }

                return { transaction_id: tx.id, confidence, reason, transaction: tx };
            })
            .filter(Boolean)
            .sort((a: any, b: any) => b.confidence - a.confidence);

        // Save suggestions to DB – only overwrite if changed
        const newSuggestions = enriched.map((s: any) => ({
            transaction_id: s.transaction_id,
            confidence: s.confidence,
            reason: s.reason,
        }));
        const suggestionsChanged = JSON.stringify(newSuggestions) !== JSON.stringify(receipt.ai_suggestions ?? []);
        if (suggestionsChanged) {
            await supabase
                .from('pankonauten_transaction_receipts')
                .update({ ai_suggestions: newSuggestions })
                .eq('id', id);
        }

        return NextResponse.json({ extracted, suggestions: enriched });

    } catch (err: any) {
        console.error('Suggest error:', err);
        const isQuota = err?.message?.includes('429') || err?.message?.includes('quota') || err?.message?.includes('Too Many Requests');
        const userMessage = isQuota
            ? 'KI-Tageslimit erreicht (20 kostenlose Anfragen/Tag). Bitte morgen erneut versuchen oder API-Key upgraden.'
            : (err?.message ?? 'Unbekannter Fehler');
        return NextResponse.json({ error: userMessage }, { status: isQuota ? 429 : 500 });
    }
}
