import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/lib/auth';
import { getCategories } from '@/lib/data';
import Sidebar from '@/components/Sidebar';
import KategorienVerwaltungClient from '@/components/KategorienVerwaltungClient';

export default async function KategorienVerwaltungPage() {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) redirect('/login');

    const payload = await verifyToken(token);
    if (!payload) redirect('/login');
    if (payload.role !== 'admin') redirect('/dashboard');

    const categories = await getCategories();

    return (
        <div className="app-layout">
            <Sidebar user={{ name: payload.name, email: payload.email, role: payload.role }} />
            <main className="main-content">
                <div className="page-header">
                    <div className="page-header-left">
                        <h1>Kategorien verwalten</h1>
                        <p>Kategorien für Buchungen anlegen, bearbeiten und löschen</p>
                    </div>
                </div>
                <div className="page-body">
                    <KategorienVerwaltungClient initialCategories={categories} />
                </div>
            </main>
        </div>
    );
}
