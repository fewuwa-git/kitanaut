import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/lib/auth';
import { getTransactions } from '@/lib/data';
import Sidebar from '@/components/Sidebar';
import DashboardClient from '@/components/DashboardClient';

export default async function DashboardPage() {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) redirect('/login');

    const payload = await verifyToken(token);
    if (!payload) redirect('/login');
    if (payload.role === 'springerin') redirect('/springerin/abrechnung');
    if (payload.role !== 'admin' && payload.role !== 'member') {
        return <div style={{ padding: '2rem' }}>Zugriff verweigert. Diese Seite ist nur für Vorstandsmitglieder zugänglich.</div>;
    }

    const transactions = await getTransactions();

    return (
        <div className="app-layout">
            <Sidebar user={{ name: payload.name, email: payload.email, role: payload.role }} />
            <main className="main-content">
                <div className="page-header">
                    <div className="page-header-left">
                        <h1>Kontostand</h1>
                        <p>Finanzieller Überblick der Kita Pankonauten</p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                            Willkommen, {payload.name.split(' ')[0]} 👋
                        </span>
                    </div>
                </div>
                <div className="page-body">
                    <DashboardClient transactions={transactions} />
                </div>
            </main>
        </div>
    );
}
