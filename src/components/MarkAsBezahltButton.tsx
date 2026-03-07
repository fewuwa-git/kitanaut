'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ConfirmModal from '@/components/ConfirmModal';
import type { User, AbrechnungTag } from '@/lib/pdf';

interface PdfProps {
    user: User;
    monthLabel: string;
    tage: AbrechnungTag[];
    totalStunden: number;
    totalBetrag: number;
    abrechnungId: string;
    jahr: number;
    monat: number;
}

interface MarkAsBezahltButtonProps {
    id: string;
    label: string;
    targetStatus: 'eingereicht' | 'bezahlt';
    pdfProps?: PdfProps;
}

export default function MarkAsBezahltButton({ id, label, targetStatus, pdfProps }: MarkAsBezahltButtonProps) {
    const [showModal, setShowModal] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [sendEmail, setSendEmail] = useState(true);
    const router = useRouter();

    const isBezahlt = targetStatus === 'bezahlt';
    const buttonLabel = isBezahlt ? '✅ Bezahlt' : '📤 Einreichen';
    const btnClass = isBezahlt ? 'btn btn-sm btn-success' : 'btn btn-sm btn-primary';

    const handleConfirm = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/abrechnungen', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'update_status', id, status: targetStatus, sendEmail: isBezahlt ? sendEmail : false }),
            });

            if (res.ok) {
                setShowModal(false);

                if (isBezahlt && pdfProps) {
                    try {
                        const { generateAbrechnungPDF } = await import('@/lib/pdf');
                        const blobUrl = await generateAbrechnungPDF(
                            pdfProps.user,
                            pdfProps.monthLabel,
                            pdfProps.tage,
                            pdfProps.totalStunden,
                            pdfProps.totalBetrag,
                            pdfProps.abrechnungId,
                            pdfProps.jahr,
                            pdfProps.monat
                        );
                        const blobRes = await fetch(blobUrl);
                        const blob = await blobRes.blob();
                        URL.revokeObjectURL(blobUrl);

                        const safeName = pdfProps.user.name.replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, '_');
                        const fileName = `Abrechnung_${safeName}_${pdfProps.jahr}-${String(pdfProps.monat).padStart(2, '0')}.pdf`;
                        const file = new File([blob], fileName, { type: 'application/pdf' });

                        const formData = new FormData();
                        formData.append('file', file);
                        await fetch('/api/receipts', { method: 'POST', body: formData });
                    } catch (pdfErr) {
                        console.error('PDF konnte nicht in Belegverwaltung hochgeladen werden:', pdfErr);
                    }
                }

                router.refresh();
            } else {
                const errorData = await res.json();
                alert(`Fehler: ${errorData.error || 'Unbekannter Fehler'}`);
            }
        } catch (error) {
            console.error('Error updating status:', error);
            alert('Ein Netzwerkfehler ist aufgetreten.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <button
                onClick={() => setShowModal(true)}
                className={btnClass}
                style={{ padding: '4px 10px' }}
            >
                {buttonLabel}
            </button>
            <ConfirmModal
                isOpen={showModal}
                title={isBezahlt ? 'Als bezahlt markieren' : 'Abrechnung einreichen'}
                message={isBezahlt
                    ? `Möchtest du die Abrechnung von „${label}" wirklich als bezahlt markieren?`
                    : `Möchtest du die Abrechnung von „${label}" als eingereicht markieren?`}
                confirmLabel={isBezahlt ? '✅ Ja, als bezahlt markieren' : '📤 Ja, einreichen'}
                confirmClass={isBezahlt ? 'btn-success' : 'btn-primary'}
                isLoading={isLoading}
                checkboxLabel={isBezahlt ? 'Bezahlt-E-Mail an die Springerin senden' : undefined}
                checkboxChecked={isBezahlt ? sendEmail : undefined}
                onCheckboxChange={isBezahlt ? setSendEmail : undefined}
                onConfirm={handleConfirm}
                onCancel={() => setShowModal(false)}
            />
        </>
    );
}
