'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ConfirmModal from '@/components/ConfirmModal';

export default function DeleteBelegButton({ id, label }: { id: string; label: string }) {
    const [showModal, setShowModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const router = useRouter();

    const handleConfirm = async () => {
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/belege/${id}`, { method: 'DELETE' });
            if (res.ok) { setShowModal(false); router.refresh(); }
            else alert('Fehler beim Löschen.');
        } catch {
            alert('Netzwerkfehler.');
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <>
            <button onClick={() => setShowModal(true)} className="btn btn-sm btn-danger"
                style={{ padding: '4px 10px' }}>
                Löschen
            </button>
            <ConfirmModal
                isOpen={showModal}
                title="Beleg löschen"
                message={`Möchtest du den Beleg „${label}" wirklich unwiderruflich löschen?`}
                confirmLabel="Ja, löschen"
                confirmClass="btn-danger"
                isLoading={isDeleting}
                onConfirm={handleConfirm}
                onCancel={() => setShowModal(false)}
            />
        </>
    );
}
