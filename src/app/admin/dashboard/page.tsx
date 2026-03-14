import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySuperAdminToken } from '@/lib/auth';
import { getAllOrganizations } from '@/lib/data';
import AdminDashboardClient from './AdminDashboardClient';

export default async function AdminDashboardPage() {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;
    const payload = token ? await verifySuperAdminToken(token) : null;

    if (!payload) {
        redirect('/admin/login');
    }

    const orgs = await getAllOrganizations();

    return <AdminDashboardClient orgs={orgs} />;
}
