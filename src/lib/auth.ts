import { SignJWT, jwtVerify } from 'jose';

export interface JWTPayload {
    userId: string;
    email: string;
    name: string;
    role: 'admin' | 'finanzvorstand' | 'member' | 'eltern' | 'springerin' | 'teammitglied';
    orgId: string;
    orgSlug: string;
}

export interface SuperAdminJWTPayload {
    superAdmin: true;
    email: string;
}

function getSecret(): Uint8Array {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET environment variable is not set');
    }
    return new TextEncoder().encode(process.env.JWT_SECRET);
}

export async function signToken(payload: JWTPayload): Promise<string> {
    return await new SignJWT({ ...payload })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(getSecret());
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
    try {
        const { payload } = await jwtVerify(token, getSecret());
        return payload as unknown as JWTPayload;
    } catch {
        return null;
    }
}

export async function signSuperAdminToken(payload: SuperAdminJWTPayload): Promise<string> {
    return await new SignJWT({ ...payload })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(getSecret());
}

export async function verifySuperAdminToken(token: string): Promise<SuperAdminJWTPayload | null> {
    try {
        const { payload } = await jwtVerify(token, getSecret());
        const p = payload as unknown as SuperAdminJWTPayload;
        if (!p.superAdmin) return null;
        return p;
    } catch {
        return null;
    }
}
