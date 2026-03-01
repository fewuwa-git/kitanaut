'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface DeleteAbrechnungButtonProps {
    id: string;
    label: string;
}

export default function DeleteAbrechnungButton({ id, label }: DeleteAbrechnungButtonProps) {
    const [isDeleting, setIsDeleting] = useState(false);
    const router = useRouter();

    const handleDelete = async () => {
        const confirmed = window.confirm(`Möchtest du die Abrechnung "${label}" wirklich unwiderruflich löschen?`);
        if (!confirmed) return;

        setIsDeleting(true);
        try {
            const res = await fetch(`/api/abrechnungen?id=${id}`, {
                method: 'DELETE',
            });

            if (res.ok) {
                router.refresh();
            } else {
                const errorData = await res.json();
                alert(`Fehler beim Löschen: ${errorData.error || 'Unbekannter Fehler'}`);
            }
        } catch (error) {
            console.error('Error deleting abrechnung:', error);
            alert('Ein Netzwerkfehler ist aufgetreten.');
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="btn btn-sm btn-danger"
            style={{
                padding: '4px 10px',
                backgroundColor: 'var(--danger, #dc3545)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: isDeleting ? 'not-allowed' : 'pointer',
                opacity: isDeleting ? 0.7 : 1,
                fontSize: '12px',
                fontWeight: '500'
            }}
            title="Abrechnung löschen"
        >
            {isDeleting ? '...' : 'Löschen'}
        </button>
    );
}
