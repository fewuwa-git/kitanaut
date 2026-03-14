import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { supabase } from '@/lib/db';
import { getTransactions } from '@/lib/data';
import { verifyToken } from '@/lib/auth';
import { getKiSettings } from '@/lib/kiSettings';

const BUCKET = 'transaction-receipts';

const extractJSON = (text: string): string => {
    const cleaned = text.trim();
    const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) return fenceMatch[1].trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) return cleaned.slice(start, end + 1);
    return cleaned;
};

const isOverloadError = (err: any) =>
    ['503', 'Service Unavailable', 'high demand', '429', 'quota', 'Too Many Requests', 'overloaded']
        .some(s => err?.message?.includes(s));

// ─── Gemini ──────────────────────────────────────────────────────────────────
async function runGemini(
    apiKey: string,
    extractModel: string,
    matchModel: string,
    fallbackModel: string,
    base64: string,
    mimeType: string,
    extractPrompt: string,
    matchPrompt: string,
): Promise<{ extractText: string; matchText: string }> {
    const genAI = new GoogleGenerativeAI(apiKey);

    const makeModel = (model: string) => genAI.getGenerativeModel({
        model,
        generationConfig: {
            maxOutputTokens: 512,
            temperature: 0.1,
            // @ts-ignore
            thinkingConfig: { thinkingBudget: 0 },
        },
    });

    const callWithFallback = async (model: string, contents: any[], fallback: string) => {
        try {
            return await makeModel(model).generateContent(contents);
        } catch (err: any) {
            if (isOverloadError(err)) {
                return await genAI.getGenerativeModel({
                    model: fallback,
                    generationConfig: { maxOutputTokens: 512, temperature: 0.1 },
                }).generateContent(contents);
            }
            throw err;
        }
    };

    const inlineData = { inlineData: { mimeType, data: base64 } };

    const extractResult = await callWithFallback(extractModel, [inlineData, extractPrompt], fallbackModel);
    const matchResult = await callWithFallback(matchModel, [inlineData, matchPrompt], fallbackModel);

    return {
        extractText: extractResult.response.text(),
        matchText: matchResult.response.text(),
    };
}

// ─── Claude ──────────────────────────────────────────────────────────────────
async function runClaude(
    apiKey: string,
    extractModel: string,
    matchModel: string,
    fallbackModel: string,
    base64: string,
    mimeType: string,
    extractPrompt: string,
    matchPrompt: string,
): Promise<{ extractText: string; matchText: string }> {
    const client = new Anthropic({ apiKey });

    const mediaBlock = mimeType === 'application/pdf'
        ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 } }
        : { type: 'image' as const, source: { type: 'base64' as const, media_type: mimeType as 'image/webp' | 'image/jpeg' | 'image/png', data: base64 } };

    const callClaude = async (model: string, text: string) => {
        try {
            const res = await client.messages.create({
                model,
                max_tokens: 512,
                messages: [{ role: 'user', content: [mediaBlock, { type: 'text', text }] }],
            });
            return (res.content[0] as any).text as string;
        } catch (err: any) {
            if (isOverloadError(err)) {
                const res = await client.messages.create({
                    model: fallbackModel,
                    max_tokens: 512,
                    messages: [{ role: 'user', content: [mediaBlock, { type: 'text', text }] }],
                });
                return (res.content[0] as any).text as string;
            }
            throw err;
        }
    };

    const [extractText, matchText] = await Promise.all([
        callClaude(extractModel, extractPrompt),
        callClaude(matchModel, matchPrompt).then(() => ''), // placeholder, match needs extract result
    ]);

    // Match needs extracted data, so run sequentially
    const matchText2 = await callClaude(matchModel, matchPrompt);

    return { extractText, matchText: matchText2 };
}

