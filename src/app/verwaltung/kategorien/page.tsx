import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getCategories } from '@/lib/data';
import Sidebar from '@/components/Sidebar';

export const metadata: Metadata = { title: 'Kategorien' };
import KategorienVerwaltungClient from '@/components/KategorienVerwaltungClient';

async function KategorienSection() {
    const categories = await getCategories();
    return <KategorienVerwaltungClient initialCategories={categories} />;
}

function KategorienSkeleton() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[...Array(5)].map((_, i) => (
                <div key={i} style={{ height: '56px', borderRadius: '8px', background: 'var(--bg-secondary)', animation: 'pulse 1.5s ease-in-out infinite', animationDelay: `${i * 0.07}s` }} />
            ))}
        </div>
    );
}

export default async function KategorienVerwaltungPage() {
    const headersList = await headers();
    const userId = headersList.get('x-user-id');
    const role = headersList.get('x-user-role') as 'admin' | 'member' | 'eltern' | 'springerin' | null;
    const name = headersList.get('x-user-name') || '';
    const email = headersList.get('x-user-email') || '';

    if (!userId || !role) redirect('/login');
    if (role !== 'admin' && role !== 'finanzvorstand') redirect('/dashboard');

    return (
        <div className="app-layout">
            <Sidebar user={{ name, email, role }} />
            <main className="main-content">
                <div className="page-body">
                    <Suspense fallback={<KategorienSkeleton />}>
                        <KategorienSection />
                    </Suspense>
                </div>
            </main>
        </div>
    );
}
