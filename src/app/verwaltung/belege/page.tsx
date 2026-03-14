import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getAllTransactionReceipts, getUnlinkedReceipts, getCategories } from '@/lib/data';
import { supabase } from '@/lib/db';
import { getKiSettings } from '@/lib/kiSettings';
import Sidebar from '@/components/Sidebar';
import VerwaltungBelegeClient from '@/components/VerwaltungBelegeClient';

export const metadata: Metadata = { title: 'Buchungsbelege' };
export const dynamic = 'force-dynamic';

async function BelegeSection({ tab, orgId }: { tab: string; orgId: string }) {
    const [receipts, unlinked, categories, kiSettings] = await Promise.all([
        getAllTransactionReceipts(orgId),
        getUnlinkedReceipts(orgId),
        getCategories(orgId),
        getKiSettings(),
    ]);

    // Hydrate saved AI suggestions with full transaction data
    const savedTxIds = [
        ...new Set(
            unlinked.flatMap((r: any) =>
                (r.ai_suggestions ?? []).map((s: any) => s.transaction_id).filter(Boolean)
            )
        ),
    ] as string[];

    let txMap: Record<string, any> = {};
    if (savedTxIds.length > 0) {
        const { data: txs } = await supabase
            .from('kitanaut_transactions')
            .select('id, date, description, counterparty, amount, category')
            .eq('organization_id', orgId)
            .in('id', savedTxIds);
        for (const tx of txs ?? []) txMap[tx.id] = tx;
    }

    const unlinkedWithSuggestions = unlinked.map((r: any) => ({
        ...r,
        ai_suggestions: (r.ai_suggestions ?? [])
            .map((s: any) => {
                const tx = txMap[s.transaction_id];
                if (!tx) return null;
                return { ...s, transaction: tx };
            })
            .filter(Boolean),
    }));

    const mask = (k: string | undefined) => k ? `${'•'.repeat(Math.max(0, k.length - 4))}${k.slice(-4)}` : '';
    const kiSettingsForClient = {
        ...kiSettings,
        geminiApiKey: mask(kiSettings.geminiApiKey),
        geminiApiKeySet: !!kiSettings.geminiApiKey,
        claudeApiKey: mask(kiSettings.claudeApiKey),
        claudeApiKeySet: !!kiSettings.claudeApiKey,
        openaiApiKey: mask(kiSettings.openaiApiKey),
        openaiApiKeySet: !!kiSettings.openaiApiKey,
    };
    return <VerwaltungBelegeClient receipts={receipts} unlinked={unlinkedWithSuggestions} initialTab={tab} categories={categories} kiSettingsInitial={kiSettingsForClient} />;
}

function BelegeSkeleton() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...Array(6)].map((_, i) => (
                <div key={i} style={{ height: 52, borderRadius: 8, background: 'var(--bg-secondary)', animation: 'pulse 1.5s ease-in-out infinite', animationDelay: `${i * 0.05}s` }} />
            ))}
        </div>
    );
}

export default async function VerwaltungBelegePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
    const headersList = await headers();
    const userId = headersList.get('x-user-id');
    const role = headersList.get('x-user-role') as string | null;
    const name = headersList.get('x-user-name') || '';
    const email = headersList.get('x-user-email') || '';

    const orgId = headersList.get('x-org-id') || '';

    if (!userId || !role) redirect('/login');
    if (role !== 'admin' && role !== 'finanzvorstand') redirect('/dashboard');

    const { tab } = await searchParams;
    const activeTab = tab === 'linked' || tab === 'unlinked' || tab === 'ki' || tab === 'ki-workflow' || tab === 'ki-settings' ? tab : 'upload';

    return (
        <div className="app-layout">
            <Sidebar user={{ name, email, role }} />
            <main className="main-content">
                <div className="page-body">
                    <Suspense fallback={<BelegeSkeleton />}>
                        <BelegeSection tab={activeTab} orgId={orgId} />
                    </Suspense>
                </div>
            </main>
        </div>
    );
}
