import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getCategories, getCategoryRules, getTransactions } from '@/lib/data';
import { getMatchingRule } from '@/lib/categoryMatcher';
import Sidebar from '@/components/Sidebar';
import KategorienRegelLogClient, { type LogEntry } from '@/components/KategorienRegelLogClient';

export const metadata: Metadata = { title: 'Regelprotokoll' };

async function LogSection() {
    const [categories, rules, transactions] = await Promise.all([
        getCategories(),
        getCategoryRules(),
        getTransactions(),
    ]);

    const entries: LogEntry[] = transactions
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date))
        .map(tx => {
            const rule = getMatchingRule(rules, tx.description, tx.counterparty);
            const conflict =
                rule !== null &&
                tx.category !== 'Nicht kategorisiert' &&
                rule.category_name !== tx.category;
            return {
                id: tx.id,
                date: tx.date,
                description: tx.description,
                counterparty: tx.counterparty,
                amount: tx.amount,
                category: tx.category,
                rule: rule
                    ? {
                          id: rule.id,
                          category_name: rule.category_name,
                          field: rule.field,
                          match_type: rule.match_type,
                          value: rule.value,
                          priority: rule.priority,
                      }
                    : null,
                conflict,
            };
        });

    return <KategorienRegelLogClient entries={entries} categories={categories} />;
}

function LogSkeleton() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[...Array(6)].map((_, i) => (
                <div key={i} style={{ height: '48px', borderRadius: '8px', background: 'var(--bg-secondary)', animation: 'pulse 1.5s ease-in-out infinite', animationDelay: `${i * 0.07}s` }} />
            ))}
        </div>
    );
}

export default async function KategorienRegelLogPage() {
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
                    <Suspense fallback={<LogSkeleton />}>
                        <LogSection />
                    </Suspense>
                </div>
            </main>
        </div>
    );
}
