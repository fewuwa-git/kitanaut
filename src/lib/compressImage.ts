import sharp from 'sharp';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function compressIfImage(
    buffer: ArrayBuffer,
    mimeType: string
): Promise<{ data: Buffer; contentType: string; compressed: boolean }> {
    if (!IMAGE_TYPES.includes(mimeType)) {
        return { data: Buffer.from(buffer), contentType: mimeType, compressed: false };
    }

    const compressed = await sharp(Buffer.from(buffer))
        .rotate() // auto-rotate based on EXIF
        .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();

    return { data: compressed, contentType: 'image/webp', compressed: true };
}
