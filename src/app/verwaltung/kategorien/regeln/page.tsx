import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getCategories, getCategoryRules } from '@/lib/data';
import Sidebar from '@/components/Sidebar';
import KategorienRegelnClient from '@/components/KategorienRegelnClient';

export const metadata: Metadata = { title: 'Import-Regeln' };

async function RegelnSection() {
    const [categories, rules] = await Promise.all([getCategories(), getCategoryRules()]);
    return <KategorienRegelnClient initialRules={rules} categories={categories} />;
}

function RegelnSkeleton() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[...Array(4)].map((_, i) => (
                <div key={i} style={{ height: '56px', borderRadius: '8px', background: 'var(--bg-secondary)', animation: 'pulse 1.5s ease-in-out infinite', animationDelay: `${i * 0.07}s` }} />
            ))}
        </div>
    );
}

export default async function KategorienRegelnPage() {
    const headersList = await headers();
    const userId = headersList.get('x-user-id');
    const role = headersList.get('x-user-role') as 'admin' | 'finanzvorstand' | 'member' | 'eltern' | 'springerin' | 'teammitglied' | null;
    const name = headersList.get('x-user-name') || '';
    const email = headersList.get('x-user-email') || '';

    if (!userId || !role) redirect('/login');
    if (role !== 'admin' && role !== 'finanzvorstand') redirect('/dashboard');

    return (
        <div className="app-layout">
            <Sidebar user={{ name, email, role }} />
            <main className="main-content">
                <div className="page-body">
                    <Suspense fallback={<RegelnSkeleton />}>
                        <RegelnSection />
                    </Suspense>
                </div>
            </main>
        </div>
    );
}