// ─── OpenAI ──────────────────────────────────────────────────────────────────
async function runOpenAI(
    apiKey: string,
    extractModel: string,
    matchModel: string,
    fallbackModel: string,
    base64: string,
    mimeType: string,
    extractPrompt: string,
    matchPrompt: string,
): Promise<{ extractText: string; matchText: string }> {
    const client = new OpenAI({ apiKey });

    const callOpenAI = async (model: string, prompt: string): Promise<string> => {
        const isPdf = mimeType === 'application/pdf';
        const content: OpenAI.Chat.ChatCompletionContentPart[] = isPdf
            ? [{ type: 'text', text: prompt }]
            : [
                { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
                { type: 'text', text: prompt },
            ];
        try {
            const res = await client.chat.completions.create({
                model,
                max_tokens: 512,
                messages: [{ role: 'user', content }],
            });
            return res.choices[0].message.content ?? '';
        } catch (err: any) {
            if (isOverloadError(err)) {
                const res = await client.chat.completions.create({
                    model: fallbackModel,
                    max_tokens: 512,
                    messages: [{ role: 'user', content }],
                });
                return res.choices[0].message.content ?? '';
            }
            throw err;
        }
    };

    const extractText = await callOpenAI(extractModel, extractPrompt);
    const matchText = await callOpenAI(matchModel, matchPrompt);
    return { extractText, matchText };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const token = req.cookies.get('token')?.value;
    const payload = token ? await verifyToken(token) : null;
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { id } = await params;
        const kiSettings = await getKiSettings();

        const { data: receipt } = await supabase
            .from('kitanaut_transaction_receipts')
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

        const extractPrompt = 'Extrahiere aus diesem Beleg: Aussteller/Firma, Betrag (Zahl), Datum (YYYY-MM-DD), kurze Beschreibung, Rechnungsnummer oder Auftragsnummer (nur die Zahl/Nummer). Antworte NUR mit JSON (kein Markdown): {"vendor":"...","amount":0.00,"date":"YYYY-MM-DD","description":"...","invoice_number":"..."}. Falls ein Wert nicht erkennbar ist, setze null.';

        // Step 1: Extract – need to run first to build match prompt
        let extracted: { vendor?: string; amount?: number; date?: string; description?: string; invoice_number?: string } = {};

        const runProvider = async (extractPrm: string, matchPrm: string) => {
            if (kiSettings.provider === 'claude') {
                const claudeKey = kiSettings.claudeApiKey || process.env.ANTHROPIC_API_KEY!;
                return runClaude(claudeKey, kiSettings.extractModel, kiSettings.matchModel, kiSettings.fallbackModel, base64, mimeType, extractPrm, matchPrm);
            } else {
                const geminiKey = kiSettings.geminiApiKey || process.env.GEMINI_API_KEY!;
                return runGemini(geminiKey, kiSettings.extractModel, kiSettings.matchModel, kiSettings.fallbackModel, base64, mimeType, extractPrm, matchPrm);
            }
        };

        // Run extraction first (match prompt depends on extracted data)
        let extractText = '';
        if (kiSettings.provider === 'claude') {
            const claudeKey = kiSettings.claudeApiKey || process.env.ANTHROPIC_API_KEY!;
            const client = new Anthropic({ apiKey: claudeKey });
            const mediaBlock = mimeType === 'application/pdf'
                ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 } }
                : { type: 'image' as const, source: { type: 'base64' as const, media_type: mimeType as 'image/webp', data: base64 } };
            const res = await client.messages.create({
                model: kiSettings.extractModel,
                max_tokens: 512,
                messages: [{ role: 'user', content: [mediaBlock, { type: 'text', text: extractPrompt }] }],
            });
            extractText = (res.content[0] as any).text;
        } else if (kiSettings.provider === 'openai') {
            const openaiKey = kiSettings.openaiApiKey || process.env.OPENAI_API_KEY!;
            const client = new OpenAI({ apiKey: openaiKey });
            const isPdf = mimeType === 'application/pdf';
            const content: OpenAI.Chat.ChatCompletionContentPart[] = isPdf
                ? [{ type: 'text', text: extractPrompt }]
                : [{ type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } }, { type: 'text', text: extractPrompt }];
            const res = await client.chat.completions.create({
                model: kiSettings.extractModel,
                max_tokens: 512,
                messages: [{ role: 'user', content }],
            });
            extractText = res.choices[0].message.content ?? '';
        } else {
            const genAI = new GoogleGenerativeAI(kiSettings.geminiApiKey || process.env.GEMINI_API_KEY!);
            const model = genAI.getGenerativeModel({
                model: kiSettings.extractModel,
                generationConfig: { maxOutputTokens: 512, temperature: 0.1, thinkingConfig: { thinkingBudget: 0 } } as any,
            });
            try {
                const r = await model.generateContent([{ inlineData: { mimeType, data: base64 } }, extractPrompt]);
                extractText = r.response.text();
            } catch (err: any) {
                if (isOverloadError(err)) {
                    const fb = genAI.getGenerativeModel({ model: kiSettings.fallbackModel, generationConfig: { maxOutputTokens: 512, temperature: 0.1 } });
                    const r = await fb.generateContent([{ inlineData: { mimeType, data: base64 } }, extractPrompt]);
                    extractText = r.response.text();
                } else throw err;
            }
        }

        console.log('[suggest] extract raw response:', extractText);
        try { extracted = JSON.parse(extractJSON(extractText)); } catch (e) { console.log('[suggest] extract JSON parse failed:', e); }

        // Save extracted data
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
            await supabase.from('kitanaut_transaction_receipts').update(extractionUpdate).eq('id', id);
        }

        // Step 2: Filter transactions
        const allTransactions = await getTransactions(payload.orgId);
        const filenameNumbers = (receipt.file_name.match(/\d{4,}/g) || []);
        const invoiceNumbers = [extracted.invoice_number, ...filenameNumbers].filter(Boolean).map(n => String(n).trim());

        let candidates = allTransactions;
        if (extracted.date) {
            const receiptDate = new Date(extracted.date);
            const windowMs = kiSettings.timeWindowDays * 24 * 60 * 60 * 1000;
            candidates = allTransactions.filter(t => Math.abs(new Date(t.date).getTime() - receiptDate.getTime()) <= windowMs);
        }
        if (candidates.length < 5) {
            candidates = [...allTransactions].sort((a, b) => {
                if (!extracted.date) return new Date(b.date).getTime() - new Date(a.date).getTime();
                const ref = new Date(extracted.date!).getTime();
                return Math.abs(new Date(a.date).getTime() - ref) - Math.abs(new Date(b.date).getTime() - ref);
            }).slice(0, kiSettings.maxTransactions);
        }
        if (extracted.date) {
            const ref = new Date(extracted.date).getTime();
            candidates = [...candidates].sort((a, b) =>
                Math.abs(new Date(a.date).getTime() - ref) - Math.abs(new Date(b.date).getTime() - ref)
            ).slice(0, kiSettings.maxTransactions);
        }

        const indexedCandidates = candidates.map((t, i) => {
            const haystack = `${t.description} ${t.counterparty}`.toLowerCase();
            const hasNumberMatch = invoiceNumbers.some(n => haystack.includes(n.toLowerCase()));
            return { idx: i + 1, tx: t, hasNumberMatch };
        });
        indexedCandidates.sort((a, b) => (a.hasNumberMatch === b.hasNumberMatch ? 0 : a.hasNumberMatch ? -1 : 1));
        indexedCandidates.forEach((c, i) => { c.idx = i + 1; });

        const txList = indexedCandidates.map(({ idx, tx, hasNumberMatch }) =>
            `${hasNumberMatch ? '★' : ' '} ${idx} | ${tx.date} | ${tx.counterparty} | ${tx.description} | ${tx.amount}€`
        ).join('\n');

        const invoiceHint = invoiceNumbers.length > 0
            ? `\nRechnungs-/Auftragsnummern aus Beleg/Dateiname: ${invoiceNumbers.join(', ')} – Buchungen mit ★ enthalten diese Nummer.`
            : '';

        const matchPrompt = `Beleg-Info: Aussteller="${extracted.vendor ?? '?'}", Betrag=${extracted.amount ?? '?'}€, Datum=${extracted.date ?? '?'}${invoiceHint}

Buchungen (★=Nummernübereinstimmung | Nr | Datum | Gegenüber | Beschreibung | Betrag):
${txList}

Welche 3 Buchungen passen am besten zu diesem Beleg? ★-markierte Buchungen haben sehr hohe Priorität. Antworte NUR mit JSON (kein Markdown), reason max. 8 Wörter auf Deutsch:
{"suggestions":[{"nr":1,"confidence":0.9,"reason":"..."}]}`;

        // Step 3: Match
        let matchText = '';
        if (kiSettings.provider === 'claude') {
            const claudeKey = kiSettings.claudeApiKey || process.env.ANTHROPIC_API_KEY!;
            const client = new Anthropic({ apiKey: claudeKey });
            const mediaBlock = mimeType === 'application/pdf'
                ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 } }
                : { type: 'image' as const, source: { type: 'base64' as const, media_type: mimeType as 'image/webp', data: base64 } };
            try {
                const res = await client.messages.create({
                    model: kiSettings.matchModel,
                    max_tokens: 512,
                    messages: [{ role: 'user', content: [mediaBlock, { type: 'text', text: matchPrompt }] }],
                });
                matchText = (res.content[0] as any).text;
            } catch (err: any) {
                if (isOverloadError(err)) {
                    await new Promise(r => setTimeout(r, 3000));
                    const res = await client.messages.create({
                        model: kiSettings.fallbackModel,
                        max_tokens: 512,
                        messages: [{ role: 'user', content: [mediaBlock, { type: 'text', text: matchPrompt }] }],
                    });
                    matchText = (res.content[0] as any).text;
                } else throw err;
            }
        } else if (kiSettings.provider === 'openai') {
            const openaiKey = kiSettings.openaiApiKey || process.env.OPENAI_API_KEY!;
            const client = new OpenAI({ apiKey: openaiKey });
            const isPdf = mimeType === 'application/pdf';
            const content: OpenAI.Chat.ChatCompletionContentPart[] = isPdf
                ? [{ type: 'text', text: matchPrompt }]
                : [{ type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } }, { type: 'text', text: matchPrompt }];
            try {
                const res = await client.chat.completions.create({
                    model: kiSettings.matchModel,
                    max_tokens: 512,
                    messages: [{ role: 'user', content }],
                });
                matchText = res.choices[0].message.content ?? '';
            } catch (err: any) {
                if (isOverloadError(err)) {
                    const res = await client.chat.completions.create({
                        model: kiSettings.fallbackModel,
                        max_tokens: 512,
                        messages: [{ role: 'user', content }],
                    });
                    matchText = res.choices[0].message.content ?? '';
                } else throw err;
            }
        } else {
            const genAI = new GoogleGenerativeAI(kiSettings.geminiApiKey || process.env.GEMINI_API_KEY!);
            const model = genAI.getGenerativeModel({
                model: kiSettings.matchModel,
                generationConfig: { maxOutputTokens: 512, temperature: 0.1, thinkingConfig: { thinkingBudget: 0 } } as any,
            });
            try {
                const r = await model.generateContent([{ inlineData: { mimeType, data: base64 } }, matchPrompt]);
                matchText = r.response.text();
            } catch (err: any) {
                if (isOverloadError(err)) {
                    await new Promise(r => setTimeout(r, 3000));
                    const r2 = await model.generateContent([{ inlineData: { mimeType, data: base64 } }, matchPrompt]);
                    matchText = r2.response.text();
                } else throw err;
            }
        }

        console.log('[suggest] match raw response:', matchText);

        let matchParsed: { suggestions: { nr: number; confidence: number; reason: string }[] };
        try {
            matchParsed = JSON.parse(extractJSON(matchText));
        } catch {
            return NextResponse.json({ error: 'KI-Antwort konnte nicht verarbeitet werden', raw: matchText }, { status: 500 });
        }

        // Step 4: Confidence correction
        const idxMap = new Map(indexedCandidates.map(({ idx, tx, hasNumberMatch }) => [idx, { tx, hasNumberMatch }]));
        const enriched = (matchParsed.suggestions || [])
            .map(s => {
                const entry = idxMap.get(s.nr);
                if (!entry) return null;
                const { tx, hasNumberMatch } = entry;
                let confidence = s.confidence;
                let reason = s.reason;
                if (hasNumberMatch) {
                    confidence = 0.99;
                    reason = 'Rechnungsnummer stimmt überein';
                } else {
                    const amountMatch = extracted.amount != null && Math.abs(Math.abs(Number(tx.amount)) - Math.abs(extracted.amount)) < 0.01;
                    if (amountMatch && confidence < 0.85) { confidence = 0.85; reason = 'Betrag stimmt überein'; }
                }
                return { transaction_id: tx.id, confidence, reason, transaction: tx };
            })
            .filter(Boolean)
            .sort((a: any, b: any) => b.confidence - a.confidence);

        // Step 5: Save
        const newSuggestions = enriched.map((s: any) => ({ transaction_id: s.transaction_id, confidence: s.confidence, reason: s.reason }));
        if (JSON.stringify(newSuggestions) !== JSON.stringify(receipt.ai_suggestions ?? [])) {
            await supabase.from('kitanaut_transaction_receipts').update({ ai_suggestions: newSuggestions }).eq('id', id);
        }

        return NextResponse.json({ extracted, suggestions: enriched });

    } catch (err: any) {
        console.error('Suggest error:', err);
        const isQuota = err?.message?.includes('429') || err?.message?.includes('quota') || err?.message?.includes('Too Many Requests') || err?.message?.includes('overloaded');
        const userMessage = isQuota
            ? 'KI-Limit erreicht oder Modell überlastet. Bitte später erneut versuchen oder Modell wechseln.'
            : (err?.message ?? 'Unbekannter Fehler');
        return NextResponse.json({ error: userMessage }, { status: isQuota ? 429 : 500 });
    }
}
