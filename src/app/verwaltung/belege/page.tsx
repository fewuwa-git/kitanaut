import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getAllTransactionReceipts, getUnlinkedReceipts } from '@/lib/data';
import { supabase } from '@/lib/db';
import Sidebar from '@/components/Sidebar';
import VerwaltungBelegeClient from '@/components/VerwaltungBelegeClient';

export const metadata: Metadata = { title: 'Buchungsbelege' };
export const dynamic = 'force-dynamic';

async function BelegeSection({ tab }: { tab: string }) {
    const [receipts, unlinked] = await Promise.all([
        getAllTransactionReceipts(),
        getUnlinkedReceipts(),
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
            .from('pankonauten_transactions')
            .select('id, date, description, counterparty, amount, category')
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

    return <VerwaltungBelegeClient receipts={receipts} unlinked={unlinkedWithSuggestions} initialTab={tab} />;
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

    if (!userId || !role) redirect('/login');
    if (role !== 'admin') redirect('/dashboard');

    const { tab } = await searchParams;
    const activeTab = tab === 'linked' || tab === 'ki' || tab === 'ki-workflow' ? tab : 'unlinked';

    return (
        <div className="app-layout">
            <Sidebar user={{ name, email, role }} />
            <main className="main-content">
                <div className="page-header">
                    <div className="page-header-left">
                        <h1>Buchungsbelege</h1>
                        <p>Belege hochladen, Buchungen zuordnen und verwalten</p>
                    </div>
                </div>
                <div className="page-body">
                    <Suspense fallback={<BelegeSkeleton />}>
                        <BelegeSection tab={activeTab} />
                    </Suspense>
                </div>
            </main>
        </div>
    );
}
