import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { CHANGELOG } from '@/lib/changelog';

export const metadata: Metadata = { title: 'Changelog' };

export default async function ChangelogPage() {
    const headersList = await headers();
    const userId = headersList.get('x-user-id');
    const role = headersList.get('x-user-role') as 'admin' | 'member' | 'eltern' | 'springerin' | null;
    const name = headersList.get('x-user-name') || '';
    const email = headersList.get('x-user-email') || '';

    if (!userId || !role) redirect('/login');

    return (
        <div className="app-layout">
            <Sidebar user={{ name, email, role }} />
            <main className="main-content">
                <div className="page-body">
                    <div className="card" style={{ padding: '16px 24px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div className="page-header-left">
                            <h1>Changelog</h1>
                            <p>Was wurde verbessert und wann</p>
                        </div>
                    </div>
                    <div style={{ maxWidth: '80%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {CHANGELOG.map((entry, i) => (
                            <div key={i} className="card">
                                <div className="card-header">
                                    <h2 className="card-title" style={{ fontSize: '15px' }}>{entry.date}</h2>
                                </div>
                                <div className="card-body">
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        {entry.changes.map((change, j) => {
                                            const isSection = change.startsWith('—');
                                            if (isSection) {
                                                const label = change.replace(/^—\s*/, '').replace(/\s*—$/, '');
                                                return (
                                                    <div key={j} style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: j === 0 ? '0 0 6px 0' : '14px 0 6px 0' }}>
                                                        <span style={{ fontWeight: 700, fontSize: '12px', color: 'var(--navy)', whiteSpace: 'nowrap', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                                                            {label}
                                                        </span>
                                                        <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                                                    </div>
                                                );
                                            }
                                            return (
                                                <div key={j} style={{ display: 'flex', gap: '8px', alignItems: 'baseline', paddingLeft: '2px' }}>
                                                    <span style={{ color: 'var(--text-muted)', flexShrink: 0, fontSize: '12px' }}>–</span>
                                                    <span style={{ fontSize: '14px', color: 'var(--text)', lineHeight: '1.5' }}>{change}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
}
