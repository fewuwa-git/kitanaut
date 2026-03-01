import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/lib/auth';
import AdminClient from '@/components/AdminClient';

export default async function AdminPage() {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) redirect('/login');
    const payload = await verifyToken(token);
    if (!payload) redirect('/login');

    return (
        <AdminClient currentUser={{ name: payload.name, email: payload.email, role: payload.role }} />
    );
}
