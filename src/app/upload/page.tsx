import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import UploadClient from '@/components/UploadClient';

export const metadata: Metadata = { title: 'Daten importieren' };

export default async function UploadPage() {
    const headersList = await headers();
    const userId = headersList.get('x-user-id');
    const role = headersList.get('x-user-role') as 'admin' | 'finanzvorstand' | 'member' | 'eltern' | 'springerin' | null;
    const name = headersList.get('x-user-name') || '';
    const email = headersList.get('x-user-email') || '';

    if (!userId || !role) redirect('/login');
    if (role !== 'admin' && role !== 'finanzvorstand') redirect('/dashboard');

    return (
        <UploadClient user={{ name, email, role }} />
    );
}
