import { NextRequest, NextResponse } from 'next/server';

interface Window {
    count: number;
    resetAt: number;
}

const store = new Map<string, Window>();

// Alte Einträge alle 5 Minuten aufräumen
setInterval(() => {
    const now = Date.now();
    for (const [key, win] of store.entries()) {
        if (win.resetAt < now) store.delete(key);
    }
}, 5 * 60 * 1000);

function getIp(req: NextRequest): string {
    return (
        req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
        req.headers.get('x-real-ip') ||
        'unknown'
    );
}

/**
 * Gibt eine 429-Response zurück wenn das Limit überschritten ist, sonst null.
 * @param key      Bucket-Name (z.B. 'login', 'password-reset')
 * @param max      Max. Anfragen pro Fenster
 * @param windowMs Fenstergröße in Millisekunden
 */
export function rateLimit(
    req: NextRequest,
    key: string,
    max: number,
    windowMs: number,
): NextResponse | null {
    const ip = getIp(req);
    const storeKey = `${key}:${ip}`;
    const now = Date.now();

    let win = store.get(storeKey);
    if (!win || win.resetAt < now) {
        win = { count: 0, resetAt: now + windowMs };
        store.set(storeKey, win);
    }

    win.count += 1;

    if (win.count > max) {
        const retryAfterSec = Math.ceil((win.resetAt - now) / 1000);
        return NextResponse.json(
            { error: 'Zu viele Anfragen. Bitte warte einen Moment und versuche es erneut.' },
            {
                status: 429,
                headers: { 'Retry-After': String(retryAfterSec) },
            },
        );
    }

    return null;
}
