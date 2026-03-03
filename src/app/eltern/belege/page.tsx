import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';
import { getBelege, getUsers } from '@/lib/data';
import Sidebar from '@/components/Sidebar';
import BelegeTable from '@/components/BelegeTable';

const STATUS_LABELS: Record<string, string> = {
    entwurf: 'Entwurf',
    eingereicht: 'Eingereicht',
    genehmigt: 'Genehmigt',
    abgelehnt: 'Abgelehnt',
};

async function BelegeSection({
    role,
    userId,
    selectedUserId,
    selectedStatus,
}: {
    role: string;
    userId: string;
    selectedUserId?: string;
    selectedStatus?: string;
}) {
    const isAdmin = role === 'admin' || role === 'member';
    const filterUserId = isAdmin ? selectedUserId : userId;
    const allBelege = await getBelege(filterUserId);

    const belege = selectedStatus
        ? allBelege.filter(b => b.status === selectedStatus)
        : allBelege;

    const allUsers = isAdmin
        ? (await getUsers()).filter(u => ['eltern', 'member', 'admin'].includes(u.role)).sort((a, b) => a.name.localeCompare(b.name))
        : [];

    return (
        <BelegeTable
            belege={belege}
            allUsers={allUsers}
            isAdmin={isAdmin}
            selectedUserId={selectedUserId}
            selectedStatus={selectedStatus}
            statusLabels={STATUS_LABELS}
        />
    );
}

function BuelegeSkeleton() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ height: '48px', borderRadius: '8px', background: 'var(--bg-secondary)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            {[...Array(5)].map((_, i) => (
                <div key={i} style={{ height: '52px', borderRadius: '8px', background: 'var(--bg-secondary)', animation: 'pulse 1.5s ease-in-out infinite', animationDelay: `${i * 0.06}s` }} />
            ))}
        </div>
    );
}

export default async function BelegePage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const headersList = await headers();
    const userId = headersList.get('x-user-id');
    const role = headersList.get('x-user-role') as 'admin' | 'member' | 'eltern' | 'springerin' | null;
    const name = headersList.get('x-user-name') || '';
    const email = headersList.get('x-user-email') || '';

    if (!userId || !role) redirect('/login');
    if (role !== 'eltern' && role !== 'member' && role !== 'admin') redirect('/dashboard');

    const params = await searchParams;
    const selectedUserId = params?.userId as string | undefined;
    const selectedStatus = params?.status as string | undefined;

    return (
        <div className="app-layout">
            <Sidebar user={{ name, email, role }} />
            <main className="main-content">
                <div className="page-header">
                    <div className="page-header-left">
                        <h1>Meine Belege</h1>
                        <p>Übersicht aller eingereichten Belege</p>
                    </div>
                    <div className="page-header-actions">
                        <Link href="/eltern/belege/neu" className="btn btn-primary">
                            ➕ Beleg erstellen
                        </Link>
                    </div>
                </div>
                <div className="page-body">
                    <Suspense fallback={<BuelegeSkeleton />}>
                        <BelegeSection
                            role={role}
                            userId={userId}
                            selectedUserId={selectedUserId}
                            selectedStatus={selectedStatus}
                        />
                    </Suspense>
                </div>
            </main>
        </div>
    );
}
