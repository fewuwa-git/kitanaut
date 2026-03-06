import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getTransactions, getCategories } from '@/lib/data';
import Sidebar from '@/components/Sidebar';

export const metadata: Metadata = { title: 'Kontoauszug' };
export const dynamic = 'force-dynamic';
import KontoauszugClient from '@/components/KontoauszugClient';

async function KontoauszugSection({ role }: { role: 'admin' | 'member' }) {
    const [transactions, categories] = await Promise.all([getTransactions(), getCategories()]);
    return <KontoauszugClient transactions={transactions} categories={categories} userRole={role} />;
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
        return (
            <div className="app-layout">
                <Sidebar user={{ name, email, role }} />
                <main className="main-content">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
                        <div className="card" style={{ textAlign: 'center', maxWidth: '400px', padding: '2.5rem' }}>
                            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔒</div>
                            <h2 style={{ marginBottom: '0.5rem' }}>Kein Zugriff</h2>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Diese Seite ist nur für Vorstandsmitglieder zugänglich.</p>
                            <a href="/eltern/buchungen" className="sidebar-link" style={{ justifyContent: 'center' }}>Zur Startseite</a>
                        </div>
                    </div>
                </main>
            </div>
        );
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
