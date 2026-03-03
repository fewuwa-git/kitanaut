import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getTransactions } from '@/lib/data';
import Sidebar from '@/components/Sidebar';
import KontoauszugClient from '@/components/KontoauszugClient';

async function KontoauszugSection({ role }: { role: 'admin' | 'member' }) {
    const transactions = await getTransactions();
    return <KontoauszugClient transactions={transactions} userRole={role} />;
}

function KontoauszugSkeleton() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[...Array(8)].map((_, i) => (
                <div key={i} style={{ height: '52px', borderRadius: '8px', background: 'var(--bg-secondary)', animation: 'pulse 1.5s ease-in-out infinite', animationDelay: `${i * 0.05}s` }} />
            ))}
        </div>
    );
}

export default async function KontoauszugPage() {
    const headersList = await headers();
    const userId = headersList.get('x-user-id');
    const role = headersList.get('x-user-role') as 'admin' | 'member' | 'eltern' | 'springerin' | null;
    const name = headersList.get('x-user-name') || '';
    const email = headersList.get('x-user-email') || '';

    if (!userId || !role) redirect('/login');
    if (role === 'springerin') redirect('/springerin/abrechnung');
    if (role !== 'admin' && role !== 'member') {
        return <div style={{ padding: '2rem' }}>Zugriff verweigert. Diese Seite ist nur für Vorstandsmitglieder zugänglich.</div>;
    }

    return (
        <div className="app-layout">
            <Sidebar user={{ name, email, role }} />
            <main className="main-content">
                <div className="page-header">
                    <div className="page-header-left">
                        <h1>Kontoauszug</h1>
                        <p>Komplette Übersicht aller Buchungen</p>
                    </div>
                </div>
                <div className="page-body">
                    <Suspense fallback={<KontoauszugSkeleton />}>
                        <KontoauszugSection role={role as 'admin' | 'member'} />
                    </Suspense>
                </div>
            </main>
        </div>
    );
}
