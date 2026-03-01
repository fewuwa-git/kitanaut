import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/lib/auth';
import UploadClient from '@/components/UploadClient';

export default async function UploadPage() {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) redirect('/login');
    const payload = await verifyToken(token);
    if (!payload) redirect('/login');
    if (payload.role !== 'admin') redirect('/dashboard');

    return (
        <UploadClient user={{ name: payload.name, email: payload.email, role: payload.role }} />
    );
}
