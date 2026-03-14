'use client';

import { useState, useEffect } from 'react';
import { generateAbrechnungPDF, User, AbrechnungTag } from '@/lib/pdf';

interface PDFOverviewButtonProps {
    user: User;
    monthLabel: string;
    tage: AbrechnungTag[];
    totalStunden: number;
    totalBetrag: number;
    abrechnungId?: string;
    jahr?: number;
    monat?: number;
    orgName?: string;
}

export default function PDFOverviewButton({
    user,
    monthLabel,
    tage,
    totalStunden,
    totalBetrag,
    abrechnungId,
    jahr,
    monat,
    orgName,
}: PDFOverviewButtonProps) {
    const [generating, setGenerating] = useState(false);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);

    const closeModal = () => setPdfUrl(null);

    useEffect(() => {
        if (!pdfUrl) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [pdfUrl]);

    const handleGenerate = async () => {
        setGenerating(true);
        try {
            const url = await generateAbrechnungPDF(user, monthLabel, tage, totalStunden, totalBetrag, abrechnungId, jahr, monat, orgName);
            setPdfUrl(url);
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Fehler beim Generieren des PDFs.');
        } finally {
            setGenerating(false);
        }
    };

    return (
        <>
            <button
                onClick={handleGenerate}
                disabled={generating}
                className="btn btn-sm"
                style={{ padding: '4px 10px', backgroundColor: 'var(--navy)', color: 'white' }}
            >
                {generating ? '...' : '📄 PDF'}
            </button>

            {pdfUrl && (
                <div
                    style={{
                        position: 'fixed', inset: 0, zIndex: 1000,
                        background: 'rgba(0,0,0,0.6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '16px',
                    }}
                    onClick={closeModal}
                >
                    <div
                        style={{
                            background: 'var(--card-bg)',
                            borderRadius: 'var(--radius)',
                            boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
                            width: '100%',
                            maxWidth: '860px',
                            height: '90vh',
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '14px 20px',
                            borderBottom: '1px solid var(--border)',
                        }}>
                            <span style={{ fontWeight: 600, fontSize: '15px' }}>📄 PDF – {monthLabel}</span>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <a
                                    href={pdfUrl}
                                    download
                                    className="btn btn-sm btn-secondary"
                                    style={{ padding: '4px 12px' }}
                                >
                                    ⬇️ Herunterladen
                                </a>
                                <button
                                    onClick={closeModal}
                                    className="btn btn-sm btn-secondary"
                                    style={{ padding: '4px 12px' }}
                                >
                                    ✕ Schließen
                                </button>
                            </div>
                        </div>
                        <iframe
                            src={pdfUrl}
                            style={{ flex: 1, border: 'none', width: '100%' }}
                            title="PDF Vorschau"
                        />
                    </div>
                </div>
            )}
        </>
    );
}
