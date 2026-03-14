import { supabase } from '@/lib/db';

export type KiProvider = 'gemini' | 'claude' | 'openai';

export interface KiSettings {
    provider: KiProvider;
    geminiApiKey?: string;
    claudeApiKey?: string;
    openaiApiKey?: string;
    extractModel: string;
    matchModel: string;
    fallbackModel: string;
    timeWindowDays: number;
    maxTransactions: number;
    autoAssign: boolean;
    autoAssignThreshold: number;
}

export const GEMINI_DEFAULTS = {
    extractModel: 'gemini-2.5-flash',
    matchModel: 'gemini-2.5-flash',
    fallbackModel: 'gemini-2.0-flash',
};

export const CLAUDE_DEFAULTS = {
    extractModel: 'claude-sonnet-4-6',
    matchModel: 'claude-sonnet-4-6',
    fallbackModel: 'claude-haiku-4-5-20251001',
};

export const OPENAI_DEFAULTS = {
    extractModel: 'gpt-4o',
    matchModel: 'gpt-4o',
    fallbackModel: 'gpt-4o-mini',
};

const KI_KEYS = [
    'ki_provider',
    'ki_api_key',
    'ki_claude_api_key',
    'ki_openai_api_key',
    'ki_extract_model',
    'ki_match_model',
    'ki_fallback_model',
    'ki_time_window_days',
    'ki_max_transactions',
    'ki_auto_assign',
    'ki_auto_assign_threshold',
] as const;

export async function getKiSettings(): Promise<KiSettings> {
    const { data } = await supabase
        .from('kitanaut_settings')
        .select('key, value')
        .in('key', KI_KEYS as unknown as string[]);

    const map: Record<string, string> = {};
    for (const row of data ?? []) map[row.key] = row.value;

    const provider: KiProvider = (map['ki_provider'] as KiProvider) || 'gemini';
    const defaults = provider === 'claude' ? CLAUDE_DEFAULTS : provider === 'openai' ? OPENAI_DEFAULTS : GEMINI_DEFAULTS;

    return {
        provider,
        geminiApiKey: map['ki_api_key'] || undefined,
        claudeApiKey: map['ki_claude_api_key'] || undefined,
        openaiApiKey: map['ki_openai_api_key'] || undefined,
        extractModel: map['ki_extract_model'] || defaults.extractModel,
        matchModel: map['ki_match_model'] || defaults.matchModel,
        fallbackModel: map['ki_fallback_model'] || defaults.fallbackModel,
        timeWindowDays: map['ki_time_window_days'] ? parseInt(map['ki_time_window_days']) : 60,
        maxTransactions: map['ki_max_transactions'] ? parseInt(map['ki_max_transactions']) : 300,
        autoAssign: map['ki_auto_assign'] === 'true',
        autoAssignThreshold: map['ki_auto_assign_threshold'] ? parseInt(map['ki_auto_assign_threshold']) : 99,
    };
}
