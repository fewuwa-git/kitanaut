import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getAllAbrechnungen, getSpringerinNotes } from '@/lib/data';
import Sidebar from '@/components/Sidebar';

export const metadata: Metadata = { title: 'Springerin Dashboard' };
import SpringerinDashboard from '@/components/SpringerinDashboard';

async function SpringerinSection({ currentUserName, orgId }: { currentUserName: string; orgId: string }) {
    const [abrechnungen, initialNotes] = await Promise.all([
        getAllAbrechnungen(orgId),
        getSpringerinNotes(orgId),
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
    const role = headersList.get('x-user-role') as 'admin' | 'finanzvorstand' | 'member' | 'eltern' | 'springerin' | 'teammitglied' | null;
    const name = headersList.get('x-user-name') || '';
    const email = headersList.get('x-user-email') || '';
    const orgId = headersList.get('x-org-id') || '';

    if (!userId || !role) redirect('/login');
    if (role !== 'admin' && role !== 'finanzvorstand' && role !== 'member') {
        return (
            <div className="app-layout">
                <Sidebar user={{ name, email, role }} />
                <main className="main-content">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
                        <div className="card" style={{ textAlign: 'center', maxWidth: '400px', padding: '2.5rem' }}>
                            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔒</div>
                            <h2 style={{ marginBottom: '0.5rem' }}>Kein Zugriff</h2>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Diese Seite ist nur für den Vorstand zugänglich.</p>
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
                <div className="page-body">
                    <Suspense fallback={<SpringerinSkeleton />}>
                        <SpringerinSection currentUserName={name} orgId={orgId} />
                    </Suspense>
                </div>
            </main>
        </div>
    );
}
