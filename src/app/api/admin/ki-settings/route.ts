import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { supabase } from '@/lib/db';
import { getKiSettings } from '@/lib/kiSettings';

function maskKey(key: string | undefined): string {
    if (!key) return '';
    return `${'•'.repeat(Math.max(0, key.length - 4))}${key.slice(-4)}`;
}

export async function GET(req: NextRequest) {
    const token = req.cookies.get('token')?.value;
    const payload = token ? await verifyToken(token) : null;
    if (!payload || payload.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settings = await getKiSettings();

    return NextResponse.json({
        ...settings,
        geminiApiKey: maskKey(settings.geminiApiKey),
        geminiApiKeySet: !!settings.geminiApiKey,
        claudeApiKey: maskKey(settings.claudeApiKey),
        claudeApiKeySet: !!settings.claudeApiKey,
        openaiApiKey: maskKey(settings.openaiApiKey),
        openaiApiKeySet: !!settings.openaiApiKey,
    });
}

export async function PATCH(req: NextRequest) {
    const token = req.cookies.get('token')?.value;
    const payload = token ? await verifyToken(token) : null;
    if (!payload || payload.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const upserts: { key: string; value: string }[] = [];

    const push = (key: string, val: any) => {
        if (val !== undefined) upserts.push({ key, value: String(val) });
    };

    if (body.provider) push('ki_provider', body.provider);
    // Only save API keys if they're new values (not masked placeholders)
    if (body.geminiApiKey !== undefined && body.geminiApiKey !== '' && !body.geminiApiKey.startsWith('•')) {
        push('ki_api_key', body.geminiApiKey);
    }
    if (body.claudeApiKey !== undefined && body.claudeApiKey !== '' && !body.claudeApiKey.startsWith('•')) {
        push('ki_claude_api_key', body.claudeApiKey);
    }
    if (body.openaiApiKey !== undefined && body.openaiApiKey !== '' && !body.openaiApiKey.startsWith('•')) {
        push('ki_openai_api_key', body.openaiApiKey);
    }
    push('ki_extract_model', body.extractModel);
    push('ki_match_model', body.matchModel);
    push('ki_fallback_model', body.fallbackModel);
    push('ki_time_window_days', body.timeWindowDays);
    push('ki_max_transactions', body.maxTransactions);
    push('ki_auto_assign', body.autoAssign);
    push('ki_auto_assign_threshold', body.autoAssignThreshold);

    if (upserts.length > 0) {
        const { error } = await supabase
            .from('kitanaut_settings')
            .upsert(upserts, { onConflict: 'key' });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
