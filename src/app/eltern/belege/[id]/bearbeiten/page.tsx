import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import BelegForm from '@/components/BelegForm';
import { getBelegById, getOrgById } from '@/lib/data';

export const metadata: Metadata = { title: 'Beleg bearbeiten' };

export default async function BelegBearbeitenPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const headersList = await headers();
    const userId = headersList.get('x-user-id');
    const role = headersList.get('x-user-role') as 'admin' | 'member' | 'eltern' | 'springerin' | 'teammitglied' | null;
    const name = headersList.get('x-user-name') || '';
    const email = headersList.get('x-user-email') || '';
    const orgId = headersList.get('x-org-id') || '';

    if (!userId || !role) redirect('/login');
    if (role !== 'eltern' && role !== 'teammitglied' && role !== 'member' && role !== 'admin') redirect('/dashboard');

    const { id } = await params;
    const beleg = await getBelegById(id, orgId);
    if (!beleg) notFound();

    // Non-admins can only edit their own entwurf belege
    const isAdmin = role === 'admin' || role === 'member';
    if (!isAdmin && beleg.user_id !== userId) redirect('/eltern/belege');
    if (beleg.status !== 'entwurf' && beleg.status !== 'abgelehnt') redirect('/eltern/belege');

    const org = orgId ? await getOrgById(orgId) : null;
    const orgAddress = [org?.name, org?.address_street, [org?.address_zip, org?.address_city].filter(Boolean).join(' ')].filter(Boolean).join(', ');

    return (
        <div className="app-layout">
            <Sidebar user={{ name, email, role }} />
            <main className="main-content">
                <div className="page-body">
                    <BelegForm userId={beleg.user_id} beleg={beleg} orgAddress={orgAddress} />
                </div>
            </main>
        </div>
    );
}
