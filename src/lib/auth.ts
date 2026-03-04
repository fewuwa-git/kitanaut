import { SignJWT, jwtVerify } from 'jose';

export interface JWTPayload {
    userId: string;
    email: string;
    name: string;
    role: 'admin' | 'member' | 'eltern' | 'springerin';
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
