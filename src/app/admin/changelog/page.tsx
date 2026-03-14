import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySuperAdminToken } from '@/lib/auth';
import { CHANGELOG } from '@/lib/changelog';

export const metadata: Metadata = { title: 'Changelog – Kitanaut Admin' };

export default async function AdminChangelogPage() {
    const cookieStore = await cookies();
    const adminToken = cookieStore.get('admin_token')?.value;
    const adminPayload = adminToken ? await verifySuperAdminToken(adminToken) : null;
    if (!adminPayload) redirect('/admin/login');

    return (
        <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
            <h1 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Changelog</h1>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
    );
}
