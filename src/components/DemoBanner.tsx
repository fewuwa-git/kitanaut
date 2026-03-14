'use client';
export default function DemoBanner() {
    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
            background: '#f59e0b', color: '#1c1917',
            padding: '8px 16px',
            fontSize: '13px',
            textAlign: 'center',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
        }}>
            <span>Demo-Instanz – Daten werden täglich um 3:00 Uhr zurückgesetzt.</span>
            <span style={{ opacity: 0.7 }}>|</span>
            <span>Login: <strong>admin@demo.kitanaut.de</strong> · Passwort: <strong>demo1234</strong></span>
        </div>
    );
}
