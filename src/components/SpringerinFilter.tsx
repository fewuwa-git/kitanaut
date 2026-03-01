'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { User } from '@/lib/data';

interface SpringerinFilterProps {
    springerinnen: User[];
}

export default function SpringerinFilter({ springerinnen }: SpringerinFilterProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const currentSpringerId = searchParams.get('springerinId') || '';

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        const params = new URLSearchParams(searchParams.toString());

        if (value) {
            params.set('springerinId', value);
        } else {
            params.delete('springerinId');
        }

        router.push(`?${params.toString()}`);
    };

    return (
        <div className="filter-group" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <label htmlFor="springerin-filter" style={{ fontWeight: '600', color: 'var(--navy)' }}>
                Filter nach Springerin:
            </label>
            <select
                id="springerin-filter"
                value={currentSpringerId}
                onChange={handleChange}
                className="form-control"
                style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--card-bg)',
                    minWidth: '200px'
                }}
            >
                <option value="">Alle anzeigen</option>
                {springerinnen.map((s) => (
                    <option key={s.id} value={s.id}>
                        {s.name}
                    </option>
                ))}
            </select>
        </div>
    );
}
