import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import BelegForm from '@/components/BelegForm';
import { getUsers } from '@/lib/data';

export default async function BelegNeuPage() {
    const headersList = await headers();
    const userId = headersList.get('x-user-id');
    const role = headersList.get('x-user-role') as 'admin' | 'member' | 'eltern' | 'springerin' | null;
    const name = headersList.get('x-user-name') || '';
    const email = headersList.get('x-user-email') || '';

    if (!userId || !role) redirect('/login');
    if (role !== 'eltern' && role !== 'member' && role !== 'admin') redirect('/dashboard');

    const isAdmin = role === 'admin' || role === 'member';
    const selectableUsers = isAdmin
        ? (await getUsers())
            .filter(u => ['eltern', 'member', 'admin'].includes(u.role))
            .sort((a, b) => a.name.localeCompare(b.name))
        : [];

    return (
        <div className="app-layout">
            <Sidebar user={{ name, email, role }} />
            <main className="main-content">
                <div className="page-header">
                    <div className="page-header-left">
                        <h1>Neuer Beleg</h1>
                        <p>Beleg erstellen und als PDF speichern</p>
                    </div>
                </div>
                <div className="page-body">
                    <BelegForm userId={userId!} isAdmin={isAdmin} selectableUsers={selectableUsers} />
                </div>
            </main>
        </div>
    );
}
