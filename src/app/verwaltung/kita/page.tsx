import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { getOrgById } from '@/lib/data';
import KitaProfilClient from './KitaProfilClient';

export const metadata: Metadata = { title: 'Kita-Profil' };

export default async function KitaProfilPage() {
    const headersList = await headers();
    const userId = headersList.get('x-user-id');
    const role = headersList.get('x-user-role');
    const name = headersList.get('x-user-name') || '';
    const email = headersList.get('x-user-email') || '';
    const orgId = headersList.get('x-org-id') || '';

    if (!userId || !role) redirect('/login');
    if (role !== 'admin') redirect('/dashboard');

    const org = await getOrgById(orgId);
    if (!org) redirect('/dashboard');

    return (
        <div className="app-layout">
            <Sidebar user={{ name, email, role }} />
            <main className="main-content">
                <div className="page-body">
                    <KitaProfilClient org={org} />
                </div>
            </main>
        </div>
    );
}
