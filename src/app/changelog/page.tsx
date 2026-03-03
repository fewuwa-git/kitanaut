import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { CHANGELOG } from '@/lib/changelog';

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
                <div className="page-header">
                    <div className="page-header-left">
                        <h1>Changelog</h1>
                        <p>Was wurde verbessert und wann</p>
                    </div>
                </div>
                <div className="page-body">
                    <div style={{ maxWidth: '680px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {CHANGELOG.map((entry, i) => (
                            <div key={i} className="card">
                                <div className="card-header">
                                    <h2 className="card-title" style={{ fontSize: '15px' }}>{entry.date}</h2>
                                </div>
                                <div className="card-body">
                                    <ul style={{ margin: 0, padding: '0 0 0 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {entry.changes.map((change, j) => (
                                            <li key={j} style={{ fontSize: '14px', color: 'var(--text)', lineHeight: '1.5' }}>
                                                {change}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
}
