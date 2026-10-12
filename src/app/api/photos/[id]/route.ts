import album from '@/features/photo-library/data/cup-2026.json';
import { originalUrl, safeFilename } from '@/features/photo-library/model';

export const runtime = 'nodejs';
export const maxDuration = 120;
const photos = new Map(album.photos.map(photo => [photo.id, photo]));

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const photo = photos.get(id);
  if (!photo) return Response.json({ error: '사진을 찾을 수 없습니다.' }, { status: 404 });
  try {
    const upstream = await fetch(originalUrl(photo.id), {
      cache: 'no-store',
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(110_000)]),
    });
    const type = upstream.headers.get('content-type') || '';
    if (!upstream.ok || !type.startsWith('image/') || !upstream.body) {
      await upstream.body?.cancel();
      return Response.json({ error: '원본을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 502 });
    }
    const name = encodeURIComponent(safeFilename(photo.name)).replace(/['()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
    return new Response(upstream.body, { headers: {
      'Content-Type': type,
      'Content-Disposition': `inline; filename="photo.jpg"; filename*=UTF-8''${name}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    } });
  } catch {
    return Response.json({ error: '원본 연결이 지연되고 있습니다. 다시 시도해 주세요.' }, { status: 502 });
  }
}
