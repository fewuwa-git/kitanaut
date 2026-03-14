import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getBelege, getUsers, getOrgById } from '@/lib/data';

export const metadata: Metadata = { title: 'Meine Belege' };
import Sidebar from '@/components/Sidebar';
import BelegeTable from '@/components/BelegeTable';

const STATUS_LABELS: Record<string, string> = {
    entwurf: 'Entwurf',
    eingereicht: 'Eingereicht',
    bezahlt: 'Bezahlt',
    abgelehnt: 'Abgelehnt',
};

async function BelegeSection({
    role,
    userId,
    orgId,
    selectedUserId,
    selectedStatus,
}: {
    role: string;
    userId: string;
    orgId: string;
    selectedUserId?: string;
    selectedStatus?: string;
}) {
    const isAdmin = role === 'admin';
    const filterUserId = isAdmin ? selectedUserId : userId;
    const allBelege = await getBelege(orgId, filterUserId);

    const belege = selectedStatus
        ? allBelege.filter(b => b.status === selectedStatus)
        : allBelege;

    const allUsers = isAdmin
        ? (await getUsers(orgId)).filter(u => ['eltern', 'member', 'admin'].includes(u.role)).sort((a, b) => a.name.localeCompare(b.name))
        : [];

    const org = orgId ? await getOrgById(orgId) : null;
    const orgAddress = [org?.name, org?.address_street, [org?.address_zip, org?.address_city].filter(Boolean).join(' ')].filter(Boolean).join(', ');

    return (
        <BelegeTable
            belege={belege}
            allUsers={allUsers}
            isAdmin={isAdmin}
            role={role}
            currentUserId={userId}
            selectedUserId={selectedUserId}
            selectedStatus={selectedStatus}
            statusLabels={STATUS_LABELS}
            orgAddress={orgAddress}
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
    const role = headersList.get('x-user-role') as 'admin' | 'member' | 'eltern' | 'springerin' | 'teammitglied' | null;
    const name = headersList.get('x-user-name') || '';
    const email = headersList.get('x-user-email') || '';
    const orgId = headersList.get('x-org-id') || '';

    if (!userId || !role) redirect('/login');
    if (role !== 'eltern' && role !== 'teammitglied' && role !== 'member' && role !== 'admin') redirect('/dashboard');

    const params = await searchParams;
    const selectedUserId = params?.userId as string | undefined;
    const selectedStatus = params?.status as string | undefined;

    return (
        <div className="app-layout">
            <Sidebar user={{ name, email, role }} />
            <main className="main-content">
                <div className="page-body">
                    <Suspense fallback={<BuelegeSkeleton />}>
                        <BelegeSection
                            role={role}
                            userId={userId}
                            orgId={orgId}
                            selectedUserId={selectedUserId}
                            selectedStatus={selectedStatus}
                        />
                    </Suspense>
                </div>
            </main>
        </div>
    );
}
