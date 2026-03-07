import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function GET() {
    try {
        const filePath = join(process.cwd(), 'docs', 'ki-workflow-log.md');
        const content = readFileSync(filePath, 'utf-8');
        return NextResponse.json({ content });
    } catch {
        return NextResponse.json({ content: 'Log-Datei nicht gefunden.' }, { status: 404 });
    }
}
