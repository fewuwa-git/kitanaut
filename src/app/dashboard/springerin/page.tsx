import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/lib/auth';
import { getAllAbrechnungen, getSpringerinNotes } from '@/lib/data';
import Sidebar from '@/components/Sidebar';
import SpringerinDashboard from '@/components/SpringerinDashboard';

export default async function SpringerinDashboardPage() {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) redirect('/login');

    const payload = await verifyToken(token);
    if (!payload) redirect('/login');

    // Access restricted to admin and member
    if (payload.role !== 'admin' && payload.role !== 'member') {
        return <div style={{ padding: '2rem' }}>Zugriff verweigert. Diese Seite ist nur für den Vorstand zugänglich.</div>;
    }

    const abrechnungen = await getAllAbrechnungen();
    const initialNotes = await getSpringerinNotes();

    return (
        <div className="app-layout">
            <Sidebar user={{ name: payload.name, email: payload.email, role: payload.role }} />
            <main className="main-content">
                <div className="page-header">
                    <div className="page-header-left">
                        <h1>Springerin Übersicht</h1>
                        <p>Monatliche Übersicht der Springerstunden und -kosten</p>
                    </div>
                </div>
                <div className="page-body">
                    <SpringerinDashboard
                        abrechnungen={abrechnungen}
                        initialNotes={initialNotes}
                        currentUserName={payload.name}
                    />
                </div>
            </main>
        </div>
    );
}
