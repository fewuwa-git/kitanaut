import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getAllAbrechnungen, getSpringerinNotes } from '@/lib/data';
import Sidebar from '@/components/Sidebar';

export const metadata: Metadata = { title: 'Springerin Dashboard' };
import SpringerinDashboard from '@/components/SpringerinDashboard';

async function SpringerinSection({ currentUserName }: { currentUserName: string }) {
    const [abrechnungen, initialNotes] = await Promise.all([
        getAllAbrechnungen(),
        getSpringerinNotes(),
    ]);
    return (
        <SpringerinDashboard
            abrechnungen={abrechnungen}
            initialNotes={initialNotes}
            currentUserName={currentUserName}
        />
    );
}

function SpringerinSkeleton() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ height: '80px', borderRadius: '10px', background: 'var(--bg-secondary)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            {[...Array(5)].map((_, i) => (
                <div key={i} style={{ height: '60px', borderRadius: '8px', background: 'var(--bg-secondary)', animation: 'pulse 1.5s ease-in-out infinite', animationDelay: `${i * 0.07}s` }} />
            ))}
        </div>
    );
}

export default async function SpringerinDashboardPage() {
    const headersList = await headers();
    const userId = headersList.get('x-user-id');
    const role = headersList.get('x-user-role') as 'admin' | 'member' | 'eltern' | 'springerin' | null;
    const name = headersList.get('x-user-name') || '';
    const email = headersList.get('x-user-email') || '';

    if (!userId || !role) redirect('/login');
    if (role !== 'admin' && role !== 'member') {
        return <div style={{ padding: '2rem' }}>Zugriff verweigert. Diese Seite ist nur für den Vorstand zugänglich.</div>;
    }

    return (
        <div className="app-layout">
            <Sidebar user={{ name, email, role }} />
            <main className="main-content">
                <div className="page-header">
                    <div className="page-header-left">
                        <h1>Springerin Übersicht</h1>
                        <p>Monatliche Übersicht der Springerstunden und -kosten</p>
                    </div>
                </div>
                <div className="page-body">
                    <Suspense fallback={<SpringerinSkeleton />}>
                        <SpringerinSection currentUserName={name} />
                    </Suspense>
                </div>
            </main>
        </div>
    );
}
