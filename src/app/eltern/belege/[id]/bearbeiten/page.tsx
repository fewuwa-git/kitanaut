import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import BelegForm from '@/components/BelegForm';
import { getBelegById } from '@/lib/data';

export const metadata: Metadata = { title: 'Beleg bearbeiten' };

export default async function BelegBearbeitenPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const headersList = await headers();
    const userId = headersList.get('x-user-id');
    const role = headersList.get('x-user-role') as 'admin' | 'member' | 'eltern' | 'springerin' | null;
    const name = headersList.get('x-user-name') || '';
    const email = headersList.get('x-user-email') || '';

    if (!userId || !role) redirect('/login');
    if (role !== 'eltern' && role !== 'member' && role !== 'admin') redirect('/dashboard');

    const { id } = await params;
    const beleg = await getBelegById(id);
    if (!beleg) notFound();

    // Non-admins can only edit their own entwurf belege
    const isAdmin = role === 'admin' || role === 'member';
    if (!isAdmin && beleg.user_id !== userId) redirect('/eltern/belege');
    if (beleg.status !== 'entwurf' && beleg.status !== 'abgelehnt') redirect('/eltern/belege');

    return (
        <div className="app-layout">
            <Sidebar user={{ name, email, role }} />
            <main className="main-content">
                <div className="page-body">
                    <div className="card" style={{ padding: '16px 24px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div className="page-header-left">
                            <h1>Beleg bearbeiten</h1>
                            <p>{beleg.belegnummer || beleg.id}</p>
                        </div>
                    </div>
                    <BelegForm userId={beleg.user_id} beleg={beleg} />
                </div>
            </main>
        </div>
    );
}
