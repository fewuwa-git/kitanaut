import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getTransactions, getCategories } from '@/lib/data';
import Sidebar from '@/components/Sidebar';
import CategoryClient from '@/components/CategoryClient';

async function CategoriesSection() {
    const [transactions, categories] = await Promise.all([getTransactions(), getCategories()]);
    return <CategoryClient transactions={transactions} categories={categories} />;
}

function CategoriesSkeleton() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[...Array(6)].map((_, i) => (
                <div key={i} style={{ height: '64px', borderRadius: '10px', background: 'var(--bg-secondary)', animation: 'pulse 1.5s ease-in-out infinite', animationDelay: `${i * 0.07}s` }} />
            ))}
        </div>
    );
}

export default async function CategoriesPage() {
    const headersList = await headers();
    const userId = headersList.get('x-user-id');
    const role = headersList.get('x-user-role') as 'admin' | 'finanzvorstand' | 'member' | 'eltern' | 'springerin' | 'teammitglied' | null;
    const name = headersList.get('x-user-name') || '';
    const email = headersList.get('x-user-email') || '';

    if (!userId || !role) redirect('/login');
    if (role === 'springerin') redirect('/springerin/abrechnung');
    if (role !== 'admin' && role !== 'finanzvorstand' && role !== 'member') {
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
                <div className="page-body">
                    <Suspense fallback={<CategoriesSkeleton />}>
                        <CategoriesSection />
                    </Suspense>
                </div>
            </main>
        </div>
    );
}
