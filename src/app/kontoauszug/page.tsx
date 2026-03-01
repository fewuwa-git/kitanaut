import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/lib/auth';
import { getTransactions } from '@/lib/data';
import Sidebar from '@/components/Sidebar';
import KontoauszugClient from '@/components/KontoauszugClient';

export default async function KontoauszugPage() {
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
                        <h1>Kontoauszug</h1>
                        <p>Komplette Übersicht aller Buchungen</p>
                    </div>
                </div>
                <div className="page-body">
                    <KontoauszugClient transactions={transactions} userRole={payload.role} />
                </div>
            </main>
        </div>
    );
}
