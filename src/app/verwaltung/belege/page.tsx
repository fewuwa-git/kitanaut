import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getAllTransactionReceipts, getUnlinkedReceipts } from '@/lib/data';
import Sidebar from '@/components/Sidebar';
import VerwaltungBelegeClient from '@/components/VerwaltungBelegeClient';

export const metadata: Metadata = { title: 'Buchungsbelege' };
export const dynamic = 'force-dynamic';

async function BelegeSection() {
    const [receipts, unlinked] = await Promise.all([
        getAllTransactionReceipts(),
        getUnlinkedReceipts(),
    ]);
    return <VerwaltungBelegeClient receipts={receipts} unlinked={unlinked} />;
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

export default async function VerwaltungBelegePage() {
    const headersList = await headers();
    const userId = headersList.get('x-user-id');
    const role = headersList.get('x-user-role') as string | null;
    const name = headersList.get('x-user-name') || '';
    const email = headersList.get('x-user-email') || '';

    if (!userId || !role) redirect('/login');
    if (role !== 'admin') redirect('/dashboard');

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
                        <BelegeSection />
                    </Suspense>
                </div>
            </main>
        </div>
    );
}
