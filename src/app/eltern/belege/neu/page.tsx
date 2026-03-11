import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import BelegForm from '@/components/BelegForm';
import { getUsers } from '@/lib/data';

export const metadata: Metadata = { title: 'Neuer Beleg' };

export default async function BelegNeuPage() {
    const headersList = await headers();
    const userId = headersList.get('x-user-id');
    const role = headersList.get('x-user-role') as 'admin' | 'member' | 'eltern' | 'springerin' | 'teammitglied' | null;
    const name = headersList.get('x-user-name') || '';
    const email = headersList.get('x-user-email') || '';
    const orgId = headersList.get('x-org-id') || '';

    if (!userId || !role) redirect('/login');
    if (role !== 'eltern' && role !== 'teammitglied' && role !== 'member' && role !== 'admin') redirect('/dashboard');

    const isAdmin = role === 'admin';
    const selectableUsers = isAdmin
        ? (await getUsers(orgId))
            .filter(u => ['eltern', 'member', 'admin'].includes(u.role))
            .sort((a, b) => a.name.localeCompare(b.name))
        : [];

    return (
        <div className="app-layout">
            <Sidebar user={{ name, email, role }} />
            <main className="main-content">
                <div className="page-body">
                    <BelegForm userId={userId!} isAdmin={isAdmin} selectableUsers={selectableUsers} />
                </div>
            </main>
        </div>
    );
}
