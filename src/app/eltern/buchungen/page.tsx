import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getTransactionsByCounterparty, getUsers, getCategories } from '@/lib/data';
import Sidebar from '@/components/Sidebar';

export const metadata: Metadata = { title: 'Meine Buchungen' };
import KontoauszugClient from '@/components/KontoauszugClient';
import ElternUserSelector from '@/components/ElternUserSelector';

async function MeineBuchungenSection({ name }: { name: string }) {
    const [transactions, categories] = await Promise.all([
        getTransactionsByCounterparty(name),
        getCategories(),
    ]);
    return (
        <>
            {transactions.length === 0 ? (
                <div className="card" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>📭</div>
                    Keine Buchungen für „{name}" gefunden.
                </div>
            ) : (
                <KontoauszugClient transactions={transactions} categories={categories} elternView={true} />
            )}
        </>
    );
}

function MeineBuchungenSkeleton() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[...Array(8)].map((_, i) => (
                <div key={i} style={{ height: '52px', borderRadius: '8px', background: 'var(--bg-secondary)', animation: 'pulse 1.5s ease-in-out infinite', animationDelay: `${i * 0.05}s` }} />
            ))}
        </div>
    );
}

export default async function MeineBuchungenPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const headersList = await headers();
    const userId = headersList.get('x-user-id');
    const role = headersList.get('x-user-role') as 'admin' | 'member' | 'eltern' | 'springerin' | null;
    const name = headersList.get('x-user-name') || '';
    const email = headersList.get('x-user-email') || '';

    if (!userId || !role) redirect('/login');
    if (role !== 'eltern' && role !== 'member' && role !== 'admin') redirect('/dashboard');

    const isAdmin = role === 'admin';
    const params = await searchParams;
    const selectedUserId = params?.userId as string | undefined;
    const customSearch = params?.customSearch as string | undefined;

    // Admin: load all eltern users for the selector
    const elternUsers = isAdmin
        ? (await getUsers()).filter(u => u.role === 'eltern' || u.role === 'member').sort((a, b) => a.name.localeCompare(b.name))
        : [];

    // Determine whose transactions to show
    let displayName: string | null = null;
    let searchName: string | undefined;
    if (isAdmin) {
        if (selectedUserId) {
            const selected = elternUsers.find(u => u.id === selectedUserId);
            searchName = selected?.name;
            // customSearch overrides the auto-detected name
            displayName = customSearch ?? searchName ?? null;
        }
    } else {
        displayName = customSearch ?? name;
        searchName = name;
    }

    return (
        <div className="app-layout">
            <Sidebar user={{ name, email, role }} />
            <main className="main-content">
                <div className="page-header">
                    <div className="page-header-left">
                        <h1>Eltern-Buchungen</h1>
                        <p>{isAdmin ? 'Buchungen nach Eltern-Account filtern' : `Alle Buchungen für ${name}`}</p>
                    </div>
                </div>
                <div className="page-body">
                    {isAdmin && (
                        <ElternUserSelector
                            users={elternUsers}
                            selectedUserId={selectedUserId}
                            searchName={customSearch ?? searchName}
                        />
                    )}
                    {displayName ? (
                        <Suspense key={displayName} fallback={<MeineBuchungenSkeleton />}>
                            <MeineBuchungenSection name={displayName} />
                        </Suspense>
                    ) : isAdmin ? (
                        <div className="card" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <div style={{ fontSize: '24px', marginBottom: '8px' }}>👆</div>
                            Bitte oben einen Eltern-Account auswählen.
                        </div>
                    ) : null}
                </div>
            </main>
        </div>
    );
}
