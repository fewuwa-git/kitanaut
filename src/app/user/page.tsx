import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import AdminClient from '@/components/AdminClient';

export const metadata: Metadata = { title: 'Benutzerverwaltung' };

export default async function AdminPage() {
    const headersList = await headers();
    const userId = headersList.get('x-user-id');
    const role = headersList.get('x-user-role') as 'admin' | 'member' | 'eltern' | 'springerin' | null;
    const name = headersList.get('x-user-name') || '';
    const email = headersList.get('x-user-email') || '';

    if (!userId || !role) redirect('/login');
    if (role !== 'admin') redirect(`/user/${userId}/edit`);

    return (
        <AdminClient currentUser={{ name, email, role }} />
    );
}
